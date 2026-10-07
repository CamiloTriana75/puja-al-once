import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HEIGHT = 512;
/** Por debajo de esto un pixel se considera fondo y se descarta. */
const ALPHA_CUTOFF = 128;
/**
 * Fraccion minima del area de la imagen que el blob conservado debe cubrir
 * para contar como "hay una persona ahi". Por debajo de esto (mascara vacia
 * o casi vacia porque el segmentador no encontro a nadie en un encuadre
 * atipico, sombras fuertes, compresion agresiva) se trata como fallo de
 * segmentacion, no como silueta valida.
 */
const MIN_SUBJECT_FRACTION = 0.01;

interface Source {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
}

type Attribution = Omit<Source, "url">;

interface PlayerCard {
  silhouetteId: string;
  [key: string]: unknown;
}

interface NormalizedCutout {
  data: Buffer;
  width: number;
  height: number;
}

interface SubjectBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Caja envolvente de los pixeles opacos de una mascara.
 *
 * Devuelve null cuando no hay ni un pixel opaco, para que quien llame pueda
 * distinguir "no hay sujeto" de "el sujeto ocupa todo".
 */
export function subjectBounds(
  alpha: Uint8Array,
  width: number,
  height: number,
  cutoff: number = ALPHA_CUTOFF,
): SubjectBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x]! < cutoff) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Normaliza el recorte a la altura estandar de la carta (Ruling A: NO
 * elimina el fondo, eso ya lo hizo removeBackground()+keepLargestSubject()
 * antes de llegar aqui).
 *
 * Hace dos cosas, en este orden:
 *
 * 1. RECORTA EL MARGEN TRANSPARENTE a la caja del sujeto (subjectBounds).
 * 2. Ajusta el resultado a HEIGHT de alto.
 *
 * El recorte es lo que hace que la carta se lea bien, y la razon esta en el
 * CSS, no aqui: packages/client/src/components/AuctionCard.tsx monta la
 * imagen con `h-[112%] w-auto object-contain object-bottom` anclada arriba
 * (`-top-6 right-[6%]`), es decir, la escala al 112% de la altura de la carta
 * y la ancla abajo para que la figura "rompa" el borde superior. El diseno
 * asume que el sujeto LLENA el PNG. Sin este recorte, el margen transparente
 * se escala con el y el jugador ve una figurita perdida en una esquina --
 * keane-1999 ocupaba el 44% del alto y se renderizaba al 49% de la carta,
 * al lado de bobby-moore-1966 al 95%, que si la rompe.
 *
 * Sin relleno alrededor del recorte: por definicion, fuera de la caja del
 * sujeto ya no hay nada opaco, asi que el kernel de resize de sharp no tiene
 * de donde "chuparse" transparencia. Lo unico que se pierde es el borde mas
 * extremo del sujeto, redondeado por el propio resize, despreciable.
 *
 * Punto de union entre toSilhouette() y toColorCutout(): las dos llaman a
 * esta misma funcion, con los mismos parametros, sobre el mismo buffer de
 * entrada (`cleaned.png` en main()). Es lo que garantiza que la silueta
 * negra y la foto en color de un mismo jugador salgan con identico ancho,
 * alto y encuadre -- si alguna de las dos normalizara por su cuenta, un
 * cambio futuro en una sin la otra las desalinearia en silencio y la foto ya
 * no encajaria exactamente donde estaba la silueta en el reveal.
 */
async function normalizeCutout(input: Buffer): Promise<NormalizedCutout> {
  // Solo el canal alfa, en crudo: leer los cuatro canales de una foto de
  // varios megapixeles para luego Tirar tres de cada cuatro seria tirar.
  const { data: alpha, info } = await sharp(input)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = subjectBounds(alpha, info.width, info.height);
  // Sin sujeto no hay nada que recortar: se normaliza el recorte tal cual.
  // En el pipeline real esto no llega a ocurrir porque main() ya trata la
  // mascara vacia como fallo de segmentacion (ver Ruling T7-J).
  const framed = bounds ? await sharp(input).extract(bounds).toBuffer() : input;

  const resized = sharp(framed).resize({ height: HEIGHT, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const { data, info: out } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: out.width, height: out.height };
}

/**
 * Aplana la imagen a una silueta: todo pixel suficientemente opaco pasa a negro
 * puro, el resto a transparente. Altura normalizada para que todas las siluetas
 * se vean del mismo tamano y la estatura no se lea por accidente del encuadre.
 *
 * Importante (Ruling A): esta funcion NO recorta el fondo de una foto. Solo
 * aplana la transparencia que la imagen YA trae. Una foto JPEG opaca al 100%
 * (como cualquier descarga cruda de Wikimedia) sale de aqui como un rectangulo
 * negro solido. El recorte real de la persona lo hace removeBackground(),
 * que debe ejecutarse ANTES de esta funcion en el pipeline.
 */
export async function toSilhouette(input: Buffer): Promise<Buffer> {
  const { data, width, height } = await normalizeCutout(input);

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const opaque = data[i + 3]! >= ALPHA_CUTOFF;
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = opaque ? 255 : 0;
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * El mismo recorte que toSilhouette(), pero en color: conserva el RGB
 * original y solo binariza el canal alfa (mismo ALPHA_CUTOFF, mismo
 * normalizeCutout() que toSilhouette). Es la foto que sustituye a la
 * silueta en el reveal -- "sustituye" en el sentido literal de encajar en
 * el mismo hueco, por eso el alfa tiene que ser el MISMO binario que el de
 * la silueta y no un alfa suavizado propio: dos mascaras distintas del
 * mismo sujeto dejarian un borde que "baila" al cruzar de una imagen a la
 * otra en vez de una sustitucion limpia.
 */
export async function toColorCutout(input: Buffer): Promise<Buffer> {
  const { data, width, height } = await normalizeCutout(input);

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i + 3] = data[i + 3]! >= ALPHA_CUTOFF ? 255 : 0;
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * Segmenta la persona de una foto usando un modelo de eliminacion de fondo que
 * corre localmente (@imgly/background-removal-node, ONNX, sin API externa).
 * Devuelve un PNG con canal alfa real: opaco donde hay persona, transparente
 * donde hay fondo. Esto es lo que convierte "foto de Wikimedia" en "algo que
 * toSilhouette pueda aplanar a negro sin producir un rectangulo solido".
 *
 * La primera vez que se invoca en un entorno, la libreria descarga los pesos
 * del modelo ONNX (varios MB) desde su CDN. Por eso no tiene test unitario en
 * esta suite (ver tools/__tests__/silhouette.test.ts) y solo se ejercita desde
 * main(), que es un script offline ejecutado a mano.
 */
export async function removeBackground(input: Buffer): Promise<Buffer> {
  const { removeBackground: removeBackgroundImg } = await import("@imgly/background-removal-node");
  // Commons incluye JPEG en escala de grises de un canal. La libreria añade
  // alfa a RGB de tres canales, pero deja intacta una imagen de un canal y
  // falla al codificarla. Normalizar aquí garantiza RGBA para todos los casos.
  const rgbaPng = await sharp(input).toColourspace("srgb").ensureAlpha().png().toBuffer();
  // Uint8Array plano (no Buffer) para que el tipo del ArrayBuffer subyacente
  // sea siempre ArrayBuffer y no ArrayBufferLike | SharedArrayBuffer, que es
  // lo que exige el tipo BlobPart.
  const blob = new Blob([new Uint8Array(rgbaPng)], { type: "image/png" });
  const outBlob = await removeBackgroundImg(blob, { model: "small", output: { format: "image/png" } });
  return Buffer.from(await outBlob.arrayBuffer());
}

interface Mask {
  width: number;
  height: number;
  /** Un byte de alpha por pixel, en orden fila por fila (igual que un raster). */
  data: Uint8Array;
}

/**
 * Se queda solo con el componente conexo (4-vecinos) mas grande de pixeles
 * "opacos" (alpha >= cutoff) de una mascara, y transparenta todo lo demas.
 *
 * Ruling D: el segmentador de removeBackground() a veces deja motas de fondo
 * sueltas (ruido) o incluye a una segunda persona del encuadre original. La
 * heuristica "el sujeto de la carta es el blob mas grande de la mascara"
 * arregla los dos problemas en una sola pasada deterministica: las motas y
 * las personas secundarias son, por definicion del encuadre de estas fotos
 * (sujeto principal en primer plano), mas pequenas que el sujeto.
 *
 * Implementado con flood fill iterativo (pila explicita, sin recursion) para
 * no depender de una libreria de vision por computador solo para esto.
 *
 * Devuelve tambien `size`, el numero de pixeles del blob conservado (0 si la
 * mascara de entrada no tenia ningun pixel opaco), para que quien llama pueda
 * decidir si el blob es lo bastante grande para ser una persona sin tener que
 * recontar la mascara de salida.
 */
export function keepLargestBlob(mask: Mask, cutoff: number = ALPHA_CUTOFF): Mask & { size: number } {
  const { width, height, data } = mask;
  const size = width * height;
  const labels = new Int32Array(size).fill(-1);
  const stack: number[] = [];

  let bestLabel = -1;
  let bestSize = 0;
  let nextLabel = 0;

  for (let start = 0; start < size; start++) {
    if (labels[start] !== -1 || data[start]! < cutoff) continue;

    const label = nextLabel++;
    let blobSize = 0;
    labels[start] = label;
    stack.push(start);

    while (stack.length > 0) {
      const idx = stack.pop()!;
      blobSize++;
      const x = idx % width;
      const y = (idx - x) / width;

      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && labels[n] === -1 && data[n]! >= cutoff) {
          labels[n] = label;
          stack.push(n);
        }
      }
    }

    if (blobSize > bestSize) {
      bestSize = blobSize;
      bestLabel = label;
    }
  }

  const out = new Uint8Array(size);
  if (bestLabel !== -1) {
    for (let i = 0; i < size; i++) {
      out[i] = labels[i] === bestLabel ? data[i]! : 0;
    }
  }
  return { width, height, data: out, size: bestSize };
}

interface SubjectResult {
  png: Buffer;
  /** Pixeles opacos que sobrevivieron en el componente conexo mas grande. */
  blobPixels: number;
  /** Ancho * alto de la imagen procesada, para expresar blobPixels como fraccion. */
  totalPixels: number;
}

/**
 * Aplica keepLargestBlob() al canal alfa de una imagen RGBA real (la salida
 * de removeBackground()). Es el punto de union entre la funcion pura testeable
 * y el pipeline real de sharp/PNG.
 *
 * Devuelve blobPixels/totalPixels junto con el PNG para que quien llama pueda
 * decidir si el sujeto detectado es lo bastante grande para ser una persona
 * (ver MIN_SUBJECT_FRACTION en main()) sin tener que recorrer la imagen otra
 * vez -- keepLargestBlob ya cuenta el blob por dentro.
 */
export async function keepLargestSubject(input: Buffer): Promise<SubjectResult> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const alpha = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) alpha[p] = data[i + 3]!;

  const cleaned = keepLargestBlob({ width, height, data: alpha });

  const out = Buffer.from(data);
  for (let i = 0, p = 0; i < out.length; i += 4, p++) out[i + 3] = cleaned.data[p]!;

  const png = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { png, blobPixels: cleaned.size, totalPixels: width * height };
}

/**
 * Silueta generica de reserva (Ruling C): una figura neutra de futbolista de
 * pie, dibujada como SVG y rasterizada a PNG negro-sobre-transparente. Se usa
 * para cualquier silhouetteId que no tenga foto libre disponible en
 * data/sources.json o cuya descarga/segmentacion falle, para que el juego
 * nunca muestre una <img> rota mientras se completa la investigacion de
 * fuentes.
 */
export async function genericSilhouette(): Promise<Buffer> {
  const width = 220;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 220 512">
    <circle cx="110" cy="72" r="52" fill="#000"/>
    <rect x="94" y="112" width="32" height="24" fill="#000"/>
    <path d="M58 132 Q110 156 162 132 L188 268 Q110 306 32 268 Z" fill="#000"/>
    <path d="M32 148 L4 278 L32 292 L54 172 Z" fill="#000"/>
    <path d="M188 148 L216 278 L188 292 L166 172 Z" fill="#000"/>
    <path d="M68 276 L52 500 L96 500 L102 288 Z" fill="#000"/>
    <path d="M152 276 L168 500 L124 500 L118 288 Z" fill="#000"/>
    <circle cx="150" cy="498" r="14" fill="#000"/>
  </svg>`;
  return sharp(Buffer.from(svg)).resize({ height: HEIGHT }).png().toBuffer();
}

async function loadRequiredIds(): Promise<string[]> {
  const players: PlayerCard[] = JSON.parse(await readFile("data/players.json", "utf8"));
  const ids = new Set(players.map((p) => p.silhouetteId));
  return [...ids].sort();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff creciente entre reintentos: 2s, 5s, 15s (tres reintentos tras el intento inicial). */
const RETRY_DELAYS_MS = [2000, 5000, 15000];

/** Evita que una inferencia ONNX defectuosa bloquee todo un lote de cartas. */
const SEGMENTATION_TIMEOUT_MS = 45_000;

/** Pausa entre descargas sucesivas para no disparar el rate limit de Wikimedia. */
const DOWNLOAD_DELAY_MS = 1000;

/**
 * fetch con reintento y backoff creciente ante HTTP 429 y 5xx. 45 descargas
 * seguidas contra Wikimedia sin ninguna pausa dispara el limitador de tasa a
 * mitad de la lista: se comprobo en la practica dos veces -- la corrida que
 * dejo 26/45 cayendo a la silueta generica lo hizo en silencio porque el
 * fallo no se distinguia de "no habia fuente" en el resumen ni se logueaba
 * el codigo HTTP. Ahora cada intento (exito o fallo) se loguea con su codigo,
 * y solo 429/5xx son reintentables -- un 404 no lo es, reintentar no lo
 * arregla.
 */
async function fetchWithRetry(url: string, label: string): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    response = await fetch(url, {
      headers: { "User-Agent": "fut-subasta/0.1 (proyecto personal)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response;

    const retryable = response.status === 429 || response.status >= 500;
    const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
    console.error(
      `  [${label}] intento ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}: HTTP ${response.status}${
        retryable && !isLastAttempt ? " (reintentable)" : ""
      }`,
    );
    if (!retryable || isLastAttempt) return response;

    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, RETRY_DELAYS_MS[attempt]!));
  }
  return response!;
}

async function removeBackgroundWithTimeout(input: Buffer): Promise<Buffer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      removeBackground(input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`segmentacion ONNX supero ${SEGMENTATION_TIMEOUT_MS} ms`)), SEGMENTATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Uso: `tsx tools/build-silhouettes.ts [silhouetteId ...]`
 *
 * Sin argumentos, procesa los 45 silhouetteId del dataset (corrida completa).
 * Con argumentos, regenera solo esos ids -- util cuando se cambia la fuente
 * de un puñado de jugadores tras un triaje visual y no hace falta volver a
 * descargar y segmentar los otros 40+ que ya estaban bien.
 */
async function main(): Promise<void> {
  const sources: Source[] = JSON.parse(await readFile("data/sources.json", "utf8"));
  const sourceById = new Map(sources.map((s) => [s.silhouetteId, s]));
  const allIds = await loadRequiredIds();

  const requestedIds = process.argv.slice(2);
  for (const id of requestedIds) {
    if (!allIds.includes(id)) {
      console.error(`silhouetteId desconocido (no esta en data/players.json): ${id}`);
      process.exitCode = 1;
      return;
    }
  }
  const targetIds = requestedIds.length > 0 ? requestedIds : allIds;

  await mkdir("data/silhouettes", { recursive: true });
  // Recorte en color, mismo id, mismo encuadre que data/silhouettes -- ver
  // toColorCutout(). Solo se escribe cuando hay foto real (Ruling C: la
  // silueta generica de reserva no tiene version en color, el reveal de un
  // jugador sin foto sigue mostrando la silueta).
  await mkdir("data/photos", { recursive: true });

  // Carga las atribuciones ya existentes para poder regenerar un subconjunto
  // sin perder el credito de las fotos que no se tocan en esta corrida.
  let attributions: Attribution[] = [];
  try {
    attributions = JSON.parse(await readFile("data/attributions.json", "utf8"));
  } catch {
    attributions = [];
  }
  attributions = attributions.filter((a) => !targetIds.includes(a.silhouetteId));

  /** silhouetteId que terminaron con la silueta generica, no con foto real, en ESTA corrida. */
  const noPhoto: string[] = [];
  /** Motivo de cada generica: "sin fuente" (no hay entrada en sources.json) o el error real. */
  const noPhotoReason = new Map<string, string>();

  for (const silhouetteId of targetIds) {
    const source = sourceById.get(silhouetteId);
    let png: Buffer | undefined;
    /** Recorte en color de esta corrida, solo si `png` viene de foto real (no de la generica). */
    let colorPng: Buffer | undefined;

    if (source) {
      try {
        const response = await fetchWithRetry(source.url, silhouetteId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} en ${source.url}`);
        }
        const raw = Buffer.from(await response.arrayBuffer());
        const segmented = await removeBackgroundWithTimeout(raw);
        // Ruling D: descarta manchas de ruido y personas secundarias antes
        // de aplanar a negro, quedandose solo con el blob mas grande.
        const cleaned = await keepLargestSubject(segmented);
        // Ruling T7-J: una mascara vacia o casi vacia (removeBackground no
        // encontro a nadie -- encuadre atipico, sombras fuertes, compresion
        // agresiva) no lanza por si sola: keepLargestBlob simplemente deja
        // bestLabel en -1 y produce una mascara toda transparente, que
        // toSilhouette convertiria en un PNG valido pero invisible,
        // acreditado como si fuese foto real. Se trata expresamente como
        // fallo de segmentacion para caer al catch y terminar en
        // genericSilhouette(), igual que un fallo de red.
        const blobFraction = cleaned.blobPixels / cleaned.totalPixels;
        if (blobFraction < MIN_SUBJECT_FRACTION) {
          throw new Error(
            `el segmentador no encontro a nadie: blob de ${cleaned.blobPixels} px ` +
              `(${(blobFraction * 100).toFixed(2)}% de la imagen), por debajo del umbral del ${MIN_SUBJECT_FRACTION * 100}%`,
          );
        }
        png = await toSilhouette(cleaned.png);
        // Mismo `cleaned.png` de entrada que toSilhouette() -- por eso
        // encajan pixel a pixel (ver normalizeCutout).
        colorPng = await toColorCutout(cleaned.png);
        const { url: _url, ...credit } = source;
        attributions.push(credit);
        console.log(`ok    ${silhouetteId} (foto)`);
      } catch (err) {
        // Ruling B: registra el fallo y sigue con las demas, nunca aborta.
        const message = (err as Error).message;
        console.error(`fallo ${silhouetteId}: ${message}`);
        noPhotoReason.set(silhouetteId, message);
      }
      // Pausa entre descargas para no disparar el rate limit de Wikimedia
      // (429) al bajar 45 fotos seguidas.
      await sleep(DOWNLOAD_DELAY_MS);
    } else {
      noPhotoReason.set(silhouetteId, "sin fuente en data/sources.json");
    }

    if (!png) {
      // Ruling C: nunca dejar un silhouetteId sin PNG.
      png = await genericSilhouette();
      noPhoto.push(silhouetteId);
      console.log(`generico ${silhouetteId} (${noPhotoReason.get(silhouetteId)})`);
    }

    await writeFile(`data/silhouettes/${silhouetteId}.png`, png);

    if (colorPng) {
      await writeFile(`data/photos/${silhouetteId}.png`, colorPng);
    } else if (targetIds.includes(silhouetteId)) {
      // Este id se reproceso en ESTA corrida y no produjo foto real (cayo a
      // la generica): si una corrida anterior habia dejado aqui una foto en
      // color, se borra -- una foto huerfana que ya no coincide con la
      // silueta actual (que ahora es la generica, de tamano distinto) es
      // peor que no tener ninguna, porque el cliente la serviria igual.
      await rm(`data/photos/${silhouetteId}.png`, { force: true });
    }
  }

  attributions.sort((a, b) => a.silhouetteId.localeCompare(b.silhouetteId));
  await writeFile("data/attributions.json", `${JSON.stringify(attributions, null, 2)}\n`);

  // El resumen es sobre el conjunto COMPLETO de 45, no solo lo procesado en
  // esta corrida -- relevante para una regeneracion parcial, donde la mayoria
  // de silhouetteId no se tocaron pero siguen contando para el recuento final.
  const attributedIds = new Set(attributions.map((a) => a.silhouetteId));
  const noPhotoAll = allIds.filter((id) => !attributedIds.has(id));
  const fromPhoto = allIds.length - noPhotoAll.length;

  console.log("");
  console.log(`${fromPhoto}/${allIds.length} siluetas de foto real (conjunto completo).`);
  console.log(`${noPhotoAll.length}/${allIds.length} siluetas genericas (conjunto completo).`);

  if (noPhotoAll.length > 0) {
    console.log("Pendientes de foto real, con motivo (solo se conoce el motivo de las procesadas en ESTA corrida):");
    for (const id of noPhotoAll) {
      const reason = noPhotoReason.get(id) ?? "no procesado en esta corrida (ver corrida anterior)";
      console.log(`  - ${id}: ${reason}`);
    }
    // Ruling B: salir con codigo distinto de 0 si falta alguna, para que se note.
    process.exitCode = 1;
  }
}

// Comparacion cross-platform: en Windows import.meta.url viene como
// "file:///C:/..." (con barras / y un / extra) mientras que process.argv[1]
// es una ruta nativa con barras \, asi que la comparacion literal del brief
// nunca es igual y main() no llegaba a ejecutarse. fileURLToPath normaliza
// ambos lados al formato nativo del SO antes de comparar.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * AUDITORIA DE GEOMETRIA DE LAS SILUETAS.
 *
 * Hasta ahora nada en el repositorio miraba la forma de los PNG generados:
 * tools/__tests__/silhouette.test.ts prueba las FUNCIONES (toSilhouette,
 * keepLargestBlob, genericSilhouette) con entradas sinteticas, y
 * scripts/check-dataset.ts solo valida que las atribuciones esten completas.
 * UnPNG con el margen equivocado o con la foto de otro jugador pasaba
 * desapercibido por completo.
 *
 * Eso importa porque el cliente no los muestra a tamano natural.
 * packages/client/src/components/AuctionCard.tsx monta la imagen con
 * `h-[112%] w-auto object-contain object-bottom` anclada a `-top-6
 * right-[6%]`, o sea: la escala al 112% de la altura de la carta y la ancla
 * abajo para que la figura "rompa" el borde superior. El diseno da por hecho
 * que el sujeto LLENA el PNG. Si el recorte tiene margen transparente, ese
 * margen tambien se escala y el jugador ve una figura pequena flotando en una
 * esquina en vez de un busto a tamano de carta.
 *
 * Por eso `subjectHeight` es la metrica principal y no el tamano del archivo.
 *
 * Uso:
 *   tsx scripts/audit-silhouettes.ts          informe: imprime todo, sale 0
 *   tsx scripts/audit-silhouettes.ts --strict sale 1 si hay problemas (puerta de CI)
 */

/** Umbral de opacidad para considerar un pixel "parte del sujeto". Debe coincidir con ALPHA_CUTOFF de tools/build-silhouettes.ts. */
const ALPHA_CUTOFF = 128;

/**
 * Limites calibrados contra el estado real de data/silhouettes, no puestos al
 * azar. Los valores de referencia salen de las tarjetas que ya estaban bien
 * (dida-2005, bobby-moore-1966, maldini-2003: fill entre 0.55 y 0.70, aspect
 * entre 0.35 y 0.55) y de las que fallaron:
 *
 *   seedorf-2003  fill 0.034 -> no es un cuerpo, el segmentador se quedo con
 *                 una porteria. matthaus-1990 fill 0.12 -> un poste.
 *   scirea-1982   aspect 1.22 -> foto de grupo (tres jugadores en el titulo).
 *   passarella-1978 aspect 1.05 -> una cuña, no una persona.
 *   breitner-1974 aspect 2.17 -> las gradas del 74.
 *
 * El lado alto de `fill` esta para cazar masas solidas: una persona real
 * ocupa entre el 30% y el 70% de su propia caja envolvente porque tiene huecos
 * entre los brazos y entre las piernas. Un 95% es un rectangulo.
 */
export const LIMITS = {
  /** Sujeto mas bajo que esto deja de "romper" el borde superior de la carta. */
  minSubjectHeight: 0.9,
  /** Debajo, la mascara no describe un cuerpo (porteria, poste, reja, ruido). */
  minFill: 0.25,
  /** Encima, la masa es solida y no una figura. */
  maxFill: 0.85,
  /** Un jugador de pie no es mas ancho que alto; pasando esto hay grupo. */
  maxAspect: 0.95,
  /**
   * A alto 512, un aspect de 0.95 ya da 486 px de ancho. Por encima, la figura
   * invade una carta que es de 3/4 y el overflow-hidden del figure se come los
   * lados. No se recorta para "arreglarlo": una foto de grupo no se arregla
   * recortando, se re-curando.
   */
  maxWidth: 512,
} as const;

export interface Measures {
  width: number;
  height: number;
  /** Pixels opacos del PNG completo. */
  opaque: number;
  /** Fraccion del PNG completo que ocupa el sujeto. */
  occupancy: number;
  /** Opaque dividido por el area de la caja envolvente. */
  fill: number;
  /** Alto del sujeto como fraccion del alto del PNG: la metrica que ve el jugador. */
  subjectHeight: number;
  /** Ancho del sujeto como fraccion del ancho del PNG. */
  subjectWidth: number;
  /** Caja del sujeto (inclinado, no normalizado). */
  aspect: number;
}

/**
 * Lee un PNG RGBA y mide la caja envolvente de los pixeles opacos.
 *
 * Devuelve null si el PNG esta completamente vacio, en vez de tirar: un
 * silhouetteId sin sujeto es un estado que la auditoria tiene que poder
 * REPORTAR, no una excepcion que la pare.
 */
export async function measureSilhouette(input: Buffer): Promise<Measures | null> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width === 0 || height === 0) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + channels - 1]!;
      if (alpha < ALPHA_CUTOFF) continue;
      opaque++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  return {
    width,
    height,
    opaque,
    occupancy: opaque / (width * height),
    fill: opaque / (boxW * boxH),
    subjectHeight: boxH / height,
    subjectWidth: boxW / width,
    aspect: boxW / boxH,
  };
}

export interface Problem {
  id: string;
  reason: string;
}

interface Source {
  silhouetteId: string;
  url: string;
}

/** Los ids que el dataset necesita, en orden y sin repetir. */
function requiredIds(): string[] {
  const cards: Array<{ silhouetteId: string }> = JSON.parse(readFileSync("data/players.json", "utf8"));
  return [...new Set(cards.map((c) => c.silhouetteId))].sort();
}

export interface AuditResult {
  measured: number;
  problems: Problem[];
  /** Fila por id, para la tabla del informe. */
  rows: Array<{ id: string } & Measures>;
}

/**
 * Mide todas las siluetas del dataset y devuelve problemas y filas.
 *
 * Separado del CLI para poder testearlo sin tocar el disco con fixtures: los
 * tests construyen PNG sinteticos y comprueban que cada clase de fallo sale
 * con el motivo correcto.
 */
export async function auditSilhouettes(ids: string[] = requiredIds()): Promise<AuditResult> {
  const problems: Problem[] = [];
  const rows: Array<{ id: string } & Measures> = [];
  const byHash = new Map<string, string[]>();
  let measured = 0;

  for (const id of ids) {
    const silhouettePath = `data/silhouettes/${id}.png`;
    if (!existsSync(silhouettePath)) {
      problems.push({ id, reason: "no existe el PNG de la silueta" });
      continue;
    }

    const png = readFileSync(silhouettePath);
    const m = await measureSilhouette(png);
    if (!m) {
      problems.push({ id, reason: "silueta completamente vacia: no hay sujeto" });
      continue;
    }
    measured++;
    rows.push({ id, ...m });

    const digest = createHash("sha256").update(png).digest("hex");
    byHash.set(digest, [...(byHash.get(digest) ?? []), id]);

    if (m.subjectHeight < LIMITS.minSubjectHeight) {
      problems.push({
        id,
        reason: `el sujeto solo ocupa el ${(m.subjectHeight * 100).toFixed(0)}% del alto ` +
          `(${LIMITS.minSubjectHeight * 100}% minimo): con el h-[112%] del CSS se ve pequeno en la esquina`,
      });
    }
    if (m.fill < LIMITS.minFill) {
      problems.push({
        id,
        reason: `fill ${m.fill.toFixed(2)} (minimo ${LIMITS.minFill}): la mascara no describe un cuerpo, ` +
          `quedo algo que no es el jugador (porteria, poste, reja o manchas)`,
      });
    }
    if (m.fill > LIMITS.maxFill) {
      problems.push({ id, reason: `fill ${m.fill.toFixed(2)} (maximo ${LIMITS.maxFill}): masa solida, no una figura` });
    }
    if (m.aspect > LIMITS.maxAspect) {
      problems.push({
        id,
        reason: `aspect ${m.aspect.toFixed(2)} (maximo ${LIMITS.maxAspect}): mas ancho que alto, ` +
          `tipicamente foto de grupo o de gradas`,
      });
    }
    if (m.width > LIMITS.maxWidth) {
      problems.push({
        id,
        reason: `${m.width}px de ancho (maximo ${LIMITS.maxWidth}): desborda la carta y el figure recorta los lados`,
      });
    }

    // La foto tiene que existir solo si la silueta NO es la generica de reserva,
    // y cuando existe tiene que medir EXACTAMENTE lo mismo. Es lo que sostiene
    // el cruce del reveal: si el alfa de la foto se suaviza distinto al de la
    // silueta, el borde "baila" al cambiar de una a otra en vez de sustituirse
    // limpio (ver toColorCutout en tools/build-silhouettes.ts).
    const photoPath = `data/photos/${id}.png`;
    const hasPhoto = existsSync(photoPath);
    if (hasPhoto) {
      const photo = await measureSilhouette(readFileSync(photoPath));
      if (!photo) {
        problems.push({ id, reason: "la foto en color esta completamente vacia" });
      } else if (photo.width !== m.width || photo.height !== m.height) {
        problems.push({
          id,
          reason: `la foto mide ${photo.width}x${photo.height} y la silueta ${m.width}x${m.height}: ` +
            `el reveal cruzaria una imagen desalineada`,
        });
      }
    }
  }

  // Dos ids con el mismo PNG byte a byte es siempre un error: cada jugador
  // tiene su recorte. Se agrupa por hash para reportar el grupo entero, que es
  // mas util que dos veces la misma queja.
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    for (const id of group) {
      problems.push({
        id,
        reason: `PNG identico byte a byte a ${group.filter((o) => o !== id).join(", ")}: dos jugadores con la misma foto`,
      });
    }
  }

  /**
   * Misma comprobacion pero sobre data/sources.json, que es donde se equivocó
   * la curation: desailly-1998 y lizarazu-2001 apuntaban las dos al mismo
   * archivo de Wikimedia (una foto de la seleccion francesa). Es la causa
   * raiz, y por eso se revisa la fuente y no solo el PNG resultante.
   */
  const sources: Source[] = JSON.parse(readFileSync("data/sources.json", "utf8"));
  const byUrl = new Map<string, string[]>();
  for (const s of sources) {
    byUrl.set(s.url, [...(byUrl.get(s.url) ?? []), s.silhouetteId]);
  }
  for (const [url, group] of byUrl) {
    if (group.length < 2) continue;
    for (const id of group) {
      problems.push({
        id,
        reason: `data/sources.json le asigna la misma URL que ${group.filter((o) => o !== id).join(", ")}: ${url}`,
      });
    }
  }

  rows.sort((a, b) => a.subjectHeight - b.subjectHeight);
  problems.sort((a, b) => a.id.localeCompare(b.id));
  return { measured, problems, rows };
}

function formatTable(rows: Array<{ id: string } & Measures>): string {
  const cell = (s: string | number, n: number): string => String(s).padEnd(n);
  const lines = [
    cell("id", 22) + cell("dim", 11) + cell("ocupa", 8) + cell("fill", 8) +
      cell("alto", 8) + cell("ancho", 8) + cell("aspect", 8),
  ];
  for (const r of rows) {
    const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
    lines.push(
      cell(r.id, 22) +
        cell(`${r.width}x${r.height}`, 11) +
        cell(pct(r.occupancy), 8) +
        cell(r.fill.toFixed(2), 8) +
        cell(pct(r.subjectHeight), 8) +
        cell(pct(r.subjectWidth), 8) +
        cell(r.aspect.toFixed(2), 8),
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict");
  const ids = requiredIds();
  const { measured, problems, rows } = await auditSilhouettes(ids);

  console.log(`${ids.length} silhouetteId en el dataset, ${measured} medidos.`);
  console.log(`\n${formatTable(rows)}\n`);

  if (problems.length === 0) {
    console.log("Sin problemas: todas las siluetas llenan su cuadro y ninguna esta repetida.");
    return;
  }

  console.error(`${problems.length} problemas:\n`);
  for (const p of problems) console.error(`  ${p.id}: ${p.reason}`);

  if (!strict) {
    console.log(`\n(informe: ${problems.length} problemas. Con --strict esto sale con codigo 1.)`);
    return;
  }
  process.exitCode = 1;
}

if (process.argv[1]?.endsWith("audit-silhouettes.ts")) {
  await main();
}

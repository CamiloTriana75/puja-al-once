import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { genericSilhouette, toColorCutout, toSilhouette } from "../tools/build-silhouettes.js";
import { measureSilhouette } from "./audit-silhouettes.js";

/**
 * RE-NORMALIZA LAS SILUETAS YA GENERADAS SIN VOLVER A DESCARGAR NADA.
 *
 * Para que sirve: `tools/build-silhouettes.ts` antes normalizaba a alto 512
 * sin recortar el margen transparente, y el CSS de la carta (AuctionCard.tsx,
 * `h-[112%] object-bottom`) asume que el sujeto llena el PNG. Corregido el
 * pipeline, lo normal seria re-correr `pnpm silhouettes:build`, que vuelve a
 * descargar 138 archivos de Wikimedia y a pasar el segmentador ONNX por cada
 * uno: lento, dependiente de la red, y con un riesgo real de que una descarga
 * fallada sustituya una carta buena por la silueta generica de reserva sin
 * que se note en el diff (mismo silhouetteId, otro contenido).
 *
 * Por que esto da el MISMO resultado y no uno aproximado:
 *
 *  - toSilhouette()/toColorCutout() terminan en un binariado de alfa con
 *    ALPHA_CUTOFF=128. Los archivos que ya produjo el pipeline tienen el alfa
 *    en 0 o 255, y ese binariado es idempotente: 255 -> 255, 0 -> 0.
 *  - El recorte es crop a la caja del sujeto + resize a alto 512, las dos
 *    operaciones de normalizeCutout(). La caja depende SOLO del alfa, y la
 *    silueta y la foto de un mismo jugador comparten alfa byte a byte porque
 *    salieron del mismo `cleaned.png`.
 *
 * O sea: re-normalizar es aplicar las funciones ya corregidas a los archivos
 * que ya estan aplanados. Aqui no hay una segunda implementacion del recorte
 * que pueda divergir: se importan las del pipeline.
 *
 * Cuando se cambie las reglas de normalizacion (por ejemplo, si algun dia se
 * decide anadir relleno alrededor del sujeto) se vuelve a correr este script
 * en lugar de re-descargar el mazo entero.
 *
 * Uso: tsx scripts/normalize-silhouettes.ts
 */

/** Filtro de los identificadores con una silueta en disco. */
function presentIds(): string[] {
  return readdirSync("data/silhouettes")
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.replace(/\.png$/, ""))
    .sort();
}

interface Change {
  id: string;
  widthFrom: number;
  widthTo: number;
  /** Filas de 512 que ocupa el sujeto, antes y despues del recorte. */
  heightFrom: number;
  heightTo: number;
  photo: boolean;
}

async function main(): Promise<void> {
  const ids = presentIds();
  const genericHash = createHash("sha256").update(await genericSilhouette()).digest("hex");

  const changes: Change[] = [];
  let skippedGeneric = 0;
  let unchanged = 0;
  let missingPhoto = 0;

  for (const id of ids) {
    const silhouettePath = `data/silhouettes/${id}.png`;
    const current = readFileSync(silhouettePath);

    // La silueta generica de reserva NO pasa por normalizeCutout() -- la dibuja
    // genericSilhouette() como SVG. Si se re-normalizara, su encuadre se
    // separaria de lo que el pipeline escribe para una carta sin foto. Se
    // reconoce por hash, no por tamano: 220x512 es un aspect de 0.43, que es
    // el de un jugador de pie de verdad, asi que el tamano no lo identifica.
    if (createHash("sha256").update(current).digest("hex") === genericHash) {
      skippedGeneric++;
      continue;
    }

    const before = await measureSilhouette(current);
    const nextSilhouette = await toSilhouette(current);
    const after = await measureSilhouette(nextSilhouette);

    /**
     * La comparacion es de CONTENIDO, no de `WxH`. normalizeCutout() siempre
     * devuelve 512 de alto, asi que comparar geometria es comparar solo el
     * ancho -- y el ancho no cambia cuando el recorte conserva la relacion de
     * aspecto: maldini-2003 tenia 52 filas vacias arriba y 410 px de ancho, y
     * recortando a 369x460 y reescalando vuelve a dar 410 de ancho. Con la
     * guarda por geometria ese archivo no se escribia nunca y se quedaba sin
     * corregir por muy re-normalizado que se corriera el script.
     */
    if (createHash("sha256").update(nextSilhouette).digest("hex") === createHash("sha256").update(current).digest("hex")) {
      unchanged++;
      continue;
    }

    const photoPath = `data/photos/${id}.png`;
    const hasPhoto = existsSync(photoPath);
    if (!hasPhoto) missingPhoto++;

    changes.push({
      id,
      widthFrom: before?.width ?? 0,
      widthTo: after?.width ?? 0,
      heightFrom: before ? Math.round(before.subjectHeight * 512) : 0,
      heightTo: after ? Math.round(after.subjectHeight * 512) : 0,
      photo: hasPhoto,
    });
    writeFileSync(silhouettePath, nextSilhouette);
    if (hasPhoto) writeFileSync(photoPath, await toColorCutout(readFileSync(photoPath)));
  }

  console.log(`${ids.length} siluetas en disco.`);
  console.log(`  ${changes.length} re-normalizadas.`);
  console.log(`  ${unchanged} ya estaban ajustadas (sin cambios de bytes).`);
  console.log(`  ${skippedGeneric} son la generica de reserva y se dejan intactas.`);
  console.log(`  ${missingPhoto} de las re-normalizadas no tienen foto en color.`);

  if (changes.length > 0) {
    console.log("\nid                    ancho        filas ocupadas del sujeto");
    for (const c of changes) {
      console.log(
        `  ${c.id.padEnd(20)} ${`${c.widthFrom}->${c.widthTo}`.padEnd(12)} ` +
        `${`${c.heightFrom}->${c.heightTo} de 512`.padEnd(22)}${c.photo ? "" : " (sin foto)"}`,
      );
    }
  }
}

await main();

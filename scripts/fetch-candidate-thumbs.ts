/**
 * Descarga las miniaturas de los candidatos a disco.
 *
 * Sin esto, la hoja `candidatos.html` pide 146 imagenes a upload.wikimedia.org
 * de golpe al abrirla, y Wikimedia contesta 429 a unas cuantas. Ademas, quien
 * va a curar 21 cartas va a abrir y cerrar la hoja muchas veces: con las
 * miniaturas en local, eso no vuelve a golpear a Commons ni funciona sin red.
 *
 * Reusa lo ya descargado, asi que repetirlo solo pide lo que falta.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CANDIDATES = "contact-sheets/candidates.json";
const THUMB_DIR = "contact-sheets/thumbs";
const WIDTH = 420;
/** Commons no perdona rafagas: pausa siempre, y mas si contesta 429. */
const DELAY_MS = 700;
const ATTEMPTS = 6;
/** Sin User-Agent, Wikimedia margina la peticion (429/403) igual que a un bot. */
const UA = "FutboleraDatasetBot/1.0";
const HEADERS = { "User-Agent": UA };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Candidate {
  file: string;
}

export function thumbName(file: string): string {
  return `${createHash("sha1").update(file).digest("hex").slice(0, 16)}.jpg`;
}

export function thumbUrl(file: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    file,
  )}?width=${WIDTH}`;
}

/**
 * Respaldo para cuando upload.wikimedia.org margina ciertos ficheros con 429
 * continuo aun con pausas (pasa con unos pocos hash, sin logica clara).
 * thumb.php cuelga de commons.wikimedia.org, no de upload, y no ha fallado.
 */
function thumbPhpUrl(file: string): string {
  const bare = file.replace(/^File:/, "");
  return `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(
    bare,
  )}&w=${WIDTH}`;
}

async function download(url: string, attempts = ATTEMPTS): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: HEADERS });
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) return null;
        return Buffer.from(await res.arrayBuffer());
      }
      // 429 es "hasido demais rapido": esperar mas y reintentar, no fallar.
      // upload.wikimedia.org manda "Retry-After" en segundos, y pidiendo 385
      // miniaturas seguidas hay para dar y tomar. Sin respetarlo, los ultimos
      // ficheros agotan los intentos con 429 hasta con User-Agent.
      if (res.status === 429 || res.status >= 500) {
        const retry = Number(res.headers.get("retry-after") ?? 0);
        const wait = Math.max(retry, DELAY_MS * attempt * 3);
        await sleep(wait > 0 && isFinite(wait) ? wait : DELAY_MS * attempt * 3);
        continue;
      }
      return null;
    } catch {
      await sleep(DELAY_MS * attempt * 2);
    }
  }
  return null;
}

async function main(): Promise<void> {
  if (!existsSync(CANDIDATES)) {
    console.error(`No existe ${CANDIDATES}. Ejecuta antes: npx tsx scripts/candidate-sheet.ts`);
    process.exitCode = 1;
    return;
  }

  if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });

  const data = JSON.parse(readFileSync(CANDIDATES, "utf8")) as Record<
    string,
    Candidate[]
  >;
  const files = [...new Set(Object.values(data).flat().map((c) => c.file))];

  let ok = 0;
  let cached = 0;
  const failed: string[] = [];

  for (const [i, file] of files.entries()) {
    const target = resolve(THUMB_DIR, thumbName(file));
    if (existsSync(target)) {
      cached++;
      continue;
    }

    let bytes = await download(thumbUrl(file));
    if (!bytes) bytes = await download(thumbPhpUrl(file));
    if (bytes && bytes.length > 0) {
      writeFileSync(target, bytes);
      ok++;
    } else {
      failed.push(file);
    }

    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${files.length}...`);
    await sleep(DELAY_MS);
  }

  console.log(
    `${THUMB_DIR}/  ->  ${ok} descargadas, ${cached} ya estaban, ${failed.length} fallidas`,
  );
  for (const f of failed) console.log(`  fallo: ${f}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? "")) {
  await main();
}

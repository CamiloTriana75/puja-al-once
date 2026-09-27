/**
 * Fase 1+3 parcial de F2-F4: migra silhouetteId = cardId
 *
 * 1. Lee players.json y cambia silhouetteId a cardId para las 110 cartas
 * 2. Lee sources.json y reasigna las fotos existentes:
 *    - Cartas sin duplicado: renombra de "-01" a cardId
 *    - Pares duplicados: la foto existente va al cardId más cercano a la fecha de la foto,
 *      la otra carta queda sin fuente (necesita foto nueva de Commons)
 * 3. Actualiza attributions.json con los mismos renombramientos
 * 4. Renombra ficheros en data/silhouettes/ y data/photos/
 * 5. Genera un informe de las 36 cartas que necesitan foto nueva
 *
 * Uso: tsx scripts/migrate-silhouette-ids.ts [--dry-run]
 */
import { readFile, writeFile, rename, access } from "node:fs/promises";
import { join } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");

interface Player {
  cardId: string;
  name: string;
  season: number;
  silhouetteId: string;
  [key: string]: unknown;
}

interface Source {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
}

interface Attribution {
  silhouetteId: string;
  author: string;
  license: string;
  sourcePage: string;
}

/**
 * Intenta extraer el año de la URL o nombre de fichero de la foto de Commons.
 * Busca patrones como (1975), _2008, -2011, etc.
 */
function guessPhotoYear(url: string): number | null {
  const patterns = [
    /\((\d{4})\)/,
    /[_\-](\d{4})[_\-.\)]/,
    /(\d{4})\.(?:jpg|jpeg|png)/i,
    /(\d{8})_/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const year = pattern.source.startsWith("(\\d{8}")
        ? parseInt(match[1]!.slice(0, 4))
        : parseInt(match[1]!);
      if (year >= 1960 && year <= 2030) return year;
    }
  }
  return null;
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== EJECUTANDO MIGRACIÓN ===");
  console.log("");

  // 1. Leer datos
  const players: Player[] = JSON.parse(await readFile("data/players.json", "utf8"));
  const sources: Source[] = JSON.parse(await readFile("data/sources.json", "utf8"));
  const attributions: Attribution[] = JSON.parse(await readFile("data/attributions.json", "utf8"));

  const sourceById = new Map(sources.map(s => [s.silhouetteId, s]));
  const attrById = new Map(attributions.map(a => [a.silhouetteId, a]));

  // 2. Agrupar cartas por silhouetteId actual
  const groups = new Map<string, Player[]>();
  for (const p of players) {
    const list = groups.get(p.silhouetteId) ?? [];
    list.push(p);
    groups.set(p.silhouetteId, list);
  }

  // 3. Construir el mapa de renombramientos
  const renames: Array<{ oldId: string; newId: string; keepSource: boolean }> = [];
  const needsNewPhoto: Array<{ cardId: string; name: string; season: number }> = [];

  for (const [oldId, cards] of groups) {
    if (cards.length === 1) {
      renames.push({ oldId, newId: cards[0]!.cardId, keepSource: true });
    } else {
      const source = sourceById.get(oldId);
      let photoYear = source ? guessPhotoYear(source.url) : null;

      const sorted = [...cards].sort((a, b) => {
        if (photoYear === null) return 0;
        return Math.abs(a.season - photoYear) - Math.abs(b.season - photoYear);
      });

      const keeper = sorted[0]!;
      const needsNew = sorted.slice(1);

      console.log(`Par: ${oldId}`);
      console.log(`  Foto existente año ~${photoYear ?? "desconocido"}`);
      console.log(`  → ${keeper.cardId} (season ${keeper.season}) se queda la foto`);
      for (const card of needsNew) {
        console.log(`  → ${card.cardId} (season ${card.season}) necesita foto nueva`);
        needsNewPhoto.push({ cardId: card.cardId, name: card.name, season: card.season });
      }

      renames.push({ oldId, newId: keeper.cardId, keepSource: true });
      for (const card of needsNew) {
        renames.push({ oldId: "", newId: card.cardId, keepSource: false });
      }
    }
  }

  // 4. Actualizar players.json
  for (const p of players) {
    p.silhouetteId = p.cardId;
  }

  if (!DRY_RUN) {
    await writeFile("data/players.json", JSON.stringify(players, null, 2) + "\n");
    console.log("\n✅ players.json actualizado (silhouetteId = cardId para las 110 cartas)");
  } else {
    console.log("\n[dry-run] players.json se actualizaría");
  }

  // 5. Actualizar sources.json
  const newSources: Source[] = [];
  for (const r of renames) {
    if (!r.keepSource) continue;
    const old = sourceById.get(r.oldId);
    if (old) {
      newSources.push({ ...old, silhouetteId: r.newId });
    }
  }
  newSources.sort((a, b) => a.silhouetteId.localeCompare(b.silhouetteId));

  if (!DRY_RUN) {
    await writeFile("data/sources.json", JSON.stringify(newSources, null, 2) + "\n");
    console.log(`✅ sources.json actualizado (${newSources.length} entradas, antes ${sources.length})`);
  } else {
    console.log(`[dry-run] sources.json: ${newSources.length} entradas`);
  }

  // 6. Actualizar attributions.json
  const newAttrs: Attribution[] = [];
  for (const r of renames) {
    if (!r.keepSource) continue;
    const old = attrById.get(r.oldId);
    if (old) {
      newAttrs.push({ ...old, silhouetteId: r.newId });
    }
  }
  newAttrs.sort((a, b) => a.silhouetteId.localeCompare(b.silhouetteId));

  if (!DRY_RUN) {
    await writeFile("data/attributions.json", JSON.stringify(newAttrs, null, 2) + "\n");
    console.log(`✅ attributions.json actualizado (${newAttrs.length} entradas)`);
  } else {
    console.log(`[dry-run] attributions.json: ${newAttrs.length} entradas`);
  }

  // 7. Renombrar ficheros
  console.log("\nRenombrando ficheros...");
  for (const r of renames) {
    if (!r.keepSource || r.oldId === r.newId) continue;

    for (const dir of ["data/silhouettes", "data/photos"]) {
      const oldPath = join(dir, `${r.oldId}.png`);
      const newPath = join(dir, `${r.newId}.png`);
      if (await fileExists(oldPath)) {
        if (!DRY_RUN) {
          await rename(oldPath, newPath);
          console.log(`  ${oldPath} → ${newPath}`);
        } else {
          console.log(`  [dry-run] ${oldPath} → ${newPath}`);
        }
      }
    }
  }

  // 8. Informe de cartas que necesitan foto nueva
  console.log("\n" + "=".repeat(60));
  console.log(`CARTAS QUE NECESITAN FOTO NUEVA: ${needsNewPhoto.length}`);
  console.log("=".repeat(60));
  for (const card of needsNewPhoto.sort((a, b) => a.cardId.localeCompare(b.cardId))) {
    console.log(`  ${card.cardId.padEnd(25)} ${card.name} (${card.season})`);
  }

  // 9. Guardar la lista para la Fase 2
  if (!DRY_RUN) {
    await writeFile(
      "data/needs-photo.json",
      JSON.stringify(needsNewPhoto, null, 2) + "\n"
    );
    console.log(`\n✅ data/needs-photo.json generado con ${needsNewPhoto.length} cartas pendientes`);
  }

  console.log("\nSiguiente paso: ejecutar el script de búsqueda en Commons para las cartas pendientes.");
}

main().catch(console.error);

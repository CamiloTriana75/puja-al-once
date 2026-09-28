const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const a = JSON.parse(fs.readFileSync(path.join(root, "data/attributions.json"), "utf8"));

const by = {};
for (const x of a) (by[x.license] ??= []).push(x);
const lics = Object.keys(by).sort((p, q) => by[q].length - by[p].length);

const tick = (s) => `\`${s}\``;
let o = "";
o += "# Creditos y atribuciones\n\n";
o += "Las 110 cartas de `data/players.json` usan una fotografia real de cada jugador,\n";
o += "descargada de Wikimedia Commons. Las tablas de abajo son la atribucion que\n";
o += "exigen las licencias: sin este fichero el repositorio incumple los terminos de\n";
o += "las imagenes que contiene.\n\n";
o += "El listado legible se genera desde `data/attributions.json`, que es la fuente\n";
o += "de verdad y la que valida `pnpm dataset:check`. Si cambia una foto, actualiza el\n";
o += "JSON y regenera este fichero; no lo edites a mano:\n\n";
o += "```powershell\n";
o += "node tools/build-credits.cjs .\n";
o += "```\n\n";
o += "## Que se hace con cada imagen\n\n";
o += "De cada original se generan dos ficheros, ambos en `data/`:\n\n";
o += "- `photos/`: la fotografia original, reescalada por `sharp`.\n";
o += "- `silhouettes/`: la misma imagen con el fondo eliminado por\n";
o += "  `@imgly/background-removal-node` (ONNX, en local, sin API externa) y reescalada.\n\n";
o += "Las dos son obras derivadas del original, asi que las licencias Copyleft\n";
o += "(CC BY-SA) siguen obligando: quien reutilice estas imagenes debe mantener la\n";
o += "atribucion y compartir con la misma licencia. Por eso las imagenes y el codigo\n";
o += "no se mezclan bajo un unico LICENSE: `data/` tiene su propio regimen, este\n";
o += "fichero lo declara, y el LICENSE del repo aplica al codigo.\n\n";
o += "## Licencias\n\n";
o += "| Licencia | Imagenes |\n|---|---|\n";
for (const l of lics) o += `| ${l} | ${by[l].length} |\n`;
o += `| **Total** | **${a.length}** |\n\n`;
o += "`Public domain` y `CC0` no exigen atribucion, pero se listan igual para dejar\n";
o += "constancia de su procedencia.\n\n";
o += "## Detalle por imagen\n\n";
for (const l of lics) {
  o += `### ${l}\n\n`;
  o += "| Fichero | Autor | Fuente |\n|---|---|---|\n";
  for (const x of by[l].sort((p, q) => p.silhouetteId.localeCompare(q.silhouetteId))) {
    o += `| ${tick(x.silhouetteId)} | ${x.author} | [Commons](${x.sourcePage}) |\n`;
  }
  o += "\n";
}

fs.writeFileSync(path.join(root, "CREDITS.md"), o);
console.log(`CREDITS.md: ${a.length} imagenes, ${lics.length} licencias, ${o.length} bytes`);

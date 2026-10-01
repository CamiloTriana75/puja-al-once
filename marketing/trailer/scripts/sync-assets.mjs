// Copia al public/ del trailer los recursos de marca del juego, para que el
// video use siempre los mismos que la web (logo, retrato, silueta, mazo, fuentes).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const pub = resolve(here, "../public");

const files = {
  "img/logo-symbol.png": "packages/client/public/logo-symbol.png",
  "img/logo-wordmark.png": "packages/client/public/logo-wordmark.png",
  "img/hero-photo.png": "packages/client/src/assets/hero-photo.png",
  "img/hero-silhouette.png": "packages/client/src/assets/hero-silhouette.png",
  "audio/gavel.wav": "packages/client/src/assets/gavel.wav",
  "fonts/Unbounded.ttf": "tools/fonts/Unbounded[wght].ttf",
  "fonts/Jost.ttf": "tools/fonts/Jost[wght].ttf",
};

for (const [target, source] of Object.entries(files)) {
  const to = resolve(pub, target);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(resolve(repo, source), to);
  console.log(`public/${target}`);
}

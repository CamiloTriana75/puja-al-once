/**
 * Genera los iconos de la app instalable (PWA) y el favicon con la marca:
 * balon dorado sobre bosque. Uso: `node tools/build-pwa-icons.cjs`.
 *
 * - icons/icon-192.png, icons/icon-512.png: iconos normales (esquinas redondas).
 * - icons/icon-maskable-512.png: sin esquinas y con el balon dentro de la zona
 *   segura (80 %), para que Android lo recorte en circulo o gota sin cortarlo.
 * - apple-touch-icon.png (180): cuadrado sin transparencia; iOS pone las esquinas.
 * - favicon.png (32) y favicon.svg.
 *
 * El balon es la misma geometria que `BallMark` en src/components/Brand.tsx.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const PUBLIC = path.resolve(__dirname, "../packages/client/public");
const FOREST = "#0C241C";
const GOLD = "#F0B83D";

const BALL = `
  <circle cx="16" cy="16" r="14.5" fill="${GOLD}"/>
  <path d="M16 10.2 21.52 14.21 19.41 20.69H12.59L10.48 14.21Z" fill="${FOREST}"/>
  <path d="M16 10.2V3.4M21.52 14.21l6.6-2.14M19.41 20.69l4.08 5.62M12.59 20.69l-4.08 5.62M10.48 14.21l-6.6-2.14"
        stroke="${FOREST}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;

/** `ball` = ancho del balon en un lienzo de 512; `radius` = esquinas del fondo. */
function icon({ ball, radius }) {
  const scale = ball / 32;
  const offset = (512 - ball) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${FOREST}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${BALL}</g>
</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(`${path.relative(process.cwd(), file)} (${size}x${size})`);
}

(async () => {
  fs.mkdirSync(path.join(PUBLIC, "icons"), { recursive: true });
  const rounded = icon({ ball: 352, radius: 112 });
  const square = icon({ ball: 352, radius: 0 });
  const maskable = icon({ ball: 290, radius: 0 });

  await png(rounded, 192, path.join(PUBLIC, "icons/icon-192.png"));
  await png(rounded, 512, path.join(PUBLIC, "icons/icon-512.png"));
  await png(maskable, 512, path.join(PUBLIC, "icons/icon-maskable-512.png"));
  await png(square, 180, path.join(PUBLIC, "apple-touch-icon.png"));
  await png(icon({ ball: 400, radius: 96 }), 32, path.join(PUBLIC, "favicon.png"));

  fs.writeFileSync(
    path.join(PUBLIC, "favicon.svg"),
    `<!--\n  Balon dorado sobre bosque: misma geometria que BallMark (src/components/Brand.tsx).\n  Generado por tools/build-pwa-icons.cjs junto con los iconos de la app.\n-->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Puja el Once">\n  <rect width="32" height="32" rx="7" fill="${FOREST}"/>\n  <g transform="translate(3 3) scale(0.8125)">${BALL}</g>\n</svg>\n`,
  );
  console.log("packages/client/public/favicon.svg");
})();

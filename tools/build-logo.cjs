/**
 * Prepara el logo de marca a partir de la propuesta de la IA y lo reparte:
 *
 *   node tools/build-logo.cjs "Designer (1).png"
 *
 * Entrada: PNG con el simbolo (balon con mano y mazo) arriba y el rotulo
 * "PUJA EL ONCE" abajo, sobre fondo crema liso.
 * Salida (packages/client/public/):
 *   logo-symbol.png    simbolo recortado, circular, fondo transparente (512)
 *   logo-wordmark.png  rotulo recortado, fondo transparente
 *   icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png
 *   apple-touch-icon.png
 *
 * La imagen social (og-image.png) sale de tools/build-og-image.py, que usa estos recortes.
 * El favicon NO sale de aqui: a 32 px la mano se vuelve una mancha, asi que
 * sigue siendo el balon simple de tools/build-pwa-icons.cjs.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const PUBLIC = path.resolve(__dirname, "../packages/client/public");
const CANVAS = { r: 0xf5, g: 0xf4, b: 0xec, alpha: 1 };

/** Caja que contiene los pixeles que no son fondo, dentro de una franja vertical. */
function bounds(data, width, channels, y0, y1, bg, tolerance = 40) {
  let minX = width, maxX = -1, minY = y1, maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
      if (d > tolerance) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Fondo -> transparente por distancia de color (para texto plano sobre fondo liso). */
async function knockOut(buffer, bg) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    data[i + 3] = Math.max(0, Math.min(255, Math.round(((d - 12) / 90) * 255)));
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function onCanvas({ size, radius, content, scale }) {
  const inner = Math.round(size * scale);
  const symbol = await sharp(content).resize(inner, inner).toBuffer();
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#F5F4EC"/></svg>`,
  );
  return sharp(bg)
    .composite([{ input: symbol, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

(async () => {
  const source = process.argv[2];
  if (!source) throw new Error('Uso: node tools/build-logo.cjs "ruta/al/logo.png"');

  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bg = [data[0], data[1], data[2]];

  // El simbolo ocupa la mitad de arriba; el rotulo, la de abajo, a la derecha del pequeno.
  const half = Math.round(height * 0.62);
  const sym = bounds(data, width, channels, 0, half, bg);
  const lock = bounds(data, width, channels, half, height, bg);
  const side = Math.max(sym.width, sym.height);
  const symBox = {
    left: Math.round(sym.left + sym.width / 2 - side / 2),
    top: Math.round(sym.top + sym.height / 2 - side / 2),
    width: side,
    height: side,
  };

  // Simbolo: recorte cuadrado + mascara circular con borde suave.
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2 - 0.5}" fill="#fff"/></svg>`,
  );
  const cropped = await sharp(source).extract(symBox).png().toBuffer();
  const symbolPng = await sharp(cropped)
    .ensureAlpha()
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toBuffer()
    .then((masked) => sharp(masked).resize(512, 512).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(path.join(PUBLIC, "logo-symbol.png"), symbolPng);

  // Rotulo: se descarta el balon pequeno de la izquierda (el rotulo empieza tras el).
  const strip = await sharp(source)
    .extract({ left: lock.left, top: lock.top, width: lock.width, height: lock.height })
    .toBuffer();
  const stripRaw = await sharp(strip).raw().toBuffer({ resolveWithObject: true });
  // Primera columna de texto tras el balon: hueco de fondo mas ancho que 12 px.
  const cols = [];
  for (let x = 0; x < stripRaw.info.width; x++) {
    let ink = false;
    for (let y = 0; y < stripRaw.info.height && !ink; y++) {
      const i = (y * stripRaw.info.width + x) * stripRaw.info.channels;
      ink = Math.abs(stripRaw.data[i] - bg[0]) + Math.abs(stripRaw.data[i + 1] - bg[1]) + Math.abs(stripRaw.data[i + 2] - bg[2]) > 40;
    }
    cols.push(ink);
  }
  let gapStart = -1, cut = 0;
  for (let x = 0; x < cols.length; x++) {
    if (!cols[x]) {
      if (gapStart < 0) gapStart = x;
      if (x - gapStart >= 12) cut = x;
    } else if (cut > 0) break;
    else gapStart = -1;
  }
  const wordSrc = await sharp(strip)
    .extract({ left: cut, top: 0, width: stripRaw.info.width - cut, height: stripRaw.info.height })
    .toBuffer();
  const wordTight = bounds(
    (await sharp(wordSrc).raw().toBuffer({ resolveWithObject: true })).data,
    stripRaw.info.width - cut,
    stripRaw.info.channels,
    0,
    stripRaw.info.height,
    bg,
  );
  const wordmarkPng = await knockOut(
    await sharp(wordSrc).extract(wordTight).toBuffer(),
    bg,
  );
  fs.writeFileSync(path.join(PUBLIC, "logo-wordmark.png"), wordmarkPng);

  // Iconos de la app: simbolo sobre el lienzo crema de la marca.
  fs.mkdirSync(path.join(PUBLIC, "icons"), { recursive: true });
  const rounded = (size) => onCanvas({ size: 512, radius: 112, content: symbolPng, scale: 0.8 }).then((b) => sharp(b).resize(size, size).png().toBuffer());
  fs.writeFileSync(path.join(PUBLIC, "icons/icon-512.png"), await rounded(512));
  fs.writeFileSync(path.join(PUBLIC, "icons/icon-192.png"), await rounded(192));
  // Maskable: sin esquinas y con el simbolo dentro de la zona segura (80 % del lienzo -> 66 % del simbolo).
  fs.writeFileSync(
    path.join(PUBLIC, "icons/icon-maskable-512.png"),
    await onCanvas({ size: 512, radius: 0, content: symbolPng, scale: 0.66 }),
  );
  fs.writeFileSync(
    path.join(PUBLIC, "apple-touch-icon.png"),
    await sharp(await onCanvas({ size: 512, radius: 0, content: symbolPng, scale: 0.78 })).resize(180, 180).png().toBuffer(),
  );

  console.log({ symbol: sym, lockup: lock, wordmarkCut: cut, wordmark: wordTight });
})();

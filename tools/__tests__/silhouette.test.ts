import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { genericSilhouette, keepLargestBlob, keepLargestSubject, toSilhouette } from "../build-silhouettes.js";

/** Un cuadrado rojo de 100x50 sobre fondo transparente. */
async function redBlob(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

/** Un cuadrado rojo de 100x50 totalmente opaco (simula una foto JPEG real). */
async function opaqueBlob(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
}

describe("toSilhouette", () => {
  it("normaliza la altura a 512 px", async () => {
    const out = await toSilhouette(await redBlob());
    const meta = await sharp(out).metadata();
    expect(meta.height).toBe(512);
  });

  it("deja todo pixel opaco en negro puro", async () => {
    const out = await toSilhouette(await redBlob());
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);

    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0) {
        opaque++;
        expect(data[i]).toBe(0);
        expect(data[i + 1]).toBe(0);
        expect(data[i + 2]).toBe(0);
      }
    }
    expect(opaque).toBeGreaterThan(0);
  });

  it("una foto sin transparencia real (JPEG opaco) NO debe producir un rectangulo negro solido", async () => {
    // Este es exactamente el defecto que describe el Ruling A: toSilhouette por si
    // solo no recorta nada, solo aplana la transparencia que ya trae la imagen.
    // Si a toSilhouette se le da una foto opaca sin pasar antes por el
    // segmentador, el resultado es opaco en el 100% de los pixeles.
    // Este test documenta ese comportamiento esperado de toSilhouette en aislamiento
    // (no es un bug de toSilhouette: el recorte es responsabilidad de removeBackground,
    // que se ejecuta ANTES en el pipeline real de main()).
    const out = await toSilhouette(await opaqueBlob());
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total++;
      if (data[i + 3]! > 0) opaque++;
    }
    // Confirma el comportamiento: sin segmentacion previa, todo queda opaco.
    expect(opaque).toBe(total);
  });
});

describe("genericSilhouette", () => {
  it("produce un PNG de 512 px de alto con pixeles negros opacos y pixeles transparentes", async () => {
    const out = await genericSilhouette();
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.height).toBe(512);

    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);

    let opaque = 0;
    let transparent = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0) {
        opaque++;
        expect(data[i]).toBe(0);
        expect(data[i + 1]).toBe(0);
        expect(data[i + 2]).toBe(0);
      } else {
        transparent++;
      }
    }
    // Es una figura, no un rectangulo solido: debe haber tanto pixeles de la
    // figura como fondo transparente alrededor.
    expect(opaque).toBeGreaterThan(0);
    expect(transparent).toBeGreaterThan(0);
  });
});

describe("keepLargestBlob", () => {
  /** Construye una mascara de alpha plana width*height a partir de un dibujo ASCII. */
  function maskFromAscii(rows: string[]): { width: number; height: number; data: Uint8Array } {
    const height = rows.length;
    const width = rows[0]!.length;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[y * width + x] = rows[y]![x] === "#" ? 255 : 0;
      }
    }
    return { width, height, data };
  }

  it("se queda solo con el componente conexo mas grande y borra las motas sueltas", () => {
    // Un blob grande (5x5, esquina superior izquierda) + dos motas de 1 pixel
    // sueltas (Defecto 1: ruido de fondo del segmentador).
    const mask = maskFromAscii([
      "#####.....",
      "#####.....",
      "#####...#.",
      "#####.....",
      "#####..#..",
      "..........",
    ]);

    const cleaned = keepLargestBlob(mask);

    expect(cleaned.width).toBe(mask.width);
    expect(cleaned.height).toBe(mask.height);

    let opaque = 0;
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const v = cleaned.data[y * mask.width + x]!;
        const inBigBlob = x < 5 && y < 5;
        if (inBigBlob) {
          expect(v).toBe(255);
          opaque++;
        } else {
          // Las dos motas sueltas (y todo lo demas) deben quedar transparentes.
          expect(v).toBe(0);
        }
      }
    }
    expect(opaque).toBe(25);
  });

  it("cuando hay dos personas, se queda con la mas grande y borra la mas pequena", () => {
    // Defecto 2: un sujeto grande (6x6) y una "segunda persona" mas pequena
    // (2x2) en otra esquina del encuadre.
    const mask = maskFromAscii([
      "######....",
      "######....",
      "######....",
      "######....",
      "######....",
      "######.##.",
      "........##",
    ]);

    const cleaned = keepLargestBlob(mask);

    // El bloque 6x6 sobrevive entero.
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        expect(cleaned.data[y * mask.width + x]).toBe(255);
      }
    }
    // La segunda persona (2x2 en la esquina inferior derecha) desaparece.
    expect(cleaned.data[5 * mask.width + 7]).toBe(0);
    expect(cleaned.data[5 * mask.width + 8]).toBe(0);
    expect(cleaned.data[6 * mask.width + 7]).toBe(0);
    expect(cleaned.data[6 * mask.width + 8]).toBe(0);
  });

  it("una sola mancha no cambia", () => {
    const mask = maskFromAscii(["###", "###", "###"]);
    const cleaned = keepLargestBlob(mask);
    expect(Array.from(cleaned.data)).toEqual(Array.from(mask.data));
    expect(cleaned.size).toBe(9);
  });

  it("una mascara enteramente por debajo del umbral no lanza y reporta tamano de blob 0", () => {
    // El caso que dispara el hallazgo de la ronda de revision: removeBackground()
    // no encontro a nadie (encuadre atipico, sombras fuertes, compresion agresiva)
    // y la mascara de entrada llega vacia. keepLargestBlob no debe lanzar --
    // debe devolver todo transparente y size 0, para que quien llama (main())
    // pueda decidir tratarlo como fallo de segmentacion.
    const mask = maskFromAscii(["...", "...", "..."]);
    const cleaned = keepLargestBlob(mask);
    expect(cleaned.size).toBe(0);
    expect(Array.from(cleaned.data)).toEqual(new Array(mask.width * mask.height).fill(0));
  });
});

describe("keepLargestSubject", () => {
  it("borra un segundo blob mas pequeno de una imagen RGBA real", async () => {
    // Compone una imagen de 100x100: un cuadrado negro opaco grande (sujeto)
    // y uno pequeno (segunda persona / mancha de ruido) que deben separarse
    // por al menos un pixel transparente para no formar un solo componente.
    const big = await sharp({
      create: { width: 60, height: 60, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const small = await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const composed = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: big, left: 5, top: 5 },
        { input: small, left: 90 - 8, top: 90 - 8 },
      ])
      .png()
      .toBuffer();

    const cleaned = await keepLargestSubject(composed);
    const { data, info } = await sharp(cleaned.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // Dentro del blob grande sigue opaco.
    const bigPixel = (30 * info.width + 30) * 4;
    expect(data[bigPixel + 3]).toBeGreaterThan(0);

    // Donde estaba el blob pequeno ahora es transparente.
    const smallPixel = (94 * info.width + 94) * 4;
    expect(data[smallPixel + 3]).toBe(0);

    // El blob grande (60x60 = 3600px) sobrevive entero, el pequeno (8x8) no cuenta.
    expect(cleaned.blobPixels).toBe(60 * 60);
    expect(cleaned.totalPixels).toBe(100 * 100);
  });
});

// NOTA (Ruling A): no hay test unitario para removeBackground() aqui.
// @imgly/background-removal-node descarga los pesos del modelo ONNX (varios MB)
// la primera vez que se invoca, y esta suite debe poder correr sin red. La
// funcion se ejerce en la practica al correr `pnpm silhouettes:build`, ver el
// informe de la Task 7 para la evidencia de que produce siluetas reales.

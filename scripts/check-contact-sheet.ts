/**
 * Comprueba en un navegador de verdad que la hoja de contactos monta la misma
 * caja que monta AuctionCard. Un HTML puede estar bien escrito y aun asi
 * discretamente equivocado: esta comprobacion mide lo que el navegador
 * calcula, no lo que el codigo dice.
 *
 * No es un test del producto (eso vive en los e2e del cliente): es el control
 * de calidad del propio script de la hoja. Por eso vive en scripts/, no en
 * tests/, y por eso se ejecuta a mano.
 *
 *   npx tsx scripts/check-contact-sheet.ts
 */

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lo que se mide en la pagina, ya en pixeles de pantalla. */
interface CardInfo {
  id: string;
  figure: Box | null;
  cut: Box | null;
  panel: Box | null;
  wedge: Box | null;
  band: Box | null;
  naturalWidth: number;
  filter: string;
  objectPosition: string;
  loaded: boolean;
}

const SHEET = pathToFileURL(resolve("contact-sheets/index.html")).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const failures: string[] = [];
const check = (ok: boolean, what: string): void => {
  console.log(`  ${ok ? "ok  " : "FALLA"}  ${what}`);
  if (!ok) failures.push(what);
};

try {
  await page.goto(SHEET, { waitUntil: "networkidle" });

  // El codigo del navegador va como STRING, no como funcion. Si fuera una
  // funcion, esbuild le inyectaria su helper __name al compilar el TS y dentro
  // de page.evaluate no existe: revienta con "__name is not defined".
  const cards = await page.evaluate<CardInfo[]>(`(function () {
    const round = function (n) { return Math.round(n * 10) / 10; };
    const rect = function (el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) };
    };
    var out = [];
    var all = document.querySelectorAll('.card');
    for (var i = 0; i < all.length; i++) {
      var card = all[i];
      var cut = card.querySelector('.cut');
      var style = cut ? getComputedStyle(cut) : null;
      out.push({
        id: (card.parentElement.querySelector('.id') || {}).textContent || '?',
        figure: rect(card),
        cut: rect(cut),
        panel: rect(card.querySelector('.panel')),
        wedge: rect(card.querySelector('.wedge')),
        band: rect(card.querySelector('.band')),
        naturalWidth: cut ? cut.naturalWidth : 0,
        filter: style ? style.filter : '',
        objectPosition: style ? style.objectPosition : '',
        loaded: cut ? (cut.complete && cut.naturalWidth > 0) : false
      });
    }
    return out;
  })()`);

  console.log(`${cards.length} cartas medidas en el navegador\n`);

  // 3/4 exacto, que es lo que declara AuctionCard en movil.
  const first = cards[0];
  const ratio = first.figure ? first.figure.width / first.figure.height : 0;
  check(Math.abs(ratio - 0.75) < 0.02, `figure en 3/4 (medido ${ratio.toFixed(3)})`);

  // El cutout debe DESBORDAR por arriba (-top-6) y ser mas alto que la carta
  // (h-[112%]). Si no, la carta no tiene el cutout de retransmision.
  const withImg = cards.filter((c) => c.cut);
  check(withImg.length > 0, `hay cartas con cutout (${withImg.length})`);
  for (const c of withImg.slice(0, 6)) {
    const ratioH = c.cut && c.figure ? c.cut.height / c.figure.height : 0;
    check(
      c.cut && c.figure && c.cut.y < c.figure.y && Math.abs(ratioH - 1.12) < 0.03,
      `${c.id}: desborda arriba y mide ${Math.round(ratioH * 100)}% del alto (esperado 112%)`,
    );
  }

  // right-[6%]: el borde derecho del cutout esta a un 6% del borde derecho.
  for (const c of withImg.slice(0, 3)) {
    const inset = c.cut && c.figure ? c.figure.x + c.figure.width - (c.cut.x + c.cut.width) : 0;
    const pct = c.figure ? (inset / c.figure.width) * 100 : 0;
    check(
      Math.abs(pct - 6) < 1.2,
      `${c.id}: cutout a ${pct.toFixed(1)}% del borde derecho (esperado 6%)`,
    );
  }

  // El panel va arriba a la izquierda y debe tapar al jugador: si el cutout
  // quedara a la izquierda del panel, la maqueta estaria mal replicada.
  for (const c of withImg.slice(0, 3)) {
    check(
      c.panel && c.cut && c.panel.x + c.panel.width > c.cut.x,
      `${c.id}: el panel solapa al jugador`,
    );
  }

  // La banda inferior es el 25% del alto.
  check(
    first.band && first.figure && Math.abs(first.band.height / first.figure.height - 0.25) < 0.02,
    "banda inferior al 25% del alto",
  );

  // La cuña lima se sale por la derecha: right es negativo.
  check(
    first.wedge && first.figure && first.wedge.x + first.wedge.width > first.figure.x + first.figure.width,
    "la cuña lima sale por la derecha",
  );

  // En modo foto no debe quedar el filtro de mascara aplicado.
  const filtered = withImg.filter((c) => c.filter.includes("invert"));
  check(filtered.length === 0, `ninguna carta con el filtro de mascara (${filtered.length})`);

  // Todas las imagenes cargan de verdad desde data/.
  const broken = cards.filter((c) => c.cut && !c.loaded);
  check(broken.length === 0, `todas las imagenes cargan (rotas: ${broken.length})`);

  // Sin texto desbordado: el panel no puede salirse de la carta.
  const overflowing = withImg.filter(
    (c) => c.panel && c.figure && c.panel.y + c.panel.height > c.figure.y + c.figure.height,
  );
  check(overflowing.length === 0, `el panel no se sale de la carta (${overflowing.length} lo hacen)`);
} finally {
  await browser.close();
}

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} comprobaciones fallan.`);
  process.exitCode = 1;
} else {
  console.log("La hoja monta la misma caja que AuctionCard.");
}

import { existsSync, readFileSync } from "node:fs";
import {
  cardsBySlot, DEFAULT_RULES, MIN_CARDS_PER_SLOT, openingBidForRating, parseDataset, SLOTS,
} from "@fut/shared";

const cards = parseDataset(JSON.parse(readFileSync("data/players.json", "utf8")));
const grouped = cardsBySlot(cards);

const thin = SLOTS.filter((slot) => grouped[slot].length < MIN_CARDS_PER_SLOT);
console.log(`${cards.length} cartas cargadas.`);
for (const slot of SLOTS) console.log(`  ${slot.padEnd(4)} ${grouped[slot].length}`);

if (thin.length > 0) {
  console.warn(
    `\nHuecos por debajo de ${MIN_CARDS_PER_SLOT} cartas: ${thin.join(", ")}` +
      `\nEl juego funciona, pero las partidas repetiran candidatos.`,
  );
}

const unplayable = SLOTS.filter((slot) => grouped[slot].length < 5);
if (unplayable.length > 0) {
  console.error(`\nHuecos con menos de 5 cartas, no se puede jugar a 4: ${unplayable.join(", ")}`);
  process.exit(1);
}

/**
 * Atribuciones. Las fotos vienen de Wikimedia Commons bajo licencias que
 * obligan a citar autor, licencia y origen: sin esta entrada el repositorio
 * las publica sin cumplir sus terminos. Tambien se comprueba que cada
 * atribucion tenga una carta y cada carta una atribucion, para que CREDITS.md
 * (generado con tools/build-credits.cjs) no se quede desincronizado.
 */
interface Attribution {
  silhouetteId: string;
  author: string;
  license: string;
  sourcePage: string;
}

const attributions: Attribution[] = JSON.parse(readFileSync("data/attributions.json", "utf8"));
const bySilhouette = new Map(attributions.map((a) => [a.silhouetteId, a]));

const attributionProblems: string[] = [];
for (const card of cards) {
  // Una carta sin foto (sale con sus iniciales) no publica ninguna imagen ajena: no hay a quien citar.
  if (!existsSync(`data/photos/${card.silhouetteId}.png`)) continue;
  const entry = bySilhouette.get(card.silhouetteId);
  if (!entry) {
    attributionProblems.push(`Sin atribucion: ${card.silhouetteId} (${card.name} ${card.season})`);
    continue;
  }
  for (const field of ["author", "license", "sourcePage"] as const) {
    if (!entry[field]?.trim()) {
      attributionProblems.push(`Atribucion incompleta (${field} vacio): ${card.silhouetteId}`);
    }
  }
}

const orphans = attributions.filter((a) => !cards.some((card) => card.silhouetteId === a.silhouetteId));
for (const orphan of orphans) {
  attributionProblems.push(`Atribucion sin carta asociada: ${orphan.silhouetteId}`);
}

if (attributionProblems.length > 0) {
  console.error("");
  for (const problem of attributionProblems) console.error(`atribucion: ${problem}`);
  process.exit(1);
}
console.log(`\n${attributions.length} atribuciones, todas con autor, licencia y origen.`);


/**
 * Economia: lo que cuesta un oncenco, medido sobre el mazo entero.
 *
 * El presupuesto solo sirve si aprieta. Con las reglas de salida originales
 * (presupuesto 1.000 M, base 20 M) ganar los once huecos con las cartas mas
 * baratas costaba 220 M y un once "perfecto" 700 M: sobraban 300 M siempre y
 * acaparar dinero era estrategia ganadora. La curva actual es mas cara (30-200
 * M) justamente para tapar ese agujero, y este script es lo que lo vigila: mide
 * el once real y falla si se sale de la ventana calibrada en DEFAULT_RULES
 * (ver el comentario de esa constante).
 */
const { startingBudget, basePrice } = DEFAULT_RULES;
const priceOf = (rating: number): number => openingBidForRating(rating, DEFAULT_RULES);

const economy = SLOTS.map((slot) => {
  const prices = grouped[slot].map((card) => priceOf(card.rating));
  return {
    slot,
    cheapest: Math.min(...prices),
    mean: prices.reduce((a, b) => a + b, 0) / prices.length,
    dearest: Math.max(...prices),
    /** Cartas que salen al precio base: las que sostienen el presupuesto. */
    cheapCount: prices.filter((p) => p === basePrice).length,
  };
});

const total = (pick: (e: (typeof economy)[number]) => number): number =>
  Math.round(economy.reduce((sum, e) => sum + pick(e), 0));

const floor = total((e) => e.cheapest);
const mean = total((e) => e.mean);
const ceiling = total((e) => e.dearest);
const pct = (value: number): string => `${((value / startingBudget) * 100).toFixed(0)}%`;

console.log(`\nPresupuesto ${startingBudget} M. Un oncenco de 11 cartas cuesta:`);
console.log(`  suelo (la mas barata de cada ronda)  ${String(floor).padStart(4)} M  ${pct(floor)}`);
console.log(`  medio (una cualquiera de cada ronda)  ${String(mean).padStart(4)} M  ${pct(mean)}`);
console.log(`  techo (la mas cara de cada ronda)    ${String(ceiling).padStart(4)} M  ${pct(ceiling)}`);

const problems: string[] = [];

/**
 * `reservedBudget` promete que siempre se puede completar el oncenco con lo
 * que queda, y calcula la reserva como `huecos que faltan x basePrice`. Si un
 * hueco no tuviera ninguna carta al precio base, esa promesa es falsa y un
 * jugador puede quedarse sin poder llenar el equipo.
 */
const withoutCheap = economy.filter((e) => e.cheapCount === 0).map((e) => e.slot);
if (withoutCheap.length > 0) {
  problems.push(`Huecos sin ninguna carta a ${basePrice} M, la reserva del presupuesto miente: ${withoutCheap.join(", ")}`);
}

// Por debajo del 25% el presupuesto deja de mandar; por encima del 95% una
// partida normal se queda sin margen y se pierden huecos por sobrepujar.
if (floor < startingBudget * 0.25) {
  problems.push(`El suelo (${floor} M) es menos del 25% del presupuesto: el dinero no aprieta.`);
}
if (mean < startingBudget * 0.7 || mean > startingBudget * 0.95) {
  problems.push(`El oncenco medio (${mean} M) esta fuera de la ventana 70%-95% del presupuesto: recalibra basePrice y openingBidTiers.`);
}
if (ceiling <= startingBudget) {
  problems.push(`El techo (${ceiling} M) cabe en el presupuesto: el oncenco perfecto es alcanzable y no hay que elegir.`);
}

if (problems.length > 0) {
  console.error("");
  for (const problem of problems) console.error(`economia: ${problem}`);
  process.exit(1);
}

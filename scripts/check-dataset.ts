import { readFileSync } from "node:fs";
import { cardsBySlot, MIN_CARDS_PER_SLOT, parseDataset, SLOTS } from "@fut/shared";

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

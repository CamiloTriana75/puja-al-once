import type { CardView } from "../net/types.js";

const FOOT: Record<string, string> = { L: "Zurdo", R: "Diestro", B: "Ambidiestro" };
const CONTINENT: Record<string, string> = {
  EU: "Europa", SA: "Sudamérica", NA: "Norteamérica", AF: "África", AS: "Asia", OC: "Oceanía",
};

/** Las pistas son el juego: lo unico que se sabe antes de pujar. */
export function ClueRow({ card }: { card: CardView }) {
  const clues: [string, string][] = [
    ["Altura", `${card.heightCm} cm`],
    ["Pie", FOOT[card.foot] ?? card.foot],
    ["Edad", card.ageBand],
    ["Origen", CONTINENT[card.continent] ?? card.continent],
    ["Década", card.decade],
  ];

  return (
    <dl className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-5">
      {clues.map(([label, value]) => (
        <div key={label} className="bg-ink px-4 py-3">
          <dt className="font-display text-xs font-bold uppercase tracking-[0.08em] text-mute">{label}</dt>
          <dd className="tnum font-display text-xl font-extrabold text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

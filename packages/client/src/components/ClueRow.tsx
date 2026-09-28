import type { CardView } from "../net/types.js";

const FOOT: Record<string, string> = { L: "Zurdo", R: "Diestro", B: "Ambidiestro" };
const CONTINENT: Record<string, string> = {
  EU: "Europa", SA: "Sudamérica", NA: "Norteamérica", AF: "África", AS: "Asia", OC: "Oceanía",
};

/**
 * Las pistas son el juego: lo unico que se sabe antes de pujar.
 * font-body, no font-display: MASTER.md S3 lista "cuerpo, pistas, listas"
 * explicitamente en la familia Barlow (no la condensada), con peso 400-600
 * -- de ahi font-semibold como techo, no font-bold/extrabold.
 *
 * Cuatro pistas y no cinco: la edad se quito a proposito. Con el nombre y la
 * temporada de la carta, la edad ya se deduce en el reveal, asi que durante la
 * puja solo servia para acortar la lista de candidatos -- y el servidor
 * tampoco la manda (`packages/server/src/schema.ts`), no es que esta fila la
 * esconda. Dos columnas en movil, cuatro en escritorio.
 */
export function ClueRow({ card }: { card: CardView }) {
  const clues: [string, string][] = [
    ["Altura", `${card.heightCm} cm`],
    ["Pie", FOOT[card.foot] ?? card.foot],
    ["Origen", CONTINENT[card.continent] ?? card.continent],
    ["Década", card.decade],
  ];

  return (
    <dl className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
      {clues.map(([label, value]) => (
        <div key={label} className="bg-ink px-4 py-3">
          <dt className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-mute">{label}</dt>
          <dd className="tnum font-body text-xl font-semibold text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

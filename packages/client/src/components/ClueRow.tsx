import { CalendarRange, Earth, Footprints, Ruler } from "lucide-react";
import type { CardView } from "../net/types.js";

const FOOT: Record<string, string> = { L: "Zurdo", R: "Diestro", B: "Ambidiestro" };
const CONTINENT: Record<string, string> = {
  EU: "Europa", SA: "Sudamérica", NA: "Norteamérica", AF: "África", AS: "Asia", OC: "Oceanía",
};

/**
 * Las pistas son el juego: lo único que se sabe antes de pujar. Cuatro y no
 * cinco: la edad no viaja durante la puja (`packages/server/src/schema.ts`).
 */
export function ClueRow({ card }: { card: CardView }) {
  const clues = [
    { label: "Altura", value: `${card.heightCm} cm`, Icon: Ruler },
    { label: "Pie", value: FOOT[card.foot] ?? card.foot, Icon: Footprints },
    { label: "Origen", value: CONTINENT[card.continent] ?? card.continent, Icon: Earth },
    { label: "Década", value: card.decade, Icon: CalendarRange },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2">
      {clues.map(({ label, value, Icon }) => (
        <div key={label} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-line">
          <Icon className="h-5 w-5 shrink-0 text-pitch" aria-hidden="true" strokeWidth={2} />
          <div className="min-w-0">
            <dt className="font-copy text-[0.85rem] text-slate">{label}</dt>
            <dd className="tnum truncate font-headline text-[1rem] font-semibold tracking-[-0.02em] text-forest">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

import { ChevronDown, ScrollText } from "lucide-react";
import { useState } from "react";
import type { PlayerView, RevealedCardView } from "../net/types.js";
import { SLOT_ABBR } from "./game/slots.js";

/**
 * Historial de la partida: qué salió y a cuánto. `revealedCards` llega en
 * orden de inserción, que es el orden cronológico. Plegado por defecto: crece
 * con cada carta y no debe empujar a los rivales fuera de la vista.
 */
export function MatchHistory({
  revealedCards,
  players,
}: {
  revealedCards: Map<string, RevealedCardView>;
  players: Map<string, PlayerView>;
}) {
  const [open, setOpen] = useState(false);
  const cards = [...revealedCards.values()];

  if (cards.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white ring-1 ring-line" aria-label="Historial de la partida">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-2xl px-4 text-left text-forest transition-colors duration-200 hover:bg-pitch-soft"
      >
        <ScrollText className="h-5 w-5 shrink-0 text-pitch" aria-hidden="true" />
        <h2 className="flex-1 font-copy text-[1.02rem] font-semibold">Historial</h2>
        <span className="tnum rounded-full bg-canvas px-2 font-copy text-[0.9rem] text-slate">{cards.length}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <ol className="max-h-80 divide-y divide-line overflow-y-auto border-t border-line">
          {[...cards].reverse().map((card) => {
            const owner = card.ownerId ? players.get(card.ownerId)?.name : null;
            return (
              <li key={card.cardId} className="flex items-baseline gap-2 px-4 py-2.5 font-copy text-[0.95rem]">
                <span className="w-9 shrink-0 font-headline text-[0.75rem] font-semibold text-pitch">{SLOT_ABBR[card.slot] ?? card.slot}</span>
                <span className="min-w-0 flex-1 truncate text-forest">
                  {card.name} <span className="tnum text-slate">{card.season}</span>
                </span>
                <span className="tnum shrink-0 text-slate">{owner ? `${owner}, ${card.price} M` : "Descartada"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

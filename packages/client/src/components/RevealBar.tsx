import { Gavel } from "lucide-react";
import type { CardView, ClientState } from "../net/types.js";

/**
 * El veredicto del martillo: quién se la lleva, por cuánto y de qué club y
 * liga viene. El rating sale como «?» hasta la ceremonia final (D3).
 */
export function RevealBar({ card, state }: { card: CardView; state: ClientState }) {
  void card;
  const revealed = [...state.revealedCards.values()].at(-1);
  if (!revealed) return null;

  const owner = revealed.ownerId ? state.players.get(revealed.ownerId)?.name : null;

  return (
    <div className="reveal-in rounded-[1.75rem] bg-white p-6 ring-1 ring-line">
      <p className="flex items-center gap-2 font-copy text-[1.05rem] text-slate">
        <Gavel className="h-5 w-5 text-pitch" aria-hidden="true" />
        {owner ? "Se la lleva" : "Nadie la quiso"}
      </p>
      <p className="mt-1 font-headline text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.045em] text-forest">
        {owner ? (
          <>
            {owner} <span className="tnum text-pitch">por {revealed.price} M</span>
          </>
        ) : (
          "Descartada"
        )}
      </p>
      <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
        <div className="min-w-0">
          <p className="truncate font-copy text-[1.1rem] font-semibold text-forest">{revealed.club}</p>
          <p className="truncate font-copy text-[0.98rem] text-slate">
            {revealed.league}, {revealed.nation}, temporada {revealed.season}
          </p>
        </div>
      </div>
    </div>
  );
}

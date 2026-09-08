import { useState } from "react";
import type { PlayerView, RevealedCardView } from "../net/types.js";

/** Icono de reloj/historial, trazo 2 sobre 24x24 -- MASTER.md S7: SVG de Lucide, nunca emoji. */
function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Historial completo de la partida: que cartas salieron y a cuanto se
 * fueron -- punto 3 del encargo B5. El servidor ya guarda todo en
 * `revealedCards` (MapSchema, orden de insercion = orden cronologico,
 * mismo razonamiento que `lastReveal` en Auction.tsx); esto es solo
 * cliente.
 *
 * Plegado por defecto: Auction.tsx ya tiene "Pujas recientes" a la vista
 * en la misma columna, y el historial completo crece con cada carta --
 * abierto de partida seria el elemento mas alto de la barra lateral para
 * el 90% de la partida sin que nadie lo pidiera. Boton + estado local, sin
 * ninguna transicion de altura (MASTER.md S5 prohibe animar height): la
 * lista aparece o desaparece de golpe, solo la flecha gira (transform, no
 * height) para confirmar el toggle sin gastar presupuesto de movimiento.
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
    <section className="border-2 border-white/10 bg-ink" aria-label="Historial de la partida">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-12 w-full cursor-pointer items-center gap-2 px-4 text-left transition-colors duration-200 hover:text-lime"
      >
        <HistoryIcon />
        <h2 className="font-display text-lg font-black uppercase tracking-wide text-white">Historial</h2>
        <span className="tnum font-body text-sm text-mute">{cards.length}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ol className="flex flex-col gap-px border-t border-white/10 bg-white/10">
          {[...cards].reverse().map((card) => {
            const owner = card.ownerId ? players.get(card.ownerId)?.name : null;
            return (
              <li key={card.cardId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-ink px-4 py-3">
                <span className="font-display text-xs font-black uppercase tracking-wide text-lime">
                  {card.slot}
                </span>
                <span className="font-display text-base font-extrabold uppercase text-white">
                  {card.name}
                </span>
                <span className="tnum font-body text-sm text-mute">{card.season}</span>
                <span className="ml-auto font-body text-sm">
                  {owner ? (
                    <>
                      <span className="text-mute">{owner}</span>{" "}
                      <span className="tnum font-display font-extrabold text-green">{card.price} M</span>
                    </>
                  ) : (
                    <span className="text-mute">Descartada</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

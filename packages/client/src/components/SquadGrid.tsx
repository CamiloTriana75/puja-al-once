import type { PlayerView, RevealedCardView } from "../net/types.js";

const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

interface Props {
  player: PlayerView;
  revealedCards: Map<string, RevealedCardView>;
  /** Huecos en los que este jugador tiene el mejor rating de la sala. */
  wonSlots?: Set<string>;
}

export function SquadGrid({ player, revealedCards, wonSlots }: Props) {
  return (
    <table className="w-full font-body text-sm">
      <caption className="sr-only">Plantilla de {player.name}. Las filas marcadas ganan el puesto.</caption>
      <tbody>
        {SLOTS.map((slot) => {
          const cardId = player.squad.get(slot);
          const card = cardId ? revealedCards.get(cardId) : undefined;
          const won = wonSlots?.has(slot) ?? false;
          // D3: el rating vale 0 hasta RESULTS -- si esta tabla se pintara
          // durante la partida (hoy solo se monta en Results.tsx, ya en
          // RESULTS) no debe filtrar el numero real. "?" en --mute sobre
          // --ink (design-system/pages/partida.md), nunca sobre bg-lime.
          const ratingHidden = card !== undefined && card.rating <= 0;
          // Tono normal (verde/ink segun ganadora) para un numero real; --mute
          // (o su equivalente atenuado sobre bg-lime) para el "?" y para el
          // guion de hueco vacio -- nunca el mismo tono que un rating real.
          const ratingTone = !card || ratingHidden ? (won ? "text-ink/70" : "text-mute") : won ? "text-ink" : "text-green";
          return (
            <tr key={slot} className={won ? "bg-lime text-ink" : "text-white"}>
              <td className="py-1 pl-2 pr-3 font-display font-bold uppercase opacity-70">{slot}</td>
              <td className="py-1">
                {card ? `${card.name} ${card.season}` : "—"}
                {/* El color no basta como indicador: la fila ganadora se dice tambien. */}
                {won && <span className="sr-only"> (gana el puesto)</span>}
              </td>
              <td className={`tnum py-1 pr-2 text-right font-display text-lg font-black ${ratingTone}`}>
                {card ? (ratingHidden ? "?" : card.rating) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

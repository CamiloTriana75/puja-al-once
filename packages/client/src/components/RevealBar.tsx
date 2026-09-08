import type { CardView, ClientState } from "../net/types.js";

interface Props {
  card: CardView;
  state: ClientState;
}

/**
 * La tarjeta ya muestra nombre y temporada al revelarse (AuctionCard.tsx).
 * Esta barra añade lo que la tarjeta no cabe: club, liga, rating y quien se
 * lo llevo.
 */
export function RevealBar({ card, state }: Props) {
  // `card` (CardView, la carta en mesa) solo expone `publicId`, opaco y sin
  // relacion con `RevealedCardView.cardId` -- ver net/types.ts. No hay
  // ningun campo compartido para cruzar ambos. Pero durante REVEAL
  // `currentCard` es siempre la carta que se acaba de publicar, y
  // `revealedCards` es un MapSchema que conserva el orden de insercion
  // (mismo razonamiento que `lastReveal` en Auction.tsx): la ultima entrada
  // insertada es siempre esa carta.
  void card;
  const revealed = [...state.revealedCards.values()].at(-1);
  if (!revealed) return null;

  const owner = revealed.ownerId ? state.players.get(revealed.ownerId)?.name : null;

  return (
    <div className="panel flex flex-wrap items-center gap-x-8 gap-y-3 bg-ink px-6 py-4 pr-12">
      <p className="tnum font-display text-6xl font-black leading-none text-lime">{revealed.rating}</p>

      <div>
        <p className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
          {revealed.club}
        </p>
        <p className="font-body text-sm text-mute">
          {revealed.league} · {revealed.nation} · temporada {revealed.season}
        </p>
      </div>

      <p className="ml-auto font-display text-xl font-bold uppercase tracking-wide">
        {owner ? (
          <>
            <span className="text-mute">Para</span> <span className="text-green">{owner}</span>{" "}
            <span className="tnum text-white">{revealed.price} M</span>
          </>
        ) : (
          <span className="text-mute">Descartado: nadie lo quiso</span>
        )}
      </p>
    </div>
  );
}

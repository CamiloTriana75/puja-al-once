import { HTTP_URL } from "../net/endpoints.js";
import type { CardView } from "../net/types.js";
import { LotArt } from "./game/LotArt.js";
import { SLOT_LABEL } from "./game/slots.js";


interface Props {
  card: CardView;
  /** Puja vigente en millones. Se muestra en el estado oculto. */
  price: number;
  /**
   * Sala en curso. La silueta se pide a `/silhouettes/:roomId/:publicId.png`
   * y la foto a `/photos/...`: el `publicId` solo vale dentro de su sala, y el
   * servidor solo sirve la foto de una carta ya revelada (AuctionRoom.photoIdFor).
   */
  roomId: string;
}

/** La exclusiva: el cromo de la carta en juego, con borde blanco de álbum. */
export function AuctionCard({ card, price, roomId }: Props) {
  const revealed = card.revealed;
  const silhouetteSrc = `${HTTP_URL}/silhouettes/${roomId}/${card.publicId}.png`;
  const photoSrc = `${HTTP_URL}/photos/${roomId}/${card.publicId}.png`;

  return (
    <figure className="rounded-[1.75rem] bg-white p-2.5 shadow-[0_30px_60px_-36px_rgba(12,36,28,.55)] ring-1 ring-line">
      <LotArt
        silhouetteSrc={silhouetteSrc}
        photoSrc={revealed ? photoSrc : undefined}
        revealed={revealed}
        alt={revealed ? `${card.name}, temporada ${card.season}` : "Silueta de un futbolista sin identificar"}
        className="aspect-[4/5] rounded-[1.3rem]"
      />
      <figcaption className="flex items-center justify-between gap-3 px-3 pb-1.5 pt-3">
        {revealed ? (
          <div className="reveal-in min-w-0">
            <p className="truncate font-headline text-[clamp(1.1rem,2vw,1.45rem)] font-bold leading-[1.05] tracking-[-0.03em] text-forest">{card.name}</p>
            <p className="tnum truncate font-copy text-[0.98rem] text-slate">
              {card.club} <span className="font-semibold text-gold-ink">{card.season}</span>
            </p>
          </div>
        ) : (
          <>
            <p className="min-w-0 truncate font-copy text-[1.1rem] font-medium text-forest">{SLOT_LABEL[card.slot] ?? card.slot}</p>
            <p className="tnum shrink-0 rounded-2xl bg-forest px-5 py-2 font-headline text-[clamp(1.7rem,3vw,2.2rem)] font-bold leading-none tracking-[-0.05em] text-gold shadow-[0_14px_26px_-14px_rgba(12,36,28,.8)]">
              {price} M
            </p>
          </>
        )}
      </figcaption>
    </figure>
  );
}

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HTTP_URL } from "../net/endpoints.js";
import type { CardView } from "../net/types.js";
import { LotArt } from "./game/LotArt.js";
import { SLOT_LABEL } from "./game/slots.js";
import { EASE_OUT, HAMMER_IMPACT_MS as GAVEL_IMPACT_MS } from "../motion/tokens.js";

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

  // El destape (silueta -> jugador) solo se celebra al pasar de oculta a revelada
  // delante de ti, no al entrar con la carta ya abierta. El pop y el destello
  // caen en el golpe del mazo para que todo ocurra a la vez.
  const wasRevealed = useRef(revealed);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (revealed && !wasRevealed.current) {
      setCelebrate(true);
      const id = window.setTimeout(() => setCelebrate(false), GAVEL_IMPACT_MS + 900);
      wasRevealed.current = true;
      return () => window.clearTimeout(id);
    }
    wasRevealed.current = revealed;
  }, [revealed, card.publicId]);

  return (
    <motion.figure
      key={card.publicId}
      animate={celebrate ? { scale: [1, 1, 1.04, 1] } : { scale: 1 }}
      transition={celebrate ? { duration: (GAVEL_IMPACT_MS + 450) / 1000, times: [0, GAVEL_IMPACT_MS / (GAVEL_IMPACT_MS + 450), 0.82, 1], ease: EASE_OUT } : { duration: 0.2 }}
      className="rounded-[1.75rem] bg-white p-2.5 shadow-[0_30px_60px_-36px_rgba(12,36,28,.55)] ring-1 ring-line">
      <LotArt
        silhouetteSrc={silhouetteSrc}
        photoSrc={revealed ? photoSrc : undefined}
        revealed={revealed}
        alt={revealed ? `${card.name}, temporada ${card.season}` : "Silueta de un futbolista sin identificar"}
        className="aspect-[4/5] rounded-[1.3rem]"
      >
        {celebrate && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0] }}
            transition={{ duration: (GAVEL_IMPACT_MS + 500) / 1000, times: [0, GAVEL_IMPACT_MS / (GAVEL_IMPACT_MS + 500) - 0.001, GAVEL_IMPACT_MS / (GAVEL_IMPACT_MS + 500), 1], ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 z-30 bg-white"
          />
        )}
      </LotArt>
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
    </motion.figure>
  );
}

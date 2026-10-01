import { motion, useReducedMotion } from "framer-motion";
import type { PlayerView } from "../../net/types.js";

const TOTAL_SLOTS = 11;

export type RivalTag = "leading" | "passed" | "won" | null;

/**
 * Un jugador en la mesa: saldo, once cubierto y su estado en la carta.
 * El estado siempre lleva texto, nunca solo color.
 */
export function RivalCard({ player, isMe, tag }: { player: PlayerView; isMe: boolean; tag: RivalTag }) {
  const reducedMotion = useReducedMotion() ?? false;
  const filled = player.squad.size;
  const hot = tag === "leading" || tag === "won";

  let status: { text: string; tone: string } | null = null;
  if (player.rejoinPending) status = { text: "Reconectando", tone: "bg-line text-forest" };
  else if (!player.connected) status = { text: "Sin conexión", tone: "bg-alert/12 text-alert" };
  else if (tag === "leading") status = { text: "Va ganando", tone: "bg-forest text-gold" };
  else if (tag === "won") status = { text: "Se la lleva", tone: "bg-forest text-gold" };
  else if (tag === "passed") status = { text: "Pasa", tone: "bg-line text-slate" };

  return (
    <motion.li
      layout={!reducedMotion}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl px-4 py-3.5 transition-[background-color,box-shadow] duration-300 ${
        hot ? "bg-gold shadow-[0_18px_34px_-22px_rgba(122,75,0,.9)]" : "bg-white ring-1 ring-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-copy text-[1.08rem] font-semibold text-forest">
          {player.name}
          {isMe && <span className="ml-1.5 font-normal text-forest/70">(tú)</span>}
        </span>
        {status && <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-copy text-[0.85rem] font-semibold ${status.tone}`}>{status.text}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="tnum font-headline text-[1.25rem] font-semibold tracking-[-0.03em] text-forest">{player.budget} M</span>
        <span className="flex items-center gap-[3px]" aria-label={`${filled} de ${TOTAL_SLOTS} puestos`}>
          {Array.from({ length: TOTAL_SLOTS }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`h-2.5 w-1.5 rounded-full ${index < filled ? (hot ? "bg-forest" : "bg-pitch") : hot ? "bg-forest/20" : "bg-line"}`}
            />
          ))}
        </span>
      </div>
    </motion.li>
  );
}

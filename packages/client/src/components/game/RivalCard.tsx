import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "../../net/types.js";
import { CountUp } from "../../motion/CountUp.js";
import { DURATION, EASE_OUT, SPRING_POP } from "../../motion/tokens.js";

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
  // Gasto reciente ("-65 M") y puesto recien llenado: estado explicito con
  // temporizador, para que sobrevivan a otros re-renders mientras se muestran.
  const lastBudget = useRef(player.budget);
  const lastFilled = useRef(filled);
  const [spent, setSpent] = useState(0);
  const [newPip, setNewPip] = useState<number | null>(null);

  useEffect(() => {
    const diff = lastBudget.current - player.budget;
    lastBudget.current = player.budget;
    if (diff <= 0) return;
    setSpent(diff);
    const id = window.setTimeout(() => setSpent(0), 1400);
    return () => window.clearTimeout(id);
  }, [player.budget]);

  useEffect(() => {
    const grew = filled > lastFilled.current;
    lastFilled.current = filled;
    if (!grew) return;
    setNewPip(filled - 1);
    const id = window.setTimeout(() => setNewPip(null), 700);
    return () => window.clearTimeout(id);
  }, [filled]);
  const showSpent = spent > 0;

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
        <span className="relative">
          <CountUp value={player.budget} format={(n) => `${n} M`} duration={0.8} className="tnum font-headline text-[1.25rem] font-semibold tracking-[-0.03em] text-forest" />
          <AnimatePresence>
            {showSpent && (
              <motion.span
                key={`spent-${player.budget}`}
                aria-hidden="true"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 14 }}
                exit={{ opacity: 0, y: 22 }}
                transition={{ duration: DURATION.feedback, ease: EASE_OUT }}
                className="tnum absolute left-0 top-full whitespace-nowrap font-headline text-[0.95rem] font-bold text-alert"
              >
                -{spent} M
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="flex items-center gap-[3px]" aria-label={`${filled} de ${TOTAL_SLOTS} puestos`}>
          {Array.from({ length: TOTAL_SLOTS }, (_, index) => {
            const isNew = newPip === index;
            return (
              <motion.span
                key={index}
                aria-hidden="true"
                initial={isNew ? { scale: 0, y: -10 } : false}
                animate={{ scale: 1, y: 0 }}
                transition={SPRING_POP}
                className={`h-2.5 w-1.5 rounded-full ${index < filled ? (hot ? "bg-forest" : "bg-pitch") : hot ? "bg-forest/20" : "bg-line"}`}
              />
            );
          })}
        </span>
      </div>
    </motion.li>
  );
}

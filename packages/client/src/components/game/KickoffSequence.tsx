import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, SPRING_POP } from "../../motion/tokens.js";
import { PitchLines, POSITIONS } from "../SquadGrid.js";
import { Ball, Burst } from "./FieldPieces.js";
import { SLOT_ABBR, SLOT_ORDER } from "./slots.js";

/** Los once van cayendo al campo de portero a delantero, uno cada DOT_STEP. */
const DOT_START = 0.35;
const DOT_STEP = 0.1;
/** Jugada de saque: del portero al delantero por el centro y la banda. */
const BALL_ROUTE = ["GK", "CB1", "CDM", "CM", "CAM", "LW", "ST"] as const;
const BALL_START = DOT_START + 0.8;
const BALL_LEG = 0.3;
const HOLD_MS = 1000;
const FADE_MS = 300;

const ballArrival = BALL_START + (BALL_ROUTE.length - 1) * BALL_LEG;
const TOTAL_MS = Math.round((ballArrival + 0.2) * 1000) + HOLD_MS;

/**
 * Arranque de partida: el campo aparece, los once puestos caen uno a uno
 * formando el 4-3-3, el balon cruza el campo en una jugada de pases y al llegar
 * al delantero salta "¡Subasta!". Dura ~3,7 s; clic o Esc la saltan.
 *
 * Va en un portal sobre <body> (un `fixed` dentro de la transicion entre
 * pantallas se posicionaria contra ella). Como la secuencia de venta, es una
 * excepcion deliberada a `prefers-reduced-motion`: es un momento unico al
 * empezar, corto y saltable.
 */
export function KickoffSequence({ playerNames, onDone }: { playerNames: string[]; onDone: () => void }) {
  const [closing, setClosing] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const toClose = window.setTimeout(() => setClosing(true), TOTAL_MS);
    const toDone = window.setTimeout(() => done.current(), TOTAL_MS + FADE_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") done.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(toClose);
      window.clearTimeout(toDone);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const route = BALL_ROUTE.map((slot) => POSITIONS[slot]!);
  const legs = route.length - 1;
  const times = route.map((_, index) => index / legs);
  const duration = legs * BALL_LEG;
  const touchAt = (slot: string): number | null => {
    const index = BALL_ROUTE.indexOf(slot as (typeof BALL_ROUTE)[number]);
    return index === -1 ? null : BALL_START + index * BALL_LEG;
  };

  const scaleKeys = [1];
  const scaleTimes = [0];
  for (let index = 0; index < legs; index++) {
    scaleKeys.push(1.4, 1);
    scaleTimes.push((index + 0.5) / legs, (index + 1) / legs);
  }

  return createPortal(
    <motion.div
      role="presentation"
      onClick={() => done.current()}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: closing ? FADE_MS / 1000 : 0.25 }}
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_40%,rgba(21,131,74,.7),rgba(12,36,28,.94))] p-4 backdrop-blur-[3px]"
    >
      <p className="sr-only" role="status">
        Empieza la subasta: once puestos que llenar, una ronda por puesto.
      </p>

      <div className="flex max-h-screen w-full flex-col items-center gap-3">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="text-center"
        >
          <p className="font-headline text-[clamp(1.4rem,3.4vw,2.2rem)] font-bold tracking-[-0.045em] text-white">Empieza la subasta</p>
          <p className="mt-1 font-copy text-[1.05rem] text-white/80">
            11 puestos, una ronda por puesto · {playerNames.join(", ")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="pitch-field relative aspect-[3/4] h-[min(66vh,36rem)] max-w-[88vw] overflow-hidden rounded-[1.5rem] shadow-[0_40px_70px_-30px_rgba(0,0,0,.7)] ring-4 ring-white"
        >
          <PitchLines />

          {SLOT_ORDER.map((slot, index) => {
            const pos = POSITIONS[slot]!;
            const touch = touchAt(slot);
            const isStriker = slot === "ST";
            return (
              <div key={slot} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                {isStriker && <Burst delay={ballArrival} />}
                <motion.span
                  initial={{ scale: 0, y: -26, opacity: 0 }}
                  animate={{
                    scale: touch !== null ? [1, 1.3, 1] : 1,
                    y: 0,
                    opacity: 1,
                  }}
                  transition={{
                    scale: touch !== null
                      ? { duration: 0.4, delay: touch, ease: EASE_OUT }
                      : { ...SPRING_POP, delay: DOT_START + index * DOT_STEP },
                    y: { ...SPRING_POP, delay: DOT_START + index * DOT_STEP },
                    opacity: { duration: 0.15, delay: DOT_START + index * DOT_STEP },
                  }}
                  className={`grid size-10 place-items-center rounded-full font-headline text-[0.7rem] font-bold shadow-md ring-2 ring-white sm:size-12 ${
                    isStriker ? "bg-gold text-forest" : "bg-white text-forest"
                  }`}
                >
                  {SLOT_ABBR[slot]}
                </motion.span>
              </div>
            );
          })}

          <motion.div
            aria-hidden="true"
            initial={{ left: `${route[0]!.x}%`, top: `${route[0]!.y}%`, opacity: 0, scale: 0.4 }}
            animate={{
              left: route.map((point) => `${point.x}%`),
              top: route.map((point) => `${point.y}%`),
              opacity: 1,
              scale: scaleKeys,
              rotate: legs * 360,
            }}
            transition={{
              left: { duration, delay: BALL_START, times, ease: "easeInOut" },
              top: { duration, delay: BALL_START, times, ease: "easeInOut" },
              scale: { duration, delay: BALL_START, times: scaleTimes, ease: "easeInOut" },
              rotate: { duration, delay: BALL_START, ease: "linear" },
              opacity: { duration: 0.2, delay: BALL_START - 0.2 },
            }}
            className="pointer-events-none absolute z-20 size-7 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_6px_rgba(0,0,0,.45)] sm:size-8"
          >
            <Ball className="size-full" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, scale: 1.8, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: -5 }}
            transition={{ ...SPRING_POP, delay: ballArrival + 0.05 }}
            className="absolute inset-x-0 top-[42%] z-30 mx-auto w-fit rounded-2xl bg-gold px-7 py-2 font-headline text-[clamp(1.8rem,5vw,2.8rem)] font-bold tracking-[-0.04em] text-forest shadow-[0_20px_40px_-18px_rgba(0,0,0,.6)]"
          >
            ¡Subasta!
          </motion.p>
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  );
}

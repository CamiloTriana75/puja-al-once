import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";
import { useRecentChange } from "./hooks.js";
import { BID_PULSE_SCALE, DURATION, EASE_OUT } from "./tokens.js";

const CHIP_MS = 900;

/**
 * El precio de la carta. Cada puja nueva lo hace latir y lo tiñe de verde un
 * instante, y el nombre de quien pujó sube desde abajo ~0,9 s y se va.
 * Al montar no anima: entrar a una puja en curso no es una puja nueva.
 */
export function AnimatedPrice({
  value,
  bidderName,
  className = "",
}: {
  value: number;
  /** Quien acaba de pujar; null cuando el precio es el de salida. */
  bidderName: string | null;
  className?: string;
}) {
  const controls = useAnimationControls();
  const first = useRef(true);
  const showChip = useRecentChange(value, CHIP_MS) && bidderName !== null;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void controls.start({
      scale: BID_PULSE_SCALE,
      color: ["#0C241C", "#15834A", "#0C241C"],
      transition: { duration: DURATION.feedback, ease: EASE_OUT },
    });
  }, [value, controls]);

  return (
    <span className="relative inline-block">
      <motion.span animate={controls} className={`tnum inline-block origin-left ${className}`}>
        {value} M
      </motion.span>
      <AnimatePresence>
        {showChip && (
          <motion.span
            key={`${value}-${bidderName}`}
            role="status"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: DURATION.ui, ease: EASE_OUT }}
            className="absolute left-0 top-full mt-1 whitespace-nowrap rounded-full bg-forest px-3 py-0.5 font-copy text-[0.95rem] font-semibold text-gold"
          >
            {bidderName}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

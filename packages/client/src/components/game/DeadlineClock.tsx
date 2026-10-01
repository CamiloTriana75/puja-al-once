import { motion, useReducedMotion } from "framer-motion";
import { Gavel, Vote } from "lucide-react";

export type ClockMode = "opening" | "bidding" | "skip" | "hammer";

/**
 * El reloj de cierre: la pieza que manda en la pantalla. Cifras enormes,
 * barra de tiempo restante y, en los últimos cinco segundos, oro y latido.
 * Con movimiento reducido la cifra cambia sin latido.
 */
export function DeadlineClock({
  mode,
  remainingMs,
  windowMs,
}: {
  mode: ClockMode;
  remainingMs: number;
  /** Duración total de la ventana actual, para la barra. */
  windowMs: number;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const seconds = Math.max(0, remainingMs) / 1000;
  const urgent = mode === "bidding" && seconds < 5;
  // Ultimos 2 s: el latido se acelera y se hace mas fuerte, con un temblor corto.
  const critical = mode === "bidding" && seconds < 2;
  const fraction = windowMs > 0 ? Math.min(1, Math.max(0, remainingMs / windowMs)) : 0;

  const label =
    mode === "opening" ? "Abre la puja"
      : mode === "bidding" ? "Cierra en"
        : mode === "skip" ? "Votación de salto"
          : "Cae el martillo";

  return (
    <div className="on-dark relative overflow-hidden rounded-[1.75rem] bg-forest px-6 pb-5 pt-5 text-white shadow-[0_30px_60px_-34px_rgba(12,36,28,.8)]">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 font-copy text-[1.05rem] font-medium text-white/85">
          {mode === "hammer" && <Gavel className="h-5 w-5 text-gold" aria-hidden="true" />}
          {mode === "skip" && <Vote className="h-5 w-5 text-gold" aria-hidden="true" />}
          {label}
        </p>
        {urgent && <p className="rounded-full bg-gold px-3 py-1 font-copy text-[0.9rem] font-semibold text-forest">Últimos segundos</p>}
      </div>

      {mode === "hammer" ? (
        <p className="mt-2 font-headline text-[clamp(2.4rem,5vw,3.6rem)] font-bold leading-none tracking-[-0.05em] text-gold">Vendida</p>
      ) : (
        <motion.p
          aria-hidden="true"
          animate={
            urgent && !reducedMotion
              ? critical
                ? { scale: [1, 1.1, 1], x: [0, -3, 3, -2, 0] }
                : { scale: [1, 1.04, 1], x: 0 }
              : { scale: 1, x: 0 }
          }
          transition={urgent ? { duration: critical ? 0.35 : 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          className={`tnum mt-1 origin-left font-headline text-[clamp(3.6rem,7.5vw,6rem)] font-bold leading-[0.95] tracking-[-0.06em] ${urgent ? "text-gold" : "text-white"}`}
        >
          {mode === "bidding" ? seconds.toFixed(1) : Math.ceil(seconds)}
          <span className="ml-1 text-[0.4em] font-semibold tracking-normal text-white/60">s</span>
        </motion.p>
      )}

      <div aria-hidden="true" className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
        <div
          className={`h-full origin-left rounded-full transition-transform duration-200 ease-linear ${urgent ? "bg-gold" : "bg-pitch"}`}
          style={{ transform: `scaleX(${mode === "hammer" ? 0 : fraction})` }}
        />
      </div>
      <p className="sr-only">
        {mode === "hammer" ? "Subasta cerrada" : `${label}: ${Math.ceil(seconds)} segundos`}
      </p>
    </div>
  );
}

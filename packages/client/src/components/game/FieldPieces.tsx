import { motion } from "framer-motion";

/** Balon de la jugada: blanco con gajos bosque, mismo trazo que la marca. */
export function Ball({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="#fff" stroke="#0C241C" strokeWidth="2" />
      <path d="M16 10.2 21.52 14.21 19.41 20.69H12.59L10.48 14.21Z" fill="#0C241C" />
      <path d="M16 10.2V2.5M21.52 14.21l7.3-2.4M19.41 20.69l4.5 6.2M12.59 20.69l-4.5 6.2M10.48 14.21l-7.3-2.4" stroke="#0C241C" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Destellos dorados que saltan del puesto cuando llega el balon. */
export function Burst({ delay }: { delay: number }) {
  return (
    <>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const reach = 54 + (index % 3) * 14;
        return (
          <motion.span
            key={index}
            aria-hidden="true"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, scale: [0.4, 1, 0.3] }}
            transition={{ duration: 0.8, delay, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
          />
        );
      })}
    </>
  );
}

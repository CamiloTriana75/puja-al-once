import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useInViewOnce } from "./hooks.js";
import { CONTAINER, EASE_OUT, SectionTitle } from "./ui.js";

// Los once puestos del juego (SLOTS en packages/shared), atacando hacia la derecha.
const POSITIONS = [
  { abbr: "POR", name: "Portero", x: 7, y: 50 },
  { abbr: "LI", name: "Lateral izquierdo", x: 26, y: 15 },
  { abbr: "DFC", name: "Central", x: 22, y: 38 },
  { abbr: "DFC", name: "Central", x: 22, y: 62 },
  { abbr: "LD", name: "Lateral derecho", x: 26, y: 85 },
  { abbr: "MCD", name: "Mediocentro defensivo", x: 41, y: 50 },
  { abbr: "MC", name: "Mediocentro", x: 55, y: 29 },
  { abbr: "MP", name: "Mediapunta", x: 60, y: 66 },
  { abbr: "EI", name: "Extremo izquierdo", x: 78, y: 16 },
  { abbr: "DC", name: "Delantero", x: 85, y: 50 },
  { abbr: "ED", name: "Extremo derecho", x: 78, y: 84 },
];

function millions(n: number): string {
  return n >= 1000 ? `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, "0")} M` : `${n} M`;
}

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const reduced = useReducedMotion() ?? false;
  const [ref, seen] = useInViewOnce<HTMLSpanElement>();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    if (!seen) return;
    const controls = animate(0, to, { duration: 1.1, ease: EASE_OUT, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [reduced, seen, to]);
  return (
    <span ref={ref}>
      <span className="sr-only">{format(to)}</span>
      <span aria-hidden="true" className="tnum">
        {format(value)}
      </span>
    </span>
  );
}

const STATS = [
  { value: <CountUp to={11} format={String} />, label: "puestos que llenar, de portero a extremo" },
  { value: <CountUp to={1000} format={millions} />, label: "de presupuesto para todo el once" },
  { value: <span className="tnum">2–4</span>, label: "jugadores por sala" },
  { value: <span className="tnum">0 €</span>, label: "sin cuentas, anuncios ni descargas" },
];

function Pitch() {
  const reduced = useReducedMotion() ?? false;
  return (
    <div className="relative aspect-[1000/640] w-full">
      <svg viewBox="0 0 1000 640" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <rect x="6" y="6" width="988" height="628" rx="30" fill="var(--color-pitch-soft)" />
        <g stroke="#9ADCC1" strokeWidth="4">
          <rect x="6" y="6" width="988" height="628" rx="30" />
          <path d="M500 6v628" />
          <circle cx="500" cy="320" r="86" />
          <path d="M6 165h150v310H6M6 250h56v140H6M994 165H844v310h150M994 250h-56v140h56" />
          <path d="M156 262a68 68 0 0 1 0 116M844 262a68 68 0 0 0 0 116" />
        </g>
        <circle cx="500" cy="320" r="7" fill="#9ADCC1" />
      </svg>
      <ul aria-label="Los once puestos del equipo" className="absolute inset-0">
        {POSITIONS.map((position, index) => (
          <motion.li
            key={`${position.abbr}-${index}`}
            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: reduced ? 0 : index * 0.05 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-forest font-headline text-[0.6rem] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(4,23,38,.8)] ring-[3px] ring-white sm:h-11 sm:w-11 sm:text-[0.7rem]">
              <span aria-hidden="true">{position.abbr}</span>
              <span className="sr-only">{position.name}</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function Numbers() {
  return (
    <section id="reglas" aria-labelledby="numbers-title" className="scroll-mt-24 bg-white py-24 sm:py-28">
      <div className={CONTAINER}>
        <SectionTitle id="numbers-title">El reglamento, en números</SectionTitle>
        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
          <Pitch />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {STATS.map((stat) => (
              <li key={stat.label} className="rounded-2xl bg-pitch px-6 py-4 text-white">
                <p className="font-headline text-[1.9rem] font-bold leading-tight tracking-[-0.04em]">{stat.value}</p>
                <p className="mt-0.5 font-copy text-[1.02rem] font-medium leading-snug">{stat.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

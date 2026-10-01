import { motion, useReducedMotion } from "framer-motion";
import { Coins, Eye, Gavel, ScanEye, Shirt, Timer } from "lucide-react";
import { CONTAINER, EASE_OUT, SectionTitle } from "./ui.js";

const STEPS = [
  { icon: ScanEye, title: "Salen las pistas", body: "Altura, pie, origen y década. Del nombre, ni rastro." },
  { icon: Coins, title: "Precio de salida", body: "De 30 a 200 M según el tramo de la carta. Ya es una pista." },
  { icon: Timer, title: "Se puja contra el reloj", body: "25 segundos para abrir la puja; cada puja nueva deja 10 para contestar." },
  { icon: Gavel, title: "Cae el martillo", body: "Se la lleva la puja más alta. Si no convence a nadie, se pasa." },
  { icon: Eye, title: "Se revela", body: "Nombre, club y temporada. El rating se guarda hasta el final." },
  { icon: Shirt, title: "Directo al once", body: "La carta ocupa su puesto y sale la siguiente hasta cerrar la ronda." },
];

// Rejilla de escritorio: tres pasos a cada lado del eje central.
const PLACE = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-1 lg:row-start-2",
  "lg:col-start-1 lg:row-start-3",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-3 lg:row-start-3",
];

// Geometría del eje (viewBox 440x432): los conectores terminan a la altura
// del centro de cada fila de 9rem, así que casan con los pasos sin medir nada.
const CX = 220;
const CY = 216;
const R = 118;
const CONNECTORS = [
  "M136.6 132.6 L100 72 H8",
  "M102 216 H8",
  "M136.6 299.4 L100 360 H8",
  "M303.4 132.6 L340 72 H432",
  "M338 216 H432",
  "M303.4 299.4 L340 360 H432",
];
const ENDS: [number, number][] = [[8, 72], [8, 216], [8, 360], [432, 72], [432, 216], [432, 360]];

function Hub({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[27.5rem] -translate-x-1/2 lg:block">
      <svg viewBox="0 0 440 432" className="h-full w-full" fill="none">
        {CONNECTORS.map((d, index) => (
          <motion.path
            key={d}
            d={d}
            stroke="var(--color-pitch)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0 }}
            whileInView={reduced ? undefined : { pathLength: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.45 + index * 0.07 }}
          />
        ))}
        {ENDS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={6} fill="var(--color-pitch)" />
        ))}
        <motion.circle
          cx={CX}
          cy={CY}
          r={R}
          stroke="var(--color-pitch)"
          strokeWidth={16}
          initial={reduced ? false : { pathLength: 0 }}
          whileInView={reduced ? undefined : { pathLength: 1 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
        />
        <circle cx={CX} cy={CY} r={100} fill="var(--color-pine)" />
        {!reduced && (
          // El círculo invisible hace que el centro de giro sea el del aro.
          <motion.g animate={{ rotate: 360 }} transition={{ duration: 18, ease: "linear", repeat: Infinity }}>
            <circle cx={CX} cy={CY} r={R} fill="none" />
            <circle cx={CX} cy={CY - R} r={9} fill="white" stroke="var(--color-forest)" strokeWidth={3} />
          </motion.g>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-headline text-[3.4rem] font-bold leading-none tracking-[-0.06em] text-pitch">×11</p>
          <p className="mx-auto mt-2 max-w-[9rem] font-copy text-[1rem] leading-snug text-white/85">rondas, una por puesto del once</p>
        </div>
      </div>
    </div>
  );
}

export function RoundLoop() {
  const reduced = useReducedMotion() ?? false;
  return (
    <section id="como-se-juega" aria-labelledby="loop-title" className="scroll-mt-24 py-24 sm:py-28">
      <div className={CONTAINER}>
        <SectionTitle id="loop-title">Así se juega cada carta</SectionTitle>
        <p className="mx-auto mt-5 max-w-2xl text-center font-copy text-[1.15rem] leading-[1.6] text-slate">
          Cada ronda es un puesto del once. Salen varias cartas para ese puesto y cada una recorre este camino.
        </p>

        <div className="mx-auto mt-10 grid h-40 w-40 place-items-center rounded-full bg-pine text-center ring-[10px] ring-pitch lg:hidden">
          <div>
            <p className="font-headline text-[2.4rem] font-bold leading-none tracking-[-0.06em] text-pitch">×11</p>
            <p className="mt-1 font-copy text-[0.85rem] leading-snug text-white/85">una ronda por puesto</p>
          </div>
        </div>

        <div className="relative mt-12 lg:mt-16">
          <ol className="relative space-y-9 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-0.5 before:bg-pitch/45 before:content-[''] lg:grid lg:grid-cols-[minmax(0,1fr)_27.5rem_minmax(0,1fr)] lg:grid-rows-[repeat(3,9rem)] lg:space-y-0 lg:before:hidden">
            {STEPS.map((step, index) => {
              const left = index < 3;
              return (
                <motion.li
                  key={step.title}
                  initial={reduced ? false : { opacity: 0, x: left ? -18 : 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: reduced ? 0 : 0.35 + index * 0.08 }}
                  className={`relative flex items-start gap-5 lg:items-center ${left ? "lg:flex-row-reverse lg:pr-3 lg:text-right" : "lg:pl-3"} ${PLACE[index] ?? ""}`}
                >
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-forest shadow-[0_12px_26px_-18px_rgba(4,23,38,.6)] ring-1 ring-line">
                    <step.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.9} />
                    <span
                      aria-hidden="true"
                      className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-pine font-headline text-[0.7rem] font-semibold text-white"
                    >
                      {index + 1}
                    </span>
                  </span>
                  <div className="min-w-0 max-w-[19rem]">
                    <h3 className="font-headline text-[1.02rem] font-semibold tracking-[-0.02em] text-forest">{step.title}</h3>
                    <p className="mt-1.5 font-copy text-[1.02rem] leading-[1.5] text-slate">{step.body}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          <Hub reduced={reduced} />
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-center font-copy text-[1.15rem] leading-[1.6] text-forest">
          Al final, la ceremonia voltea los ratings: un punto por puesto para el mejor jugador. Gana quien más puntos sume.
        </p>
      </div>
    </section>
  );
}

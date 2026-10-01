import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { CONTAINER, PillButton } from "./ui.js";

/** El teléfono sube desde el césped mientras la banda entra en pantalla. */
function RisingPhone({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], [140, 0]);
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0">
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

export function CtaBand({ onCreate, phone }: { onCreate: () => void; phone: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section aria-labelledby="cta-title" className="relative lg:mt-44">
      <div className="pitch-stripes">
        <div className={`${CONTAINER} grid items-end lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-20`}>
          <div className="py-16 sm:py-20">
            <h2
              id="cta-title"
              className="max-w-xl text-balance font-headline text-[clamp(1.85rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-white"
            >
              Tu grupo, una sala y once puestos por repartir
            </h2>
            <p className="mt-5 max-w-lg font-copy text-[1.15rem] leading-[1.6] text-white/85">
              Crea la sala, comparte el código de cinco letras y la partida arranca en cuanto todos pulsan Listo.
            </p>
            <div className="mt-9">
              <PillButton tone="gold" onClick={onCreate}>
                Crear una sala
              </PillButton>
            </div>
          </div>
          {/* Recorta por abajo, no por arriba: el teléfono rompe el borde superior de la banda. */}
          <div aria-hidden="true" className="relative hidden self-stretch [clip-path:inset(-60rem_-4rem_0_-4rem)] lg:block">
            {reduced ? <div className="absolute inset-x-0 bottom-0">{phone}</div> : <RisingPhone>{phone}</RisingPhone>}
          </div>
        </div>
      </div>
    </section>
  );
}

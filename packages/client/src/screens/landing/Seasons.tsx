import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import heroPhoto from "../../assets/hero-photo.png";
import { CONTAINER, EASE_OUT, PillButton, SectionTitle } from "./ui.js";

const POINTS = [
  "Cada carta es una temporada concreta, con el club de ese año.",
  "El precio de salida depende del tramo de rating: mírala dos veces.",
  "El rating no aparece hasta la ceremonia final.",
];

/** Cromo: la carta del juego con el borde blanco de un álbum de pegatinas. */
function Cromo({ season, club, rating, faded = false }: { season: number; club: string; rating: number; faded?: boolean }) {
  return (
    <figure className="rounded-[1.4rem] bg-white p-2.5 shadow-[0_34px_60px_-34px_rgba(4,23,38,.6)] ring-1 ring-line">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[1rem] lot-field">
        <div aria-hidden="true" className="absolute -right-[18%] top-0 h-full w-[42%] -skew-x-[18deg] bg-gold" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[24%] bg-forest" />
        <img
          src={heroPhoto}
          alt={`Retrato ilustrativo de Ronaldinho, temporada ${season}`}
          width={365}
          height={512}
          loading="lazy"
          decoding="async"
          className={`absolute -bottom-1 left-1/2 h-[92%] w-auto max-w-none -translate-x-1/2 object-contain object-bottom ${faded ? "brightness-[.8] saturate-[.5]" : ""}`}
        />
        <div className="absolute left-3 top-3 rounded-xl bg-forest/92 px-3 py-2 text-white">
          <p className="tnum font-headline text-[1.8rem] font-bold leading-none tracking-[-0.05em] text-gold">{rating}</p>
          <p className="font-copy text-[0.8rem] text-white/80">Rating</p>
        </div>
      </div>
      <figcaption className="flex items-baseline justify-between gap-3 px-1.5 pb-1 pt-3">
        <span className="tnum font-headline text-lg font-semibold tracking-[-0.02em] text-forest">{season}</span>
        <span className="truncate font-copy text-[0.98rem] text-slate">{club}</span>
      </figcaption>
    </figure>
  );
}

export function Seasons({ onPlay }: { onPlay: () => void }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section aria-labelledby="seasons-title" className="py-24 sm:py-28">
      <div className={`${CONTAINER} grid items-center gap-16 lg:grid-cols-2 lg:gap-12`}>
        <div>
          <SectionTitle id="seasons-title" align="start">
            Mismo jugador, otra temporada
          </SectionTitle>
          <p className="mt-5 max-w-xl font-copy text-[1.3rem] font-medium leading-[1.45] text-gold-ink">
            Ronaldinho tuvo un 94 en 2006 y un 74 en 2015. En la subasta no sabes cuál te está tocando.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 font-copy text-[1.1rem] leading-[1.5] text-forest">
                <Check className="mt-1 h-5 w-5 shrink-0 text-pitch" aria-hidden="true" strokeWidth={2.4} />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <PillButton onClick={onPlay}>Jugar una partida</PillButton>
          </div>
        </div>

        <div className="relative mx-auto h-[25rem] w-full max-w-[30rem] sm:h-[30rem]">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 30, rotate: 10 }}
            whileInView={{ opacity: 1, y: 0, rotate: 5 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
            className="absolute right-0 top-10 w-[57%]"
          >
            <Cromo season={2015} club="Fluminense" rating={74} faded />
          </motion.div>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 30, rotate: -9 }}
            whileInView={{ opacity: 1, y: 0, rotate: -4 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className="absolute left-0 top-0 w-[57%]"
          >
            <Cromo season={2006} club="FC Barcelona" rating={94} />
          </motion.div>
          <motion.p
            initial={reduced ? false : { opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.5 }}
            className="absolute left-1/2 top-[34%] grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full bg-gold-ink font-headline text-[1.35rem] font-bold tracking-[-0.04em] text-white shadow-[0_18px_34px_-16px_rgba(214,31,85,.8)] ring-[6px] ring-canvas"
          >
            <span className="sr-only">Diferencia de rating: </span>−20
          </motion.p>
        </div>
      </div>
    </section>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import heroPhoto from "../assets/hero-photo.png";
import heroSilhouette from "../assets/hero-silhouette.png";

interface Props {
  error: string | null;
  onCreate: (name: string) => void;
  onJoinByCode: (name: string, code: string) => void;
}

/**
 * Cada cuanto alterna el hero entre silueta y foto -- MASTER.md S5 no fija
 * un numero para esto (no es una de las cuatro transiciones tabuladas, que
 * son todas disparadas por evento de partida), asi que se elige un ritmo de
 * lectura: bastante para leer el nombre y el rating antes de que cambie,
 * poco para que la pagina no se sienta estatica.
 */
const CYCLE_MS = 3200;

/**
 * Un solo par pico/declive, elegido en el servidor -- no en el navegador --
 * en el sentido de que estos datos viven en el bundle compilado del
 * cliente, nunca en una respuesta HTTP que alguien pueda sondear pidiendo
 * otros. Ronaldinho 2006/2015 es el que cita `landing.md` en su propio
 * texto y el de mayor caida de rating de los 17 pares del dataset (94 a 74,
 * ver data/players.json) -- el mas reconocible y el mas dramatico a la vez.
 */
const HOOK_PLAYER = {
  name: "Ronaldinho",
  peak: { season: 2006, club: "FC Barcelona", rating: 94 },
  decline: { season: 2015, club: "Fluminense", rating: 74 },
};

/** Icono de sala/gente, trazo 2 sobre 24x24 -- MASTER.md S7: SVG, nunca emoji. */
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/**
 * La tarjeta del hero. Mismo lenguaje visual que AuctionCard.tsx (cuña
 * lima, banda --deep, silueta rompiendo el borde, panel --ink biselado) sin
 * tocar ese fichero -- pertenece al otro agente. A diferencia de
 * AuctionCard, esta no depende de roomId/publicId: usa los dos assets
 * locales importados arriba, por eso puede vivir fuera de una partida.
 *
 * `revealed` decide que capa se ve. Con movimiento reducido el padre nunca
 * cambia este valor solo (ver Landing de abajo): en su lugar monta DOS
 * copias de este componente, una fija en cada estado, lado a lado -- la
 * transicion cruzada de aqui dentro (filter+opacity) sigue existiendo pero
 * queda anulada por la regla global `prefers-reduced-motion` de index.css,
 * y como ambas copias ya estan en su estado final no hay nada a medio
 * animar que se note.
 */
/**
 * `compact` se activa SOLO cuando dos HeroCard comparten fila en el layout
 * de `prefers-reduced-motion` (ver Hero mas abajo) -- ahi cada tarjeta vale
 * la mitad del ancho de viewport que veian los clamp() de mas abajo al
 * calcular su `vw`, y sin este ajuste "Ronaldinho" y "$45M" se salen del
 * panel y el `overflow-hidden` del figure los corta a media palabra. Es
 * exactamente el caso que protege la regla de MASTER.md/landing.md: con
 * movimiento reducido la informacion tiene que seguir completa, nunca
 * depender de que hubiera espacio de sobra para una animacion que aqui no
 * ocurre.
 */
function HeroCard({
  revealed,
  priceLabel,
  compact = false,
  animateCaption = true,
}: {
  revealed: boolean;
  priceLabel: string;
  compact?: boolean;
  animateCaption?: boolean;
}) {
  return (
    <figure className="panel relative aspect-[3/4] w-full overflow-hidden bg-green sm:aspect-[4/3]">
      <div
        aria-hidden
        className="absolute -right-24 top-0 h-full w-2/5 bg-lime"
        style={{ transform: "skewX(-18deg)" }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-deep" />

      <AnimatePresence>
        {!revealed && (
          <motion.img
            key="silhouette"
            src={heroSilhouette}
            alt="Silueta de un futbolista sin identificar, previo a la revelación"
            className="absolute -top-6 right-[6%] z-10 h-[112%] w-auto object-contain object-bottom sm:right-[10%] sm:h-[115%]"
            style={{ filter: "brightness(0) invert(1)" }}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {revealed && (
          <motion.img
            key="photo"
            src={heroPhoto}
            alt="Ronaldinho, futbolista revelado tras la puja"
            className="absolute -top-6 right-[6%] z-10 h-[112%] w-auto object-contain object-bottom sm:right-[10%] sm:h-[115%]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <motion.figcaption
        key={animateCaption ? (revealed ? "caption-revealed" : "caption-price") : "caption-static"}
        initial={animateCaption ? { opacity: 0, x: -24 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: animateCaption ? 0.15 : 0 }}
        className={`panel absolute left-0 top-[8%] z-20 bg-ink px-5 py-4 pr-10 sm:px-6 sm:py-5 ${
          compact ? "max-w-[85%]" : "max-w-[70%] sm:max-w-[56%]"
        }`}
      >
        {revealed ? (
          <div>
            <p
              className={`font-display font-black uppercase leading-[0.85] tracking-tight text-white ${
                compact ? "text-[clamp(1.1rem,4.5vw,1.5rem)]" : "text-[clamp(1.5rem,3.5vw,2.25rem)]"
              }`}
            >
              Ronaldinho
            </p>
            <p className="tnum mt-3 inline-block bg-white px-3 py-1 font-display text-lg font-extrabold tracking-wide text-ink">
              2006
            </p>
          </div>
        ) : (
          <>
            <p
              className={`font-display font-extrabold uppercase leading-[0.85] tracking-tight text-white ${
                compact ? "text-[clamp(1.1rem,4.5vw,1.5rem)]" : "text-[clamp(1.5rem,3.5vw,2.25rem)]"
              }`}
            >
              Precio
            </p>
            <p
              className={`tnum font-display font-black leading-[0.8] tracking-tighter text-green ${
                compact ? "text-[clamp(1.75rem,9vw,2.75rem)]" : "text-[clamp(2.75rem,7vw,4.5rem)]"
              }`}
            >
              {priceLabel}
            </p>
            <p className="mt-2 font-display text-[clamp(0.85rem,1.4vw,1.1rem)] font-bold uppercase tracking-[0.08em] text-lime">
              Extremo izquierdo
            </p>
          </>
        )}
      </motion.figcaption>
    </figure>
  );
}

/**
 * El hero completo: la tarjeta que alterna sola + el nombre del juego + el
 * CTA. `reducedMotion` decidido UNA vez al montar (no escucha cambios en
 * caliente -- nadie cambia esta preferencia de sistema mientras mira la
 * pagina, y evitar el listener mantiene esto simple).
 */
function Hero({ onCreateClick }: { onCreateClick: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;
  // Mismo valor que el ref de arriba (decidido una vez al montar), pero via
  // el hook de Framer -- whileTap no lee la media query de CSS por su
  // cuenta, hay que apagarlo a mano (mismo patron que BidControls.tsx).
  const reducedMotionGesture = useReducedMotion() ?? false;

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setRevealed((r) => !r), CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-10 sm:pt-16 md:flex-row md:items-center md:gap-12 md:px-6">
      <div className="order-2 md:order-1 md:w-1/2">
        <h1 className="font-display text-[clamp(3rem,10vw,6rem)] font-black uppercase leading-[0.82] tracking-tighter">
          <span className="text-lime">Subasta</span>
          <br />
          <span className="text-white">Futbolera</span>
        </h1>
        <p className="mt-5 max-w-md font-body text-lg text-white">
          Pujáis a ciegas por una silueta. Se revela quién es. Gana quien arme el mejor once.
        </p>
        <motion.button
          type="button"
          onClick={onCreateClick}
          whileTap={reducedMotionGesture ? undefined : { scale: 0.97 }}
          transition={{ duration: 0.1 }}
          className="mt-8 flex h-14 min-w-[220px] cursor-pointer items-center justify-center gap-3 bg-lime px-8 font-display text-2xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
        >
          <UsersIcon />
          Crear sala
        </motion.button>
      </div>

      <div className="order-1 mx-auto w-full max-w-sm md:order-2 md:mx-0 md:w-1/2 md:max-w-none">
        {reducedMotion ? (
          <div className="grid grid-cols-2 gap-3">
            <HeroCard revealed={false} priceLabel="$45M" compact animateCaption={false} />
            <HeroCard revealed priceLabel="$45M" compact animateCaption={false} />
          </div>
        ) : (
          <HeroCard revealed={revealed} priceLabel="$45M" />
        )}
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Pujáis a ciegas",
    body: "Solo veis una silueta y unas pistas: altura, pie, edad, década, origen. El nombre no se sabe hasta que alguien se la lleva.",
  },
  {
    n: "2",
    title: "Se revela quién es",
    body: "La silueta se convierte en la foto real y aparece el nombre, la temporada y el rating de esa campaña exacta.",
  },
  {
    n: "3",
    title: "Gana el mejor once",
    body: "Al final de la partida, quien tenga el mejor jugador en más puestos se lleva la subasta.",
  },
];

/**
 * Bloque 2: tres pasos, MASTER.md S4 -- panel --ink con el mismo bisel que
 * toda la marca, numerados, sin iconos decorativos. Entran en cascada al
 * llegar al scroll (`whileInView`, `once` para no repetir la animacion si
 * el usuario sube y baja) -- `viewport.margin` negativo evita que dispare
 * antes de que la tarjeta sea realmente visible.  Con movimiento reducido
 * la regla global de index.css colapsa la duracion a 0.01ms: el contenido
 * sigue apareciendo, solo que sin cascada perceptible.
 */
function HowToPlay() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20 md:px-6">
      <h2 className="mb-8 font-display text-[clamp(2rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-tight text-white sm:mb-10">
        Cómo se juega
      </h2>
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <motion.li
            key={step.n}
            className="panel bg-ink p-6 pb-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
          >
            <span className="font-display text-5xl font-black leading-none text-lime">{step.n}</span>
            <h3 className="mt-4 font-display text-xl font-extrabold uppercase tracking-wide text-white">
              {step.title}
            </h3>
            <p className="mt-2 font-body text-base text-mute">{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Mini tarjeta del gancho: version reducida de HeroCard sin la alternancia
 * (aqui las dos versiones estan siempre reveladas a la vez, cada una con su
 * propio rating -- el contraste es el punto, no la transformacion).
 */
function HookCard({ season, club, rating }: { season: number; club: string; rating: number }) {
  return (
    <figure className="panel relative aspect-[3/4] w-full overflow-hidden bg-green">
      <div
        aria-hidden
        className="absolute -right-16 top-0 h-full w-2/5 bg-lime"
        style={{ transform: "skewX(-18deg)" }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-deep" />
      <img
        src={heroPhoto}
        alt={`Ronaldinho en ${season}, ${club}`}
        className="absolute -top-4 right-[6%] z-10 h-[112%] w-auto object-contain object-bottom"
      />
      <figcaption className="panel absolute left-0 top-[8%] z-20 max-w-[75%] bg-ink px-4 py-3 pr-8">
        <p className="tnum inline-block bg-white px-2.5 py-1 font-display text-base font-extrabold tracking-wide text-ink">
          {season}
        </p>
        <p className="mt-2 truncate font-body text-sm font-semibold text-mute">{club}</p>
        <p className="tnum mt-1 font-display text-4xl font-black leading-none text-green">{rating}</p>
      </figcaption>
    </figure>
  );
}

/**
 * Bloque 3: el gancho, con el par real que decide `landing.md`. Las dos
 * tarjetas entran desde lados opuestos -- pico desde la izquierda, declive
 * desde la derecha -- para dramatizar el contraste que es el punto del
 * bloque, no solo decorar la entrada.
 */
function Hook() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20 md:px-6">
      <motion.h2
        className="max-w-2xl font-display text-[clamp(2rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-tight text-white"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        Ganaste la subasta.
        <br />
        <span className="text-lime">Ahora descubre cuál te tocó.</span>
      </motion.h2>
      <p className="mt-4 max-w-xl font-body text-lg text-white">
        Mismo jugador, dos temporadas, dos ratings muy distintos. Este es {HOOK_PLAYER.name}.
      </p>
      <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <HookCard {...HOOK_PLAYER.peak} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <HookCard {...HOOK_PLAYER.decline} />
        </motion.div>
      </div>
    </section>
  );
}

/** Bloque 4: el unico formulario de la pagina. Reusa createRoom/joinByCode de useRoom -- misma logica de red que Lobby, sin duplicarla. */
function Enter({ error, onCreate, onJoinByCode, formRef }: Props & { formRef: React.RefObject<HTMLDivElement | null> }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (mode === "create") onCreate(name.trim());
    else if (code.trim()) onJoinByCode(name.trim(), code.trim());
  };

  return (
    <section ref={formRef} className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:pb-24 md:px-6">
      <div className="panel mx-auto max-w-md bg-ink p-6 pb-10 sm:p-8 sm:pb-12">
        <h2 className="mb-6 font-display text-3xl font-black uppercase tracking-tight text-white">Entrar</h2>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div role="tablist" aria-label="Cómo quieres entrar" className="grid grid-cols-2 gap-px bg-white/10">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              onClick={() => setMode("create")}
              className={`h-12 cursor-pointer font-display text-lg font-bold uppercase tracking-wide transition-colors duration-200 ${
                mode === "create" ? "bg-lime text-ink" : "bg-ink text-mute hover:text-white"
              }`}
            >
              Crear sala
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "join"}
              onClick={() => setMode("join")}
              className={`h-12 cursor-pointer font-display text-lg font-bold uppercase tracking-wide transition-colors duration-200 ${
                mode === "join" ? "bg-lime text-ink" : "bg-ink text-mute hover:text-white"
              }`}
            >
              Unirse con código
            </button>
          </div>

          <label className="sr-only" htmlFor="landing-name">
            Tu nombre
          </label>
          <input
            id="landing-name"
            className="h-12 border-2 border-white/20 bg-ink px-3 font-display text-xl font-bold text-white placeholder:text-mute"
            placeholder="Tu nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          {mode === "join" && (
            <>
              <label className="sr-only" htmlFor="landing-code">
                Código de la sala
              </label>
              <input
                id="landing-code"
                className="tnum h-12 border-2 border-white/20 bg-ink px-3 font-display text-xl font-bold uppercase tracking-[0.2em] text-white placeholder:text-mute placeholder:tracking-normal"
                placeholder="Código de 5 letras"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={6}
              />
            </>
          )}

          {error && <p className="font-body text-sm font-semibold text-danger">{error}</p>}

          <button
            type="submit"
            className="h-14 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
          >
            {mode === "create" ? "Crear sala" : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
}

export function Landing({ error, onCreate, onJoinByCode }: Props) {
  const enterRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <Hero onCreateClick={() => enterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <HowToPlay />
      <Hook />
      <Enter error={error} onCreate={onCreate} onJoinByCode={onJoinByCode} formRef={enterRef} />
    </div>
  );
}

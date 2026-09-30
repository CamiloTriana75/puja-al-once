import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Faq } from "../components/Faq.js";
import heroPhoto from "../assets/hero-photo.png";
import heroSilhouette from "../assets/hero-silhouette.png";
import { fetchPublicRooms, type PublicRoomSummary, type RoomVisibility } from "../net/roomLookup.js";

interface Props {
  error: string | null;
  onCreate: (name: string, visibility: RoomVisibility) => void;
  onJoinByCode: (name: string, code: string) => void;
  onJoinPublicRoom: (name: string, roomId: string) => void;
}

function inviteCodeFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/sala\/([a-z0-9]{5})\/?$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

const CYCLE_MS = 4200;

const HOOK_PLAYER = {
  name: "Ronaldinho",
  peak: { season: 2006, club: "FC Barcelona", rating: 94 },
  decline: { season: 2015, club: "Fluminense", rating: 74 },
};

function BallIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 3 2v4l-3 2-3-2V9l3-2ZM9 9l-3-1m9 1 3-1m-9 5-3 2m9-2 3 2m-6-7V3m0 12v6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AuctionStage({
  revealed,
  reducedMotion,
  onReveal,
}: {
  revealed: boolean;
  reducedMotion: boolean;
  onReveal: () => void;
}) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 28, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
      className="relative mx-auto w-full max-w-[39rem]"
    >
      <div aria-hidden="true" className="absolute -inset-x-8 -inset-y-5 -z-10 bg-lime/10 blur-3xl" />
      <div className="panel relative isolate min-h-[30rem] overflow-hidden border border-white/10 bg-ink sm:min-h-[35rem]">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(150deg,#17231c_0%,#12100f_56%,#0b3d2e_100%)]" />
        <svg viewBox="0 0 640 760" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-35" aria-hidden="true">
          <path d="M70 760V390a250 250 0 0 1 500 0v370M125 760V390a195 195 0 0 1 390 0v370M180 760V390a140 140 0 0 1 280 0v370M235 760V390a85 85 0 0 1 170 0v370M320 0v760M0 500h640M0 620h640" fill="none" stroke="#C6F833" strokeOpacity=".22" strokeWidth="2" />
        </svg>
        <motion.div
          aria-hidden="true"
          animate={reducedMotion ? undefined : { rotate: [0, 5, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-24 top-12 h-56 w-56 bg-green/20 blur-3xl sm:h-72 sm:w-72"
        />

        <div className="relative z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            <p className="font-display text-xs font-black uppercase tracking-[0.2em] text-lime">Mercado de leyendas</p>
            <p className="mt-1 font-display text-sm font-bold uppercase tracking-[0.12em] text-white/60">La carta cambia. Tu puja queda.</p>
          </div>
          <span className="flex shrink-0 items-center gap-2 border border-white/15 bg-black/35 px-3 py-2 font-display text-xs font-black uppercase tracking-[0.14em] text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
            </span>
            Demostración
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 top-16 z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={revealed ? "revealed-player" : "hidden-player"}
              src={revealed ? heroPhoto : heroSilhouette}
              alt={revealed ? "Retrato ilustrativo de Ronaldinho en el estado revelado de la carta" : "Silueta de un jugador antes de revelar su identidad"}
              // Esta es la imagen LCP de la portada: sin `width`/`height` el
              // navegador no reserva su hueco y el texto da un salto al
              // cargar (CLS), y sin `decoding`/`fetchPriority` la decodifica
              // en el camino critico en vez de en paralelo. El tamano es el
              // real del PNG (365x512), declarado aqui para que siga siendo
              // verdad si el asset se cambia: el test de seo lo comprueba.
              width={365}
              height={512}
              decoding="async"
              fetchPriority="high"
              initial={reducedMotion ? false : { opacity: 0, scale: revealed ? 1.04 : 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: revealed ? 0.98 : 1.02, y: -8 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute bottom-0 left-1/2 h-[88%] max-w-none -translate-x-1/2 object-contain object-bottom sm:h-[94%] ${revealed ? "w-auto" : "w-[72%] brightness-0 invert"}`}
            />
          </AnimatePresence>
        </div>

        <motion.div
          aria-hidden="true"
          animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-4 top-[38%] z-20 hidden -rotate-6 border border-lime/50 bg-ink/90 px-4 py-3 sm:block"
        >
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-mute">Tú ves</p>
          <p className="font-display text-lg font-black uppercase text-white">Una silueta</p>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pb-5 pt-24 sm:px-7 sm:pb-7">
          <div className="flex items-end justify-between gap-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={revealed ? "revealed-copy" : "hidden-copy"}
                initial={reducedMotion ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: 12 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="min-w-0"
              >
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-lime">
                  {revealed ? "Identidad revelada" : "Lote de ejemplo · Extremo"}
                </p>
                <h2 className="mt-1 truncate font-display text-[clamp(2rem,7vw,3.6rem)] font-black uppercase leading-[0.86] tracking-tight text-white">
                  {revealed ? "Ronaldinho" : "¿Quién será?"}
                </h2>
                <p className="mt-2 font-body text-sm font-semibold text-white/60">
                  {revealed ? "FC Barcelona · Temporada 2006" : "La temporada también cuenta."}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="shrink-0 border-l border-white/20 pl-4 text-right sm:pl-6">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-mute">
                {revealed ? "Rating" : "Puja"}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={revealed ? "rating" : "price"}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="tnum font-display text-4xl font-black leading-none text-lime sm:text-5xl"
                >
                  {revealed ? "94" : "45M"}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <button
            type="button"
            onClick={onReveal}
            aria-pressed={revealed}
            className="mt-5 flex min-h-11 w-full cursor-pointer items-center justify-between border border-white/20 bg-white/[0.06] px-4 font-display text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-lime hover:bg-lime hover:text-ink"
          >
            <span>{revealed ? "Volver a ocultar" : "Revelar jugador"}</span>
            <span className={`transition-transform ${revealed ? "rotate-180" : ""}`}><DownIcon /></span>
          </button>
        </div>
      </div>
      <div aria-hidden="true" className="absolute -bottom-3 right-5 h-1.5 w-2/3 -skew-x-[35deg] bg-lime sm:right-10" />
    </motion.div>
  );
}

function Hero({ onCreateClick, inviteCode }: { onCreateClick: () => void; inviteCode: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [manualReveal, setManualReveal] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (reducedMotion || manualReveal) return;
    const id = window.setInterval(() => setRevealed((current) => !current), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [manualReveal, reducedMotion]);

  const toggleReveal = () => {
    setManualReveal(true);
    setRevealed((current) => !current);
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-deep">
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: "linear-gradient(115deg, transparent 0 46%, rgba(198,248,51,.12) 46.1% 46.4%, transparent 46.5%), repeating-linear-gradient(115deg, transparent 0 58px, rgba(255,255,255,.035) 59px 60px)" }} />
      <div aria-hidden="true" className="absolute -left-48 top-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-green/15 blur-[110px]" />

      <header className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-12">
        <a href="#inicio" aria-label="Futbolera, inicio" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center bg-lime text-ink transition-transform group-hover:-rotate-12">
            <BallIcon />
          </span>
          <span className="font-display text-sm font-black uppercase leading-[0.9] tracking-[0.12em] text-white sm:text-base">
            Futbolera<span className="block text-lime">Club de amigos</span>
          </span>
        </a>
        <nav aria-label="Navegación principal" className="flex items-center gap-3 sm:gap-7">
          <a href="#como-se-juega" className="hidden font-display text-xs font-bold uppercase tracking-[0.14em] text-white/65 transition-colors hover:text-lime sm:block">La jugada</a>
          <button
            type="button"
            onClick={onCreateClick}
            className="flex min-h-11 cursor-pointer items-center gap-2 border border-white/25 px-3 font-display text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-lime hover:text-lime sm:px-4"
          >
            {inviteCode ? "Unirme" : "Entrar al mercado"}
            <ArrowIcon />
          </button>
        </nav>
      </header>

      <div id="inicio" className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 pb-14 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-12 lg:pb-24 lg:pt-10">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 order-1"
        >
          <p className="mb-5 flex items-center gap-3 font-display text-xs font-black uppercase tracking-[0.2em] text-lime sm:text-sm">
            <span className="h-px w-8 bg-lime" />
            {inviteCode ? `Invitación · ${inviteCode}` : "La subasta para los que saben de fútbol"}
          </p>
          <h1 className="max-w-3xl font-display text-[clamp(3.6rem,10vw,8.4rem)] font-black uppercase leading-[0.76] tracking-[-0.055em] text-white">
            PUJA
            <span className="block text-lime">A CIEGAS.</span>
            <span className="block">ARMA</span>
            <span className="block">LA LEYENDA.</span>
          </h1>
          <p className="mt-7 max-w-lg font-body text-lg leading-relaxed text-white/75 sm:text-xl">
            El nombre está oculto. La puja está abierta. Cuando cae la silueta, empiezan los reclamos del grupo.
          </p>
          {inviteCode && (
            <p className="mt-5 inline-flex items-center gap-2 border-l-4 border-lime bg-ink px-3 py-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-white">
              Sala lista para ti <span className="tnum text-lime">{inviteCode}</span>
            </p>
          )}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <motion.button
              type="button"
              onClick={onCreateClick}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              className="group flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 bg-lime px-6 font-display text-lg font-black uppercase tracking-[0.08em] text-ink transition-colors hover:bg-white sm:w-auto sm:px-8 sm:text-xl"
            >
              {inviteCode ? "Jugar con mis amigos" : "Crear una subasta"}
              <ArrowIcon />
            </motion.button>
            <a href="#como-se-juega" className="inline-flex min-h-11 items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-white/65 transition-colors hover:text-lime">
              Ver la jugada <DownIcon />
            </a>
          </div>
          <p className="mt-6 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Fútbol · intuición · piques que duran toda la semana</p>
        </motion.div>

        <div className="order-2 lg:pl-2">
          <AuctionStage revealed={revealed} reducedMotion={reducedMotion} onReveal={toggleReveal} />
        </div>
      </div>

      <Ticker reducedMotion={reducedMotion} />
    </section>
  );
}

function Ticker({ reducedMotion }: { reducedMotion: boolean }) {
  const items = ["LEE LA PISTA", "LANZA LA PUJA", "REVELA LA CARTA", "PRESUME ESE ONCE"];
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-ink/25 bg-lime py-3 text-ink">
      <motion.div
        animate={reducedMotion ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 24, ease: "linear", repeat: Infinity }}
        className="flex w-max items-center gap-6 whitespace-nowrap"
      >
        {[...items, ...items, ...items, ...items].map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-6 font-display text-sm font-black uppercase tracking-[0.18em] sm:text-base">
            {item}<BallIcon className="h-4 w-4" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    marker: "OBSERVA",
    title: "Lee entre líneas",
    body: "Te damos pistas de la carta. La identidad sigue en secreto; tus amigos también están calculando.",
  },
  {
    n: "02",
    marker: "ARRIESGA",
    title: "Puja por el lote",
    body: "Decide cuánto vale esa silueta para tu equipo y compite por quedártela.",
  },
  {
    n: "03",
    marker: "DESCUBRE",
    title: "Arma tu once",
    body: "Se revela el jugador y su temporada exacta. Al final, el marcador decide quién fichó mejor.",
  },
];

function HowToPlay() {
  const reducedMotion = useReducedMotion() ?? false;
  return (
    <section id="como-se-juega" className="relative overflow-hidden bg-[#101713] px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
      <div aria-hidden="true" className="absolute -right-36 top-16 h-80 w-80 border border-lime/10" />
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end"
        >
          <div>
            <p className="font-display text-xs font-black uppercase tracking-[0.2em] text-lime">La táctica en tres actos</p>
            <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.8rem,7vw,6rem)] font-black uppercase leading-[0.82] tracking-tight text-white">
              DEL PRIMER PALO<br /><span className="text-lime">AL GRITO DE GOL.</span>
            </h2>
          </div>
          <p className="max-w-sm font-body text-base leading-relaxed text-white/55 sm:pb-1 sm:text-lg">Cada puja es una corazonada. Cada revelación puede cambiar quién se ríe al final.</p>
        </motion.div>

        <ol className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.n}
              initial={reducedMotion ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: reducedMotion ? 0 : index * 0.12 }}
              className="group relative min-h-64 overflow-hidden bg-ink p-6 sm:p-8"
            >
              <span aria-hidden="true" className="absolute -right-1 -top-8 font-display text-[10rem] font-black leading-none text-white/[0.035] transition-colors group-hover:text-lime/[0.08]">{step.n}</span>
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="font-display text-xs font-black uppercase tracking-[0.2em] text-lime">{step.marker}</span>
                  <span className="font-display text-sm font-black text-white/35">FASE {step.n}</span>
                </div>
                <h3 className="mt-8 font-display text-3xl font-black uppercase leading-[0.9] text-white sm:text-4xl">{step.title}</h3>
                <p className="mt-4 max-w-sm font-body text-base leading-relaxed text-white/60">{step.body}</p>
              </div>
              <motion.div
                aria-hidden="true"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: reducedMotion ? 0 : index * 0.12 + 0.15 }}
                className="absolute bottom-0 left-0 h-1 w-full origin-left bg-lime"
              />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HookCard({ season, club, rating, featured }: { season: number; club: string; rating: number; featured?: boolean }) {
  return (
    <figure className={`panel relative isolate aspect-[4/5] overflow-hidden ${featured ? "bg-green" : "bg-[#26352c]"}`}>
      <div aria-hidden="true" className="absolute -right-14 top-0 h-full w-2/5 -skew-x-[18deg] bg-lime/80" />
      <img
        src={heroPhoto}
        alt="Retrato ilustrativo de Ronaldinho"
        // Este bloque esta por debajo del fold (despues del heroe y de las
        // instructions), asi que `lazy` aqui es lo correcto: lo que no se
        // descarga es lo que no compite por el ancho de banda con el LCP.
        width={365}
        height={512}
        loading="lazy"
        decoding="async"
        className={`absolute -bottom-1 left-1/2 z-10 h-[94%] max-w-none -translate-x-1/2 object-contain object-bottom ${featured ? "" : "brightness-[.72] saturate-[.72]"}`}
      />
      <figcaption className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pb-4 pt-20 sm:px-6 sm:pb-6">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-lime">Temporada</p>
            <p className="tnum font-display text-3xl font-black text-white sm:text-4xl">{season}</p>
            <p className="mt-1 font-body text-xs font-semibold text-white/60 sm:text-sm">{club}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Rating</p>
            <p className={`tnum font-display text-6xl font-black leading-none sm:text-7xl ${featured ? "text-lime" : "text-white"}`}>{rating}</p>
          </div>
        </div>
      </figcaption>
      <span className="absolute left-3 top-3 z-20 bg-ink px-2 py-1 font-display text-[10px] font-black uppercase tracking-[0.16em] text-white sm:left-5 sm:top-5 sm:text-xs">
        {featured ? "Pico de carrera" : "Otra temporada"}
      </span>
    </figure>
  );
}

function Hook() {
  const reducedMotion = useReducedMotion() ?? false;
  return (
    <section className="overflow-hidden bg-lime px-4 py-20 text-ink sm:px-8 sm:py-28 lg:px-12">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
        >
          <p className="font-display text-xs font-black uppercase tracking-[0.2em] text-deep">La temporada lo cambia todo</p>
          <h2 className="mt-4 font-display text-[clamp(3rem,7vw,6rem)] font-black uppercase leading-[0.78] tracking-tight">
            MISMO 10.<br />
            <span className="text-deep">OTRA HISTORIA.</span>
          </h2>
          <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-ink/75">
            Una carta puede ser una leyenda o una apuesta arriesgada. Ronaldinho tuvo un 94 y también un 74. ¿Qué temporada crees que acabas de fichar?
          </p>
          <div className="mt-7 inline-flex items-center gap-3 border-l-4 border-ink bg-white/45 px-4 py-3">
            <span className="font-display text-3xl font-black">−20</span>
            <span className="max-w-32 font-display text-[10px] font-black uppercase leading-tight tracking-[0.14em]">puntos entre temporadas</span>
          </div>
        </motion.div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 26, rotate: -2 }}
            whileInView={{ opacity: 1, y: 0, rotate: -1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="pt-8 sm:pt-12"
          >
            <HookCard {...HOOK_PLAYER.peak} featured />
          </motion.div>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 26, rotate: 2 }}
            whileInView={{ opacity: 1, y: 0, rotate: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="-mt-4 sm:-mt-8"
          >
            <HookCard {...HOOK_PLAYER.decline} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Enter({ error, onCreate, onJoinByCode, onJoinPublicRoom, formRef, initialCode }: Props & {
  formRef: React.RefObject<HTMLElement | null>;
  initialCode: string | null;
}) {
  const [mode, setMode] = useState<"create" | "join">(() => initialCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>("private");
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      if (initial) setRoomsLoading(true);
      try {
        const rooms = await fetchPublicRooms();
        if (!active) return;
        setPublicRooms(rooms);
        setRoomsError(null);
      } catch {
        if (active) setRoomsError("No se pudo cargar el vestuario. Puedes reintentarlo.");
      } finally {
        if (active && initial) setRoomsLoading(false);
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (error) {
      setSubmitting(false);
      setJoiningRoomId(null);
    }
  }, [error]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (mode === "join" && code.trim().length !== 5) || submitting) return;
    setSubmitting(true);
    if (mode === "create") onCreate(name.trim(), visibility);
    else onJoinByCode(name.trim(), code.trim().toUpperCase());
  };

  return (
    <section id="entrar" ref={formRef} className="relative isolate overflow-hidden bg-deep px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
      <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-1/2 skew-x-[-18deg] bg-green/10" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
        <div>
          <p className="font-display text-xs font-black uppercase tracking-[0.2em] text-lime">El vestuario te espera</p>
          <h2 className="mt-4 max-w-2xl font-display text-[clamp(3.2rem,7vw,6.5rem)] font-black uppercase leading-[0.78] tracking-tight text-white">
            HABLA CON<br /><span className="text-lime">EL MERCADO.</span>
          </h2>
          <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-white/65">Abre una sala, manda la invitación y que gane quien mejor conoce el fútbol.</p>
          <div className="mt-8 hidden items-center gap-3 border-t border-white/15 pt-5 sm:flex">
            <BallIcon className="h-6 w-6 text-lime" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.16em] text-white/45">La próxima discusión empieza aquí</span>
          </div>
        </div>

        <div className="panel bg-ink p-5 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-lime">{initialCode ? "Invitación recibida" : "Inscripción al mercado"}</p>
              <h3 className="mt-2 font-display text-3xl font-black uppercase leading-none text-white sm:text-4xl">
                {initialCode ? "Tu sala te espera" : "¿Quién ficha hoy?"}
              </h3>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 text-lime"><ArrowIcon /></span>
          </div>
          {initialCode && (
            <p className="mb-5 border-l-4 border-lime bg-white/5 px-3 py-3 font-body text-sm text-white/75">
              Sala <span className="tnum font-bold text-lime">{initialCode}</span> lista. Escribe tu nombre para entrar.
            </p>
          )}

          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div role="group" aria-label="Elige crear o unirte a una sala" className="grid grid-cols-2 border border-white/15 p-1">
              <button
                type="button"
                aria-pressed={mode === "create"}
                onClick={() => setMode("create")}
                className={`min-h-11 cursor-pointer font-display text-xs font-black uppercase tracking-[0.1em] transition-colors sm:text-sm ${mode === "create" ? "bg-lime text-ink" : "text-white/55 hover:text-white"}`}
              >
                Crear sala
              </button>
              <button
                type="button"
                aria-pressed={mode === "join"}
                onClick={() => setMode("join")}
                className={`min-h-11 cursor-pointer font-display text-xs font-black uppercase tracking-[0.1em] transition-colors sm:text-sm ${mode === "join" ? "bg-lime text-ink" : "text-white/55 hover:text-white"}`}
              >
                Unirme con código
              </button>
            </div>

            {mode === "create" && (
              <fieldset className="border border-white/15 p-3">
                <legend className="px-1 font-display text-xs font-bold uppercase tracking-[0.14em] text-white/65">Visibilidad</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={visibility === "private"}
                    onClick={() => setVisibility("private")}
                    className={`min-h-10 border px-2 font-display text-xs font-bold uppercase tracking-wide ${visibility === "private" ? "border-lime bg-lime text-ink" : "border-white/15 text-white/65 hover:text-white"}`}
                  >
                    Privada
                  </button>
                  <button
                    type="button"
                    aria-pressed={visibility === "public"}
                    onClick={() => setVisibility("public")}
                    className={`min-h-10 border px-2 font-display text-xs font-bold uppercase tracking-wide ${visibility === "public" ? "border-lime bg-lime text-ink" : "border-white/15 text-white/65 hover:text-white"}`}
                  >
                    Pública · probar
                  </button>
                </div>
                <p className="mt-2 font-body text-xs leading-relaxed text-white/50">
                  {visibility === "public"
                    ? "Aparecerá en el vestuario mientras siga en espera y tenga cupo."
                    : "Solo entran quienes tengan el código o la invitación."}
                </p>
              </fieldset>
            )}

            <label className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white/65" htmlFor="landing-name">Tu nombre en el vestuario</label>
            <input
              id="landing-name"
              className="h-12 border border-white/20 bg-white/[0.04] px-3 font-display text-xl font-bold text-white placeholder:text-white/35 focus:border-lime"
              placeholder="Cómo te llamamos"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="nickname"
              maxLength={18}
              required
            />

            {mode === "join" && (
              <>
                <label className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white/65" htmlFor="landing-code">Código de la sala</label>
                <input
                  id="landing-code"
                  className="tnum h-12 border border-white/20 bg-white/[0.04] px-3 font-display text-xl font-bold uppercase tracking-[0.2em] text-white placeholder:text-white/35 focus:border-lime"
                  placeholder="Ejemplo: A7K2M"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={5}
                  minLength={5}
                  pattern="[2-9A-HJKMNP-Z]{5}"
                  autoComplete="off"
                  required
                />
              </>
            )}

            {error && <p role="alert" className="border-l-4 border-danger bg-danger/10 px-3 py-2 font-body text-sm font-semibold text-white">{error}</p>}

            <motion.button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              whileTap={submitting ? undefined : { scale: 0.985 }}
              className="group mt-1 flex min-h-14 cursor-pointer items-center justify-between bg-lime px-5 font-display text-lg font-black uppercase tracking-[0.08em] text-ink transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70 sm:px-6 sm:text-xl"
            >
              <span>{submitting ? "Entrando al mercado…" : mode === "create" ? "Crear mi sala" : "Unirme a la partida"}</span>
              <ArrowIcon />
            </motion.button>
          </form>

          <section aria-labelledby="public-rooms-title" className="mt-7 border-t border-white/10 pt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-lime">Para probar en grupo</p>
                <h4 id="public-rooms-title" className="mt-1 font-display text-xl font-black uppercase text-white">Vestuario público</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRoomsLoading(true);
                  void fetchPublicRooms().then((rooms) => {
                    setPublicRooms(rooms);
                    setRoomsError(null);
                  }).catch(() => setRoomsError("No se pudo cargar el vestuario. Puedes reintentarlo.")).finally(() => setRoomsLoading(false));
                }}
                className="min-h-10 cursor-pointer border border-white/20 px-3 font-display text-[10px] font-bold uppercase tracking-wider text-white/65 hover:border-lime hover:text-lime"
              >
                Actualizar
              </button>
            </div>
            {roomsLoading ? (
              <p className="bg-white/[0.04] px-3 py-3 font-body text-sm text-white/55" role="status">Buscando salas abiertas…</p>
            ) : roomsError ? (
              <p className="bg-white/[0.04] px-3 py-3 font-body text-sm text-white/65" role="status">{roomsError}</p>
            ) : publicRooms.length === 0 ? (
              <p className="bg-white/[0.04] px-3 py-3 font-body text-sm text-white/55" role="status">No hay salas abiertas ahora. Crea una pública para invitar a otros.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {publicRooms.map((room) => (
                  <li key={room.roomId}>
                    <button
                      type="button"
                      disabled={!name.trim() || joiningRoomId !== null}
                      onClick={() => {
                        setJoiningRoomId(room.roomId);
                        onJoinPublicRoom(name.trim(), room.roomId);
                      }}
                      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border border-white/10 bg-white/[0.04] px-3 text-left transition-colors hover:border-lime/60 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span>
                        <span className="block font-display text-sm font-bold uppercase text-white">Sala {room.code}</span>
                        <span className="block font-body text-xs text-white/50">{room.players}/{room.capacity} jugadores · {room.ready} listos</span>
                      </span>
                      <span className="font-display text-[10px] font-black uppercase tracking-wider text-lime">
                        {joiningRoomId === room.roomId ? "Entrando…" : "Entrar"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!name.trim() && !roomsLoading && publicRooms.length > 0 && (
              <p className="mt-2 font-body text-xs text-white/45">Escribe tu nombre para entrar a una sala.</p>
            )}
            <p className="mt-2 font-body text-[11px] text-white/35">El listado se actualiza automáticamente cada 10 segundos.</p>
          </section>
        </div>
      </div>
    </section>
  );
}

export function Landing({ error, onCreate, onJoinByCode, onJoinPublicRoom }: Props) {
  const enterRef = useRef<HTMLElement>(null);
  const inviteCode = inviteCodeFromPath();
  const reducedMotion = useReducedMotion() ?? false;
  const scrollToEntry = () => enterRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });

  return (
    <div className="overflow-hidden bg-deep text-white">
      <Hero inviteCode={inviteCode} onCreateClick={scrollToEntry} />
      <HowToPlay />
      <Hook />
      <Faq />
      <Enter error={error} onCreate={onCreate} onJoinByCode={onJoinByCode} onJoinPublicRoom={onJoinPublicRoom} formRef={enterRef} initialCode={inviteCode} />
      <LegalFooter />
    </div>
  );
}

/**
 * Pie de la portada con las paginas legales y de comunidad. Un "footer de
 * verdad" (toda pagina publica enlaza las mismas paginas, incluidas las
 * legales en public/legal/) -- el pie anterior solo tenia Actualizaciones,
 * y en una aplicacion que promete en su politica de privacidad "sin
 * cookies, sin rastreo" conviene poder llegar a esa promesa sin descifrar
 * la URL. Cada enlace es un objetivo tactil completo (min-h-11) con focus
 * visible: la jerarquia visual del cierre es mas importante que el peso de
 * cada pagina concreta.
 */
function LegalFooter() {
  const links = [
    { href: "/actualizaciones.html", label: "Actualizaciones" },
    { href: "/legal/creditos.html", label: "Créditos" },
    { href: "/legal/terminos.html", label: "Términos" },
    { href: "/legal/privacidad.html", label: "Privacidad" },
    { href: "/legal/cookies.html", label: "Cookies" },
    { href: "/legal/propiedad-intelectual.html", label: "Propiedad intelectual" },
    { href: "/legal/contacto.html", label: "Contacto" },
    { href: "/legal/comunidad.html", label: "Comunidad" },
  ];
  return (
    <footer className="border-t border-white/10 bg-ink px-4 py-5 text-center sm:px-8">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Futbolera · Para el grupo que nunca se pone de acuerdo</p>
      <nav aria-label="Páginas informativas" className="mt-2">
        <ul className="flex flex-wrap items-center justify-center gap-x-4">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-display inline-flex min-h-11 cursor-pointer items-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}

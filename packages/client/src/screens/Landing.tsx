import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { Globe, Lock, Pause, Play, Users } from "lucide-react";
import { useRef, useState, useEffect, type ReactNode } from "react";
import heroPhoto from "../assets/hero-photo.png";
import heroSilhouette from "../assets/hero-silhouette.png";
import { Faq } from "../components/Faq.js";
import type { RoomVisibility } from "../net/roomLookup.js";
import { Wordmark } from "../components/Brand.js";
import { CtaBand } from "./landing/CtaBand.js";
import { LaptopFrame, PhoneFrame } from "./landing/DeviceFrames.js";
import { EnterSection } from "./landing/EnterSection.js";
import { Features } from "./landing/Features.js";
import { scrollToSection, useResetScrollOnLeave, useOnScreen, usePageVisible, useSmoothScroll } from "./landing/hooks.js";
import { Numbers } from "./landing/Numbers.js";
import { RoundLoop } from "./landing/RoundLoop.js";
import { Seasons } from "./landing/Seasons.js";
import { SiteFooter } from "./landing/SiteFooter.js";
import { CONTAINER, EASE_OUT, PillButton, SectionTitle } from "./landing/ui.js";

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

// ---------------------------------------------------------------------------
// Demostración del hero: una puja real de la baraja (Ronaldinho 2006, rating
// 94, sale a 90 M por su tramo, sube de 10 en 10) reproducida en bucle.
// ---------------------------------------------------------------------------

type DemoStep = "clues" | "ana" | "beto" | "tu" | "sold" | "reveal";

const TIMELINE: { step: DemoStep; ms: number }[] = [
  { step: "clues", ms: 1900 },
  { step: "ana", ms: 1100 },
  { step: "beto", ms: 1100 },
  { step: "tu", ms: 1300 },
  { step: "sold", ms: 1400 },
  { step: "reveal", ms: 3800 },
];

const OPENING_PRICE = 90;
const BIDS = [
  { who: "Ana", amount: 90 },
  { who: "Beto", amount: 100 },
  { who: "Tú", amount: 110 },
];
const CLUES: [string, string][] = [
  ["Altura", "182 cm"],
  ["Pie", "Diestro"],
  ["Origen", "Sudamérica"],
  ["Década", "2000s"],
];
const TABLE = [
  { name: "Ana", budget: 540 },
  { name: "Beto", budget: 610 },
  { name: "Caro", budget: 480 },
  { name: "Tú", budget: 575 },
];

interface DemoView {
  step: DemoStep;
  history: { who: string; amount: number }[];
  price: number;
  leader: string | null;
  sold: boolean;
  revealed: boolean;
  clock: string;
}

function viewFor(step: DemoStep): DemoView {
  const shown = step === "clues" ? 0 : step === "ana" ? 1 : step === "beto" ? 2 : 3;
  const history = BIDS.slice(0, shown);
  const last = history[history.length - 1];
  const sold = step === "sold" || step === "reveal";
  return {
    step,
    history,
    price: last?.amount ?? OPENING_PRICE,
    leader: last?.who ?? null,
    sold,
    revealed: step === "reveal",
    clock: step === "clues" ? "0:25" : sold ? "0:00" : "0:10",
  };
}

/** La silueta es la imagen LCP de la portada: tamaño real declarado y prioridad alta. */
function HeroCardMedia({ revealed, animate }: { revealed: boolean; animate: boolean }) {
  return (
    <>
      <motion.img
        src={heroSilhouette}
        alt=""
        width={365}
        height={512}
        fetchPriority="high"
        decoding="async"
        initial={false}
        animate={{ opacity: revealed ? 0 : 1 }}
        transition={{ duration: animate ? 0.5 : 0, ease: EASE_OUT }}
        className="absolute -top-[5%] right-[4%] z-10 h-[108%] w-auto max-w-none object-contain object-bottom brightness-0 invert"
      />
      <motion.img
        src={heroPhoto}
        alt="Retrato ilustrativo de Ronaldinho"
        width={365}
        height={512}
        decoding="async"
        initial={false}
        animate={{ opacity: revealed ? 1 : 0, scale: revealed ? 1 : 1.05 }}
        transition={{ duration: animate ? 0.6 : 0, ease: EASE_OUT }}
        className="absolute -top-[5%] right-[3%] z-10 h-[108%] w-auto max-w-none object-contain object-bottom"
      />
    </>
  );
}

/** Pantalla de puja tal como se ve en el juego: reloj de cierre, cromo, pistas y pujas rápidas. */
function GamePhoneScreen({ view, media, animate }: { view: DemoView; media: ReactNode; animate: boolean }) {
  const nextBid = view.leader ? view.price + 10 : OPENING_PRICE;
  return (
    <div className="absolute inset-0 flex flex-col gap-2 bg-canvas px-2.5 pb-2.5 pt-9 font-copy text-forest">
      <div className="flex items-center justify-between rounded-xl bg-forest px-3 py-2 text-white">
        <span className="text-[0.62rem] text-white/80">{view.sold ? "Cae el martillo" : view.leader ? "Cierra en" : "Abre la puja"}</span>
        <span className={`tnum font-headline text-[1.15rem] font-bold leading-none tracking-[-0.05em] ${view.sold ? "text-gold" : "text-white"}`}>
          {view.sold ? "Vendida" : view.clock}
        </span>
      </div>

      <div className="rounded-[1rem] bg-white p-1 shadow-sm ring-1 ring-line">
        <div className="lot-field relative aspect-[5/5.4] w-full overflow-hidden rounded-[0.8rem]">
          <div className="absolute -right-[18%] top-0 h-full w-[42%] -skew-x-[18deg] bg-gold" />
          <div className="absolute inset-x-0 bottom-0 h-[24%] bg-forest" />
          {media}
          <div className="absolute left-1.5 top-1.5 z-20 rounded-lg bg-forest/92 px-2 py-1.5 text-white">
            <AnimatePresence mode="wait" initial={false}>
              {view.revealed ? (
                <motion.div
                  key="revealed"
                  initial={animate ? { opacity: 0, x: -10 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={animate ? { opacity: 0 } : undefined}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: animate ? 0.15 : 0 }}
                >
                  <p className="font-headline text-[0.78rem] font-bold leading-tight tracking-[-0.03em]">Ronaldinho</p>
                  <p className="text-[0.55rem] text-white/80">FC Barcelona <span className="font-semibold text-gold">2006</span></p>
                </motion.div>
              ) : (
                <motion.div key="price" initial={false} animate={{ opacity: 1 }} exit={animate ? { opacity: 0 } : undefined}>
                  <motion.p
                    key={view.price}
                    initial={animate ? { y: 6, opacity: 0 } : false}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="tnum font-headline text-[1rem] font-bold leading-none tracking-[-0.04em] text-gold"
                  >
                    {view.price} M
                  </motion.p>
                  <p className="mt-0.5 text-[0.55rem] text-white/85">Mediapunta</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {view.step === "sold" && (
              <motion.p
                key="sold"
                initial={animate ? { opacity: 0, scale: 1.3, rotate: -12 } : false}
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                exit={animate ? { opacity: 0 } : undefined}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="absolute inset-x-3 bottom-[30%] z-30 rounded-full bg-gold px-2 py-1 text-center font-headline text-[0.62rem] font-semibold text-forest shadow-lg"
              >
                Adjudicada por 110 M
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-1">
        {CLUES.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white px-2 py-1 ring-1 ring-line">
            <dt className="text-[0.5rem] text-slate">{label}</dt>
            <dd className="font-headline text-[0.62rem] font-semibold tracking-[-0.02em]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto rounded-xl bg-white p-2 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <span className="text-[0.55rem] text-slate">{view.sold ? "Se la lleva" : view.leader ? "Va ganando" : "Precio de salida"}</span>
          <span className="rounded-full bg-gold px-2 py-0.5 text-[0.55rem] font-semibold">{view.leader ?? `${OPENING_PRICE} M`}</span>
        </div>
        <motion.div
          animate={animate && view.step === "tu" ? { scale: [1, 0.92, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
          className={`mt-1.5 rounded-lg py-1.5 text-center font-headline text-[0.62rem] font-semibold ${view.sold ? "bg-line text-slate" : "bg-pitch text-white"}`}
        >
          {view.sold ? "Cerrada" : `Mínimo ${nextBid} M`}
        </motion.div>
      </div>
    </div>
  );
}

// El móvil tapa el borde izquierdo del portátil: ahí va el historial, que el
// móvil ya resume; la mesa con los cuatro jugadores queda siempre a la vista.
function LaptopScreen({ view }: { view: DemoView }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-canvas font-copy text-forest">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-headline text-[0.72rem] font-bold tracking-[-0.03em]">Futbolera</span>
        <span className="text-[0.6rem] font-semibold">8/11 Mediapunta</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[0.55rem] ring-1 ring-line">Sala A7K2M</span>
      </div>
      <div className="grid flex-1 grid-cols-[1fr_1.5fr] gap-3 p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[0.55rem] text-slate">Últimas pujas</p>
          {view.history.length === 0 && <p className="rounded-md bg-white px-2 py-1 text-[0.6rem] text-slate">Salida: {OPENING_PRICE} M</p>}
          {[...view.history].reverse().map((bid) => (
            <p key={bid.who} className="flex justify-between rounded-md bg-white px-2 py-1 text-[0.62rem] ring-1 ring-line">
              <span>{bid.who}</span>
              <span className="tnum font-semibold">{bid.amount} M</span>
            </p>
          ))}
          <p className={`mt-auto rounded-md px-2 py-1 text-[0.6rem] font-semibold ${view.revealed ? "bg-gold" : "bg-white text-slate ring-1 ring-line"}`}>
            {view.revealed ? "Ronaldinho 2006 entra en tu once" : view.sold ? "Martillo. Revelando…" : "El reloj sigue corriendo"}
          </p>
        </div>
        <ul className="flex min-w-0 flex-col gap-1.5">
          {TABLE.map((player) => {
            const won = view.sold && player.name === "Tú";
            const leading = !view.sold && view.leader === player.name;
            const hot = won || leading;
            const filled = won ? 8 : 7;
            return (
              <li key={player.name} className={`rounded-lg px-2.5 py-1.5 transition-colors duration-300 ${hot ? "bg-gold" : "bg-white ring-1 ring-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[0.66rem] font-semibold">{player.name}</span>
                  {hot && <span className="rounded-full bg-forest px-1.5 text-[0.5rem] font-semibold text-gold">{won ? "Se la lleva" : "Va ganando"}</span>}
                </div>
                <div className="mt-0.5 flex items-end justify-between">
                  <span className="tnum font-headline text-[0.72rem] font-semibold">{won ? player.budget - 110 : player.budget} M</span>
                  <span className="flex gap-[2px]">
                    {Array.from({ length: 11 }, (_, index) => (
                      <span key={index} className={`h-1.5 w-1 rounded-full ${index < filled ? (hot ? "bg-forest" : "bg-pitch") : hot ? "bg-forest/20" : "bg-line"}`} />
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-2 bg-forest px-2 py-1 text-[0.55rem] text-white">
        <span className="rounded bg-gold px-1.5 font-semibold text-forest">Última hora</span>
        <span className="truncate">{view.leader ? `${view.leader} puja ${view.price} M` : "Sale Mediapunta: 90 M de salida"}</span>
      </div>
    </div>
  );
}

function DemoControl({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <div className="mt-6 flex justify-center lg:absolute lg:bottom-1 lg:right-0 lg:mt-0">
      <div className="inline-flex items-center gap-3 rounded-full bg-white py-1 pl-4 pr-1 shadow-[0_12px_30px_-18px_rgba(4,23,38,.5)] ring-1 ring-line">
        <span className="flex items-center gap-2 font-copy text-[0.98rem] font-medium text-forest">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${paused ? "bg-slate/50" : "bg-pitch"}`} />
          {paused ? "Demostración en pausa" : "Demostración"}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={paused ? "Reanudar la demostración" : "Pausar la demostración"}
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-forest text-white transition-colors duration-200 hover:bg-pine"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function HeroDemo({ reduced }: { reduced: boolean }) {
  const stageRef = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(stageRef);
  const pageVisible = usePageVisible();
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const running = !reduced && !paused && onScreen && pageVisible;

  useEffect(() => {
    if (!running) return;
    const current = TIMELINE[index];
    if (!current) return;
    const id = window.setTimeout(() => setIndex((index + 1) % TIMELINE.length), current.ms);
    return () => window.clearTimeout(id);
  }, [index, running]);

  // Con movimiento reducido no hay bucle: el móvil enseña la puja y el
  // portátil el resultado, así que las dos mitades se ven a la vez.
  const phoneView = viewFor(reduced ? "tu" : (TIMELINE[index]?.step ?? "clues"));
  const laptopView = reduced ? viewFor("reveal") : phoneView;
  const animate = !reduced;

  return (
    <figure ref={stageRef} aria-labelledby="demo-caption" className="relative">
      <figcaption id="demo-caption" className="sr-only">
        Demostración de una puja: la carta solo enseña una silueta y cuatro pistas (182 cm, diestro, Sudamérica, años 2000).
        Ana puja 90 millones, Beto 100 y tú 110. Cae el martillo y se revela: Ronaldinho, FC Barcelona, temporada 2006.
      </figcaption>
      <div aria-hidden="true" className="relative mx-auto h-[31rem] w-full max-w-[20rem] sm:h-[33.5rem] lg:h-[36rem] lg:max-w-none">
        <motion.div
          initial={animate ? { opacity: 0, x: 40 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
          className="absolute left-[18%] top-4 hidden w-[96%] lg:block"
        >
          <LaptopFrame>
            <LaptopScreen view={laptopView} />
          </LaptopFrame>
        </motion.div>
        <motion.div
          initial={animate ? { opacity: 0, y: 48 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
          className="absolute bottom-0 left-1/2 w-[15rem] -translate-x-1/2 sm:w-[16rem] lg:left-0 lg:w-[15.5rem] lg:translate-x-0 xl:w-[16.5rem]"
        >
          <PhoneFrame>
            <GamePhoneScreen view={phoneView} animate={animate} media={<HeroCardMedia revealed={phoneView.revealed} animate={animate} />} />
          </PhoneFrame>
        </motion.div>
      </div>
      {reduced ? (
        <p className="mt-5 text-center font-copy text-[1.02rem] text-slate lg:hidden">
          Al caer el martillo se revela: Ronaldinho, FC Barcelona, 2006.
        </p>
      ) : (
        <DemoControl paused={paused} onToggle={() => setPaused((value) => !value)} />
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------

function Nav({ ctaLabel, onCta }: { ctaLabel: string; onCta: () => void }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300 ${scrolled ? "border-line bg-white/90 shadow-[0_12px_30px_-24px_rgba(4,23,38,.5)] backdrop-blur-md" : "border-transparent bg-canvas"
        }`}
    >
      <div className={`${CONTAINER} flex h-[4.5rem] items-center justify-between gap-6`}>
        <a href="#inicio" aria-label="Futbolera, inicio" className="rounded-lg">
          <Wordmark className="text-[1.45rem]" />
        </a>
        <nav aria-label="Secciones de la portada" className="hidden items-center gap-8 md:flex">
          <a href="#como-se-juega" className="font-copy text-[1.05rem] font-medium text-forest/80 transition-colors hover:text-forest">
            Cómo se juega
          </a>
          <a href="#reglas" className="font-copy text-[1.05rem] font-medium text-forest/80 transition-colors hover:text-forest">
            Reglas
          </a>
          <a href="#preguntas" className="font-copy text-[1.05rem] font-medium text-forest/80 transition-colors hover:text-forest">
            Preguntas
          </a>
        </nav>
        <PillButton size="sm" onClick={onCta}>
          {ctaLabel}
        </PillButton>
      </div>
    </header>
  );
}

function Hero({
  inviteCode,
  reduced,
  onPrimary,
  onHaveCode,
}: {
  inviteCode: string | null;
  reduced: boolean;
  onPrimary: () => void;
  onHaveCode: () => void;
}) {
  return (
    <section id="inicio" className="relative isolate">
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        fill="none"
        className="pointer-events-none absolute -right-40 top-16 -z-10 hidden h-[44rem] w-[44rem] text-[#E4E9F2] lg:block"
      >
        <circle cx="400" cy="400" r="300" stroke="currentColor" strokeWidth="4" />
        <circle cx="400" cy="400" r="10" fill="currentColor" />
      </svg>

      <div className={`${CONTAINER} grid items-center gap-14 pb-20 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 lg:pb-28 lg:pt-14`}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE_OUT }}
          className="relative z-10"
        >
          {inviteCode && (
            <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-pitch-soft px-4 py-2 font-copy text-[1rem] font-medium text-forest">
              <Users className="h-4 w-4" aria-hidden="true" />
              Te invitaron a la sala <span className="tnum font-semibold">{inviteCode}</span>
            </p>
          )}
          <h1 className="text-balance font-headline text-[clamp(2.3rem,4.6vw,3.8rem)] font-bold leading-[1.05] tracking-[-0.045em] text-forest">
            Subastas de fútbol a ciegas con tus amigos
          </h1>
          <p className="mt-6 max-w-[33rem] font-copy text-[1.22rem] leading-[1.6] text-slate">
            Ves una silueta y cuatro pistas. Pujas contra tu grupo y, cuando cae el martillo, se revela quién es y de qué temporada.
            Gana quien arme el mejor once.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <PillButton onClick={onPrimary}>{inviteCode ? `Unirme a la sala ${inviteCode}` : "Crear una sala"}</PillButton>
            {!inviteCode && (
              <button
                type="button"
                onClick={onHaveCode}
                className="min-h-11 cursor-pointer font-copy text-[1.08rem] font-semibold text-forest underline decoration-pitch decoration-[3px] underline-offset-[6px] transition-colors hover:decoration-forest"
              >
                Tengo un código
              </button>
            )}
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 font-copy text-[1.02rem] text-forest">
            <li className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch-soft">
                <Users className="h-4 w-4" aria-hidden="true" />
              </span>
              De 2 a 4 jugadores
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch-soft">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              Sin cuenta ni registro
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch-soft">
                <Globe className="h-4 w-4" aria-hidden="true" />
              </span>
              Gratis, en el navegador
            </li>
          </ul>
        </motion.div>

        <HeroDemo reduced={reduced} />
      </div>
    </section>
  );
}

function WhatIs() {
  return (
    <section aria-labelledby="what-title" className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <SectionTitle id="what-title">¿Qué es Futbolera?</SectionTitle>
        <p className="mt-6 font-copy text-[1.3rem] leading-[1.6] text-slate">
          Un juego de subastas para 2 a 4 amigos que se juega en el navegador. Cada ronda es un puesto del once: se puja por futbolistas
          escondidos tras una silueta y, al final, la ceremonia voltea los ratings para ver quién fichó mejor.
        </p>
      </div>
    </section>
  );
}

export function Landing({ error, onCreate, onJoinByCode, onJoinPublicRoom }: Props) {
  const reduced = useReducedMotion() ?? false;
  const lenisRef = useSmoothScroll(!reduced);
  const [inviteCode] = useState(inviteCodeFromPath);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  useResetScrollOnLeave();

  const goToEntry = (field: "name" | "code" = "name") => {
    const input = field === "code" ? codeInputRef : nameInputRef;
    scrollToSection("entrar", lenisRef.current, () => input.current?.focus({ preventScroll: true }));
  };
  const goTop = () => {
    if (lenisRef.current) lenisRef.current.scrollTo(0);
    else window.scrollTo({ top: 0 });
  };

  return (
    <div className={`min-h-screen overflow-x-clip bg-canvas font-copy text-forest ${reduced ? "" : "landing-fade-in"}`}>
      <Nav ctaLabel={inviteCode ? "Unirme" : "Crear sala"} onCta={() => goToEntry()} />
      <Hero inviteCode={inviteCode} reduced={reduced} onPrimary={() => goToEntry()} onHaveCode={() => goToEntry("code")} />
      <WhatIs />
      <Features />
      <RoundLoop />
      <Seasons onPlay={() => goToEntry()} />
      <Numbers />
      <CtaBand
        onCreate={() => goToEntry()}
        phone={
          <PhoneFrame>
            <GamePhoneScreen
              view={viewFor("reveal")}
              animate={false}
              media={
                <img
                  src={heroPhoto}
                  alt=""
                  width={365}
                  height={512}
                  loading="lazy"
                  decoding="async"
                  className="absolute -top-[5%] right-[3%] z-10 h-[108%] w-auto max-w-none object-contain object-bottom"
                />
              }
            />
          </PhoneFrame>
        }
      />
      <Faq />
      <EnterSection
        error={error}
        initialCode={inviteCode}
        nameInputRef={nameInputRef}
        codeInputRef={codeInputRef}
        onCreate={onCreate}
        onJoinByCode={onJoinByCode}
        onJoinPublicRoom={onJoinPublicRoom}
      />
      <SiteFooter onTop={goTop} />
    </div>
  );
}

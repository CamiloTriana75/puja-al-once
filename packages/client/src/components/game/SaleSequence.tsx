import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import strikeSvg from "../../assets/gavel-strike.svg?raw";
import { HTTP_URL } from "../../net/endpoints.js";
import { playGavel, preloadGavel } from "../../net/sound.js";
import { EASE_OUT, HAMMER_IMPACT_MS, SHAKE, SPRING_POP } from "../../motion/tokens.js";
import { PitchLines, POSITIONS } from "../SquadGrid.js";
import { Ball, Burst } from "./FieldPieces.js";
import { LotArt } from "./LotArt.js";
import { SLOT_ABBR, SLOT_LABEL, SLOT_ORDER } from "./slots.js";

/**
 * Tiempos (ms). El total tiene que caber en la fase REVEAL de una carta
 * adjudicada (`soldRevealMs`, 9,5 s en el servidor): con dos pases son ~5,7 s
 * con el fundido final, y los ~3,8 s restantes son el respiro antes de la
 * siguiente carta.
 */
const HAMMER_PHASE_MS = 1350;
const PASS_START_MS = 450;
const PASS_SEGMENT_MS = 520;
/** Tras el remate el jugador se queda a la vista: es lo que mas se quiere leer. */
const PASS_HOLD_MS = 2000;
const AUDIO_LEAD_MS = 30;
const CLOSE_FADE_MS = 300;

// El SVG original va en bucle infinito; aqui suena una sola vez.
const ONCE_SVG = strikeSvg.replaceAll('repeatCount="indefinite"', 'repeatCount="1"');

interface Props {
  roomId: string;
  cardId: string;
  buyer: string;
  price: number;
  /** Puesto del jugador fichado (clave de SLOT_ORDER). */
  slot: string;
  cardName: string;
  club: string;
  season: number;
  /** Puestos que el comprador ya tiene cubiertos, incluido el nuevo. */
  ownedSlots: string[];
  onDone: () => void;
}

/** Recorrido del balon: saque desde el centro, hasta dos pases por puestos ya cubiertos y remate en el puesto nuevo. */
function passPath(slot: string, ownedSlots: string[]): { x: number; y: number }[] {
  const target = POSITIONS[slot];
  if (!target) return [{ x: 50, y: 50 }];
  const distance = (key: string) => {
    const p = POSITIONS[key]!;
    return Math.hypot(p.x - target.x, p.y - target.y);
  };
  const others = ownedSlots
    .filter((key) => key !== slot && POSITIONS[key])
    .sort((a, b) => distance(b) - distance(a))
    .slice(0, 2);
  return [{ x: 50, y: 50 }, ...others.map((key) => POSITIONS[key]!), target];
}

/** Mazo con onda de choque, sacudida y sello "¡Vendido!" en el instante del golpe. */
function HammerScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    preloadGavel();
    // SMIL cuenta desde el inicio del documento SVG: se reinicia para que el golpe
    // caiga siempre en el mismo instante tras montar.
    const svg = host.current?.querySelector("svg");
    svg?.setCurrentTime?.(0);
    svg?.unpauseAnimations?.();
    const id = window.setTimeout(playGavel, HAMMER_IMPACT_MS - AUDIO_LEAD_MS);
    return () => window.clearTimeout(id);
  }, []);

  const impact = HAMMER_IMPACT_MS / 1000;

  return (
    <motion.div key="hammer" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease: EASE_OUT }} className="relative">
      <motion.div animate={{ x: [...SHAKE.x] }} transition={{ ...SHAKE.transition, delay: impact }}>
        <div ref={host} className="size-[min(70vw,56vh)]" dangerouslySetInnerHTML={{ __html: ONCE_SVG }} />
      </motion.div>
      <motion.span
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.2, 1.1, 1.9] }}
        transition={{ duration: 0.7, delay: impact, ease: "easeOut" }}
        className="pointer-events-none absolute left-[38%] top-[67%] size-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-gold"
      />
      <motion.p
        initial={{ opacity: 0, scale: 1.9, rotate: -14 }}
        animate={{ opacity: 1, scale: 1, rotate: -6 }}
        transition={{ ...SPRING_POP, delay: impact }}
        className="absolute inset-x-0 bottom-[6%] mx-auto w-fit rounded-2xl bg-gold px-7 py-2 font-headline text-[clamp(1.8rem,5vw,3rem)] font-bold tracking-[-0.04em] text-forest shadow-[0_20px_40px_-18px_rgba(0,0,0,.6)]"
      >
        ¡Vendido!
      </motion.p>
    </motion.div>
  );
}

function PassScene({ roomId, cardId, slot, ownedSlots, buyer, price, cardName, club, season }: Omit<Props, "onDone">) {
  const path = useMemo(() => passPath(slot, ownedSlots), [slot, ownedSlots]);
  const segments = path.length - 1;
  const duration = (segments * PASS_SEGMENT_MS) / 1000;
  const delay = PASS_START_MS / 1000;
  const arrival = delay + duration;
  const times = path.map((_, index) => index / segments);

  // Escala del balon: "salta" a mitad de cada pase (altura del tiro).
  const scaleKeys = [1];
  const scaleTimes = [0];
  for (let index = 0; index < segments; index++) {
    scaleKeys.push(1.4, 1);
    scaleTimes.push((index + 0.5) / segments, (index + 1) / segments);
  }

  const passSlots = ownedSlots.filter((key) => key !== slot);
  const touchAt = (key: string): number | null => {
    const index = path.findIndex((point, i) => i > 0 && i < path.length - 1 && point === POSITIONS[key]);
    return index === -1 ? null : delay + (index * PASS_SEGMENT_MS) / 1000;
  };

  const photoUrl = `${HTTP_URL}/photos/revealed/${roomId}/${cardId}.png`;
  const initials = cardName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");

  return (
    <motion.div
      key="pass"
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="flex max-h-screen w-[min(94vw,56rem)] flex-col items-center gap-3 md:gap-4"
    >
      <p className="rounded-full bg-white px-5 py-2 text-center font-copy text-[1.05rem] font-semibold text-forest shadow-lg md:text-[1.15rem]">
        {buyer} ficha a {cardName} por <span className="tnum font-headline font-bold text-pitch">{price} M</span>
      </p>

      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
        {/* El jugador comprado: foto grande, que entra al empezar el pase y se queda hasta el final. */}
        <motion.figure
          initial={{ opacity: 0, x: -36, rotate: -5 }}
          animate={{ opacity: 1, x: 0, rotate: -2 }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT }}
          className="relative w-[min(11rem,42vw)] shrink-0 md:w-[17rem]"
        >
          <motion.div
            animate={{ scale: [1, 1, 1.05, 1] }}
            transition={{ duration: arrival + 0.5, times: [0, arrival / (arrival + 0.5), (arrival + 0.15) / (arrival + 0.5), 1], ease: EASE_OUT }}
            className="rounded-[1.5rem] bg-white p-2 shadow-[0_40px_70px_-30px_rgba(0,0,0,.75)] ring-1 ring-line"
          >
            <LotArt photoSrc={photoUrl} revealed alt={`${cardName}, ${club}, temporada ${season}`} className="aspect-[4/5] rounded-[1.1rem]">
              <span aria-hidden="true" className="absolute inset-x-0 bottom-2 z-[5] text-center font-headline text-[2.2rem] font-bold text-white/90">
                {initials}
              </span>
            </LotArt>
            <figcaption className="px-2 pb-1 pt-2.5">
              <p className="truncate font-headline text-[1.15rem] font-bold leading-tight tracking-[-0.03em] text-forest md:text-[1.4rem]">{cardName}</p>
              <p className="tnum truncate font-copy text-[0.95rem] text-slate md:text-[1.02rem]">
                {club} <span className="font-semibold text-gold-ink">{season}</span>
              </p>
            </figcaption>
          </motion.div>
          <motion.span
            initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 4 }}
            transition={{ ...SPRING_POP, delay: arrival + 0.15 }}
            className="absolute -right-3 -top-3 flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 font-copy text-[0.95rem] font-bold text-forest shadow-lg"
          >
            <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            {SLOT_LABEL[slot] ?? slot}
          </motion.span>
        </motion.figure>

        <div className="pitch-field relative aspect-[3/4] h-[min(48vh,26rem)] max-w-[78vw] overflow-hidden rounded-[1.5rem] shadow-[0_40px_70px_-30px_rgba(0,0,0,.7)] ring-4 ring-white md:h-[min(62vh,34rem)]">
          <PitchLines />

          {/* Estela de la jugada: el trazo se dibuja a la vez que el balon avanza. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <motion.path
              d={path.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")}
              fill="none"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.1 3"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0.9 }}
              animate={{ pathLength: path.map((_, index) => index / segments) }}
              transition={{ duration, delay, times, ease: "easeInOut" }}
              style={{ strokeWidth: 5 }}
            />
          </svg>

          {SLOT_ORDER.map((key) => {
            const pos = POSITIONS[key]!;
            const isTarget = key === slot;
            const owned = passSlots.includes(key);
            const touch = touchAt(key);
            return (
              <div key={key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                {isTarget ? (
                  <>
                    <motion.span
                      aria-hidden="true"
                      initial={{ scale: 1, opacity: 0 }}
                      animate={{ scale: [1, 3.2], opacity: [0.9, 0] }}
                      transition={{ duration: 0.8, delay: arrival, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-4 border-gold"
                    />
                    <Burst delay={arrival} />
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.35, 1] }}
                      transition={{ duration: 0.55, delay: arrival, ease: EASE_OUT }}
                      className="relative grid size-12 place-items-center rounded-full bg-gold font-headline text-[0.8rem] font-bold text-forest ring-[3px] ring-white sm:size-14"
                    >
                      {SLOT_ABBR[key]}
                    </motion.span>
                  </>
                ) : owned ? (
                  <motion.span
                    animate={touch !== null ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={touch !== null ? { duration: 0.4, delay: touch, ease: EASE_OUT } : undefined}
                    className="grid size-10 place-items-center rounded-full bg-white font-headline text-[0.7rem] font-bold text-forest shadow-md sm:size-12"
                  >
                    {SLOT_ABBR[key]}
                  </motion.span>
                ) : (
                  <span className="grid size-9 place-items-center rounded-full border-2 border-dashed border-white/50 sm:size-10" />
                )}
              </div>
            );
          })}

          <motion.div
            aria-hidden="true"
            initial={{ left: `${path[0]!.x}%`, top: `${path[0]!.y}%`, opacity: 0, scale: 0.4 }}
            animate={{
              left: path.map((point) => `${point.x}%`),
              top: path.map((point) => `${point.y}%`),
              opacity: 1,
              scale: scaleKeys,
              rotate: segments * 360,
            }}
            transition={{
              left: { duration, delay, times, ease: "easeInOut" },
              top: { duration, delay, times, ease: "easeInOut" },
              scale: { duration, delay, times: scaleTimes, ease: "easeInOut" },
              rotate: { duration, delay, ease: "linear" },
              opacity: { duration: 0.2, delay: delay - 0.2 },
            }}
            className="pointer-events-none absolute z-20 size-7 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_6px_rgba(0,0,0,.45)] sm:size-8"
          >
            <Ball className="size-full" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Secuencia estrella de la subasta cuando se cierra una compra con ganador:
 * el mazo golpea (con sonido), cae "¡Vendido!" y el balon cruza el campo en
 * una jugada de pases hasta el puesto del jugador fichado, que se muestra con
 * su foto durante todo el pase y se queda a la vista tras el remate. Clic o
 * Esc la saltan.
 *
 * Va en un portal sobre <body> (un `fixed` dentro de la transicion entre
 * pantallas se posicionaria contra ella) y es una excepcion deliberada a
 * `prefers-reduced-motion`: es el momento central del juego, dura ~5,5 s, se
 * puede saltar y el sonido tiene silencio propio.
 */
export function SaleSequence(props: Props) {
  const { onDone, ownedSlots, slot } = props;
  const [phase, setPhase] = useState<"hammer" | "pass">("hammer");
  const [closing, setClosing] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  const segments = Math.max(1, passPath(slot, ownedSlots).length - 1);
  const passMs = PASS_START_MS + segments * PASS_SEGMENT_MS + PASS_HOLD_MS;

  useEffect(() => {
    const toPass = window.setTimeout(() => setPhase("pass"), HAMMER_PHASE_MS);
    const toClose = window.setTimeout(() => setClosing(true), HAMMER_PHASE_MS + passMs);
    const toDone = window.setTimeout(() => done.current(), HAMMER_PHASE_MS + passMs + CLOSE_FADE_MS);
    return () => {
      window.clearTimeout(toPass);
      window.clearTimeout(toClose);
      window.clearTimeout(toDone);
    };
  }, [passMs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") done.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <motion.div
      role="presentation"
      onClick={() => done.current()}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: closing ? CLOSE_FADE_MS / 1000 : 0.2 }}
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_40%,rgba(21,131,74,.7),rgba(12,36,28,.92))] p-4 backdrop-blur-[3px]"
    >
      <p className="sr-only" role="status">
        {props.buyer} ficha a {props.cardName} {props.season} por {props.price} millones.
      </p>
      <AnimatePresence mode="wait">
        {phase === "hammer" ? <HammerScene key="hammer" /> : <PassScene key="pass" {...props} />}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

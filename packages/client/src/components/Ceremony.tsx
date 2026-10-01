import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { HTTP_URL } from "../net/endpoints.js";
import { buildCeremonySteps, ceremonyChampions, ceremonyPoints, computeAwards, type CeremonyStep } from "../net/ceremony.js";
import type { ClientState } from "../net/types.js";
import { LotArt } from "./game/LotArt.js";

/**
 * Duraciones de design-system/pages/ceremonia.md: entrada ~2s, cada paso de
 * puesto ~4.8s (con el destape de rating a los ~1.8s), campeon y premios con
 * sus propios tiempos de lectura. Cada cliente reproduce la ceremonia por su
 * cuenta al entrar en RESULTS -- no hay coordinacion de servidor, asi que
 * estos numeros son enteramente del cliente.
 *
 * El paso por puesto es el corazon de la secuencia -- es donde se ve, puesto a
 * puesto, que jugador eligio cada uno -- asi que va deliberadamente lento: hay
 * tiempo de leer la carta, ver el destape y entender quien se lleva el punto
 * antes de que aparezca el siguiente puesto. Sale en ~1 minuto con button de
 * salto siempre a mano.
 */
export const INTRO_MS = 2000;
export const STEP_MS = 4800;
export const REVEAL_DELAY_MS = 1800;
export const CHAMPION_MS = 4200;
export const AWARDS_MS = 5000;

type Stage =
  | { kind: "intro" }
  | { kind: "step"; index: number }
  | { kind: "champion" }
  | { kind: "awards" }
  | { kind: "done" };

/** Trofeo en SVG, trazo 2 sobre 24x24 -- MASTER.md S7 y ceremonia.md: "nunca emoji". */
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5H4a2 2 0 0 0 0 4h3" />
      <path d="M17 5h3a2 2 0 0 1 0 4h-3" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m5 4 10 8-10 8Z" />
      <path d="M19 5v14" />
    </svg>
  );
}

/**
 * Confeti en canvas -- la unica excepcion al "solo transform/opacity" de
 * MASTER.md S5, tal como autoriza ceremonia.md ("se dibuja en canvas y dura
 * menos de 3s"). Nunca se monta con `prefers-reduced-motion` (el padre
 * decide eso, no este componente). Particulas simples, sin libreria: es
 * decorativo y de corta vida, no merece una dependencia mas.
 */
function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();

    const colors = ["#F0B83D", "#15834A", "#0C241C", "#FFFFFF"];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.clientWidth,
      y: -20 - Math.random() * canvas.clientHeight * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      vy: 2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    }));

    let raf = 0;
    const start = performance.now();
    const DURATION_MS = 2600;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      ctx.restore();
      if (elapsed < DURATION_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Una carta del puesto en grande: cromo con foto, quién la fichó y su rating, tapado hasta el destape. */
function CeremonyCard({
  entry,
  revealRating,
  roomId,
}: {
  entry: CeremonyStep["entries"][number];
  revealRating: boolean;
  roomId?: string;
}) {
  const reducedMotion = useReducedMotion();
  const photoUrl = roomId ? `${HTTP_URL}/photos/revealed/${roomId}/${entry.cardId}.png` : undefined;
  const winner = entry.wins && revealRating;

  return (
    <li
      className={`relative flex flex-col rounded-[2rem] p-3 transition-[background-color,box-shadow,transform] duration-500 sm:p-4 ${
        winner ? "bg-gold shadow-[0_40px_70px_-36px_rgba(122,75,0,.95)] lg:-translate-y-2" : "bg-white ring-1 ring-line"
      }`}
    >
      <LotArt photoSrc={photoUrl} revealed alt="" className="aspect-[4/5] w-full rounded-[1.5rem]">
        <span aria-hidden="true" className="absolute inset-x-0 bottom-3 z-[5] text-center font-headline text-[clamp(2.4rem,5vw,3.6rem)] font-bold text-white/90">
          {entry.card.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
        </span>
        <span className="tnum absolute bottom-2.5 left-2.5 z-20 rounded-full bg-forest px-3 py-1 font-copy text-[0.95rem] font-semibold text-white">
          {entry.card.season}
        </span>
      </LotArt>

      <div className="flex flex-1 flex-col gap-1 px-2 pb-1 pt-4">
        <p className="line-clamp-2 font-headline text-[clamp(1.3rem,2.2vw,1.8rem)] font-bold leading-[1.08] tracking-[-0.04em] text-forest">
          {entry.card.name}
        </p>
        <p className={`font-copy text-[1.05rem] ${winner ? "text-forest/85" : "text-slate"}`}>
          {entry.card.club} · {entry.playerName} · {entry.card.price} M
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <motion.span
            key={revealRating ? "revealed" : "hidden"}
            initial={reducedMotion ? false : { opacity: 0, rotateX: revealRating ? -90 : 0, scale: revealRating ? 0.7 : 1 }}
            animate={{ opacity: 1, rotateX: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`tnum grid min-w-[5.5rem] place-items-center rounded-2xl px-5 py-3 font-headline text-[clamp(3rem,6vw,4.6rem)] font-bold leading-none tracking-[-0.06em] ${
              winner ? "bg-forest text-gold" : revealRating ? "bg-canvas text-forest" : "bg-canvas text-slate"
            }`}
          >
            {revealRating ? entry.card.rating : "?"}
          </motion.span>
          {winner && (
            <span className="rounded-full bg-forest px-4 py-1.5 font-copy text-[1.05rem] font-semibold text-gold">Gana el puesto</span>
          )}
        </div>
      </div>
    </li>
  );
}

interface Props {
  state: ClientState;
  roomId?: string;
  onFinished: () => void;
}

/**
 * La ceremonia final -- design-system/pages/ceremonia.md. Se monta UNA vez
 * al entrar en RESULTS (Results.tsx decide cuando, antes de la tabla) y
 * llama a `onFinished` cuando termina o cuando el usuario pulsa "Saltar
 * ceremonia". Cada cliente la corre por su cuenta: no hay paquete de
 * servidor que la dispare, el propio cambio de fase a RESULTS ya llega
 * igual (y casi a la vez) a todos.
 */
export function Ceremony({ state, roomId, onFinished }: Props) {
  const reducedMotion = useReducedMotion();
  const steps = useMemo(() => buildCeremonySteps(state), [state]);
  const players = useMemo(() => [...state.players.values()], [state]);
  const awards = useMemo(() => computeAwards(state), [state]);
  const champions = useMemo(() => ceremonyChampions(state), [state]);

  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [ratingRevealed, setRatingRevealed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // El marcador es DERIVADO, nunca acumulado: son los puntos de los pasos ya
  // resueltos, recalculados con `ceremonyPoints` a partir de `steps`. Antes se
  // iba sumando dentro del temporizador del destape, y eso hacia que cualquier
  // patch del servidor durante la ceremonia (un jugador que cierra la pestana
  // en RESULTS, por ejemplo) re-programara ese temporizador y volviera a sumar
  // el mismo punto dos veces. `useRoom` da un objeto de estado nuevo en cada
  // patch, asi que las dependencias de este componente cambian; que el
  // marcador dependa solo de cuantos pasos se han resuelto lo hace inmune.
  const resolvedSteps = useMemo(() => {
    if (stage.kind === "step") return steps.slice(0, ratingRevealed ? stage.index + 1 : stage.index);
    if (stage.kind === "champion" || stage.kind === "awards" || stage.kind === "done") return steps;
    return [];
  }, [stage, steps, ratingRevealed]);
  const scoreboard = useMemo(() => ceremonyPoints(resolvedSteps, players), [resolvedSteps, players]);

  // Con movimiento reducido la ceremonia avanza igual pero sin animar nada:
  // el rating de cada paso llega ya destapado (nunca se oculta informacion
  // por la animacion, design-system/pages/ceremonia.md).
  const revealDelay = reducedMotion ? 0 : REVEAL_DELAY_MS;

  useEffect(() => {
    setRatingRevealed(false);

    const timers: number[] = [];
    const advance = (next: Stage, delay: number) => {
      timers.push(window.setTimeout(() => setStage(next), delay));
    };

    if (stage.kind === "intro") {
      advance({ kind: "step", index: 0 }, INTRO_MS);
    } else if (stage.kind === "step") {
      const step = steps[stage.index];
      timers.push(
        window.setTimeout(() => {
          setRatingRevealed(true);
          if (step) {
            const winners = step.entries.filter((e) => e.wins);
            const announced = winners.length === 0
              ? `${step.label}: nadie lo ficho.`
              : winners.length === 1
                ? `${step.label}: gana ${winners[0]!.playerName} con ${winners[0]!.card.name} ${winners[0]!.card.season}, rating ${winners[0]!.card.rating}.`
                : `${step.label}: empate entre ${winners.map((w) => w.playerName).join(" y ")}, rating ${winners[0]!.card.rating}.`;
            setAnnouncement(announced);
          }
        }, revealDelay),
      );
      const nextIndex = stage.index + 1;
      advance(
        nextIndex < steps.length ? { kind: "step", index: nextIndex } : { kind: "champion" },
        STEP_MS,
      );
    } else if (stage.kind === "champion") {
      advance({ kind: "awards" }, CHAMPION_MS);
    } else if (stage.kind === "awards") {
      advance({ kind: "done" }, awards.length > 0 ? AWARDS_MS : 0);
    } else if (stage.kind === "done") {
      onFinished();
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, steps, revealDelay]);

  const completedSteps = stage.kind === "step"
    ? stage.index
    : stage.kind === "champion" || stage.kind === "awards" || stage.kind === "done"
      ? steps.length
      : 0;
  const pointLabel = (points: number) => points.toLocaleString("es-CO", { maximumFractionDigits: 2 });

  const skip = () => setStage({ kind: "done" });

  return (
    <div className="fixed inset-0 z-50 flex min-h-full flex-col overflow-y-auto overscroll-contain bg-canvas text-forest">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="sticky top-0 z-40 border-b border-line bg-canvas/92 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-copy text-[1.05rem] font-semibold text-forest">
            {stage.kind === "intro" ? "Final de la subasta" : stage.kind === "step" ? `Puesto ${stage.index + 1} de ${steps.length}` : "Marcador final"}
          </p>
          <button
            type="button"
            onClick={skip}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-4 font-copy text-[0.98rem] font-semibold text-forest ring-1 ring-line transition-colors duration-200 hover:ring-forest"
          >
            <SkipIcon />
            Saltar ceremonia
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso de la ceremonia"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completedSteps}
          aria-valuetext={`${completedSteps} de ${steps.length} puestos revelados`}
          className="mx-auto mt-3 flex w-full max-w-4xl gap-1"
        >
          {steps.map((step, index) => (
            <span
              key={step.slot}
              aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full ${index < completedSteps ? "bg-pitch" : stage.kind === "step" && index === stage.index ? "bg-gold" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      {(stage.kind === "intro" || stage.kind === "step" || stage.kind === "champion") && (
        <ol className="mx-auto mt-5 flex w-full max-w-4xl flex-wrap justify-center gap-2 px-4">
          {players.map((p) => (
            <li key={p.playerId} className="flex items-baseline gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-line">
              <span className="font-copy text-[1rem] font-semibold text-forest">{p.name}</span>
              <motion.span
                key={scoreboard.get(p.playerId)}
                initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="tnum font-headline text-[1.1rem] font-bold text-pitch"
              >
                {pointLabel(scoreboard.get(p.playerId) ?? 0)}
              </motion.span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {stage.kind === "intro" && (
            <motion.div
              key="intro"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <h1 className="text-balance font-headline text-[clamp(2.6rem,8vw,6rem)] font-bold leading-[1] tracking-[-0.055em] text-forest">
                La hora de la verdad
              </h1>
              <p className="mt-4 font-copy text-[1.2rem] text-slate">Se destapan los ratings, puesto a puesto.</p>
            </motion.div>
          )}

          {stage.kind === "step" && steps[stage.index] && (
            <motion.div
              key={`step-${stage.index}`}
              initial={reducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[84rem]"
            >
              <h2 className="mb-8 text-center font-headline text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.05em] text-forest">
                {steps[stage.index]!.label}
              </h2>
              {steps[stage.index]!.entries.length === 0 ? (
                <p className="rounded-[1.5rem] bg-white px-5 py-6 text-center font-copy text-[1.1rem] text-slate ring-1 ring-line">Sin fichaje</p>
              ) : (
                <ul className="mx-auto grid gap-4 sm:grid-cols-2 lg:gap-6 xl:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ "--cols": Math.min(4, steps[stage.index]!.entries.length), maxWidth: `${Math.min(4, steps[stage.index]!.entries.length) * 22}rem` } as React.CSSProperties}>
                  {steps[stage.index]!.entries.map((entry) => (
                    <CeremonyCard key={entry.playerId} entry={entry} roomId={roomId} revealRating={ratingRevealed || reducedMotion === true} />
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {stage.kind === "champion" && champions.length > 0 && (
            <motion.div
              key="champion"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="on-dark relative flex w-full max-w-3xl flex-col items-center overflow-hidden rounded-[2.5rem] bg-forest px-6 py-12 text-center text-white"
            >
              {!reducedMotion && <ConfettiCanvas />}
              <span className="grid h-24 w-24 place-items-center rounded-full bg-gold text-forest">
                <TrophyIcon />
              </span>
              <p className="mt-5 font-copy text-[1.15rem] text-white/80">{champions.length > 1 ? "Campeones" : "Campeón"}</p>
              <motion.h1
                initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : 0.2 }}
                className="text-balance font-headline text-[clamp(2.6rem,9vw,6rem)] font-bold leading-[1] tracking-[-0.055em] text-gold"
              >
                {champions.map((champion) => champion.name).join(" · ")}
              </motion.h1>
              <p className="tnum mt-3 font-headline text-[1.4rem] font-semibold text-white">
                {pointLabel(champions[0]!.points)} pts{champions.length > 1 ? " cada uno" : ""}
              </p>
            </motion.div>
          )}

          {stage.kind === "awards" && awards.length > 0 && (
            <motion.div
              key="awards"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="grid w-full max-w-4xl gap-4 sm:grid-cols-3"
            >
              {awards.map((award) => (
                <div key={award.title} className="rounded-[1.5rem] bg-white p-6 ring-1 ring-line">
                  <p className="font-copy text-[1rem] font-semibold text-pitch">{award.title}</p>
                  <p className="mt-2 font-headline text-[1.4rem] font-bold tracking-[-0.04em] text-forest">{award.playerName}</p>
                  <p className="mt-1 font-copy text-[0.98rem] text-slate">{award.detail}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

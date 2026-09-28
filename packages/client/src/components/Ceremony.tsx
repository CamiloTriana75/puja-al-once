import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { HTTP_URL } from "../net/endpoints.js";
import { buildCeremonySteps, ceremonyChampions, ceremonyPoints, computeAwards, type CeremonyStep } from "../net/ceremony.js";
import type { ClientState } from "../net/types.js";

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

    const colors = ["#C6F833", "#16C64F", "#FFFFFF"];
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

/** Una carta de la ceremonia para un puesto: foto, nombre, temporada, dueno, precio, y el rating tapado/destapado. */
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
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = roomId ? `${HTTP_URL}/photos/revealed/${roomId}/${entry.cardId}.png` : null;

  useEffect(() => setPhotoFailed(false), [entry.cardId]);

  return (
    <li
      className={`panel relative flex min-h-32 items-stretch gap-3 bg-ink p-3 sm:gap-4 sm:p-4 ${
        entry.wins && revealRating ? "ring-2 ring-inset ring-lime" : ""
      }`}
    >
      <div className="relative isolate flex w-20 shrink-0 items-end justify-center overflow-hidden bg-green sm:w-24">
        <div aria-hidden className="absolute -right-6 top-0 h-full w-1/2 -skew-x-[18deg] bg-lime" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-deep" />
        <span aria-hidden className="absolute bottom-3 z-10 font-display text-3xl font-black text-ink">
          {entry.card.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
        </span>
        {!photoFailed && photoUrl && (
          <img
            src={photoUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="absolute inset-0 z-20 h-full w-full object-contain object-bottom"
          />
        )}
        <span className="absolute bottom-1 left-1 z-30 bg-ink px-1.5 py-0.5 font-display text-[10px] font-black text-white">
          {entry.card.season}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div className="min-w-0">
          <p className="line-clamp-2 font-display text-lg font-extrabold uppercase leading-[0.95] tracking-wide text-white sm:text-xl">
            {entry.card.name}
          </p>
          <p className="mt-1 truncate font-body text-xs text-mute sm:text-sm">
            {entry.card.club} · {entry.playerName} · {entry.card.price} M
          </p>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-mute sm:text-xs">
            Rating
          </span>
          {entry.wins && revealRating && (
            <span className="bg-lime px-2 py-1 font-display text-[10px] font-black uppercase tracking-wide text-ink sm:text-xs">
              Gana el puesto
            </span>
          )}
        </div>
      </div>

      <motion.span
        key={revealRating ? "revealed" : "hidden"}
        initial={reducedMotion ? false : { opacity: 0, rotateX: revealRating ? -90 : 0 }}
        animate={{ opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`tnum flex min-w-12 items-center justify-center border-l border-white/10 pl-3 font-display text-4xl font-black sm:min-w-16 sm:pl-4 sm:text-5xl ${revealRating ? "text-lime" : "text-mute"}`}
      >
        {revealRating ? entry.card.rating : "?"}
      </motion.span>
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
    <div className="fixed inset-0 z-50 flex min-h-full flex-col overflow-y-auto overscroll-contain bg-deep">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="sticky top-0 z-40 bg-deep/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-mute">Final de temporada</p>
            <p className="font-display text-sm font-black uppercase tracking-wide text-white">
              {stage.kind === "intro" ? "La hora de la verdad" : stage.kind === "step" ? `Puesto ${stage.index + 1} de ${steps.length}` : "Marcador final"}
            </p>
          </div>
          <button
            type="button"
            onClick={skip}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2 border-2 border-white/30 px-3 font-display text-xs font-bold uppercase tracking-wide text-white transition-colors duration-200 hover:border-lime hover:text-lime sm:px-4 sm:text-sm"
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
          className="mx-auto mt-3 flex w-full max-w-3xl gap-1"
        >
          {steps.map((step, index) => (
            <span
              key={step.slot}
              aria-hidden="true"
              className={`h-1.5 flex-1 ${index < completedSteps ? "bg-lime" : stage.kind === "step" && index === stage.index ? "bg-green" : "bg-white/15"}`}
            />
          ))}
        </div>
      </div>

      {/* Marcador -- cifras tabulares, siempre visible durante la secuencia de puestos y el campeon. */}
      {(stage.kind === "intro" || stage.kind === "step" || stage.kind === "champion") && (
        <ol className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-3 px-4">
          {players.map((p) => (
            <li key={p.playerId} className="panel flex items-baseline gap-2 bg-ink px-4 py-2">
              <span className="font-display text-sm font-bold uppercase text-white">{p.name}</span>
              <motion.span
                key={scoreboard.get(p.playerId)}
                initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="tnum font-display text-xl font-black text-lime"
              >
                {pointLabel(scoreboard.get(p.playerId) ?? 0)}
              </motion.span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {stage.kind === "intro" && (
            <motion.div
              key="intro"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="text-center"
            >
              <h1 className="font-display text-[clamp(2.5rem,9vw,6rem)] font-black uppercase leading-[0.85] tracking-tighter text-lime">
                La hora
                <br />
                de la verdad
              </h1>
            </motion.div>
          )}

          {stage.kind === "step" && steps[stage.index] && (
            <motion.div
              key={`step-${stage.index}`}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="w-full max-w-4xl"
            >
              <p className="text-center font-display text-xs font-bold uppercase tracking-[0.2em] text-mute">
                Puesto {stage.index + 1} de {steps.length}
              </p>
              <h2 className="mb-6 text-center font-display text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-[0.9] tracking-tight text-white">
                {steps[stage.index]!.label}
              </h2>
              {steps[stage.index]!.entries.length === 0 ? (
                <p className="panel bg-ink px-5 py-4 text-center font-display text-lg font-bold uppercase tracking-wide text-mute">
                  Sin fichaje
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
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
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="relative flex flex-col items-center text-center"
            >
              {!reducedMotion && <ConfettiCanvas />}
              <span className="text-lime">
                <TrophyIcon />
              </span>
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : 0.15 }}
                className="mt-4 font-display text-sm font-bold uppercase tracking-[0.2em] text-mute"
              >
                {champions.length > 1 ? "Campeones" : "Campeón"}
              </motion.p>
              <motion.h1
                initial={reducedMotion ? false : { opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : 0.15 }}
                className="font-display text-[clamp(2.5rem,10vw,7rem)] font-black uppercase leading-[0.85] tracking-tighter text-lime"
              >
                {champions.map((champion) => champion.name).join(" · ")}
              </motion.h1>
              <p className="tnum mt-2 font-display text-2xl font-extrabold text-white">
                {pointLabel(champions[0]!.points)} pts{champions.length > 1 ? " cada uno" : ""}
              </p>
            </motion.div>
          )}

          {stage.kind === "awards" && awards.length > 0 && (
            <motion.div
              key="awards"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="grid w-full max-w-3xl gap-4 sm:grid-cols-3"
            >
              {awards.map((award) => (
                <div key={award.title} className="panel bg-ink p-5">
                  <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-lime">
                    {award.title}
                  </p>
                  <p className="mt-2 font-display text-xl font-extrabold uppercase text-white">
                    {award.playerName}
                  </p>
                  <p className="mt-1 font-body text-sm text-mute">{award.detail}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

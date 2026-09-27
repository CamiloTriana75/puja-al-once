import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCeremonySteps, ceremonyPoints, computeAwards, type CeremonyStep } from "../net/ceremony.js";
import type { ClientState } from "../net/types.js";

/**
 * Duraciones de design-system/pages/ceremonia.md: entrada ~1.5s, cada paso
 * de puesto ~3s (con el destape de rating a los ~0.8s), campeon y premios
 * con sus propios tiempos de lectura. Cada cliente reproduce la ceremonia
 * por su cuenta al entrar en RESULTS -- no hay coordinacion de servidor, asi
 * que estos numeros son enteramente del cliente.
 */
export const INTRO_MS = 1500;
export const STEP_MS = 3000;
export const REVEAL_DELAY_MS = 800;
export const CHAMPION_MS = 3400;
export const AWARDS_MS = 4200;

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
}: {
  entry: CeremonyStep["entries"][number];
  revealRating: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <li
      className={`panel flex items-center justify-between gap-4 bg-ink px-5 py-4 ${
        entry.wins && revealRating ? "ring-2 ring-lime" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-extrabold uppercase tracking-wide text-white">
          {entry.card.name} <span className="tnum text-mute">{entry.card.season}</span>
        </p>
        <p className="truncate font-body text-sm text-mute">
          {entry.playerName} · {entry.card.price} M
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {entry.wins && revealRating && (
          <span className="bg-lime px-2 py-1 font-display text-xs font-black uppercase tracking-wide text-ink">
            Gana
          </span>
        )}
        <motion.span
          key={revealRating ? "revealed" : "hidden"}
          initial={reducedMotion ? false : { opacity: 0, rotateX: revealRating ? -90 : 0 }}
          animate={{ opacity: 1, rotateX: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`tnum font-display text-4xl font-black ${revealRating ? "text-lime" : "text-mute"}`}
        >
          {revealRating ? entry.card.rating : "?"}
        </motion.span>
      </div>
    </li>
  );
}

interface Props {
  state: ClientState;
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
export function Ceremony({ state, onFinished }: Props) {
  const reducedMotion = useReducedMotion();
  const steps = useMemo(() => buildCeremonySteps(state), [state]);
  const players = useMemo(() => [...state.players.values()], [state]);
  const awards = useMemo(() => computeAwards(state), [state]);

  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [ratingRevealed, setRatingRevealed] = useState(false);
  const [scoreboard, setScoreboard] = useState<Map<string, number>>(
    () => new Map(players.map((p) => [p.playerId, 0])),
  );
  const [announcement, setAnnouncement] = useState("");

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
            setScoreboard((prev) => {
              const next = new Map(prev);
              const share = winners.length > 0 ? 1 / winners.length : 0;
              for (const w of winners) next.set(w.playerId, (next.get(w.playerId) ?? 0) + share);
              return next;
            });
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
      advance({ kind: "done" }, AWARDS_MS);
    } else if (stage.kind === "done") {
      onFinished();
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, steps, revealDelay]);

  const champion = useMemo(() => {
    let best: { playerId: string; name: string; points: number } | null = null;
    for (const p of players) {
      const points = scoreboard.get(p.playerId) ?? 0;
      if (!best || points > best.points) best = { playerId: p.playerId, name: p.name, points };
    }
    return best;
  }, [players, scoreboard]);

  const skip = () => setStage({ kind: "done" });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-deep">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={skip}
          className="flex h-11 min-w-[44px] cursor-pointer items-center gap-2 border-2 border-white/30 px-4 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors duration-200 hover:border-lime hover:text-lime"
        >
          <SkipIcon />
          Saltar ceremonia
        </button>
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
                {scoreboard.get(p.playerId) ?? 0}
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
              className="w-full max-w-2xl"
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
                <ul className="flex flex-col gap-px bg-white/10">
                  {steps[stage.index]!.entries.map((entry) => (
                    <CeremonyCard key={entry.playerId} entry={entry} revealRating={ratingRevealed || reducedMotion === true} />
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {stage.kind === "champion" && champion && (
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
                Campeón
              </motion.p>
              <motion.h1
                initial={reducedMotion ? false : { opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : 0.15 }}
                className="font-display text-[clamp(2.5rem,10vw,7rem)] font-black uppercase leading-[0.85] tracking-tighter text-lime"
              >
                {champion.name}
              </motion.h1>
              <p className="tnum mt-2 font-display text-2xl font-extrabold text-white">{champion.points} pts</p>
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

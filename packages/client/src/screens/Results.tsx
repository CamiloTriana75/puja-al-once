import { motion, useReducedMotion } from "framer-motion";
import { Crown, Hourglass, Repeat2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Ceremony } from "../components/Ceremony.js";
import { GameHeader } from "../components/game/GameHeader.js";
import { SquadGrid } from "../components/SquadGrid.js";
import { buildCeremonySteps } from "../net/ceremony.js";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState;
  myId: string;
  roomId: string;
  send: (type: string, payload?: unknown) => void;
}

const pointLabel = (points: number) => points.toLocaleString("es-CO", { maximumFractionDigits: 2 });

export function Results({ state, myId, roomId, send }: Props) {
  // Mismo criterio que la ceremonia: un puesto lo gana el mejor rating (los empates lo comparten).
  const won = useMemo(() => {
    const byPlayer = new Map<string, Set<string>>();
    for (const player of state.players.values()) byPlayer.set(player.playerId, new Set());
    for (const step of buildCeremonySteps(state)) {
      for (const entry of step.entries) {
        if (entry.wins) byPlayer.get(entry.playerId)?.add(step.slot);
      }
    }
    return byPlayer;
  }, [state]);

  const isHost = myId === state.hostId;
  const reducedMotion = useReducedMotion() ?? false;
  const hostName = state.players.get(state.hostId)?.name ?? "el anfitrión";
  const [ceremonyDone, setCeremonyDone] = useState(false);

  if (!ceremonyDone) {
    return <Ceremony state={state} roomId={roomId} onFinished={() => setCeremonyDone(true)} />;
  }

  const ordered = [...state.players.values()].sort((a, b) => {
    const ra = state.standings.find((row) => row.playerId === a.playerId)?.rank ?? 99;
    const rb = state.standings.find((row) => row.playerId === b.playerId)?.rank ?? 99;
    return ra - rb;
  });

  return (
    <div className="min-h-screen bg-canvas text-forest">
      <GameHeader roomCode={state.roomCode} visibility={state.visibility}>
        <p className="truncate text-center font-copy text-[1rem] font-semibold">Resultados</p>
      </GameHeader>

      <div className="mx-auto w-full max-w-[76rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-headline text-[clamp(2.2rem,5vw,3.8rem)] font-bold leading-[1] tracking-[-0.055em]">Resultados</h1>
          {/* D5: el anfitrion reinicia con los mismos jugadores; el resto ve en que se espera. */}
          {isHost ? (
            <motion.button
              type="button"
              onClick={() => send("rematch", {})}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="flex h-14 min-w-[44px] cursor-pointer items-center gap-2 rounded-full bg-pitch px-7 font-copy text-[1.08rem] font-semibold text-white transition-colors duration-200 hover:bg-[#106E3D]"
            >
              <Repeat2 className="h-5 w-5" aria-hidden="true" />
              Revancha
            </motion.button>
          ) : (
            <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 font-copy text-[1rem] text-slate ring-1 ring-line">
              <Hourglass className="h-4 w-4" aria-hidden="true" />
              Esperando a que {hostName} pida la revancha…
            </p>
          )}
        </div>

        <ol className="mt-8 grid gap-3" aria-label="Clasificación final">
          {state.standings.map((row) => {
            const champion = row.rank === 1;
            return (
              <li
                key={row.playerId}
                className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[1.5rem] px-6 py-5 ${
                  champion ? "on-dark bg-forest text-white" : "bg-white ring-1 ring-line"
                }`}
              >
                <span
                  className={`tnum grid h-14 w-14 place-items-center rounded-2xl font-headline text-[1.6rem] font-bold ${
                    champion ? "bg-gold text-forest" : "bg-canvas text-forest"
                  }`}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-2 font-headline text-[clamp(1.3rem,2.6vw,1.8rem)] font-bold tracking-[-0.04em] ${champion ? "text-gold" : "text-forest"}`}>
                    {champion && <Crown className="h-6 w-6" aria-hidden="true" />}
                    {state.players.get(row.playerId)?.name}
                  </span>
                  <span className={`tnum block font-copy text-[0.98rem] ${champion ? "text-white/80" : "text-slate"}`}>
                    rating total {row.totalRating}, {row.budgetLeft} M sin gastar
                  </span>
                </span>
                <span className={`tnum font-headline text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.05em] ${champion ? "text-white" : "text-forest"}`}>
                  {pointLabel(row.points)} <span className="font-copy text-[0.6em] font-medium">pts</span>
                </span>
              </li>
            );
          })}
        </ol>

        <h2 className="mt-12 font-headline text-[clamp(1.5rem,2.8vw,2rem)] font-bold tracking-[-0.045em]">Los onces</h2>
        <p className="mt-2 font-copy text-[1.05rem] text-slate">Formación 4-3-3. En dorado, los puestos que cada uno ganó con el mejor rating.</p>
        <div className="mx-auto mt-6 grid max-w-[50rem] gap-6 md:grid-cols-2">
          {ordered.map((player) => {
            const rank = state.standings.find((row) => row.playerId === player.playerId)?.rank;
            const wins = won.get(player.playerId)?.size ?? 0;
            return (
              <section
                key={player.playerId}
                className={`rounded-[2rem] p-4 sm:p-5 ${rank === 1 ? "bg-gold shadow-[0_36px_60px_-38px_rgba(122,75,0,.9)]" : "bg-white ring-1 ring-line"}`}
                aria-labelledby={`squad-${player.playerId}`}
              >
                <h3 id={`squad-${player.playerId}`} className="mb-4 flex items-center gap-3 px-1">
                  {rank !== undefined && (
                    <span className="tnum grid size-11 shrink-0 place-items-center rounded-2xl bg-forest font-headline text-[1.2rem] font-bold text-gold">{rank}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-headline text-[1.35rem] font-bold tracking-[-0.04em] text-forest">{player.name}</span>
                  <span className="tnum shrink-0 font-copy text-[1rem] font-medium text-forest/80">
                    {wins} {wins === 1 ? "puesto ganado" : "puestos ganados"}
                  </span>
                </h3>
                <SquadGrid player={player} revealedCards={state.revealedCards} wonSlots={won.get(player.playerId)} />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

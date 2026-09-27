import { useState } from "react";
import { Ceremony } from "../components/Ceremony.js";
import { SquadGrid } from "../components/SquadGrid.js";
import type { ClientState } from "../net/types.js";

const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

/** Recalcula, solo para pintar, que huecos gano cada jugador. */
function wonSlotsByPlayer(state: ClientState): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const player of state.players.values()) result.set(player.playerId, new Set());

  for (const slot of SLOTS) {
    const holders = [...state.players.values()]
      .map((p) => ({ id: p.playerId, card: p.squad.get(slot) }))
      .filter((h): h is { id: string; card: string } => h.card !== undefined)
      .map((h) => ({ id: h.id, rating: state.revealedCards.get(h.card)?.rating ?? -1 }));

    if (holders.length === 0) continue;
    const best = Math.max(...holders.map((h) => h.rating));
    for (const holder of holders) {
      if (holder.rating === best) result.get(holder.id)?.add(slot);
    }
  }
  return result;
}

interface Props {
  state: ClientState;
  myId: string;
  send: (type: string, payload?: unknown) => void;
}

export function Results({ state, myId, send }: Props) {
  const won = wonSlotsByPlayer(state);
  const isHost = myId === state.hostId;
  const hostName = state.players.get(state.hostId)?.name ?? "el anfitrión";

  // design-system/pages/ceremonia.md: la ceremonia corre una vez por
  // cliente al entrar en RESULTS, antes de esta misma tabla -- nunca
  // mostrar la clasificacion final antes de terminar los once pasos
  // ("mata la tension"). `ceremonyDone` empieza en false en cada montaje;
  // Results.tsx solo se monta al entrar en RESULTS (ver App.tsx), asi que
  // no hace falta distinguir "ya la vi antes" de "acabo de llegar".
  const [ceremonyDone, setCeremonyDone] = useState(false);

  if (!ceremonyDone) {
    return <Ceremony state={state} onFinished={() => setCeremonyDone(true)} />;
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-black uppercase leading-none tracking-tighter text-lime">
          Resultados
        </h1>
        {/*
          D5: el anfitrion reinicia la sala con los mismos jugadores, sin
          crear otra ni repartir otro codigo (AuctionRoom.onRematch acepta
          "rematch" solo del anfitrion y solo en RESULTS). El resto ve el
          mismo momento en modo lectura -- nunca un boton muerto para ellos,
          la frase dice exactamente que esta pasando.
        */}
        {isHost ? (
          <button
            type="button"
            onClick={() => send("rematch", {})}
            className="h-12 min-w-[44px] cursor-pointer bg-lime px-6 font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
          >
            Revancha
          </button>
        ) : (
          <p className="bg-ink px-3 py-2 font-body text-sm font-semibold text-mute">
            Esperando a que {hostName} pida la revancha…
          </p>
        )}
      </div>

      <ol className="mb-10 flex flex-col gap-px bg-white/10">
        {state.standings.map((row) => {
          const champion = row.rank === 1;
          return (
            <li
              key={row.playerId}
              className={`flex flex-wrap items-baseline gap-x-4 px-5 py-4 ${champion ? "bg-green text-ink" : "bg-ink text-white"}`}
            >
              <span className="font-display text-3xl font-black tnum">{row.rank}</span>
              <span className="font-display text-2xl font-extrabold uppercase tracking-wide">
                {state.players.get(row.playerId)?.name}
              </span>
              <span className={`tnum ml-auto font-display text-3xl font-black ${champion ? "text-ink" : "text-lime"}`}>
                {row.points} pts
              </span>
              <span className={`tnum w-full font-body text-sm ${champion ? "text-ink/70" : "text-mute"}`}>
                rating total {row.totalRating} · {row.budgetLeft} M sin gastar
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...state.players.values()].map((player) => (
          <div key={player.playerId} className="panel bg-ink p-3 pb-8">
            <h2 className="mb-3 font-display text-xl font-extrabold uppercase tracking-wide text-green">
              {player.name}
            </h2>
            <SquadGrid
              player={player}
              revealedCards={state.revealedCards}
              wonSlots={won.get(player.playerId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

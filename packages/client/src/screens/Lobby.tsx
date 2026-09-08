import { useEffect, useState } from "react";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState | null;
  error: string | null;
  onJoin: (name: string) => void;
  onReady: () => void;
}

export function Lobby({ state, error, onJoin, onReady }: Props) {
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  // "ready" es optimista: se marca al pulsar, antes de que el servidor
  // conteste. Si el servidor rechaza el arranque (p.ej. el mazo no alcanza
  // para el hueco -- ver AuctionRoom.tryStartRound, que hace
  // broadcast("error", ...) y limpia su propio `ready` para poder
  // reintentar), sin este efecto el boton se queda inutilizable para
  // siempre del lado del cliente aunque el servidor ya haya vuelto a
  // aceptar "ready".
  useEffect(() => {
    if (error) setReady(false);
  }, [error]);

  if (!state) {
    return (
      <form
        className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onJoin(name.trim());
        }}
      >
        <h1 className="font-display text-[clamp(3rem,10vw,6rem)] font-black uppercase leading-[0.85] tracking-tighter">
          <span className="text-lime">Subasta</span>
          <br />
          <span className="text-white">Futbolera</span>
        </h1>
        <label className="sr-only" htmlFor="player-name">
          Tu nombre
        </label>
        <input
          id="player-name"
          className="h-12 border-2 border-white/20 bg-ink px-3 font-display text-xl font-bold text-white"
          placeholder="Tu nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
        >
          Entrar
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6">
      <h2 className="font-display text-3xl font-black uppercase tracking-wide text-white">
        Sala ({state.players.size}/4)
      </h2>
      <ul className="flex flex-col gap-px bg-white/10">
        {[...state.players.values()].map((player) => (
          <li key={player.playerId} className="flex justify-between bg-ink px-4 py-3">
            <span className="font-display text-lg font-bold uppercase text-white">
              {player.name}
              {player.rejoinPending && (
                <span className="ml-2 text-sm font-semibold normal-case text-mute">(reconectando)</span>
              )}
              {!player.connected && !player.rejoinPending && (
                <span className="ml-2 text-sm font-semibold normal-case text-danger">(desconectado)</span>
              )}
            </span>
            <span className="tnum font-display text-lg font-extrabold text-green">{player.budget} M</span>
          </li>
        ))}
      </ul>
      <button
        className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={ready}
        onClick={() => {
          setReady(true);
          onReady();
        }}
      >
        {ready ? "Esperando al resto…" : "Listo"}
      </button>
    </div>
  );
}

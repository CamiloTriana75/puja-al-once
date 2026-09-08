import { useEffect, useState } from "react";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState | null;
  error: string | null;
  onCreate: (name: string) => void;
  onJoinByCode: (name: string, code: string) => void;
  onReady: () => void;
}

/** Icono de copiar, trazo 2 sobre viewBox 24x24 -- MASTER.md S7: SVG de Lucide, nunca emojis. */
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Codigo de sala en grande, con boton de copiar. Vive en su propio panel para que no se confunda con el resto de la lista de espera. */
function RoomCodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  // El "¡Copiado!" es transitorio a proposito: confirma la accion sin dejar
  // un estado que alguien tenga que deshacer a mano.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Portapapeles sin permiso o sin API (http no seguro, navegador
      // viejo): el codigo sigue legible y seleccionable a mano justo
      // encima, asi que el fallo no deja a nadie sin forma de compartirlo.
    }
  };

  return (
    <div className="panel flex items-center justify-between gap-4 bg-ink p-4">
      <div>
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-mute">Código de la sala</p>
        <p className="tnum font-display text-[clamp(2rem,8vw,3rem)] font-black tracking-[0.08em] text-lime">{code}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 border-2 border-white/20 px-3 text-white transition-colors duration-200 hover:border-lime hover:text-lime"
        aria-label={copied ? "Código copiado" : "Copiar código"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span aria-live="polite" className="font-body text-sm font-semibold">
          {copied ? "¡Copiado!" : "Copiar"}
        </span>
      </button>
    </div>
  );
}

/** Elegir entre crear sala o unirse con un codigo, antes de pedir el nombre. */
function EntryForm({ error, onCreate, onJoinByCode }: Omit<Props, "state" | "onReady">) {
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
    <form className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6" onSubmit={submit}>
      <h1 className="font-display text-[clamp(3rem,10vw,6rem)] font-black uppercase leading-[0.85] tracking-tighter">
        <span className="text-lime">Subasta</span>
        <br />
        <span className="text-white">Futbolera</span>
      </h1>

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

      <label className="sr-only" htmlFor="player-name">
        Tu nombre
      </label>
      <input
        id="player-name"
        className="h-12 border-2 border-white/20 bg-ink px-3 font-display text-xl font-bold text-white placeholder:text-mute"
        placeholder="Tu nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
      />

      {mode === "join" && (
        <>
          <label className="sr-only" htmlFor="room-code">
            Código de la sala
          </label>
          <input
            id="room-code"
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
        className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
      >
        {mode === "create" ? "Crear sala" : "Entrar"}
      </button>
    </form>
  );
}

export function Lobby({ state, error, onCreate, onJoinByCode, onReady }: Props) {
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
    return <EntryForm error={error} onCreate={onCreate} onJoinByCode={onJoinByCode} />;
  }

  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6">
      <RoomCodePanel code={state.roomCode} />
      <h2 className="font-display text-3xl font-black uppercase tracking-wide text-white">
        Sala ({state.players.size}/4)
      </h2>
      <ul className="flex flex-col gap-px bg-white/10">
        {[...state.players.values()].map((player) => (
          <li key={player.playerId} className="flex justify-between bg-ink px-4 py-3">
            <span className="font-display text-lg font-bold uppercase text-white">
              {player.name}
              {player.playerId === state.hostId && (
                <span className="ml-2 text-sm font-semibold normal-case text-lime">(anfitrión)</span>
              )}
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
      {error && <p className="font-body text-sm font-semibold text-danger">{error}</p>}
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

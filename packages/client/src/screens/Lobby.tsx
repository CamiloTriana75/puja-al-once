import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ClientState, PlayerView } from "../net/types.js";

interface Props {
  state: ClientState | null;
  error: string | null;
  onCreate: (name: string) => void;
  onJoinByCode: (name: string, code: string) => void;
  onReady: () => void;
}

/**
 * Fijo a la regla real del servidor: `AuctionRoom.maxClients = 4` (Task B3
 * -- "de 2 a 6 jugadores" -- quedo cancelada el 2026-09-08; la beta se
 * queda en 4). Vive aqui y no se deriva de nada del Schema porque el
 * Schema no expone maxClients -- si algun dia vuelve a subir, este es el
 * unico sitio que hay que tocar en el cliente.
 */
const MAX_PLAYERS = 4;
/** AuctionRoom.allConnectedPlayersReady() exige minimo 2 conectados. */
const MIN_PLAYERS_TO_START = 2;

/**
 * Que falta exactamente para poder arrancar -- design-system/pages/sala-espera.md:
 * "Una frase que diga exactamente que bloquea el arranque... Nunca un boton
 * deshabilitado sin explicacion." Espejo en el cliente de
 * AuctionRoom.allConnectedPlayersReady(): connectedPlayers.length >= 2 y
 * todos los conectados con `ready`. Los desconectados NUNCA bloquean --
 * igual que el servidor, que solo evalua sobre `p.connected`.
 */
function startBlockReason(players: PlayerView[]): string | null {
  const connected = players.filter((p) => p.connected);
  if (connected.length < MIN_PLAYERS_TO_START) {
    const missing = MIN_PLAYERS_TO_START - connected.length;
    return `Hacen falta ${missing} jugador${missing === 1 ? "" : "es"} más para poder empezar.`;
  }
  const notReady = connected.filter((p) => !p.ready).length;
  if (notReady > 0) {
    return `Falta${notReady === 1 ? "" : "n"} ${notReady} jugador${notReady === 1 ? "" : "es"} por estar listo${notReady === 1 ? "" : "s"}.`;
  }
  return null;
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

/** Icono de hueco libre (usuario en trazo discontinuo), trazo 2 sobre 24x24 -- MASTER.md S7: SVG, nunca emoji. */
function EmptySeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Icono de reloj (esperando/reconectando), trazo 2 sobre 24x24 -- MASTER.md S7: SVG, nunca emoji. Distingue "esperando" de "listo" tambien por forma, no solo por color/texto. */
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
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

/**
 * Contador enorme "N de M listos" -- el requisito explicito del encargo:
 * "quien ya pulso Listo tiene que ser imposible de no ver". Vive encima de
 * la lista, a la misma escala tipografica que la cifra heroica de
 * MASTER.md S3 (la del precio en la subasta), porque es el dato mas
 * importante de esta pantalla mientras se espera.
 *
 * Cuenta sobre CONECTADOS (mismo universo que startBlockReason /
 * AuctionRoom.allConnectedPlayersReady): un jugador desconectado no cuenta
 * como "falta por estar listo", ya esta descontado del denominador.
 *
 * Uno de los DOS elementos animados de esta vista (MASTER.md S5): al subir
 * el numero de listos, un destello lima breve + una subida de 6px marca el
 * cambio -- igual de discreto que "puja aceptada" en la tabla de movimiento
 * de partida. Sin movimiento reducido, el numero simplemente cambia.
 */
function ReadyCounter({ readyCount, connectedCount }: { readyCount: number; connectedCount: number }) {
  const allReady = connectedCount > 0 && readyCount === connectedCount;
  return (
    <div className={`panel flex items-center gap-4 px-6 py-5 ${allReady ? "bg-lime" : "bg-ink"}`}>
      <motion.p
        key={readyCount}
        initial={{ opacity: 0.4, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`tnum font-display text-[clamp(3rem,11vw,4.5rem)] font-black leading-none ${allReady ? "text-ink" : "text-lime"}`}
        aria-hidden="true"
      >
        {readyCount}/{connectedCount}
      </motion.p>
      <div>
        <p className={`font-display text-2xl font-black uppercase leading-none tracking-tight ${allReady ? "text-ink" : "text-white"}`}>
          {allReady ? "Todos listos" : "Listos para empezar"}
        </p>
        {/* aria-live: el numero de arriba es aria-hidden porque este texto ya lo dice completo para lectores de pantalla. */}
        <p aria-live="polite" className={`font-body text-sm font-semibold ${allReady ? "text-ink/70" : "text-mute"}`}>
          {connectedCount === 0
            ? "Esperando jugadores…"
            : `${readyCount} de ${connectedCount} jugador${connectedCount === 1 ? "" : "es"} conectado${connectedCount === 1 ? "" : "s"} ${readyCount === 1 ? "ha" : "han"} pulsado listo.`}
        </p>
      </div>
    </div>
  );
}

/**
 * Una fila del roster -- reescrita para que el estado "listo" sea imposible
 * de no ver (el encargo explicito de esta tarea): antes era una etiqueta
 * pequena a la derecha del nombre, ahora el bloque ENTERO de la fila cambia
 * a lima solido con icono + texto grande cuando el jugador esta listo, del
 * mismo peso visual que la etiqueta "GANANDO" de la subasta pero a escala
 * de fila completa, no de chip.
 *
 * `layout` (Framer) anima la reordenacion si el array de jugadores cambia
 * de orden entre renders (no ocurre hoy -- el servidor no reordena -- pero
 * cubre el caso sin coste); la transicion real que se ve es el color/icono
 * de fondo cruzando de --ink a --lime cuando `ready` pasa a true: el
 * jugador "confirmandose", segundo de los dos elementos animados de esta
 * vista.
 */
function PlayerRow({ player, isHost }: { player: PlayerView; isHost: boolean }) {
  const reducedMotion = useReducedMotion();

  let stateBlock: React.ReactNode;
  if (player.rejoinPending) {
    stateBlock = (
      <span className="flex h-11 shrink-0 items-center gap-2 border-2 border-white/20 px-4 font-display text-sm font-black uppercase tracking-wide text-mute">
        <ClockIcon />
        Reconectando
      </span>
    );
  } else if (!player.connected) {
    stateBlock = (
      <span className="flex h-11 shrink-0 items-center gap-2 border-2 border-danger/60 px-4 font-display text-sm font-black uppercase tracking-wide text-danger">
        Desconectado
      </span>
    );
  } else if (player.ready) {
    stateBlock = (
      <motion.span
        layout="position"
        initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex h-11 shrink-0 items-center gap-2 bg-lime px-4 font-display text-sm font-black uppercase tracking-wide text-ink"
      >
        <CheckIcon />
        Listo
      </motion.span>
    );
  } else {
    stateBlock = (
      <span className="flex h-11 shrink-0 items-center gap-2 border-2 border-white/20 px-4 font-display text-sm font-black uppercase tracking-wide text-mute">
        <ClockIcon />
        Esperando
      </span>
    );
  }

  return (
    <motion.li
      layout
      initial={reducedMotion ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${player.ready ? "bg-lime/10" : "bg-ink"}`}
    >
      <span className="font-display text-xl font-bold uppercase text-white">
        {player.name}
        {isHost && <span className="ml-2 text-sm font-semibold normal-case text-lime">(anfitrión)</span>}
      </span>
      {stateBlock}
    </motion.li>
  );
}

export function Lobby({ state, error, onCreate, onJoinByCode, onReady }: Props) {
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

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

  const players = [...state.players.values()];
  const emptySeats = Math.max(0, MAX_PLAYERS - players.length);
  const blockReason = startBlockReason(players);
  const connectedPlayers = players.filter((p) => p.connected);
  const readyPlayers = connectedPlayers.filter((p) => p.ready);

  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6">
      <RoomCodePanel code={state.roomCode} />

      {/* El requisito explicito de este encargo: "quien ya pulso Listo
          tiene que ser imposible de no ver". El contador va ANTES de la
          lista, a la misma escala que la cifra heroica de MASTER.md S3. */}
      <ReadyCounter readyCount={readyPlayers.length} connectedCount={connectedPlayers.length} />

      <h2 className="font-display text-3xl font-black uppercase tracking-wide text-white">
        Sala ({players.length}/{MAX_PLAYERS})
      </h2>
      <ul className="flex flex-col gap-px bg-white/10">
        <AnimatePresence initial={false}>
          {players.map((player) => (
            <PlayerRow key={player.playerId} player={player} isHost={player.playerId === state.hostId} />
          ))}
        </AnimatePresence>
        {/* Los huecos libres se dibujan como huecos, nunca se omiten
            (design-system/pages/sala-espera.md): ver "2 de 4" en abstracto
            informa menos que ver dos sitios vacios de verdad. */}
        {Array.from({ length: emptySeats }, (_, index) => (
          // bg-ink, no transparente: MASTER.md S2 -- "--mute solo sobre
          // --ink" es una regla dura del proyecto (ya hubo que arreglar
          // cinco sitios donde se colo sobre el fondo de pagina). Un fondo
          // transparente aqui dejaria el texto mute directamente sobre
          // --deep (el fondo de <main>), que es justo ese patron.
          <li
            key={`empty-${index}`}
            className="flex items-center gap-2 border border-dashed border-white/20 bg-ink px-4 py-3"
          >
            <EmptySeatIcon />
            <span className="font-display text-sm font-bold uppercase tracking-wide text-mute">
              Hueco libre
            </span>
          </li>
        ))}
      </ul>

      {/* Nunca un boton deshabilitado sin explicacion: la frase dice
          exactamente que falta, o confirma que ya se puede. */}
      <p className="bg-ink px-3 py-2 font-body text-sm font-semibold text-white">
        {blockReason ?? "Ya podéis empezar en cuanto pulséis listo."}
      </p>

      {error && <p className="font-body text-sm font-semibold text-danger">{error}</p>}
      <motion.button
        whileTap={reducedMotion || ready ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.1 }}
        className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={ready}
        onClick={() => {
          setReady(true);
          onReady();
        }}
      >
        {ready ? "Esperando al resto…" : "Listo"}
      </motion.button>
    </div>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Crown, Globe, Hourglass, Link2, Lock, UserMinus, UserPlus, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EarlyAccessNotice } from "../components/EarlyAccessNotice.js";
import { GameHeader } from "../components/game/GameHeader.js";
import type { ClientState, PlayerView } from "../net/types.js";

interface Props {
  state: ClientState | null;
  error: string | null;
  onCreate: (name: string) => void;
  onJoinByCode: (name: string, code: string) => void;
  onReady: () => void;
  /** Mi propio sessionId (room.sessionId): para no ofrecer "expulsar" sobre mi fila. */
  myId: string;
  /** Expulsa a un jugador de la sala de espera (mensaje "kick" al servidor). */
  onKick: (playerId: string) => void;
}

/** Fijo a la regla real del servidor: `AuctionRoom.maxClients = 4`. */
const MAX_PLAYERS = 4;
/** AuctionRoom.allConnectedPlayersReady() exige minimo 2 conectados. */
const MIN_PLAYERS_TO_START = 2;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Que falta exactamente para arrancar: espejo de allConnectedPlayersReady().
 * Los desconectados nunca bloquean, igual que en el servidor.
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

function initials(name: string): string {
  return name.trim().split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
}

/** El billete de la sala: el codigo en fichas grandes para dictarlo, y el enlace listo para copiar de un clic. */
function RoomTicket({ code, visibility }: { code: string; visibility: "private" | "public" }) {
  const [copied, setCopied] = useState<"link" | "code" | "failed" | null>(null);
  const link = new URL(`/sala/${code}`, window.location.origin).toString();
  const linkField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2400);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async (text: string, what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // Sin permiso de portapapeles: se deja el enlace seleccionado para copiarlo a mano.
      linkField.current?.select();
      setCopied("failed");
    }
  };

  return (
    <section aria-labelledby="ticket-title" className="rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-40px_rgba(12,36,28,.55)] ring-1 ring-line sm:p-8">
      <h2 id="ticket-title" className="font-copy text-[1.05rem] text-slate">Invita a tu grupo</h2>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-canvas p-1.5 ring-1 ring-line">
        <input
          ref={linkField}
          readOnly
          value={link}
          aria-label="Enlace de invitación"
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 min-w-0 flex-1 truncate bg-transparent px-3 font-copy text-[1rem] text-forest"
        />
        <button
          type="button"
          onClick={() => void copy(link, "link")}
          className={`flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 font-copy text-[1rem] font-semibold text-white transition-colors duration-200 ${
            copied === "link" ? "bg-forest" : "bg-pitch hover:bg-[#106E3D]"
          }`}
        >
          {copied === "link" ? <Check className="size-5" aria-hidden="true" /> : <Link2 className="size-5" aria-hidden="true" />}
          {copied === "link" ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-6 font-copy text-[0.95rem] text-pitch">
        {copied === "link"
          ? "Enlace copiado: pégalo en el chat y quien lo abra entra directo."
          : copied === "code"
            ? "Código copiado."
            : copied === "failed"
              ? "No se pudo copiar solo: el enlace está seleccionado, usa Ctrl+C."
              : ""}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-copy text-[0.98rem] text-slate">O dicta el código:</p>
        <button
          type="button"
          onClick={() => void copy(code, "code")}
          aria-label="Copiar código de sala"
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 font-copy text-[0.98rem] font-medium text-slate transition-colors duration-200 hover:bg-canvas hover:text-forest"
        >
          {copied === "code" ? <Check className="size-4 text-pitch" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          Copiar código
        </button>
      </div>
      <p className="mt-1 flex gap-2" aria-label={`Código ${code.split("").join(" ")}`}>
        {code.split("").map((char, index) => (
          <span
            key={`${char}-${index}`}
            aria-hidden="true"
            className="grid h-[clamp(3.2rem,5.5vw,4.2rem)] flex-1 place-items-center rounded-2xl bg-forest font-headline text-[clamp(1.6rem,3vw,2.3rem)] font-bold text-gold"
          >
            {char}
          </span>
        ))}
      </p>
      <p className="mt-4 flex items-center gap-2 font-copy text-[1rem] text-slate">
        {visibility === "public" ? <Globe className="h-4 w-4 text-pitch" aria-hidden="true" /> : <Lock className="h-4 w-4 text-pitch" aria-hidden="true" />}
        {visibility === "public" ? "Pública: aparece en el vestuario mientras haya sitio." : "Privada: solo entra quien tenga el enlace o el código."}
      </p>
    </section>
  );
}

/** El marcador de listos: lo que más importa mientras se espera. */
function ReadyBoard({ players }: { players: PlayerView[] }) {
  const reducedMotion = useReducedMotion() ?? false;
  const connected = players.filter((p) => p.connected);
  const ready = connected.filter((p) => p.ready);
  const allReady = connected.length >= MIN_PLAYERS_TO_START && ready.length === connected.length;

  return (
    <section aria-label="Jugadores listos" className="on-dark rounded-[2rem] bg-forest p-6 text-white sm:p-8">
      <div className="flex items-end gap-4">
        <motion.p
          key={ready.length}
          initial={reducedMotion ? false : { y: 10, opacity: 0.3 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          aria-hidden="true"
          className={`tnum font-headline text-[clamp(3.4rem,6vw,4.8rem)] font-bold leading-none tracking-[-0.06em] ${allReady ? "text-gold" : "text-white"}`}
        >
          {ready.length}/{connected.length}
        </motion.p>
        <p className="pb-2 font-copy text-[1.1rem] leading-snug text-white/85">{allReady ? "Todos listos: arranca" : "listos para empezar"}</p>
      </div>
      <div aria-hidden="true" className="mt-5 flex gap-1.5">
        {connected.map((player) => (
          <span key={player.playerId} className={`h-2 flex-1 rounded-full transition-colors duration-300 ${player.ready ? "bg-gold" : "bg-white/15"}`} />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {`${ready.length} de ${connected.length} jugador${connected.length === 1 ? "" : "es"} conectado${connected.length === 1 ? "" : "s"} ${ready.length === 1 ? "ha" : "han"} pulsado listo.`}
      </p>
    </section>
  );
}

function SeatState({ player }: { player: PlayerView }) {
  if (player.rejoinPending) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-canvas px-3 py-1 font-copy text-[0.92rem] font-semibold text-slate ring-1 ring-line">
        <Hourglass className="h-4 w-4" aria-hidden="true" />
        Reconectando
      </span>
    );
  }
  if (!player.connected) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-alert/10 px-3 py-1 font-copy text-[0.92rem] font-semibold text-alert">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        Desconectado
      </span>
    );
  }
  if (player.ready) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-pitch px-3 py-1 font-copy text-[0.92rem] font-semibold text-white">
        <Check className="h-4 w-4" aria-hidden="true" />
        Listo
      </span>
    );
  }
  return (
    <span className="flex w-fit items-center gap-1.5 rounded-full bg-canvas px-3 py-1 font-copy text-[0.92rem] font-semibold text-slate ring-1 ring-line">
      <Hourglass className="h-4 w-4" aria-hidden="true" />
      Esperando
    </span>
  );
}

function Seat({ player, isHost, isMe, canKick, onKick }: { player: PlayerView; isHost: boolean; isMe: boolean; canKick: boolean; onKick: (playerId: string) => void }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.li
      layout
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`relative flex min-h-36 flex-col justify-between gap-4 rounded-[1.5rem] p-5 transition-[background-color,box-shadow] duration-300 ${
        player.ready && player.connected ? "bg-white shadow-[0_22px_40px_-28px_rgba(21,131,74,.9)] ring-2 ring-pitch" : "bg-white ring-1 ring-line"
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-headline text-[1rem] font-bold ${isMe ? "bg-gold text-forest" : "bg-forest text-white"}`}>
          {initials(player.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-copy text-[1.15rem] font-semibold text-forest">
            {player.name}
            {isMe && <span className="ml-1.5 font-normal text-slate">(tú)</span>}
          </p>
          {isHost && (
            <p className="mt-0.5 flex items-center gap-1 font-copy text-[0.92rem] text-gold-ink">
              <Crown className="h-4 w-4" aria-hidden="true" />
              Anfitrión
            </p>
          )}
        </div>
        {/* Solo el anfitrion lo ve, y nunca sobre su propia fila. El servidor lo vuelve a validar. */}
        {canKick && (
          <button
            type="button"
            onClick={() => onKick(player.playerId)}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-slate transition-colors duration-200 hover:bg-alert/10 hover:text-alert"
            aria-label={`Expulsar a ${player.name} de la sala`}
            title={`Expulsar a ${player.name}`}
          >
            <UserMinus className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <SeatState player={player} />
    </motion.li>
  );
}

export function Lobby({ state, error, onReady, myId, onKick }: Props) {
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

  // "ready" es optimista. Si el servidor rechaza el arranque (por ejemplo, el
  // mazo no alcanza), limpia su `ready` y manda error: el boton vuelve a valer.
  useEffect(() => {
    if (error) setReady(false);
  }, [error]);

  // La portada (Landing) cubre el caso sin sala.
  if (!state) return null;

  const players = [...state.players.values()];
  // El servidor manda: un jugador que vuelve a entrar ya listo no ve el botón activo.
  const iAmReady = ready || (state.players.get(myId)?.ready ?? false);
  const emptySeats = Math.max(0, MAX_PLAYERS - players.length);
  const blockReason = startBlockReason(players);

  return (
    <div className="min-h-screen bg-canvas text-forest">
      <EarlyAccessNotice />
      <GameHeader roomCode={state.roomCode} visibility={state.visibility}>
        <p className="truncate text-center font-copy text-[1rem] font-semibold text-forest">Sala de espera</p>
      </GameHeader>

      <div className="mx-auto grid w-full max-w-[76rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-6">
          <RoomTicket code={state.roomCode} visibility={state.visibility ?? "private"} />
          <ReadyBoard players={players} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-headline text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-[1.05] tracking-[-0.05em]">
              El vestuario <span className="tnum text-slate">{players.length}/{MAX_PLAYERS}</span>
            </h1>
            <p className="mt-2 font-copy text-[1.1rem] text-slate">La partida arranca sola cuando todos los conectados pulsan Listo.</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {players.map((player) => (
                <Seat
                  key={player.playerId}
                  player={player}
                  isHost={player.playerId === state.hostId}
                  isMe={player.playerId === myId}
                  canKick={myId === state.hostId && player.playerId !== myId}
                  onKick={onKick}
                />
              ))}
            </AnimatePresence>
            {/* Los huecos libres se dibujan: ver dos sitios vacíos informa más que "2 de 4". */}
            {Array.from({ length: emptySeats }, (_, index) => (
              <li key={`empty-${index}`} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-line text-slate">
                <UserPlus className="h-6 w-6" aria-hidden="true" />
                <span className="font-copy text-[1rem]">Hueco libre</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-5 ring-1 ring-line sm:flex-row sm:items-center sm:p-6">
            <p className="flex-1 font-copy text-[1.05rem] text-forest">{blockReason ?? "Todos listos: arrancando la partida."}</p>
            <motion.button
              whileTap={reducedMotion || iAmReady ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="flex h-14 min-w-[12rem] cursor-pointer items-center justify-center gap-2 rounded-full bg-pitch px-8 font-copy text-[1.1rem] font-semibold text-white transition-colors duration-200 hover:bg-[#106E3D] disabled:cursor-not-allowed disabled:bg-line disabled:text-slate"
              disabled={iAmReady}
              onClick={() => {
                setReady(true);
                onReady();
              }}
            >
              {iAmReady ? <Hourglass className="h-5 w-5" aria-hidden="true" /> : <Check className="h-5 w-5" aria-hidden="true" />}
              {iAmReady ? "Esperando al resto…" : "Estoy listo"}
            </motion.button>
          </div>
          {error && <p role="alert" className="rounded-2xl bg-alert/10 px-4 py-3 font-copy text-[1rem] font-medium text-alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

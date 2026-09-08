import { AuctionCard } from "../components/AuctionCard.js";
import { BidControls } from "../components/BidControls.js";
import { ClueRow } from "../components/ClueRow.js";
import { useServerClock } from "../net/useServerClock.js";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState;
  myId: string;
  /** Sala en curso: la URL de la silueta necesita roomId + publicId. */
  roomId: string;
  /** Rechazo de puja tipado por origen -- ver useRoom. Nunca el de arranque de ronda. */
  error: string | null;
  /** Cuenta de rechazos recibidos -- ver bidErrorSeq en useRoom. Se reenvia a BidControls tal cual. */
  errorSeq: number;
  send: (type: string, payload?: unknown) => void;
}

export function Auction({ state, myId, roomId, error, errorSeq, send }: Props) {
  const remaining = useServerClock(state.endsAt);
  const me = state.players.get(myId);
  const card = state.currentCard;

  const alreadySigned = me?.squad.has(state.currentSlot) ?? false;
  const restricted = state.restrictedBidders.length > 0 && !state.restrictedBidders.includes(myId);
  // Reingreso aparcado: el socket funciona pero esta ronda ya se repartio
  // sin contarte -- distinto de connected:false (ver PlayerView.rejoinPending).
  // Se desactiva el boton de antemano en vez de esperar al rechazo del
  // servidor, y se explica por que junto a los controles.
  const parked = me?.rejoinPending ?? false;
  const canBid = state.phase === "BIDDING" && !alreadySigned && !restricted && !parked;
  const urgent = remaining < 5000 && state.phase === "BIDDING";

  // Durante REVEAL, applyOutcome ya limpio currentBid/currentBidderId al
  // entrar en la fase (ver packages/shared/src/auction.ts): el desenlace de
  // "quien se la llevo y por cuanto" solo vive en revealedCards. MapSchema
  // conserva el orden de insercion, asi que el ultimo valor es siempre la
  // carta que se acaba de publicar -- no hace falta cruzar por cardId (que
  // el cliente ni siquiera puede usar como clave publica antes de esto).
  const lastReveal = state.phase === "REVEAL" ? [...state.revealedCards.values()].at(-1) : undefined;
  const revealWinner = lastReveal?.ownerId ? state.players.get(lastReveal.ownerId) : undefined;

  return (
    // pb-28 en movil: dead space para que la barra fija de puja (mas abajo)
    // no tape el ultimo bloque de contenido; sm: vuelve a flujo normal.
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 pb-28 sm:pb-6 md:p-6">
      {card && <AuctionCard card={card} price={state.currentBid || state.minimumBid} roomId={roomId} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {card && <ClueRow card={card} />}

          <div className="panel flex flex-wrap items-baseline gap-x-6 gap-y-2 bg-ink px-6 py-4 pr-12">
            <p className={`tnum font-display text-5xl font-black leading-none ${urgent ? "animate-pulse text-danger" : "text-lime"}`}>
              {(remaining / 1000).toFixed(1)}s
            </p>

            {state.phase === "REVEAL" ? (
              <p className="font-display text-xl font-bold uppercase tracking-wide text-white">
                {lastReveal?.ownerId ? (
                  <>
                    <span className="tnum text-green">{lastReveal.price} M</span>{" "}
                    <span className="text-mute">se lo lleva</span>{" "}
                    {revealWinner?.name ?? "un jugador"}
                  </>
                ) : (
                  <span className="text-mute">Nadie la quiso: se descarta</span>
                )}
              </p>
            ) : (
              <p className="font-display text-xl font-bold uppercase tracking-wide text-white">
                {state.currentBid > 0 ? (
                  <>
                    <span className="tnum text-green">{state.currentBid} M</span>{" "}
                    <span className="text-mute">va ganando</span>{" "}
                    {state.players.get(state.currentBidderId)?.name}
                  </>
                ) : (
                  <span className="text-mute">Nadie ha pujado todavía</span>
                )}
              </p>
            )}

            <p className="ml-auto font-body text-sm text-mute">
              Quedan {state.remainingCount} cartas en este puesto
            </p>
          </div>

          {/*
            MASTER.md S2: --mute solo va sobre --ink. bg-deep (el fondo de
            pagina que hay detras de esta columna) no cuenta -- de ahi el
            bloque bg-ink sin bisel (el bisel es la firma de los paneles de
            marca; estos son avisos de segundo orden, no la tarjeta).
          */}
          {alreadySigned && (
            <p className="bg-ink px-3 py-2 font-body text-sm text-mute">
              Ya fichaste para este puesto. Mira cómo se pelean los demás.
            </p>
          )}
          {parked && (
            <p className="bg-ink px-3 py-2 font-body text-sm text-mute">
              Te reconectaste: vuelves a contar a partir de la próxima ronda. Por ahora, mira.
            </p>
          )}

          {/*
            Barra fija en movil, dentro del pulgar (MASTER.md S8): la
            votacion de salto y los controles de puja comparten el mismo
            hueco porque nunca estan activos a la vez (fases distintas).
          */}
          <div className="sticky bottom-0 z-30 -mx-4 border-t border-white/10 bg-deep px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {state.phase === "SKIP_VOTE" ? (
              <div className="flex flex-col gap-2">
                <p className="font-display text-lg font-bold uppercase tracking-wide text-white">
                  Nadie pujó. ¿Se descarta esta carta?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => send("voteSkip", { skip: true })}
                    className="h-12 min-w-[44px] cursor-pointer bg-lime px-6 font-display text-xl font-black uppercase text-ink transition-colors duration-200 hover:bg-white"
                  >
                    Saltarla
                  </button>
                  <button
                    onClick={() => send("voteSkip", { skip: false })}
                    className="h-12 min-w-[44px] cursor-pointer border-2 border-white/30 px-6 font-display text-xl font-bold uppercase text-white transition-colors duration-200 hover:border-white"
                  >
                    La quiero
                  </button>
                </div>
                <p className="hidden bg-ink px-3 py-2 font-body text-sm text-mute sm:block">
                  Hace falta unanimidad. Si dices que la quieres, serás el único que pueda pujar por ella.
                </p>
              </div>
            ) : state.phase === "BIDDING" ? (
              <BidControls
                minimumBid={state.minimumBid}
                disabled={!canBid}
                error={error}
                errorSeq={errorSeq}
                onBid={(amount) => send("bid", { amount })}
              />
            ) : (
              <p className="bg-ink px-3 py-2 font-body text-sm text-mute">Revelando…</p>
            )}
          </div>
        </div>

        <ul className="flex flex-col gap-px bg-white/10">
          {[...state.players.values()].map((player) => {
            const leading = state.phase === "BIDDING" && player.playerId === state.currentBidderId;
            return (
              <li
                key={player.playerId}
                className={`flex items-center justify-between px-4 py-3 ${leading ? "bg-lime text-ink" : "bg-ink text-white"}`}
              >
                <span className="font-display text-lg font-bold uppercase">
                  {player.name}
                  {/* El color no es el unico indicador: la etiqueta de texto va siempre con el. */}
                  {leading && <span className="ml-2 text-xs font-black tracking-widest">GANANDO</span>}
                  {player.rejoinPending ? (
                    // --mute solo va sobre --ink (MASTER.md S2): esta fila
                    // puede tener fondo bg-lime cuando el jugador reconectado
                    // sigue figurando como "leading" de una puja anterior a
                    // su caida, asi que el tono atenuado no puede ser el
                    // token fijo -- se deriva del texto base de la fila
                    // (ink u white) igual que hace el resto del li.
                    <span className={`ml-2 text-xs font-semibold normal-case ${leading ? "text-ink/70" : "text-mute"}`}>
                      (reconectando)
                    </span>
                  ) : !player.connected ? (
                    <span className="ml-2 text-xs font-bold text-danger">SIN CONEXIÓN</span>
                  ) : null}
                </span>
                <span className={`tnum font-display text-lg font-extrabold ${leading ? "text-ink" : "text-green"}`}>
                  {player.budget}M · {player.squad.size}/11
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

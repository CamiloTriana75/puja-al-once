import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, Check, Hand, Hourglass, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuctionCard } from "../components/AuctionCard.js";
import { BidControls } from "../components/BidControls.js";
import { ClueRow } from "../components/ClueRow.js";
import { DeadlineClock, type ClockMode } from "../components/game/DeadlineClock.js";
import { GameHeader } from "../components/game/GameHeader.js";
import { LiveTicker, type TickerItem } from "../components/game/LiveTicker.js";
import { RivalCard, type RivalTag } from "../components/game/RivalCard.js";
import { SLOT_ABBR, SLOT_LABEL, SLOT_ORDER } from "../components/game/slots.js";
import { MatchHistory } from "../components/MatchHistory.js";
import { REACTIONS, Reactions } from "../components/Reactions.js";
import type { FloatingReaction } from "../components/Reactions.js";
import { RevealBar } from "../components/RevealBar.js";
import { RoundSummary } from "../components/RoundSummary.js";
import { useServerClock } from "../net/useServerClock.js";
import type { IncomingReaction } from "../net/useRoom.js";
import type { ClientState, PlayerView, TradeOfferView } from "../net/types.js";

/** Duraciones de DEFAULT_RULES (packages/shared): solo dibujan la barra del reloj. */
const OPEN_WINDOW_MS = 25_000;
const ANTI_SNIPE_MS = 10_000;
const SKIP_VOTE_MS = 10_000;

/**
 * Los estados de oferta viajan como codigo en ingles (`TradeOfferView.status`):
 * pintarlos en crudo dejaba un traspaso hecho indistinguible de uno cancelado.
 */
const TRADE_STATUS_LABELS: Record<Exclude<TradeOfferView["status"], "OPEN">, string> = {
  ACCEPTED: "Hecho",
  CANCELLED: "Cancelado",
  EXPIRED: "Caducada",
};

interface Props {
  state: ClientState;
  myId: string;
  /** Sala en curso: la URL de la silueta necesita roomId + publicId. */
  roomId: string;
  /** Rechazo de puja tipado por origen -- ver useRoom. Nunca el de arranque de ronda. */
  error: string | null;
  /** Cuenta de rechazos recibidos -- ver bidErrorSeq en useRoom. Se reenvia a BidControls tal cual. */
  errorSeq: number;
  /** Reacciones "reaction" acumuladas por useRoom (D8) -- crudas, sin resolver a nombre todavia. */
  reactions: IncomingReaction[];
  onDismissReaction: (id: string) => void;
  tradeOffers?: TradeOfferView[];
  send: (type: string, payload?: unknown) => void;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-pitch-soft px-4 py-3 font-copy text-[1rem] text-forest">{children}</p>;
}

export function Auction({ state, myId, roomId, error, errorSeq, reactions, onDismissReaction, tradeOffers = [], send }: Props) {
  const remaining = useServerClock(state.endsAt);
  const reducedMotion = useReducedMotion() ?? false;
  const me = state.players.get(myId);
  const card = state.currentCard;
  const inTransferMarket = state.phase === "TRANSFER_MARKET";

  const alreadySigned = me?.squad.has(state.currentSlot) ?? false;
  const restricted = state.restrictedBidders.length > 0 && !state.restrictedBidders.includes(myId);
  // Reingreso aparcado: el socket funciona pero esta ronda ya se repartio sin
  // contarte (PlayerView.rejoinPending). Se desactiva de antemano y se explica.
  const parked = me?.rejoinPending ?? false;
  const canBid = state.phase === "BIDDING" && !alreadySigned && !restricted && !parked;
  const hasActiveBid = state.currentBid > 0;
  // D2: pasar solo tiene efecto mientras nadie ha pujado (AuctionRoom.onPass).
  const canPass = canBid && !hasActiveBid;
  const iPassed = state.passes.get(myId) === true;
  const openingWindow = state.phase === "BIDDING" && !hasActiveBid;

  // Quien puede votar el salto: espejo de playersNeedingSlot (@fut/shared/skip.ts).
  const playersNeedingSlot = [...state.players.values()].filter((p) => p.connected && !p.squad.has(state.currentSlot));
  const canVoteSkip = state.phase === "SKIP_VOTE" && !alreadySigned && !parked;
  const myVote = state.skipVotes.get(myId);

  // Durante REVEAL el desenlace solo vive en revealedCards; MapSchema guarda el
  // orden de insercion, asi que el ultimo es la carta recien publicada.
  const lastReveal = state.phase === "REVEAL" ? [...state.revealedCards.values()].at(-1) : undefined;

  // D8: useRoom solo sabe playerId; el nombre se resuelve aqui. Un indice de
  // emoji fuera de rango se descarta en vez de pintar "undefined".
  const incomingReactions: FloatingReaction[] = reactions.flatMap((r) => {
    const emoji = REACTIONS[r.emoji];
    if (!emoji) return [];
    const senderName = state.players.get(r.playerId)?.name ?? "Jugador";
    return [{ id: r.id, emoji, senderName }];
  });
  // Durante el reveal las burbujas salen sin subida (partida.md, Reacciones).
  const reactionsWithoutRise = state.phase === "REVEAL";
  const reactionsFor = () => (
    <Reactions
      myName={me?.name ?? "Jugador"}
      incoming={incomingReactions}
      noRise={reactionsWithoutRise}
      onExpire={onDismissReaction}
      onSend={(emoji) => send("react", { emoji: REACTIONS.indexOf(emoji) })}
    />
  );

  // Parte entre rondas: se dispara cuando slotIndex AVANZA. La ref arranca en el
  // slotIndex del primer render para no dispararlo al entrar a mitad de partida.
  const previousSlotIndexRef = useRef(state.slotIndex);
  const [summarySlotIndex, setSummarySlotIndex] = useState<number | null>(null);
  useEffect(() => {
    if (state.slotIndex > previousSlotIndexRef.current && state.slotIndex < SLOT_ORDER.length) {
      setSummarySlotIndex(state.slotIndex);
    }
    previousSlotIndexRef.current = state.slotIndex;
  }, [state.slotIndex]);
  const showSummary = summarySlotIndex !== null && summarySlotIndex === state.slotIndex;

  const nameOf = (playerId: string) => state.players.get(playerId)?.name ?? "Jugador";

  const clockMode: ClockMode =
    state.phase === "REVEAL" ? "hammer" : state.phase === "SKIP_VOTE" ? "skip" : openingWindow ? "opening" : "bidding";
  const clockWindow = clockMode === "opening" ? OPEN_WINDOW_MS : clockMode === "skip" ? SKIP_VOTE_MS : ANTI_SNIPE_MS;

  const tagFor = (player: PlayerView): RivalTag => {
    if (state.phase === "BIDDING" && hasActiveBid && player.playerId === state.currentBidderId) return "leading";
    if (state.phase === "REVEAL" && lastReveal?.ownerId === player.playerId) return "won";
    if (state.currentBid === 0 && state.passes.get(player.playerId) === true) return "passed";
    return null;
  };

  const tickerItems: TickerItem[] = [
    ...[...state.bidHistory].reverse().map((bid, index) => ({
      key: `bid-${bid.playerId}-${bid.amount}-${index}`,
      text: `${nameOf(bid.playerId)} puja ${bid.amount} M`,
      tone: index === 0 ? ("hot" as const) : ("plain" as const),
    })),
    ...[...state.revealedCards.values()].reverse().slice(0, 6).map((revealed, index) => ({
      key: `deal-${revealed.cardId}`,
      text: revealed.ownerId
        ? `${revealed.name} ${revealed.season} ficha por ${nameOf(revealed.ownerId)} por ${revealed.price} M`
        : `${revealed.name} ${revealed.season} se queda sin equipo`,
      tone: state.bidHistory.length === 0 && index === 0 ? ("hot" as const) : ("plain" as const),
    })),
  ];

  const roundStatus = (
    <p className="flex min-w-0 items-center justify-center gap-x-3 font-copy text-[1rem] text-slate">
      <span className="tnum hidden rounded-full bg-forest px-3 py-1 font-headline text-[0.8rem] font-semibold text-white sm:inline">
        {Math.min(state.slotIndex + 1, SLOT_ORDER.length)}/{SLOT_ORDER.length}
      </span>
      <span className="truncate font-semibold text-forest">{inTransferMarket ? "Mercado de transferencias" : SLOT_LABEL[state.currentSlot] ?? state.currentSlot}</span>
      {!inTransferMarket && <span className="hidden truncate md:inline">quedan {state.remainingCount} cartas en este puesto</span>}
    </p>
  );

  return (
    <div className="min-h-screen bg-canvas pb-20 text-forest">
      <GameHeader roomCode={state.roomCode} visibility={state.visibility}>
        {roundStatus}
      </GameHeader>

      {inTransferMarket ? (
        <TransferMarket state={state} myId={myId} tradeOffers={tradeOffers} send={send} />
      ) : (
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)_minmax(0,17rem)] lg:gap-8 lg:px-8 lg:py-8">
          <section aria-label="La carta en juego" className="mx-auto flex w-full max-w-[22rem] flex-col gap-3 lg:order-1 lg:max-w-none">
            {card && <AuctionCard card={card} price={state.currentBid || state.minimumBid} roomId={roomId} />}
            {card && state.phase !== "REVEAL" && <ClueRow card={card} />}
          </section>

          <section aria-label="Puja" className="flex min-w-0 flex-col gap-4 lg:order-2">
            <DeadlineClock mode={clockMode} remainingMs={remaining} windowMs={clockWindow} />

            {card && state.phase === "REVEAL" ? (
              <RevealBar card={card} state={state} />
            ) : (
              <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-line sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="font-copy text-[1.02rem] text-slate">
                      {hasActiveBid ? "Va ganando" : state.phase === "BIDDING" ? "Precio de salida" : "Nadie ha pujado"}
                    </p>
                    <motion.p
                      key={hasActiveBid ? state.currentBid : state.openingBid}
                      initial={reducedMotion ? false : { y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="tnum font-headline text-[clamp(2.4rem,4.6vw,3.6rem)] font-bold leading-none tracking-[-0.055em] text-forest"
                    >
                      {hasActiveBid ? state.currentBid : state.openingBid} M
                    </motion.p>
                  </div>
                  {hasActiveBid && (
                    <p className="rounded-full bg-gold px-4 py-1.5 font-copy text-[1.05rem] font-semibold text-forest">
                      {state.currentBidderId === myId ? "Vas ganando tú" : nameOf(state.currentBidderId)}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {alreadySigned && <Notice>Ya fichaste para este puesto. Mira cómo se pelean los demás.</Notice>}
                  {parked && <Notice>Te reconectaste: vuelves a contar a partir de la próxima ronda. Por ahora, mira.</Notice>}

                  {state.phase === "SKIP_VOTE" ? (
                    <SkipVote
                      canVote={canVoteSkip}
                      myVote={myVote}
                      alreadySigned={alreadySigned}
                      voters={playersNeedingSlot}
                      votes={state.skipVotes}
                      onVote={(skip) => send("voteSkip", { skip })}
                    />
                  ) : state.phase === "BIDDING" ? (
                    <>
                      <BidControls
                        minimumBid={state.minimumBid}
                        disabled={!canBid}
                        budget={me?.budget}
                        error={error}
                        errorSeq={errorSeq}
                        onBid={(amount) => send("bid", { amount })}
                      />
                      {canPass && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                          {/* D2: pasar no es vinculante; si llega una puja el bloque desaparece. */}
                          <button
                            type="button"
                            disabled={iPassed}
                            onClick={() => send("pass", {})}
                            className="flex h-11 min-w-[44px] cursor-pointer items-center gap-2 rounded-full bg-canvas px-4 font-copy text-[1rem] font-semibold text-forest ring-1 ring-line transition-colors duration-200 hover:ring-forest disabled:cursor-not-allowed disabled:text-slate"
                          >
                            <Hand className="h-4 w-4" aria-hidden="true" />
                            {iPassed ? "Pasaste" : "Paso"}
                          </button>
                          <p className="min-w-0 flex-1 font-copy text-[0.98rem] text-slate">
                            {iPassed
                              ? "Puedes seguir pujando si cambias de idea."
                              : "Si todos pasan, se resuelve al instante. Si no, se abre voto de salto o se sortea."}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <Notice>Revelando…</Notice>
                  )}
                </div>
              </div>
            )}

            <div className="hidden pt-8 sm:block">{reactionsFor()}</div>
          </section>

          <aside aria-label="La mesa" className="flex flex-col gap-3 lg:order-3">
            <ul className="flex flex-col gap-2.5">
              {[...state.players.values()].map((player) => (
                <RivalCard key={player.playerId} player={player} isMe={player.playerId === myId} tag={tagFor(player)} />
              ))}
            </ul>
            <MatchHistory revealedCards={state.revealedCards} players={state.players} />
          </aside>

          <div className="pt-8 sm:hidden lg:order-4">{reactionsFor()}</div>
        </div>
      )}

      {inTransferMarket && <div className="mx-auto hidden w-full max-w-[90rem] px-8 pb-8 sm:block">{reactionsFor()}</div>}
      {!inTransferMarket && <LiveTicker items={tickerItems} />}

      {showSummary && (
        <RoundSummary
          nextSlot={SLOT_ORDER[state.slotIndex] ?? state.currentSlot}
          players={[...state.players.values()].map((p) => ({
            playerId: p.playerId,
            name: p.name,
            budget: p.budget,
            squadSize: p.squad.size,
          }))}
          onDismiss={() => setSummarySlotIndex(null)}
        />
      )}
    </div>
  );
}

function SkipVote({
  canVote,
  myVote,
  alreadySigned,
  voters,
  votes,
  onVote,
}: {
  canVote: boolean;
  myVote: boolean | undefined;
  alreadySigned: boolean;
  voters: PlayerView[];
  votes: Map<string, boolean>;
  onVote: (skip: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-headline text-[1.2rem] font-semibold tracking-[-0.03em] text-forest">Nadie pujó. ¿Se descarta esta carta?</p>
      {canVote ? (
        <div className="grid grid-cols-2 gap-2">
          {/* Tras votar, el boton pulsado queda marcado y los dos se bloquean: nunca doble clic ni duda. */}
          <button
            type="button"
            disabled={myVote !== undefined}
            aria-pressed={myVote === true}
            onClick={() => onVote(true)}
            className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl font-copy text-[1.05rem] font-semibold transition-colors duration-200 disabled:cursor-not-allowed ${
              myVote === true ? "bg-forest text-white" : myVote === false ? "bg-canvas text-slate ring-1 ring-line" : "bg-forest text-white hover:bg-[#163A2D]"
            }`}
          >
            <ThumbsDown className="h-5 w-5" aria-hidden="true" />
            {myVote === true ? "Votaste: saltarla" : "Saltarla"}
          </button>
          <button
            type="button"
            disabled={myVote !== undefined}
            aria-pressed={myVote === false}
            onClick={() => onVote(false)}
            className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl font-copy text-[1.05rem] font-semibold transition-colors duration-200 disabled:cursor-not-allowed ${
              myVote === false ? "bg-pitch text-white" : myVote === true ? "bg-canvas text-slate ring-1 ring-line" : "bg-white text-forest ring-1 ring-line hover:ring-pitch"
            }`}
          >
            <ThumbsUp className="h-5 w-5" aria-hidden="true" />
            {myVote === false ? "Votaste: la quiero" : "La quiero"}
          </button>
        </div>
      ) : (
        <Notice>
          {alreadySigned
            ? "Ya fichaste este puesto: no te toca votar. Sigue la votación aquí abajo."
            : "Te reconectaste: vuelves a contar en la próxima ronda. Sigue la votación aquí abajo."}
        </Notice>
      )}
      <p className="font-copy text-[0.98rem] text-slate">
        Hace falta la unanimidad de quienes aún no tienen este puesto. Si alguien vota que la quiere, después de la votación solo esa persona podrá pujar por ella.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Estado de la votación de salto">
        {voters.map((voter) => {
          const vote = votes.get(voter.playerId);
          return (
            <li key={voter.playerId} className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 font-copy text-[0.95rem] ring-1 ring-line">
              {vote === undefined ? <Hourglass className="h-4 w-4 text-slate" aria-hidden="true" /> : <Check className="h-4 w-4 text-pitch" aria-hidden="true" />}
              <span className="font-semibold text-forest">{voter.name}</span>
              <span className="text-slate">{vote === undefined ? "esperando" : vote ? "saltar" : "la quiere"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ventana de traspasos entre la defensa y el mediocampo (AuctionRoom.TRANSFER_MARKET_SLOT_INDEX). */
function TransferMarket({
  state,
  myId,
  tradeOffers,
  send,
}: {
  state: ClientState;
  myId: string;
  tradeOffers: TradeOfferView[];
  send: (type: string, payload?: unknown) => void;
}) {
  const me = state.players.get(myId);
  const marketConfirmed = state.marketReady?.get(myId) === true;
  const [offeredSelection, setOfferedSelection] = useState("");
  const [requestedSelection, setRequestedSelection] = useState("");
  const [payment, setPayment] = useState("0");

  const ownPlayers = me ? [...me.squad.entries()] : [];
  const otherPlayers = [...state.players.values()].filter((player) => player.playerId !== myId);

  /**
   * Nombre legible de una carta. Cuando el mercado abre todas las cartas
   * jugadas ya se revelaron, asi que revealedCards las tiene; el cardId crudo
   * queda solo como respaldo para no perder una carta del selector.
   */
  const cardLabel = (cardId: string): string => {
    const card = state.revealedCards.get(cardId);
    return card ? `${card.name} (${card.season})` : cardId;
  };

  const sendTradeOffer = () => {
    const [offeredSlot, offeredCardId] = offeredSelection.split(":");
    const [recipientId, requestedSlot, requestedCardId] = requestedSelection.split(":");
    if (!offeredSlot || !offeredCardId || !recipientId || !requestedSlot || !requestedCardId) return;
    send("trade:create", {
      offerId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${myId}`,
      recipientId,
      offeredCardIds: [offeredCardId],
      requestedCardIds: [requestedCardId],
      proposerPays: Math.max(0, Number(payment) || 0),
    });
  };

  // Los traspasos hechos primero: son la noticia; lo que sigue abierto aun se puede deshacer.
  const isPendingForMe = (offer: TradeOfferView) => offer.status === "OPEN" && offer.recipientId === myId;
  const pendingForMe = tradeOffers.filter(isPendingForMe).length;
  const sortedOffers = [
    ...tradeOffers.filter(isPendingForMe),
    ...tradeOffers.filter((offer) => offer.status === "ACCEPTED"),
    ...tradeOffers.filter((offer) => offer.status !== "ACCEPTED" && !isPendingForMe(offer)),
  ];

  const selectClass =
    "h-14 w-full cursor-pointer rounded-2xl border-2 border-line bg-white px-4 font-copy text-[1.02rem] text-forest transition-colors focus:border-pine";

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="pitch-stripes on-dark flex flex-wrap items-end justify-between gap-6 rounded-[2rem] px-6 py-8 text-white sm:px-10">
        <div className="max-w-2xl">
          <h1 className="font-headline text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.05em]">Mercado de transferencias</h1>
          <p className="mt-3 font-copy text-[1.12rem] leading-[1.55] text-white/90">
            La defensa ya está cerrada: reajusta tu once antes del mediocampo. Cada operación cambia un jugador por otro y el dinero es opcional. Todo el mercado ve las ofertas y los saldos.
          </p>
        </div>
        <button
          type="button"
          disabled={marketConfirmed}
          onClick={() => send("market:continue", {})}
          className="flex h-14 min-w-[44px] cursor-pointer items-center gap-2 rounded-full bg-gold px-7 font-copy text-[1.08rem] font-semibold text-forest transition-colors duration-200 hover:bg-[#F5C65C] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white"
        >
          {marketConfirmed && <Check className="h-5 w-5" aria-hidden="true" />}
          {marketConfirmed ? "Confirmado" : "Continuar"}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="market-squad" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line">
          <h2 id="market-squad" className="font-headline text-[1.15rem] font-semibold tracking-[-0.03em]">Tu plantilla</h2>
          {ownPlayers.length === 0 ? (
            <p className="mt-3 font-copy text-[1rem] text-slate">Todavía no tienes jugadores que ofrecer.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {ownPlayers.map(([slot, cardId]) => (
                <li key={`${slot}:${cardId}`} className="flex items-baseline gap-3 py-2.5 font-copy text-[1rem]">
                  <span className="w-10 shrink-0 font-headline text-[0.78rem] font-semibold text-pitch">{SLOT_ABBR[slot] ?? slot}</span>
                  <span className="min-w-0 truncate text-forest">{cardLabel(cardId)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="market-offer" className="flex flex-col gap-6">
          <div className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line">
            <h2 id="market-offer" className="font-headline text-[1.15rem] font-semibold tracking-[-0.03em]">Nueva oferta</h2>
            <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <label className="flex flex-col gap-2 font-copy text-[0.98rem] text-slate">
                Tu jugador
                <select value={offeredSelection} onChange={(event) => setOfferedSelection(event.target.value)} className={selectClass}>
                  <option value="">Selecciona</option>
                  {ownPlayers.map(([slot, cardId]) => (
                    <option key={`${slot}:${cardId}`} value={`${slot}:${cardId}`}>
                      {SLOT_ABBR[slot] ?? slot} · {cardLabel(cardId)}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true" className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full bg-pitch-soft text-pitch">
                <ArrowLeftRight className="h-4 w-4" />
              </span>
              <label className="flex flex-col gap-2 font-copy text-[0.98rem] text-slate">
                Jugador a recibir
                <select value={requestedSelection} onChange={(event) => setRequestedSelection(event.target.value)} className={selectClass}>
                  <option value="">Selecciona</option>
                  {otherPlayers
                    .filter((player) => player.squad.size > 0)
                    .map((player) => (
                      <optgroup key={player.playerId} label={`${player.name} · ${player.budget} M`}>
                        {[...player.squad.entries()].map(([slot, cardId]) => (
                          <option key={`${player.playerId}:${slot}:${cardId}`} value={`${player.playerId}:${slot}:${cardId}`}>
                            {SLOT_ABBR[slot] ?? slot} · {cardLabel(cardId)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-2 font-copy text-[0.98rem] text-slate">
                Dinero adicional
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={payment}
                  onChange={(event) => setPayment(event.target.value)}
                  className="tnum h-14 w-full rounded-2xl border-2 border-line bg-white px-4 font-headline text-[1.05rem] font-semibold text-forest transition-colors focus:border-pine"
                />
              </label>
              <button
                type="button"
                onClick={sendTradeOffer}
                className="h-14 cursor-pointer rounded-full bg-pitch px-7 font-copy text-[1.05rem] font-semibold text-white transition-colors duration-200 hover:bg-[#106E3D]"
              >
                Enviar oferta
              </button>
            </div>
          </div>

          {pendingForMe > 0 && (
            <p role="status" className="rounded-2xl bg-gold px-5 py-3 font-copy text-[1.05rem] font-semibold text-forest">
              {pendingForMe === 1 ? "Tienes 1 oferta esperando tu respuesta" : `Tienes ${pendingForMe} ofertas esperando tu respuesta`}
            </p>
          )}
          {sortedOffers.length > 0 && (
            <ul className="flex flex-col gap-2.5" aria-label="Ofertas del mercado">
              {sortedOffers.map((offer) => {
                const isRecipient = offer.recipientId === myId;
                const isProposer = offer.proposerId === myId;
                const proposer = state.players.get(offer.proposerId)?.name ?? "Jugador";
                const recipient = state.players.get(offer.recipientId)?.name ?? "Jugador";
                const mine = isRecipient || isProposer;
                const accepted = offer.status === "ACCEPTED";
                const open = offer.status === "OPEN";

                return (
                  <li
                    key={offer.offerId}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 font-copy text-[1rem] ${
                      accepted ? "bg-gold text-forest" : open && isRecipient ? "bg-white ring-2 ring-pitch" : open ? "bg-white ring-1 ring-line" : "bg-canvas text-slate ring-1 ring-line"
                    }`}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      {accepted && (
                        <span className="font-headline text-[1.05rem] font-semibold tracking-[-0.02em]">
                          Traspaso hecho: {proposer} ↔ {recipient}
                        </span>
                      )}
                      {open && isRecipient && <span className="font-headline text-[1rem] font-semibold tracking-[-0.02em] text-pitch">Te han hecho una oferta</span>}
                      <span className={accepted ? "text-forest/85" : "text-slate"}>
                        {proposer} da {offer.offeredCardIds.map(cardLabel).join(", ")} por {offer.requestedCardIds.map(cardLabel).join(", ")} de {recipient}
                        {offer.proposerPays > 0 ? ` y ${proposer} paga ${offer.proposerPays} M` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {isRecipient && open && (
                        <button
                          type="button"
                          onClick={() => send("trade:accept", { offerId: offer.offerId })}
                          className="h-11 cursor-pointer rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-[#106E3D]"
                        >
                          Aceptar
                        </button>
                      )}
                      {mine && open && (
                        <button
                          type="button"
                          onClick={() => send("trade:cancel", { offerId: offer.offerId })}
                          className="h-11 cursor-pointer rounded-full bg-canvas px-5 font-semibold text-forest ring-1 ring-line transition-colors hover:ring-forest"
                        >
                          Cancelar
                        </button>
                      )}
                      {offer.status !== "OPEN" && <span className={accepted ? "font-semibold" : "text-slate"}>{TRADE_STATUS_LABELS[offer.status]}</span>}
                      {!mine && open && <span className="text-slate">En negociación</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="market-players" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line">
          <h2 id="market-players" className="font-headline text-[1.15rem] font-semibold tracking-[-0.03em]">Saldos</h2>
          <ul className="mt-3 divide-y divide-line" aria-label="Confirmaciones del mercado">
            {[...state.players.values()].map((player) => {
              const ready = state.marketReady?.get(player.playerId) === true;
              return (
                <li key={player.playerId} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-copy text-[1.05rem] font-semibold text-forest">{player.name}</span>
                    <span className={`flex items-center gap-1.5 font-copy text-[0.92rem] ${ready ? "text-pitch" : "text-slate"}`}>
                      {ready ? <Check className="h-4 w-4" aria-hidden="true" /> : <Hourglass className="h-4 w-4" aria-hidden="true" />}
                      {ready ? "Listo para continuar" : "En el mercado"}
                    </span>
                  </span>
                  <span className="tnum font-headline text-[1.15rem] font-semibold tracking-[-0.03em] text-forest">{player.budget} M</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

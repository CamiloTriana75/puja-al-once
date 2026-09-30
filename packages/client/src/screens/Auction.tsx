import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AuctionCard } from "../components/AuctionCard.js";
import { BidControls } from "../components/BidControls.js";
import { ClueRow } from "../components/ClueRow.js";
import { MatchHistory } from "../components/MatchHistory.js";
import { REACTIONS, Reactions } from "../components/Reactions.js";
import type { FloatingReaction } from "../components/Reactions.js";
import { RevealBar } from "../components/RevealBar.js";
import { RoundSummary } from "../components/RoundSummary.js";
import { useServerClock } from "../net/useServerClock.js";
import type { IncomingReaction } from "../net/useRoom.js";
import type { ClientState, TradeOfferView } from "../net/types.js";

/**
 * Los estados de oferta viajan como codigo en ingles (`TradeOfferView.status`).
 * Pintarlos en crudo -- como hacia antes -- hacia que un traspaso ACEPTADO
 * apareciera como "ACCEPTED" en gris apagado, indistinguible de un cancelado a
 * primera vista: justo lo contrario de lo que pedia el jugador, que el cambio
 * de plantillas y de saldo se note.
 */
const TRADE_STATUS_LABELS: Record<Exclude<TradeOfferView["status"], "OPEN">, string> = {
  ACCEPTED: "Hecho",
  CANCELLED: "Cancelado",
  EXPIRED: "Caducada",
};

/** Mismo orden que packages/shared/src/types.ts -- el cliente nunca importa shared (ver SquadGrid.tsx, mismo patron de constante duplicada). */
const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

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
  /** Retira una reaccion ya expirada de la lista de useRoom -- se le pasa a <Reactions onExpire> via el mapeo de abajo. */
  onDismissReaction: (id: string) => void;
  tradeOffers?: TradeOfferView[];
  send: (type: string, payload?: unknown) => void;
}

export function Auction({ state, myId, roomId, error, errorSeq, reactions, onDismissReaction, tradeOffers = [], send }: Props) {
  const remaining = useServerClock(state.endsAt);
  const reducedMotion = useReducedMotion() ?? false;
  const me = state.players.get(myId);
  const card = state.currentCard;
  const inTransferMarket = state.phase === "TRANSFER_MARKET";
  const marketConfirmed = state.marketReady?.get(myId) === true;
  const [offeredSelection, setOfferedSelection] = useState("");
  const [requestedSelection, setRequestedSelection] = useState("");
  const [payment, setPayment] = useState("0");

  const alreadySigned = me?.squad.has(state.currentSlot) ?? false;
  const restricted = state.restrictedBidders.length > 0 && !state.restrictedBidders.includes(myId);
  // Reingreso aparcado: el socket funciona pero esta ronda ya se repartio
  // sin contarte -- distinto de connected:false (ver PlayerView.rejoinPending).
  // Se desactiva el boton de antemano en vez de esperar al rechazo del
  // servidor, y se explica por que junto a los controles.
  const parked = me?.rejoinPending ?? false;
  const canBid = state.phase === "BIDDING" && !alreadySigned && !restricted && !parked;
  const hasActiveBid = state.currentBid > 0;
  // D2: "pass" solo tiene efecto mientras currentBid === 0 -- ver
  // AuctionRoom.onPass y playersEligibleToPass en @fut/shared/pass.ts. La
  // misma gente que puede pujar ahora mismo es la misma que puede pasar
  // (necesita el hueco, no esta restringida fuera de la lista, no esta
  // aparcada) -- solo cambia que pasar exige que nadie haya pujado todavia.
  const canPass = canBid && !hasActiveBid;
  const iPassed = state.passes.get(myId) === true;
  const urgent = hasActiveBid && remaining < 5000 && state.phase === "BIDDING";
  const openingWindow = state.phase === "BIDDING" && !hasActiveBid;

  // Quien necesita el hueco actual y por tanto puede votar el salto (D2/D3
  // feedback: "arreglar el apartado de saltar jugador") -- espejo de
  // playersNeedingSlot en @fut/shared/skip.ts: conectado (rejoinPending
  // cuenta como no-conectado, ver PlayerView) y sin ese puesto ya fichado.
  // Se usa tanto para saber si YO puedo votar como para pintar quien falta.
  const playersNeedingSlot = [...state.players.values()].filter(
    (p) => p.connected && !p.squad.has(state.currentSlot),
  );
  const canVoteSkip = state.phase === "SKIP_VOTE" && !alreadySigned && !parked;
  const myVote = state.skipVotes.get(myId);

  // Durante REVEAL, applyOutcome ya limpio currentBid/currentBidderId al
  // entrar en la fase (ver packages/shared/src/auction.ts): el desenlace de
  // "quien se la llevo y por cuanto" solo vive en revealedCards. MapSchema
  // conserva el orden de insercion, asi que el ultimo valor es siempre la
  // carta que se acaba de publicar -- no hace falta cruzar por cardId (que
  // el cliente ni siquiera puede usar como clave publica antes de esto).
  const lastReveal = state.phase === "REVEAL" ? [...state.revealedCards.values()].at(-1) : undefined;
  const revealWinner = lastReveal?.ownerId ? state.players.get(lastReveal.ownerId) : undefined;

  // D8: burbujas entrantes -- useRoom solo sabe `playerId`, el nombre se
  // resuelve aqui contra `state.players` (mismo cruce que ya hace
  // `revealWinner` arriba). Un jugador que se fue de la sala entre que
  // mando la reaccion y que esta burbuja termine de pintarse ya no esta en
  // el mapa -- "Jugador" de respaldo, igual que PlayerView.name por
  // defecto en AuctionRoom.onJoin, para no reventar la burbuja por eso.
  // `emoji` es un indice 0..5 en la red (AuctionRoom.onReact); REACTIONS
  // (mismo orden en los dos lados, ver su comentario) lo traduce de vuelta
  // al emoji visual. Un indice fuera de rango (no deberia llegar nunca --
  // el servidor ya valida antes de reenviar) se descarta en vez de pintar
  // "undefined".
  const incomingReactions: FloatingReaction[] = reactions.flatMap((r) => {
    const emoji = REACTIONS[r.emoji];
    if (!emoji) return [];
    const senderName = state.players.get(r.playerId)?.name ?? "Jugador";
    return [{ id: r.id, emoji, senderName }];
  });

  const ownPlayers = me ? [...me.squad.entries()] : [];
  const otherPlayers = [...state.players.values()].filter((player) => player.playerId !== myId);

  /**
   * Nombre legible de una carta para el mercado. Cuando el mercado se abre ya
   * estan reveladas todas las cartas jugadas -- entra al cerrar la defensa
   * (ver `AuctionRoom.TRANSFER_MARKET_SLOT_INDEX`) y hasta ahi ninguna se
   * descarta sin enseñar nombre y temporada -- asi que `revealedCards` las tiene
   * todas y con eso sale el nombre de verdad.
   *
   * El cardId crudo se queda como unico respaldo, para que una carta que se
   *escapara al mapa (no deberia: todo lo que esta en un squad se revelo antes)
   * siga siendo identificable en vez de desaparecer del selector. La diferencia
   * importa mas de lo que parece: una oferta leida como "facchetti-1968 por
   * c1b-1975" no dice nada de quien se lleva quien, que es justo lo que el
   * mercado esta para decidir.
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
  // partida.md, seccion Reacciones: "durante el reveal, que ya gasta dos
  // [elementos del presupuesto de movimiento], las reacciones se muestran
  // sin subida" -- mismo criterio que RevealBar/AuctionCard ya aplican para
  // esa fase, solo que aqui se traduce a un booleano que <Reactions> sabe
  // consumir directamente.
  const reactionsWithoutRise = state.phase === "REVEAL";

  // Resumen entre rondas (encargo B5, punto 4): se dispara cuando
  // `slotIndex` AVANZA -- el puesto anterior se completo y `advance()`
  // (AuctionRoom.ts) paso al siguiente. El valor inicial de la ref es el
  // slotIndex del PRIMER render (nunca 0 "de la nada"): sin eso, unirse a
  // una partida ya en marcha (slotIndex > 0 desde el primer patch que ve
  // este componente) dispararia el resumen de golpe al montar, cuando en
  // realidad no hubo ninguna transicion que anunciar -- solo se acaba de
  // empezar a mirar.
  const previousSlotIndexRef = useRef(state.slotIndex);
  const [summarySlotIndex, setSummarySlotIndex] = useState<number | null>(null);

  useEffect(() => {
    // slotIndex fuera de rango (SLOTS.length, 11) es como AuctionRoom.finish()
    // marca "partida terminada" -- App.tsx ya deja de montar Auction en
    // cuanto la fase pasa a RESULTS en el mismo patch, asi que este caso no
    // deberia alcanzar nunca a este efecto en la practica; el chequeo es
    // defensa barata para no depender de ese orden de render entre
    // componentes si App.tsx cambia algun dia.
    if (state.slotIndex > previousSlotIndexRef.current && state.slotIndex < SLOTS.length) {
      setSummarySlotIndex(state.slotIndex);
    }
    previousSlotIndexRef.current = state.slotIndex;
  }, [state.slotIndex]);

  const showSummary = summarySlotIndex !== null && summarySlotIndex === state.slotIndex;

  return (
    // pb-28 en movil: dead space para que la barra fija de puja (mas abajo)
    // no tape el ultimo bloque de contenido; sm: vuelve a flujo normal.
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 pb-28 sm:pb-6 md:p-6">
      {!inTransferMarket && card && <AuctionCard card={card} price={state.currentBid || state.minimumBid} roomId={roomId} />}

      {/*
        D8/partida.md: "en movil, la fila va justo encima de los controles de
        puja fijos; en escritorio, bajo la tarjeta". Dos sitios de montaje en
        vez de uno reordenado por CSS -- el de escritorio esta fuera del flujo
        que colapsa a una columna en movil (`sm:hidden` lo apaga ahi), y el de
        movil vive junto a la barra fija de mas abajo (`hidden sm:hidden` lo
        apaga en escritorio). Mismo breakpoint (`sm`) que ya usa esa barra
        fija para decidir "movil vs escritorio" en este fichero.
      */}
      <div className="hidden sm:block">
        <Reactions myName={me?.name ?? "Jugador"} incoming={incomingReactions} noRise={reactionsWithoutRise}
          onExpire={onDismissReaction} onSend={(emoji) => send("react", { emoji: REACTIONS.indexOf(emoji) })} />
      </div>

      {inTransferMarket && (
        <section className="panel flex flex-col gap-6 bg-ink p-6" aria-labelledby="transfer-market-title">
          <div>
            <p className="font-body text-sm font-semibold uppercase tracking-[0.2em] text-green">Pausa de mercado</p>
            <h1 id="transfer-market-title" className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">
              Mercado de transferencias
            </h1>
<p className="mt-3 max-w-2xl font-body text-base text-mute">
            Intercambia jugadores con otro participante antes de completar el ataque. Cada operación debe incluir un jugador por cada lado; el dinero es opcional.
          </p>
          <p className="mt-2 max-w-2xl font-body text-sm text-mute">
            La defensa ya está cerrada. Es el momento de reajustar el equipo: el mercado es público, todas las ofertas y sus resultados los ve todo el mundo, y el saldo de cada uno está a la vista.
          </p>
        </div>

          <ul className="flex flex-col gap-2" aria-label="Confirmaciones del mercado">
            {[...state.players.values()].map((player) => (
              <li key={player.playerId} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 px-4 py-3">
                <span className="font-display text-lg font-bold uppercase text-white">{player.name}</span>
                <span className="flex items-baseline gap-3">
                  {/*
                    El saldo de cada uno a la vista durante el mercado: el
                    `budget` de todos ya viaja en el estado (project.ts), asi
                    que aqui no hay nada que revelar por API -- solo decide
                    donde se enseña. Es justo cuando importa, porque el dinero
                    que se gaste en un traspaso se ve desaparecer y el del
                    contrario aparecer.
                  */}
                  <span className="tnum font-display text-xl font-black text-green">{player.budget} M</span>
                  <span className="font-body text-sm font-semibold uppercase tracking-wide text-mute">
                    {state.marketReady?.get(player.playerId) ? "Listo para continuar" : "En el mercado"}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-3">
            <label className="flex flex-col gap-2 font-body text-sm text-mute">
              Tu jugador
              <select value={offeredSelection} onChange={(event) => setOfferedSelection(event.target.value)} className="h-11 bg-deep px-3 text-white">
                <option value="">Selecciona</option>
                {ownPlayers.map(([slot, cardId]) => <option key={`${slot}:${cardId}`} value={`${slot}:${cardId}`}>{slot} · {cardLabel(cardId)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 font-body text-sm text-mute">
              Jugador a recibir
              <select value={requestedSelection} onChange={(event) => setRequestedSelection(event.target.value)} className="h-11 bg-deep px-3 text-white">
                <option value="">Selecciona</option>
                {otherPlayers.flatMap((player) => [...player.squad.entries()].map(([slot, cardId]) => (
                  <option key={`${player.playerId}:${slot}:${cardId}`} value={`${player.playerId}:${slot}:${cardId}`}>{player.name} · {slot} · {cardLabel(cardId)}</option>
                )))}
              </select>
            </label>
            <label className="flex flex-col gap-2 font-body text-sm text-mute">
              Dinero adicional
              <input type="number" min="0" step="10" value={payment} onChange={(event) => setPayment(event.target.value)} className="h-11 bg-deep px-3 text-white" />
            </label>
          </div>

          <button type="button" onClick={sendTradeOffer} className="h-11 w-fit cursor-pointer border-2 border-lime px-5 font-display text-sm font-bold uppercase text-lime transition-colors hover:bg-lime hover:text-ink">
            Enviar oferta
          </button>

          {tradeOffers.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Ofertas del mercado">
              {/*
                Los aceptados primero, y por encima el resto. Un traspaso ya
                hecho es informacion que se pierde de vista si la lista queda
                solo en orden de llegada -- y es la que interesa: lo que se
                negocia todavia se puede deshacer con "Cancelar".
              */}
              {(() => {
                const accepted = tradeOffers.filter((offer) => offer.status === "ACCEPTED");
                const rest = tradeOffers.filter((offer) => offer.status !== "ACCEPTED");
                return [...accepted, ...rest].map((offer) => {
                  const isRecipient = offer.recipientId === myId;
                  const isProposer = offer.proposerId === myId;
                  const proposer = state.players.get(offer.proposerId)?.name ?? "Jugador";
                  const recipient = state.players.get(offer.recipientId)?.name ?? "Jugador";
                  const mine = isRecipient || isProposer;

                  return (
                    <li
                      key={offer.offerId}
                      className={`flex flex-wrap items-center justify-between gap-3 border-2 px-4 py-3 font-body text-sm ${
                        offer.status === "ACCEPTED"
                          ? "border-lime bg-lime/10 text-white"
                          : offer.status === "OPEN"
                            ? isRecipient
                              ? "border-lime/60 bg-ink text-white"
                              : "border-white/10 bg-ink text-white"
                            : "border-white/5 bg-ink text-mute"
                      }`}
                    >
                      <span className="flex flex-col gap-1">
                        {offer.status === "ACCEPTED" && (
                          <span className="font-display text-lg font-black uppercase tracking-wide text-lime">
                            Traspaso hecho: {proposer} ↔ {recipient}
                          </span>
                        )}
                        {offer.status === "OPEN" && isRecipient && (
                          <span className="font-display text-sm font-black uppercase tracking-wide text-lime">
                            Te han hecho una oferta
                          </span>
                        )}
                        <span className="text-mute">
                          {proposer} da {offer.offeredCardIds.map(cardLabel).join(", ")} por {offer.requestedCardIds.map(cardLabel).join(", ")} de {recipient}
                          {offer.proposerPays > 0 ? ` · ${proposer} paga ${offer.proposerPays} M` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {isRecipient && offer.status === "OPEN" && <button type="button" onClick={() => send("trade:accept", { offerId: offer.offerId })} className="border border-lime px-3 py-1 font-semibold text-lime">Aceptar</button>}
                        {(isRecipient || isProposer) && offer.status === "OPEN" && <button type="button" onClick={() => send("trade:cancel", { offerId: offer.offerId })} className="border border-white/30 px-3 py-1 font-semibold text-white">Cancelar</button>}
                        {offer.status !== "OPEN" && (
                          <span className={offer.status === "ACCEPTED" ? "font-display text-sm font-black uppercase tracking-wide text-lime" : "text-mute"}>
                            {TRADE_STATUS_LABELS[offer.status]}
                          </span>
                        )}
                        {!mine && offer.status === "OPEN" && <span className="text-mute">En negociación</span>}
                      </span>
                    </li>
                  );
                });
              })()}
            </ul>
          )}

          <button
            type="button"
            disabled={marketConfirmed}
            onClick={() => send("market:continue", {})}
            className="h-12 w-fit cursor-pointer bg-lime px-6 font-display text-lg font-black uppercase text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-mute"
          >
            {marketConfirmed ? "Confirmado" : "Continuar"}
          </button>
        </section>
      )}

      <div className={`grid gap-6 lg:grid-cols-[1fr_20rem] ${inTransferMarket ? "hidden" : ""}`}>
        <div className="flex flex-col gap-6">
          {/* Durante REVEAL las pistas ya no sirven -- la respuesta esta delante. */}
          {card && (state.phase === "REVEAL"
            ? <RevealBar card={card} state={state} />
            : <ClueRow card={card} />)}

          <div className="panel flex flex-wrap items-baseline gap-x-6 gap-y-2 bg-ink px-6 py-4 pr-12">
            {/*
              D1: ventana de apertura, distinta del anti-snipe a proposito
              (design-system/pages/partida.md): texto blanco sobre --ink, sin
              pulso, se distingue por currentBid === 0. El anti-snipe (rama de
              abajo) sigue siendo la cifra grande lima con pulso rojo en los
              ultimos 5s -- las dos comparten el mismo reloj de servidor
              (state.endsAt via useServerClock), solo cambia la pinta.
            */}
            {openingWindow ? (
              <p className="tnum font-display text-2xl font-black uppercase tracking-wide text-white">
                Abre la puja · {Math.ceil(remaining / 1000)} s
              </p>
            ) : (
              <p className={`tnum font-display text-5xl font-black leading-none ${urgent ? "animate-pulse text-danger" : "text-lime"}`}>
                {(remaining / 1000).toFixed(1)}s
              </p>
            )}

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
                {hasActiveBid ? (
                  <>
                    <span className="tnum text-green">{state.currentBid} M</span>{" "}
                    <span className="text-mute">va ganando</span>{" "}
                    {state.players.get(state.currentBidderId)?.name}
                  </>
                ) : state.phase === "BIDDING" ? (
                  <>
                    <span className="tnum text-green">Sale desde {state.openingBid} M</span>{" "}
                    <span className="text-mute">— esperando la primera puja</span>
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

          {/* Ver el comentario del otro <Reactions> mas arriba: este es el sitio de movil, justo encima de la barra fija de abajo. */}
          <div className="sm:hidden">
            <Reactions myName={me?.name ?? "Jugador"} incoming={incomingReactions} noRise={reactionsWithoutRise}
              onExpire={onDismissReaction} onSend={(emoji) => send("react", { emoji: REACTIONS.indexOf(emoji) })} />
          </div>

          {/*
            Barra fija en movil, dentro del pulgar (MASTER.md S8): la
            votacion de salto y los controles de puja comparten el mismo
            hueco porque nunca estan activos a la vez (fases distintas).
          */}
          <div className="sticky bottom-0 z-30 -mx-4 border-t border-white/10 bg-deep px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {state.phase === "SKIP_VOTE" ? (
              <div className="flex flex-col gap-3">
                <p className="font-display text-lg font-bold uppercase tracking-wide text-white">
                  Nadie pujó. ¿Se descarta esta carta?
                </p>

                {canVoteSkip ? (
                  <div className="flex gap-3">
                    {/*
                      Feedback de la partida con amigos: "los botones no
                      funcionan bien" -- tras votar, el boton que se pulso se
                      queda marcado y los dos se deshabilitan (nunca doble
                      clic, nunca duda de si se registro). El texto cambia,
                      no solo el color (MASTER.md S6).
                    */}
                    <button
                      type="button"
                      disabled={myVote !== undefined}
                      aria-pressed={myVote === true}
                      onClick={() => send("voteSkip", { skip: true })}
                      className={`h-12 min-w-[44px] px-6 font-display text-xl font-black uppercase transition-colors duration-200 ${
                        myVote === true
                          ? "cursor-not-allowed bg-lime text-ink"
                          : myVote === false
                            ? "cursor-not-allowed border-2 border-white/10 text-mute"
                            : "cursor-pointer bg-lime text-ink hover:bg-white"
                      }`}
                    >
                      {myVote === true ? "Votaste: saltarla" : "Saltarla"}
                    </button>
                    <button
                      type="button"
                      disabled={myVote !== undefined}
                      aria-pressed={myVote === false}
                      onClick={() => send("voteSkip", { skip: false })}
                      className={`h-12 min-w-[44px] px-6 font-display text-xl font-bold uppercase transition-colors duration-200 ${
                        myVote === false
                          ? "cursor-not-allowed border-2 border-lime text-lime"
                          : myVote === true
                            ? "cursor-not-allowed border-2 border-white/10 text-mute"
                            : "cursor-pointer border-2 border-white/30 text-white hover:border-white"
                      }`}
                    >
                      {myVote === false ? "Votaste: la quiero" : "La quiero"}
                    </button>
                  </div>
                ) : (
                  <p className="bg-ink px-3 py-2 font-body text-sm text-mute">
                    {alreadySigned
                      ? "Ya fichaste este puesto: no te toca votar. Sigue la votación aquí abajo."
                      : "Te reconectaste: vuelves a contar en la próxima ronda. Sigue la votación aquí abajo."}
                  </p>
                )}

                <p className="bg-ink px-3 py-2 font-body text-sm text-mute">
                  Hace falta la unanimidad de quienes aún no tienen este puesto. Si alguien vota que la quiere, después de la votación solo esa persona podrá pujar por ella.
                </p>

                {/* Quien ha votado y quien falta (design-system/pages/partida.md). */}
                <ul className="flex flex-wrap gap-2" aria-label="Estado de la votación de salto">
                  {playersNeedingSlot.map((p) => {
                    const vote = state.skipVotes.get(p.playerId);
                    return (
                      <li
                        key={p.playerId}
                        className="flex items-center gap-1.5 bg-ink px-3 py-1.5 font-body text-xs font-semibold uppercase tracking-wide"
                      >
                        <span className="text-white">{p.name}</span>
                        <span className={vote === undefined ? "text-mute" : vote ? "text-lime" : "text-white"}>
                          {vote === undefined ? "· esperando" : vote ? "· saltar" : "· la quiere"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : state.phase === "BIDDING" ? (
              <div className="flex flex-col gap-3">
                <BidControls
                  minimumBid={state.minimumBid}
                  disabled={!canBid}
                  error={error}
                  errorSeq={errorSeq}
                  onBid={(amount) => send("bid", { amount })}
                />
                {canPass && (
                  <div className="flex flex-wrap items-center gap-3">
                    {/*
                      D2: "Paso" sustituye a "Cerrar sin pujas" -- el
                      servidor ya no escucha closeWithoutBid (D2, ver
                      AuctionRoom.onPass). Pasar no es vinculante: tras
                      pasar el boton queda deshabilitado como recordatorio
                      ("Pasaste"), pero sigue pudiendose pujar -- si llega
                      una puja el bloque entero desaparece (hasActiveBid).
                    */}
                    <button
                      type="button"
                      disabled={iPassed}
                      onClick={() => send("pass", {})}
                      className="h-11 min-w-[44px] cursor-pointer border-2 border-white/30 px-4 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors duration-200 hover:border-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-mute"
                    >
                      {iPassed ? "Pasaste" : "Paso"}
                    </button>
                    <p className="font-body text-sm text-mute">
                      {iPassed
                        ? "Puedes seguir pujando si cambias de idea."
                        : "Si pasáis todos, se resuelve al instante. Si no, se abre voto de salto o se sortea."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="bg-ink px-3 py-2 font-body text-sm text-mute">Revelando…</p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <ul className="flex flex-col gap-px bg-white/10">
          {[...state.players.values()].map((player) => {
            const leading = state.phase === "BIDDING" && player.playerId === state.currentBidderId;
            // D2: etiqueta "PASA" -- solo tiene sentido mientras la carta
            // sigue en currentBid === 0 (una puja vacia el mapa de pases
            // entero, ver applyBid en @fut/shared/bidding.ts), y solo es
            // texto -- nunca solo color (MASTER.md S6) -- igual que GANANDO.
            const passed = state.currentBid === 0 && state.passes.get(player.playerId) === true;
            return (
              // `layout`: reposiciona con animacion si el orden de la lista
              // cambiara alguna vez (hoy es orden de insercion estable, pero
              // el coste es gratis -- solo transform, no cuenta contra el
              // presupuesto de MASTER.md S5 porque no hay ningun cambio de
              // layout real que animar en el caso comun). El color+texto de
              // "GANANDO"/"PASA" sigue siendo un cambio instantaneo de CSS,
              // no Framer: esta vista ya tiene su propio presupuesto de dos
              // elementos ocupado por el reveal (AuctionCard/RevealBar)
              // durante REVEAL.
              <motion.li
                key={player.playerId}
                layout={!reducedMotion}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex items-center justify-between px-4 py-3 ${leading ? "bg-lime text-ink" : "bg-ink text-white"}`}
              >
                <span className="font-display text-lg font-bold uppercase">
                  {player.name}
                  {/* El color no es el unico indicador: la etiqueta de texto va siempre con el. */}
                  {leading && <span className="ml-2 text-xs font-black tracking-widest">GANANDO</span>}
                  {passed && <span className="ml-2 text-xs font-black tracking-widest text-mute">PASA</span>}
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
              </motion.li>
            );
          })}
          </ul>

          {state.bidHistory.length > 0 && (
            <section className="border-2 border-white/10 bg-ink p-4" aria-label="Pujas recientes">
              <h2 className="font-display text-lg font-black uppercase tracking-wide text-white">Pujas recientes</h2>
              <ol className="mt-3 flex flex-col gap-2">
                {[...state.bidHistory].reverse().map((bid, index) => (
                  <li key={`${bid.playerId}-${bid.amount}-${index}`} className="flex justify-between font-body text-sm">
                    <span className="text-mute">{state.players.get(bid.playerId)?.name ?? "Jugador"}</span>
                    <span className="tnum font-display text-base font-extrabold text-green">{bid.amount} M</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Historial de la partida completa -- que salio y a cuanto, no
              solo la carta actual. Plegado por defecto, ver MatchHistory. */}
          <MatchHistory revealedCards={state.revealedCards} players={state.players} />
        </aside>
      </div>

      {showSummary && (
        <RoundSummary
          nextSlot={SLOTS[state.slotIndex] ?? state.currentSlot}
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

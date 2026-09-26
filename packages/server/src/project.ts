import {
  currentCardId, minimumBid, skipAllowed, SLOTS,
  toPublic, type AuctionState, type CardSource, type Rules,
} from "@fut/shared";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import { AuctionRoomState, BidRecordSchema, PlayerSchema, PublicCardSchema } from "./schema.js";

/**
 * Copia el estado puro sobre el Schema. Es el unico punto donde se decide que
 * ve el navegador: si un campo no se escribe aqui, no viaja.
 *
 * `publicIds` es el mapa cardId -> publicId de la sala (ver AuctionRoom): el
 * Schema solo puede llevar el identificador opaco, nunca el cardId real.
 *
 * `pendingRejoins` es el mismo set que AuctionRoom usa para no contar a un
 * reingreso a mitad de ronda como "necesitando" el hueco todavia (ver
 * AuctionRoom.onReconnected/flushPendingRejoins): se proyecta como
 * `rejoinPending` para que el navegador pueda distinguir "se cayo" de
 * "volvio y espera a la ronda siguiente", dos casos que `connected` por si
 * solo no diferencia.
 *
 * `readyIds` es el mismo Set privado que AuctionRoom usa para decidir
 * cuando arranca la ronda (ver AuctionRoom.ready/tryStartRound): se
 * proyecta como `PlayerSchema.ready` para que la sala de espera pueda
 * pintar quien ha pulsado "listo" y de cuantos falta -- solo tiene sentido
 * fuera de LOBBY como recuerdo de la ultima vez que se evaluo, asi que el
 * llamador (AuctionRoom.sync) sigue pasando el mismo Set en cualquier fase;
 * este metodo no necesita saber en que fase esta para proyectarlo bien.
 */
export function projectState(
  game: AuctionState,
  schema: AuctionRoomState,
  rules: Rules,
  cards: Map<string, CardSource>,
  publicIds: Map<string, string>,
  pendingRejoins: Set<string>,
  readyIds: Set<string>,
): void {
  schema.phase = game.phase;
  schema.slotIndex = game.slotIndex;
  // SLOTS[game.slotIndex] y no currentSlot(game): currentSlot() lanza
  // RangeError fuera de [0, SLOTS.length), y slotIndex vale eso (11) en
  // cuanto se completa la ultima ronda y la partida pasa a RESULTS.
  schema.currentSlot = SLOTS[game.slotIndex] ?? "";
  schema.currentBid = game.currentBid;
  schema.currentBidderId = game.currentBidderId ?? "";
  schema.openingBid = game.openingBid;
  schema.minimumBid = minimumBid(game, rules);
  schema.bidHistory = new ArraySchema<BidRecordSchema>(
    ...game.bidHistory.map((bid) => {
      const row = new BidRecordSchema();
      row.playerId = bid.playerId;
      row.amount = bid.amount;
      return row;
    }),
  );
  schema.endsAt = game.endsAt;
  schema.remainingCount = game.remainingCards.length;
  schema.skipAvailable = game.phase === "SKIP_VOTE" && skipAllowed(game);

  schema.skipVotes.clear();
  for (const [playerId, vote] of Object.entries(game.skipVotes)) schema.skipVotes.set(playerId, vote);

  schema.restrictedBidders = new ArraySchema<string>(...(game.restrictedBidders ?? []));

  schema.passes.clear();
  for (const playerId of Object.keys(game.passes)) schema.passes.set(playerId, true);

  // Barre del Schema a quien ya no esta en el estado puro (se fue durante el
  // lobby). Sin esto quedan filas fantasma: el Schema solo sabe anadir.
  const currentPlayerIds = new Set(game.players.map((p) => p.playerId));
  for (const playerId of [...schema.players.keys()]) {
    if (!currentPlayerIds.has(playerId)) schema.players.delete(playerId);
  }

  for (const player of game.players) {
    let row = schema.players.get(player.playerId);
    if (!row) {
      row = new PlayerSchema();
      row.playerId = player.playerId;
      row.squad = new MapSchema<string>();
      schema.players.set(player.playerId, row);
    }
    row.name = player.name;
    row.budget = player.budget;
    row.connected = player.connected;
    row.rejoinPending = pendingRejoins.has(player.playerId);
    row.ready = readyIds.has(player.playerId);
    for (const [slot, cardId] of Object.entries(player.squad)) {
      if (cardId !== undefined) row.squad.set(slot, cardId);
    }
  }

  // Durante REVEAL la carta ya salio de remainingCards, asi que currentCardId
  // apuntaria a la SIGUIENTE. Proyectarla aqui haria dos destrozos a la vez:
  // borraria de pantalla la carta que se esta revelando, y adelantaria la
  // silueta del proximo candidato antes de tiempo. No se toca.
  if (game.phase === "REVEAL") return;

  const cardId = game.phase === "LOBBY" ? null : currentCardId(game);
  if (cardId === null) {
    schema.currentCard = undefined;
    return;
  }

  const publicId = publicIds.get(cardId);
  if (!publicId) throw new Error(`cardId sin publicId asignado en esta partida: ${cardId}`);

  if (schema.currentCard?.publicId !== publicId) {
    const card = cards.get(cardId);
    if (!card) throw new Error(`cardId desconocido en el dataset: ${cardId}`);
    const pub = toPublic(card);
    const node = new PublicCardSchema();
    node.publicId = publicId;
    node.slot = pub.slot;
    node.heightCm = pub.heightCm;
    node.foot = pub.foot;
    node.ageBand = pub.ageBand;
    node.continent = pub.continent;
    node.decade = pub.decade;
    schema.currentCard = node;
  }
}

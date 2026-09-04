import {
  currentCardId, currentSlot, minimumBid, skipAllowed,
  toPublic, type AuctionState, type CardSource, type Rules,
} from "@fut/shared";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import { AuctionRoomState, PlayerSchema, PublicCardSchema } from "./schema.js";

/**
 * Copia el estado puro sobre el Schema. Es el unico punto donde se decide que
 * ve el navegador: si un campo no se escribe aqui, no viaja.
 */
export function projectState(
  game: AuctionState,
  schema: AuctionRoomState,
  rules: Rules,
  cards: Map<string, CardSource>,
): void {
  schema.phase = game.phase;
  schema.slotIndex = game.slotIndex;
  schema.currentSlot = game.phase === "LOBBY" ? "" : currentSlot(game);
  schema.currentBid = game.currentBid;
  schema.currentBidderId = game.currentBidderId ?? "";
  schema.minimumBid = minimumBid(game, rules);
  schema.endsAt = game.endsAt;
  schema.remainingCount = game.remainingCards.length;
  schema.skipAvailable = game.phase === "SKIP_VOTE" && skipAllowed(game);

  schema.skipVotes.clear();
  for (const [playerId, vote] of Object.entries(game.skipVotes)) schema.skipVotes.set(playerId, vote);

  schema.restrictedBidders = new ArraySchema<string>(...(game.restrictedBidders ?? []));

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

  if (schema.currentCard?.cardId !== cardId) {
    const card = cards.get(cardId);
    if (!card) throw new Error(`cardId desconocido en el dataset: ${cardId}`);
    const pub = toPublic(card);
    const node = new PublicCardSchema();
    node.cardId = pub.cardId;
    node.slot = pub.slot;
    node.silhouetteId = pub.silhouetteId;
    node.heightCm = pub.heightCm;
    node.foot = pub.foot;
    node.ageBand = pub.ageBand;
    node.continent = pub.continent;
    node.decade = pub.decade;
    schema.currentCard = node;
  }
}

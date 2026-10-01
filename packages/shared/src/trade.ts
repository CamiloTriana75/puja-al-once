import type { PlayerState, Result } from "./types.js";
import { err, ok } from "./types.js";

export type TradeOfferStatus = "OPEN" | "ACCEPTED" | "CANCELLED" | "EXPIRED";

export interface TradeOfferInput {
  offerId: string;
  proposerId: string;
  recipientId: string;
  offeredCardIds: string[];
  requestedCardIds: string[];
  proposerPays: number;
}

export interface TradeOffer extends TradeOfferInput {
  status: TradeOfferStatus;
}

export type TradeError =
  | "OFFER_ID_REQUIRED"
  | "PROPOSER_NOT_FOUND"
  | "RECIPIENT_NOT_FOUND"
  | "SAME_PLAYER"
  | "OFFERED_PLAYERS_REQUIRED"
  | "REQUESTED_PLAYERS_REQUIRED"
  | "DUPLICATE_CARD"
  | "OFFERED_PLAYER_NOT_OWNED"
  | "REQUESTED_PLAYER_NOT_OWNED"
  | "PLAYERS_MUST_MATCH_POSITIONS"
  | "INVALID_PAYMENT"
  | "INSUFFICIENT_BUDGET"
  | "OFFER_NOT_OPEN"
  | "OFFER_STALE";

interface OwnedCard {
  player: PlayerState;
  slot: keyof PlayerState["squad"];
}

function findOwnedCard(players: PlayerState[], playerId: string, cardId: string): OwnedCard | null {
  const player = players.find((candidate) => candidate.playerId === playerId);
  if (!player) return null;

  const slot = (Object.keys(player.squad) as Array<keyof PlayerState["squad"]>)
    .find((candidate) => player.squad[candidate] === cardId);
  return slot ? { player, slot } : null;
}

function hasDuplicates(cardIds: string[]): boolean {
  return new Set(cardIds).size !== cardIds.length;
}

/**
 * Posicion de juego de un hueco: los dos centrales son la misma (cambiar el
 * CB1 de uno por el CB2 de otro es un cambio de central por central; con los
 * nombres de hueco en crudo ese cambio, el mas natural de la defensa, se
 * rechazaba).
 */
function positionOf(slot: keyof PlayerState["squad"]): string {
  return slot === "CB1" || slot === "CB2" ? "CB" : slot;
}

function positionsMatch(offered: OwnedCard[], requested: OwnedCard[]): boolean {
  const offeredPositions = offered.map(({ slot }) => positionOf(slot)).sort();
  const requestedPositions = requested.map(({ slot }) => positionOf(slot)).sort();
  return offeredPositions.every((position, index) => position === requestedPositions[index]);
}

function validateCards(
  players: PlayerState[],
  input: TradeOfferInput,
): Result<{ proposer: PlayerState; recipient: PlayerState; offered: OwnedCard[]; requested: OwnedCard[] }, TradeError> {
  const proposer = players.find((player) => player.playerId === input.proposerId);
  if (!proposer) return err("PROPOSER_NOT_FOUND");
  const recipient = players.find((player) => player.playerId === input.recipientId);
  if (!recipient) return err("RECIPIENT_NOT_FOUND");
  if (input.proposerId === input.recipientId) return err("SAME_PLAYER");
  if (input.offeredCardIds.length === 0) return err("OFFERED_PLAYERS_REQUIRED");
  if (input.requestedCardIds.length === 0) return err("REQUESTED_PLAYERS_REQUIRED");
  if (hasDuplicates([...input.offeredCardIds, ...input.requestedCardIds])) return err("DUPLICATE_CARD");

  const offered = input.offeredCardIds.map((cardId) => findOwnedCard(players, input.proposerId, cardId));
  if (offered.some((card) => card === null)) return err("OFFERED_PLAYER_NOT_OWNED");
  const requested = input.requestedCardIds.map((cardId) => findOwnedCard(players, input.recipientId, cardId));
  if (requested.some((card) => card === null)) return err("REQUESTED_PLAYER_NOT_OWNED");

  const ownedOffered = offered as OwnedCard[];
  const ownedRequested = requested as OwnedCard[];
  if (ownedOffered.length !== ownedRequested.length || !positionsMatch(ownedOffered, ownedRequested)) {
    return err("PLAYERS_MUST_MATCH_POSITIONS");
  }
  return ok({ proposer, recipient, offered: ownedOffered, requested: ownedRequested });
}

export function createTradeOffer(
  players: PlayerState[],
  input: TradeOfferInput,
  openOffers: TradeOffer[] = [],
): Result<TradeOffer, TradeError> {
  if (!input.offerId) return err("OFFER_ID_REQUIRED");
  if (!Number.isSafeInteger(input.proposerPays) || input.proposerPays < 0) return err("INVALID_PAYMENT");

  const validation = validateCards(players, input);
  if (!validation.ok) return validation;

  const reserved = openOffers
    .filter((offer) => offer.status === "OPEN" && offer.proposerId === input.proposerId)
    .reduce((total, offer) => total + offer.proposerPays, 0);
  if (validation.value.proposer.budget - reserved < input.proposerPays) return err("INSUFFICIENT_BUDGET");

  return ok({ ...input, status: "OPEN" });
}

export function acceptTradeOffer(
  players: PlayerState[],
  offer: TradeOffer,
): Result<PlayerState[], TradeError> {
  if (offer.status !== "OPEN") return err("OFFER_NOT_OPEN");
  if (!Number.isSafeInteger(offer.proposerPays) || offer.proposerPays < 0) return err("INVALID_PAYMENT");

  const validation = validateCards(players, offer);
  if (!validation.ok) return err("OFFER_STALE");
  if (validation.value.proposer.budget < offer.proposerPays) return err("OFFER_STALE");

  const nextPlayers = players.map((player) => ({ ...player, squad: { ...player.squad } }));
  const proposer = nextPlayers.find((player) => player.playerId === offer.proposerId);
  const recipient = nextPlayers.find((player) => player.playerId === offer.recipientId);
  if (!proposer || !recipient) return err("OFFER_STALE");

  // Cada carta ofrecida se empareja con una pedida de su misma posicion (no por
  // orden de la lista) y cae en el hueco que dejo libre la otra.
  const unmatched = [...validation.value.requested];
  validation.value.offered.forEach((given) => {
    const index = unmatched.findIndex((candidate) => positionOf(candidate.slot) === positionOf(given.slot));
    const taken = unmatched.splice(index, 1)[0]!;
    const givenCardId = given.player.squad[given.slot]!;
    const takenCardId = taken.player.squad[taken.slot]!;
    proposer.squad[given.slot] = takenCardId;
    recipient.squad[taken.slot] = givenCardId;
  });
  proposer.budget -= offer.proposerPays;
  recipient.budget += offer.proposerPays;
  return ok(nextPlayers);
}
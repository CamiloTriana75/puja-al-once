import { playersNeedingSlot, skipAllowed } from "./skip.js";
import {
  currentCardId, currentSlot,
  type AuctionState, type Rng, type Rules,
} from "./types.js";

export type AuctionOutcome =
  | { kind: "AWARDED"; cardId: string; playerId: string; price: number }
  | { kind: "FORCED"; cardId: string; playerId: string; price: number }
  | { kind: "DISCARDED"; cardId: string }
  | { kind: "OPEN_SKIP_VOTE"; cardId: string };

/**
 * Decide como termina la subasta de la carta que esta sobre la mesa. El orden
 * de las ramas importa: el descarte tras un voto fallido tiene que evaluarse
 * antes que el sorteo, porque el voto de salto solo puede haber ocurrido si
 * habia margen y en ese caso descartar es seguro.
 */
export function resolveAuction(state: AuctionState, rules: Rules, rng: Rng): AuctionOutcome {
  const cardId = currentCardId(state);
  if (cardId === null) throw new Error("resolveAuction sin carta sobre la mesa");

  if (state.currentBidderId !== null) {
    return { kind: "AWARDED", cardId, playerId: state.currentBidderId, price: state.currentBid };
  }

  if (state.restrictedBidders !== null) return { kind: "DISCARDED", cardId };

  if (skipAllowed(state)) return { kind: "OPEN_SKIP_VOTE", cardId };

  const eligible = playersNeedingSlot(state);
  if (eligible.length === 0) return { kind: "DISCARDED", cardId };

  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  const winner = eligible[index]!;
  return { kind: "FORCED", cardId, playerId: winner.playerId, price: rules.basePrice };
}

/** Aplica el desenlace y devuelve un estado nuevo. No muta el recibido. */
export function applyOutcome(state: AuctionState, outcome: AuctionOutcome): AuctionState {
  if (outcome.kind === "OPEN_SKIP_VOTE") {
    return { ...state, phase: "SKIP_VOTE", skipVotes: {} };
  }

  const slot = currentSlot(state);
  const players =
    outcome.kind === "DISCARDED"
      ? state.players
      : state.players.map((p) =>
          p.playerId === outcome.playerId
            ? { ...p, budget: p.budget - outcome.price, squad: { ...p.squad, [slot]: outcome.cardId } }
            : p,
        );

  return {
    ...state,
    players,
    remainingCards: state.remainingCards.slice(1),
    currentBid: 0,
    currentBidderId: null,
    restrictedBidders: null,
    skipVotes: {},
    phase: "REVEAL",
  };
}

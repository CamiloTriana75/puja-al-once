import { maxBid } from "./budget.js";
import {
  currentSlot, err, ok,
  type AuctionState, type Result, type Rules,
} from "./types.js";

export type BidError =
  | "WRONG_PHASE"
  | "AUCTION_CLOSED"
  | "UNKNOWN_PLAYER"
  | "DISCONNECTED"
  | "SLOT_ALREADY_FILLED"
  | "NOT_ALLOWED_TO_BID"
  | "BID_TOO_LOW"
  | "OVER_BUDGET";

/** El importe mas bajo que ahora mismo constituye una puja valida. */
export function minimumBid(state: AuctionState, rules: Rules): number {
  return state.currentBid === 0 ? rules.basePrice : state.currentBid + rules.minIncrement;
}

/**
 * Unica autoridad sobre si una puja vale. `now` es la hora del servidor en el
 * momento de recibir el mensaje, no la del cliente.
 */
export function canBid(
  state: AuctionState,
  rules: Rules,
  playerId: string,
  amount: number,
  now: number,
): Result<void, BidError> {
  if (state.phase !== "BIDDING") return err("WRONG_PHASE");
  if (now > state.endsAt) return err("AUCTION_CLOSED");

  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return err("UNKNOWN_PLAYER");
  if (!player.connected) return err("DISCONNECTED");
  if (player.squad[currentSlot(state)] !== undefined) return err("SLOT_ALREADY_FILLED");

  if (state.restrictedBidders !== null && !state.restrictedBidders.includes(playerId)) {
    return err("NOT_ALLOWED_TO_BID");
  }

  if (!Number.isInteger(amount) || amount < minimumBid(state, rules)) return err("BID_TOO_LOW");
  if (amount > maxBid(player, rules)) return err("OVER_BUDGET");

  return ok(undefined);
}

/**
 * Registra una puja ya validada y empuja el cierre. Devuelve un estado nuevo:
 * no muta el recibido.
 */
export function applyBid(
  state: AuctionState,
  rules: Rules,
  playerId: string,
  amount: number,
  now: number,
): AuctionState {
  return {
    ...state,
    currentBid: amount,
    currentBidderId: playerId,
    endsAt: now + rules.antiSnipeMs,
  };
}

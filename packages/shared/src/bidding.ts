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

/** Precio de salida segun la valoracion privada del candidato. */
export function openingBidForRating(rating: number, rules: Rules): number {
  return rules.openingBidTiers.find((tier) => rating >= tier.minimumRating)?.price ?? rules.basePrice;
}

/** El importe mas bajo que ahora mismo constituye una puja valida. */
export function minimumBid(state: AuctionState, rules: Rules): number {
  return state.currentBid === 0 ? state.openingBid : state.currentBid + rules.minIncrement;
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
  // D1: `endsAt` esta siempre armado durante BIDDING (ventana de apertura
  // antes de la primera puja, anti-snipe despues), pero el guard contra 0
  // se mantiene por si alguna vez llega un estado sin ventana asignada --
  // mejor aceptar la puja que rechazarla contra un reloj que no corre.
  if (state.endsAt !== 0 && now > state.endsAt) return err("AUCTION_CLOSED");

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
    bidHistory: [...state.bidHistory, { playerId, amount }].slice(-5),
    // D2: "pass" solo tiene sentido mientras currentBid === 0 -- en cuanto
    // hay puja, cualquier pase anterior queda obsoleto (el hueco ya no se
    // resuelve por unanimidad de pases, se resuelve pujando).
    passes: {},
  };
}

import { SLOTS, type PlayerState, type Rules } from "./types.js";

export function filledSlotCount(player: PlayerState): number {
  return SLOTS.filter((slot) => player.squad[slot] !== undefined).length;
}

/**
 * Lo que el jugador debe conservar DESPUES de ganar la subasta actual, para
 * poder pagar el precio base de los huecos que le seguirian faltando.
 * El hueco en juego no cuenta: ganarlo es precisamente lo que lo llena.
 */
export function reservedBudget(player: PlayerState, rules: Rules): number {
  const missingAfterWin = SLOTS.length - filledSlotCount(player) - 1;
  return Math.max(0, missingAfterWin) * rules.basePrice;
}

/** El importe mas alto que este jugador puede pujar sin inhabilitarse. */
export function maxBid(player: PlayerState, rules: Rules): number {
  return Math.max(0, player.budget - reservedBudget(player, rules));
}

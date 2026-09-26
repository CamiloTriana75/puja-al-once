import type { AuctionOutcome } from "./auction.js";
import { playersNeedingSlot, skipAllowed } from "./skip.js";
import { currentCardId, type AuctionState, type Rng, type Rules } from "./types.js";

/**
 * Desenlace de un pase colectivo (D2): a diferencia de `resolveAuction`,
 * nunca abre una votacion de salto -- ya la decidieron pasando -- asi que
 * solo puede terminar en descarte o en sorteo forzado.
 */
export type PassOutcome = Extract<AuctionOutcome, { kind: "DISCARDED" } | { kind: "FORCED" }>;

/**
 * Quien puede pasar la carta actual: necesita el hueco y, si la subasta
 * esta en fase restringida (tras un voto de salto fallido), ademas tiene
 * que estar en esa lista -- mismo filtro que `canBid` aplica a `bid`, y por
 * el mismo motivo: son los unicos a quienes la carta les incumbe ahora mismo.
 */
export function playersEligibleToPass(state: AuctionState): string[] {
  const needing = playersNeedingSlot(state).map((p) => p.playerId);
  if (state.restrictedBidders === null) return needing;
  const restricted = new Set(state.restrictedBidders);
  return needing.filter((id) => restricted.has(id));
}

/**
 * D2: cuando TODOS los elegibles han pasado la carta se resuelve al
 * instante -- lo decide `AuctionRoom.onPass`, comprobando que
 * `playersEligibleToPass` entero este en `state.passes`, y entonces llama
 * aqui. Un pase unanime equivale al salto (mismo criterio que
 * `resolveSkipVote`), pero no hace falta abrir una votacion para confirmar
 * algo que ya es unanime.
 *
 * Con margen de sobra pasar todos es un descarte seguro -- exactamente lo
 * que un `SKIPPED` unanime habria decidido. Sin margen no se puede permitir
 * un descarte mas (dejaria a alguien sin hueco), asi que se sortea entre
 * los elegibles, igual que `resolveAuction` cuando se agota el margen. En
 * fase restringida el margen ya se dio por agotado en la ronda de voto que
 * llevo hasta aqui (ver `resolveAuction`: `restrictedBidders !== null`
 * siempre descarta) -- pasar en esa fase sigue esa misma regla, sin sorteo.
 */
export function resolvePass(state: AuctionState, rules: Rules, rng: Rng): PassOutcome {
  const cardId = currentCardId(state);
  if (cardId === null) throw new Error("resolvePass sin carta sobre la mesa");

  if (state.restrictedBidders !== null) return { kind: "DISCARDED", cardId };
  if (skipAllowed(state)) return { kind: "DISCARDED", cardId };

  const eligible = playersNeedingSlot(state);
  if (eligible.length === 0) return { kind: "DISCARDED", cardId };

  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  const winner = eligible[index]!;
  return { kind: "FORCED", cardId, playerId: winner.playerId, price: state.openingBid };
}

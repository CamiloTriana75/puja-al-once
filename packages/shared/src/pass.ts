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
 * Quien puede pasar la carta actual: los mismos jugadores de
 * `playersNeedingSlot`, ni uno mas -- el mismo criterio que decide el voto de
 * saltar (`resolveSkipVote`), porque pasar y saltar son la misma pregunta con
 * dos mecanismos distintos. Quien ya ficho este puesto no puede pujar
 * (`canBid` exige el hueco libre) asi que tampoco tiene nada que decir sobre
 * pasar: contar su pase solo haria que `AuctionRoom.onPass` no llegase nunca a
 * `allPassed` y la carta quemase la ventana de puja antes de acabar
 * descartada por el camino del voto de salto.
 *
 * Tras un voto de salto fallido la subasta entra en fase restringida y la carta
 * deja de incumbirle a cualquiera que no siga necesitando el hueco, asi que en
 * esa fase hace falta estar A LA VEZ en `restrictedBidders` Y en
 * `playersNeedingSlot`. `resolveSkipVote` ya construye `restrictedBidders`
 * acotado a quien necesita el hueco, asi que en la practica el segundo filtro
 * nunca quita a nadie que el primero no quitara ya -- se mantiene como defensa
 * en profundidad, para que esta funcion nunca dependa en silencio de que su
 * unico llamador (`resolveSkipVote`) siga construyendo bien esa lista.
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
 * un descarte mas (dejaria a alguien sin hueco), asi que se sortea entre quien
 * TODAVIA necesita el hueco. Es el mismo conjunto que `playersEligibleToPass`:
 * nadie que haya pasado puede ganar una carta que no le hace falta, igual que
 * `resolveAuction` cuando se agota el margen. En fase restringida el margen ya
 * se dio por agotado en la ronda de voto que llevo hasta aqui (ver
 * `resolveAuction`: `restrictedBidders !== null` siempre descarta) -- pasar en
 * esa fase sigue esa misma regla, sin sorteo.
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

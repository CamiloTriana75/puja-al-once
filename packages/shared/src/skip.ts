import { currentSlot, type AuctionState, type PlayerState } from "./types.js";

/** Jugadores conectados a los que aun les falta el hueco en juego. */
export function playersNeedingSlot(state: AuctionState): PlayerState[] {
  const slot = currentSlot(state);
  return state.players.filter((p) => p.connected && p.squad[slot] === undefined);
}

/**
 * Solo se puede saltar mientras sobren cartas. Cuando quedan tantas como
 * jugadores por fichar, cada carta tiene que acabar en un equipo: saltar
 * dejaria a alguien con el hueco vacio, asi que se prohibe.
 */
export function skipAllowed(state: AuctionState): boolean {
  return state.remainingCards.length > playersNeedingSlot(state).length;
}

export type SkipOutcome =
  | { kind: "SKIPPED" }
  | { kind: "RESUMED"; restrictedBidders: string[] };

/**
 * Quien decide el salto: exactamente los mismos jugadores de
 * `playersNeedingSlot`, ni uno mas. Quien ya ficho este puesto no vota y no
 * bloquea, porque tampoco puede pujar por la carta (`canBid` exige el hueco
 * libre): si su voto contara, unanimidad seria inalcanzable desde la propia
 * interfaz -- la UI oculta los botones a quien ya ficho
 * (`Auction.tsx`, `canVoteSkip = !alreadySigned`) y solo lista como voteantes a
 * los de `playersNeedingSlot`, asi que la sala se quedaria esperando un voto
 * que nadie puede emitir hasta que se agota `rules.skipVoteMs`.
 *
 * Si falla la unanimidad, la subasta se reanuda pero solo pueden pujar quienes
 * ademas necesitan el hueco Y votaron explicitamente en contra: votaste que la
 * querias, pujala. Abstenerse no bloquea el salto ni habilita a pujar, asi que
 * una sala entera ausente termina en descarte y la ronda avanza.
 *
 * El caso de cero jugadores necesita el hueco devuelve `SKIPPED`: la carta no
 * le interesa a nadie y descartarla es lo unico sensato. `every` sobre un
 * array vacio daria `true` por accidente y dejaria `SKIPPED`取决ido del
 * guard de arriba, no de la regla.
 */
export function resolveSkipVote(state: AuctionState): SkipOutcome {
  const voters = playersNeedingSlot(state).map((p) => p.playerId);
  if (voters.length === 0) return { kind: "SKIPPED" };

  if (voters.every((id) => state.skipVotes[id] === true)) return { kind: "SKIPPED" };

  return {
    kind: "RESUMED",
    restrictedBidders: voters.filter((id) => state.skipVotes[id] === false),
  };
}

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
 * El salto exige unanimidad de los que necesitan el hueco. Si falla, la subasta
 * se reanuda pero solo pueden pujar quienes votaron explicitamente en contra:
 * votaste que la querias, pujala. Abstenerse no bloquea el salto ni habilita a
 * pujar, asi que una sala entera ausente termina en descarte y la ronda avanza.
 */
export function resolveSkipVote(state: AuctionState): SkipOutcome {
  const eligible = playersNeedingSlot(state).map((p) => p.playerId);
  const unanimous = eligible.length > 0 && eligible.every((id) => state.skipVotes[id] === true);
  if (unanimous) return { kind: "SKIPPED" };
  return {
    kind: "RESUMED",
    restrictedBidders: eligible.filter((id) => state.skipVotes[id] === false),
  };
}

import { currentSlot, type AuctionState, type PlayerState } from "./types.js";

/** Jugadores conectados a los que aun les falta el hueco en juego. */
export function playersNeedingSlot(state: AuctionState): PlayerState[] {
  const slot = currentSlot(state);
  return state.players.filter((p) => p.connected && p.squad[slot] === undefined);
}

/**
 * Todos los jugadores conectados de la sala, tengan o no ya el hueco en
 * juego. A diferencia de `playersNeedingSlot`, esta lista decide QUIEN
 * VOTA/PASA (ver `resolveSkipVote` y `playersEligibleToPass` en `pass.ts`),
 * nunca a quien le toca de verdad la carta -- eso sigue siendo terreno
 * exclusivo de `playersNeedingSlot`: el margen de `skipAllowed`, quien puede
 * pujar (`canBid`) y quien puede ganar un sorteo forzado (`resolveAuction`,
 * `resolvePass`) no cambian con esta funcion. El usuario pidio explicitamente
 * que el voto de saltar cuente para toda la sala, no solo para quien todavia
 * ficha este puesto: alguien que ya tiene su GK sigue viendo la carta en
 * juego y le puede interesar la decision igual.
 */
export function playersEligible(state: AuctionState): PlayerState[] {
  return state.players.filter((p) => p.connected);
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
 * El salto exige unanimidad de TODOS los jugadores conectados
 * (`playersEligible`), no solo de quien todavia necesita el hueco -- el voto
 * es de sala entera. Si falla, la subasta se reanuda pero solo pueden pujar
 * quienes ademas necesitan el hueco Y votaron explicitamente en contra:
 * votaste que la querias, pujala. Un jugador que ya ficho este puesto puede
 * votar (su opinion cuenta para la unanimidad) pero nunca puede acabar en
 * `restrictedBidders` ni pujar por una carta que no le hace falta -- de ahi
 * el filtro extra contra `playersNeedingSlot` al construir el desenlace.
 * Abstenerse no bloquea el salto ni habilita a pujar, asi que una sala entera
 * ausente termina en descarte y la ronda avanza.
 */
export function resolveSkipVote(state: AuctionState): SkipOutcome {
  const eligible = playersEligible(state).map((p) => p.playerId);
  const unanimous = eligible.length > 0 && eligible.every((id) => state.skipVotes[id] === true);
  if (unanimous) return { kind: "SKIPPED" };

  const needing = new Set(playersNeedingSlot(state).map((p) => p.playerId));
  return {
    kind: "RESUMED",
    restrictedBidders: eligible.filter((id) => state.skipVotes[id] === false && needing.has(id)),
  };
}

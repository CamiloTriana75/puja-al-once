import type { ClientState, RevealedCardView } from "./types.js";

export interface LiveStanding {
  playerId: string;
  name: string;
  /** Puede ser fraccionaria: un hueco empatado reparte su punto -- mismo criterio que scoreMatch en @fut/shared. */
  points: number;
  rank: number;
}

/**
 * Clasificacion PARCIAL, calculada en el cliente sobre solo los puestos ya
 * jugados -- para el resumen entre rondas (punto 4 del encargo B5): "un
 * momento que diga que puesto viene y como va la clasificacion".
 *
 * `state.standings` (el Schema) solo se rellena en RESULTS, al final de la
 * partida entera -- AuctionRoom.finish() es el unico sitio que lo escribe.
 * Portar el calculo aqui, en vez de esperar a que el servidor lo haga a
 * mitad de partida, evita anadir una ruta nueva al servidor para algo que
 * el cliente ya puede calcular solo: cada cardId en `player.squad` fue
 * fichado durante REVEAL, y solo llega ahi tras pasar por
 * `state.revealedCards` (nadie ficha nada de una carta que no se ha
 * resuelto todavia) -- asi que el cruce cardId -> rating siempre es
 * completo para los puestos ya cerrados. Cero datos privados nuevos: es el
 * mismo cruce que ya hace `wonSlotsByPlayer` en Results.tsx, generalizado a
 * puntos en vez de a huecos ganados sueltos.
 *
 * No es `@fut/shared`.scoreMatch reutilizada a proposito: esa funcion pide
 * `PlayerState.squad` (Partial<Record<Slot,string>>) y un `ratingOf`
 * inyectado porque en el servidor el rating es privado -- aqui ya es
 * publico via revealedCards, y el cliente nunca ha importado `@fut/shared`
 * (net/types.ts construye su propio tipado plano a proposito, ver su
 * comentario de cabecera); las 11 posiciones ya estan duplicadas como
 * constante local en varios sitios del cliente (SquadGrid.tsx,
 * Auction.tsx) siguiendo ese mismo patron.
 */
const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

export function computeLiveStandings(state: ClientState): LiveStanding[] {
  const revealedCards: Map<string, RevealedCardView> = state.revealedCards;
  const players = [...state.players.values()];
  const points = new Map(players.map((p) => [p.playerId, 0]));

  for (const slot of SLOTS) {
    const holders = players
      .map((p) => ({ playerId: p.playerId, cardId: p.squad.get(slot) }))
      .filter((h): h is { playerId: string; cardId: string } => h.cardId !== undefined)
      .map((h) => ({ playerId: h.playerId, rating: revealedCards.get(h.cardId)?.rating ?? 0 }));

    if (holders.length === 0) continue;

    const best = Math.max(...holders.map((h) => h.rating));
    const winners = holders.filter((h) => h.rating === best);
    const share = 1 / winners.length;
    for (const w of winners) points.set(w.playerId, (points.get(w.playerId) ?? 0) + share);
  }

  const rows = players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    points: points.get(p.playerId) ?? 0,
    rank: 0,
  }));

  rows.sort((a, b) => b.points - a.points);

  let rank = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    if (prev === undefined || prev.points !== row.points) rank = i + 1;
    row.rank = rank;
  });

  return rows;
}

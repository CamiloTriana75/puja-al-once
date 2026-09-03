import { SLOTS, type PlayerState } from "./types.js";

export interface Standing {
  playerId: string;
  /** Puede ser fraccionario: un hueco empatado reparte su punto. */
  points: number;
  totalRating: number;
  budgetLeft: number;
  /** 1 es el mejor. Dos jugadores comparten rango si empatan en todo. */
  rank: number;
}

/**
 * Compara hueco por hueco: un punto para el rating mas alto de cada posicion,
 * repartido si hay empate. Un hueco vacio nunca puntua.
 *
 * `ratingOf` se inyecta porque el rating es dato privado del servidor.
 */
export function scoreMatch(
  players: PlayerState[],
  ratingOf: (cardId: string) => number,
): Standing[] {
  const points = new Map(players.map((p) => [p.playerId, 0]));

  for (const slot of SLOTS) {
    const holders = players
      .map((p) => ({ playerId: p.playerId, cardId: p.squad[slot] }))
      .filter((h): h is { playerId: string; cardId: string } => h.cardId !== undefined)
      .map((h) => ({ playerId: h.playerId, rating: ratingOf(h.cardId) }));

    if (holders.length === 0) continue;

    const best = Math.max(...holders.map((h) => h.rating));
    const winners = holders.filter((h) => h.rating === best);
    const share = 1 / winners.length;
    for (const w of winners) points.set(w.playerId, (points.get(w.playerId) ?? 0) + share);
  }

  const rows = players.map((p) => ({
    playerId: p.playerId,
    points: points.get(p.playerId) ?? 0,
    totalRating: SLOTS.reduce((sum, slot) => {
      const cardId = p.squad[slot];
      return cardId === undefined ? sum : sum + ratingOf(cardId);
    }, 0),
    budgetLeft: p.budget,
    rank: 0,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.totalRating - a.totalRating ||
      b.budgetLeft - a.budgetLeft,
  );

  let rank = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied =
      prev !== undefined &&
      prev.points === row.points &&
      prev.totalRating === row.totalRating &&
      prev.budgetLeft === row.budgetLeft;
    if (!tied) rank = i + 1;
    row.rank = rank;
  });

  return rows;
}

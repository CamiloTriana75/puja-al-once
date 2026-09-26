import type { CardSource, Rng, Slot } from "@fut/shared";

/**
 * Toma `playerCount + 1` cartas del mazo del hueco y las baraja.
 * Sobra siempre una: eso es lo que da margen para saltar y garantiza descarte.
 *
 * Nunca devuelve dos cartas del mismo futbolista (mismo `name`): dos temporadas
 * del mismo jugador no pueden salir juntas en una ronda. Tras barajar, se
 * recorre el mazo y se toma la primera carta de cada jugador distinto, así
 * que cada temporada tiene la misma probabilidad de ser la elegida.
 */
export function drawRound(
  grouped: Record<Slot, CardSource[]>,
  slot: Slot,
  playerCount: number,
  rng: Rng,
  used: Set<string>,
): string[] {
  const pool = grouped[slot].filter((card) => !used.has(card.cardId));
  const needed = playerCount + 1;
  if (pool.length < needed) {
    throw new Error(`El hueco ${slot} tiene ${pool.length} cartas libres y hacen falta ${needed}`);
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const seenNames = new Set<string>();
  const drawn: CardSource[] = [];
  for (const card of shuffled) {
    if (drawn.length >= needed) break;
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);
    drawn.push(card);
  }

  if (drawn.length < needed) {
    throw new Error(
      `El hueco ${slot} tiene ${seenNames.size} jugadores distintos libres y hacen falta ${needed}`,
    );
  }

  for (const card of drawn) used.add(card.cardId);
  return drawn.map((card) => card.cardId);
}

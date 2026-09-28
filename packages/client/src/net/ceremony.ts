import type { ClientState, PlayerView, RevealedCardView } from "./types.js";

/**
 * Formacion en el orden en que se juega -- misma constante duplicada
 * localmente que en Auction.tsx/SquadGrid.tsx/liveStandings.ts (el cliente
 * nunca importa `@fut/shared`, ver la cabecera de liveStandings.ts). La
 * ceremonia recorre los puestos en ESTE orden porque es el que describe
 * design-system/pages/ceremonia.md: "Once pasos, uno por puesto... en el
 * orden de la formacion" -- el mismo orden en que se jugaron, no un orden
 * alfabetico ni por rating.
 */
export const CEREMONY_SLOTS = [
  "GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW",
] as const;

export const SLOT_LABEL: Record<string, string> = {
  GK: "Portero",
  LB: "Lateral izquierdo",
  CB1: "Central",
  CB2: "Central",
  RB: "Lateral derecho",
  CDM: "Mediocentro defensivo",
  CM: "Mediocentro",
  CAM: "Mediapunta",
  LW: "Extremo izquierdo",
  ST: "Delantero",
  RW: "Extremo derecho",
};

/** Una carta concreta dentro de un paso de la ceremonia. */
export interface CeremonyEntry {
  playerId: string;
  playerName: string;
  cardId: string;
  card: RevealedCardView;
  /** Gana este puesto (o empata la victoria) una vez destapado el rating. */
  wins: boolean;
}

export interface CeremonyStep {
  slot: string;
  label: string;
  /** Una entrada por jugador que ficho ese puesto. Vacio si nadie lo cubrio. */
  entries: CeremonyEntry[];
}

/**
 * Construye los once pasos de la ceremonia a partir del estado publico ya
 * disponible en RESULTS (rating real, `revealedCards` completo -- D3 solo
 * oculta el rating DURANTE la partida, en RESULTS el servidor ya lo publica
 * de verdad, ver PublicCardSchema/AuctionRoom). Nada de esto es un dato
 * nuevo: es una proyeccion de lectura, igual que `computeLiveStandings`.
 *
 * Empate: TODOS los que empatan el mejor rating de ese puesto llevan
 * `wins: true` -- ceremonia.md pide "Empate: +0.5 a cada uno", que aqui se
 * traduce en marcar a ambos como ganadores del paso (el incremento de
 * marcador lo decide quien consume `CeremonyStep`, no esta funcion).
 */
export function buildCeremonySteps(state: ClientState): CeremonyStep[] {
  const players = [...state.players.values()];

  return CEREMONY_SLOTS.map((slot) => {
    const entries: CeremonyEntry[] = players
      .map((p) => {
        const cardId = p.squad.get(slot);
        if (!cardId) return null;
        const card = state.revealedCards.get(cardId);
        if (!card) return null;
        return { playerId: p.playerId, playerName: p.name, cardId, card, wins: false };
      })
      .filter((e): e is CeremonyEntry => e !== null);

    if (entries.length > 0) {
      const best = Math.max(...entries.map((e) => e.card.rating));
      for (const e of entries) e.wins = e.card.rating === best;
    }

    return { slot, label: SLOT_LABEL[slot] ?? slot, entries };
  });
}

/** Cuanto suma cada jugador en el marcador de la ceremonia tras TODOS los pasos -- +0.5 repartido en empates, igual que computeLiveStandings. */
export function ceremonyPoints(steps: CeremonyStep[], players: PlayerView[]): Map<string, number> {
  const points = new Map(players.map((p) => [p.playerId, 0]));
  for (const step of steps) {
    const winners = step.entries.filter((e) => e.wins);
    if (winners.length === 0) continue;
    const share = 1 / winners.length;
    for (const w of winners) points.set(w.playerId, (points.get(w.playerId) ?? 0) + share);
  }
  return points;
}

export interface CeremonyChampion {
  playerId: string;
  name: string;
  points: number;
}

/**
 * Quien(es) gana(n) la partida, tal y como lo cuenta la clasificacion final.
 *
 * La fuente de verdad es `state.standings` -- lo calcula el servidor en
 * `AuctionRoom.finish()` con `scoreMatch`, que desempata por puntos, luego
 * rating total y luego presupuesto restante (`packages/shared/src/scoring.ts`).
 * Leerlo aqui, en vez de quedarse solo con los puntos de la ceremonia, evita
 * el contradicto que habia antes: dos jugadores empatados en puntos declaraba
 * campañas la ceremonia ("Campeones: A · B") mientras la tabla de abajo
 * escondia a uno detras del desempate del servidor y lo pintaba como segundo.
 * Ahora las dos pantallas cuentan exactamente lo mismo, y solo hay varios
 * campeones cuando el servidor dice que hay varios (empate en los tres
 * criterios).
 *
 * El segundo camino es un red de seguridad, no una via normal: `standings`
 * solo se rellena en RESULTS y la ceremonia solo se monta en RESULTS. Si
 * llegara vacio, se cae a los puntos de la ceremonia en vez de quedarse sin
 * campeon.
 */
export function ceremonyChampions(state: ClientState): CeremonyChampion[] {
  const ranked = state.standings.filter((row) => row.rank === 1);
  if (ranked.length > 0) {
    return ranked.map((row) => ({
      playerId: row.playerId,
      name: state.players.get(row.playerId)?.name ?? "?",
      points: row.points,
    }));
  }

  const points = ceremonyPoints(buildCeremonySteps(state), [...state.players.values()]);
  const best = Math.max(0, ...[...points.values()]);
  return [...state.players.values()]
    .filter((player) => (points.get(player.playerId) ?? 0) === best)
    .map((player) => ({ playerId: player.playerId, name: player.name, points: best }));
}

export interface CeremonyAward {
  title: string;
  playerId: string;
  playerName: string;
  detail: string;
}

/**
 * Ranking 1-indexado por una clave numerica, mayor primero (rating: mejor es
 * mas alto; precio: mas caro es mas alto). Empates comparten el mismo puesto
 * de ranking -- mismo criterio de "rank" que ya usa `computeLiveStandings` y
 * `StandingView.rank` del servidor, para no inventar una segunda convencion.
 */
function rankBy<T>(items: T[], keyOf: (item: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => keyOf(b) - keyOf(a));
  const ranks = new Map<T, number>();
  let rank = 0;
  sorted.forEach((item, i) => {
    const prev = sorted[i - 1];
    if (prev === undefined || keyOf(prev) !== keyOf(item)) rank = i + 1;
    ranks.set(item, rank);
  });
  return ranks;
}

/**
 * Los tres premios de ceremonia.md, calculados sobre las cartas ADJUDICADAS
 * de la partida (ownerId no vacio) -- las descartadas nunca entran, tal como
 * pide la spec. Si la partida no tuvo ninguna puja adjudicada, ningun premio
 * tiene candidato y se devuelve un array vacio: "si un premio no tiene
 * candidato claro (partida sin pujas), no se muestra".
 */
export function computeAwards(state: ClientState): CeremonyAward[] {
  const awarded = [...state.revealedCards.values()].filter((c) => c.ownerId !== "");
  if (awarded.length === 0) return [];

  const priceRank = rankBy(awarded, (c) => c.price);
  const ratingRank = rankBy(awarded, (c) => c.rating);

  const nameOf = (playerId: string) => state.players.get(playerId)?.name ?? "?";

  // Ranking 1 = mas caro / mejor rating (ver rankBy). "Peor fichaje": pago
  // mucho (posicion de precio baja, cerca de 1) y rindio poco (posicion de
  // rating alta, lejos de 1 -- ceremonia.md: "pago como el 2.o mas caro y
  // rindio como el 19.o", 19 − 2 = 17, un numero grande). De ahi que el
  // score que se maximiza sea ratingRank − priceRank, no al reves.
  const worstDeal = awarded.reduce((worst, c) => {
    const score = (ratingRank.get(c) ?? 0) - (priceRank.get(c) ?? 0);
    const worstScore = worst ? (ratingRank.get(worst) ?? 0) - (priceRank.get(worst) ?? 0) : -Infinity;
    return score > worstScore ? c : worst;
  }, undefined as RevealedCardView | undefined);

  // "Mejor robo": al reves -- rindio mucho (posicion de rating baja, cerca
  // de 1) pagando poco (posicion de precio alta, lejos de 1, cerca del
  // final del ranking de mas caro a mas barato).
  const bestSteal = awarded.reduce((best, c) => {
    const score = (priceRank.get(c) ?? 0) - (ratingRank.get(c) ?? 0);
    const bestScore = best ? (priceRank.get(best) ?? 0) - (ratingRank.get(best) ?? 0) : -Infinity;
    return score > bestScore ? c : best;
  }, undefined as RevealedCardView | undefined);

  const spendByPlayer = new Map<string, number>();
  for (const c of awarded) spendByPlayer.set(c.ownerId, (spendByPlayer.get(c.ownerId) ?? 0) + c.price);
  let biggestSpenderId: string | null = null;
  let biggestSpend = -Infinity;
  for (const [playerId, spend] of spendByPlayer) {
    if (spend > biggestSpend) {
      biggestSpend = spend;
      biggestSpenderId = playerId;
    }
  }

  const awards: CeremonyAward[] = [];
  if (worstDeal) {
    awards.push({
      title: "Peor fichaje",
      playerId: worstDeal.ownerId,
      playerName: nameOf(worstDeal.ownerId),
      detail: `${worstDeal.name} ${worstDeal.season} · pagó ${worstDeal.price} M · rating ${worstDeal.rating}`,
    });
  }
  if (bestSteal) {
    awards.push({
      title: "Mejor robo",
      playerId: bestSteal.ownerId,
      playerName: nameOf(bestSteal.ownerId),
      detail: `${bestSteal.name} ${bestSteal.season} · pagó ${bestSteal.price} M · rating ${bestSteal.rating}`,
    });
  }
  if (biggestSpenderId) {
    awards.push({
      title: "Más gastador",
      playerId: biggestSpenderId,
      playerName: nameOf(biggestSpenderId),
      detail: `${biggestSpend} M gastados en total`,
    });
  }
  return awards;
}

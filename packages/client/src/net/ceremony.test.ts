import { describe, expect, it } from "vitest";
import { buildCeremonySteps, ceremonyChampions, ceremonyPoints, computeAwards } from "./ceremony.js";
import type { ClientState, PlayerView, RevealedCardView } from "./types.js";

function player(overrides: Partial<PlayerView> & { playerId: string; name: string }): PlayerView {
  return {
    budget: 1000,
    connected: true,
    rejoinPending: false,
    ready: false,
    squad: new Map(),
    ...overrides,
  };
}

function revealed(overrides: Partial<RevealedCardView> & { cardId: string; rating: number }): RevealedCardView {
  return {
    slot: "GK",
    silhouetteId: overrides.cardId,
    name: overrides.cardId,
    season: 2020,
    club: "Club",
    league: "League",
    nation: "ESP",
    ownerId: "",
    price: 0,
    ...overrides,
  };
}

function baseState(overrides: Partial<ClientState>): ClientState {
  return {
    roomCode: "AAAAA",
    hostId: "",
    phase: "RESULTS",
    slotIndex: 11,
    currentSlot: "",
    currentBid: 0,
    currentBidderId: "",
    openingBid: 0,
    minimumBid: 0,
    bidHistory: [],
    endsAt: 0,
    remainingCount: 0,
    skipAvailable: false,
    skipVotes: new Map(),
    restrictedBidders: [],
    passes: new Map(),
    players: new Map(),
    revealedCards: new Map(),
    standings: [],
    ...overrides,
  };
}

describe("buildCeremonySteps", () => {
  it("marca ganador al de mejor rating en cada puesto", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", rating: 90, ownerId: "a", price: 50 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", rating: 70, ownerId: "b", price: 20 })],
      ]),
    });

    const steps = buildCeremonySteps(state);
    const gk = steps.find((s) => s.slot === "GK")!;
    expect(gk.entries.find((e) => e.playerId === "a")?.wins).toBe(true);
    expect(gk.entries.find((e) => e.playerId === "b")?.wins).toBe(false);
  });

  it("un empate marca a ambos como ganadores del paso", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", rating: 80, ownerId: "a", price: 30 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", rating: 80, ownerId: "b", price: 30 })],
      ]),
    });

    const steps = buildCeremonySteps(state);
    const gk = steps.find((s) => s.slot === "GK")!;
    expect(gk.entries.every((e) => e.wins)).toBe(true);
  });

  it("un puesto sin nadie que lo fichara aparece con entries vacio, nunca se omite", () => {
    const state = baseState({ players: new Map([["a", player({ playerId: "a", name: "Ana" })]]) });
    const steps = buildCeremonySteps(state);
    expect(steps).toHaveLength(11);
    expect(steps.find((s) => s.slot === "ST")?.entries).toHaveLength(0);
  });

  it("recorre los puestos en el orden de la formacion, no alfabetico", () => {
    const state = baseState({});
    const steps = buildCeremonySteps(state);
    expect(steps.map((s) => s.slot)).toEqual([
      "GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW",
    ]);
  });
});

describe("ceremonyPoints", () => {
  it("suma 1 punto por puesto ganado en solitario", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"], ["ST", "card-c"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", rating: 90, ownerId: "a", price: 50 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", rating: 70, ownerId: "b", price: 20 })],
        ["card-c", revealed({ cardId: "card-c", slot: "ST", rating: 85, ownerId: "a", price: 60 })],
      ]),
    });
    const players = [...state.players.values()];
    const steps = buildCeremonySteps(state);
    const points = ceremonyPoints(steps, players);
    expect(points.get("a")).toBe(2);
    expect(points.get("b")).toBe(0);
  });

  it("reparte +0.5 a cada uno en un empate", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", rating: 80, ownerId: "a", price: 30 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", rating: 80, ownerId: "b", price: 30 })],
      ]),
    });
    const players = [...state.players.values()];
    const steps = buildCeremonySteps(state);
    const points = ceremonyPoints(steps, players);
    expect(points.get("a")).toBe(0.5);
    expect(points.get("b")).toBe(0.5);
  });

  it("un jugador sin puestos ganados aparece con 0, no desaparece del marcador", () => {
    const state = baseState({ players: new Map([["a", player({ playerId: "a", name: "Ana" })]]) });
    const players = [...state.players.values()];
    const steps = buildCeremonySteps(state);
    const points = ceremonyPoints(steps, players);
    expect(points.get("a")).toBe(0);
  });
});

describe("ceremonyChampions", () => {
  /** Ana y Bea con el mismo GK (rating igual, empate), y Ana con un hueco mas. */
  function tiedState(standings: ClientState["standings"]): ClientState {
    return baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", rating: 90, ownerId: "a", price: 50 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", rating: 90, ownerId: "b", price: 20 })],
      ]),
      standings,
    });
  }

  it("sigue la clasificacion del servidor, incluido su desempate", () => {
    // Empate en puntos y en rating total; el servidor desempata por
    // presupuesto restante y deja a Ana primero. La ceremonia dice Ana.
    const champions = ceremonyChampions(
      tiedState([
        { playerId: "a", points: 0.5, totalRating: 90, budgetLeft: 100, rank: 1 },
        { playerId: "b", points: 0.5, totalRating: 90, budgetLeft: 900, rank: 2 },
      ]),
    );
    expect(champions.map((c) => c.playerId)).toEqual(["a"]);
    expect(champions[0]?.name).toBe("Ana");
  });

  it("declara dos campeones solo cuando el servidor comparte el rank 1", () => {
    const champions = ceremonyChampions(
      tiedState([
        { playerId: "a", points: 0.5, totalRating: 90, budgetLeft: 500, rank: 1 },
        { playerId: "b", points: 0.5, totalRating: 90, budgetLeft: 500, rank: 1 },
      ]),
    );
    expect(champions.map((c) => c.name)).toEqual(["Ana", "Bea"]);
  });

  it("sin standings cae a los puntos de la ceremonia en vez de quedarse sin campeon", () => {
    // Red de seguridad: `standings` solo se rellena en RESULTS, pero si
    // llegara vacio la pantalla de campeon no puede quedarse en blanco.
    const champions = ceremonyChampions(tiedState([]));
    expect(champions.map((c) => c.name)).toEqual(["Ana", "Bea"]);
    expect(champions[0]?.points).toBe(0.5);
  });
});

describe("computeAwards", () => {
  it("sin cartas adjudicadas no hay premios", () => {
    const state = baseState({
      revealedCards: new Map([["card-a", revealed({ cardId: "card-a", rating: 90, ownerId: "", price: 0 })]]),
    });
    expect(computeAwards(state)).toEqual([]);
  });

  it("identifica peor fichaje, mejor robo y mas gastador", () => {
    // Cuatro cartas, sin ninguna ambiguedad de empate en las diferencias de
    // ranking: cada jugador ocupa una esquina distinta de precio x rating.
    // Ranking de precio (1=mas caro): Dani 120=1, Cata 100=2, Ana 80=3, Bea 5=4.
    // Ranking de rating (1=mejor):    Bea 95=1,  Cata 75=2, Dani 65=3, Ana 60=4.
    // Peor fichaje = max(ratingRank - priceRank): Ana 4-3=1, Bea 1-4=-3, Cata 2-2=0, Dani 3-1=2 -> Dani.
    // Mejor robo   = max(priceRank - ratingRank): Ana 3-4=-1, Bea 4-1=3, Cata 2-2=0, Dani 1-3=-2 -> Bea.
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana" })],
        ["b", player({ playerId: "b", name: "Bea" })],
        ["c", player({ playerId: "c", name: "Cata" })],
        ["d", player({ playerId: "d", name: "Dani" })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", name: "Jugador A", rating: 60, ownerId: "a", price: 80 })],
        ["card-b", revealed({ cardId: "card-b", name: "Jugador B", rating: 95, ownerId: "b", price: 5 })],
        ["card-c", revealed({ cardId: "card-c", name: "Jugador C", rating: 75, ownerId: "c", price: 100 })],
        // Dani: el mas caro con el segundo peor rating -- peor fichaje sin ambiguedad.
        ["card-d", revealed({ cardId: "card-d", name: "Jugador D", rating: 65, ownerId: "d", price: 120 })],
      ]),
    });

    const awards = computeAwards(state);
    const worst = awards.find((a) => a.title === "Peor fichaje");
    const steal = awards.find((a) => a.title === "Mejor robo");
    const spender = awards.find((a) => a.title === "Más gastador");

    expect(worst?.playerId).toBe("d");
    expect(steal?.playerId).toBe("b");
    expect(spender?.playerId).toBe("d");
  });

  it("ignora cartas descartadas (ownerId vacio) al calcular premios", () => {
    const state = baseState({
      players: new Map([["a", player({ playerId: "a", name: "Ana" })]]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", rating: 99, ownerId: "", price: 0 })],
        ["card-b", revealed({ cardId: "card-b", rating: 50, ownerId: "a", price: 10 })],
      ]),
    });
    const awards = computeAwards(state);
    // Solo una carta adjudicada: no hay ranking que comparar, pero
    // "mas gastador" si tiene candidato claro.
    expect(awards.find((a) => a.title === "Más gastador")?.playerId).toBe("a");
  });
});

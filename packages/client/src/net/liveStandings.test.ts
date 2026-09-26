import { describe, expect, it } from "vitest";
import { computeLiveStandings } from "./liveStandings.js";
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
    phase: "BIDDING",
    slotIndex: 0,
    currentSlot: "GK",
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

describe("computeLiveStandings", () => {
  it("reparte un punto por hueco al que tiene mejor rating", () => {
    const squadAna = new Map([["GK", "card-a"]]);
    const squadBea = new Map([["GK", "card-b"]]);
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: squadAna })],
        ["b", player({ playerId: "b", name: "Bea", squad: squadBea })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", rating: 90, ownerId: "a", price: 50 })],
        ["card-b", revealed({ cardId: "card-b", rating: 70, ownerId: "b", price: 20 })],
      ]),
    });

    const rows = computeLiveStandings(state);
    const ana = rows.find((r) => r.playerId === "a")!;
    const bea = rows.find((r) => r.playerId === "b")!;

    expect(ana.points).toBe(1);
    expect(ana.rank).toBe(1);
    expect(bea.points).toBe(0);
    expect(bea.rank).toBe(2);
  });

  it("un empate reparte el punto entre los empatados", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
      ]),
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", rating: 80, ownerId: "a", price: 30 })],
        ["card-b", revealed({ cardId: "card-b", rating: 80, ownerId: "b", price: 30 })],
      ]),
    });

    const rows = computeLiveStandings(state);
    expect(rows.every((r) => r.points === 0.5)).toBe(true);
    // Empate total: mismo rango para los dos.
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });

  it("un jugador sin ningun hueco fichado todavia aparece con 0 puntos, no desaparece", () => {
    const state = baseState({
      players: new Map([
        ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
        ["b", player({ playerId: "b", name: "Bea", squad: new Map() })],
      ]),
      revealedCards: new Map([["card-a", revealed({ cardId: "card-a", rating: 80, ownerId: "a", price: 30 })]]),
    });

    const rows = computeLiveStandings(state);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.playerId === "b")?.points).toBe(0);
  });

  it("una carta descartada (ownerId vacio) no la tiene fichada nadie -- no puntua", () => {
    const state = baseState({
      players: new Map([["a", player({ playerId: "a", name: "Ana", squad: new Map() })]]),
      revealedCards: new Map([["card-a", revealed({ cardId: "card-a", rating: 95, ownerId: "", price: 0 })]]),
    });

    const rows = computeLiveStandings(state);
    expect(rows[0]?.points).toBe(0);
  });
});

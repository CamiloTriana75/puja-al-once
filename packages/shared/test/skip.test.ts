import { describe, expect, it } from "vitest";
import {
  playersEligible, playersNeedingSlot, resolveSkipVote, skipAllowed,
  type AuctionState, type PlayerState,
} from "../src/index.js";

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 100, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    openingBid: 20,
    bidHistory: [],
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    players: [player("p1"), player("p2"), player("p3"), player("p4")],
    ...overrides,
  };
}

describe("playersNeedingSlot", () => {
  it("excluye a quien ya ficho y a los desconectados", () => {
    const s = state({
      players: [
        player("p1"),
        player("p2", { squad: { GK: "cx" } }),
        player("p3", { connected: false }),
        player("p4"),
      ],
    });
    expect(playersNeedingSlot(s).map((p) => p.playerId)).toEqual(["p1", "p4"]);
  });
});

describe("playersEligible", () => {
  it("incluye a todos los conectados, ya tengan o no el hueco", () => {
    const s = state({
      players: [
        player("p1"),
        player("p2", { squad: { GK: "cx" } }),
        player("p3", { connected: false }),
        player("p4"),
      ],
    });
    expect(playersEligible(s).map((p) => p.playerId)).toEqual(["p1", "p2", "p4"]);
  });
});

describe("skipAllowed", () => {
  it("permite saltar mientras sobran cartas", () => {
    // 5 cartas, 4 jugadores necesitan el hueco
    expect(skipAllowed(state())).toBe(true);
  });

  it("prohibe saltar cuando quedan tantas cartas como jugadores por fichar", () => {
    expect(skipAllowed(state({ remainingCards: ["c1", "c2", "c3", "c4"] }))).toBe(false);
  });

  it("recupera el margen cuando alguien ya ficho el hueco", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });

  it("no cuenta a los desconectados para el margen", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { connected: false }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });
});

describe("resolveSkipVote", () => {
  it("salta si todos los conectados votan saltar", () => {
    const s = state({ skipVotes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("el voto de quien ya ficho el hueco cuenta igual para la unanimidad", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p1: true, p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("sin el voto de quien ya ficho el hueco no hay unanimidad -- todos votan, no solo quien lo necesita", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: [] });
  });

  it("ignora a los desconectados para la unanimidad", () => {
    const s = state({
      players: [player("p1", { connected: false }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("reanuda restringido a quien voto en contra", () => {
    const s = state({ skipVotes: { p1: true, p2: false, p3: true, p4: false } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: ["p2", "p4"] });
  });

  it("trata la abstencion como que no bloquea el salto pero tampoco habilita a pujar", () => {
    const s = state({ skipVotes: { p1: true, p2: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: [] });
  });

  it("quien ya ficho el hueco puede votar en contra pero nunca acaba en restrictedBidders", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p1: false, p2: true, p3: true, p4: false },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: ["p4"] });
  });
});

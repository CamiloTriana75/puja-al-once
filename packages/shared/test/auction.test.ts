import { describe, expect, it } from "vitest";
import {
  applyOutcome, DEFAULT_RULES, resolveAuction,
  type AuctionState, type PlayerState,
} from "../src/index.js";

const rngFirst = () => 0;      // elige siempre el primer candidato del sorteo
const rngLast = () => 0.999;   // elige siempre el ultimo

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: DEFAULT_RULES.startingBudget, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    openingBid: DEFAULT_RULES.basePrice,
    bidHistory: [],
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    players: [player("p1"), player("p2"), player("p3"), player("p4")],
    ...overrides,
  };
}

describe("resolveAuction", () => {
  it("adjudica al mejor postor", () => {
    const s = state({ currentBid: 12, currentBidderId: "p3" });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "AWARDED", cardId: "c1", playerId: "p3", price: 12,
    });
  });

  it("abre la votacion de salto si nadie pujo y hay margen", () => {
    expect(resolveAuction(state(), DEFAULT_RULES, rngFirst)).toEqual({
      kind: "OPEN_SKIP_VOTE", cardId: "c1",
    });
  });

  it("descarta si nadie pujo tras un voto de salto fallido", () => {
    const s = state({ restrictedBidders: ["p2"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "DISCARDED", cardId: "c1",
    });
  });

  it("adjudica por sorteo si nadie pujo y no hay margen", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "FORCED", cardId: "c1", playerId: "p1", price: DEFAULT_RULES.basePrice,
    });
  });

  it("el sorteo recorre a todos los elegibles segun el rng", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngLast)).toMatchObject({
      kind: "FORCED", playerId: "p4",
    });
  });

  it("el sorteo solo considera a quien necesita el hueco y esta conectado", () => {
    const s = state({
      remainingCards: ["c1", "c2"],
      players: [
        player("p1", { squad: { GK: "cx" } }),
        player("p2", { connected: false }),
        player("p3"),
        player("p4"),
      ],
    });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toMatchObject({
      kind: "FORCED", playerId: "p3",
    });
  });
});

describe("applyOutcome", () => {
  it("cobra al ganador, le asigna el hueco y saca la carta de la ronda", () => {
    const s = state({ currentBid: 12, currentBidderId: "p3" });
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    const p3 = next.players.find((p) => p.playerId === "p3");
    expect(p3?.budget).toBe(DEFAULT_RULES.startingBudget - 12);
    expect(p3?.squad.GK).toBe("c1");
    expect(next.remainingCards).toEqual(["c2", "c3", "c4", "c5"]);
    expect(next.currentBid).toBe(0);
    expect(next.currentBidderId).toBeNull();
    expect(next.bidHistory).toEqual([]);
    expect(next.restrictedBidders).toBeNull();
    expect(next.skipVotes).toEqual({});
  });

  it("el descarte saca la carta sin cobrar a nadie", () => {
    const s = state({ restrictedBidders: ["p2"] });
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    expect(next.remainingCards).toEqual(["c2", "c3", "c4", "c5"]);
    expect(next.players.every((p) => p.budget === DEFAULT_RULES.startingBudget)).toBe(true);
  });

  it("abrir la votacion de salto no toca las cartas", () => {
    const s = state();
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    expect(next.remainingCards).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(next.phase).toBe("SKIP_VOTE");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES, playersEligibleToPass, resolvePass,
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

describe("playersEligibleToPass", () => {
  it("son todos los conectados cuando no hay fase restringida, tengan o no ya el hueco", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2", { connected: false }), player("p3"), player("p4")],
    });
    expect(playersEligibleToPass(s)).toEqual(["p1", "p3", "p4"]);
  });

  it("en fase restringida, solo quien ademas esta en la lista", () => {
    const s = state({ restrictedBidders: ["p2", "p4"] });
    expect(playersEligibleToPass(s)).toEqual(["p2", "p4"]);
  });

  it("la fase restringida no anade a nadie que no necesite ya el hueco", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      restrictedBidders: ["p1", "p2"], // p1 ya ficho -- no deberia colar aunque este conectado
    });
    expect(playersEligibleToPass(s)).toEqual(["p2"]);
  });
});

describe("resolvePass", () => {
  it("con margen, pasar todos descarta directo -- nunca abre voto de salto", () => {
    const s = state({ passes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolvePass(s, DEFAULT_RULES, rngFirst)).toEqual({ kind: "DISCARDED", cardId: "c1" });
  });

  it("sin margen, pasar todos sortea entre los elegibles", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"], passes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolvePass(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "FORCED", cardId: "c1", playerId: "p1", price: DEFAULT_RULES.basePrice,
    });
  });

  it("el sorteo sin margen recorre a todos los elegibles segun el rng", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"], passes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolvePass(s, DEFAULT_RULES, rngLast)).toMatchObject({ kind: "FORCED", playerId: "p4" });
  });

  it("en fase restringida siempre descarta, aunque no haya margen", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      restrictedBidders: ["p2"],
      passes: { p2: true },
    });
    expect(resolvePass(s, DEFAULT_RULES, rngFirst)).toEqual({ kind: "DISCARDED", cardId: "c1" });
  });

  it("en fase restringida con margen de sobra tambien descarta", () => {
    const s = state({ restrictedBidders: ["p2"], passes: { p2: true } });
    expect(resolvePass(s, DEFAULT_RULES, rngFirst)).toEqual({ kind: "DISCARDED", cardId: "c1" });
  });

  it("el pase de quien ya ficho el hueco cuenta para la unanimidad -- sin margen, el sorteo lo sigue excluyendo", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3"],
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      passes: { p1: true, p2: true, p3: true, p4: true },
    });
    // playersEligibleToPass(s) === ["p1","p2","p3","p4"], las 4 pasan: unanime.
    // remainingCards.length (3) === playersNeedingSlot(s).length (3): sin margen.
    // p1 ya tiene el hueco -- no puede ganar el sorteo aunque haya pasado.
    expect(resolvePass(s, DEFAULT_RULES, rngFirst)).toMatchObject({ kind: "FORCED", playerId: "p2" });
  });
});

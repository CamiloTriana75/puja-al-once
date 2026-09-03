import { describe, expect, it } from "vitest";
import {
  applyBid, canBid, DEFAULT_RULES, minimumBid,
  type AuctionState, type PlayerState,
} from "../src/index.js";

const NOW = 1_000_000;

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
    endsAt: NOW + 15_000,
    skipVotes: {},
    restrictedBidders: null,
    players: [player("p1"), player("p2")],
    ...overrides,
  };
}

describe("minimumBid", () => {
  it("es el precio base cuando nadie ha pujado", () => {
    expect(minimumBid(state(), DEFAULT_RULES)).toBe(2);
  });

  it("es la puja vigente mas el incremento minimo", () => {
    expect(minimumBid(state({ currentBid: 7 }), DEFAULT_RULES)).toBe(8);
  });
});

describe("canBid", () => {
  it("acepta una puja valida", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 2, NOW)).toEqual({ ok: true, value: undefined });
  });

  it("rechaza si la fase no es BIDDING", () => {
    const r = canBid(state({ phase: "REVEAL" }), DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("rechaza la puja que llega despues del cierre", () => {
    const r = canBid(state(), DEFAULT_RULES, "p1", 2, NOW + 15_001);
    expect(r).toEqual({ ok: false, error: "AUCTION_CLOSED" });
  });

  it("acepta la puja que llega justo en el instante del cierre", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 2, NOW + 15_000).ok).toBe(true);
  });

  it("rechaza a un jugador desconocido", () => {
    const r = canBid(state(), DEFAULT_RULES, "fantasma", 2, NOW);
    expect(r).toEqual({ ok: false, error: "UNKNOWN_PLAYER" });
  });

  it("rechaza a un jugador desconectado", () => {
    const s = state({ players: [player("p1", { connected: false }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "DISCONNECTED" });
  });

  it("rechaza si el jugador ya ficho para ese hueco", () => {
    const s = state({ players: [player("p1", { squad: { GK: "cx" } }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "SLOT_ALREADY_FILLED" });
  });

  it("rechaza una puja por debajo del minimo", () => {
    const r = canBid(state({ currentBid: 7 }), DEFAULT_RULES, "p1", 7, NOW);
    expect(r).toEqual({ ok: false, error: "BID_TOO_LOW" });
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", () => {
    // 11 huecos vacios, saldo 100, reservado 20 -> tope 80
    const r = canBid(state(), DEFAULT_RULES, "p1", 81, NOW);
    expect(r).toEqual({ ok: false, error: "OVER_BUDGET" });
  });

  it("acepta justo en el tope del presupuesto", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 80, NOW).ok).toBe(true);
  });

  it("rechaza a quien no esta en la lista tras un voto de salto fallido", () => {
    const s = state({ restrictedBidders: ["p2"] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "NOT_ALLOWED_TO_BID" });
  });

  it("acepta a quien si esta en la lista restringida", () => {
    const s = state({ restrictedBidders: ["p1"] });
    expect(canBid(s, DEFAULT_RULES, "p1", 2, NOW).ok).toBe(true);
  });
});

describe("applyBid", () => {
  it("registra la puja y empuja el cierre (anti-snipe)", () => {
    const s = applyBid(state(), DEFAULT_RULES, "p1", 5, NOW + 14_900);
    expect(s.currentBid).toBe(5);
    expect(s.currentBidderId).toBe("p1");
    expect(s.endsAt).toBe(NOW + 14_900 + DEFAULT_RULES.antiSnipeMs);
  });

  it("no muta el estado recibido", () => {
    const original = state();
    applyBid(original, DEFAULT_RULES, "p1", 5, NOW);
    expect(original.currentBid).toBe(0);
    expect(original.currentBidderId).toBeNull();
  });
});

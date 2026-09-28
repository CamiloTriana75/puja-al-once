import { describe, expect, it } from "vitest";
import {
  applyBid, canBid, DEFAULT_RULES, minimumBid, openingBidForRating,
  type AuctionState, type PlayerState,
} from "../src/index.js";

const NOW = 1_000_000;

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
    /** La carta espera una primera oferta: no existe reloj todavia. */
    endsAt: 0,
    openingBid: DEFAULT_RULES.basePrice,
    bidHistory: [],
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    players: [player("p1"), player("p2")],
    ...overrides,
  };
}

describe("minimumBid", () => {
  it("escala el precio de salida segun la calidad del jugador", () => {
    expect(openingBidForRating(97, DEFAULT_RULES)).toBe(200);
    expect(openingBidForRating(92, DEFAULT_RULES)).toBe(90);
    expect(openingBidForRating(88, DEFAULT_RULES)).toBe(70);
    expect(openingBidForRating(80, DEFAULT_RULES)).toBe(30);
  });

  it("mantiene cuatro escalones anchos: dentro de un escalon el rating no se deduce del precio", () => {
    // El precio de salida es publico, asi que la granularidad importa: si
    // distinguiera 70 de 86, la puja mas cara seria siempre la mejor jugada
    // y las pistas publicas dejarian de servir para nada.
    expect(openingBidForRating(70, DEFAULT_RULES)).toBe(openingBidForRating(81, DEFAULT_RULES));
    expect(openingBidForRating(82, DEFAULT_RULES)).toBe(openingBidForRating(86, DEFAULT_RULES));
    expect(openingBidForRating(87, DEFAULT_RULES)).toBe(openingBidForRating(90, DEFAULT_RULES));
    expect(openingBidForRating(91, DEFAULT_RULES)).toBe(openingBidForRating(94, DEFAULT_RULES));
    expect(openingBidForRating(95, DEFAULT_RULES)).toBe(openingBidForRating(99, DEFAULT_RULES));
  });

  it("sube de precio de forma monotona segun sube el rating", () => {
    const precios = [70, 80, 81, 82, 86, 87, 90, 91, 94, 95, 99].map((r) =>
      openingBidForRating(r, DEFAULT_RULES),
    );
    for (let i = 1; i < precios.length; i++) {
      expect(precios[i]!).toBeGreaterThanOrEqual(precios[i - 1]!);
    }
  });

  it("deja el mazo entero por debajo de 100 M menos los cinco iconos", () => {
    // El tope de 200 M es para los cinco mejores de la historia y para nadie
    // mas: si el segundo escalon de arriba tocara 100, "caro" dejaria de
    // significar "icono".
    for (const rating of [70, 80, 86, 90, 94]) {
      expect(openingBidForRating(rating, DEFAULT_RULES)).toBeLessThan(100);
    }
    expect(openingBidForRating(99, DEFAULT_RULES)).toBe(200);
  });

  it("usa el precio de salida propio de la carta cuando nadie ha pujado", () => {
    expect(minimumBid(state({ openingBid: 90 }), DEFAULT_RULES)).toBe(90);
  });

  it("es la puja vigente mas el incremento minimo", () => {
    expect(minimumBid(state({ currentBid: 70 }), DEFAULT_RULES)).toBe(80);
  });
});

describe("canBid", () => {
  it("acepta una puja valida", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 50, NOW)).toEqual({ ok: true, value: undefined });
  });

  it("acepta la primera puja aunque la carta no tenga reloj activo", () => {
    expect(canBid(state({ endsAt: 0 }), DEFAULT_RULES, "p1", 50, NOW)).toEqual({ ok: true, value: undefined });
  });

  it("rechaza si la fase no es BIDDING", () => {
    const r = canBid(state({ phase: "REVEAL" }), DEFAULT_RULES, "p1", 50, NOW);
    expect(r).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("rechaza la puja que llega despues del cierre", () => {
    const r = canBid(state({ endsAt: NOW + 10_000 }), DEFAULT_RULES, "p1", 50, NOW + 10_001);
    expect(r).toEqual({ ok: false, error: "AUCTION_CLOSED" });
  });

  it("acepta la puja que llega justo en el instante del cierre", () => {
    expect(canBid(state({ endsAt: NOW + 10_000 }), DEFAULT_RULES, "p1", 50, NOW + 10_000).ok).toBe(true);
  });

  it("rechaza a un jugador desconocido", () => {
    const r = canBid(state(), DEFAULT_RULES, "fantasma", 50, NOW);
    expect(r).toEqual({ ok: false, error: "UNKNOWN_PLAYER" });
  });

  it("rechaza a un jugador desconectado", () => {
    const s = state({ players: [player("p1", { connected: false }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 50, NOW);
    expect(r).toEqual({ ok: false, error: "DISCONNECTED" });
  });

  it("rechaza si el jugador ya ficho para ese hueco", () => {
    const s = state({ players: [player("p1", { squad: { GK: "cx" } }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 50, NOW);
    expect(r).toEqual({ ok: false, error: "SLOT_ALREADY_FILLED" });
  });

  it("rechaza una puja por debajo del minimo", () => {
    const r = canBid(state({ currentBid: 70 }), DEFAULT_RULES, "p1", 70, NOW);
    expect(r).toEqual({ ok: false, error: "BID_TOO_LOW" });
  });

  it("rechaza una puja por debajo del precio de salida", () => {
    const r = canBid(state(), DEFAULT_RULES, "p1", DEFAULT_RULES.basePrice - 1, NOW);
    expect(r).toEqual({ ok: false, error: "BID_TOO_LOW" });
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", () => {
    // 11 huecos vacios, saldo 1.000, reservado 10 x 30 -> tope 700
    const r = canBid(state(), DEFAULT_RULES, "p1", 701, NOW);
    expect(r).toEqual({ ok: false, error: "OVER_BUDGET" });
  });

  it("acepta justo en el tope del presupuesto", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 700, NOW).ok).toBe(true);
  });

  it("rechaza a quien no esta en la lista tras un voto de salto fallido", () => {
    const s = state({ restrictedBidders: ["p2"] });
    const r = canBid(s, DEFAULT_RULES, "p1", 50, NOW);
    expect(r).toEqual({ ok: false, error: "NOT_ALLOWED_TO_BID" });
  });

  it("acepta a quien si esta en la lista restringida", () => {
    const s = state({ restrictedBidders: ["p1"] });
    expect(canBid(s, DEFAULT_RULES, "p1", 50, NOW).ok).toBe(true);
  });
});

describe("applyBid", () => {
  it("registra la puja y empuja el cierre (anti-snipe)", () => {
    const s = applyBid(state(), DEFAULT_RULES, "p1", 20, NOW);
    expect(s.currentBid).toBe(20);
    expect(s.currentBidderId).toBe("p1");
    expect(s.endsAt).toBe(NOW + DEFAULT_RULES.antiSnipeMs);
    expect(s.bidHistory).toEqual([{ playerId: "p1", amount: 20 }]);
  });

  it("conserva solo las cinco pujas mas recientes", () => {
    const s = [20, 30, 40, 50, 60, 70].reduce(
      (next, amount, index) => applyBid(next, DEFAULT_RULES, `p${index}`, amount, NOW + index),
      state(),
    );

    expect(s.bidHistory).toEqual([
      { playerId: "p1", amount: 30 },
      { playerId: "p2", amount: 40 },
      { playerId: "p3", amount: 50 },
      { playerId: "p4", amount: 60 },
      { playerId: "p5", amount: 70 },
    ]);
  });

  it("no muta el estado recibido", () => {
    const original = state();
    applyBid(original, DEFAULT_RULES, "p1", 20, NOW);
    expect(original.currentBid).toBe(0);
    expect(original.currentBidderId).toBeNull();
    expect(original.bidHistory).toEqual([]);
  });

  it("vacia los pases (D2): en cuanto hay puja, pasar deja de tener sentido", () => {
    const s = applyBid(state({ passes: { p1: true } }), DEFAULT_RULES, "p2", 20, NOW);
    expect(s.passes).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, maxBid, reservedBudget, type PlayerState } from "../src/index.js";

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    playerId: "p1",
    name: "Ana",
    budget: DEFAULT_RULES.startingBudget,
    squad: {},
    connected: true,
    ...overrides,
  };
}

describe("reservedBudget", () => {
  it("reserva el precio base de los huecos que quedarian tras ganar el actual", () => {
    // 11 huecos vacios: si gana el actual quedan 10 por llenar a 20 M cada uno
    expect(reservedBudget(player(), DEFAULT_RULES)).toBe(200);
  });

  it("no reserva nada cuando el hueco en juego es el ultimo", () => {
    const squad = {
      GK: "c1", LB: "c2", CB1: "c3", CB2: "c4", RB: "c5",
      CDM: "c6", CM: "c7", CAM: "c8", LW: "c9", ST: "c10",
    };
    expect(reservedBudget(player({ squad }), DEFAULT_RULES)).toBe(0);
  });
});

describe("maxBid", () => {
  it("permite gastar todo menos lo reservado", () => {
    expect(maxBid(player({ budget: 1_000 }), DEFAULT_RULES)).toBe(800);
  });

  it("permite gastar el saldo entero en el ultimo hueco", () => {
    const squad = {
      GK: "c1", LB: "c2", CB1: "c3", CB2: "c4", RB: "c5",
      CDM: "c6", CM: "c7", CAM: "c8", LW: "c9", ST: "c10",
    };
    expect(maxBid(player({ budget: 37, squad }), DEFAULT_RULES)).toBe(37);
  });

  it("nunca devuelve negativo", () => {
    expect(maxBid(player({ budget: 3 }), DEFAULT_RULES)).toBe(0);
  });
});

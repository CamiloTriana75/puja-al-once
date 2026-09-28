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
    // 11 huecos vacios: si gana el actual quedan 10 por llenar a 30 M cada uno
    expect(reservedBudget(player(), DEFAULT_RULES)).toBe(300);
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
    expect(maxBid(player({ budget: 1_000 }), DEFAULT_RULES)).toBe(700);
  });

  it("con el once entero vacio el tope deja comprar la primera carta y aun asi completar el equipo", () => {
    // 1.000 de saldo menos 300 reservados: se puede ir all-in en la primera
    // ronda y aun asi completar el equipo con las cartas mas baratas.
    expect(maxBid(player(), DEFAULT_RULES)).toBe(700);
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

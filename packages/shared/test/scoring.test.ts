import { describe, expect, it } from "vitest";
import { scoreMatch, SLOTS, type PlayerState } from "../src/index.js";

/** Reparte un equipo entero con el mismo rating salvo las excepciones dadas. */
function squadOf(prefix: string): PlayerState["squad"] {
  return Object.fromEntries(SLOTS.map((s) => [s, `${prefix}-${s}`]));
}

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 0, squad: squadOf(id), connected: true, ...overrides };
}

/** rating por defecto 70; `over` sube cartas concretas. */
function ratings(over: Record<string, number> = {}) {
  return (cardId: string) => over[cardId] ?? 70;
}

describe("scoreMatch", () => {
  it("da un punto por cada hueco en el que se tiene el rating mas alto", () => {
    const players = [player("a"), player("b")];
    const table = scoreMatch(players, ratings({ "a-GK": 90, "a-LB": 90, "b-RW": 91 }));
    // a gana GK y LB (2 puntos); b gana RW (1 punto); los otros 8 huecos
    // empatan a 70 (rating por defecto) y reparten 0.5 cada uno: 2+4=6, 1+4=5.
    expect(table.find((s) => s.playerId === "a")?.points).toBe(6);
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5);
  });

  it("reparte el punto entre los empatados en un hueco", () => {
    const players = [player("a"), player("b")];
    // todos los huecos empatan a 70 -> medio punto cada uno en los 11
    const table = scoreMatch(players, ratings());
    expect(table.find((s) => s.playerId === "a")?.points).toBe(5.5);
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5.5);
  });

  it("un hueco vacio nunca gana el punto", () => {
    const emptyGk = squadOf("b");
    delete emptyGk.GK;
    const players = [player("a"), player("b", { squad: emptyGk })];
    const table = scoreMatch(players, ratings());
    expect(table.find((s) => s.playerId === "a")?.points).toBe(1 + 5); // GK entero + medio en los otros 10
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5);
  });

  it("desempata por suma total de ratings", () => {
    const players = [player("a"), player("b")];
    // a y b empatan a 5.5 puntos; a suma mas rating total
    const table = scoreMatch(players, ratings({ "a-GK": 99, "b-GK": 99, "a-LB": 71, "b-LB": 71 }));
    expect(table[0]?.playerId).toBe("a");
    expect(table[0]?.rank).toBe(1);
  });

  it("desempata por presupuesto sin gastar cuando el rating total tambien empata", () => {
    const players = [player("a", { budget: 3 }), player("b", { budget: 9 })];
    const table = scoreMatch(players, ratings());
    expect(table[0]?.playerId).toBe("b");
    expect(table[0]?.rank).toBe(1);
    expect(table[1]?.rank).toBe(2);
  });

  it("declara empate cuando ni puntos ni rating ni presupuesto separan", () => {
    const players = [player("a", { budget: 5 }), player("b", { budget: 5 })];
    const table = scoreMatch(players, ratings());
    expect(table[0]?.rank).toBe(1);
    expect(table[1]?.rank).toBe(1);
  });
});

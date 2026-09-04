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
    const players = [player("a"), player("b")]; // "a" va primero en el array de entrada.
    // OJO: el fixture original ponia el mismo rating a los dos en GK Y en
    // LB ({ "a-GK": 99, "b-GK": 99, "a-LB": 71, "b-LB": 71 }) -- eso empata
    // tambien el rating total (800 vs 800), asi que el test pasaba por el
    // orden estable de sort() (JS conserva el orden de entrada entre
    // iguales -- "a" primero en `players`, "a" primero en `table`), no
    // porque el desempate por rating se ejercitara: sustituir el termino de
    // desempate por `0` dejaba los 6 tests igual de verdes.
    //
    // Para que el test SI dependa del comparador, quien gana el desempate
    // tiene que ser justo el que NO va primero en el array de entrada --
    // si no, un comparador roto podria acertar por la misma razon de
    // estabilidad que rompio el fixture original. Aqui cada uno gana un
    // hueco distinto -- b gana GK, a gana LB -- para que los PUNTOS se
    // mantengan empatados a 5.5 (a: 0+1+4.5; b: 1+0+4.5), con margenes
    // distintos (b gana GK por 2, a gana LB por 1) para que el rating total
    // SI difiera y el ganador sea "b": a = 97+72+630 = 799,
    // b = 99+71+630 = 800. Confirmado por mutacion: sustituir el termino de
    // desempate por `0` en scoring.ts hace fallar `table[0]?.playerId` (que
    // sin comparador real se quedaria en "a", el orden de entrada) contra
    // este fixture, cosa que el original nunca detectaba.
    const table = scoreMatch(players, ratings({ "a-GK": 97, "b-GK": 99, "a-LB": 72, "b-LB": 71 }));
    expect(table.find((s) => s.playerId === "a")?.points).toBe(5.5);
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5.5);
    expect(table.find((s) => s.playerId === "a")?.totalRating).toBe(799);
    expect(table.find((s) => s.playerId === "b")?.totalRating).toBe(800);
    expect(table[0]?.playerId).toBe("b");
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

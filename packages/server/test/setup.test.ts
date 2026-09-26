import { describe, expect, it } from "vitest";
import { cardsBySlot, type CardSource, type Rng } from "@fut/shared";
import { drawRound } from "../src/setup.js";

function card(cardId: string): CardSource {
  return {
    cardId,
    name: cardId,
    season: 2020,
    birthYear: 1990,
    club: "Club",
    league: "League",
    nation: "ESP",
    slot: "GK",
    rating: 80,
    heightCm: 190,
    foot: "R",
    silhouetteId: cardId,
  };
}

function cardWithName(cardId: string, name: string): CardSource {
  return { ...card(cardId), name };
}

/** Determinista: hace que Fisher-Yates siempre intercambie con la posicion 0. */
const zeroRng: Rng = () => 0;

/**
 * PRNG determinista (mulberry32) para poder repetir el reparto con muchas
 * semillas distintas sin depender de Math.random.
 */
function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("drawRound", () => {
  it("reparte exactamente jugadores + 1 candidatos, todos distintos", () => {
    const grouped = cardsBySlot([card("a"), card("b"), card("c"), card("d"), card("e")]);
    const drawn = drawRound(grouped, "GK", 3, zeroRng, new Set());

    expect(drawn).toHaveLength(4);
    expect(new Set(drawn).size).toBe(4);
  });

  it("no repite cartas entre rondas gracias al set `used`", () => {
    const grouped = cardsBySlot(Array.from({ length: 10 }, (_, i) => card(`gk-${i}`)));
    const used = new Set<string>();

    const first = drawRound(grouped, "GK", 4, zeroRng, used);
    const second = drawRound(grouped, "GK", 4, zeroRng, used);

    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(first.filter((id) => second.includes(id))).toHaveLength(0);
    // Las diez cartas del mazo quedan marcadas usadas entre las dos rondas.
    expect(used.size).toBe(10);
  });

  it("lanza con un mensaje util si el hueco no tiene suficientes cartas libres", () => {
    const grouped = cardsBySlot([card("a"), card("b")]);

    expect(() => drawRound(grouped, "GK", 3, zeroRng, new Set())).toThrow(
      "El hueco GK tiene 2 cartas libres y hacen falta 4",
    );
  });

  it("nunca reparte dos temporadas del mismo jugador en una ronda, con muchas semillas de azar", () => {
    const deck = [
      cardWithName("messi-2015", "Messi"),
      cardWithName("messi-2019", "Messi"),
      cardWithName("cr7-2010", "Cristiano"),
      cardWithName("cr7-2018", "Cristiano"),
      cardWithName("casillas-2010", "Casillas"),
      cardWithName("casillas-2016", "Casillas"),
      cardWithName("neuer-2014", "Neuer"),
      cardWithName("neuer-2020", "Neuer"),
    ];
    const grouped = cardsBySlot(deck);
    const nameByCardId = new Map(deck.map((c) => [c.cardId, c.name]));

    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawRound(grouped, "GK", 3, seededRng(seed), new Set());
      const names = drawn.map((cardId) => nameByCardId.get(cardId)!);

      expect(drawn).toHaveLength(4);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("lanza con un mensaje util si no hay suficientes jugadores distintos, aunque sobren cartas", () => {
    const deck = [
      cardWithName("messi-2015", "Messi"),
      cardWithName("messi-2016", "Messi"),
      cardWithName("messi-2017", "Messi"),
      cardWithName("cr7-2010", "Cristiano"),
      cardWithName("cr7-2011", "Cristiano"),
      cardWithName("cr7-2012", "Cristiano"),
    ];
    const grouped = cardsBySlot(deck);

    // 6 cartas libres (de sobra), pero solo 2 jugadores distintos para 3 huecos.
    expect(() => drawRound(grouped, "GK", 2, zeroRng, new Set())).toThrow(
      "El hueco GK tiene 2 jugadores distintos libres y hacen falta 3",
    );
  });
});

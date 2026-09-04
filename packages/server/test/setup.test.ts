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

/** Determinista: hace que Fisher-Yates siempre intercambie con la posicion 0. */
const zeroRng: Rng = () => 0;

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
});

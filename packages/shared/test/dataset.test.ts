import { describe, expect, it } from "vitest";
import {
  ageBandOf, cardsBySlot, continentOf, decadeOf, parseDataset,
  toPrivate, toPublic, type CardSource,
} from "../src/index.js";

const ronaldinho2006: CardSource = {
  cardId: "ronaldinho-2006",
  name: "Ronaldinho",
  season: 2006,
  birthYear: 1980,
  club: "FC Barcelona",
  league: "LaLiga",
  nation: "BRA",
  slot: "CAM",
  rating: 94,
  heightCm: 182,
  foot: "R",
  silhouetteId: "ronaldinho-01",
};

describe("derivados", () => {
  it("decadeOf agrupa por decada", () => {
    expect(decadeOf(2006)).toBe("2000s");
    expect(decadeOf(1999)).toBe("1990s");
    expect(decadeOf(2015)).toBe("2010s");
  });

  it("ageBandOf agrupa la edad en rangos", () => {
    expect(ageBandOf(2006, 1980)).toBe("26-30");
    expect(ageBandOf(2000, 1980)).toBe("<21");
    expect(ageBandOf(2003, 1980)).toBe("21-25");
    expect(ageBandOf(2013, 1980)).toBe("31-34");
    expect(ageBandOf(2016, 1980)).toBe("35+");
  });

  it("continentOf mapea la nacion", () => {
    expect(continentOf("BRA")).toBe("SA");
    expect(continentOf("ESP")).toBe("EU");
    expect(continentOf("CMR")).toBe("AF");
  });

  it("continentOf lanza ante una nacion desconocida", () => {
    expect(() => continentOf("XXX")).toThrow(/XXX/);
  });
});

describe("toPublic", () => {
  it("no deja pasar ningun campo privado", () => {
    const pub = toPublic(ronaldinho2006);
    expect(pub).toEqual({
      cardId: "ronaldinho-2006",
      slot: "CAM",
      silhouetteId: "ronaldinho-01",
      heightCm: 182,
      foot: "R",
      ageBand: "26-30",
      continent: "SA",
      decade: "2000s",
    });
    for (const leaked of ["name", "season", "club", "league", "nation", "rating"]) {
      expect(Object.hasOwn(pub, leaked)).toBe(false);
    }
  });
});

describe("toPrivate", () => {
  it("lleva los campos del reveal", () => {
    expect(toPrivate(ronaldinho2006)).toEqual({
      cardId: "ronaldinho-2006",
      name: "Ronaldinho",
      season: 2006,
      club: "FC Barcelona",
      league: "LaLiga",
      nation: "BRA",
      rating: 94,
    });
  });
});

describe("parseDataset", () => {
  it("acepta un dataset valido", () => {
    expect(parseDataset([ronaldinho2006])).toHaveLength(1);
  });

  it("rechaza un rating fuera de rango", () => {
    expect(() => parseDataset([{ ...ronaldinho2006, rating: 120 }])).toThrow();
  });

  it("rechaza un hueco que no existe en la formacion", () => {
    expect(() => parseDataset([{ ...ronaldinho2006, slot: "SW" }])).toThrow();
  });

  it("rechaza cardId duplicado", () => {
    expect(() => parseDataset([ronaldinho2006, ronaldinho2006])).toThrow(/duplicad/i);
  });
});

describe("cardsBySlot", () => {
  it("agrupa por hueco y deja vacios los que no tienen cartas", () => {
    const grouped = cardsBySlot([ronaldinho2006]);
    expect(grouped.CAM).toHaveLength(1);
    expect(grouped.GK).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  cardsBySlot, continentOf, decadeOf, parseDataset,
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
  it("no deja pasar ningun campo privado ni identificador", () => {
    const pub = toPublic(ronaldinho2006);
    expect(pub).toEqual({
      slot: "CAM",
      heightCm: 182,
      foot: "R",
      continent: "SA",
      decade: "2000s",
    });
    // cardId y silhouetteId tampoco son publicos: el cardId identifica
    // jugador y temporada (es la respuesta), y la URL de la silueta filtra
    // al jugador por su nombre de fichero real aunque el resto vaya limpio.
    for (const leaked of ["cardId", "silhouetteId", "name", "season", "club", "league", "nation", "rating"]) {
      expect(Object.hasOwn(pub, leaked)).toBe(false);
    }
  });

  it("tampoco deja pasar la edad, ni en crudo ni en bandas", () => {
    // La edad no es un campo cualquiera: con el nombre y la temporada se
    // deduce en el reveal, asi que publicarla solo acortaba la lista de
    // candidatos. Ni `birthYear` ni un `ageBand` derivado -- que reaparezca
    // uno u otro rompe este test.
    const pub = toPublic(ronaldinho2006);
    for (const leaked of ["birthYear", "ageBand", "age", "edad"]) {
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

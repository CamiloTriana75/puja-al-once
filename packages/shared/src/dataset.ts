import { z } from "zod";
import { SLOTS, type AgeBand, type Continent, type Slot } from "./types.js";

/** Cada hueco necesita al menos esto para que dos partidas no se repitan. */
export const MIN_CARDS_PER_SLOT = 30;

export const CardSourceSchema = z.object({
  cardId: z.string().min(1),
  name: z.string().min(1),
  season: z.int().min(1950).max(2100),
  birthYear: z.int().min(1900).max(2100),
  club: z.string().min(1),
  league: z.string().min(1),
  /** Codigo ISO 3166-1 alfa-3. */
  nation: z.string().length(3),
  slot: z.enum(SLOTS),
  rating: z.int().min(1).max(99),
  heightCm: z.int().min(140).max(220),
  foot: z.enum(["L", "R", "B"]),
  silhouetteId: z.string().min(1),
});

export type CardSource = z.infer<typeof CardSourceSchema>;

/**
 * Lo que hay aqui es publicable, sin asteriscos: nada de `cardId` ni
 * `silhouetteId`. El `cardId` identifica jugador y temporada -- es la
 * respuesta. La URL de la silueta filtra al jugador por su nombre de fichero
 * real aunque el resto vaya limpio. Si algun sitio necesita el `cardId`, que
 * lo saque de `CardSource` (el tipo que sí lo tiene, y cuyo nombre no
 * promete que sea publico) -- nunca de aqui.
 */
export interface CardPublic {
  slot: Slot;
  heightCm: number;
  foot: "L" | "R" | "B";
  ageBand: AgeBand;
  continent: Continent;
  decade: string;
}

export interface CardPrivate {
  cardId: string;
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
}

const NATION_CONTINENT: Record<string, Continent> = {
  ARG: "SA", BRA: "SA", URU: "SA", COL: "SA", CHI: "SA", PER: "SA", ECU: "SA", PAR: "SA", VEN: "SA", BOL: "SA",
  ESP: "EU", FRA: "EU", ITA: "EU", GER: "EU", ENG: "EU", POR: "EU", NED: "EU", BEL: "EU", CRO: "EU", SRB: "EU",
  POL: "EU", SWE: "EU", NOR: "EU", DEN: "EU", SUI: "EU", AUT: "EU", CZE: "EU", UKR: "EU", RUS: "EU", SCO: "EU",
  WAL: "EU", IRL: "EU", GRE: "EU", TUR: "EU", ROU: "EU", BUL: "EU", HUN: "EU", SVK: "EU", SVN: "EU", BIH: "EU",
  MEX: "NA", USA: "NA", CRC: "NA", CAN: "NA", HON: "NA", JAM: "NA", PAN: "NA",
  CMR: "AF", SEN: "AF", NGA: "AF", CIV: "AF", GHA: "AF", MAR: "AF", ALG: "AF", EGY: "AF", TUN: "AF", RSA: "AF", MLI: "AF", GUI: "AF",
  JPN: "AS", KOR: "AS", KSA: "AS", IRN: "AS", QAT: "AS", CHN: "AS", AUS: "AS", UZB: "AS",
  NZL: "OC", FIJ: "OC",
};

export function decadeOf(season: number): string {
  return `${Math.floor(season / 10) * 10}s`;
}

export function ageBandOf(season: number, birthYear: number): AgeBand {
  const age = season - birthYear;
  if (age < 21) return "<21";
  if (age <= 25) return "21-25";
  if (age <= 30) return "26-30";
  if (age <= 34) return "31-34";
  return "35+";
}

export function continentOf(nation: string): Continent {
  const continent = NATION_CONTINENT[nation];
  if (!continent) throw new Error(`Nacion sin continente en el mapa: ${nation}`);
  return continent;
}

/**
 * Proyeccion publica. Es la unica forma legitima de construir lo que se manda
 * al navegador antes del reveal: si un campo no esta aqui, no puede filtrarse.
 */
export function toPublic(card: CardSource): CardPublic {
  return {
    slot: card.slot,
    heightCm: card.heightCm,
    foot: card.foot,
    ageBand: ageBandOf(card.season, card.birthYear),
    continent: continentOf(card.nation),
    decade: decadeOf(card.season),
  };
}

export function toPrivate(card: CardSource): CardPrivate {
  return {
    cardId: card.cardId,
    name: card.name,
    season: card.season,
    club: card.club,
    league: card.league,
    nation: card.nation,
    rating: card.rating,
  };
}

/** Valida el dataset entero. Lanza con detalle: el servidor no debe arrancar con datos malos. */
export function parseDataset(raw: unknown): CardSource[] {
  const cards = z.array(CardSourceSchema).parse(raw);

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.cardId)) throw new Error(`cardId duplicado: ${card.cardId}`);
    seen.add(card.cardId);
    continentOf(card.nation); // lanza si la nacion no esta mapeada
  }

  return cards;
}

export function cardsBySlot(cards: CardSource[]): Record<Slot, CardSource[]> {
  const grouped = Object.fromEntries(SLOTS.map((s) => [s, [] as CardSource[]])) as Record<Slot, CardSource[]>;
  for (const card of cards) grouped[card.slot].push(card);
  return grouped;
}

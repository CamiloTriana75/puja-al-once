import { describe, expect, it } from "vitest";
import {
  playersNeedingSlot, resolveSkipVote, skipAllowed,
  type AuctionState, type PlayerState,
} from "../src/index.js";

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 100, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    openingBid: 20,
    bidHistory: [],
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    players: [player("p1"), player("p2"), player("p3"), player("p4")],
    ...overrides,
  };
}

describe("playersNeedingSlot", () => {
  it("excluye a quien ya ficho y a los desconectados", () => {
    const s = state({
      players: [
        player("p1"),
        player("p2", { squad: { GK: "cx" } }),
        player("p3", { connected: false }),
        player("p4"),
      ],
    });
    expect(playersNeedingSlot(s).map((p) => p.playerId)).toEqual(["p1", "p4"]);
  });
});

describe("skipAllowed", () => {
  it("permite saltar mientras sobran cartas", () => {
    // 5 cartas, 4 jugadores necesitan el hueco
    expect(skipAllowed(state())).toBe(true);
  });

  it("prohibe saltar cuando quedan tantas cartas como jugadores por fichar", () => {
    expect(skipAllowed(state({ remainingCards: ["c1", "c2", "c3", "c4"] }))).toBe(false);
  });

  it("recupera el margen cuando alguien ya ficho el hueco", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });

  it("no cuenta a los desconectados para el margen", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { connected: false }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });
});

describe("resolveSkipVote", () => {
  it("salta si votean saltar todos los que necesitan el hueco", () => {
    const s = state({ skipVotes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("el voto de quien ya ficho el hueco NO cuenta para la unanimidad", () => {
    // El caso que reporto el jugador: 4 conectados, p1 ya tiene el GK, y los
    // otros tres votan saltar. Antes esto devolvia RESUMED porque la
    // unanimidad exigia tambien el voto de p1 -- un voto que la interfaz no
    // deja emitir (Auction.tsx oculta los botones a quien ya ficho), con lo
    // que la carta quemaba los skipVoteMs enteros antes de descartarse igual.
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("tampoco bloquea si quien ya ficho vota en contra", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p1: false, p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("tres jugadores: uno ya lo tiene y los dos que faltan votan, resuelve igual", () => {
    // El caso exacto del aviso: 3 jugadores, uno ya escogio, los otros dos
    // votan pasar. Resuelve al instante, no al vencerse el reloj.
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3")],
      skipVotes: { p2: true, p3: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("aun falta un voto de quien necesita el hueco", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: [] });
  });

  it("descarta cuando nadie necesita el hueco: la carta no le interesa a nadie", () => {
    // Sin este guard, every([]) === true devolveria SKIPPED por el motivo
    // equivocado -- y si en el futuro la regla de unanimidad cambia, este
    // test es el que dice que aqui no hay ResolveSkipVote que aplicar.
    const s = state({
      players: [
        player("p1", { squad: { GK: "cx" } }),
        player("p2", { squad: { GK: "c2" } }),
        player("p3", { connected: false, squad: { GK: "c3" } }),
        player("p4", { squad: { GK: "c4" } }),
      ],
      skipVotes: {},
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("ignora a los desconectados para la unanimidad", () => {
    const s = state({
      players: [player("p1", { connected: false }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("reanuda restringido a quien voto en contra", () => {
    const s = state({ skipVotes: { p1: true, p2: false, p3: true, p4: false } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: ["p2", "p4"] });
  });

  it("trata la abstencion como que no bloquea el salto pero tampoco habilita a pujar", () => {
    const s = state({ skipVotes: { p1: true, p2: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: [] });
  });

  it("quien ya ficho el hueco puede haber votado en contra pero nunca acaba en restrictedBidders", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p1: false, p2: true, p3: true, p4: false },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: ["p4"] });
  });
});

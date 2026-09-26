import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type AuctionState, type CardSource } from "@fut/shared";
import { AuctionRoomState } from "../src/schema.js";
import { projectState } from "../src/project.js";

function baseGame(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "LOBBY",
    slotIndex: 0,
    remainingCards: [],
    currentBid: 0,
    currentBidderId: null,
    openingBid: DEFAULT_RULES.basePrice,
    bidHistory: [],
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    players: [],
    ...overrides,
  };
}

describe("projectState", () => {
  it("no lanza en RESULTS aunque slotIndex se haya salido de SLOTS", () => {
    const schema = new AuctionRoomState();
    const game = baseGame({ phase: "RESULTS", slotIndex: 11 });

    expect(() =>
      projectState(game, schema, DEFAULT_RULES, new Map<string, CardSource>(), new Map(), new Set(), new Set()),
    ).not.toThrow();
    expect(schema.currentSlot).toBe("");
  });

  it("barre del Schema a los jugadores que ya no estan en el estado puro", () => {
    const schema = new AuctionRoomState();
    const cards = new Map<string, CardSource>();
    const publicIds = new Map<string, string>();

    const withTwo = baseGame({
      players: [
        { playerId: "a", name: "Ana", budget: 100, squad: {}, connected: true },
        { playerId: "b", name: "Bea", budget: 100, squad: {}, connected: true },
      ],
    });
    projectState(withTwo, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set());
    expect(schema.players.size).toBe(2);

    const withOne = baseGame({
      players: [{ playerId: "a", name: "Ana", budget: 100, squad: {}, connected: true }],
    });
    projectState(withOne, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set());

    expect(schema.players.size).toBe(1);
    expect(schema.players.has("b")).toBe(false);
    expect(schema.players.has("a")).toBe(true);
  });

  it("proyecta rejoinPending por separado de connected", () => {
    const schema = new AuctionRoomState();
    const cards = new Map<string, CardSource>();
    const publicIds = new Map<string, string>();
    // connected: false representa tanto "se cayo" como "volvio pero la
    // ronda en curso todavia no lo cuenta" -- pendingRejoins es lo unico
    // que distingue el segundo caso para el Schema.
    const game = baseGame({
      players: [{ playerId: "a", name: "Ana", budget: 100, squad: {}, connected: false }],
    });

    projectState(game, schema, DEFAULT_RULES, cards, publicIds, new Set(["a"]), new Set());
    expect(schema.players.get("a")?.connected).toBe(false);
    expect(schema.players.get("a")?.rejoinPending).toBe(true);

    projectState(game, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set());
    expect(schema.players.get("a")?.rejoinPending).toBe(false);
  });

  it("proyecta ready -- quien de la sala de espera ha pulsado listo", () => {
    const schema = new AuctionRoomState();
    const cards = new Map<string, CardSource>();
    const publicIds = new Map<string, string>();
    const game = baseGame({
      players: [
        { playerId: "a", name: "Ana", budget: 100, squad: {}, connected: true },
        { playerId: "b", name: "Bea", budget: 100, squad: {}, connected: true },
      ],
    });

    // Solo Ana ha pulsado listo: el Schema tiene que distinguir a los dos.
    projectState(game, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set(["a"]));
    expect(schema.players.get("a")?.ready).toBe(true);
    expect(schema.players.get("b")?.ready).toBe(false);

    // Bea tambien pulsa listo: sube sin que Ana baje.
    projectState(game, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set(["a", "b"]));
    expect(schema.players.get("a")?.ready).toBe(true);
    expect(schema.players.get("b")?.ready).toBe(true);
  });

  it("proyecta passes (D2) y lo vacia al abrir la carta siguiente", () => {
    const schema = new AuctionRoomState();
    const cards = new Map<string, CardSource>();
    const publicIds = new Map<string, string>();

    const withOnePass = baseGame({ passes: { a: true } });
    projectState(withOnePass, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set());
    expect(schema.passes.get("a")).toBe(true);
    expect(schema.passes.size).toBe(1);

    // La carta siguiente abre con `passes: {}`: el Schema tiene que
    // vaciarse tambien, no arrastrar la fila de la carta anterior.
    const cleared = baseGame({ passes: {} });
    projectState(cleared, schema, DEFAULT_RULES, cards, publicIds, new Set(), new Set());
    expect(schema.passes.size).toBe(0);
  });
});

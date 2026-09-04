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
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    players: [],
    ...overrides,
  };
}

describe("projectState", () => {
  it("no lanza en RESULTS aunque slotIndex se haya salido de SLOTS", () => {
    const schema = new AuctionRoomState();
    const game = baseGame({ phase: "RESULTS", slotIndex: 11 });

    expect(() => projectState(game, schema, DEFAULT_RULES, new Map<string, CardSource>(), new Map())).not.toThrow();
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
    projectState(withTwo, schema, DEFAULT_RULES, cards, publicIds);
    expect(schema.players.size).toBe(2);

    const withOne = baseGame({
      players: [{ playerId: "a", name: "Ana", budget: 100, squad: {}, connected: true }],
    });
    projectState(withOne, schema, DEFAULT_RULES, cards, publicIds);

    expect(schema.players.size).toBe(1);
    expect(schema.players.has("b")).toBe(false);
    expect(schema.players.has("a")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  acceptTradeOffer,
  createTradeOffer,
  DEFAULT_RULES,
  type PlayerState,
} from "../src/index.js";

function player(id: string, squad: PlayerState["squad"] = {}, budget = DEFAULT_RULES.startingBudget): PlayerState {
  return { playerId: id, name: id, budget, squad, connected: true };
}

describe("transfer market", () => {
  it("creates an open offer with players on both sides and optional money", () => {
    const result = createTradeOffer(
      [
        player("p1", { CB1: "card-a" }, 500),
        player("p2", { CB1: "card-b" }),
      ],
      {
        offerId: "offer-1",
        proposerId: "p1",
        recipientId: "p2",
        offeredCardIds: ["card-a"],
        requestedCardIds: ["card-b"],
        proposerPays: 50,
      },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        offerId: "offer-1",
        proposerId: "p1",
        recipientId: "p2",
        offeredCardIds: ["card-a"],
        requestedCardIds: ["card-b"],
        proposerPays: 50,
        status: "OPEN",
      },
    });
  });

  it("rejects an offer that does not exchange a player on both sides", () => {
    const result = createTradeOffer(
      [player("p1", { CB1: "card-a" }), player("p2")],
      {
        offerId: "offer-1",
        proposerId: "p1",
        recipientId: "p2",
        offeredCardIds: ["card-a"],
        requestedCardIds: [],
        proposerPays: 0,
      },
    );

    expect(result).toEqual({ ok: false, error: "REQUESTED_PLAYERS_REQUIRED" });
  });

  it("accepts atomically, swaps the players and transfers money", () => {
    const players = [
      player("p1", { CB1: "card-a" }, 500),
      player("p2", { CB1: "card-b" }, 300),
    ];
    const offer = createTradeOffer(players, {
      offerId: "offer-1",
      proposerId: "p1",
      recipientId: "p2",
      offeredCardIds: ["card-a"],
      requestedCardIds: ["card-b"],
      proposerPays: 50,
    });

    if (!offer.ok) throw new Error(offer.error);
    const result = acceptTradeOffer(players, offer.value);

    expect(result).toEqual({
      ok: true,
      value: [
        player("p1", { CB1: "card-b" }, 450),
        player("p2", { CB1: "card-a" }, 350),
      ],
    });
    expect(players[0]?.squad.CB1).toBe("card-a");
  });

  it("rejects acceptance when ownership changed after the offer", () => {
    const players = [
      player("p1", { CB1: "card-other" }, 500),
      player("p2", { CB1: "card-b" }, 300),
    ];
    const offer = {
      offerId: "offer-1",
      proposerId: "p1",
      recipientId: "p2",
      offeredCardIds: ["card-a"],
      requestedCardIds: ["card-b"],
      proposerPays: 50,
      status: "OPEN" as const,
    };

    expect(acceptTradeOffer(players, offer)).toEqual({ ok: false, error: "OFFER_STALE" });
  });
});

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

  describe("los dos centrales cuentan como la misma posicion", () => {
    const input = (offered: string[], requested: string[]) => ({
      offerId: "offer-cb",
      proposerId: "p1",
      recipientId: "p2",
      offeredCardIds: offered,
      requestedCardIds: requested,
      proposerPays: 0,
    });

    it("acepta cambiar mi CB1 por el CB2 del rival y cada carta cae en el hueco de quien la recibe", () => {
      const players = [player("p1", { CB1: "mine", CB2: "mine-2" }), player("p2", { CB1: "theirs-1", CB2: "theirs" })];
      const created = createTradeOffer(players, input(["mine"], ["theirs"]));
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const accepted = acceptTradeOffer(players, created.value);
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      const [p1, p2] = accepted.value;
      expect(p1!.squad).toEqual({ CB1: "theirs", CB2: "mine-2" });
      expect(p2!.squad).toEqual({ CB1: "theirs-1", CB2: "mine" });
    });

    it("sigue rechazando posiciones distintas (lateral por central)", () => {
      const players = [player("p1", { LB: "mine" }), player("p2", { CB1: "theirs" })];
      expect(createTradeOffer(players, input(["mine"], ["theirs"]))).toEqual({ ok: false, error: "PLAYERS_MUST_MATCH_POSITIONS" });
    });

    it("con varias cartas empareja por posicion, no por orden de la lista", () => {
      const players = [player("p1", { GK: "gk-a", LB: "lb-a" }), player("p2", { GK: "gk-b", LB: "lb-b" })];
      const created = createTradeOffer(players, input(["gk-a", "lb-a"], ["lb-b", "gk-b"]));
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const accepted = acceptTradeOffer(players, created.value);
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expect(accepted.value[0]!.squad).toEqual({ GK: "gk-b", LB: "lb-b" });
      expect(accepted.value[1]!.squad).toEqual({ GK: "gk-a", LB: "lb-a" });
    });
  });
});

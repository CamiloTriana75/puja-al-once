import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

describe("lobby", () => {
  it("admite cuatro jugadores y arranca en LOBBY", async () => {
    const room = await colyseus.createRoom("auction", {});
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      await colyseus.connectTo(room, { name });
    }
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.players.size).toBe(4);
    expect([...room.state.players.values()].map((p) => p.name)).toContain("Ana");
  });

  it("reparte jugadores + 1 candidatos y pasa a BIDDING cuando todos estan listos", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentSlot).toBe("GK");
    expect(room.state.remainingCount).toBe(5);
    expect(room.state.currentCard?.cardId).toBeTruthy();
  });

  it("no filtra ningun campo privado de la carta antes del reveal", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const card = clients[0]!.state.currentCard;
    expect(card?.silhouetteId).toBeTruthy();
    expect(card?.name).toBe("");
    expect(card?.rating).toBe(0);
    expect(card?.season).toBe(0);
    expect(card?.revealed).toBe(false);
  });

  it("cada jugador arranca con el presupuesto inicial", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });
    expect([...room.state.players.values()][0]?.budget).toBe(100);
  });
});

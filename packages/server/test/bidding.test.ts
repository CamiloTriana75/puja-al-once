import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients };
}

describe("puja", () => {
  it("acepta una puja valida y la refleja en el estado", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    expect(room.state.currentBid).toBe(5);
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
    expect(room.state.minimumBid).toBe(6);
  });

  it("empuja el cierre en cada puja (anti-snipe)", async () => {
    const { room, clients } = await startedRoom();
    const before = room.state.endsAt;
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    const after = room.state.endsAt;

    // 15 s iniciales -> 6 s desde ahora: el cierre se adelanta pero queda anclado a la puja
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThan(Date.now());
  });

  it("rechaza una puja por debajo del minimo y avisa al que pujo", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[1]!.onMessage("bid:rejected", resolve);
    });
    clients[1]!.send("bid", { amount: 5 });
    expect((await rejection).reason).toBe("BID_TOO_LOW");
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", async () => {
    const { clients } = await startedRoom();
    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[0]!.onMessage("bid:rejected", resolve);
    });
    clients[0]!.send("bid", { amount: 81 });
    expect((await rejection).reason).toBe("OVER_BUDGET");
  });

  it("al cerrarse el timer cobra al ganador y le asigna el hueco", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    // Forzar el cierre sin esperar 6 s reales
    (room as unknown as { onBidTimeout(): void }).onBidTimeout();
    await room.waitForNextPatch();

    const winner = room.state.players.get(clients[0]!.sessionId);
    expect(winner?.budget).toBe(95);
    expect(winner?.squad.get("GK")).toBeTruthy();
    expect(room.state.phase).toBe("REVEAL");
  });
});

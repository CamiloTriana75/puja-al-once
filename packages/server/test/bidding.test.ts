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
  it("espera la primera puja sin reloj y publica la oferta para toda la sala", async () => {
    const { room, clients } = await startedRoom();
    expect(room.state.endsAt).toBe(0);

    const firstBid = room.state.minimumBid;
    clients[0]!.send("bid", { amount: firstBid });
    await room.waitForNextPatch();

    expect(room.state.currentBid).toBe(firstBid);
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
    expect(room.state.minimumBid).toBe(firstBid + 10);
    expect(room.state.endsAt).toBeGreaterThan(Date.now());
    expect([...room.state.bidHistory]).toEqual([{ playerId: clients[0]!.sessionId, amount: firstBid }]);
  });

  it("empuja el cierre en cada puja (anti-snipe)", async () => {
    const { room, clients } = await startedRoom();
    const firstBid = room.state.minimumBid;
    clients[0]!.send("bid", { amount: firstBid });
    await room.waitForNextPatch();
    const firstDeadline = room.state.endsAt;
    clients[1]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    const secondDeadline = room.state.endsAt;

    expect(firstDeadline).toBeGreaterThan(Date.now());
    expect(secondDeadline).toBeGreaterThanOrEqual(firstDeadline);
  });

  it("abre la votacion de salto cuando un jugador cierra una carta sin pujas", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("closeWithoutBid", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("SKIP_VOTE");
  });

  it("rechaza una puja por debajo del minimo y avisa al que pujo", async () => {
    const { room, clients } = await startedRoom();
    const firstBid = room.state.minimumBid;
    clients[0]!.send("bid", { amount: firstBid });
    await room.waitForNextPatch();

    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[1]!.onMessage("bid:rejected", resolve);
    });
    clients[1]!.send("bid", { amount: firstBid });
    expect((await rejection).reason).toBe("BID_TOO_LOW");
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", async () => {
    const { clients } = await startedRoom();
    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[0]!.onMessage("bid:rejected", resolve);
    });
    clients[0]!.send("bid", { amount: 801 });
    expect((await rejection).reason).toBe("OVER_BUDGET");
  });

  it("al cerrarse el timer cobra al ganador y le asigna el hueco", async () => {
    const { room, clients } = await startedRoom();
    const firstBid = room.state.minimumBid;
    clients[0]!.send("bid", { amount: firstBid });
    await room.waitForNextPatch();

    // Forzar el cierre sin esperar 6 s reales
    (room as unknown as { onBidTimeout(): void }).onBidTimeout();
    await room.waitForNextPatch();

    const winner = room.state.players.get(clients[0]!.sessionId);
    expect(winner?.budget).toBe(1_000 - firstBid);
    expect(winner?.squad.get("GK")).toBeTruthy();
    expect(room.state.phase).toBe("REVEAL");
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { SLOTS } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onRevealTimeout(): void }

/** Juega una partida entera: todos pujan el minimo, cada uno se lleva una carta por hueco. */
async function playFullMatch() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();

  const hooks = room as unknown as Hooks;
  for (let slot = 0; slot < SLOTS.length; slot++) {
    for (const client of clients) {
      client.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
  }
  return { room, clients };
}

describe("resultados", () => {
  it("termina en RESULTS con una fila por jugador", async () => {
    const { room } = await playFullMatch();
    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(4);
  });

  it("reparte exactamente 11 puntos entre los cuatro", async () => {
    const { room } = await playFullMatch();
    const total = [...room.state.standings].reduce((sum, s) => sum + s.points, 0);
    expect(total).toBeCloseTo(11, 5);
  });

  it("la clasificacion viene ordenada y con rango", async () => {
    const { room } = await playFullMatch();
    const rows = [...room.state.standings];
    expect(rows[0]?.rank).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.points).toBeLessThanOrEqual(rows[i - 1]!.points);
    }
  });
});

describe("desconexion", () => {
  it("marca al jugador como desconectado sin parar la partida", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const goneId = clients[3]!.sessionId;
    await clients[3]!.leave(false);
    await room.waitForNextPatch();

    expect(room.state.players.get(goneId)?.connected).toBe(false);
    expect(room.state.phase).toBe("BIDDING");
  });
});

describe("reconexion", () => {
  it("dentro del margen se reconecta con el mismo sessionId y sigue la partida sin el", async () => {
    // Dan se cae nada mas empezar y no vuelve durante la ronda: la partida
    // sigue sin el (Ana/Bea/Cid se reparten cada hueco entre ellas) hasta
    // llegar a RESULTS. La reconexion no puede resucitar rondas ya
    // cerradas -- solo importa que el sessionId se conserve y que, una vez
    // en RESULTS, no quede ninguna ronda que proteger: se marca conectado
    // de inmediato en cuanto vuelve.
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const danId = clients[3]!.sessionId;
    const danToken = clients[3]!.reconnectionToken;
    await clients[3]!.leave(false);
    await room.waitForNextPatch();
    expect(room.state.players.get(danId)?.connected).toBe(false);

    const active = [clients[0]!, clients[1]!, clients[2]!];
    const hooks = room as unknown as Hooks;
    for (let slot = 0; slot < SLOTS.length; slot++) {
      for (const client of active) {
        client.send("bid", { amount: 2 });
        await room.waitForNextPatch();
        hooks.onBidTimeout();
        await room.waitForNextPatch();
        hooks.onRevealTimeout();
        await room.waitForNextPatch();
      }
    }

    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.players.get(danId)?.connected).toBe(false);
    // Sin Dan, sus 11 huecos quedan vacios y su fila puntua 0.
    const danStanding = [...room.state.standings].find((s) => s.playerId === danId);
    expect(danStanding?.points).toBe(0);

    const reconnected = await colyseus.sdk.reconnect(danToken);
    await room.waitForNextPatch();
    expect(reconnected.sessionId).toBe(danId);
    expect(room.state.players.get(danId)?.connected).toBe(true);
  });
});

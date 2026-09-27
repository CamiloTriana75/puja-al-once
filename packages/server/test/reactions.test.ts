import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface ReactionMsg { playerId: string; emoji: number }

// Tipo inferido del propio helper de prueba -- este paquete no depende de
// `colyseus.js` (eso es del cliente, ver la nota grande en useRoom.ts sobre
// por que el cliente nunca importa clases Schema del servidor; aqui es la
// direccion contraria, pero la misma frontera de paquete aplica), asi que
// se evita un import directo que rompería el typecheck de @fut/server.
type TestClient = Awaited<ReturnType<ColyseusTestServer["connectTo"]>>;

/** Espera el proximo "reaction" que le llegue a este cliente, o null si no llega ninguno en `timeoutMs`. */
function waitForReaction(client: TestClient, timeoutMs = 300): Promise<ReactionMsg | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.onMessage("reaction", (msg: ReactionMsg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients };
}

describe("react (D8)", () => {
  it("difunde la reaccion valida a toda la sala, incluido quien la mando", async () => {
    const { clients } = await startedRoom();
    const ana = waitForReaction(clients[0]!);
    const bea = waitForReaction(clients[1]!);

    clients[0]!.send("react", { emoji: 2 });

    expect(await ana).toEqual({ playerId: clients[0]!.sessionId, emoji: 2 });
    expect(await bea).toEqual({ playerId: clients[0]!.sessionId, emoji: 2 });
  });

  it("ignora en silencio un emoji fuera de rango (no entero, negativo, o > 5) sin desconectar a nadie", async () => {
    const { room, clients } = await startedRoom();
    const bea = waitForReaction(clients[1]!);

    clients[0]!.send("react", { emoji: 6 });
    clients[0]!.send("react", { emoji: -1 });
    clients[0]!.send("react", { emoji: 1.5 });
    clients[0]!.send("react", { emoji: "2" });
    clients[0]!.send("react", {});

    expect(await bea).toBeNull();
    // La sala sigue viva y respondiendo -- nada se rompio ni desconecto.
    expect(room.state.phase).toBe("BIDDING");
  });

  it("limita a 1 cada 600 ms por cliente: la segunda reaccion inmediata se ignora", async () => {
    const { clients } = await startedRoom();
    const first = waitForReaction(clients[1]!);
    clients[0]!.send("react", { emoji: 0 });
    expect(await first).toEqual({ playerId: clients[0]!.sessionId, emoji: 0 });

    const second = waitForReaction(clients[1]!);
    clients[0]!.send("react", { emoji: 1 });
    clients[0]!.send("react", { emoji: 2 });
    expect(await second).toBeNull();
  });

  it("tras el enfriamiento, una nueva reaccion del mismo cliente si se difunde", async () => {
    const { clients } = await startedRoom();
    const first = waitForReaction(clients[1]!);
    clients[0]!.send("react", { emoji: 0 });
    expect(await first).toEqual({ playerId: clients[0]!.sessionId, emoji: 0 });

    await new Promise((resolve) => setTimeout(resolve, 650));

    const second = waitForReaction(clients[1]!);
    clients[0]!.send("react", { emoji: 3 });
    expect(await second).toEqual({ playerId: clients[0]!.sessionId, emoji: 3 });
  }, 10_000);

  it("el limite de frecuencia es por cliente: el otro jugador puede reaccionar aunque el primero este en enfriamiento", async () => {
    const { clients } = await startedRoom();
    const anaSeesFirst = waitForReaction(clients[0]!);
    clients[0]!.send("react", { emoji: 0 });
    expect(await anaSeesFirst).toEqual({ playerId: clients[0]!.sessionId, emoji: 0 });

    const anaSeesSecond = waitForReaction(clients[0]!);
    clients[1]!.send("react", { emoji: 4 });
    expect(await anaSeesSecond).toEqual({ playerId: clients[1]!.sessionId, emoji: 4 });
  });

  it("no hace nada en fase LOBBY", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    const bea = waitForReaction(clients[1]!);

    clients[0]!.send("react", { emoji: 0 });

    expect(await bea).toBeNull();
    expect(room.state.phase).toBe("LOBBY");
  });

  it("no toca this.state: el patch de la sala no cambia por una reaccion", async () => {
    const { room, clients } = await startedRoom();
    const before = JSON.stringify(room.state.toJSON());
    const ana = waitForReaction(clients[0]!);

    clients[0]!.send("react", { emoji: 5 });
    await ana;

    const after = JSON.stringify(room.state.toJSON());
    expect(after).toBe(before);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface ChatMsg { id: string; playerId: string; name: string; text: string; at: number }
type TestClient = Awaited<ReturnType<ColyseusTestServer["connectTo"]>>;

function wait<T>(client: TestClient, type: string, timeoutMs = 300): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.onMessage(type, (msg: T) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

async function lobby() {
  const room = await colyseus.createRoom("auction", {});
  const ana = await colyseus.connectTo(room, { name: "Ana" });
  const bea = await colyseus.connectTo(room, { name: "Bea" });
  return { room, ana, bea };
}

describe("chat de la sala", () => {
  it("difunde el mensaje a todos con el nombre puesto por el servidor, ya en la sala de espera", async () => {
    const { ana, bea } = await lobby();
    const toBea = wait<ChatMsg>(bea, "chat");
    const toAna = wait<ChatMsg>(ana, "chat");

    ana.send("chat", { text: "  Hola   equipo  ", name: "Falso" });

    const received = await toBea;
    expect(received).toMatchObject({ playerId: ana.sessionId, name: "Ana", text: "Hola equipo" });
    expect((await toAna)?.id).toBe(received?.id);
  });

  it("ignora mensajes vacios o que no son texto sin desconectar a nadie", async () => {
    const { room, ana, bea } = await lobby();
    const toBea = wait<ChatMsg>(bea, "chat");
    ana.send("chat", { text: "   " });
    ana.send("chat", { text: 7 });
    ana.send("chat", {});
    expect(await toBea).toBeNull();
    expect(room.clients.length).toBe(2);
  });

  it("limita la frecuencia y avisa al emisor con chat:rejected", async () => {
    const { ana, bea } = await lobby();
    const first = wait<ChatMsg>(bea, "chat");
    ana.send("chat", { text: "uno" });
    expect((await first)?.text).toBe("uno");

    const rejected = wait<{ reason: string }>(ana, "chat:rejected");
    ana.send("chat", { text: "dos" });
    expect(await rejected).toEqual({ reason: "RATE_LIMITED" });
  });

  it("entrega el historial a quien lo pide (entrada tardia o reconexion)", async () => {
    const { room, ana } = await lobby();
    const seen = wait<ChatMsg>(ana, "chat");
    ana.send("chat", { text: "primero" });
    await seen;

    const late = await colyseus.connectTo(room, { name: "Caro" });
    const history = wait<ChatMsg[]>(late, "chat:history");
    late.send("chat:history", {});
    expect((await history)?.map((m) => m.text)).toEqual(["primero"]);
  });
});

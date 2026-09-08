import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

// Mismo puerto fijo que usa @colyseus/testing (ver vitest.config.ts y el
// mismo comentario en photo-route.test.ts): la ruta HTTP de resolucion de
// codigo vive en packages/server/src/index.ts, asi que hay que hablarle por
// HTTP de verdad, no solo llamar al metodo que la resuelve por dentro.
const BASE_URL = "http://localhost:2568";

describe("codigo de sala", () => {
  it("el codigo en el estado usa solo el alfabeto sin ambiguedades y la longitud declarada", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });

    expect(room.state.roomCode).toHaveLength(ROOM_CODE_LENGTH);
    for (const char of room.state.roomCode) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it("GET /rooms/:code resuelve al roomId de la sala que tiene ese codigo", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });

    const res = await fetch(`${BASE_URL}/rooms/${room.state.roomCode}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roomId: string };
    expect(body.roomId).toBe(room.roomId);
  });

  it("GET /rooms/:code no distingue mayusculas de minusculas -- se dicta por voz, no se teclea con precision", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });

    const res = await fetch(`${BASE_URL}/rooms/${room.state.roomCode.toLowerCase()}`);
    expect(res.status).toBe(200);
  });

  it("permite unirse a una sala existente por su codigo, con nombre propio y presupuesto inicial", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });

    const res = await fetch(`${BASE_URL}/rooms/${room.state.roomCode}`);
    const { roomId } = (await res.json()) as { roomId: string };

    const bea = await colyseus.sdk.joinById(roomId, { name: "Bea" });
    await room.waitForNextPatch();

    expect(room.state.players.size).toBe(2);
    expect(room.state.players.get(bea.sessionId)?.name).toBe("Bea");
    expect(room.state.players.get(bea.sessionId)?.budget).toBe(1000);
  });

  describe("los tres rechazos son distinguibles", () => {
    it("sala inexistente: NOT_FOUND, 404", async () => {
      const res = await fetch(`${BASE_URL}/rooms/ZZZZZ`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { reason: string };
      expect(body.reason).toBe("NOT_FOUND");
    });

    it("sala llena: FULL, distinto de NOT_FOUND y de STARTED", async () => {
      const room = await colyseus.createRoom("auction", {});
      for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
        await colyseus.connectTo(room, { name });
      }
      // maxClients=4 y los cuatro asientos ocupados, pero nadie ha pulsado
      // listo: la sala esta llena sin haber empezado -- el caso que STARTED
      // no puede confundir con este.
      expect(room.state.phase).toBe("LOBBY");

      const res = await fetch(`${BASE_URL}/rooms/${room.state.roomCode}`);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { reason: string };
      expect(body.reason).toBe("FULL");
    });

    it("partida ya empezada: STARTED, distinto de NOT_FOUND y de FULL", async () => {
      const room = await colyseus.createRoom("auction", {});
      const clients = [];
      for (const name of ["Ana", "Bea"]) {
        clients.push(await colyseus.connectTo(room, { name }));
      }
      for (const client of clients) client.send("ready", {});
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("BIDDING");

      const res = await fetch(`${BASE_URL}/rooms/${room.state.roomCode}`);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { reason: string };
      expect(body.reason).toBe("STARTED");
    });

    it("los tres motivos son mensajes distintos entre si", async () => {
      const full = await colyseus.createRoom("auction", {});
      for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
        await colyseus.connectTo(full, { name });
      }
      const started = await colyseus.createRoom("auction", {});
      const startedClients = [];
      for (const name of ["Ana", "Bea"]) {
        startedClients.push(await colyseus.connectTo(started, { name }));
      }
      for (const client of startedClients) client.send("ready", {});
      await started.waitForNextPatch();

      const [notFound, isFull, isStarted] = await Promise.all([
        fetch(`${BASE_URL}/rooms/ZZZZZ`).then((r) => r.json()) as Promise<{ reason: string }>,
        fetch(`${BASE_URL}/rooms/${full.state.roomCode}`).then((r) => r.json()) as Promise<{ reason: string }>,
        fetch(`${BASE_URL}/rooms/${started.state.roomCode}`).then((r) => r.json()) as Promise<{ reason: string }>,
      ]);

      const reasons = new Set([notFound.reason, isFull.reason, isStarted.reason]);
      expect(reasons.size).toBe(3);
    });
  });
});

describe("el anfitrion", () => {
  it("es quien crea la sala", async () => {
    const room = await colyseus.createRoom("auction", {});
    const ana = await colyseus.connectTo(room, { name: "Ana" });
    await room.waitForNextPatch();

    expect(room.state.hostId).toBe(ana.sessionId);
  });

  it("migra al siguiente conectado si se va antes de empezar", async () => {
    const room = await colyseus.createRoom("auction", {});
    const ana = await colyseus.connectTo(room, { name: "Ana" });
    const bea = await colyseus.connectTo(room, { name: "Bea" });
    await room.waitForNextPatch();
    expect(room.state.hostId).toBe(ana.sessionId);

    await ana.leave();
    await room.waitForNextPatch();

    expect(room.state.hostId).toBe(bea.sessionId);
  });
});

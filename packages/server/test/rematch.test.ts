import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { SLOTS } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onRevealTimeout(): void; cardIdToPublicId: Map<string, string> }

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
      client.send("bid", { amount: room.state.minimumBid });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
  }
  return { room, clients, hooks };
}

describe("rematch (D5)", () => {
  it("se ignora fuera de RESULTS, incluso si lo manda el anfitrion", async () => {
    const room = await colyseus.createRoom("auction", {});
    const ana = await colyseus.connectTo(room, { name: "Ana" });
    await colyseus.connectTo(room, { name: "Bea" });
    expect(room.state.hostId).toBe(ana.sessionId);

    ana.send("rematch", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("LOBBY"); // no hay nada que reiniciar: sigue en el lobby original
  });

  it("se ignora si no lo manda el anfitrion", async () => {
    const { room, clients } = await playFullMatch();
    expect(room.state.phase).toBe("RESULTS");
    const before = room.state.standings.length;

    clients[1]!.send("rematch", {}); // Bea no es el anfitrion (Ana entro primero)
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(before);
  });

  it("jugar, revancha, volver a jugar hasta RESULTS", async () => {
    // Solo 3 (no 4): con maxClients=4 (D6 lo sube a 6, pero eso es otro
    // bloque) hace falta dejar un asiento libre para probar mas abajo que
    // la sala queda de verdad desbloqueada, no solo con la fase en LOBBY.
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const hooks = room as unknown as Hooks;
    for (let slot = 0; slot < SLOTS.length; slot++) {
      for (const client of clients) {
        client.send("bid", { amount: room.state.minimumBid });
        await room.waitForNextPatch();
        hooks.onBidTimeout();
        await room.waitForNextPatch();
        hooks.onRevealTimeout();
        await room.waitForNextPatch();
      }
    }

    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(3);
    expect(room.locked).toBe(true); // startRound() bloqueo la sala al arrancar

    const publicIdsBefore = new Map(hooks.cardIdToPublicId);
    const winnerId = clients[0]!.sessionId;
    expect(room.state.players.get(winnerId)?.budget).toBeLessThan(1_000);

    clients[0]!.send("rematch", {}); // Ana es la anfitriona
    await room.waitForNextPatch();

    // Reinicio completo: LOBBY, presupuestos y plantillas limpias, sin
    // cartas reveladas ni clasificacion, todos "no listos", sala abierta.
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.currentCard).toBeUndefined();
    expect(room.state.revealedCards.size).toBe(0);
    expect(room.state.standings.length).toBe(0);
    expect(room.locked).toBe(false);
    for (const client of clients) {
      const player = room.state.players.get(client.sessionId);
      expect(player?.budget).toBe(1_000);
      expect(player?.squad.size).toBe(0);
      expect(player?.ready).toBe(false);
    }

    // publicId nuevos para TODA la baraja: reutilizar los de la partida
    // anterior permitiria correlacionar cartas entre las dos.
    expect(publicIdsBefore.size).toBeGreaterThan(0);
    for (const [cardId, oldPublicId] of publicIdsBefore) {
      expect(hooks.cardIdToPublicId.get(cardId)).not.toBe(oldPublicId);
    }

    // Sala desbloqueada de verdad: un jugador nuevo puede unirse.
    const newcomer = await colyseus.connectTo(room, { name: "Dan" });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(4);
    await newcomer.leave();
    await room.waitForNextPatch();

    // Se vuelve a jugar la partida entera con los 3 originales -- el mazo
    // nuevo (usedCards reiniciado) tiene que dar de si para las 11 rondas
    // otra vez, exactamente igual que la primera vez.
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");

    for (let slot = 0; slot < SLOTS.length; slot++) {
      for (const client of clients) {
        client.send("bid", { amount: room.state.minimumBid });
        await room.waitForNextPatch();
        hooks.onBidTimeout();
        await room.waitForNextPatch();
        hooks.onRevealTimeout();
        await room.waitForNextPatch();
      }
    }

    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(3);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks {
  onBidTimeout(): void;
  onSkipTimeout(): void;
  onRevealTimeout(): void;
}

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients, hooks: room as unknown as Hooks };
}

describe("voto de salto", () => {
  it("abre la votacion si nadie puja y hay margen", async () => {
    const { room, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");
    expect(room.state.skipAvailable).toBe(true);
  });

  it("descarta la carta si el voto es unanime", async () => {
    const { room, clients, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    for (const client of clients) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    // PublicCardSchema no lleva cardId (solo publicId opaco): la unica carta
    // revelada hasta ahora es la que se acaba de descartar.
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.ownerId).toBe("");
    expect(room.state.remainingCount).toBe(4);
  });

  it("reanuda restringido a quien voto en contra", async () => {
    const { room, clients, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    clients[0]!.send("voteSkip", { skip: true });
    clients[1]!.send("voteSkip", { skip: false });
    await room.waitForNextPatch();
    hooks.onSkipTimeout();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect([...room.state.restrictedBidders]).toEqual([clients[1]!.sessionId]);
  });

  it("no ofrece saltar cuando se agota el margen", async () => {
    const { room, clients, hooks } = await startedRoom();
    // Adjudicar una carta: pasan a quedar 4 cartas y 3 jugadores por fichar,
    // asi que el margen sigue existiendo. Adjudicar otra deja 3 y 2: sigue.
    // El margen solo desaparece si se descarta, no si se adjudica.
    for (let i = 0; i < 2; i++) {
      clients[i]!.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.remainingCount).toBe(3);

    // Un descarte unanime quita una carta sin quitar un jugador -> margen agotado
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    for (const client of clients.slice(2)) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();

    expect(room.state.remainingCount).toBe(2);
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).not.toBe("SKIP_VOTE");
  });
});

describe("reveal y avance", () => {
  it("el reveal publica los campos privados de la carta adjudicada", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    (room as unknown as Hooks).onBidTimeout();
    await room.waitForNextPatch();

    // PublicCardSchema no lleva cardId (solo publicId opaco): la unica carta
    // revelada hasta ahora es la que se acaba de adjudicar.
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.name).toBeTruthy();
    expect(revealed?.rating).toBeGreaterThan(0);
    expect(revealed?.ownerId).toBe(clients[0]!.sessionId);
    expect(revealed?.price).toBe(5);
    expect(room.state.currentCard?.revealed).toBe(true);
  });

  it("pasa al siguiente hueco cuando todos han fichado el actual", async () => {
    const { room, clients, hooks } = await startedRoom();
    for (const client of clients) {
      client.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.currentSlot).toBe("LB");
    expect(room.state.remainingCount).toBe(5);
  });
});

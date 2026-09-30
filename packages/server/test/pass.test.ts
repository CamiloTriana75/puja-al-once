import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import type { Rng } from "@fut/shared";
import { DEFAULT_RULES } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onRevealTimeout(): void }

async function startedRoom(rng?: Rng) {
  const room = await colyseus.createRoom("auction", rng ? { rng } : {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients, hooks: room as unknown as Hooks };
}

describe("pass (D2)", () => {
  it("un solo pase no resuelve la carta", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("pass", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentBid).toBe(0);
    expect(room.state.remainingCount).toBe(5);
    expect(room.state.passes.get(clients[0]!.sessionId)).toBe(true);
    expect(room.state.passes.size).toBe(1);
  });

  it("cuando pasan todos los que necesitan el puesto y hay margen, se descarta al instante -- nunca SKIP_VOTE", async () => {
    const { room, clients } = await startedRoom();
    for (const client of clients.slice(0, 3)) {
      client.send("pass", {});
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("BIDDING"); // todavia falta alguien por pasar
    }

    clients[3]!.send("pass", {});
    await room.waitForNextPatch();

    // Se resuelve directo a REVEAL: nunca pasa por SKIP_VOTE.
    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.revealedCards.size).toBe(1);
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.ownerId).toBe("");
    expect(revealed?.price).toBe(0);
    expect(room.state.remainingCount).toBe(4);
  });

  it("el pase de quien ya ficho no bloquea: los demas resuelven al instante", async () => {
    // El mismo caso que se quedo colgado con el voto de salto: Ana se
    // adjudica la primera carta y ya no necesita GK, asi que su interfaz no
    // le deja pasar (Auction.tsx: `canPass` exige el hueco). Antes el quórum
    // de `pass` contaba tambien con ella y la carta se quedaba esperando.
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();
    expect(room.state.players.get(clients[0]!.sessionId)?.squad.get("GK")).toBeTruthy();
    expect(room.state.remainingCount).toBe(4);

    for (const [i, client] of clients.slice(1).entries()) {
      client.send("pass", {});
      await room.waitForNextPatch();
      // Solo los dos primeros dejan la carta viva; el tercero la resuelve.
      if (i < 2) expect(room.state.phase).toBe("BIDDING");
    }

    // El descarte ocurre sin llamar a onBidTimeout ni onRevealTimeout.
    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.remainingCount).toBe(3);
    expect([...room.state.revealedCards.values()].at(-1)?.ownerId).toBe("");
    expect(room.state.passes.get(clients[0]!.sessionId)).toBeUndefined();
  });

  it("cuando pasan todos y no queda margen, se sortea entre los elegibles", async () => {
    const rngFirst: Rng = () => 0; // el sorteo elige siempre al primer elegible
    const { room, clients } = await startedRoom(rngFirst);

    // Carta 1 (GK, 5 repartidas, 4 necesitan): pasar todos descarta con
    // margen de sobra. Deja remainingCards=4 === needing=4: margen a cero.
    for (const client of clients) client.send("pass", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.remainingCount).toBe(4);
    (room as unknown as { onRevealTimeout(): void }).onRevealTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.remainingCount).toBe(4);

    const forcedPrice = room.state.openingBid;
    for (const client of clients) client.send("pass", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    const revealed = [...room.state.revealedCards.values()].find((c) => c.price > 0);
    expect(revealed?.ownerId).toBe(clients[0]!.sessionId); // rngFirst -> primer elegible
    expect(revealed?.price).toBe(forcedPrice);
    const winner = room.state.players.get(clients[0]!.sessionId);
    expect(winner?.budget).toBe(DEFAULT_RULES.startingBudget - forcedPrice);
    expect(winner?.squad.get("GK")).toBeTruthy();
  });

  it("se ignora si ya hay una puja sobre la mesa", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();

    clients[1]!.send("pass", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
    expect(room.state.passes.size).toBe(0);
  });

  it("en fase restringida solo puede pasar quien esta en la lista; al pasar todos ellos, se descarta aunque haya margen", async () => {
    const { room, clients, hooks } = await startedRoom();
    hooks.onBidTimeout(); // nadie pujo: abre voto de salto (hay margen: 5 cartas, 4 necesitan)
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");

    // Ana y Bea votan saltar; Cid y Dan votan que no -- quedan como los
    // unicos autorizados a actuar en la reanudacion restringida.
    clients[0]!.send("voteSkip", { skip: true });
    clients[1]!.send("voteSkip", { skip: true });
    clients[2]!.send("voteSkip", { skip: false });
    clients[3]!.send("voteSkip", { skip: false });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentBid).toBe(0);
    expect([...room.state.restrictedBidders].sort()).toEqual(
      [clients[2]!.sessionId, clients[3]!.sessionId].sort(),
    );

    // Ana no esta en la lista restringida: su pase no cuenta para nada.
    clients[0]!.send("pass", {});
    await room.waitForNextPatch();
    expect(room.state.passes.size).toBe(0);
    expect(room.state.phase).toBe("BIDDING");

    // Cid (restringido) pasa: todavia falta Dan.
    clients[2]!.send("pass", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.passes.get(clients[2]!.sessionId)).toBe(true);

    // Dan (el otro restringido) pasa: los dos elegibles han pasado -> se
    // descarta directo, aunque en este punto siga habiendo margen de sobra
    // (5 cartas, 4 necesitan) -- en fase restringida siempre es descarte.
    clients[3]!.send("pass", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.ownerId).toBe("");
    expect(room.state.remainingCount).toBe(4);
  });

  it("closeWithoutBid ya no existe: enviarlo no hace nada", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("closeWithoutBid", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentBid).toBe(0);
    expect(room.state.remainingCount).toBe(5);
  });
});

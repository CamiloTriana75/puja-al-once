import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

/**
 * Superficie interna a la que el cliente real nunca llega: los tres relojes
 * (`protected`, invocados a mano para no depender de temporizadores reales
 * en los tests) y dos formas de resolver `publicId` a la identidad real de
 * la carta -- `silhouetteIdFor` (metodo publico, el mismo puente que usa la
 * ruta de siluetas de la Task 12) y `publicIdToCardId` (mapa privado, leido
 * aqui solo para que el test tenga un oraculo de identidad inequivoco; ver
 * el comentario en "el reveal publica..." sobre por que hace falta ademas
 * de `silhouetteIdFor`).
 */
interface RoomInternals {
  onBidTimeout(): void;
  onSkipTimeout(): void;
  onRevealTimeout(): void;
  silhouetteIdFor(publicId: string): string | undefined;
  publicIdToCardId: Map<string, string>;
}

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients, hooks: room as unknown as RoomInternals };
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
    // Identidad de la carta ANTES del reveal, por las dos vias que no
    // requieren cardId en el Schema. Sin esto el test solo comprueba que
    // "alguna" carta se revelo -- si enterReveal revelara la carta
    // siguiente en vez de la que esta descartando, esta asercion no lo
    // notaria y el test seguiria en verde.
    const pubId = room.state.currentCard!.publicId;
    const expectedCardId = hooks.publicIdToCardId.get(pubId);
    const expectedSil = hooks.silhouetteIdFor(pubId);

    hooks.onBidTimeout();
    await room.waitForNextPatch();

    for (const client of clients) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.revealedCards.size).toBe(1);
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.cardId).toBe(expectedCardId);
    expect(revealed?.silhouetteId).toBe(expectedSil);
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

  it("descarta directamente si el voto falla sin nadie en contra (solo abstenciones)", async () => {
    // Si la unanimidad falla pero nadie vota explicitamente "no" -- aqui,
    // tres a favor y uno que se abstiene -- resolveSkipVote devuelve
    // RESUMED con restrictedBidders vacio: reabrir BIDDING con esa lista
    // dejaria 15 s de reloj corriendo con la puja rechazando a todo el
    // mundo (NOT_ALLOWED_TO_BID), antes de terminar igualmente en
    // descarte. onSkipTimeout tiene que cortar directo al descarte.
    const { room, clients, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    clients[0]!.send("voteSkip", { skip: true });
    clients[1]!.send("voteSkip", { skip: true });
    clients[2]!.send("voteSkip", { skip: true });
    // clients[3] se abstiene: no manda voto. Sin esto pending.length nunca
    // llega a 0 dentro de onVoteSkip, asi que hace falta el hook explicito
    // para simular que se agotaron los 10 s con una abstencion pendiente.
    await room.waitForNextPatch();
    hooks.onSkipTimeout();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.revealedCards.size).toBe(1);
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.ownerId).toBe("");
  });
});

describe("reveal y avance", () => {
  it("el reveal publica los campos privados de la carta adjudicada", async () => {
    const { room, clients, hooks } = await startedRoom();
    // Igual que en "descarta la carta si el voto es unanime": se fija la
    // identidad de la carta ANTES del reveal por dos vias independientes.
    // `silhouetteId` por si solo no basta -- el dataset real tiene dos
    // cartas de Casillas (temporadas distintas) que comparten
    // silhouetteId, asi que ademas se cruza con el cardId real (leido del
    // mapa interno, nunca expuesto al cliente) para que la comprobacion
    // sea inequivoca pase lo que pase con el orden de reparto.
    const pubId = room.state.currentCard!.publicId;
    const expectedCardId = hooks.publicIdToCardId.get(pubId);
    const expectedSil = hooks.silhouetteIdFor(pubId);

    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    expect(room.state.revealedCards.size).toBe(1);
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.cardId).toBe(expectedCardId);
    expect(revealed?.silhouetteId).toBe(expectedSil);
    expect(revealed?.name).toBeTruthy();
    expect(revealed?.rating).toBeGreaterThan(0);
    expect(revealed?.ownerId).toBe(clients[0]!.sessionId);
    expect(revealed?.price).toBe(5);
    expect(room.state.currentCard?.revealed).toBe(true);
  });

  it("la carta siguiente de la ronda no hereda los datos revelados de la anterior", async () => {
    // La lista blanca de lobby.test.ts solo vigila la PRIMERA carta de la
    // partida -- antes de esta tarea nunca habia una segunda. Sin este
    // test, quitar el `currentCard = undefined` de advance() (o hacer que
    // projectState reutilice el nodo) deja pasar los 25 tests de este
    // paquete mientras la carta siguiente, todavia sin subastar, viaja al
    // navegador con el nombre y el rating de la que se acaba de revelar.
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentCard?.name).toBe("");
    expect(room.state.currentCard?.rating).toBe(0);
    expect(room.state.currentCard?.revealed).toBe(false);
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

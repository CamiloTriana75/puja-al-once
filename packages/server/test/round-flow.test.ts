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
      clients[i]!.send("bid", { amount: room.state.minimumBid });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.remainingCount).toBe(3);

    // Un descarte unanime quita una carta sin quitar un jugador -> margen agotado.
    // El voto de saltar es de sala entera (todos los conectados, no solo
    // quien todavia necesita el hueco): clients[0] y clients[1] ya ficharon
    // GK pero su voto sigue contando para la unanimidad.
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    for (const client of clients) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();

    expect(room.state.remainingCount).toBe(2);
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).not.toBe("SKIP_VOTE");
  });

  it("el voto de quien ya ficho el hueco NO cuenta: los que faltan resuelven al instante", async () => {
    // Ana ficha GK adjudicandose la primera carta; a partir de aqui ya no
    // "necesita" el hueco en juego (GK). En la votacion de salto de la
    // SEGUNDA carta de GK la deciden solo Bea, Cid y Dan.
    //
    // Este es el caso que reporto el jugador: los tres que faltan votan
    // saltar y la carta seguia sin saltarse. Era porque la unanimidad exigia
    // tambien el voto de Ana, que la interfaz no le deja emitir (Auction.tsx:
    // `canVoteSkip = !alreadySigned`), asi que la votacion
    // se quedaba colgada hasta que se agotaban los 10 s del reloj y el
    // descarte llegaba igualmente, por el camino largo.
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();
    expect(room.state.players.get(clients[0]!.sessionId)?.squad.get("GK")).toBeTruthy();
    // 4 cartas restantes, 3 jugadores por fichar (Bea/Cid/Dan): margen 4>3.
    expect(room.state.remainingCount).toBe(4);

    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");

    // Los tres que todavia necesitan GK votan saltar. No hace falta el cuarto
    // voto: sin llamar a onSkipTimeout, el descarte tiene que haber ocurrido ya
    // al ultimo `waitForNextPatch`.
    clients[1]!.send("voteSkip", { skip: true });
    clients[2]!.send("voteSkip", { skip: true });
    clients[3]!.send("voteSkip", { skip: true });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.remainingCount).toBe(3);
    expect([...room.state.revealedCards.values()].at(-1)?.ownerId).toBe("");
  });

  it("el voto de quien ya ficho no se guarda: el servidor ni lo cuenta ni lo escribe", async () => {
    // `onVoteSkip` solo admite votos de quien necesita el hueco, asi que el
    // mensaje de Ana se descarta en la puerta. Con el voto de Ana escrito en
    // `skipVotes` viaja al Schema y sale pintado en la lista de la votacion,
    // donde el jugador ve un "esperando" que el mismo no puede resolver.
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();

    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");

    clients[0]!.send("voteSkip", { skip: true });
    await room.waitForNextPatch();
    expect(room.state.skipVotes.get(clients[0]!.sessionId)).toBeUndefined();
    expect(room.state.phase).toBe("SKIP_VOTE");
  });

  it("resuelve el voto de salto cuando votan saltar todos los conectados", async () => {
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();
    expect(room.state.players.get(clients[0]!.sessionId)?.squad.get("GK")).toBeTruthy();

    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");

    for (const client of clients) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.remainingCount).toBe(3);
    expect([...room.state.revealedCards.values()].at(-1)?.ownerId).toBe("");
  });

  it("quien ya ficho el hueco puede romper la unanimidad votando en contra, sin acabar entre los restringidos", async () => {
    // Mismo reparto que el test anterior (Ana ficha GK, quedan 4 cartas y 3
    // necesitando: margen de sobra para un voto de salto). Si Ana vota EN
    // CONTRA del salto, su voto rompe la unanimidad igual que el de
    // cualquier otro conectado -- pero como ya tiene GK fichado nunca puede
    // acabar entre quienes pueden pujar la reanudacion restringida: eso
    // sigue siendo terreno exclusivo de quien de verdad necesita el hueco.
    const { room, clients, hooks } = await startedRoom();
    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();
    expect(room.state.remainingCount).toBe(4);

    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");
    clients[0]!.send("voteSkip", { skip: false }); // Ana: ya tiene GK, vota en contra
    clients[1]!.send("voteSkip", { skip: true });
    clients[2]!.send("voteSkip", { skip: true });
    clients[3]!.send("voteSkip", { skip: false }); // Dan: aun necesita GK, vota en contra
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect([...room.state.restrictedBidders]).toEqual([clients[3]!.sessionId]);
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

describe("mercado de transferencias", () => {
  it("pausa la partida al terminar el mediocampo y antes de abrir el extremo izquierdo", async () => {
    const { room, clients, hooks } = await startedRoom();

    // SLOTS = GK, LB, CB1, CB2, RB, CDM, CM, CAM, LW, ...: las 8 rondas de la
    // defensa y el mediocampo (0-7) se juegan enteras y al cerrar CAM entra el
    // mercado, justo antes del extremo izquierdo.
    for (let slotIndex = 0; slotIndex <= 7; slotIndex++) {
      for (const client of clients) {
        client.send("bid", { amount: room.state.minimumBid });
        await room.waitForNextPatch();
        hooks.onBidTimeout();
        await room.waitForNextPatch();
        hooks.onRevealTimeout();
        await room.waitForNextPatch();
      }
    }

    expect(room.state.slotIndex).toBe(7);
    expect(room.state.phase).toBe("TRANSFER_MARKET");
    expect(room.state.currentSlot).toBe("CAM");

    clients[0]!.send("market:continue", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("TRANSFER_MARKET");
    expect(room.state.marketReady.get(clients[0]!.sessionId)).toBe(true);

    for (const client of clients.slice(1)) {
      client.send("market:continue", {});
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.slotIndex).toBe(8);
    expect(room.state.currentSlot).toBe("LW");
  }, 60_000);

  it("crea una oferta visible para toda la sala y la acepta de forma atomica", async () => {
    const { room, clients } = await startedRoom();

    for (let slotIndex = 0; slotIndex <= 7; slotIndex++) {
      for (const client of clients) {
        client.send("bid", { amount: room.state.minimumBid });
        await room.waitForNextPatch();
        (room as unknown as RoomInternals).onBidTimeout();
        await room.waitForNextPatch();
        (room as unknown as RoomInternals).onRevealTimeout();
        await room.waitForNextPatch();
      }
    }
    for (const client of clients.slice(0, 3)) {
      client.send("market:continue", {});
      await room.waitForNextPatch();
    }

    const proposer = room.state.players.get(clients[0]!.sessionId)!;
    const recipient = room.state.players.get(clients[1]!.sessionId)!;
    const offeredCardId = proposer.squad.get("GK")!;
    const requestedCardId = recipient.squad.get("GK")!;
    const receivedOffer = new Promise<{ offerId: string }>((resolve, reject) => {
      clients[1]!.onMessage("trade:updated", resolve);
      clients[0]!.onMessage("trade:rejected", reject);
      clients[1]!.onMessage("trade:rejected", reject);
    });
    // El tercero no es parte de la oferta y no puede aceptarla ni rechazarla,
    // pero tiene que VERLA: el mercado es publico y la UI lo pinta en la lista
    // de confirmaciones para que todo el mundo sepa que se esta negociando.
    const watcher = new Promise<{ offerId: string; status: string }>((resolve) => {
      clients[3]!.onMessage("trade:updated", resolve);
    });

    clients[0]!.send("trade:create", {
      offerId: "offer-1",
      recipientId: clients[1]!.sessionId,
      offeredCardIds: [offeredCardId],
      requestedCardIds: [requestedCardId],
      proposerPays: 50,
    });
    await expect(receivedOffer).resolves.toMatchObject({ offerId: "offer-1", status: "OPEN" });
    await expect(watcher).resolves.toMatchObject({ offerId: "offer-1", status: "OPEN" });

    const acceptedByWatcher = new Promise<{ offerId: string; status: string }>((resolve) => {
      clients[3]!.onMessage("trade:updated", resolve);
    });
    clients[1]!.send("trade:accept", { offerId: "offer-1" });
    await expect(acceptedByWatcher).resolves.toMatchObject({ offerId: "offer-1", status: "ACCEPTED" });
    await room.waitForNextPatch();

    expect(room.state.players.get(clients[0]!.sessionId)?.squad.get("GK")).toBe(requestedCardId);
    expect(room.state.players.get(clients[1]!.sessionId)?.squad.get("GK")).toBe(offeredCardId);

    clients[3]!.send("market:continue", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");
  }, 60_000);
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

    const winningBid = room.state.minimumBid;
    clients[0]!.send("bid", { amount: winningBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    expect(room.state.revealedCards.size).toBe(1);
    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.cardId).toBe(expectedCardId);
    expect(revealed?.silhouetteId).toBe(expectedSil);
    expect(revealed?.name).toBeTruthy();
    // D3: el rating se oculta hasta RESULTS -- ni siquiera en la carta ya
    // adjudicada. El resto de campos privados (nombre, club, liga, nacion,
    // temporada, precio) si se publican en el reveal; solo el rating espera.
    expect(revealed?.rating).toBe(0);
    expect(room.state.currentCard?.rating).toBe(0);
    expect(revealed?.ownerId).toBe(clients[0]!.sessionId);
    expect(revealed?.price).toBe(winningBid);
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
    clients[0]!.send("bid", { amount: room.state.minimumBid });
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
      client.send("bid", { amount: room.state.minimumBid });
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

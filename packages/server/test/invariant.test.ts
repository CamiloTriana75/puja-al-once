import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { SLOTS } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onSkipTimeout(): void; onRevealTimeout(): void }

/**
 * La invariante que justifica el presupuesto bloqueado y el margen de salto:
 * jugando de la forma mas hostil posible — nadie puja nunca, todos votan
 * saltar siempre — ningun jugador conectado puede terminar con un hueco vacio.
 */
describe("invariante de plantilla completa", () => {
  it("nadie termina con huecos vacios aunque nadie puje jamas", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const hooks = room as unknown as Hooks;
    // Cota generosa: 11 huecos x 5 cartas, con margen para votos y reveals.
    for (let step = 0; step < 400 && room.state.phase !== "RESULTS"; step++) {
      if (room.state.phase === "BIDDING") {
        hooks.onBidTimeout();
      } else if (room.state.phase === "SKIP_VOTE") {
        for (const client of clients) client.send("voteSkip", { skip: true });
        await room.waitForNextPatch();
        hooks.onSkipTimeout();
      } else if (room.state.phase === "REVEAL") {
        hooks.onRevealTimeout();
      }
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("RESULTS");
    for (const player of room.state.players.values()) {
      for (const slot of SLOTS) {
        expect(player.squad.get(slot), `${player.name} sin ${slot}`).toBeTruthy();
      }
    }
  });
});

describe("invariante bajo reconexion a mitad de ronda", () => {
  /**
   * La reconexion puede romper la misma invariante por otra puerta: la
   * ronda reparte jugadores_conectados_al_empezar + 1 cartas, y
   * playersNeedingSlot solo cuenta conectados. Si alguien reconecta
   * (connected pasa a true) a mitad de ronda, "needing" puede subir por
   * encima de las cartas que ya se repartieron -- el mismo agujero que el
   * test de arriba nunca ejercita porque en el nadie se desconecta jamas.
   *
   * Este test construye el caso mas hostil para esa costura especifica:
   * Dan se desconecta antes de que la ronda de GK reparta nada (asi que esa
   * ronda se resuelve solo entre Ana/Bea/Cid), y luego, en la ronda de LB,
   * se gastan a proposito dos descartes unanimes que agotan el margen
   * (remainingCards === needing, exactamente) ANTES de que Dan reconecte.
   * Si su reingreso contara al instante, la siguiente resolucion forzaria
   * por sorteo entre 4 necesitados con solo 3 cartas sobre la mesa -- uno
   * de los cuatro se quedaria sin LB en silencio. Con el arreglo (el
   * reingreso se aparca hasta la frontera entre rondas, ver
   * AuctionRoom.onReconnected/flushPendingRejoins), Dan no cuenta como
   * necesitando hasta que la ronda de LB termina, asi que las tres cartas
   * que quedan se reparten limpio entre los tres que sí seguian dentro.
   */
  it("un reingreso a mitad de ronda no cuenta como necesitando hasta la ronda siguiente", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const hooks = room as unknown as Hooks;
    const active = [clients[0]!, clients[1]!, clients[2]!]; // Ana, Bea, Cid
    const danId = clients[3]!.sessionId;
    const danToken = clients[3]!.reconnectionToken;

    // Dan se cae ANTES de que se resuelva ninguna carta de GK: esa ronda
    // pasa a jugarse solo entre los otros tres.
    await clients[3]!.leave(false);
    await room.waitForNextPatch();
    expect(room.state.players.get(danId)?.connected).toBe(false);

    /** Resuelve la carta actual jugando lo mas hostil posible (nadie puja, todos saltan). */
    async function resolveOneCard() {
      if (room.state.phase === "BIDDING") {
        hooks.onBidTimeout();
        await room.waitForNextPatch();
        if (room.state.phase === "SKIP_VOTE") {
          for (const client of active) client.send("voteSkip", { skip: true });
          await room.waitForNextPatch();
          // El voto unanime de los 3 necesitados ya dispara el auto-resuelto
          // de onVoteSkip en la mayoria de los casos, pero por si el ultimo
          // voto no fue el que cerro la cuenta, se fuerza el timeout igual:
          // onSkipTimeout() es un no-op si la fase ya cambio.
          hooks.onSkipTimeout();
          await room.waitForNextPatch();
        }
      }
      if (room.state.phase === "REVEAL") {
        hooks.onRevealTimeout();
        await room.waitForNextPatch();
      }
    }

    // Agota GK para los tres conectados. drawRound reparte segun el TOTAL
    // de jugadores (4, Dan incluido aunque este desconectado) -- 5 cartas
    // -- pero needing solo cuenta a los tres: dos descartes unanimes agotan
    // el margen (5,3 -> 4,3 -> 3,3) y los tres forzados restantes reparten
    // GK entre Ana, Bea y Cid.
    while (room.state.currentSlot === "GK") await resolveOneCard();
    expect(room.state.currentSlot).toBe("LB");
    expect(room.state.players.get(danId)?.connected).toBe(false);

    // Ronda de LB: mismo reparto de 5 cartas, needing = 3 otra vez. Se
    // gastan EXACTAMENTE dos descartes unanimes a proposito -- eso deja
    // remainingCards === needing === 3, margen cero -- antes de reconectar.
    expect(room.state.remainingCount).toBe(5);
    for (let i = 0; i < 2; i++) {
      expect(room.state.phase).toBe("BIDDING");
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("SKIP_VOTE");
      for (const client of active) client.send("voteSkip", { skip: true });
      await room.waitForNextPatch();
      hooks.onSkipTimeout();
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("REVEAL");
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentSlot).toBe("LB"); // Sigue en LB: aun quedan 3 cartas para 3 necesitados.
    expect(room.state.remainingCount).toBe(3); // === needing en este punto: margen cero.

    // Dan reconecta justo en el peor momento: margen exactamente a cero,
    // con la tercera carta de LB todavia sin resolver.
    const reconnected = await colyseus.sdk.reconnect(danToken);
    await room.waitForNextPatch();
    expect(reconnected.sessionId).toBe(danId);
    // CARGA DE LA PRUEBA -- no borrar aunque parezca redundante con las
    // comprobaciones de huecos del final. Sin esta linea el test sigue
    // "pasando" contra una mutacion que marca conectado al instante tres de
    // cada cuatro veces: el sorteo forzado de mas abajo reparte entre 4
    // candidatos con solo 3 cartas, y si el que se queda corto es uno de
    // los tres originales (Ana/Bea/Cid) el bucle de huecos vacios del final
    // lo detecta -- pero si el sorteo deja corto al propio Dan, eso
    // coincide por pura casualidad con el patron que este test espera de
    // todos modos ("Dan sin GK ni LB"), y la mutacion pasaria colada. Esta
    // linea comprueba el mecanismo (el flag, en el instante exacto) en vez
    // del sintoma (quien queda corto), asi que es determinista pase lo que
    // pase en el sorteo. Sigue sin contar como conectado a efectos de
    // ronda: si esto fuera `true` aqui, needing subiria a 4 con solo 3
    // cartas en mesa.
    expect(room.state.players.get(danId)?.connected).toBe(false);
    // rejoinPending es la otra cara de la misma decision: distingue "se
    // cayo" de "volvio pero la ronda en curso todavia no lo cuenta" de cara
    // al navegador (ver PlayerSchema) -- ahora mismo Dan esta en el segundo
    // caso, no en el primero.
    expect(room.state.players.get(danId)?.rejoinPending).toBe(true);

    // Y si el propio Dan -- socket ya vivo -- intenta pujar mientras sigue
    // aparcado, el rechazo tiene que decirle la verdad en vez de
    // "desconectado", que seria falso para alguien que esta ahi mirando.
    const rejection = new Promise<{ reason: string }>((resolve) => {
      reconnected.onMessage("bid:rejected", resolve);
    });
    reconnected.send("bid", { amount: 2 });
    expect((await rejection).reason).toBe("REJOIN_PENDING");
    // El intento de puja no debe haber movido nada de la subasta en curso.
    expect(room.state.currentBidderId).toBe("");
    expect(room.state.remainingCount).toBe(3);

    // Termina LB. Si el invariante se hubiera roto, alguno de los tres
    // originales (o el propio Dan, segun a quien le tocara el sorteo)
    // quedaria sin LB en silencio y este bucle terminaria en CB1 con
    // remainingCount en un valor inconsistente en vez de agotarse limpio.
    while (room.state.currentSlot === "LB") await resolveOneCard();

    // A partir de aqui Dan vuelve a contar de verdad, en los dos sentidos.
    expect(room.state.currentSlot).toBe("CB1");
    expect(room.state.players.get(danId)?.connected).toBe(true);
    expect(room.state.players.get(danId)?.rejoinPending).toBe(false);
    clients[3] = reconnected; // la referencia vieja ya no tiene conexion.

    // Termina el resto de la partida lo mas hostil posible, los 4 conectados.
    for (let step = 0; step < 400 && room.state.phase !== "RESULTS"; step++) {
      if (room.state.phase === "BIDDING") {
        hooks.onBidTimeout();
      } else if (room.state.phase === "SKIP_VOTE") {
        for (const client of clients) client.send("voteSkip", { skip: true });
        await room.waitForNextPatch();
        hooks.onSkipTimeout();
      } else if (room.state.phase === "REVEAL") {
        hooks.onRevealTimeout();
      }
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("RESULTS");

    // Ana, Bea y Cid nunca se desconectaron: la invariante los cubre sin
    // excepcion, en las once posiciones.
    for (const client of active) {
      const player = room.state.players.get(client.sessionId)!;
      for (const slot of SLOTS) {
        expect(player.squad.get(slot), `${player.name} sin ${slot}`).toBeTruthy();
      }
    }

    // Dan estuvo fuera durante GK y LB -- esos dos huecos, y solo esos, se
    // quedan vacios (puntuan 0 pero no rompen a nadie mas).
    const dan = room.state.players.get(danId)!;
    const missing = SLOTS.filter((slot) => !dan.squad.get(slot));
    expect(missing).toEqual(["GK", "LB"]);
  });
});

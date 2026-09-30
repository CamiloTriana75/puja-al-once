import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

describe("kick (expulsion del anfitrion en la sala de espera)", () => {
  it("expulsa a un jugador del lobby y este recibe el aviso antes de caer", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    const host = clients[0]!;
    const victim = clients[1]!;
    const victimId = victim.sessionId;

    const message = victim.waitForMessage("kicked");
    host.send("kick", { playerId: victimId });
    const [kickedMessage] = await Promise.all([message, room.waitForNextPatch()]);

    expect(kickedMessage).toEqual({ reason: "KICKED" });
    expect(room.state.players.size).toBe(2);
    expect([...room.state.players.keys()]).not.toContain(victimId);
  });

  it("solo el anfitrion puede expulsar", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    const hostId = clients[0]!.sessionId;
    const playerId = clients[1]!.sessionId;

    // Cid intenta expulsar a Bea; Cid no es el anfitrion.
    clients[2]!.send("kick", { playerId });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(3);

    // El anfitrion no puede expulsarse a si mismo.
    clients[0]!.send("kick", { playerId: hostId });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(3);

    // El anfitrion a un id que no existe: silencio, nada cambia.
    clients[0]!.send("kick", { playerId: "no-existe" });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(3);
  });

  it("no expulsa a mitad de partida", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");

    clients[0]!.send("kick", { playerId: clients[1]!.sessionId });
    await room.waitForNextPatch();

    expect(room.state.players.size).toBe(3);
    expect(room.state.phase).toBe("BIDDING");
  });

  it("no envenena el ready de los que quedan: pueden arrancar al marcar listo ellos", async () => {
    // La victima estaba lista cuando la expulsan; @fut/ready limpia su
    // hueco y los tres que quedan siguen arrancando cuando TODOS marcan
    // listo. Si el kick dejara su ready en el mapa, no pasaria nada malo
    // (onLeave evalua solo contra los conectados), pero este test fija que
    // el boton de expulsar no rompe el flujo de arranque de la sala.
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }

    clients[2]!.send("ready", {});
    const victimId = clients[2]!.sessionId;
    clients[0]!.send("kick", { playerId: victimId });
    await room.waitForNextPatch();
    expect([...room.state.players.keys()]).not.toContain(victimId);

    for (const client of clients.filter((_, i) => i !== 2)) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.players.size).toBe(3);
  });
});
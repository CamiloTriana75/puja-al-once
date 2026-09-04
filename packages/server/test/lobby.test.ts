import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { DEFAULT_RULES, type CardSource } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

/** Campos que el navegador tiene permitido ver antes del reveal. Lista
 * blanca a proposito: si alguien anade un campo nuevo al Schema, este test
 * se rompe en vez de callarse -- una lista negra solo protege de las fugas
 * que su autor ya imagino. */
const PUBLIC_CARD_FIELDS = [
  "publicId", "slot", "heightCm", "foot", "ageBand", "continent", "decade",
  "revealed", "name", "season", "club", "league", "nation", "rating",
].sort();

function tinyGkCard(cardId: string): CardSource {
  return {
    cardId,
    name: cardId,
    season: 2020,
    birthYear: 1990,
    club: "Club",
    league: "League",
    nation: "ESP",
    slot: "GK",
    rating: 80,
    heightCm: 190,
    foot: "R",
    silhouetteId: cardId,
  };
}

describe("lobby", () => {
  it("admite cuatro jugadores y arranca en LOBBY", async () => {
    const room = await colyseus.createRoom("auction", {});
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      await colyseus.connectTo(room, { name });
    }
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.players.size).toBe(4);
    expect([...room.state.players.values()].map((p) => p.name)).toContain("Ana");
  });

  it("reparte jugadores + 1 candidatos y pasa a BIDDING cuando todos estan listos", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentSlot).toBe("GK");
    expect(room.state.remainingCount).toBe(5);
    expect(room.state.currentCard?.publicId).toBeTruthy();
  });

  it("no filtra ningun campo privado -- ni identificador -- de la carta antes del reveal", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const card = clients[0]!.state.currentCard;
    expect(Object.keys(card!.toJSON()).sort()).toEqual(PUBLIC_CARD_FIELDS);

    expect(card?.publicId).toBeTruthy();
    expect(card?.name).toBe("");
    expect(card?.rating).toBe(0);
    expect(card?.season).toBe(0);
    expect(card?.revealed).toBe(false);
  });

  it("cada jugador arranca con el presupuesto inicial", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });
    expect([...room.state.players.values()][0]?.budget).toBe(100);
  });

  it("no se queda bloqueado para siempre si alguien se va antes de arrancar", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }

    await clients[3]!.leave();
    await room.waitForNextPatch();
    // El jugador que se fue desaparece de verdad, no se queda fantasma.
    expect(room.state.players.size).toBe(3);

    for (const client of clients.slice(0, 3)) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
  });

  it("tambien arranca si los que quedan ya estaban listos antes de que el ultimo se fuera", async () => {
    // Orden inverso del test anterior: aqui los tres primeros marcan listo
    // MIENTRAS el cuarto sigue conectado (asi que la condicion de arranque
    // no se cumple todavia), y solo se cumple cuando el cuarto se va. Sin el
    // reintento en onLeave, nadie vuelve a evaluar la condicion y la sala se
    // queda encallada en LOBBY para siempre.
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }

    for (const client of clients.slice(0, 3)) {
      client.send("ready", {});
      await room.waitForMessage("ready");
    }
    expect(room.state.phase).toBe("LOBBY");

    await clients[3]!.leave();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
  });

  it("rechaza a un jugador nuevo si la partida ya empezo", async () => {
    const room = await colyseus.createRoom("auction", {});
    const ana = await colyseus.connectTo(room, { name: "Ana" });
    const bea = await colyseus.connectTo(room, { name: "Bea" });
    ana.send("ready", {});
    bea.send("ready", {});
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("BIDDING");

    await expect(colyseus.connectTo(room, { name: "Cid" })).rejects.toThrow();
    expect(room.state.players.size).toBe(2);
  });

  it("informa por mensaje si el mazo no alcanza, en vez de morir en silencio", async () => {
    // Dataset inyectado a proposito con menos cartas de GK de las que hacen
    // falta: 2 jugadores necesitan 3 candidatos y solo hay 1.
    const room = await colyseus.createRoom("auction", { dataset: [tinyGkCard("unico-gk")] });
    const clients = [];
    for (const name of ["Ana", "Bea"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }

    clients[0]!.send("ready", {});
    const [message] = await Promise.all([
      clients[0]!.waitForMessage("error"),
      (async () => clients[1]!.send("ready", {}))(),
    ]);

    expect(message.message).toMatch(/GK/);
    expect(room.state.phase).toBe("LOBBY");
  });

  it("ignora dataset/rng/rules inyectados fuera de test, sin avisar", async () => {
    // La costura de inyeccion de onCreate solo existe para poder testear en
    // aislamiento; fuera de NODE_ENV=test cualquier cliente podria crear una
    // sala con presupuesto inflado o un mazo trucado. Se fuerza otro valor
    // aqui para probar la puerta cerrada -- Vitest la deja en "test" siempre,
    // asi que hay que empujarla a mano y devolverla al terminar.
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const room = await colyseus.createRoom("auction", {
        rules: { ...DEFAULT_RULES, startingBudget: 999_999_999 },
      });
      await colyseus.connectTo(room, { name: "Ana" });

      expect([...room.state.players.values()][0]?.budget).toBe(DEFAULT_RULES.startingBudget);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

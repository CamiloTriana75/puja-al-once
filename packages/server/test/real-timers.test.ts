import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { DEFAULT_RULES, SLOTS, type Rules } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

/**
 * D1: el bug que este paquete de tests existe para demostrar es que, sin un
 * reloj real armado al abrir la carta, nada la mueve si nadie puja ni pasa
 * -- ni un mensaje, ni un hook. Los demas ficheros de este paquete llaman a
 * `onBidTimeout()`/`onSkipTimeout()`/`onRevealTimeout()` a mano, así que
 * NUNCA habrían detectado esa regresion: con `endsAt = 0` esos hooks siguen
 * disponibles y siguen funcionando si se invocan directamente. Este fichero
 * no llama a ninguno -- deja que `this.clock` (el de Colyseus, que avanza
 * con cada `broadcastPatch()` real, cada ~50ms por defecto) dispare los
 * timers él solo, con ventanas cortas pero de tiempo real.
 */
const REAL_RULES: Rules = {
  ...DEFAULT_RULES,
  openWindowMs: 500,
  antiSnipeMs: 250,
  skipVoteMs: 250,
  revealMs: 200,
  // Este fichero prueba relojes, no economia. Con el presupuesto real un
  // jugador que puja el minimo en cada carta se queda sin fondos a mitad de
  // partida, la carta se resuelve por timeout sola y el recuento de cartas
  // reveladas deja de cuadrar -- sin que el reloj tenga nada que ver.
  startingBudget: 999_999_999,
};

/** Poll de tiempo real hasta que `check()` sea verdad. Nunca llama a un hook. */
async function waitUntil(check: () => boolean, timeoutMs: number, description: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`waitUntil: tiempo agotado esperando ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("D1 -- ventana de apertura con reloj real, sin ningun hook manual", () => {
  it("una carta sin pujas ni pases se resuelve sola esperando tiempo real", async () => {
    const room = await colyseus.createRoom("auction", { rules: REAL_RULES });
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentBid).toBe(0);
    expect(room.state.remainingCount).toBe(5); // 4 jugadores + 1 de margen

    // Ni un mensaje (nadie puja, nadie pasa, nadie vota), ni un hook: solo
    // el paso del tiempo real. Encadena, sin intervencion, la ventana de
    // apertura (vence -> hay margen -> abre voto de salto), el voto de
    // salto (vence sin nadie votar -> sin nadie en contra -> descarte
    // directo) y el reveal.
    await waitUntil(() => room.state.revealedCards.size >= 1, 5_000, "a que la carta se revele sola");

    const revealed = [...room.state.revealedCards.values()][0];
    expect(revealed?.ownerId).toBe(""); // nadie pujo nunca: se descarta, no se adjudica
    expect(revealed?.price).toBe(0);
    expect(room.state.remainingCount).toBe(4); // la carta salio de la ronda ella sola
  }, 15_000);

  it("juega una partida entera a 4 sin intervencion manual de hooks, solo mensajes y tiempo", async () => {
    const room = await colyseus.createRoom("auction", { rules: REAL_RULES });
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    // Cada jugador puja el minimo en su propia carta: nadie mas puja
    // despues, asi que el anti-snipe real (250ms) la adjudica sola: sin
    // descartes ni sorteos, cada uno de los 4 se lleva un hueco por ronda.
    let resolved = 0;
    for (let slot = 0; slot < SLOTS.length; slot++) {
      for (const client of clients) {
        client.send("bid", { amount: room.state.minimumBid });
        resolved += 1;
        await waitUntil(() => room.state.revealedCards.size >= resolved, 3_000, `a que se resuelva la carta ${resolved}`);
        // Espera a que el reveal real (200ms) termine y la partida avance a
        // la siguiente carta (BIDDING) o, en la ultima, a RESULTS -- sin
        // esto la siguiente puja de este mismo bucle llegaria en fase
        // REVEAL y el servidor la rechazaria (WRONG_PHASE).
        await waitUntil(() => room.state.phase !== "REVEAL", 3_000, `a que la partida avance tras la carta ${resolved}`);
      }
    }

    await waitUntil(() => room.state.phase === "RESULTS", 5_000, "a que la partida llegue a RESULTS");
    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(4);
    // Cada uno de los 4 gano exactamente su propia puja en cada uno de los
    // 11 huecos: 44 cartas resueltas en total, ninguna por sorteo ni descarte.
    expect(room.state.revealedCards.size).toBe(SLOTS.length * clients.length);
  }, 60_000);
});

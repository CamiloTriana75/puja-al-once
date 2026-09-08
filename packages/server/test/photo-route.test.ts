import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

// Mismo puerto fijo que usa @colyseus/testing (ver vitest.config.ts) -- este
// es el unico fichero de test que habla HTTP de verdad con el servidor en
// vez de tocar la sala por dentro, porque el contrato que hay que probar
// (rechazo/aceptacion segun `revealedCards`, respuesta 404 indistinguible)
// vive en la ruta Express de packages/server/src/index.ts, no solo en el
// metodo que la resuelve.
const BASE_URL = "http://localhost:2568";

const PHOTOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/photos");

interface RoomInternals {
  onBidTimeout(): void;
  photoIdFor(publicId: string): string | undefined;
  silhouetteIdFor(publicId: string): string | undefined;
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

/** Escribe un fixture en PHOTOS_DIR y devuelve una funcion que restaura lo que hubiera antes. */
async function withPhotoFixture(silhouetteId: string, content: Buffer): Promise<() => Promise<void>> {
  await mkdir(PHOTOS_DIR, { recursive: true });
  const path = resolve(PHOTOS_DIR, `${silhouetteId}.png`);
  let previous: Buffer | undefined;
  try {
    previous = await readFile(path);
  } catch {
    previous = undefined;
  }
  await writeFile(path, content);
  return async () => {
    if (previous) await writeFile(path, previous);
    else await rm(path, { force: true });
  };
}

describe("GET /photos/:roomId/:publicId.png", () => {
  it("404 mientras la carta sigue en juego (sin revelar) -- ni siquiera si la foto existe en disco", async () => {
    const { room, hooks } = await startedRoom();
    const publicId = room.state.currentCard!.publicId;
    // La carta esta en la mesa pero no revelada: photoIdFor no debe resolverla,
    // a diferencia de silhouetteIdFor (que si acepta la carta vigente y por
    // eso sirve para construir el fixture con el nombre real de fichero).
    expect(hooks.photoIdFor(publicId)).toBeUndefined();
    const realSilhouetteId = hooks.silhouetteIdFor(publicId)!;
    expect(realSilhouetteId).toBeTruthy();

    // Aunque el fichero con el nombre correcto SI exista en disco, la ruta
    // tiene que rechazar la peticion antes de llegar a leerlo -- lo que se
    // prueba aqui es el filtro de fase (revealedCards), no la ausencia del
    // fichero.
    const cleanup = await withPhotoFixture(realSilhouetteId, Buffer.from("fixture"));
    try {
      const res = await fetch(`${BASE_URL}/photos/${room.roomId}/${publicId}.png`);
      expect(res.status).toBe(404);
    } finally {
      await cleanup();
    }
  });

  it("404 para una sala que no existe", async () => {
    const res = await fetch(`${BASE_URL}/photos/sala-que-no-existe/00000000-0000-0000-0000-000000000000.png`);
    expect(res.status).toBe(404);
  });

  it("404 para un publicId que no pertenece a la sala", async () => {
    const { room } = await startedRoom();
    const res = await fetch(`${BASE_URL}/photos/${room.roomId}/00000000-0000-0000-0000-000000000000.png`);
    expect(res.status).toBe(404);
  });

  it("acepta una carta ya revelada y sirve el fichero de data/photos/<silhouetteId>.png", async () => {
    const { room, clients, hooks } = await startedRoom();
    const publicId = room.state.currentCard!.publicId;

    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout(); // cierra la puja -> REVEAL, revealedCards gana la entrada
    await room.waitForNextPatch();

    const silhouetteId = hooks.photoIdFor(publicId);
    expect(silhouetteId).toBeTruthy();

    const fixtureContent = Buffer.from("fixture-foto-en-color");
    const cleanup = await withPhotoFixture(silhouetteId!, fixtureContent);
    try {
      const res = await fetch(`${BASE_URL}/photos/${room.roomId}/${publicId}.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/png");
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(fixtureContent)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("404 si la carta ya esta revelada pero no hay fichero en data/photos (silueta generica, sin foto real)", async () => {
    const { room, clients, hooks } = await startedRoom();
    const publicId = room.state.currentCard!.publicId;

    clients[0]!.send("bid", { amount: room.state.minimumBid });
    await room.waitForNextPatch();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    const silhouetteId = hooks.photoIdFor(publicId);
    expect(silhouetteId).toBeTruthy();

    // Se asegura de que no exista fixture para este id (por si una corrida
    // real del pipeline ya dejo una foto de verdad ahi).
    const path = resolve(PHOTOS_DIR, `${silhouetteId}.png`);
    let previous: Buffer | undefined;
    try {
      previous = await readFile(path);
      await rm(path, { force: true });
    } catch {
      previous = undefined;
    }
    try {
      const res = await fetch(`${BASE_URL}/photos/${room.roomId}/${publicId}.png`);
      expect(res.status).toBe(404);
    } finally {
      if (previous) await writeFile(path, previous);
    }
  });
});

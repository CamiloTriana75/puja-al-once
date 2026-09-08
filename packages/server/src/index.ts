import { matchMaker } from "@colyseus/core";
import config, { listen } from "@colyseus/tools";
import { static as expressStatic } from "express";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionRoom } from "./AuctionRoom.js";

// Ancladas al modulo, no al cwd -- mismo motivo que DATASET_PATH en
// AuctionRoom.ts: pnpm fija el cwd de cada paquete al ejecutar sus scripts.
const SILHOUETTES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/silhouettes");
const PHOTOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/photos");
const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

const app = config({
  initializeGameServer: (gameServer) => {
    gameServer.define("auction", AuctionRoom);
  },
  initializeExpress: (app) => {
    app.use((_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    });

    app.get("/time", (_req, res) => res.json({ now: Date.now() }));

    // NUNCA `express.static("data/silhouettes")`: el fichero real se llama
    // por el jugador (p.ej. "beckham-01.png") y servirlo por su nombre
    // filtraria el secreto de la subasta por la URL. En su lugar, ruta
    // dinamica que resuelve el identificador opaco `publicId` -- valido
    // solo dentro de SU sala -- contra el `silhouetteId` real en el
    // servidor. Sin roomId no hay forma de saber a que partida pertenece
    // ese publicId (no existe ningun registro global). Ver el contrato
    // completo en task-8-report.md.
    app.get("/silhouettes/:roomId/:publicId.png", async (req, res) => {
      const { roomId, publicId } = req.params;
      const room = matchMaker.getLocalRoomById(roomId) as AuctionRoom | undefined;
      // 404 generico en los tres casos (sala inexistente, publicId ajeno a
      // esa sala, o fichero ausente) -- distinguirlos en la respuesta le
      // daria a quien sondee una pista sobre cual de los tres fallo.
      if (!room || typeof room.silhouetteIdFor !== "function") {
        res.status(404).end();
        return;
      }
      const silhouetteId = room.silhouetteIdFor(publicId);
      if (!silhouetteId) {
        res.status(404).end();
        return;
      }
      try {
        const buffer = await readFile(resolve(SILHOUETTES_DIR, `${silhouetteId}.png`));
        res.header("Content-Type", "image/png");
        res.send(buffer);
      } catch {
        res.status(404).end();
      }
    });

    // Ruta hermana de la de arriba, para la foto real que sustituye a la
    // silueta en el reveal. Misma forma, mismo contrato de 404 generico --
    // pero resuelve `publicId` con `photoIdFor`, NUNCA con
    // `silhouetteIdFor`: esa acepta la carta en juego (adrede, para poder
    // pintar su silueta durante la puja) y esta solo puede aceptar cartas
    // YA REVELADAS. Si aceptara la carta vigente, abrir esta URL en otra
    // pestaña mientras la puja sigue abierta revelaria al jugador antes de
    // pujar -- ver el comentario de `photoIdFor` en AuctionRoom.ts.
    app.get("/photos/:roomId/:publicId.png", async (req, res) => {
      const { roomId, publicId } = req.params;
      const room = matchMaker.getLocalRoomById(roomId) as AuctionRoom | undefined;
      if (!room || typeof room.photoIdFor !== "function") {
        res.status(404).end();
        return;
      }
      const silhouetteId = room.photoIdFor(publicId);
      if (!silhouetteId) {
        res.status(404).end();
        return;
      }
      try {
        const buffer = await readFile(resolve(PHOTOS_DIR, `${silhouetteId}.png`));
        res.header("Content-Type", "image/png");
        res.send(buffer);
      } catch {
        // Sin foto real para este silhouetteId (silueta generica, o el
        // fichero no se genero): 404, igual que los demas fallos de esta
        // ruta -- el cliente ya sabe quedarse con la silueta si esto falla.
        res.status(404).end();
      }
    });

    // En produccion el cliente compilado se sirve desde este mismo proceso,
    // para que la pagina y el WebSocket compartan origen. Es lo que permite
    // exponer el juego por un unico tunel: con dos origenes distintos, el
    // navegador cargaria la pagina pero no podria abrir el socket.
    //
    // Va al final a proposito: registrado antes, el comodin de abajo se
    // tragaria /time y las rutas de imagenes.
    if (process.env.NODE_ENV === "production") {
      app.use(expressStatic(CLIENT_DIST));
      app.get("/{*splat}", (_req, res) => {
        res.sendFile("index.html", { root: CLIENT_DIST });
      });
    }
  },
});

// `config()` solo valida y devuelve las opciones -- no arranca nada por si
// solo (confirmado leyendo @colyseus/tools/build/index.js). Los tests
// importan este modulo por su export default y lo pasan a `boot()` de
// @colyseus/testing, que construye y escucha SU PROPIO servidor en el
// puerto 2568 fijo; si esta linea llamara a listen() sin condicion,
// cada test levantaria ademas un servidor real en el puerto 2567 (o
// chocaria entre ficheros de test en paralelo). Se guarda igual que el
// resto de costuras de test de este paquete: NODE_ENV=test, que Vitest fija
// por su cuenta, deja fuera esta llamada.
if (process.env.NODE_ENV !== "test") {
  void listen(app);
}

export default app;

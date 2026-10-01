import { matchMaker } from "@colyseus/core";
import config, { listen } from "@colyseus/tools";
import { json as expressJson, static as expressStatic } from "express";
import { appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionRoom } from "./AuctionRoom.js";
import { buildWebhookPayload, parseFeedback } from "./feedback.js";
import { clientAddress, isAllowedOrigin, maintenanceAction, RateLimiter, spaFallbackStatus, staticCacheControl } from "./requestPolicy.js";

// Ancladas al modulo, no al cwd -- mismo motivo que DATASET_PATH en
// AuctionRoom.ts: pnpm fija el cwd de cada paquete al ejecutar sus scripts.
const SILHOUETTES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/silhouettes");
const PHOTOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/photos");
const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
const publicListLimiter = new RateLimiter();
const roomLookupLimiter = new RateLimiter();
const feedbackLimiter = new RateLimiter();

// Los comentarios se anaden a un fichero JSONL y, si hay webhook, tambien se
// envian alli. En Render free el disco se borra en cada despliegue: el webhook
// (FEEDBACK_WEBHOOK_URL, compatible con Discord) es lo que los conserva.
const FEEDBACK_FILE = process.env.FEEDBACK_FILE ?? resolve(process.cwd(), "feedback.jsonl");

const app = config({
  initializeGameServer: (gameServer) => {
    gameServer.define("auction", AuctionRoom);
  },
  initializeExpress: (app) => {
    app.use((req, res, next) => {
      const origin = req.get("origin");
      const host = req.get("host");
      if (!isAllowedOrigin(origin, host)) {
        res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
        return;
      }
      res.header("Vary", "Origin");
      if (origin) res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      // Mantenimiento: MAINTENANCE_MODE=1 en el panel y reiniciar. Las partidas ya
      // abiertas siguen por su WebSocket; lo nuevo (paginas, salas, comentarios) recibe 503.
      const maintenance = maintenanceAction(req.path, process.env.MAINTENANCE_MODE === "1");
      if (maintenance) {
        res.setHeader("Retry-After", "300");
        res.setHeader("Cache-Control", "no-store");
        if (maintenance === "api") {
          res.status(503).json({ error: "MAINTENANCE" });
        } else {
          res.status(503).sendFile("mantenimiento.html", { root: CLIENT_DIST }, (err) => {
            if (err && !res.headersSent) res.type("text").send("Puja el Once está en mantenimiento. Vuelve en unos minutos.");
          });
        }
        return;
      }

      if (process.env.NODE_ENV === "production") {
        const address = clientAddress(req.headers, req.socket.remoteAddress);
        // 60/min y no 20/min porque la landing consulta /rooms/public cada
        // 10 s (ver screens/Landing.tsx): son 6 por minuto y cliente. Con
        // 20 el cuarto jugador en la misma IP -- cuatro amigos en una casa
        // comparten IP publica -- ya comia el limite entero y el
        // "vestuario publico" empieza a devolver 429. 60 son 10 clientes
        // detras de una misma IP, que es el caso real de este juego. El
        // endpoint es barato y ya pasa el filtro de origen.
        if (req.path === "/rooms/public" && !publicListLimiter.allow(address, 60, 60_000)) {
          res.setHeader("Retry-After", "60");
          res.status(429).json({ error: "RATE_LIMITED" });
          return;
        }
        if (/^\/rooms\/[^/]+$/.test(req.path) && req.path !== "/rooms/public" && !roomLookupLimiter.allow(address, 30, 60_000)) {
          res.setHeader("Retry-After", "60");
          res.status(429).json({ error: "RATE_LIMITED" });
          return;
        }
      }
      next();
    });

    app.get("/time", (_req, res) => res.json({ now: Date.now() }));
    app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
    app.get("/health/ready", (_req, res) => res.json({ status: "ok" }));

    // Comentarios de los jugadores. Cuerpo pequeno, limite por IP y campo trampa
    // contra bots; el filtro de origen de arriba tambien aplica.
    app.post("/feedback", expressJson({ limit: "8kb" }), async (req, res) => {
      const address = clientAddress(req.headers, req.socket.remoteAddress);
      if (!feedbackLimiter.allow(address, 5, 10 * 60_000)) {
        res.setHeader("Retry-After", "600");
        res.status(429).json({ error: "RATE_LIMITED" });
        return;
      }

      const parsed = parseFeedback(req.body);
      if (!parsed.ok) {
        // El campo trampa responde como si hubiera ido bien: el bot no aprende nada.
        if (parsed.error === "SPAM") {
          res.status(204).end();
          return;
        }
        res.status(400).json({ error: parsed.error });
        return;
      }

      const record = { at: new Date().toISOString(), ...parsed.entry };
      try {
        await appendFile(FEEDBACK_FILE, `${JSON.stringify(record)}
`, "utf8");
      } catch (error) {
        console.warn("[feedback] no se pudo escribir el fichero:", error);
      }
      console.log(`[feedback] ${record.kind}: ${record.message.replace(/\s+/g, " ").slice(0, 200)}`);

      const webhook = process.env.FEEDBACK_WEBHOOK_URL;
      if (webhook) {
        try {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildWebhookPayload(parsed.entry)),
            signal: AbortSignal.timeout(4000),
          });
        } catch (error) {
          console.warn("[feedback] el webhook no respondio:", error);
        }
      }
      res.status(201).json({ ok: true });
    });

    // Unicamente el lobby publico aparece aqui: no revela nombres ni estado
    // de cartas y omite salas vacias, llenas, privadas o ya iniciadas.
    app.get("/rooms/public", async (_req, res) => {
      const listings = await matchMaker.query({ name: "auction" });
      const rooms = listings.flatMap((listing) => {
        if (listing.metadata?.visibility !== "public") return [];
        const room = matchMaker.getLocalRoomById(listing.roomId) as AuctionRoom | undefined;
        if (!room || room.state.phase !== "LOBBY" || room.clients.length === 0 || room.clients.length >= room.maxClients) return [];
        const ready = [...room.state.players.values()].filter((player) => player.connected && player.ready).length;
        return [{
          roomId: listing.roomId,
          code: listing.metadata.code,
          players: room.clients.length,
          capacity: room.maxClients,
          ready,
        }];
      });
      rooms.sort((a, b) => b.players - a.players || String(a.code).localeCompare(String(b.code)));
      res.json({ rooms });
    });

    // Resuelve el codigo de sala (dictado por voz, ver
    // `@fut/shared/roomCode.ts`) al `roomId` interno que hace falta para
    // `client.joinById`. Al contrario que /silhouettes y /photos, aqui SI
    // conviene distinguir el motivo del rechazo: el codigo de sala no es
    // secreto, y decirle a quien intenta entrar "esta llena" en vez de "no
    // existe" en vez de "ya empezo" es justo la informacion que necesita
    // para decidir que hacer (esperar, pedir otro codigo, o nada).
    //
    // matchMaker.query en vez de matchMaker.getLocalRoomById directo: no
    // hay forma de ir de codigo a roomId sin antes buscar por metadata
    // entre las salas vivas. Una vez encontrado el roomId, se reutiliza el
    // mismo patron que /silhouettes y /photos para leer el estado en vivo y
    // decidir el motivo exacto.
    app.get("/rooms/:code", async (req, res) => {
      const code = req.params.code.toUpperCase();
      const listings = await matchMaker.query({ name: "auction" });
      const listing = listings.find((room) => room.metadata?.code === code);
      if (!listing) {
        res.status(404).json({ reason: "NOT_FOUND" });
        return;
      }

      const room = matchMaker.getLocalRoomById(listing.roomId) as AuctionRoom | undefined;
      // Defensa en profundidad: el listing pudo sobrevivir un instante a la
      // sala real disponiendose (misma ventana que ya cubren /silhouettes y
      // /photos con su propio `if (!room)`). Sin sala real que consultar,
      // lo mas honesto es tratarlo como si no existiera -- no hay fase que
      // leer para decidir FULL o STARTED.
      if (!room) {
        res.status(404).json({ reason: "NOT_FOUND" });
        return;
      }

      // STARTED antes que FULL: una partida en curso con un asiento vacio a
      // media ronda (alguien se desconecto, Task 11) no esta "llena" en el
      // sentido que le importa a quien pregunta -- no puede entrar de todos
      // modos porque la partida ya arranco. El orden de estos dos `if`
      // decide cual de los dos motivos gana cuando ambos serian ciertos.
      if (room.state.phase !== "LOBBY") {
        res.status(409).json({ reason: "STARTED" });
        return;
      }
      if (room.clients.length >= room.maxClients) {
        res.status(409).json({ reason: "FULL" });
        return;
      }

      res.json({ roomId: listing.roomId });
    });

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

    // En RESULTS la ceremonia ya conoce los `cardId` de cada plantilla. Esta
    // ruta permite cargar sus fotos en una sola vista y mantiene la misma
    // frontera de privacidad: solo existe resolución si la carta ya está en
    // `revealedCards`; el identificador de una carta aún en subasta responde
    // con el mismo 404 genérico.
    app.get("/photos/revealed/:roomId/:cardId.png", async (req, res) => {
      const { roomId, cardId } = req.params;
      const room = matchMaker.getLocalRoomById(roomId) as AuctionRoom | undefined;
      if (!room || typeof room.photoIdForRevealedCard !== "function") {
        res.status(404).end();
        return;
      }

      const photoId = room.photoIdForRevealedCard(cardId);
      if (!photoId) {
        res.status(404).end();
        return;
      }

      try {
        const buffer = await readFile(resolve(PHOTOS_DIR, `${photoId}.png`));
        res.header("Content-Type", "image/png");
        res.send(buffer);
      } catch {
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
      // Cache-Control por tipo de fichero (ver staticCacheControl): inmutable para
      // /assets con hash, revalidacion para paginas, service worker y manifiesto.
      // `setHeaders` de express.static corre solo cuando hay un fichero que servir,
      // asi que no toca las respuestas JSON ni las imagenes de cartas.
      app.use(
        expressStatic(CLIENT_DIST, {
          etag: true,
          cacheControl: false,
          setHeaders: (res, filePath) => {
            const relative = filePath.slice(CLIENT_DIST.length).replace(/\\/g, "/");
            res.setHeader("Cache-Control", staticCacheControl(relative));
          },
        }),
      );
      app.get("/{*splat}", (req, res) => {
        // 404 de verdad para lo que parece un fichero inexistente, 200 para
        // el resto (las salas van por ruta limpia y tienen que servir la
        // app). Ver spaFallbackStatus: sin esto, cada errata y cada escaneo
        // de bot se covertia en una pagina duplicada indexable.
        res.status(spaFallbackStatus(req.path)).sendFile("index.html", { root: CLIENT_DIST });
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

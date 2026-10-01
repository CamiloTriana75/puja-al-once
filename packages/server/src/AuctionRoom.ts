import { Client, Room, type AuthContext } from "@colyseus/core";
import type { Delayed } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import {
  acceptTradeOffer, applyBid, applyOutcome, canBid, cardsBySlot, createTradeOffer, currentCardId, DEFAULT_RULES, generateRoomCode, openingBidForRating,
  parseDataset, playersEligibleToPass, playersNeedingSlot, resolveAuction, resolvePass,
  resolveSkipVote, scoreMatch,
  SLOTS, toPrivate, toPublic,
  type AuctionOutcome, type AuctionState, type CardSource, type Rng, type Rules, type Slot, type TradeOffer,
} from "@fut/shared";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionRoomState, RevealedCardSchema, StandingSchema } from "./schema.js";
import { projectState } from "./project.js";
import { drawRound } from "./setup.js";
import { clientAddress, isAllowedOrigin, RateLimiter } from "./requestPolicy.js";

// Ruta anclada al modulo, no al cwd: `pnpm --filter @fut/server test` (y
// `pnpm -r test` desde la raiz) ejecutan con cwd = packages/server, asi que
// una ruta relativa tipo "data/players.json" no encontraria el dataset.
const DATASET_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/players.json");
const DEFAULT_DATASET: CardSource[] = parseDataset(JSON.parse(readFileSync(DATASET_PATH, "utf8")));
const matchmakeLimiter = new RateLimiter();

/**
 * Indices de `SLOTS` ANTES de los que se abre un mercado de traspasos. Hay dos
 * por partida:
 *  - 5 (CDM): al cerrar la DEFENSA (el hueco 4 = RB), antes del mediocampo.
 *  - 8 (LW): al cerrar el MEDIOCAMPO (el hueco 7 = CAM), antes del ataque.
 *
 * `advance()` entra al mercado cuando el siguiente hueco esta en este
 * conjunto, y `onMarketContinue` reanuda la partida en `slotIndex + 1`: el
 * mercado deja `slotIndex` en el ultimo hueco cerrado, asi que el cruce se
 * decide en un solo sitio y no puede desincronizarse entre abrir y reanudar.
 */
const TRANSFER_MARKET_SLOT_INDEXES: ReadonlySet<number> = new Set([5, 8]);

export interface AuctionRoomOptions {
  /** La privacidad es explícita; todas las creaciones conservan el valor privado por defecto. */
  visibility?: "private" | "public";
  /** Solo para tests: sustituye el dataset real por uno pequeno y controlado. */
  dataset?: CardSource[];
  /** Solo para tests: fuente de azar determinista. */
  rng?: Rng;
  rules?: Rules;
}

export class AuctionRoom extends Room<AuctionRoomState> {
  maxClients = 4;

  /** Fuente de verdad. El Schema es solo su proyeccion publica. */
  private game: AuctionState = {
    phase: "LOBBY",
    slotIndex: 0,
    remainingCards: [],
    currentBid: 0,
    currentBidderId: null,
    openingBid: 0,
    bidHistory: [],
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    passes: {},
    marketReady: {},
    players: [],
  };

  private rules: Rules = DEFAULT_RULES;
  private rng: Rng = Math.random;
  private ready = new Set<string>();
  private usedCards = new Set<string>();
  /**
   * Jugadores cuyo `allowReconnection` se resolvio a mitad de una ronda. No
   * se marcan `connected = true` al momento -- ver el comentario grande en
   * advance() -- se aparcan aqui hasta que esa ronda cruce su siguiente
   * frontera, momento en el que flushPendingRejoins() los aplica de verdad.
   */
  private pendingRejoins = new Set<string>();

  private bySlot: Record<Slot, CardSource[]> = cardsBySlot([]);
  private byId = new Map<string, CardSource>();

  /**
   * publicId <-> cardId de ESTA partida. El cardId (y con el, jugador y
   * temporada) es la respuesta, asi que no puede viajar en el Schema ni ser
   * estable entre partidas -- un publicId estable permitiria construir una
   * tabla de equivalencias jugando varias veces. Vive fuera del Schema,
   * igual que las cartas privadas (`byId`).
   */
  private cardIdToPublicId = new Map<string, string>();
  private publicIdToCardId = new Map<string, string>();

  /** Reloj de cierre de la subasta vigente. Nunca hay dos vivos a la vez. */
  private timer: Delayed | undefined;
  private tradeOffers = new Map<string, TradeOffer>();

  /**
   * Ultimo timestamp (Date.now()) en que cada `sessionId` mando una reaccion
   * valida -- limite de frecuencia (D8, contrato en
   * docs/superpowers/plans/2026-09-25-alpha.md): 1 cada 600 ms por cliente.
   * Vive fuera de `this.game`/`this.state` a proposito: no es informacion de
   * partida, es puramente anti-spam de la conexion, igual que
   * `pendingRejoins` o `usedCards` -- nada de esto pertenece al Schema
   * sincronizado ni a la fuente de verdad de la partida.
   */
  private lastReactionAt = new Map<string, number>();

  /**
   * Reasigna publicId aleatorios a todo `this.byId` (el dataset de ESTA
   * sala no cambia entre partidas, solo sus identificadores opacos). Se
   * llama al crear la sala y, tal cual, en cada revancha (D5): reutilizar
   * los publicId de la partida anterior permitiria correlacionar cartas
   * entre las dos y reconstruir informacion que la primera partida ya
   * revelo -- ver el comentario de `cardIdToPublicId` arriba.
   */
  private assignFreshPublicIds(): void {
    this.cardIdToPublicId.clear();
    this.publicIdToCardId.clear();
    // Se asignan todos de golpe: son 110 cartas como mucho, y asi
    // projectState solo necesita leer el mapa, nunca escribirlo.
    for (const card of this.byId.values()) {
      const publicId = randomUUID();
      this.cardIdToPublicId.set(card.cardId, publicId);
      this.publicIdToCardId.set(publicId, card.cardId);
    }
  }

  async onCreate(options?: AuctionRoomOptions): Promise<void> {
    // `options` es exactamente lo que el cliente manda en `client.create(...)`
    // -- Colyseus no filtra nada. Fuera de test, cualquiera podria crear una
    // sala con presupuesto inflado o un mazo trucado y meter a otros
    // jugadores en una partida amanada sin que lo sepan. La costura de
    // inyeccion solo existe para poder testear drawRound/projectState en
    // aislamiento: se ignora en silencio (sin lanzar, para no dar pistas a
    // quien sondee) fuera de NODE_ENV=test, que Vitest fija por su cuenta.
    const testOverridesAllowed = process.env.NODE_ENV === "test";
    const dataset = (testOverridesAllowed ? options?.dataset : undefined) ?? DEFAULT_DATASET;
    this.rng = (testOverridesAllowed ? options?.rng : undefined) ?? Math.random;
    this.rules = (testOverridesAllowed ? options?.rules : undefined) ?? DEFAULT_RULES;

    this.bySlot = cardsBySlot(dataset);
    this.byId = new Map(dataset.map((card) => [card.cardId, card]));
    this.assignFreshPublicIds();

    this.setState(new AuctionRoomState());

    // Codigo de sala: opuesto al `publicId` de las cartas. Aquel es secreto
    // y aleatorio por partida para que el navegador no pueda saber que
    // futbolista es antes del reveal; este existe justo para lo contrario,
    // compartirse en voz alta o por URL, asi que viaja en claro en el
    // estado. Nunca se reutiliza `this.roomId` (el identificador interno de
    // Colyseus) para esto: ese ya se usa en la ruta de imagenes
    // (`/silhouettes/:roomId/...`), y mezclar los dos identificadores
    // opacos -- uno que hay que ocultar, otro que hay que anunciar --
    // acabaria filtrando por la URL algo que uno de los dos necesita
    // ocultar. this.rng ya esta fijado arriba (Math.random fuera de test),
    // asi que generateRoomCode nunca llama a Math.random por su cuenta --
    // packages/shared tiene prohibido hacerlo.
    this.state.roomCode = generateRoomCode(this.rng);
    this.state.visibility = options?.visibility === "public" ? "public" : "private";
    // setMetadata(), no una propiedad suelta en `this.listing`: es la API
    // publica y estable de Colyseus para datos consultables de la sala (ver
    // el metodo GET /rooms/:code en index.ts, que resuelve por aqui via
    // matchMaker.query). `filterBy` habria sido la alternativa, pero solo
    // sabe leer valores que el CLIENTE manda en clientOptions al crear --
    // aqui el codigo lo inventa el SERVIDOR dentro de onCreate, asi que
    // filterBy nunca podria verlo a tiempo.
    await this.setMetadata({ code: this.state.roomCode, visibility: this.state.visibility });

    this.onMessage("ready", (client) => this.onReady(client));
    this.onMessage("bid", (client, message: { amount?: unknown }) => {
      this.onBid(client, message?.amount);
    });
    this.onMessage("pass", (client) => this.onPass(client));
    this.onMessage("voteSkip", (client, message: { skip?: unknown }) => {
      this.onVoteSkip(client, message?.skip === true);
    });
    this.onMessage("rematch", (client) => this.onRematch(client));
    this.onMessage("react", (client, message: { emoji?: unknown }) => {
      this.onReact(client, message?.emoji);
    });
    this.onMessage("market:continue", (client) => this.onMarketContinue(client));
    this.onMessage("trade:create", (client, message: unknown) => this.onTradeCreate(client, message));
    this.onMessage("trade:accept", (client, message: unknown) => this.onTradeAccept(client, message));
    this.onMessage("trade:cancel", (client, message: unknown) => this.onTradeCancel(client, message));
    this.onMessage("kick", (client, message: unknown) => this.onKick(client, message));
    this.sync();
  }

  static async onAuth(_token: string, _options: unknown, context: AuthContext): Promise<boolean> {
    const origin = context.headers.origin;
    const originValue = Array.isArray(origin) ? origin[0] : origin;
    const host = context.headers.host;
    if (!isAllowedOrigin(originValue, host)) throw new Error("Origen no permitido");

    if (process.env.NODE_ENV === "production") {
      const address = clientAddress(context.headers, context.ip);
      if (!matchmakeLimiter.allow(address, 60, 60_000)) throw new Error("Demasiadas solicitudes; inténtalo de nuevo en un minuto");
    }
    return true;
  }

  onJoin(client: Client, options?: { name?: string }): void {
    if (this.game.phase !== "LOBBY") {
      // Sin esto, un asiento liberado a mitad de partida (maxClients=4 pero
      // menos jugadores conectados) deja entrar a alguien nuevo con
      // presupuesto completo a una ronda que ya se repartio para menos
      // jugadores -- la siguiente ronda pediria mas cartas de las que hay.
      throw new Error("La partida ya ha empezado");
    }
    // El primero en entrar es el anfitrion. onLeave migra este campo al
    // siguiente conectado si el anfitrion se va antes de que empiece la
    // partida -- ver el comentario grande alli.
    if (this.state.hostId === "") this.state.hostId = client.sessionId;

    const safeName = typeof options?.name === "string"
      ? options.name.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, 18)
      : "";
    this.game.players.push({
      playerId: client.sessionId,
      name: safeName || `Jugador ${this.game.players.length + 1}`,
      budget: this.rules.startingBudget,
      squad: {},
      connected: true,
    });
    this.sync();
  }

  async onLeave(client: Client, consented?: boolean): Promise<void> {
    if (this.game.phase === "LOBBY") {
      // En el lobby no hay partida a la que reconectarse: si solo se marca
      // "connected = false" el jugador se queda fantasma en game.players y
      // "ready" compara para siempre contra un asiento que nunca volvera.
      this.game.players = this.game.players.filter((p) => p.playerId !== client.sessionId);
      this.ready.delete(client.sessionId);
      // El anfitrion se va antes de que arranque la partida: migra al
      // siguiente conectado, en el mismo orden en que estan en
      // game.players (quien lleva mas tiempo esperando). Si no queda
      // nadie, hostId vuelve a "" -- el proximo en entrar por onJoin lo
      // recoge igual que el primer anfitrion de todos.
      if (this.state.hostId === client.sessionId) {
        this.state.hostId = this.game.players[0]?.playerId ?? "";
      }
      this.sync();
      // Simetrico al caso de onReady: si los que quedan ya estaban TODOS
      // listos antes de que este se fuera, nadie mas va a volver a marcar
      // "ready" -- sin este reintento la sala se queda encallada igual,
      // solo que por el otro lado.
      this.tryStartRound();
      return;
    }

    this.setConnected(client.sessionId, false);
    // Por si quedaba un reingreso aparcado de un ciclo de desconexion
    // anterior DENTRO DE LA MISMA RONDA (reconecto y volvio a caerse antes
    // de que esa ronda cruzara su siguiente frontera): sin este borrado,
    // flushPendingRejoins lo marcaria conectado aunque ahora mismo este
    // fuera de verdad.
    this.pendingRejoins.delete(client.sessionId);
    this.sync();

    if (consented) return; // Se fue a proposito: no se ofrece reconexion.

    // onReconnected() queda FUERA del try: esta linea solo captura el
    // fracaso de allowReconnection (no volvio dentro del margen). Si
    // onReconnected (via setConnected/sync -> projectState) lanzara por
    // cualquier motivo legitimo, meterlo dentro del try lo confundiria con
    // "no volvio" y el jugador se quedaria desconectado para siempre sin
    // una sola linea de log.
    let returned = false;
    try {
      await this.allowReconnection(client, this.rules.reconnectSeconds);
      returned = true;
    } catch {
      // No volvio dentro del margen (rules.reconnectSeconds): sus huecos
      // quedan vacios y suman 0 -- scoreMatch nunca puntua un hueco sin
      // cardId, y playersNeedingSlot ya lo excluye por seguir desconectado.
    }
    if (returned) this.onReconnected(client.sessionId);
  }

  /**
   * Aplica un `allowReconnection` que acaba de resolverse.
   *
   * Si la partida ya esta en RESULTS no hay ninguna ronda que proteger: se
   * marca conectado al momento. Si hay una ronda en curso, NO se marca
   * todavia -- se aparca en pendingRejoins hasta que advance() cruce la
   * siguiente frontera entre rondas. Mientras tanto el jugador ve la
   * partida (su cliente ya recibe patches) pero sigue contando como
   * desconectado para canBid y playersNeedingSlot: puede mirar, no puja en
   * la ronda en curso. Ver el comentario grande en advance() para el porque.
   *
   * Las dos ramas sincronizan: aunque la rama de aparcar no toca
   * `connected`, si cambia `rejoinPending` (via pendingRejoins, que
   * projectState lee en cada sync) -- sin el sync aqui el navegador seguiria
   * viendo al jugador como "caido" en vez de "aparcado" hasta el proximo
   * cambio de estado que sea por otro motivo.
   */
  private onReconnected(playerId: string): void {
    if (this.game.phase === "RESULTS") {
      this.setConnected(playerId, true);
      this.sync();
      return;
    }
    this.pendingRejoins.add(playerId);
    this.sync();
  }

  /**
   * Aplica los reingresos aparcados por onReconnected(). Solo se llama
   * desde la frontera segura entre rondas, en advance(): nunca a mitad de
   * una. No sincroniza por si misma -- igual que setConnected(), a quien
   * llama le toca hacerlo -- y aqui el llamador (startRound u openBidding,
   * via finish() o startRound()) sincroniza enseguida de todos modos.
   */
  private flushPendingRejoins(): void {
    for (const playerId of this.pendingRejoins) this.setConnected(playerId, true);
    this.pendingRejoins.clear();
  }

  /** Copia el estado puro sobre el Schema. Se llama tras cada cambio. */
  protected sync(): void {
    projectState(
      this.game, this.state, this.rules, this.byId, this.cardIdToPublicId, this.pendingRejoins, this.ready,
    );
  }

  protected setConnected(playerId: string, connected: boolean): void {
    const player = this.game.players.find((p) => p.playerId === playerId);
    if (player) player.connected = connected;
  }

  private onReady(client: Client): void {
    if (this.game.phase !== "LOBBY") return;
    this.ready.add(client.sessionId);
    // Sincroniza SIEMPRE, no solo cuando tryStartRound() decide arrancar la
    // ronda -- startRound()/openBidding() ya hacen su propio sync() para el
    // caso en que el ultimo "ready" complete el quorum, pero si TODAVIA
    // falta gente, esta linea es la unica que empuja el "listo" nuevo a los
    // demas clientes. Sin ella, tres jugadores que ya pulsaron listo se
    // quedan viendo la lista sin cambios hasta que un cuarto evento
    // cualquiera fuerce otro sync -- indistinguible, para ellos, de un
    // boton que no hace nada.
    this.sync();
    this.tryStartRound();
  }

  /**
   * Arranca la ronda si el lobby cumple la condicion de arranque; si no, no
   * hace nada. La llaman tanto "ready" como "leave": la condicion tiene que
   * volver a evaluarse en las dos direcciones, porque cualquiera de las dos
   * puede ser la que la cumpla por ultima vez (alguien pulsa listo el
   * ultimo, o alguien se va y deja a los demas ya listos de antes).
   */
  private tryStartRound(): void {
    if (this.game.phase !== "LOBBY" || !this.allConnectedPlayersReady()) return;

    try {
      this.startRound(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo arrancar la ronda";
      this.broadcast("error", { message });
      // Sin esto la sala queda encallada para siempre: this.ready ya esta
      // lleno, asi que ningun "ready" futuro volveria a intentar arrancar.
      this.ready.clear();
    }
  }

  /** Todos los jugadores conectados han pulsado "ready", con un minimo de dos. */
  private allConnectedPlayersReady(): boolean {
    const connectedPlayers = this.game.players.filter((p) => p.connected);
    return connectedPlayers.length >= 2 && connectedPlayers.every((p) => this.ready.has(p.playerId));
  }

  /** Arranca la ronda del hueco `slotIndex` repartiendo jugadores + 1 candidatos. */
  protected startRound(slotIndex: number): void {
    // drawRound puede lanzar (mazo insuficiente): se calcula ANTES de tocar
    // this.game. Si se asignara slotIndex primero y luego lanzara, sync()
    // nunca correria y el estado quedaria a medio actualizar en silencio.
    const remainingCards = drawRound(
      this.bySlot,
      SLOTS[slotIndex]!,
      this.game.players.length,
      this.rng,
      this.usedCards,
    );
    this.game.slotIndex = slotIndex;
    this.game.remainingCards = remainingCards;
    void this.lock();
    this.openBidding();
  }

  /**
   * Pone una carta a subasta y arma la ventana de apertura (D1): si nadie
   * puja antes de que venza, `onBidTimeout` resuelve exactamente igual que
   * si hubiera vencido el anti-snipe -- voto de salto si hay margen, sorteo
   * si no. Antes de este arreglo `endsAt` se dejaba en 0 y ninguna carta sin
   * pujas avanzaba sola; ver el informe de esta tarea (D1) para el bug que
   * esto cierra y el test con reloj real que lo demuestra.
   */
  protected openBidding(): void {
    const cardId = currentCardId(this.game);
    if (!cardId) throw new Error("openBidding sin carta sobre la mesa");
    const card = this.byId.get(cardId);
    if (!card) throw new Error(`cardId desconocido al abrir subasta: ${cardId}`);

    this.game.phase = "BIDDING";
    this.game.currentBid = 0;
    this.game.currentBidderId = null;
    this.game.openingBid = openingBidForRating(card.rating, this.rules);
    this.game.bidHistory = [];
    this.game.skipVotes = {};
    this.game.restrictedBidders = null;
    this.game.passes = {}; // D2: quien paso la carta anterior no cuenta para esta.
    this.game.endsAt = Date.now() + this.rules.openWindowMs;
    this.armTimer(this.rules.openWindowMs);
    this.sync();
  }

  private enterTransferMarket(): void {
    this.timer?.clear();
    this.game.phase = "TRANSFER_MARKET";
    this.game.remainingCards = [];
    this.game.currentBid = 0;
    this.game.currentBidderId = null;
    this.game.openingBid = 0;
    this.game.bidHistory = [];
    this.game.endsAt = 0;
    this.game.marketReady = {};
    this.tradeOffers.clear();
    this.sync();
  }

  private onMarketContinue(client: Client): void {
    if (this.game.phase !== "TRANSFER_MARKET") return;
    const player = this.game.players.find((candidate) => candidate.playerId === client.sessionId);
    if (!player?.connected) return;

    this.game.marketReady = { ...(this.game.marketReady ?? {}), [client.sessionId]: true };
    this.sync();

    const connectedPlayers = this.game.players.filter((candidate) => candidate.connected);
    if (connectedPlayers.every((candidate) => this.game.marketReady?.[candidate.playerId] === true)) {
      this.game.marketReady = {};
      this.startRound(this.game.slotIndex + 1);
    }
  }

  private onTradeCreate(client: Client, message: unknown): void {
    if (this.game.phase !== "TRANSFER_MARKET" || !message || typeof message !== "object") return;
    const payload = message as Record<string, unknown>;
    const input = {
      offerId: typeof payload.offerId === "string" ? payload.offerId : "",
      proposerId: client.sessionId,
      recipientId: typeof payload.recipientId === "string" ? payload.recipientId : "",
      offeredCardIds: Array.isArray(payload.offeredCardIds) && payload.offeredCardIds.every((id) => typeof id === "string")
        ? payload.offeredCardIds as string[] : [],
      requestedCardIds: Array.isArray(payload.requestedCardIds) && payload.requestedCardIds.every((id) => typeof id === "string")
        ? payload.requestedCardIds as string[] : [],
      proposerPays: typeof payload.proposerPays === "number" ? payload.proposerPays : Number.NaN,
    };
    const result = createTradeOffer(this.game.players, input, [...this.tradeOffers.values()]);
    if (!result.ok || this.tradeOffers.has(input.offerId)) {
      client.send("trade:rejected", { reason: result.ok ? "OFFER_ID_IN_USE" : result.error });
      return;
    }

    this.tradeOffers.set(input.offerId, result.value);
    this.sendTradeUpdate(result.value);
  }

  private onTradeAccept(client: Client, message: unknown): void {
    if (this.game.phase !== "TRANSFER_MARKET" || !message || typeof message !== "object") return;
    const offerId = (message as Record<string, unknown>).offerId;
    const offer = typeof offerId === "string" ? this.tradeOffers.get(offerId) : undefined;
    if (!offer) {
      client.send("trade:rejected", { reason: "OFFER_NOT_FOUND" });
      return;
    }
    if (offer.recipientId !== client.sessionId) {
      client.send("trade:rejected", { reason: "NOT_RECIPIENT" });
      return;
    }

    const result = acceptTradeOffer(this.game.players, offer);
    if (!result.ok) {
      client.send("trade:rejected", { reason: result.error });
      return;
    }

    this.game.players = result.value;
    const accepted = { ...offer, status: "ACCEPTED" as const };
    this.tradeOffers.set(offer.offerId, accepted);
    this.sendTradeUpdate(accepted);
    this.sync();
  }

  private onTradeCancel(client: Client, message: unknown): void {
    if (this.game.phase !== "TRANSFER_MARKET" || !message || typeof message !== "object") return;
    const offerId = (message as Record<string, unknown>).offerId;
    const offer = typeof offerId === "string" ? this.tradeOffers.get(offerId) : undefined;
    if (!offer) return;
    if (offer.proposerId !== client.sessionId && offer.recipientId !== client.sessionId) {
      client.send("trade:rejected", { reason: "NOT_PARTICIPANT" });
      return;
    }
    const cancelled = { ...offer, status: "CANCELLED" as const };
    this.tradeOffers.set(offer.offerId, cancelled);
    this.sendTradeUpdate(cancelled);
  }

  /**
   * Emite la oferta a TODA la sala, no solo a las dos partes.
   *
   * Antes se limitaba a proponente y receptor, y era coherente con un mercado
   * "por lo bajo"; pero el presupuesto y la plantilla de cada uno ya viajan
   * enteros a todos (ver `projectState`), asi que ocultar en que se estaba
   * negociando no daba ninguna privacidad y si hacia que un traspaso aceptado
   * no le llegara a los demas: el unico que veia el cambio de plantilla y de
   * saldo era el comprador y el vendedor, y la sala se enteraba al leer el once
   * final. Con este difusion, la oferta aparece en la lista de todos mientras
   * esta abierta y el resultado -- aceptado o cancelado -- es publico.
   *
   * Los botones siguen filtrados por cliente: `Auction.tsx` solo pinta "Aceptar"
   * al receptor y "Cancelar" a las dos partes, asi queBroadcast la oferta no
   * habilita a nadie a actuar sobre la de otro.
   */
  private sendTradeUpdate(offer: TradeOffer): void {
    for (const client of this.clients) client.send("trade:updated", offer);
  }

  private onBid(client: Client, amount: unknown): void {
    if (typeof amount !== "number") {
      client.send("bid:rejected", { reason: "BID_TOO_LOW" });
      return;
    }

    // La hora del servidor al entrar aqui es la unica que cuenta: si se
    // leyera algo que mandara el cliente, cualquiera podria alargar su propia
    // ventana de puja o esquivar el cierre desde el navegador.
    const now = Date.now();
    const verdict = canBid(this.game, this.rules, client.sessionId, amount, now);
    if (!verdict.ok) {
      // DISCONNECTED es tecnicamente correcto para un reingreso aparcado
      // (game.players[].connected sigue en false a proposito mientras
      // pendingRejoins lo retiene -- ver onReconnected), pero decirle
      // "estas desconectado" a alguien cuyo socket funciona es justo lo que
      // rejoinPending existe para distinguir. Mismo caso, mensaje mas
      // honesto para quien SI esta ahi mirando.
      const reason =
        verdict.error === "DISCONNECTED" && this.pendingRejoins.has(client.sessionId)
          ? "REJOIN_PENDING"
          : verdict.error;
      client.send("bid:rejected", { reason });
      return;
    }

    this.game = applyBid(this.game, this.rules, client.sessionId, amount, now);
    this.armTimer(this.game.endsAt - now);
    this.sync();
  }

  /**
   * D2: "pass" sustituye a "cerrar sin pujar". A diferencia de aquel (que
   * cualquier UNO de los que necesitaban el hueco podia disparar de golpe),
   * pasar es colectivo -- solo resuelve cuando TODOS los que aun necesitan el
   * hueco (`playersEligibleToPass`, el mismo filtro que autoriza a enviar este
   * mensaje) han pasado la carta actual. Quien ya lo ficho no pasa ni cuenta:
   * ver `playersEligibleToPass` en `@fut/shared`, que lo exige por la misma
   * razon que acota el voto de saltar. Si no son todos, se limita a anotar el
   * pase y esperar: al resto, o pujan, o pasan, o se agota la ventana y sigue
   * el camino de siempre (onBidTimeout).
   */
  private onPass(client: Client): void {
    if (this.game.phase !== "BIDDING" || this.game.currentBid !== 0) return;
    const eligible = playersEligibleToPass(this.game);
    if (!eligible.includes(client.sessionId)) return;

    this.game.passes = { ...this.game.passes, [client.sessionId]: true };
    this.sync();

    const allPassed = eligible.every((id) => this.game.passes[id] === true);
    if (allPassed) this.resolvePassedCard();
  }

  /**
   * Todos los elegibles pasaron: se resuelve al instante, sin esperar a que
   * venza ningun reloj. Nunca abre voto de salto -- un pase unanime YA es
   * esa decision, tomada sin esperar los `skipVoteMs` -- ver `resolvePass`
   * en `@fut/shared` para el porque de cada desenlace posible.
   */
  private resolvePassedCard(): void {
    const outcome = resolvePass(this.game, this.rules, this.rng);
    this.game = applyOutcome(this.game, outcome);
    this.enterReveal(outcome);
  }

  /** Reprograma el cierre. Cancela el anterior: nunca hay dos relojes vivos. */
  protected armTimer(delayMs: number): void {
    this.timer?.clear();
    this.timer = this.clock.setTimeout(() => this.onBidTimeout(), Math.max(0, delayMs));
  }

  /** Se dispara al agotarse el reloj de la subasta. */
  protected onBidTimeout(): void {
    if (this.game.phase !== "BIDDING") return;
    const outcome = resolveAuction(this.game, this.rules, this.rng);
    this.game = applyOutcome(this.game, outcome);

    if (outcome.kind === "OPEN_SKIP_VOTE") {
      this.game.endsAt = Date.now() + this.rules.skipVoteMs;
      this.timer?.clear();
      this.timer = this.clock.setTimeout(() => this.onSkipTimeout(), this.rules.skipVoteMs);
      this.sync();
      return;
    }

    this.enterReveal(outcome);
  }

  private onVoteSkip(client: Client, skip: boolean): void {
    if (this.game.phase !== "SKIP_VOTE") return;
    // Solo cuentan los votos de quien todavia necesita el hueco en juego, que
    // es el mismo conjunto que exige `resolveSkipVote` para la unanimidad y el
    // mismo que la UI da por votante (Auction.tsx: `canVoteSkip = !alreadySigned`
    // y la lista de "esperando", que son los de `playersNeedingSlot`). Contar
    // tambien a quien ya ficho este puesto hacia la unanimidad inalcanzable --
    // su voto no se puede emitir desde la interfaz -- y la carta se quedaba
    // esperando los `skipVoteMs` enteros para acabar descartada igual. Sigue
    // excluido quien esta desconectado o con un reingreso aparcado (mismo
    // caso, ver onReconnected): su voto no debe quedar escrito en skipVotes ni
    // viajar al Schema.
    if (!playersNeedingSlot(this.game).some((p) => p.playerId === client.sessionId)) return;
    this.game.skipVotes = { ...this.game.skipVotes, [client.sessionId]: skip };
    this.sync();

    // Si ya votaron todos los que faltaban, no hace falta agotar los 10 s.
    const pending = playersNeedingSlot(this.game).filter(
      (p) => this.game.skipVotes[p.playerId] === undefined,
    );
    if (pending.length === 0) this.onSkipTimeout();
  }

  protected onSkipTimeout(): void {
    if (this.game.phase !== "SKIP_VOTE") return;
    const outcome = resolveSkipVote(this.game);

    if (outcome.kind === "SKIPPED") {
      this.discardCurrentCard();
      return;
    }

    if (outcome.restrictedBidders.length === 0) {
      // Sin unanimidad pero tambien sin nadie que votara explicitamente en
      // contra (una sala entera ausente, o solo abstenciones): reabrir
      // BIDDING con restrictedBidders vacio dejaria 15 s de reloj corriendo
      // con la puja rechazando a todo el mundo (NOT_ALLOWED_TO_BID) antes de
      // terminar igual en descarte. Se adelanta el desenlace inevitable en
      // vez de atravesar esa fase muerta.
      this.discardCurrentCard();
      return;
    }

    // Reanudar restringido: solo pueden pujar los que votaron en contra.
    // D1: esto vuelve a armar la ventana de apertura -- antes se dejaba
    // `endsAt` en 0 igual que en openBidding(), y una carta en fase
    // restringida que nadie pujaba tampoco avanzaba sola. Mismo arreglo,
    // misma razon. D2: tambien se vacia `passes` -- el conjunto de quien
    // puede pasar acaba de encogerse a `restrictedBidders`, asi que un pase
    // de antes de la votacion (de alguien que ahora sigue siendo elegible)
    // no puede colar como si fuera un pase nuevo en esta fase.
    this.game = {
      ...this.game,
      phase: "BIDDING",
      restrictedBidders: outcome.restrictedBidders,
      skipVotes: {},
      passes: {},
      endsAt: Date.now() + this.rules.openWindowMs,
    };
    this.armTimer(this.rules.openWindowMs);
    this.sync();
  }

  /**
   * Descarta la carta de la mesa: applyOutcome saca la carta de la ronda y
   * limpia restrictedBidders/skipVotes, enterReveal solo publica. Sale de
   * onSkipTimeout por las dos ramas que terminan en descarte (unanimidad y
   * voto fallido sin nadie en contra) para que ninguna duplique la llamada
   * a applyOutcome.
   */
  private discardCurrentCard(): void {
    const cardId = currentCardId(this.game)!;
    const discarded = { kind: "DISCARDED", cardId } as const;
    this.game = applyOutcome(this.game, discarded);
    this.enterReveal(discarded);
  }

  /**
   * Publica los campos privados de la carta. Es el unico sitio del servidor
   * autorizado a hacerlo -- salvo `rating` (D3): igual que el nombre esta
   * prohibido antes de este momento, el rating esta prohibido DESPUES de
   * este momento y hasta RESULTS. Se revela foto, nombre, temporada, club,
   * liga y nacion aqui; el rating se guarda en la ceremonia final (ver
   * `finish()`), premiando saber de futbol durante toda la partida en vez
   * de poder leer quien va ganando carta a carta.
   */
  private enterReveal(outcome: AuctionOutcome): void {
    if (outcome.kind === "OPEN_SKIP_VOTE") throw new Error("enterReveal con OPEN_SKIP_VOTE");

    const card = this.byId.get(outcome.cardId);
    if (!card) throw new Error(`cardId desconocido: ${outcome.cardId}`);
    const priv = toPrivate(card);
    const pub = toPublic(card);

    const row = new RevealedCardSchema();
    row.cardId = priv.cardId;
    row.slot = pub.slot;
    row.silhouetteId = card.silhouetteId;
    row.name = priv.name;
    row.season = priv.season;
    row.club = priv.club;
    row.league = priv.league;
    row.nation = priv.nation;
    row.rating = 0; // D3: se publica en finish(), no aqui.
    row.ownerId = outcome.kind === "DISCARDED" ? "" : outcome.playerId;
    row.price = outcome.kind === "DISCARDED" ? 0 : outcome.price;
    this.state.revealedCards.set(row.cardId, row);

    // La fase ya la puso applyOutcome (llamado por el caller antes de
    // enterReveal, siempre): reafirmarla aqui enmascararia el contrato -- si
    // algun dia se llamara a enterReveal sin pasar por applyOutcome antes,
    // la fase quedaria bien puesta pero la carta seguiria sin salir de
    // remainingCards, que es justo el fallo que el reparto de
    // responsabilidades entre ambos existe para hacer imposible.
    // Una carta adjudicada deja sitio a la secuencia de venta del cliente y a un
    // respiro antes de la siguiente; una descartada no tiene nada que celebrar.
    const revealMs = outcome.kind === "DISCARDED" ? this.rules.revealMs : this.rules.soldRevealMs;
    this.game.endsAt = Date.now() + revealMs;
    this.sync();

    // La carta de la mesa se mantiene visible con sus campos ya publicados.
    // Si no coincidiera seria un fallo de sincronizacion entre el estado
    // puro y el Schema: en la ruta que sostiene el secreto del juego un
    // desajuste asi no puede quedar mudo, o el cliente se queda mirando una
    // carta sin revelar durante los 6 s del reveal sin ninguna pista de
    // por que. Las otras dos comprobaciones de este metodo (carta
    // desconocida) tambien lanzan; esta se alinea con ellas.
    const tableCard = this.state.currentCard;
    const expectedPublicId = this.cardIdToPublicId.get(row.cardId);
    if (!tableCard || tableCard.publicId !== expectedPublicId) {
      throw new Error(`La carta de la mesa no coincide con la revelada: ${row.cardId}`);
    }
    tableCard.revealed = true;
    tableCard.name = row.name;
    tableCard.season = row.season;
    tableCard.club = row.club;
    tableCard.league = row.league;
    tableCard.nation = row.nation;
    // D3: tableCard.rating NO se toca -- se queda en su valor por defecto
    // (0) hasta RESULTS, igual que row.rating arriba.

    this.timer?.clear();
    this.timer = this.clock.setTimeout(() => this.onRevealTimeout(), revealMs);
  }

  protected onRevealTimeout(): void {
    if (this.game.phase !== "REVEAL") return;
    this.advance();
  }

  /** Siguiente carta de la ronda, o siguiente hueco, o fin de partida. */
  protected advance(): void {
    const stillNeeding = playersNeedingSlot(this.game).length;

    if (stillNeeding > 0 && this.game.remainingCards.length > 0) {
      this.state.currentCard = undefined; // fuerza a proyectar la carta nueva
      this.openBidding();
      return;
    }

    // Invariante que sostiene la rama de abajo: si stillNeeding > 0 llega
    // hasta aqui (remainingCards ya vacio), este bloque pasa al siguiente
    // hueco EN SILENCIO dejando a ese jugador sin fichar el actual. Se
    // mantiene porque remainingCards.length nunca cae por debajo de
    // stillNeeding: drawRound reparte jugadores+1 cartas, resolveAuction
    // fuerza por sorteo en cuanto el margen se agota (skipAllowed) en vez
    // de permitir mas descartes de los que soporta, y -- esto es lo que la
    // Task 11 (reconexion) tiene que blindar a proposito -- el numero de
    // jugadores que CUENTAN como conectados no cambia mientras dura una
    // ronda. Un reingreso a mitad de ronda no marca `connected = true` al
    // instante (ver onReconnected): se aparca en pendingRejoins y solo se
    // aplica aqui, en la frontera entre rondas, justo antes de decidir el
    // siguiente paso. Si se aplicara al instante, playersNeedingSlot lo
    // contaria de golpe en una ronda cuyo reparto nunca lo tuvo en cuenta, y
    // stillNeeding si podria superar a remainingCards.
    this.flushPendingRejoins();

    const next = this.game.slotIndex + 1;
    if (next >= SLOTS.length) {
      this.finish();
      return;
    }

    if (TRANSFER_MARKET_SLOT_INDEXES.has(next)) {
      this.enterTransferMarket();
      return;
    }

    this.state.currentCard = undefined;
    this.startRound(next);
  }

  /**
   * Puntua la partida completa y proyecta la clasificacion final. El rating
   * es dato privado del servidor (scoreMatch lo pide por inyeccion, nunca
   * lo lee directamente): aqui, y solo aqui, se le da acceso via byId.
   *
   * D3: hasta este momento el rating nunca viajo -- ni en `currentCard` ni
   * en `revealedCards`, ver `enterReveal()` -- asi que, ademas de puntuar,
   * este es tambien el unico sitio que rellena `revealedCards[...].rating`
   * con el valor real. Es la misma barrera de secreto que sostiene el
   * nombre antes del reveal, solo que esta se levanta al final de la
   * partida en vez de al momento de cada carta.
   */
  protected finish(): void {
    this.timer?.clear();
    this.game.phase = "RESULTS";
    // Limpia los restos de la ultima ronda jugada: sin esto, RESULTS
    // arrastra el currentSlot de la ultima posicion, una carta sobrante que
    // drawRound repartio pero nadie llego a subastar (remainingCount > 0
    // le habria dado a projectState un cardId valido para proyectar como
    // "carta actual" -- una carta fantasma, nunca revelada, que no pinta
    // nada en la pantalla de resultados) y un endsAt de un reloj que ya no
    // corre. slotIndex a SLOTS.length (no un indice de SLOTS) es a
    // proposito: project.ts ya lee `SLOTS[slotIndex] ?? ""` en vez de
    // currentSlot() precisamente para tolerar esto sin lanzar.
    this.game.slotIndex = SLOTS.length;
    this.game.remainingCards = [];
    this.game.endsAt = 0;
    this.state.currentCard = undefined;

    // D3: se levanta la barrera de secreto del rating para todas las
    // cartas ya reveladas -- cada `row.cardId` identifica una carta que YA
    // se subasto entera, asi que publicar esto ahora no adelanta nada.
    for (const row of this.state.revealedCards.values()) {
      const card = this.byId.get(row.cardId);
      if (!card) throw new Error(`cardId desconocido al publicar el rating final: ${row.cardId}`);
      row.rating = card.rating;
    }

    const table = scoreMatch(this.game.players, (cardId) => {
      const card = this.byId.get(cardId);
      if (!card) throw new Error(`cardId desconocido al puntuar: ${cardId}`);
      return card.rating;
    });

    this.state.standings = new ArraySchema<StandingSchema>(
      ...table.map((row) => {
        const node = new StandingSchema();
        node.playerId = row.playerId;
        node.points = row.points;
        node.totalRating = row.totalRating;
        node.budgetLeft = row.budgetLeft;
        node.rank = row.rank;
        return node;
      }),
    );

    this.sync();
  }

  /**
   * D5: el anfitrion reinicia la sala con los mismos jugadores, sin crear
   * otra ni repartir otro codigo. Silencioso si no procede (mismo criterio
   * que el resto de mensajes con gatekeeping de esta clase, p.ej. onVoteSkip
   * con quien no necesita el hueco): solo el anfitrion, y solo en RESULTS --
   * a mitad de partida no hay nada que reiniciar, y en cualquier otra fase
   * "reiniciar" dejaria a la ronda en curso en un estado indefinido.
   */
  private onRematch(client: Client): void {
    if (this.game.phase !== "RESULTS") return;
    if (client.sessionId !== this.state.hostId) return;
    this.rematch();
  }

  /**
   * El anfitrion expulsa a un jugador de la sala de espera. Solo en LOBBY
   * (a mitad de partida no hay "expulsar": quien se va sostiene turnos y
   * cartas ya repartidas, eso se arregla cerrando la sala y abriendo otra
   * -- ver la pagina de Comunidad enlazada en el footer), solo desde el
   * asiento del host, y nunca a si mismo.
   *
   * Quien sale se va con la misma forma que si hubiera cerrado la pestana
   * del lobby: se le quita de `game.players` antes de soltar el socket, y
   * `onLeave` entra despues por la rama de LOBBY como un no-op de limpieza.
   * No hay ventana de reconexion: un expulsado no debe volver a entrar sin
   * que el anfitrion se lo proponga. El cierre usa un close code de salida
   * deliberada (4000, "consented") para que el cliente no lo interprete
   * como caida y no ofrezca reconectar.
   */
  private onKick(client: Client, message: unknown): void {
    if (this.game.phase !== "LOBBY") return;
    if (client.sessionId !== this.state.hostId) return;
    const playerId = (message as { playerId?: unknown } | null)?.playerId;
    if (typeof playerId !== "string" || playerId === "") return;
    if (playerId === client.sessionId) return;
    if (!this.game.players.some((p) => p.playerId === playerId)) return;

    const kicked = this.clients.find((candidate) => candidate.sessionId === playerId);
    if (!kicked) return;

    // Primero el aviso, luego el cierre: el socket de la victima recibe
    // "kicked" antes de cerrarse, y `useRoom` pinta el "te expulsaron"
    // antes de que `onLeave` (consented) devuelva el control a la portada.
    kicked.send("kicked", { reason: "KICKED" });

    this.game.players = this.game.players.filter((p) => p.playerId !== playerId);
    this.ready.delete(playerId);
    this.pendingRejoins.delete(playerId);
    this.sync();

    kicked.leave(4000);
  }

  /**
   * Reinicio completo (D5). Se queda con los jugadores CONECTADOS -- un
   * fantasma que ya se fue no vuelve a aparecer solo porque haya revancha,
   * igual que en el lobby original (onLeave los saca de `game.players` sin
   * esperar). `hostId` no se toca: sigue siendo quien lo era, y solo el
   * anfitrion pudo disparar este metodo de todos modos.
   */
  private rematch(): void {
    this.usedCards = new Set(); // mazo nuevo: las mismas cartas, otra vez disponibles
    this.assignFreshPublicIds(); // publicId nuevos: ver su comentario para el porque
    this.pendingRejoins.clear();
    this.ready.clear();

    this.game = {
      phase: "LOBBY",
      slotIndex: 0,
      remainingCards: [],
      currentBid: 0,
      currentBidderId: null,
      openingBid: 0,
      bidHistory: [],
      endsAt: 0,
      skipVotes: {},
      restrictedBidders: null,
      passes: {},
      players: this.game.players
        .filter((p) => p.connected)
        .map((p) => ({ ...p, budget: this.rules.startingBudget, squad: {} })),
    };

    this.state.currentCard = undefined;
    this.state.revealedCards.clear();
    this.state.standings = new ArraySchema<StandingSchema>();
    void this.unlock(); // sala desbloqueada: startRound() la volvio a bloquear con lock()

    this.sync();
  }

  /**
   * D8: reaccion efimera, cualquier fase salvo LOBBY -- en el lobby no hay
   * partida a la que reaccionar, y las pantallas previas (Landing, Lobby) no
   * montan `<Reactions>`. Valida en silencio (sin `client.send(...:rejected)`
   * como hace `onBid`): un emoji fuera de rango o un spam por encima del
   * limite no es informacion que el emisor necesite de vuelta -- distinto de
   * un rechazo de puja, que si cambia lo que el jugador deberia hacer a
   * continuacion. `this.state` no se toca: es un evento de paso, no un dato
   * de partida que deba sobrevivir a un patch futuro ni reconstruirse tras
   * una reconexion.
   */
  private onReact(client: Client, emoji: unknown): void {
    if (this.game.phase === "LOBBY") return;
    if (typeof emoji !== "number" || !Number.isInteger(emoji) || emoji < 0 || emoji > 5) return;

    const now = Date.now();
    const last = this.lastReactionAt.get(client.sessionId) ?? 0;
    if (now - last < 600) return;

    this.lastReactionAt.set(client.sessionId, now);
    this.broadcast("reaction", { playerId: client.sessionId, emoji });
  }

  /**
   * Para la ruta `/silhouettes` de la Task 12: resuelve el `publicId` de
   * ESTA sala al `silhouetteId` real que hay que servir, o `undefined` si no
   * pertenece a esta partida. El `publicId` solo tiene sentido dentro de la
   * sala que lo emitio -- ver el informe de la Task 8 para el contrato
   * completo que necesita esa ruta (roomId + publicId).
   *
   * Defensa en profundidad (Ronda de arreglos 1 de la Task 12): los 55
   * `publicId` de la partida se asignan de golpe en onCreate, asi que sin
   * este filtro cualquier cliente que ADIVINARA un UUID valido podria pedir
   * la silueta de una carta que ni siquiera ha salido a subasta todavia --
   * hoy no es explotable (122 bits de entropia, y el Schema solo publica el
   * publicId de la carta vigente), pero el secreto quedaria sostenido por
   * la aleatoriedad del UUID en vez de por una regla explicita. Solo
   * resuelve si el publicId es el de la carta EN LA MESA ahora mismo, o el
   * de una carta YA REVELADA (las tareas siguientes necesitan poder pintar
   * las plantillas ya reveladas).
   */
  public silhouetteIdFor(publicId: string): string | undefined {
    const cardId = this.publicIdToCardId.get(publicId);
    if (!cardId) return undefined;

    const isCurrentCard = this.state.currentCard?.publicId === publicId;
    const isRevealed = this.state.revealedCards.has(cardId);
    if (!isCurrentCard && !isRevealed) return undefined;

    return this.byId.get(cardId)?.silhouetteId;
  }

  /**
   * Para la ruta `/photos`: resuelve el `publicId` al `silhouetteId` real,
   * pero SOLO si esa carta ya esta en `revealedCards` -- a diferencia de
   * `silhouetteIdFor`, aqui la carta EN LA MESA (todavia sin adjudicar) no
   * cuenta. La silueta es seguro pedirla durante la puja porque no dice
   * nada (es un recorte negro, igual para cualquier jugador de su altura);
   * la foto en color SI identifica al futbolista con solo mirarla. Si esta
   * ruta aceptara la carta vigente, cualquiera podria abrir
   * `/photos/:roomId/:publicId.png` en otra pestaña mientras la puja sigue
   * abierta y ver la respuesta antes de pujar -- el mismo agujero que ya
   * costo tres rondas de arreglos cerrar en `silhouetteIdFor` (ver su
   * comentario). Por eso es un metodo aparte y no `silhouetteIdFor` con un
   * flag: un flag por defecto equivocado (o un caller que se olvida de
   * pasarlo) reabriria el agujero en silencio; dos metodos que solo hacen
   * una cosa cada uno no dejan ese hueco.
   */
  public photoIdFor(publicId: string): string | undefined {
    const cardId = this.publicIdToCardId.get(publicId);
    if (!cardId) return undefined;
    if (!this.state.revealedCards.has(cardId)) return undefined;

    return this.byId.get(cardId)?.silhouetteId;
  }

  /**
   * Resuelve la foto de una carta por su `cardId` solo cuando ya forma parte
   * de `revealedCards`. RESULTS ya publica ese identificador, y la ceremonia
   * necesita mostrar las fotos juntas sin reconstruir los `publicId` de la
   * partida. La misma puerta de reveal protege esta ruta.
   */
  public photoIdForRevealedCard(cardId: string): string | undefined {
    const revealed = this.state.revealedCards.get(cardId);
    return revealed?.silhouetteId;
  }
}

import { Client, Room } from "@colyseus/core";
import type { Delayed } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import {
  applyBid, applyOutcome, canBid, cardsBySlot, currentCardId, DEFAULT_RULES, generateRoomCode, openingBidForRating,
  parseDataset, playersNeedingSlot, resolveAuction, resolveSkipVote, scoreMatch, SLOTS, toPrivate, toPublic,
  type AuctionOutcome, type AuctionState, type CardSource, type Rng, type Rules, type Slot,
} from "@fut/shared";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionRoomState, RevealedCardSchema, StandingSchema } from "./schema.js";
import { projectState } from "./project.js";
import { drawRound } from "./setup.js";

// Ruta anclada al modulo, no al cwd: `pnpm --filter @fut/server test` (y
// `pnpm -r test` desde la raiz) ejecutan con cwd = packages/server, asi que
// una ruta relativa tipo "data/players.json" no encontraria el dataset.
const DATASET_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/players.json");
const DEFAULT_DATASET: CardSource[] = parseDataset(JSON.parse(readFileSync(DATASET_PATH, "utf8")));

export interface AuctionRoomOptions {
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

  onCreate(options?: AuctionRoomOptions): void {
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

    // Se asignan todos de golpe al arrancar la sala: son 55 cartas como
    // mucho, y asi projectState solo necesita leer el mapa, nunca escribirlo.
    for (const card of dataset) {
      const publicId = randomUUID();
      this.cardIdToPublicId.set(card.cardId, publicId);
      this.publicIdToCardId.set(publicId, card.cardId);
    }

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
    // setMetadata(), no una propiedad suelta en `this.listing`: es la API
    // publica y estable de Colyseus para datos consultables de la sala (ver
    // el metodo GET /rooms/:code en index.ts, que resuelve por aqui via
    // matchMaker.query). `filterBy` habria sido la alternativa, pero solo
    // sabe leer valores que el CLIENTE manda en clientOptions al crear --
    // aqui el codigo lo inventa el SERVIDOR dentro de onCreate, asi que
    // filterBy nunca podria verlo a tiempo.
    void this.setMetadata({ code: this.state.roomCode });

    this.onMessage("ready", (client) => this.onReady(client));
    this.onMessage("bid", (client, message: { amount?: unknown }) => {
      this.onBid(client, message?.amount);
    });
    this.onMessage("closeWithoutBid", (client) => this.onCloseWithoutBid(client));
    this.onMessage("voteSkip", (client, message: { skip?: unknown }) => {
      this.onVoteSkip(client, message?.skip === true);
    });
    this.sync();
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

    this.game.players.push({
      playerId: client.sessionId,
      name: options?.name ?? `Jugador ${this.game.players.length + 1}`,
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
    this.game.endsAt = Date.now() + this.rules.openWindowMs;
    this.armTimer(this.rules.openWindowMs);
    this.sync();
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
   * Cierra explicitamente una carta sin ofertas. Si aun sobra una carta abre
   * la votacion de salto; en el ultimo margen resuelve el sorteo obligatorio.
   */
  private onCloseWithoutBid(client: Client): void {
    if (this.game.phase !== "BIDDING" || this.game.currentBid !== 0) return;
    if (!playersNeedingSlot(this.game).some((player) => player.playerId === client.sessionId)) return;
    if (this.game.restrictedBidders !== null && !this.game.restrictedBidders.includes(client.sessionId)) return;
    this.onBidTimeout();
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
    // Solo cuenta el voto de quien de verdad necesita el hueco en juego:
    // resolveSkipVote ya ignora a cualquier otro al construir `eligible`,
    // pero sin este filtro su voto igual queda escrito en skipVotes y
    // viaja al Schema -- visible para todos, sin afectar el desenlace pero
    // sembrando un voto fantasma de alguien desconectado (o de un
    // reingreso aparcado: mismo caso, ver onReconnected) que no debería
    // poder votar nada.
    if (!playersNeedingSlot(this.game).some((p) => p.playerId === client.sessionId)) return;
    this.game.skipVotes = { ...this.game.skipVotes, [client.sessionId]: skip };
    this.sync();

    // Si ya votaron todos los que podian, no hace falta agotar los 10 s.
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
    // misma razon.
    this.game = {
      ...this.game,
      phase: "BIDDING",
      restrictedBidders: outcome.restrictedBidders,
      skipVotes: {},
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
   * autorizado a hacerlo.
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
    row.rating = priv.rating;
    row.ownerId = outcome.kind === "DISCARDED" ? "" : outcome.playerId;
    row.price = outcome.kind === "DISCARDED" ? 0 : outcome.price;
    this.state.revealedCards.set(row.cardId, row);

    // La fase ya la puso applyOutcome (llamado por el caller antes de
    // enterReveal, siempre): reafirmarla aqui enmascararia el contrato -- si
    // algun dia se llamara a enterReveal sin pasar por applyOutcome antes,
    // la fase quedaria bien puesta pero la carta seguiria sin salir de
    // remainingCards, que es justo el fallo que el reparto de
    // responsabilidades entre ambos existe para hacer imposible.
    this.game.endsAt = Date.now() + this.rules.revealMs;
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
    tableCard.rating = row.rating;

    this.timer?.clear();
    this.timer = this.clock.setTimeout(() => this.onRevealTimeout(), this.rules.revealMs);
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

    this.state.currentCard = undefined;
    this.startRound(next);
  }

  /**
   * Puntua la partida completa y proyecta la clasificacion final. El rating
   * es dato privado del servidor (scoreMatch lo pide por inyeccion, nunca
   * lo lee directamente): aqui, y solo aqui, se le da acceso via byId -- la
   * partida ya termino, asi que publicarlo en `standings` no revela nada
   * que REVEAL no haya revelado ya carta a carta.
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
}

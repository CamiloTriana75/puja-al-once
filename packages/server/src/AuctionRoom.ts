import { Client, Room } from "@colyseus/core";
import {
  cardsBySlot, currentSlot, DEFAULT_RULES, parseDataset, SLOTS,
  type AuctionState, type CardSource, type Rng, type Rules, type Slot,
} from "@fut/shared";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionRoomState } from "./schema.js";
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
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    players: [],
  };

  private rules: Rules = DEFAULT_RULES;
  private rng: Rng = Math.random;
  private ready = new Set<string>();
  private usedCards = new Set<string>();

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
    this.onMessage("ready", (client) => this.onReady(client));
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
    this.game.players.push({
      playerId: client.sessionId,
      name: options?.name ?? `Jugador ${this.game.players.length + 1}`,
      budget: this.rules.startingBudget,
      squad: {},
      connected: true,
    });
    this.sync();
  }

  onLeave(client: Client): void {
    if (this.game.phase === "LOBBY") {
      // En el lobby no hay partida a la que reconectarse: si solo se marca
      // "connected = false" el jugador se queda fantasma en game.players y
      // "ready" compara para siempre contra un asiento que nunca volvera.
      this.game.players = this.game.players.filter((p) => p.playerId !== client.sessionId);
      this.ready.delete(client.sessionId);
    } else {
      this.setConnected(client.sessionId, false);
    }
    this.sync();
  }

  /** Copia el estado puro sobre el Schema. Se llama tras cada cambio. */
  protected sync(): void {
    projectState(this.game, this.state, this.rules, this.byId, this.cardIdToPublicId);
  }

  protected setConnected(playerId: string, connected: boolean): void {
    const player = this.game.players.find((p) => p.playerId === playerId);
    if (player) player.connected = connected;
  }

  private onReady(client: Client): void {
    if (this.game.phase !== "LOBBY") return;
    this.ready.add(client.sessionId);

    const connectedPlayers = this.game.players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) return;
    if (!connectedPlayers.every((p) => this.ready.has(p.playerId))) return;

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

  /** Pone la carta de la mesa a subasta y arma el reloj de cierre. */
  protected openBidding(): void {
    this.game.phase = "BIDDING";
    this.game.currentBid = 0;
    this.game.currentBidderId = null;
    this.game.skipVotes = {};
    this.game.endsAt = Date.now() + this.rules.bidTimerMs;
    this.sync();
  }

  /**
   * Para la ruta `/silhouettes` de la Task 12: resuelve el `publicId` de
   * ESTA sala al `silhouetteId` real que hay que servir, o `undefined` si no
   * pertenece a esta partida. El `publicId` solo tiene sentido dentro de la
   * sala que lo emitio -- ver el informe de la Task 8 para el contrato
   * completo que necesita esa ruta (roomId + publicId).
   */
  public silhouetteIdFor(publicId: string): string | undefined {
    const cardId = this.publicIdToCardId.get(publicId);
    if (!cardId) return undefined;
    return this.byId.get(cardId)?.silhouetteId;
  }

  /** Expuesto para los tests: el hueco que se subasta ahora. */
  get slot(): string {
    return currentSlot(this.game);
  }
}

import { Client, Room } from "@colyseus/core";
import {
  cardsBySlot, currentSlot, DEFAULT_RULES, parseDataset, SLOTS,
  type AuctionState, type CardSource, type Rng, type Rules,
} from "@fut/shared";
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
const DATASET: CardSource[] = parseDataset(JSON.parse(readFileSync(DATASET_PATH, "utf8")));
const BY_SLOT = cardsBySlot(DATASET);
const BY_ID = new Map(DATASET.map((card) => [card.cardId, card]));

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

  onCreate(): void {
    this.setState(new AuctionRoomState());
    this.onMessage("ready", (client) => this.onReady(client));
    this.sync();
  }

  onJoin(client: Client, options?: { name?: string }): void {
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
    this.setConnected(client.sessionId, false);
    this.sync();
  }

  /** Copia el estado puro sobre el Schema. Se llama tras cada cambio. */
  protected sync(): void {
    projectState(this.game, this.state, this.rules, BY_ID);
  }

  protected setConnected(playerId: string, connected: boolean): void {
    const player = this.game.players.find((p) => p.playerId === playerId);
    if (player) player.connected = connected;
  }

  private onReady(client: Client): void {
    if (this.game.phase !== "LOBBY") return;
    this.ready.add(client.sessionId);
    if (this.ready.size < this.game.players.length || this.game.players.length < 2) return;
    this.startRound(0);
  }

  /** Arranca la ronda del hueco `slotIndex` repartiendo jugadores + 1 candidatos. */
  protected startRound(slotIndex: number): void {
    this.game.slotIndex = slotIndex;
    this.game.remainingCards = drawRound(
      BY_SLOT,
      SLOTS[slotIndex]!,
      this.game.players.length,
      this.rng,
      this.usedCards,
    );
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

  /** Expuesto para los tests: el hueco que se subasta ahora. */
  get slot(): string {
    return currentSlot(this.game);
  }
}

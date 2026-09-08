/**
 * Tipado plano de `room.state`, escrito a mano contra lo que el servidor
 * manda de verdad (`packages/server/src/schema.ts`) -- NUNCA importando las
 * clases `Schema`. `@colyseus/schema@3` usa decoradores legados que esbuild
 * (y por tanto Vite) no transpila: importar una clase Schema aqui rompe el
 * build del cliente.
 */

export interface PlayerView {
  playerId: string;
  name: string;
  budget: number;
  /**
   * Mezcla "socket caido" y "reingreso aparcado hasta la siguiente ronda"
   * a proposito en el servidor -- ver `rejoinPending` para distinguirlas.
   */
  connected: boolean;
  /**
   * El jugador volvio a conectar y ve la partida, pero no cuenta para el
   * reparto hasta que cruce la siguiente frontera de ronda. Distinto de
   * `connected: false`: aqui el socket funciona.
   */
  rejoinPending: boolean;
  /** Hueco -> cardId. Llega como MapSchema, se recorre con .forEach o .entries(). */
  squad: Map<string, string>;
}

/**
 * La carta de la mesa. El servidor NUNCA manda `cardId` ni `silhouetteId`
 * aqui -- solo `publicId`, opaco y valido solo dentro de esta sala. La
 * silueta se pide a `/silhouettes/:roomId/:publicId.png`.
 */
export interface CardView {
  publicId: string;
  slot: string;
  heightCm: number;
  foot: string;
  ageBand: string;
  continent: string;
  decade: string;
  revealed: boolean;
  /** Vacios hasta el reveal. */
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
}

/** Carta ya revelada: aqui si viaja `cardId`/`silhouetteId`, la partida ya publico esa carta. */
export interface RevealedCardView {
  cardId: string;
  slot: string;
  silhouetteId: string;
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
  ownerId: string;
  price: number;
}

export interface StandingView {
  playerId: string;
  points: number;
  totalRating: number;
  budgetLeft: number;
  rank: number;
}

/** Oferta aceptada en la carta actual, sincronizada para toda la sala. */
export interface BidView {
  playerId: string;
  amount: number;
}

export interface ClientState {
  /**
   * Codigo de sala, legible en voz alta -- lo contrario del `publicId` de
   * las cartas: este no es secreto, sirve para compartirse y puede ir en la
   * URL.
   */
  roomCode: string;
  /** playerId de quien creo la sala. Migra al siguiente conectado si se va antes de empezar. */
  hostId: string;
  phase: "LOBBY" | "SETUP" | "BIDDING" | "SKIP_VOTE" | "REVEAL" | "RESULTS";
  slotIndex: number;
  currentSlot: string;
  currentCard?: CardView;
  currentBid: number;
  currentBidderId: string;
  openingBid: number;
  minimumBid: number;
  bidHistory: BidView[];
  endsAt: number;
  remainingCount: number;
  skipAvailable: boolean;
  skipVotes: Map<string, boolean>;
  restrictedBidders: string[];
  players: Map<string, PlayerView>;
  revealedCards: Map<string, RevealedCardView>;
  standings: StandingView[];
}

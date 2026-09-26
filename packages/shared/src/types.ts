export const SLOTS = [
  "GK", "LB", "CB1", "CB2", "RB",
  "CDM", "CM", "CAM", "LW", "ST", "RW",
] as const;

export type Slot = (typeof SLOTS)[number];

export type Foot = "L" | "R" | "B";
export type Continent = "EU" | "SA" | "NA" | "AF" | "AS" | "OC";
export type AgeBand = "<21" | "21-25" | "26-30" | "31-34" | "35+";

export type Phase = "LOBBY" | "SETUP" | "BIDDING" | "SKIP_VOTE" | "REVEAL" | "RESULTS";

/** Fuente de azar inyectable. Devuelve [0, 1). */
export type Rng = () => number;

/** Precio de salida para jugadores desde `minimumRating` inclusive. */
export interface OpeningBidTier {
  minimumRating: number;
  price: number;
}

export interface Rules {
  /** Presupuesto inicial de cada jugador, en millones. */
  startingBudget: number;
  /** Precio de salida mas bajo y reserva por cada hueco pendiente, en millones. */
  basePrice: number;
  /** Tramos descendentes que escalan el precio de salida por valoracion. */
  openingBidTiers: readonly OpeningBidTier[];
  /** Subida minima sobre la puja vigente, en millones. */
  minIncrement: number;
  /**
   * Tiempo maximo con la carta abierta sin ninguna puja (D1): arranca en
   * cuanto se abre la carta y, si nadie puja antes de que venza, dispara el
   * mismo camino que cualquier otro cierre (`onBidTimeout`). Sin esto una
   * carta que nadie quiere -- y que tampoco pasan todos, ver `pass` en
   * `pass.ts` -- se queda abierta para siempre en vez de resolverse sola.
   */
  openWindowMs: number;
  /** Ventana que empieza con la primera puja y se reinicia con cada nueva puja. */
  antiSnipeMs: number;
  /** Duracion de la votacion de salto. */
  skipVoteMs: number;
  /** Cuanto se muestra la carta revelada. */
  revealMs: number;
  /** Margen de reconexion tras una desconexion. */
  reconnectSeconds: number;
}

export const DEFAULT_RULES: Rules = {
  startingBudget: 1_000,
  basePrice: 20,
  openingBidTiers: [
    { minimumRating: 95, price: 80 },
    { minimumRating: 91, price: 60 },
    { minimumRating: 87, price: 40 },
  ],
  minIncrement: 10,
  openWindowMs: 25_000,
  antiSnipeMs: 10_000,
  skipVoteMs: 10_000,
  revealMs: 6_000,
  reconnectSeconds: 60,
};

export interface PlayerState {
  playerId: string;
  name: string;
  /** Saldo restante en millones. */
  budget: number;
  /** Hueco de la formacion -> cardId fichado. */
  squad: Partial<Record<Slot, string>>;
  connected: boolean;
}

/** Oferta visible para todos durante la carta en curso. */
export interface BidRecord {
  playerId: string;
  amount: number;
}

export interface AuctionState {
  phase: Phase;
  /** Indice dentro de SLOTS: la ronda en curso. */
  slotIndex: number;
  /**
   * Cartas de la ronda que aun no se han resuelto.
   * La posicion 0 es la que esta sobre la mesa ahora mismo.
   */
  remainingCards: string[];
  /** Puja vigente en millones. 0 significa que nadie ha pujado. */
  currentBid: number;
  currentBidderId: string | null;
  /** Precio que exige la primera puja de la carta actual. */
  openingBid: number;
  /** Ultimas ofertas aceptadas de la carta actual, de antigua a reciente. */
  bidHistory: BidRecord[];
  /**
   * Cierre de la ventana vigente, como marca de tiempo absoluta en ms (D1):
   * de apertura mientras `currentBid === 0`, de anti-snipe en cuanto entra
   * la primera puja. Nunca 0 durante BIDDING -- siempre hay una ventana
   * armada, para que una carta sin pujas ni pases se resuelva sola.
   */
  endsAt: number;
  /** playerId -> voto emitido en la votacion de salto. */
  skipVotes: Record<string, boolean>;
  /**
   * Tras una votacion de salto fallida, la lista de quienes pueden pujar.
   * `null` significa que la subasta esta abierta a todos.
   */
  restrictedBidders: string[] | null;
  /**
   * playerId -> `true` de quien ha pasado la carta actual (D2). Se vacia al
   * abrir cada carta -- ver `openBidding()` en AuctionRoom -- y tambien al
   * llegar una puja (`applyBid`) o al reanudar en fase restringida, porque
   * en los dos casos el conjunto de quien puede pasar cambia y un pase
   * antiguo no debe colar como si fuera nuevo. Ver `resolvePass` en
   * `pass.ts` para como se usa.
   */
  passes: Record<string, true>;
  players: PlayerState[];
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** El hueco de la formacion que se esta subastando ahora. */
export function currentSlot(state: AuctionState): Slot {
  const slot = SLOTS[state.slotIndex];
  if (!slot) throw new RangeError(`slotIndex fuera de rango: ${state.slotIndex}`);
  return slot;
}

/** La carta sobre la mesa, o null si la ronda no tiene ninguna. */
export function currentCardId(state: AuctionState): string | null {
  return state.remainingCards[0] ?? null;
}

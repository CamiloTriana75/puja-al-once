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

export interface Rules {
  /** Presupuesto inicial de cada jugador, en millones. */
  startingBudget: number;
  /** Precio de salida de cualquier candidato, en millones. */
  basePrice: number;
  /** Subida minima sobre la puja vigente, en millones. */
  minIncrement: number;
  /** Duracion de la subasta antes de la primera puja. */
  bidTimerMs: number;
  /** A cuanto se empuja el cierre tras cada puja aceptada. */
  antiSnipeMs: number;
  /** Duracion de la votacion de salto. */
  skipVoteMs: number;
  /** Cuanto se muestra la carta revelada. */
  revealMs: number;
  /** Margen de reconexion tras una desconexion. */
  reconnectSeconds: number;
}

export const DEFAULT_RULES: Rules = {
  startingBudget: 100,
  basePrice: 2,
  minIncrement: 1,
  bidTimerMs: 15_000,
  antiSnipeMs: 6_000,
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
  /** Cierre de la subasta como marca de tiempo absoluta en ms. */
  endsAt: number;
  /** playerId -> voto emitido en la votacion de salto. */
  skipVotes: Record<string, boolean>;
  /**
   * Tras una votacion de salto fallida, la lista de quienes pueden pujar.
   * `null` significa que la subasta esta abierta a todos.
   */
  restrictedBidders: string[] | null;
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

import { ArraySchema, defineTypes, MapSchema, Schema } from "@colyseus/schema";

/**
 * Un jugador humano de la sala.
 * `squad` mapea hueco de la formacion -> cardId fichado.
 *
 * `connected` mezcla dos cosas para las reglas del juego: "se le cayo la
 * conexion" y "ha vuelto pero la ronda en curso todavia no cuenta con el"
 * (ver AuctionRoom.onReconnected/flushPendingRejoins) -- ambas se proyectan
 * como `connected = false` a proposito, porque para pujar y para
 * playersNeedingSlot son el mismo caso. `rejoinPending` distingue las dos
 * de cara al navegador: con el socket vivo, decirle a alguien "estas
 * desconectado" cuando no lo esta es la parte que mas duele.
 */
export class PlayerSchema extends Schema {
  playerId!: string;
  name!: string;
  budget!: number;
  connected!: boolean;
  rejoinPending = false;
  squad = new MapSchema<string>();
}
defineTypes(PlayerSchema, {
  playerId: "string",
  name: "string",
  budget: "number",
  connected: "boolean",
  rejoinPending: "boolean",
  squad: { map: "string" },
});

/**
 * La carta sobre la mesa.
 *
 * `publicId` es un identificador opaco, aleatorio y valido solo para esta
 * partida -- NUNCA `cardId`. El `cardId` real ES la respuesta (identifica
 * jugador y temporada), asi que no puede viajar en claro antes del reveal.
 * Tampoco viaja `silhouetteId`: el navegador pediria la imagen por su nombre
 * de fichero real, filtrando al jugador por la URL aunque el Schema estuviera
 * limpio. La ruta de siluetas resuelve `publicId` -> fichero en el servidor.
 *
 * Los seis campos privados (`name`, `season`, `club`, `league`, `nation`,
 * `rating`) se quedan en su valor vacio hasta la fase REVEAL. Escribirlos antes
 * los publica al navegador: el Schema entero se sincroniza y se lee en DevTools.
 */
export class PublicCardSchema extends Schema {
  publicId!: string;
  slot!: string;
  heightCm!: number;
  foot!: string;
  ageBand!: string;
  continent!: string;
  decade!: string;

  revealed = false;
  name = "";
  season = 0;
  club = "";
  league = "";
  nation = "";
  rating = 0;
}
defineTypes(PublicCardSchema, {
  publicId: "string",
  slot: "string",
  heightCm: "number",
  foot: "string",
  ageBand: "string",
  continent: "string",
  decade: "string",
  revealed: "boolean",
  name: "string",
  season: "number",
  club: "string",
  league: "string",
  nation: "string",
  rating: "number",
});

/** Carta ya revelada, guardada para que el cliente pueda pintar las plantillas. */
export class RevealedCardSchema extends Schema {
  cardId!: string;
  slot!: string;
  silhouetteId!: string;
  name!: string;
  season!: number;
  club!: string;
  league!: string;
  nation!: string;
  rating!: number;
  /** Quien se la llevo, o "" si se descarto. */
  ownerId!: string;
  /** Lo que se pago. 0 si se descarto. */
  price!: number;
}
defineTypes(RevealedCardSchema, {
  cardId: "string",
  slot: "string",
  silhouetteId: "string",
  name: "string",
  season: "number",
  club: "string",
  league: "string",
  nation: "string",
  rating: "number",
  ownerId: "string",
  price: "number",
});

export class StandingSchema extends Schema {
  playerId!: string;
  points!: number;
  totalRating!: number;
  budgetLeft!: number;
  rank!: number;
}
defineTypes(StandingSchema, {
  playerId: "string",
  points: "number",
  totalRating: "number",
  budgetLeft: "number",
  rank: "number",
});

/** Oferta aceptada, en orden cronologico dentro de la carta actual. */
export class BidRecordSchema extends Schema {
  playerId!: string;
  amount!: number;
}

defineTypes(BidRecordSchema, {
  playerId: "string",
  amount: "number",
});

export class AuctionRoomState extends Schema {
  phase = "LOBBY";
  slotIndex = 0;
  currentSlot = "";
  currentCard: PublicCardSchema | undefined = undefined;
  currentBid = 0;
  currentBidderId = "";
  openingBid = 0;
  minimumBid = 0;
  bidHistory = new ArraySchema<BidRecordSchema>();
  /** Marca de tiempo absoluta del cierre, en ms. */
  endsAt = 0;
  /** Cartas que quedan por resolver en esta ronda, la de la mesa incluida. */
  remainingCount = 0;
  skipAvailable = false;
  skipVotes = new MapSchema<boolean>();
  restrictedBidders = new ArraySchema<string>();
  players = new MapSchema<PlayerSchema>();
  revealedCards = new MapSchema<RevealedCardSchema>();
  standings = new ArraySchema<StandingSchema>();
}
defineTypes(AuctionRoomState, {
  phase: "string",
  slotIndex: "number",
  currentSlot: "string",
  currentCard: PublicCardSchema,
  currentBid: "number",
  currentBidderId: "string",
  openingBid: "number",
  minimumBid: "number",
  bidHistory: [BidRecordSchema],
  endsAt: "number",
  remainingCount: "number",
  skipAvailable: "boolean",
  skipVotes: { map: "boolean" },
  restrictedBidders: ["string"],
  players: { map: PlayerSchema },
  revealedCards: { map: RevealedCardSchema },
  standings: [StandingSchema],
});

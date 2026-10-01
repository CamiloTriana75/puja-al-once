/**
 * Contrato del chat de la sala. El cliente no importa `@fut/shared` (ver la
 * cabecera de liveStandings.ts), asi que estos dos valores se repiten aqui;
 * el servidor es quien manda: recorta a CHAT_MAX_LENGTH y limpia el texto.
 * Mantenerlos iguales que en packages/shared/src/chat.ts.
 */
export const CHAT_MAX_LENGTH = 200;

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

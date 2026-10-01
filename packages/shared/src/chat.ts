/** Chat de texto de la sala. Reglas compartidas por servidor (valida) y cliente (limita el campo). */
export const CHAT_MAX_LENGTH = 200;
/** Mensajes que el servidor recuerda por sala para quien entra o se reconecta. */
export const CHAT_HISTORY_SIZE = 50;

/** Un mensaje ya aceptado por el servidor. */
export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

// Controles C0/C1, separadores de linea y caracteres invisibles o de direccion
// (cero-ancho, LRM/RLM, LRE..RLO, aislamientos): sirven para ocultar texto o
// invertir el orden de lo que se lee.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff]/g;

/** Texto limpio listo para difundir, o `null` si no es un mensaje valido (no es texto o queda vacio). */
export function sanitizeChatText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH).trim();
  return text === "" ? null : text;
}

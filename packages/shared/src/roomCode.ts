import type { Rng } from "./types.js";

/**
 * Se dicta por audio de WhatsApp, asi que fuera los caracteres que se
 * confunden al oido o al leerlos en una pantalla pequena: sin `0`/`O`, sin
 * `1`/`I`/`L`. Solo mayusculas -- una sola caja que decir en voz alta, sin
 * "mayuscula" ni "minuscula" de por medio.
 */
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Ni en el extremo corto ni en el largo del rango 4-6 que pide el diseno: 5 deletrea rapido por telefono y, con el alfabeto de 31 simbolos, da margen de sobra frente a colisiones entre las pocas salas que conviven a la vez. */
export const ROOM_CODE_LENGTH = 5;

/**
 * Codigo de sala legible en voz alta. Nunca usa `Math.random` -- el azar
 * entra por `rng`, igual que el resto de `packages/shared` (ver
 * `packages/server/src/setup.ts` para el mismo patron con Fisher-Yates).
 */
export function generateRoomCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.min(ROOM_CODE_ALPHABET.length - 1, Math.floor(rng() * ROOM_CODE_ALPHABET.length));
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

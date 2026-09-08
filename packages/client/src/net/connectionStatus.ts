/**
 * Clasifica el `code` que trae `Room.onLeave(code, reason)` de colyseus.js.
 *
 * Extraido a funcion pura -- separado de useRoom.ts -- por el mismo motivo
 * que describeRoomLookupError vive aparte de useRoom: es la unica parte de
 * este comportamiento que se puede testear sin levantar un socket real.
 *
 * El contrato viene de `colyseus.js@0.16.22/lib/errors/Errors.js`:
 *   CONSENTED = 4000       -- room.leave() explicito, del lado cliente o
 *                              del lado servidor via client.leave(true).
 *   DEVMODE_RESTART = 4010 -- solo en desarrollo con --devMode; no aplica
 *                              aqui, pero se trata como salida deliberada
 *                              por si el codigo llega a ejecutarse con esa
 *                              flag alguna vez.
 *   Cualquier otro codigo (normalmente 1006, "abnormal closure": el que el
 *   navegador usa cuando el socket se corta sin close frame -- exactamente
 *   lo que pasa si el proceso del servidor muere) es una caida inesperada.
 *
 * Un `code === 1000` (cierre limpio de WebSocket) tambien cuenta como
 * inesperado aqui a proposito: el servidor de este juego nunca cierra un
 * socket a proposito salvo por CONSENTED (ver AuctionRoom, que no llama a
 * `client.leave()` en ningun punto fuera de lo que Colyseus hace por su
 * cuenta) -- si algun dia el proceso se apaga en orden (SIGTERM en un
 * despliegue), el navegador tiene mas que ganar tratandolo como conexion
 * perdida y ofreciendo reconectar que asumiendo que fue una salida
 * consentida que nadie pidio.
 */
const CONSENTED_CLOSE_CODES = new Set([4000, 4010]);

export function isConsentedLeave(code: number): boolean {
  return CONSENTED_CLOSE_CODES.has(code);
}

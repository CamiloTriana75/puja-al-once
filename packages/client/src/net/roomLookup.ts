import { HTTP_URL } from "./endpoints.js";

/** Los tres motivos que puede devolver `GET /rooms/:code` -- ver packages/server/src/index.ts. */
export type RoomLookupErrorReason = "NOT_FOUND" | "FULL" | "STARTED" | string;

/**
 * Traduce el motivo de rechazo a un mensaje distinguible en castellano. El
 * codigo de sala no es secreto (al contrario que el `publicId` de las
 * cartas), asi que aqui SI conviene ser especifico: decir "llena" en vez de
 * "no existe" en vez de "ya empezo" le dice a quien pregunta que hacer a
 * continuacion.
 */
export function describeRoomLookupError(reason: RoomLookupErrorReason): string {
  switch (reason) {
    case "NOT_FOUND":
      return "Ese código de sala no existe. Revísalo con quien te lo ha pasado.";
    case "FULL":
      return "Esa sala ya está llena.";
    case "STARTED":
      return "Esa partida ya ha empezado.";
    default:
      return "No se ha podido entrar en la sala.";
  }
}

export interface RoomLookupResult {
  ok: boolean;
  roomId?: string;
  reason?: RoomLookupErrorReason;
}

/**
 * Resuelve un codigo de sala al `roomId` interno que necesita
 * `client.joinById`. Paso HTTP previo y separado del join por WebSocket a
 * proposito: es lo que permite devolver un motivo de rechazo distinguible
 * (ver describeRoomLookupError) en vez del "no se encontraron salas"
 * generico que da el matchmaking de Colyseus cuando una sala esta
 * bloqueada, sin decir si es porque esta llena o porque ya empezo.
 */
export async function lookupRoomByCode(code: string): Promise<RoomLookupResult> {
  const res = await fetch(`${HTTP_URL}/rooms/${encodeURIComponent(code)}`);
  const body = (await res.json()) as { roomId?: string; reason?: string };
  if (res.ok) return { ok: true, roomId: body.roomId };
  return { ok: false, reason: body.reason };
}

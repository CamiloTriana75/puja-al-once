import { useSyncExternalStore } from "react";
import { HTTP_URL } from "./endpoints.js";

export type FeedbackKind = "bug" | "sugerencia" | "otro";

export interface FeedbackPayload {
  kind: FeedbackKind;
  message: string;
  contact: string;
  /** Campo trampa contra bots: la interfaz lo deja siempre vacio. */
  website?: string;
}

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 1500;
export const CONTACT_MAX = 120;

export type SendFeedbackResult = { ok: true } | { ok: false; message: string };

const ERRORS: Record<string, string> = {
  MESSAGE_TOO_SHORT: "Cuéntanos un poco más (al menos 5 caracteres).",
  MESSAGE_TOO_LONG: `El mensaje es demasiado largo (máximo ${MESSAGE_MAX} caracteres).`,
  CONTACT_TOO_LONG: `El contacto es demasiado largo (máximo ${CONTACT_MAX} caracteres).`,
  RATE_LIMITED: "Has enviado varios comentarios seguidos. Prueba de nuevo en unos minutos.",
};

/** Envia un comentario al servidor y traduce el rechazo a un mensaje para el jugador. */
export async function sendFeedback(payload: FeedbackPayload): Promise<SendFeedbackResult> {
  try {
    const response = await fetch(`${HTTP_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: ERRORS[body.error ?? ""] ?? "No se pudo enviar. Inténtalo de nuevo en un momento." };
  } catch {
    return { ok: false, message: "No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo." };
  }
}

// Estado del dialogo de comentarios, compartido por toda la interfaz: cualquier
// boton llama a `openFeedback()` y `<FeedbackHost>` (montado una sola vez en
// App) pinta el dialogo.
let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openFeedback(): void {
  open = true;
  emit();
}

export function closeFeedback(): void {
  open = false;
  emit();
}

export function useFeedbackOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
}

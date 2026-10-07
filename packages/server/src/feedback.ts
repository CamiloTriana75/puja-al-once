/**
 * Comentarios de los jugadores (bugs, sugerencias, otros). Validacion pura,
 * sin Express ni disco: la ruta de `index.ts` solo recibe el JSON, llama aqui
 * y guarda lo que salga.
 *
 * No hay cuentas ni cookies en este juego, asi que el unico dato personal
 * posible es el contacto opcional que el jugador decida escribir.
 */
export const FEEDBACK_KINDS = ["bug", "sugerencia", "otro"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 1500;
export const CONTACT_MAX = 120;

export interface FeedbackEntry {
  kind: FeedbackKind;
  message: string;
  contact: string;
}

export type FeedbackResult =
  | { ok: true; entry: FeedbackEntry }
  | { ok: false; error: "INVALID_BODY" | "INVALID_KIND" | "MESSAGE_TOO_SHORT" | "MESSAGE_TOO_LONG" | "CONTACT_TOO_LONG" | "SPAM" };

/** Quita caracteres de control (salvo salto de linea y tabulador) y recorta. */
function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export function parseFeedback(body: unknown): FeedbackResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "INVALID_BODY" };
  const { kind, message, contact, website } = body as Record<string, unknown>;

  // Campo trampa: la pagina no lo muestra, solo lo rellenan los bots.
  if (typeof website === "string" && website.trim() !== "") return { ok: false, error: "SPAM" };

  if (typeof kind !== "string" || !(FEEDBACK_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "INVALID_KIND" };
  }
  if (typeof message !== "string") return { ok: false, error: "INVALID_BODY" };
  const text = clean(message);
  if (text.length < MESSAGE_MIN) return { ok: false, error: "MESSAGE_TOO_SHORT" };
  if (text.length > MESSAGE_MAX) return { ok: false, error: "MESSAGE_TOO_LONG" };

  const how = typeof contact === "string" ? clean(contact) : "";
  if (how.length > CONTACT_MAX) return { ok: false, error: "CONTACT_TOO_LONG" };

  return { ok: true, entry: { kind: kind as FeedbackKind, message: text, contact: how } };
}


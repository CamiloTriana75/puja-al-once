import { describe, expect, it } from "vitest";
import { CONTACT_MAX, MESSAGE_MAX, parseFeedback } from "../src/feedback.js";

describe("parseFeedback", () => {
  it("acepta un comentario valido y lo normaliza", () => {
    const result = parseFeedback({ kind: "bug", message: "  La foto de Messi no se ve  ", contact: " ana@correo.com " });
    expect(result).toEqual({ ok: true, entry: { kind: "bug", message: "La foto de Messi no se ve", contact: "ana@correo.com" } });
  });

  it("el contacto es opcional", () => {
    const result = parseFeedback({ kind: "sugerencia", message: "Mas jugadores de los 90" });
    expect(result).toEqual({ ok: true, entry: { kind: "sugerencia", message: "Mas jugadores de los 90", contact: "" } });
  });

  it("rechaza cuerpos que no son un objeto", () => {
    expect(parseFeedback(null)).toEqual({ ok: false, error: "INVALID_BODY" });
    expect(parseFeedback("hola")).toEqual({ ok: false, error: "INVALID_BODY" });
  });

  it("rechaza un tipo desconocido", () => {
    expect(parseFeedback({ kind: "queja", message: "Mensaje valido" })).toEqual({ ok: false, error: "INVALID_KIND" });
  });

  it("rechaza mensajes demasiado cortos o demasiado largos", () => {
    expect(parseFeedback({ kind: "bug", message: "  hi  " })).toEqual({ ok: false, error: "MESSAGE_TOO_SHORT" });
    expect(parseFeedback({ kind: "bug", message: "x".repeat(MESSAGE_MAX + 1) })).toEqual({ ok: false, error: "MESSAGE_TOO_LONG" });
  });

  it("rechaza un contacto demasiado largo", () => {
    expect(parseFeedback({ kind: "otro", message: "Mensaje valido", contact: "x".repeat(CONTACT_MAX + 1) })).toEqual({
      ok: false,
      error: "CONTACT_TOO_LONG",
    });
  });

  it("descarta lo que rellena el campo trampa de los bots", () => {
    expect(parseFeedback({ kind: "bug", message: "Mensaje valido", website: "http://spam.example" })).toEqual({ ok: false, error: "SPAM" });
  });

  it("elimina caracteres de control pero conserva los saltos de linea", () => {
    const result = parseFeedback({ kind: "bug", message: "linea uno\u0000\nlinea dos\u0007" });
    expect(result).toEqual({ ok: true, entry: { kind: "bug", message: "linea uno\nlinea dos", contact: "" } });
  });
});

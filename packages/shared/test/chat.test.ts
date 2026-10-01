import { describe, expect, it } from "vitest";
import { CHAT_MAX_LENGTH, sanitizeChatText } from "../src/index.js";

describe("sanitizeChatText", () => {
  it("recorta espacios y deja el texto normal intacto", () => {
    expect(sanitizeChatText("  ¡Vaya puja, Ana!  ")).toBe("¡Vaya puja, Ana!");
  });

  it("rechaza lo que no es texto o queda vacio", () => {
    expect(sanitizeChatText(42)).toBeNull();
    expect(sanitizeChatText(undefined)).toBeNull();
    expect(sanitizeChatText("   \n\t ")).toBeNull();
    expect(sanitizeChatText("\u200b\u200e")).toBeNull();
  });

  it("convierte saltos de linea y controles en espacios simples", () => {
    expect(sanitizeChatText("hola\n\nque\u0007 tal")).toBe("hola que tal");
  });

  it("quita caracteres de direccion que invertirian el texto", () => {
    expect(sanitizeChatText("a\u202eb")).toBe("a b");
  });

  it(`corta a ${CHAT_MAX_LENGTH} caracteres`, () => {
    expect(sanitizeChatText("x".repeat(500))).toHaveLength(CHAT_MAX_LENGTH);
  });
});

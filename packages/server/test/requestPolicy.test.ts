import { describe, expect, it } from "vitest";
import { isAllowedOrigin, RateLimiter } from "../src/requestPolicy.js";
import { AuctionRoom } from "../src/AuctionRoom.js";

describe("politica de peticiones", () => {
  it("permite origen del mismo host, origenes configurados y localhost en desarrollo", () => {
    expect(isAllowedOrigin("https://juego.example", "juego.example", "production")).toBe(true);
    expect(isAllowedOrigin("https://web.example", "api.example", "production", "https://web.example")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", "localhost:2567", "development")).toBe(true);
  });

  it("rechaza origenes externos no configurados en produccion y admite clientes sin Origin", () => {
    expect(isAllowedOrigin("https://intruso.example", "juego.example", "production")).toBe(false);
    expect(isAllowedOrigin(undefined, "juego.example", "production")).toBe(true);
  });

  it("aplica un limite por ventana y deja pasar de nuevo al expirar", () => {
    const limiter = new RateLimiter();
    expect(limiter.allow("ip-a", 2, 1_000, 10_000)).toBe(true);
    expect(limiter.allow("ip-a", 2, 1_000, 10_100)).toBe(true);
    expect(limiter.allow("ip-a", 2, 1_000, 10_200)).toBe(false);
    expect(limiter.allow("ip-a", 2, 1_000, 11_000)).toBe(true);
    expect(limiter.allow("ip-b", 2, 1_000, 11_000)).toBe(true);
  });

  it("el matchmaking rechaza un origen externo mediante el hook estático de Colyseus", async () => {
    await expect(AuctionRoom.onAuth("", {}, {
      headers: { origin: "https://intruso.example", host: "juego.example" },
      ip: "203.0.113.9",
    })).rejects.toThrow("Origen no permitido");
  });
});

import { describe, expect, it } from "vitest";
import { clientAddress, isAllowedOrigin, RateLimiter } from "../src/requestPolicy.js";
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

describe("dirección del cliente tras un proxy", () => {
  const PROXY_SOCKET = "10.0.0.7";

  it("usa Fly-Client-IP cuando sigue desplegándose en Fly", () => {
    const previous = process.env.FLY_APP_NAME;
    process.env.FLY_APP_NAME = "futbolera";
    try {
      expect(clientAddress({ "fly-client-ip": "198.51.100.4" }, PROXY_SOCKET)).toBe("198.51.100.4");
    } finally {
      if (previous === undefined) delete process.env.FLY_APP_NAME;
      else process.env.FLY_APP_NAME = previous;
    }
  });

  it("ignora Fly-Client-IP si no se está en Fly, para no confiar en un cliente que lo invente", () => {
    const previous = process.env.FLY_APP_NAME;
    delete process.env.FLY_APP_NAME;
    try {
      expect(clientAddress({ "fly-client-ip": "198.51.100.4" }, PROXY_SOCKET)).toBe(PROXY_SOCKET);
    } finally {
      if (previous !== undefined) process.env.FLY_APP_NAME = previous;
    }
  });

  it("separa a los usuarios detrás del proxy de Render en vez de fusionarlos", () => {
    // Es el caso que rompía el límite por IP: sin esto todos los usuarios
    // de Render comparten la IP del proxy y el cubo es global.
    expect(clientAddress({ "x-forwarded-for": "203.0.113.9" }, PROXY_SOCKET)).toBe("203.0.113.9");
    expect(clientAddress({ "x-forwarded-for": "203.0.113.10" }, PROXY_SOCKET)).toBe("203.0.113.10");
  });

  it("toma la última entrada de X-Forwarded-For, que es la que vio el proxy de confianza", () => {
    // Lo que va delante lo elige el cliente y es falsificable. Si el proxy
    // reemplaza la cabecera hay una sola entrada y también es la real, así
    // que la última sirve en los dos casos.
    expect(clientAddress({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }, PROXY_SOCKET)).toBe("203.0.113.9");
    expect(clientAddress({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.9" }, PROXY_SOCKET)).toBe("203.0.113.9");
  });

  it("acepta la cabecera como array y descarta entradas vacías", () => {
    expect(clientAddress({ "x-forwarded-for": ["203.0.113.9"] }, PROXY_SOCKET)).toBe("203.0.113.9");
    expect(clientAddress({ "x-forwarded-for": "  , 203.0.113.9 ,  " }, PROXY_SOCKET)).toBe("203.0.113.9");
  });

  it("cae al socket sin cabecera y nunca devuelve cadena vacía", () => {
    expect(clientAddress({}, PROXY_SOCKET)).toBe(PROXY_SOCKET);
    expect(clientAddress({}, undefined)).toBe("unknown");
    expect(clientAddress({}, "   ")).toBe("unknown");
    expect(clientAddress({ "x-forwarded-for": "  " }, PROXY_SOCKET)).toBe(PROXY_SOCKET);
  });
});

describe("límite del vestuario público con la consulta de la landing", () => {
  it("aguanta a diez clientes en la misma IP, que es el caso de una casa con amigos", () => {
    // La landing consulta /rooms/public cada 10 s = 6/min por cliente. Con
    // el limite en 20, el cuarto cliente de la misma IP se comia el cubo.
    const limiter = new RateLimiter();
    const address = "203.0.113.9";
    let allowed = 0;
    for (let i = 0; i < 10; i += 1) {
      for (let tick = 0; tick < 6; tick += 1) {
        if (limiter.allow(address, 60, 60_000, 1_000)) allowed += 1;
      }
    }
    expect(allowed).toBe(60);
  });

  it("sigue rechazando a quien dispara por encima de lo razonable", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 60; i += 1) {
      expect(limiter.allow("ip", 60, 60_000, 1_000)).toBe(true);
    }
    expect(limiter.allow("ip", 60, 60_000, 1_000)).toBe(false);
  });
});

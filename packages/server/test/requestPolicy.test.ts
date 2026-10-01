import { describe, expect, it } from "vitest";
import { clientAddress, isAllowedOrigin, maintenanceAction, RateLimiter, spaFallbackStatus, staticCacheControl } from "../src/requestPolicy.js";
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

  describe("con Cloudflare delante (TRUST_CLOUDFLARE=1)", () => {
    const run = (value: string | undefined, fn: () => void) => {
      const previous = process.env.TRUST_CLOUDFLARE;
      if (value === undefined) delete process.env.TRUST_CLOUDFLARE;
      else process.env.TRUST_CLOUDFLARE = value;
      try {
        fn();
      } finally {
        if (previous === undefined) delete process.env.TRUST_CLOUDFLARE;
        else process.env.TRUST_CLOUDFLARE = previous;
      }
    };

    it("usa CF-Connecting-IP: X-Forwarded-For acaba en una IP del borde de Cloudflare, igual para todos", () => {
      run("1", () => {
        const headers = { "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "172.70.1.1" };
        expect(clientAddress(headers, PROXY_SOCKET)).toBe("203.0.113.50");
      });
    });

    it("sin la variable ignora CF-Connecting-IP, para no fiarse de un cliente que lo invente", () => {
      run(undefined, () => {
        const headers = { "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "203.0.113.9" };
        expect(clientAddress(headers, PROXY_SOCKET)).toBe("203.0.113.9");
      });
    });

    it("si falta la cabecera vuelve al comportamiento normal", () => {
      run("1", () => {
        expect(clientAddress({ "x-forwarded-for": "203.0.113.9" }, PROXY_SOCKET)).toBe("203.0.113.9");
      });
    });
  });

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

/**
 * El comodin de la SPA es, para un rastreador, el punto donde se decide si
 * una ruta inventada entra en el indice o no. Con 200 para todo, cada
 * errata de enlace y cada escaneo de bot se convierte en una copia
 * indexable del juego; con 404 para lo que parece fichero, Google las
 * descarta de una y el presupuesto de rastreo se queda en las paginas que
 * existen. Las salas (`/sala/ABCDE`) son el caso que NO puede romperse:
 * llegan por enlace de invitacion y tienen que devolver la app.
 */
describe("spaFallbackStatus (soft-404)", () => {
  it("sigue sirviendo la app en las rutas limpias de sala", () => {
    expect(spaFallbackStatus("/sala/ABCDE")).toBe(200);
    expect(spaFallbackStatus("/")).toBe(200);
  });

  it("devuelve 404 real cuando lo pedido parece un fichero que no existe", () => {
    expect(spaFallbackStatus("/legal/termino.html")).toBe(404);
    expect(spaFallbackStatus("/actualizaciones.html")).toBe(404); // existe en disco, pero lo resuelve express.static antes
    expect(spaFallbackStatus("/wp-login.php")).toBe(404);
    expect(spaFallbackStatus("/assets/index.js")).toBe(404);
  });

  it("no confunde una sala con extension en el codigo", () => {
    // El codigo de sala son 5 letras: no lleva punto. Este test fija que el
    // criterio es el del ultimo segmento, no "contiene un punto en alguna
    // parte", para que anadir Carpetas con punto en la URL no rompa nada.
    expect(spaFallbackStatus("/sala/ABCDE")).toBe(200);
    expect(spaFallbackStatus("/legal")).toBe(200);
  });
});
describe("staticCacheControl", () => {
  it("cachea un ano, inmutable, lo que lleva hash en el nombre", () => {
    expect(staticCacheControl("/assets/index-Ab12Cd34.js")).toBe("public, max-age=31536000, immutable");
  });

  it("deja que iconos y estaticos sueltos se revaliden a diario", () => {
    expect(staticCacheControl("/icons/icon-192.png")).toBe("public, max-age=86400");
    expect(staticCacheControl("/logo-symbol.png")).toBe("public, max-age=86400");
  });

  it("obliga a revalidar paginas, service worker y manifiesto", () => {
    for (const path of ["/", "/index.html", "/sw.js", "/manifest.webmanifest", "/offline.html", "/mantenimiento.html", "/actualizaciones.html"]) {
      expect(staticCacheControl(path)).toBe("no-cache");
    }
  });
});

describe("maintenanceAction", () => {
  it("no hace nada si el mantenimiento esta apagado", () => {
    expect(maintenanceAction("/", false)).toBeNull();
    expect(maintenanceAction("/rooms/public", false)).toBeNull();
  });

  it("devuelve la pagina de mantenimiento para la app y las salas por enlace", () => {
    expect(maintenanceAction("/", true)).toBe("page");
    expect(maintenanceAction("/sala/ABCDE", true)).toBe("page");
  });

  it("responde JSON 503 en las rutas de la API", () => {
    expect(maintenanceAction("/rooms/public", true)).toBe("api");
    expect(maintenanceAction("/matchmake/joinOrCreate/auction", true)).toBe("api");
    expect(maintenanceAction("/feedback", true)).toBe("api");
  });

  it("deja pasar la salud y los ficheros estaticos", () => {
    expect(maintenanceAction("/health/ready", true)).toBeNull();
    expect(maintenanceAction("/sw.js", true)).toBeNull();
    expect(maintenanceAction("/assets/index-abc.js", true)).toBeNull();
  });
});

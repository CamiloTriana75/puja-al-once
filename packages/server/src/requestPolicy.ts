interface Bucket {
  count: number;
  resetAt: number;
}

/** Rate limiter in-memory, adecuado mientras el servidor opera con una sola instancia. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private operations = 0;

  allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    this.operations += 1;
    if (this.operations % 256 === 0) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(bucketKey);
      }
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }
}

export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  nodeEnv = process.env.NODE_ENV,
  configuredOrigins = process.env.PUBLIC_ORIGINS ?? process.env.PUBLIC_ORIGIN ?? "",
): boolean {
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const configured = configuredOrigins
    .split(/[\s,]+/)
    .filter(Boolean)
    .some((value) => {
      try {
        return new URL(value).origin === parsed.origin;
      } catch {
        return false;
      }
    });
  if (configured) return true;
  if (host && parsed.host.toLowerCase() === host.toLowerCase()) return true;

  return nodeEnv !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
}

/**
 * Direccion del cliente para el limitador de peticiones.
 *
 * Fly aporta `Fly-Client-IP` y Render usa `X-Forwarded-For`. Sin esto,
 * detras de cualquiera de los dos proxies `req.socket.remoteAddress` es la
 * IP del proxy, la misma para todos los usuarios: el limite por IP se
 * convertiria en un limite global y a los pocos jugadores empezarian los
 * 429.
 *
 * De `X-Forwarded-For` se lee la ULTIMA entrada, no la primera. Un proxy
 * que anade la IP real al final deja delante lo que mando el cliente, que
 * es falsificable a voluntad; la ultima es la que vio el proxy de
 * confianza. Asi funciona igual tanto si el proxy reemplaza la cabecera
 * (una sola entrada, la real) como si la anade.
 *
 * Esto no es un control de seguridad: el control real es `isAllowedOrigin`.
 * Confiar en la cabecera assume que el servicio corre detras del proxy de
 * la plataforma, que es el despliegue de este proyecto.
 */
export function clientAddress(
  headers: Record<string, string | string[] | undefined>,
  fallback: string | string[] | undefined,
): string {
  const flyIp = headers["fly-client-ip"];
  if (process.env.FLY_APP_NAME && typeof flyIp === "string" && flyIp.trim()) return flyIp.trim();

  // Con Cloudflare delante, la ultima entrada de X-Forwarded-For es una IP del
  // borde de Cloudflare (la misma para miles de usuarios): el limite por IP se
  // volveria casi global. Cloudflare pone la IP real en CF-Connecting-IP. Solo se
  // lee si se declara (TRUST_CLOUDFLARE=1) porque un cliente que llegue al origen
  // sin pasar por Cloudflare podria inventarsela para esquivar el limite.
  const cfIp = headers["cf-connecting-ip"];
  if (process.env.TRUST_CLOUDFLARE === "1" && typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();

  const forwarded = headers["x-forwarded-for"];
  const chain = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const last = chain[chain.length - 1];
  if (last) return last;

  const address = Array.isArray(fallback) ? fallback[0] : fallback;
  return address?.trim() || "unknown";
}

/**
 * Codigo de estado con el que el comodin de la SPA (`app.get("/{*splat}")`)
 * responde en produccion.
 *
 * El problema que resuelve: `express.static` ya respondio 404 de verdad a
 * todo lo que existe, asi que lo que llega aqui NO es un fichero real. Sin
 * esta funcion, esas rutas inexistentes se servian con 200 y el HTML del
 * juego, y para un rastreador eso es un "soft 404": contenido duplicado
 * indexable en rutas que no existen (una errata en un enlace, un escaneo de
 * bot, `/legal/termino.html` sin la "s"). Google llega a tratar cada una
 * como una pagina mas del sitio, se come el presupuesto de rastreo y nunca
 * las ve como lo que son. Un 404 de verdad las saca del indice de una vez.
 *
 * El criterio es "el ultimo segmento parece un nombre de fichero": si lleva
 * un punto, es que alguien pidio un fichero y no existe -> 404. Y todo lo
 * demas sigue siendo 200 a proposito, porque es lo que hace funcionar el
 * juego: las salas son rutas limpias (`/sala/ABCDE`, sin extension) y quien
 * llega por un enlace de invitacion tiene que recibir la app, no un 404.
 *
 * Por eso NO se prueba "la ruta no es la raiz" como hasta ahora: /sala/CODE es
 * justo el caso que tiene que seguir sirviendo la SPA.
 */
export function spaFallbackStatus(pathname: string): 200 | 404 {
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  return lastSegment.includes(".") ? 404 : 200;
}

/**
 * Modo mantenimiento (MAINTENANCE_MODE=1). Decide que hacer con una peticion:
 *  - "page": una pagina o ruta de la app -> pagina de mantenimiento con 503.
 *  - "api": crear/buscar salas o enviar comentarios -> JSON 503.
 *  - null: pasa. El monitor de Colyseus y las comprobaciones de salud tienen que seguir en 200 o Render
 *    marcaria la instancia como caida y la reiniciaria en pleno mantenimiento.
 *    Los ficheros estaticos tambien pasan: la pagina no los necesita, pero el
 *    service worker y el manifiesto si deben poder actualizarse.
 */
export function maintenanceAction(pathname: string, enabled: boolean): "page" | "api" | null {
  if (!enabled) return null;
  if (pathname.startsWith("/health/")) return null;
  // El panel de monitor (protegido con contrasena) tiene que seguir accesible mientras se actualiza.
  if (pathname === "/colyseus" || pathname.startsWith("/colyseus/")) return null;
  if (/^\/(matchmake|rooms|feedback|time|photos|silhouettes)(\/|$)/.test(pathname)) return "api";
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  // Un fichero con extension (assets, iconos, sw.js...) pasa; una ruta limpia es una pagina.
  return lastSegment.includes(".") ? null : "page";
}

/**
 * Cache-Control de los ficheros estaticos del cliente. Pensado para que una CDN
 * (Cloudflare) y el navegador cacheen lo que se puede y nada mas:
 *  - /assets/*: Vite pone un hash en el nombre, el contenido de una URL nunca
 *    cambia -> un ano, inmutable.
 *  - Paginas, service worker y manifiesto: se revalidan siempre, o una version
 *    nueva tardaria dias en llegar (y el SW viejo apuntaria a ficheros borrados).
 *  - Resto (iconos, logos, favicon): un dia.
 * Las rutas de juego (/photos, /silhouettes, /rooms, /matchmake) NO pasan por
 * aqui: llevan identificadores secretos de carta y no deben cachearse jamas.
 */
export function staticCacheControl(pathname: string): string {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname === "/" || pathname === "/sw.js" || pathname === "/manifest.webmanifest" || pathname.endsWith(".html")) return "no-cache";
  return "public, max-age=86400";
}

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Acceso al panel de Colyseus Monitor (/colyseus). El panel lista todas las
 * salas y el estado de cada partida, asi que NUNCA va abierto: solo se monta si
 * hay MONITOR_PASSWORD, detras de autenticacion basica y con limite de intentos
 * fallidos por IP.
 */

/** Una contrasena demasiado corta no protege nada: sin ella el panel no se monta. */
export const MONITOR_MIN_PASSWORD_LENGTH = 12;

export function parseBasicAuth(header: string | undefined): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

/** Compara en tiempo constante (con hashes, para que la longitud tampoco se filtre). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function credentialsMatch(
  provided: { user: string; password: string } | null,
  expected: { user: string; password: string },
): boolean {
  if (!provided) return false;
  // Se evaluan las dos para no revelar cual de ellas fallo por el tiempo de respuesta.
  const userOk = safeEqual(provided.user, expected.user);
  const passwordOk = safeEqual(provided.password, expected.password);
  return userOk && passwordOk;
}

interface FailureBucket {
  count: number;
  resetAt: number;
}

export interface MonitorGuardOptions {
  user: string;
  password: string;
  /** IP del cliente (ver clientAddress en requestPolicy.ts). */
  addressOf: (req: Request) => string;
  maxFailures?: number;
  windowMs?: number;
  now?: () => number;
}

/** Middleware de autenticacion basica con bloqueo temporal tras demasiados fallos. */
export function monitorGuard(options: MonitorGuardOptions) {
  const { user, password, addressOf, maxFailures = 10, windowMs = 10 * 60_000, now = Date.now } = options;
  const failures = new Map<string, FailureBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const address = addressOf(req);
    const bucket = failures.get(address);
    if (bucket && bucket.resetAt <= now()) failures.delete(address);

    const current = failures.get(address);
    if (current && current.count >= maxFailures) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now()) / 1000)));
      res.status(429).type("text").send("Demasiados intentos. Prueba más tarde.");
      return;
    }

    if (credentialsMatch(parseBasicAuth(req.headers.authorization), { user, password })) {
      failures.delete(address);
      res.setHeader("Cache-Control", "no-store");
      next();
      return;
    }

    failures.set(address, { count: (current?.count ?? 0) + 1, resetAt: current?.resetAt ?? now() + windowMs });
    res.setHeader("WWW-Authenticate", 'Basic realm="Puja el Once - monitor", charset="UTF-8"');
    res.status(401).type("text").send("Autenticación necesaria.");
  };
}

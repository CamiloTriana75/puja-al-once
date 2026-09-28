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

/** Fly termina TLS en el proxy y aporta Fly-Client-IP; local usa la IP del socket. */
export function clientAddress(
  headers: Record<string, string | string[] | undefined>,
  fallback: string | string[] | undefined,
): string {
  const flyIp = headers["fly-client-ip"];
  if (process.env.FLY_APP_NAME && typeof flyIp === "string" && flyIp.trim()) return flyIp.trim();
  const address = Array.isArray(fallback) ? fallback[0] : fallback;
  return address?.trim() || "unknown";
}

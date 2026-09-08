const isProd = import.meta.env.PROD;

/** En produccion el cliente se sirve desde el propio servidor: mismo origen. */
export const HTTP_URL = isProd ? window.location.origin : "http://localhost:2567";

export const WS_URL = isProd
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
  : "ws://localhost:2567";

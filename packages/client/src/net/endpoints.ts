interface EndpointOptions {
  publicServerUrl?: string;
  isProduction: boolean;
  browserOrigin: string;
}

/**
 * Permite servir el cliente y Colyseus en hosts distintos durante una prueba
 * remota. Sin `VITE_SERVER_URL`, conserva los endpoints locales habituales.
 */
export function resolveEndpoints({ publicServerUrl, isProduction, browserOrigin }: EndpointOptions) {
  const serverUrl = publicServerUrl?.trim().replace(/\/+$/, "");
  if (serverUrl) {
    return {
      HTTP_URL: serverUrl,
      WS_URL: serverUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:"),
    };
  }

  if (isProduction) {
    return {
      HTTP_URL: browserOrigin,
      WS_URL: browserOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:"),
    };
  }

  return { HTTP_URL: "http://localhost:2567", WS_URL: "ws://localhost:2567" };
}

const browserOrigin = typeof window === "undefined" ? "" : window.location.origin;

export const { HTTP_URL, WS_URL } = resolveEndpoints({
  publicServerUrl: import.meta.env.VITE_SERVER_URL,
  isProduction: import.meta.env.PROD,
  browserOrigin,
});

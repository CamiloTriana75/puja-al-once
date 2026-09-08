import { describe, expect, it } from "vitest";
import { resolveEndpoints } from "./endpoints.js";

describe("resolveEndpoints", () => {
  it("uses a public HTTPS server for both HTTP and secure WebSocket traffic", () => {
    expect(
      resolveEndpoints({
        publicServerUrl: "https://backend-123.trycloudflare.com/",
        isProduction: false,
        browserOrigin: "http://localhost:5173",
      }),
    ).toEqual({
      HTTP_URL: "https://backend-123.trycloudflare.com",
      WS_URL: "wss://backend-123.trycloudflare.com",
    });
  });

  it("keeps the existing local development endpoints without a public server", () => {
    expect(
      resolveEndpoints({
        isProduction: false,
        browserOrigin: "http://localhost:5173",
      }),
    ).toEqual({
      HTTP_URL: "http://localhost:2567",
      WS_URL: "ws://localhost:2567",
    });
  });
});

import { describe, expect, it } from "vitest";
import { isConsentedLeave } from "./connectionStatus.js";

describe("isConsentedLeave", () => {
  it("4000 (CONSENTED) es una salida deliberada", () => {
    expect(isConsentedLeave(4000)).toBe(true);
  });

  it("4010 (DEVMODE_RESTART) cuenta como deliberada, no como caida", () => {
    expect(isConsentedLeave(4010)).toBe(true);
  });

  it("1006 (cierre anomalo -- el que deja un proceso de servidor muerto) NO es deliberada", () => {
    expect(isConsentedLeave(1006)).toBe(false);
  });

  it("1000 (cierre limpio de WebSocket) tampoco cuenta como deliberada aqui", () => {
    // Este servidor nunca cierra un socket a proposito salvo por CONSENTED
    // -- ver el comentario grande en connectionStatus.ts.
    expect(isConsentedLeave(1000)).toBe(false);
  });

  it("cualquier otro codigo cae del lado de conexion perdida", () => {
    expect(isConsentedLeave(1001)).toBe(false);
    expect(isConsentedLeave(1011)).toBe(false);
  });
});

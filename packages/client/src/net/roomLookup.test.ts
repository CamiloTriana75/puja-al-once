import { describe, expect, it } from "vitest";
import { describeRoomLookupError } from "./roomLookup.js";

describe("describeRoomLookupError", () => {
  it("distingue sala inexistente, llena y ya empezada con tres mensajes distintos", () => {
    const notFound = describeRoomLookupError("NOT_FOUND");
    const full = describeRoomLookupError("FULL");
    const started = describeRoomLookupError("STARTED");

    expect(new Set([notFound, full, started]).size).toBe(3);
  });

  it("el mensaje de NOT_FOUND habla de que el codigo no existe", () => {
    expect(describeRoomLookupError("NOT_FOUND")).toMatch(/c[oó]digo/i);
  });

  it("el mensaje de FULL habla de que la sala esta llena", () => {
    expect(describeRoomLookupError("FULL")).toMatch(/llena/i);
  });

  it("el mensaje de STARTED habla de que la partida ya empezo", () => {
    expect(describeRoomLookupError("STARTED")).toMatch(/empez/i);
  });

  it("un motivo desconocido cae en un mensaje generico, no revienta", () => {
    expect(describeRoomLookupError("ALGO_NUEVO")).toBeTruthy();
  });
});

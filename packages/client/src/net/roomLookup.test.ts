import { describe, expect, it, vi } from "vitest";
import { describeRoomLookupError, fetchPublicRooms } from "./roomLookup.js";

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

describe("fetchPublicRooms", () => {
  it("lee el directorio del servidor y devuelve las salas disponibles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rooms: [{ roomId: "r1", code: "ABCDE", players: 2, capacity: 4, ready: 1 }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchPublicRooms()).resolves.toEqual([
        { roomId: "r1", code: "ABCDE", players: 2, capacity: 4, ready: 1 },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/rooms\/public$/));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

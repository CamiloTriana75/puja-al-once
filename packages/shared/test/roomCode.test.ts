import { describe, expect, it } from "vitest";
import { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Rng } from "../src/index.js";

/** Determinista: siempre el primer caracter del alfabeto. */
const zeroRng: Rng = () => 0;

/** Recorre el alfabeto entero, un caracter por llamada. */
function sequentialRng(alphabetLength: number): Rng {
  let i = 0;
  return () => {
    const value = i / alphabetLength;
    i = (i + 1) % alphabetLength;
    return value;
  };
}

describe("ROOM_CODE_ALPHABET", () => {
  it("no contiene los caracteres ambiguos por audio: 0, O, 1, I, L", () => {
    for (const char of ["0", "O", "1", "I", "L"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(char);
    }
  });

  it("son solo mayusculas y digitos, sin espacios ni minusculas", () => {
    expect(ROOM_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("generateRoomCode", () => {
  it("genera un codigo de la longitud declarada", () => {
    const code = generateRoomCode(zeroRng);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(ROOM_CODE_LENGTH).toBeGreaterThanOrEqual(4);
    expect(ROOM_CODE_LENGTH).toBeLessThanOrEqual(6);
  });

  it("usa solo caracteres del alfabeto sin ambiguedades", () => {
    const code = generateRoomCode(sequentialRng(ROOM_CODE_ALPHABET.length));
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it("es determinista para el mismo Rng -- ninguna llamada a Math.random dentro", () => {
    const a = generateRoomCode(zeroRng);
    const b = generateRoomCode(zeroRng);
    expect(a).toBe(b);
  });

  it("con rng()=0 siempre produce el primer caracter del alfabeto repetido", () => {
    const code = generateRoomCode(zeroRng);
    expect(code).toBe(ROOM_CODE_ALPHABET[0]!.repeat(ROOM_CODE_LENGTH));
  });

  it("cambia de resultado si el Rng cambia", () => {
    const a = generateRoomCode(zeroRng);
    const b = generateRoomCode(sequentialRng(ROOM_CODE_ALPHABET.length));
    expect(a).not.toBe(b);
  });
});

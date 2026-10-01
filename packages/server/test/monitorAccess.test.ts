import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { credentialsMatch, monitorGuard, parseBasicAuth } from "../src/monitorAccess.js";
import { maintenanceAction } from "../src/requestPolicy.js";

const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("parseBasicAuth", () => {
  it("lee usuario y contrasena, incluso con dos puntos en la contrasena", () => {
    expect(parseBasicAuth(basic("admin", "a:b:c"))).toEqual({ user: "admin", password: "a:b:c" });
  });

  it("rechaza cabeceras ausentes, de otro esquema o mal formadas", () => {
    expect(parseBasicAuth(undefined)).toBeNull();
    expect(parseBasicAuth("Bearer abc")).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from("sin-separador").toString("base64")}`)).toBeNull();
  });
});

describe("credentialsMatch", () => {
  const expected = { user: "admin", password: "contraseña-larga-123" };

  it("acepta solo la pareja exacta", () => {
    expect(credentialsMatch({ user: "admin", password: "contraseña-larga-123" }, expected)).toBe(true);
    expect(credentialsMatch({ user: "admin", password: "otra" }, expected)).toBe(false);
    expect(credentialsMatch({ user: "root", password: "contraseña-larga-123" }, expected)).toBe(false);
    expect(credentialsMatch(null, expected)).toBe(false);
  });
});

describe("monitorGuard", () => {
  function run(guard: ReturnType<typeof monitorGuard>, authorization?: string) {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      body: "",
      setHeader: (name: string, value: string) => void (headers[name] = value),
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      type: () => res,
      send(body: string) {
        this.body = body;
        return this;
      },
    };
    const next = vi.fn();
    guard({ headers: { authorization } } as unknown as Request, res as unknown as Response, next as NextFunction);
    return { res, headers, next };
  }

  const make = (now = () => 1_000) =>
    monitorGuard({ user: "admin", password: "contraseña-larga-123", addressOf: () => "203.0.113.9", maxFailures: 3, windowMs: 60_000, now });

  it("deja pasar con credenciales correctas y pide autenticacion sin ellas", () => {
    const guard = make();
    expect(run(guard, basic("admin", "contraseña-larga-123")).next).toHaveBeenCalledOnce();

    const denied = run(guard);
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.statusCode).toBe(401);
    expect(denied.headers["WWW-Authenticate"]).toContain("Basic");
  });

  it("bloquea con 429 tras demasiados fallos, aunque despues llegue la contrasena buena", () => {
    const guard = make();
    for (let i = 0; i < 3; i++) expect(run(guard, basic("admin", "mala")).res.statusCode).toBe(401);

    const blocked = run(guard, basic("admin", "contraseña-larga-123"));
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.headers["Retry-After"]).toBeDefined();
  });

  it("vuelve a permitir intentos cuando pasa la ventana", () => {
    let now = 1_000;
    const guard = make(() => now);
    for (let i = 0; i < 3; i++) run(guard, basic("admin", "mala"));
    now += 61_000;
    expect(run(guard, basic("admin", "contraseña-larga-123")).next).toHaveBeenCalledOnce();
  });
});

describe("el monitor durante el mantenimiento", () => {
  it("sigue accesible para poder vigilar el servidor mientras se actualiza", () => {
    expect(maintenanceAction("/colyseus", true)).toBeNull();
    expect(maintenanceAction("/colyseus/api/rooms", true)).toBeNull();
  });
});

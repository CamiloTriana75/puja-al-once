import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
    motion: new Proxy({}, {
      get: (_target, tag: string) => ({ children, ...rest }: Record<string, unknown>) => {
        const Tag = tag as unknown as ElementType;
        const domProps = Object.fromEntries(Object.entries(rest).filter(([key]) =>
          !["initial", "animate", "exit", "transition", "whileTap", "whileHover", "whileInView", "viewport", "layout", "layoutId"].includes(key),
        ));
        return <Tag {...domProps}>{children as ReactNode}</Tag>;
      },
    }),
  };
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

/** El módulo guarda el evento en estado propio: se importa de cero en cada prueba. */
async function load() {
  vi.resetModules();
  const { InstallApp } = await import("../screens/landing/InstallApp.js");
  return { InstallApp };
}

function fakePrompt(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", { value, configurable: true });
}

describe("Landing: instalar la app", () => {
  const originalUa = window.navigator.userAgent;

  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  afterEach(() => {
    setUserAgent(originalUa);
    vi.unstubAllGlobals();
  });

  it("sin aviso del navegador muestra los pasos manuales", async () => {
    const { InstallApp } = await load();
    render(<InstallApp />);
    expect(screen.getByRole("heading", { name: "Ponlo en tu pantalla de inicio" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Cómo instalar desde el navegador" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Instalar la app/ })).toBeNull();
  });

  it("en iPhone explica Compartir y Añadir a pantalla de inicio", async () => {
    setUserAgent(IPHONE);
    const { InstallApp } = await load();
    render(<InstallApp />);
    expect(screen.getByRole("list", { name: "Cómo instalar en iPhone o iPad" })).toBeTruthy();
    expect(screen.getByText("Añadir a pantalla de inicio")).toBeTruthy();
  });

  it("con beforeinstallprompt ofrece el botón y lanza el diálogo nativo", async () => {
    const { InstallApp } = await load();
    render(<InstallApp />);
    const event = fakePrompt("accepted");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Instalar la app/ }));
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    // Aceptada: ya está instalada, el apartado desaparece.
    expect(screen.queryByRole("heading", { name: "Ponlo en tu pantalla de inicio" })).toBeNull();
  });

  it("si se rechaza el diálogo avisa de que se puede instalar luego", async () => {
    const { InstallApp } = await load();
    render(<InstallApp />);
    act(() => {
      window.dispatchEvent(fakePrompt("dismissed"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Instalar la app/ }));
    });
    expect(screen.getByRole("status").textContent).toMatch(/Sin problema/);
  });

  it("no aparece dentro de la app ya instalada", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("standalone"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { InstallApp } = await load();
    const { container } = render(<InstallApp />);
    expect(container.textContent).toBe("");
  });
});

import { render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Support } from "../screens/landing/Support.js";
import { donateAmountUrl, parseDonateUrl } from "./donate.js";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
    motion: new Proxy({} as Record<string, ElementType>, {
      get: (target, tag: string) => {
        target[tag] ??= ({ children, className, href, target: linkTarget, rel }: Record<string, unknown>) => {
          const Tag = tag as unknown as ElementType;
          return (
            <Tag className={className as string} href={href as string} target={linkTarget as string} rel={rel as string}>
              {children as ReactNode}
            </Tag>
          );
        };
        return target[tag];
      },
    }),
  };
});

describe("parseDonateUrl", () => {
  it("acepta enlaces https de PayPal", () => {
    expect(parseDonateUrl("https://www.paypal.me/pujaelonce")).toBe("https://www.paypal.me/pujaelonce");
    expect(parseDonateUrl("  https://paypal.me/pujaelonce ")).toBe("https://paypal.me/pujaelonce");
    expect(parseDonateUrl("https://www.paypal.com/donate/?hosted_button_id=ABC")).toContain("hosted_button_id=ABC");
  });

  it("descarta lo que no es PayPal por https", () => {
    for (const bad of [undefined, "", "   ", "http://paypal.me/x", "https://paypal.me.evil.com/x", "https://evil.com/paypal.me", "javascript:alert(1)", "no es url"]) {
      expect(parseDonateUrl(bad)).toBeNull();
    }
  });
});

describe("donateAmountUrl", () => {
  it("pone la cantidad en la ruta de paypal.me", () => {
    expect(donateAmountUrl("https://paypal.me/trianaq", 5)).toBe("https://paypal.me/trianaq/5USD");
    expect(donateAmountUrl("https://www.paypal.me/trianaq/", 10)).toBe("https://www.paypal.me/trianaq/10USD");
  });

  it("no inventa enlaces con cantidad para botones de paypal.com ni con importes raros", () => {
    expect(donateAmountUrl("https://www.paypal.com/donate/?hosted_button_id=ABC", 5)).toBeNull();
    expect(donateAmountUrl("https://paypal.me/trianaq", 0)).toBeNull();
    expect(donateAmountUrl("https://paypal.me/trianaq", 2.5)).toBeNull();
    expect(donateAmountUrl("https://paypal.me/", 5)).toBeNull();
    expect(donateAmountUrl("no es url", 5)).toBeNull();
  });
});

describe("Support", () => {
  it("no se pinta sin enlace", () => {
    const { container } = render(<Support url={null} />);
    expect(container.textContent).toBe("");
  });

  it("con enlace muestra el boton seguro y la aclaracion de que no es una entidad benefica", () => {
    render(<Support url="https://www.paypal.me/pujaelonce" />);
    const link = screen.getByRole("link", { name: /Otra cantidad con PayPal/ });
    expect(link.getAttribute("href")).toBe("https://www.paypal.me/pujaelonce");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText(/no es una entidad benéfica/)).toBeTruthy();
  });

  it("ofrece las cantidades sugeridas con enlace directo a PayPal", () => {
    render(<Support url="https://paypal.me/trianaq" donors={[]} />);
    const cafe = screen.getByRole("link", { name: /Un café/ });
    expect(cafe.getAttribute("href")).toBe("https://paypal.me/trianaq/3USD");
    expect(cafe.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /Una ronda/ }).getAttribute("href")).toBe("https://paypal.me/trianaq/5USD");
    expect(screen.getByRole("link", { name: /Un fichaje/ }).getAttribute("href")).toBe("https://paypal.me/trianaq/10USD");
  });

  it("con un boton de paypal.com no hay cantidades y el boton principal dice Donar con PayPal", () => {
    render(<Support url="https://www.paypal.com/donate/?hosted_button_id=ABC" donors={[]} />);
    expect(screen.queryByRole("link", { name: /Un café/ })).toBeNull();
    expect(screen.getByRole("link", { name: /^Donar con PayPal/ })).toBeTruthy();
  });

  it("agradece por su nombre a quien dio permiso y avisa de que solo se publica si lo pide", () => {
    render(<Support url="https://www.paypal.me/pujaelonce" donors={[{ name: "Ana" }, { name: "Beto" }]} />);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.getByText(/Solo si tú lo pides/)).toBeTruthy();
  });

  it("sin donantes invita a ser el primero en vez de dejar un hueco vacio", () => {
    render(<Support url="https://www.paypal.me/pujaelonce" donors={[]} />);
    expect(screen.getByText(/Aquí saldrá tu nombre/)).toBeTruthy();
  });
});

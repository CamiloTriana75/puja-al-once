import { render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Support } from "../screens/landing/Support.js";
import { parseDonateUrl } from "./donate.js";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    motion: new Proxy({} as Record<string, ElementType>, {
      get: (target, tag: string) => {
        target[tag] ??= ({ children, className }: { children?: ReactNode; className?: string }) => {
          const Tag = tag as unknown as ElementType;
          return <Tag className={className}>{children}</Tag>;
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

describe("Support", () => {
  it("no se pinta sin enlace", () => {
    const { container } = render(<Support url={null} />);
    expect(container.textContent).toBe("");
  });

  it("con enlace muestra el boton seguro y la aclaracion de que no es una entidad benefica", () => {
    render(<Support url="https://www.paypal.me/pujaelonce" />);
    const link = screen.getByRole("link", { name: /Donar con PayPal/ });
    expect(link.getAttribute("href")).toBe("https://www.paypal.me/pujaelonce");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText(/no es una entidad benéfica/)).toBeTruthy();
  });
});

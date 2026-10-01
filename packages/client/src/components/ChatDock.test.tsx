import { fireEvent, render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../net/chat.js";
import { ChatDock } from "./ChatDock.js";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    // Un componente estable por etiqueta: si cada acceso devolviera uno nuevo, React
    // desmontaria el panel en cada render y el input quedaria desconectado.
    motion: new Proxy({} as Record<string, ElementType>, {
      get: (target, tag: string) => {
        target[tag] ??= ({ children, ...rest }: Record<string, unknown>) => {
          const Tag = tag as unknown as ElementType;
          const domProps = Object.fromEntries(Object.entries(rest).filter(([key]) =>
            !["initial", "animate", "exit", "transition", "whileTap", "whileHover", "layout", "layoutId"].includes(key),
          ));
          return <Tag {...domProps}>{children as ReactNode}</Tag>;
        };
        return target[tag];
      },
    }),
  };
});

const msg = (id: string, playerId: string, name: string, text: string): ChatMessage => ({ id, playerId, name, text, at: 1_700_000_000_000 });

describe("ChatDock", () => {
  it("cuenta los mensajes ajenos sin leer y los pone a cero al abrir", () => {
    const messages = [msg("1", "ana", "Ana", "Hola"), msg("2", "yo", "Yo", "Buenas"), msg("3", "bea", "Bea", "¿Listos?")];
    render(<ChatDock messages={messages} myId="yo" rejectedSeq={0} onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir el chat, 2 mensajes sin leer" }));
    expect(screen.getByRole("log", { name: "Mensajes" }).textContent).toContain("¿Listos?");
    expect(screen.getByRole("log", { name: "Mensajes" }).textContent).toContain("Tú");
  });

  it("envia el texto recortado y vacia el campo; no envia vacios", () => {
    const onSend = vi.fn();
    render(<ChatDock messages={[]} myId="yo" rejectedSeq={0} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir el chat" }));

    const input = screen.getByLabelText("Escribe un mensaje") as HTMLInputElement;
    expect((screen.getByRole("button", { name: "Enviar mensaje" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "vamos con todo" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSend).toHaveBeenCalledWith("vamos con todo");
    expect(input.value).toBe("");
  });

  it("avisa de ir mas despacio cuando el servidor rechaza un mensaje", () => {
    const { rerender } = render(<ChatDock messages={[]} myId="yo" rejectedSeq={0} onSend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir el chat" }));
    rerender(<ChatDock messages={[]} myId="yo" rejectedSeq={1} onSend={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toMatch(/Más despacio/);
  });

  it("se cierra con Escape", () => {
    render(<ChatDock messages={[]} myId="yo" rejectedSeq={0} onSend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir el chat" }));
    expect(screen.getByRole("log", { name: "Mensajes" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("log", { name: "Mensajes" })).toBeNull();
  });
});

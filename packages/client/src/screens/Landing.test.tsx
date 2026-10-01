import { fireEvent, render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Landing } from "./Landing.js";
import { fetchPublicRooms } from "../net/roomLookup.js";

vi.mock("../net/roomLookup.js", () => ({
  fetchPublicRooms: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
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

describe("Landing: vestuario público", () => {
  it("muestra salas abiertas, pide un nombre y permite entrar a una de ellas", async () => {
    vi.mocked(fetchPublicRooms).mockResolvedValue([
      { roomId: "room-public-1", code: "ABCDE", players: 2, capacity: 4, ready: 1 },
    ]);
    const onJoinPublicRoom = vi.fn();

    render(<Landing error={null} onCreate={vi.fn()} onJoinByCode={vi.fn()} onJoinPublicRoom={onJoinPublicRoom} />);

    await screen.findByText("ABCDE");
    const name = screen.getByLabelText("Tu nombre en el vestuario");
    fireEvent.change(name, { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar a la sala ABCDE" }));

    expect(onJoinPublicRoom).toHaveBeenCalledWith("Ana", "room-public-1");
  });

  it("crea una sala privada por defecto", async () => {
    vi.mocked(fetchPublicRooms).mockResolvedValue([]);
    const onCreate = vi.fn();

    render(<Landing error={null} onCreate={onCreate} onJoinByCode={vi.fn()} onJoinPublicRoom={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tu nombre en el vestuario"), { target: { value: "Bea" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi sala" }));
    expect(onCreate).toHaveBeenCalledWith("Bea", "private");
  });

  it("permite elegir una sala pública al crear", async () => {
    vi.mocked(fetchPublicRooms).mockResolvedValue([]);
    const onCreate = vi.fn();
    render(<Landing error={null} onCreate={onCreate} onJoinByCode={vi.fn()} onJoinPublicRoom={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tu nombre en el vestuario"), { target: { value: "Bea" } });
    fireEvent.click(screen.getByRole("button", { name: "Pública" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear mi sala" }));
    expect(onCreate).toHaveBeenCalledWith("Bea", "public");
  });
});

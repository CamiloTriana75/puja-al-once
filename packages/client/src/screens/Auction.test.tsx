import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Auction } from "./Auction.js";
import type { IncomingReaction } from "../net/useRoom.js";
import type { ClientState, PlayerView } from "../net/types.js";

/**
 * Mismo mock que Ceremony.test.tsx: framer-motion con temporizadores falsos
 * se queda congelado en AnimatePresence (ver el comentario grande de aquel
 * fichero para el porque). Aqui interesa ademas que `useReducedMotion`
 * devuelva `false` por defecto -- estos tests activan la animacion de
 * subida explicitamente via `noRise`/fase REVEAL, no via el SO.
 */
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_target, tag: string) =>
          ({ children, ...rest }: Record<string, unknown>) => {
            const Tag = tag as unknown as ElementType;
            const domProps = Object.fromEntries(
              Object.entries(rest).filter(
                ([key]) => !["initial", "animate", "exit", "transition", "layout", "layoutId"].includes(key),
              ),
            );
            return <Tag {...domProps}>{children as ReactNode}</Tag>;
          },
      },
    ),
  };
});

function player(overrides: Partial<PlayerView> & { playerId: string; name: string }): PlayerView {
  return {
    budget: 1000,
    connected: true,
    rejoinPending: false,
    ready: false,
    squad: new Map(),
    ...overrides,
  };
}

function baseState(overrides: Partial<ClientState>): ClientState {
  return {
    roomCode: "AAAAA",
    hostId: "a",
    phase: "BIDDING",
    slotIndex: 0,
    currentSlot: "GK",
    currentBid: 0,
    currentBidderId: "",
    openingBid: 10,
    minimumBid: 10,
    bidHistory: [],
    endsAt: 0,
    remainingCount: 5,
    skipAvailable: false,
    skipVotes: new Map(),
    restrictedBidders: [],
    passes: new Map(),
    players: new Map([
      ["a", player({ playerId: "a", name: "Ana" })],
      ["b", player({ playerId: "b", name: "Bea" })],
    ]),
    revealedCards: new Map(),
    standings: [],
    ...overrides,
  };
}

describe("Auction -- reacciones (D8)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // useServerClock llama a fetch("/time") al montar -- sin servidor real
    // detras en este test, se sustituye por una promesa que nunca hace red.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ now: Date.now() }) })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("monta la fila de 6 emojis, una vez visible en movil y otra en escritorio", () => {
    render(
      <Auction
        state={baseState({})}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={vi.fn()}
      />,
    );
    // Dos <Reactions> montados (uno oculto por CSS segun el breakpoint,
    // ver el comentario de Auction.tsx) -- jsdom no aplica media queries de
    // ancho, asi que los dos existen en el DOM: se comprueban los DOS
    // grupos, no solo uno.
    const groups = screen.getAllByRole("group", { name: "Reacciones" });
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.querySelectorAll("button")).toHaveLength(6);
    }
  });

  it("al pulsar un emoji, manda react con el indice 0..5 correspondiente", () => {
    const send = vi.fn();
    render(
      <Auction
        state={baseState({})}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={send}
      />,
    );
    const [group] = screen.getAllByRole("group", { name: "Reacciones" });
    act(() => {
      within(group!).getByRole("button", { name: "Reaccionar: fuego" }).click();
    });
    expect(send).toHaveBeenCalledWith("react", { emoji: 2 }); // 🔥 es el indice 2 en REACTIONS
  });

  it("una reaccion entrante se pinta con el nombre resuelto contra state.players", () => {
    const incoming: IncomingReaction[] = [{ id: "srv-1", playerId: "b", emoji: 0 }];
    render(
      <Auction
        state={baseState({})}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={incoming}
        onDismissReaction={vi.fn()}
        send={vi.fn()}
      />,
    );
    const bubbles = screen.getAllByRole("status");
    expect(bubbles.length).toBeGreaterThan(0);
    expect(bubbles[0]).toHaveTextContent("Bea");
    expect(bubbles[0]).toHaveTextContent("😂"); // indice 0 en REACTIONS
  });

  it("un playerId que ya no esta en state.players cae a 'Jugador', no rompe", () => {
    const incoming: IncomingReaction[] = [{ id: "srv-1", playerId: "ya-no-esta", emoji: 1 }];
    render(
      <Auction
        state={baseState({})}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={incoming}
        onDismissReaction={vi.fn()}
        send={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Jugador");
  });

  it("durante REVEAL, las burbujas aparecen sin animacion de subida (se retiran solas tras 1.5s)", () => {
    const onDismissReaction = vi.fn();
    const incoming: IncomingReaction[] = [{ id: "srv-1", playerId: "b", emoji: 3 }];
    render(
      <Auction
        state={baseState({ phase: "REVEAL" })}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={incoming}
        onDismissReaction={onDismissReaction}
        send={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // noRise (fase REVEAL) usa el mismo fallback de setTimeout que
    // reducedMotion -- ver Reactions.tsx -- asi que la burbuja entrante
    // desaparece sola y avisa a onDismissReaction (una vez por cada
    // <Reactions> montado: hay dos, el de movil y el de escritorio).
    expect(onDismissReaction).toHaveBeenCalledWith("srv-1");
  });

  it("fuera de REVEAL, la burbuja entrante NO se retira sola tras 1.5s (sube y se desvanece via Framer)", () => {
    const onDismissReaction = vi.fn();
    const incoming: IncomingReaction[] = [{ id: "srv-1", playerId: "b", emoji: 3 }];
    render(
      <Auction
        state={baseState({ phase: "BIDDING" })}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={incoming}
        onDismissReaction={onDismissReaction}
        send={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Sin noRise ni reducedMotion, el mock de framer-motion no dispara
    // onAnimationComplete (no anima de verdad) -- confirma que esta rama NO
    // usa el fallback de setTimeout, a diferencia de la de REVEAL arriba.
    expect(onDismissReaction).not.toHaveBeenCalled();
  });
});

describe("Auction -- mercado de transferencias", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ now: Date.now() }) })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("permite confirmar la pausa sin mostrar controles de puja", () => {
    const send = vi.fn();
    render(
      <Auction
        state={baseState({ phase: "TRANSFER_MARKET", currentSlot: "CAM", marketReady: new Map() })}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={send}
      />,
    );

    expect(screen.getByRole("heading", { name: "Mercado de transferencias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.queryByText(/Abre la puja/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(send).toHaveBeenCalledWith("market:continue", {});
  });

  it("envia un intercambio con un jugador por cada lado", () => {
    const send = vi.fn();
    render(
      <Auction
        state={baseState({
          phase: "TRANSFER_MARKET",
          currentSlot: "CAM",
          marketReady: new Map(),
          players: new Map([
            ["a", player({ playerId: "a", name: "Ana", squad: new Map([["CB1", "card-a"]]) })],
            ["b", player({ playerId: "b", name: "Bea", squad: new Map([["CB1", "card-b"]]) })],
          ]),
        })}
        myId="a"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={send}
        tradeOffers={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Tu jugador"), { target: { value: "CB1:card-a" } });
    fireEvent.change(screen.getByLabelText("Jugador a recibir"), { target: { value: "b:CB1:card-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar oferta" }));

    expect(send).toHaveBeenCalledWith("trade:create", expect.objectContaining({
      recipientId: "b",
      offeredCardIds: ["card-a"],
      requestedCardIds: ["card-b"],
    }));
  });

  it("un traspaso aceptado se ve claro, con nombres y no con cardIds", () => {
    // Lo que se quejaba el jugador: el resultado de un traspaso pasaba
    // inadvertido. Antes salia "facchetti-1968 por c1b-1975" en gris, con el
    // codigo en ingles "ACCEPTED" al lado, indistinguible de una cancelacion.
    render(
      <Auction
        state={baseState({
          phase: "TRANSFER_MARKET",
          currentSlot: "RB",
          marketReady: new Map(),
          revealedCards: new Map([
            ["card-a", { cardId: "card-a", slot: "CB1", silhouetteId: "s1", name: "Royer", season: 1974, club: "Anderlecht", league: "B1", nation: "BEL", rating: 91, ownerId: "a", price: 60 }],
            ["card-b", { cardId: "card-b", slot: "CB1", silhouetteId: "s2", name: "Suarez", season: 1975, club: "Ajax", league: "Eredivisie", nation: "NED", rating: 90, ownerId: "b", price: 60 }],
          ]),
        })}
        myId="c"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={vi.fn()}
        tradeOffers={[
          {
            offerId: "o1",
            proposerId: "a",
            recipientId: "b",
            offeredCardIds: ["card-a"],
            requestedCardIds: ["card-b"],
            proposerPays: 50,
            status: "ACCEPTED",
          },
        ]}
      />,
    );

    // El titular, en castellano y con los dos nombres.
    expect(screen.getByText(/Traspaso hecho: Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Royer \(1974\)/)).toBeInTheDocument();
    expect(screen.getByText(/Suarez \(1975\)/)).toBeInTheDocument();
    expect(screen.getByText(/paga 50 M/)).toBeInTheDocument();
    // El codigo en ingles que se pintaba crudo, y la lista de ids.
    expect(screen.queryByText("ACCEPTED")).not.toBeInTheDocument();
    expect(screen.queryByText(/card-a/)).not.toBeInTheDocument();
    // Y los dos saldos a la vista, que es la otra mitad del aviso: uno por
    // jugador, en la lista de confirmaciones del mercado.
    expect(screen.getAllByText("1000 M")).toHaveLength(2);
  });

  it("avisa al receptor de una oferta abierta y no le enseña botones a los demas", () => {
    render(
      <Auction
        state={baseState({ phase: "TRANSFER_MARKET", currentSlot: "RB", marketReady: new Map() })}
        myId="b"
        roomId="room-1"
        error={null}
        errorSeq={0}
        reactions={[]}
        onDismissReaction={vi.fn()}
        send={vi.fn()}
        tradeOffers={[
          {
            offerId: "o1",
            proposerId: "a",
            recipientId: "b",
            offeredCardIds: ["card-a"],
            requestedCardIds: ["card-b"],
            proposerPays: 0,
            status: "OPEN",
          },
        ]}
      />,
    );

    expect(screen.getByText("Te han hecho una oferta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });
});

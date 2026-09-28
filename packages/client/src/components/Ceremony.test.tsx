import { act, render, screen } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ceremony, INTRO_MS, REVEAL_DELAY_MS, STEP_MS } from "./Ceremony.js";
import type { ClientState, PlayerView, RevealedCardView } from "../net/types.js";

/**
 * `AnimatePresence` de framer-motion resuelve su transicion de salida via
 * requestAnimationFrame antes de desmontar el hijo anterior -- con
 * `mode="wait"` eso significa que, bajo el reloj falso de vitest, el
 * siguiente paso de la ceremonia NUNCA llega a montarse por mucho que se
 * avance `vi.advanceTimersByTimeAsync` sobre los `setTimeout` (confirmado
 * con una reproduccion minima: un `<AnimatePresence mode="wait">` con un
 * solo `motion.div` se queda congelado en el primer hijo bajo fake timers,
 * sea cual sea el reloj que se finja). Es una interaccion conocida entre el
 * driver de animacion interno de framer-motion y los temporizadores
 * simulados, no un bug de este componente.
 *
 * Este mock deja pasar el contenido real (children) sin la coreografia de
 * entrada/salida -- exactamente lo que hace la propia ceremonia con
 * `prefers-reduced-motion`, asi que ademas prueba en los hechos ese camino:
 * la informacion de cada paso llega completa e inmediata, sin animacion.
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
            // Descarta las props exclusivas de framer-motion (initial/animate/
            // exit/transition/whileHover, etc.) para no volcarlas como
            // atributos DOM invalidos -- solo interesan las props de HTML
            // reales que el componente real tambien pasaria.
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

function revealed(overrides: Partial<RevealedCardView> & { cardId: string; rating: number }): RevealedCardView {
  return {
    slot: "GK",
    silhouetteId: overrides.cardId,
    name: overrides.cardId,
    season: 2020,
    club: "Club",
    league: "League",
    nation: "ESP",
    ownerId: "",
    price: 0,
    ...overrides,
  };
}

function baseState(overrides: Partial<ClientState>): ClientState {
  return {
    roomCode: "AAAAA",
    hostId: "a",
    phase: "RESULTS",
    slotIndex: 11,
    currentSlot: "",
    currentBid: 0,
    currentBidderId: "",
    openingBid: 0,
    minimumBid: 0,
    bidHistory: [],
    endsAt: 0,
    remainingCount: 0,
    skipAvailable: false,
    skipVotes: new Map(),
    restrictedBidders: [],
    passes: new Map(),
    players: new Map(),
    revealedCards: new Map(),
    standings: [],
    ...overrides,
  };
}

/**
 * Estado minimo: dos jugadores, un unico puesto (GK) fichado por cada uno, Ana con mejor rating.
 *
 * `standings` es lo que el servidor publica en `AuctionRoom.finish()`: Ana
 * rank 1 con 1 punto, Bea rank 2 con 0. La ceremonia lo usa para decidir quien
 * es campeon (ver `ceremonyChampions`), asi que estos fixtures no son
 * decorativos: si esa fila falta, la champions cae al red de seguridad.
 */
function twoPlayerState(): ClientState {
  return baseState({
    players: new Map([
      ["a", player({ playerId: "a", name: "Ana", squad: new Map([["GK", "card-a"]]) })],
      ["b", player({ playerId: "b", name: "Bea", squad: new Map([["GK", "card-b"]]) })],
    ]),
    revealedCards: new Map([
      ["card-a", revealed({ cardId: "card-a", slot: "GK", name: "Casillas", rating: 90, ownerId: "a", price: 50 })],
      ["card-b", revealed({ cardId: "card-b", slot: "GK", name: "Valdes", rating: 70, ownerId: "b", price: 20 })],
    ]),
    standings: [
      { playerId: "a", points: 1, totalRating: 90, budgetLeft: 950, rank: 1 },
      { playerId: "b", points: 0, totalRating: 70, budgetLeft: 980, rank: 2 },
    ],
  });
}

describe("Ceremony", () => {
  // Un `act()` por CADA frontera de temporizador (intro, luego cada paso),
  // nunca un unico `advanceTimersByTime` que salte varias de golpe: el
  // componente programa el `setTimeout` del siguiente tramo DENTRO del
  // efecto que reacciona al tramo actual, y bajo el reloj falso de vitest
  // ese nuevo timer no llega a registrarse a tiempo de que un salto grande,
  // hecho en un solo flush, lo cuente -- confirmado con una reproduccion
  // minima. Separar por tramo es ademas el equivalente mas fiel de "cada
  // paso dura ~3s" para quien lea el test.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("empieza con la entrada 'La hora de la verdad'", () => {
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /la hora.*verdad/i })).toBeInTheDocument();
  });

  it("el rating aparece tapado con '?' antes del destape, y como numero despues", () => {
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);

    // Avanza de la intro al primer paso (GK). Un `act` por frontera de
    // temporizador -- ver el comentario grande mas abajo en el test del
    // campeon para el porque de no saltar los dos de un tiron.
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    expect(screen.getAllByText("?").length).toBeGreaterThan(0);

    // Pasan los ms del destape dentro del paso.
    act(() => {
      vi.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  it("marca 'Gana el puesto' solo en la carta de mejor rating tras el destape", () => {
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    act(() => {
      vi.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    expect(screen.getByText("Gana el puesto")).toBeInTheDocument();
  });

  it("'Saltar ceremonia' llama a onFinished de inmediato", () => {
    const onFinished = vi.fn();
    render(<Ceremony state={twoPlayerState()} onFinished={onFinished} />);
    act(() => {
      screen.getByRole("button", { name: /saltar ceremonia/i }).click();
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("llega hasta el campeon tras recorrer los once pasos", () => {
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    for (let i = 0; i < 11; i++) {
      act(() => {
        vi.advanceTimersByTime(STEP_MS);
      });
    }
    expect(screen.getByText("Campeón")).toBeInTheDocument();
    // Ana gano el unico puesto fichado -- es la campeona. Su nombre tambien
    // aparece en el marcador superior (que sigue visible en esta pantalla),
    // asi que se busca especificamente el titular grande, no cualquier
    // aparicion del texto "Ana".
    expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
  });

  it("un puesto sin nadie que lo fichara muestra 'Sin fichaje'", () => {
    // Este estado no tiene ST fichado por nadie -- ST es el paso 9 (indice 8).
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(STEP_MS);
      });
    }
    expect(screen.getByText("Sin fichaje")).toBeInTheDocument();
  });

  it("el marcador suma el punto solo a partir del destape del paso", () => {
    render(<Ceremony state={twoPlayerState()} onFinished={vi.fn()} />);

    // En la entrada todos a 0, todavia no se ha revelado nada.
    expect(screen.getByText("Ana").parentElement?.textContent).toContain("0");
    expect(screen.getByText("Bea").parentElement?.textContent).toContain("0");

    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    act(() => {
      vi.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    // Ana gano el GK: su marcador sube a 1 y el de Bea se queda en 0.
    expect(screen.getByText("Ana").parentElement?.textContent).toContain("1");
    expect(screen.getByText("Bea").parentElement?.textContent).toContain("0");
  });

  it("un patch del servidor a mitad de paso no reinicia ni duplica el marcador", () => {
    // `useRoom` entrega un objeto de estado NUEVO en cada patch, asi que
    // durante la ceremonia un jugador que se desconecta (por ejemplo) rehace
    // las dependencias del efecto. El marcador es derivado de los pasos ya
    // resueltos, no una suma dentro del temporizador: por eso el punto del GK
    // sigue valiendo 1 y no 2, y el paso no vuelve a tapar el rating.
    const state = twoPlayerState();
    const { rerender } = render(<Ceremony state={state} onFinished={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    act(() => {
      vi.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    expect(screen.getByText("Ana").parentElement?.textContent).toContain("1");

    act(() => {
      rerender(<Ceremony state={{ ...state }} onFinished={vi.fn()} />);
    });
    act(() => {
      vi.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    expect(screen.getByText("Ana").parentElement?.textContent).toContain("1");
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  it("el campeon lo decide la clasificacion del servidor, no solo los puntos de la ceremonia", () => {
    // Ana y Bea empatan en el GK (mismo rating, mismo punto) y comparten
    // rating total, pero a Bea le queda menos presupuesto. El servidor los
    // desempata por budgetLeft y da el rank 1 a Bea: la ceremonia debe decir
    // Bea, no "Campeones: Ana · Bea" mientras la tabla de abajo solo pinta a
    // Bea como primera.
    const state = twoPlayerState();
    const state2: ClientState = {
      ...state,
      revealedCards: new Map([
        ["card-a", revealed({ cardId: "card-a", slot: "GK", name: "Casillas", rating: 90, ownerId: "a", price: 50 })],
        ["card-b", revealed({ cardId: "card-b", slot: "GK", name: "Valdes", rating: 90, ownerId: "b", price: 20 })],
      ]),
      standings: [
        { playerId: "a", points: 0.5, totalRating: 90, budgetLeft: 950, rank: 2 },
        { playerId: "b", points: 0.5, totalRating: 90, budgetLeft: 980, rank: 1 },
      ],
    };
    render(<Ceremony state={state2} onFinished={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    for (let i = 0; i < 11; i++) {
      act(() => {
        vi.advanceTimersByTime(STEP_MS);
      });
    }
    expect(screen.getByText("Campeón")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bea" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ana" })).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientState, PlayerView } from "../net/types.js";
import { Lobby } from "./Lobby.js";

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

function lobbyState(overrides: Partial<ClientState>): ClientState {
  return {
    roomCode: "AAAAA",
    hostId: "a",
    phase: "LOBBY",
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
      ["c", player({ playerId: "c", name: "Cid" })],
    ]),
    revealedCards: new Map(),
    standings: [],
    ...overrides,
  } as ClientState;
}

function renderLobby(state: ClientState, myId: string, onKick = vi.fn()) {
  render(
    <Lobby
      state={state}
      error={null}
      myId={myId}
      onKick={onKick}
      onCreate={vi.fn()}
      onJoinByCode={vi.fn()}
      onReady={vi.fn()}
    />,
  );
  return onKick;
}

describe("Lobby -- expulsar (kick)", () => {
  it("el anfitrion ve un boton de expulsar por cada fila ajena, y ninguno en la suya", () => {
    renderLobby(lobbyState({}), "a");

    // El boton se nombra con el jugador al que afecta: es el unico texto que
    // distingue "expulsar a Bea" de "expulsar a Cid" sin depender del color.
    expect(screen.getByRole("button", { name: "Expulsar a Bea de la sala" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expulsar a Cid de la sala" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Expulsar a Ana de la sala" })).toBeNull();
  });

  it("quien no es anfitrion no ve ningun boton de expulsar", () => {
    renderLobby(lobbyState({}), "b");

    expect(screen.queryByRole("button", { name: /^Expulsar a/ })).toBeNull();
  });

  it('pulsa "expulsar" y avisa con el playerId de la fila', () => {
    const onKick = renderLobby(lobbyState({}), "a");

    fireEvent.click(screen.getByRole("button", { name: "Expulsar a Cid de la sala" }));

    expect(onKick).toHaveBeenCalledTimes(1);
    expect(onKick).toHaveBeenCalledWith("c");
  });
});
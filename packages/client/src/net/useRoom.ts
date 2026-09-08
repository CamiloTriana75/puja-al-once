import { Client, type Room } from "colyseus.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "./endpoints.js";
import type { ClientState } from "./types.js";

export interface Connection {
  room: Room<ClientState> | null;
  state: ClientState | null;
  /**
   * Rechazo del arranque de ronda (mensaje "error" del servidor: el mazo no
   * alcanza para el hueco, etc). Solo lo consume el Lobby.
   */
  startError: string | null;
  /**
   * Motivo del ultimo rechazo de puja ("bid:rejected"), un codigo como
   * "BID_TOO_LOW" -- BidControls lo traduce al castellano. Separado de
   * startError a proposito: con dos pantallas (Lobby y Auction) cada una
   * solo debe reaccionar a los rechazos que le conciernen a ella. Mezclarlos
   * en un unico campo (como hacia esta funcion antes de la Task 13) hacia
   * que un rechazo de arranque de ronda se colara como si fuera un error de
   * puja, o viceversa.
   */
  bidError: string | null;
  join: (name: string, roomId?: string) => Promise<void>;
  send: (type: string, payload?: unknown) => void;
  leave: () => void;
}

export function useRoom(): Connection {
  const clientRef = useRef<Client | null>(null);
  const [room, setRoom] = useState<Room<ClientState> | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);

  useEffect(() => {
    clientRef.current = new Client(WS_URL);
  }, []);

  // Cierra el socket de la sala anterior en cuanto `room` cambia (un
  // re-join tras un remount) o el componente se desmonta. Sin esto el
  // socket viejo se queda vivo y colgado, sin que nadie lo cierre nunca --
  // hoy es tolerable porque el lobby es la unica pantalla, pero en cuanto
  // haya navegacion entre pantallas (Tasks 13/14) esto se vuelve una fuga
  // de conexiones real.
  useEffect(() => {
    return () => {
      room?.leave();
    };
  }, [room]);

  const join = useCallback(async (name: string, roomId?: string) => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const joined = roomId
        ? await client.joinById<ClientState>(roomId, { name })
        : await client.joinOrCreate<ClientState>("auction", { name });

      // onStateChange dispara en cada patch: React vuelve a pintar con el objeto vivo.
      joined.onStateChange((next) => setState({ ...next } as ClientState));
      joined.onMessage("bid:rejected", (msg: { reason: string }) => setBidError(msg.reason));
      joined.onMessage("error", (msg: { message: string }) => setStartError(msg.message));
      setRoom(joined);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      room?.send(type, payload);
      // Cada mensaje limpia solo el error de su propio origen -- optimista,
      // para que reintentar borre el mensaje viejo antes de que conteste el
      // servidor -- sin pisar el error de la otra pantalla.
      if (type === "bid") setBidError(null);
      if (type === "ready") setStartError(null);
    },
    [room],
  );

  // Expuesto para que quien consuma el hook pueda salir explicitamente
  // (p.ej. un boton "salir" en una pantalla futura). El efecto de arriba
  // cubre el caso de desmontaje/remount; esto cubre el caso de salida
  // deliberada mientras el componente sigue montado. `Room.leave()` es
  // seguro de llamar mas de una vez -- no revienta si el socket ya esta
  // cerrado -- asi que no hace falta guardar si ya se llamo.
  const leave = useCallback(() => {
    room?.leave();
  }, [room]);

  return { room, state, startError, bidError, join, send, leave };
}

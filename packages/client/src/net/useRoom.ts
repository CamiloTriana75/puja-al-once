import { Client, type Room } from "colyseus.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientState } from "./types.js";

const ENDPOINT = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

export interface Connection {
  room: Room<ClientState> | null;
  state: ClientState | null;
  error: string | null;
  join: (name: string, roomId?: string) => Promise<void>;
  send: (type: string, payload?: unknown) => void;
  leave: () => void;
}

export function useRoom(): Connection {
  const clientRef = useRef<Client | null>(null);
  const [room, setRoom] = useState<Room<ClientState> | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientRef.current = new Client(ENDPOINT);
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
      joined.onMessage("bid:rejected", (msg: { reason: string }) => setError(msg.reason));
      joined.onMessage("error", (msg: { message: string }) => setError(msg.message));
      setRoom(joined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      room?.send(type, payload);
      setError(null);
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

  return { room, state, error, join, send, leave };
}

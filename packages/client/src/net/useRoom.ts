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
}

export function useRoom(): Connection {
  const clientRef = useRef<Client | null>(null);
  const [room, setRoom] = useState<Room<ClientState> | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientRef.current = new Client(ENDPOINT);
  }, []);

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

  return { room, state, error, join, send };
}

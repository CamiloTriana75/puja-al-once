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
  /**
   * Se incrementa en CADA "bid:rejected" que llega del servidor, aunque el
   * motivo sea identico al anterior (dos "BID_TOO_LOW" seguidos, p.ej. al
   * reintentar sin cambiar el importe). BidControls la usa -- en vez del
   * contenido de `bidError` -- para saber que el servidor ya contesto de
   * verdad a ESTE envio y soltar el boton. Un contador que solo el propio
   * onMessage incrementa nunca "se le adelanta" al servidor, a diferencia
   * de un valor que el cliente escribe el mismo de forma optimista.
   */
  bidErrorSeq: number;
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
  const [bidErrorSeq, setBidErrorSeq] = useState(0);

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
      joined.onStateChange((next) => {
        setState({ ...next } as ClientState);
        // Confirmacion de exito -- derivada del propio estado del servidor,
        // nunca escrita por el cliente: si ahora soy yo quien va ganando la
        // puja, el ultimo envio se acepto, y cualquier rechazo anterior ya
        // no aplica. Idempotente: pisar null con null en los patches
        // siguientes mientras siga ganando no hace nada.
        if (next.currentBidderId === joined.sessionId) setBidError(null);
      });
      joined.onMessage("bid:rejected", (msg: { reason: string }) => {
        setBidError(msg.reason);
        setBidErrorSeq((n) => n + 1);
      });
      joined.onMessage("error", (msg: { message: string }) => setStartError(msg.message));
      setRoom(joined);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      room?.send(type, payload);
      // "ready" SI se limpia de forma optimista: el Lobby no protege contra
      // doble envio con un `pending` propio (solo deshabilita el boton hasta
      // que cambie el estado o llegue un error), asi que no hay ningun
      // temporizador de "el servidor ya contesto" que este optimismo pueda
      // desincronizar.
      //
      // "bid" NO se limpia aqui a proposito -- ver bidError/bidErrorSeq en
      // useRoom y BidControls. Limpiarlo aqui era justo el bug de la ronda
      // de arreglos 1: al reintentar tras un rechazo, este mismo `send()`
      // ponia bidError a null ANTES de que el servidor contestara, y
      // BidControls confundia ese cambio (escrito por el propio cliente)
      // con "el servidor ya respondio", soltando el boton de pujar antes de
      // tiempo -- doble puja desprotegida justo en el momento en que mas
      // probable es que alguien reintente deprisa.
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

  return { room, state, startError, bidError, bidErrorSeq, join, send, leave };
}

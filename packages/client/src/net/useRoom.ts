import { Client, type Room } from "colyseus.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { isConsentedLeave } from "./connectionStatus.js";
import { WS_URL } from "./endpoints.js";
import { describeRoomLookupError, fetchPublicRooms, lookupRoomByCode, type RoomVisibility } from "./roomLookup.js";
import type { ClientState, TradeOfferView } from "./types.js";

/**
 * Estado de la conexion con el servidor, visible a TODA la aplicacion (no
 * solo la pantalla de puja) -- ver design-system/pages/sala-espera.md, que
 * anota esto como pendiente desde hace tiempo y en severidad alta: si el
 * servidor cae, el navegador se queda mirando el ultimo patch recibido sin
 * ningun aviso.
 *
 *   "connected"    -- todo normal. Tambien el estado antes de unirse a
 *                      ninguna sala: no hay conexion que perder todavia.
 *   "reconnecting" -- el socket se corto sin que nadie lo pidiera
 *                      (Room.onLeave con un codigo distinto de CONSENTED,
 *                      ver connectionStatus.ts) y se esta reintentando
 *                      `client.reconnect()` contra el mismo
 *                      `reconnectionToken`. El servidor sostiene el asiento
 *                      con `allowReconnection` durante `rules.reconnectSeconds`
 *                      (60s por defecto) -- ver AuctionRoom.onLeave.
 *   "disconnected" -- se agoto la ventana de reintentos, o el servidor
 *                      rechazo el reconnect de forma definitiva. Ya no hay
 *                      reintento automatico: la unica salida es recargar.
 */
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

/**
 * Una reaccion "reaction" ya recibida del servidor (D8, contrato en
 * docs/superpowers/plans/2026-09-25-alpha.md). Crudo tal cual llega --
 * `playerId` sin resolver a nombre a proposito: ese cruce (`state.players`)
 * lo tiene quien monta `<Reactions>` (Auction.tsx), no este hook. `id` es
 * de aqui, no del servidor -- el mensaje no trae ninguno, y `Reactions` lo
 * necesita como key de React / identidad de burbuja para poder expirarla.
 */
export interface IncomingReaction {
  id: string;
  playerId: string;
  emoji: number;
}

/**
 * Reintentos de `client.reconnect()`: backoff corto, pensado para caber
 * dentro de la ventana de 60s que sostiene el servidor
 * (rules.reconnectSeconds). Nunca crece sin limite.
 *
 * El ciclo completo (9 intentos: el que dispara onLeave + 8 de este array)
 * tarda unos 50s de reloj real contra un servidor MUERTO, no los ~27s que
 * suman los delays a secas -- medido en pruebas manuales matando el
 * proceso: cada intento fallido tarda el es propio tiempo de que el
 * navegador reporte ERR_CONNECTION_REFUSED (~2.3s en este entorno), y eso
 * se suma encima de cada delay programado. Cabe dentro de los 60s del
 * servidor con margen, pero por poco -- si se acorta este array hay que
 * volver a medir contra un servidor muerto de verdad, no solo sumar los
 * numeros del array.
 */
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 3000, 5000, 5000, 5000, 5000];

/**
 * Techo por INTENTO de `client.reconnect()`. Necesario porque, cuando el
 * proceso del servidor esta muerto de verdad (no solo el socket, todo el
 * proceso -- el caso "mata el servidor a mitad de partida" que este punto
 * del encargo pide probar), la peticion HTTP de matchmaking que
 * `reconnect()` hace por debajo (ver colyseus.js/lib/HTTP.js, sin timeout
 * propio) puede quedarse pendiente sin resolverse NI rechazarse durante
 * mucho mas que estos 5s -- confirmado en pruebas manuales: sin este
 * techo, un intento colgado bloqueaba el ciclo entero de reintentos y el
 * banner se quedaba en "reconectando" mucho mas alla de agotar
 * RECONNECT_DELAYS_MS, nunca llegando a "disconnected" ni ofreciendo el
 * boton de reintentar a mano.
 */
const RECONNECT_ATTEMPT_TIMEOUT_MS = 5000;

export interface Connection {
  room: Room<ClientState> | null;
  state: ClientState | null;
  /** Ver ConnectionStatus. */
  connectionStatus: ConnectionStatus;
  /** Reintenta ahora mismo, sin esperar al siguiente paso del backoff. Para el boton "Reintentar ahora" del banner. */
  retryNow: () => void;
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
  /**
   * Reacciones "reaction" recibidas del servidor durante ESTA sala, mas
   * recientes al final -- D8, ver docs/superpowers/plans/2026-09-25-alpha.md.
   * Efimero por diseno, igual que el resto de mensajes sin contraparte en
   * `state` (bidError arriba): quien consuma esto (Auction.tsx, via
   * `<Reactions incoming={...} />`) es responsable de expirar cada entrada
   * cuando su burbuja termine de animarse -- ver `dismissReaction`. Nunca
   * crece sin limite: cada reaccion mostrada se descarta de esta lista al
   * expirar.
   */
  reactions: IncomingReaction[];
  tradeOffers: TradeOfferView[];
  /** Retira una reaccion de `reactions` por `id` -- lo llama `Reactions.onExpire` cuando su burbuja ya termino de animarse. */
  dismissReaction: (id: string) => void;
  /** Crea una sala nueva. Nunca coincide con una existente -- a diferencia de `joinOrCreate`, `create` no busca hueco en otra sala antes. */
  createRoom: (name: string, visibility?: RoomVisibility) => Promise<void>;
  /**
   * Resuelve el codigo por HTTP (ver roomLookup.ts) antes de intentar el
   * join por WebSocket: es lo que permite distinguir sala inexistente,
   * llena o ya empezada -- el rechazo de `client.joinById` a secas no lo
   * hace (todas esas salas estan "locked" y Colyseus no dice por que).
   */
  joinByCode: (name: string, code: string) => Promise<void>;
  /** Entra a una sala elegida desde el directorio público. */
  joinPublicRoom: (name: string, roomId: string) => Promise<void>;
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
  const [reactions, setReactions] = useState<IncomingReaction[]>([]);
  const [tradeOffers, setTradeOffers] = useState<TradeOfferView[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");

  // Token de reconexion de la sala VIVA -- se actualiza en cada attach() (el
  // inicial y cada uno que sigue a un reconnect() con exito), nunca se lee
  // directamente de `room.reconnectionToken` en el momento del fallo: para
  // cuando onLeave dispara, `room` en closure puede ser una referencia
  // obsoleta si React todavia no re-renderizo. Una ref evita esa carrera.
  const reconnectionTokenRef = useRef<string | null>(null);
  // Vivo mientras dura un ciclo de reintentos: lo cancela un reconnect con
  // exito, un retryNow, o el desmontaje. Sin cancelarlo, un timeout viejo
  // que dispara despues de que el ciclo ya termino (con exito o por salida
  // deliberada) reintentaria una reconexion que nadie pidio.
  const retryTimeoutRef = useRef<number | null>(null);
  // Cuantos intentos de ESTE ciclo de reconexion ya se hicieron -- indexa
  // RECONNECT_DELAYS_MS. Se reinicia a 0 en cada attach() con exito (nuevo
  // ciclo limpio si la conexion vuelve a caerse mas tarde).
  const retryCountRef = useRef(0);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clientRef.current = new Client(WS_URL);
  }, []);

  // Cierra el socket de la sala anterior en cuanto `room` cambia (un
  // re-join tras un remount, o un reconnect con exito que sustituye la
  // instancia) o el componente se desmonta. Sin esto el socket viejo se
  // queda vivo y colgado, sin que nadie lo cierre nunca -- hoy es tolerable
  // porque el lobby es la unica pantalla, pero en cuanto haya navegacion
  // entre pantallas (Tasks 13/14) esto se vuelve una fuga de conexiones
  // real. Tras una caida real el socket ya esta cerrado del lado navegador,
  // asi que este `leave()` sobre la instancia rota es un no-op seguro (ver
  // el comentario de la funcion `leave` expuesta, mismo razonamiento).
  useEffect(() => {
    return () => {
      room?.leave();
    };
  }, [room]);

  // Cablea los listeners comunes a cualquier sala recien unida -- creada,
  // encontrada por codigo, o reconectada tras una caida, da igual: las tres
  // rutas de entrada terminan aqui para no duplicar esta parte, que es
  // identica en las tres.
  const attach = useCallback((joined: Room<ClientState>) => {
    reconnectionTokenRef.current = joined.reconnectionToken;
    retryCountRef.current = 0;
    clearRetryTimeout();
    setReactions([]);
    setTradeOffers([]);
    setConnectionStatus("connected");

    // onStateChange dispara en cada patch: React vuelve a pintar con el objeto vivo.
    joined.onStateChange((next) => {
      setState({ ...next } as ClientState);
      // Las burbujas son efímeras de la partida actual. No deben reaparecer
      // al terminar la ceremonia ni al jugar la revancha en la misma sala.
      if (next.phase === "RESULTS" || next.phase === "LOBBY") {
        setReactions([]);
        setTradeOffers([]);
      }
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
    joined.onMessage("trade:updated", (offer: TradeOfferView) => {
      setTradeOffers((previous) => [...previous.filter((item) => item.offerId !== offer.offerId), offer]);
    });
    joined.onMessage("error", (msg: { message: string }) => setStartError(msg.message));
    // D8: cada reaccion se acumula con un id propio del cliente (el mensaje
    // del servidor no trae ninguno -- ver AuctionRoom.onReact, es
    // deliberadamente `{ playerId, emoji }` a secas). Auction.tsx la pasa
    // a <Reactions incoming={...}>, que ya sabe pintar y expirar burbujas
    // por id; `dismissReaction` (mas abajo) es la mitad que le falta para
    // que esta lista tampoco crezca sin limite. El servidor tambien nos
    // hace eco de la reaccion propia; esa ya se pinto optimistamente en el
    // boton, asi que guardarla aqui la duplicaria en pantalla.
    joined.onMessage("reaction", (msg: { playerId: string; emoji: number }) => {
      if (msg.playerId === joined.sessionId) return;
      const reaction: IncomingReaction = { id: `${Date.now()}-${Math.random()}`, ...msg };
      setReactions((prev) => [...prev, reaction]);
    });

    // El corazon del punto 2 del encargo: sin este listener, cuando el
    // proceso del servidor muere el socket se cierra y la interfaz se queda
    // exactamente donde estaba -- el ultimo patch que llego a onStateChange
    // -- sin ninguna pista de que ya no hay nadie al otro lado.
    joined.onLeave((code) => {
      if (isConsentedLeave(code)) {
        // Salida deliberada (room.leave() propio, o Colyseus en modo
        // desarrollo reiniciando): nada que avisar, no se reintenta.
        setConnectionStatus("connected");
        return;
      }
      setConnectionStatus("reconnecting");
      retryTimeoutRef.current = window.setTimeout(
        () => void attemptReconnectRef.current(),
        RECONNECT_DELAYS_MS[0],
      );
    });

    setRoom(joined);
  }, [clearRetryTimeout]);

  // Intenta reconectar UNA vez contra el token guardado. Si tiene exito,
  // attach() se encarga de resetear todo el ciclo (retryCountRef a 0,
  // connectionStatus a "connected"). Si falla, encadena el siguiente
  // intento segun el backoff -- salvo que ya no queden pasos, momento en el
  // que se rinde y pasa a "disconnected": la ventana de 60s que sostiene el
  // servidor (rules.reconnectSeconds) ya se agoto de sobra para entonces.
  const attemptReconnect = useCallback(async () => {
    const client = clientRef.current;
    const token = reconnectionTokenRef.current;
    if (!client || !token) return;

    try {
      // Promise.race con un timeout propio: ver RECONNECT_ATTEMPT_TIMEOUT_MS,
      // el porque esta aqui es especifico y esta documentado alli. El
      // `reject` del timeout no cancela la peticion HTTP subyacente
      // (`client.reconnect()` no expone forma de abortarla) -- si esa
      // peticion colgada resuelve MAS TARDE, la respuesta se descarta en
      // silencio (nadie sigue esperando esa promesa concreta una vez que el
      // timeout gano la carrera), tanto si hubiera sido exito como fallo.
      // Contra el proceso muerto de verdad que este punto del encargo pide
      // probar eso es inocuo -- no hay nada al otro lado que pueda
      // responder tarde. Haria falta AbortController de verdad para
      // eliminar del todo la ventana teorica de un servidor vivo pero muy
      // lento que reconecta justo despues del timeout; queda fuera del
      // alcance de limar esta aspereza concreta.
      const rejoined = await Promise.race([
        client.reconnect<ClientState>(token),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Reconexion sin respuesta")), RECONNECT_ATTEMPT_TIMEOUT_MS);
        }),
      ]);
      attach(rejoined);
    } catch {
      const nextIndex = retryCountRef.current;
      if (nextIndex >= RECONNECT_DELAYS_MS.length) {
        setConnectionStatus("disconnected");
        return;
      }
      retryCountRef.current += 1;
      const delay = RECONNECT_DELAYS_MS[nextIndex]!;
      retryTimeoutRef.current = window.setTimeout(() => void attemptReconnectRef.current(), delay);
    }
  }, [attach]);

  // `attach` (arriba) referencia `attemptReconnect` desde dentro de un
  // callback de colyseus.js (onLeave) que se registra ANTES de que
  // `attemptReconnect` -- definido despues, porque depende de `attach` --
  // exista en ese closure de modulo. Una `useCallback` normal no sirve aqui
  // (crearia un ciclo de dependencias attach <-> attemptReconnect); en su
  // lugar, una ref que se reescribe EN CADA RENDER (no dentro de un efecto,
  // que correria un paso tarde y dejaria el primer onLeave posible con el
  // valor inicial) siempre apunta a la version mas reciente.
  const attemptReconnectRef = useRef(attemptReconnect);
  attemptReconnectRef.current = attemptReconnect;

  // Boton "Reintentar ahora" del banner: salta el backoff pendiente y
  // prueba en el acto. Seguro de llamar aunque no haya ningun ciclo activo
  // (connectionStatus === "connected" o "disconnected" ya rendido) --
  // attemptReconnect sin token simplemente no hace nada.
  const retryNow = useCallback(() => {
    clearRetryTimeout();
    void attemptReconnect();
  }, [clearRetryTimeout, attemptReconnect]);

  // Cancela cualquier reintento pendiente al desmontar la app entera. Los
  // reintentos de sala a sala ya se cancelan dentro de attach(); esto cubre
  // el caso de que el arbol de React completo se desmonte a mitad de un
  // ciclo (recarga manual, navegacion fuera de la SPA).
  useEffect(() => clearRetryTimeout, [clearRetryTimeout]);

  const createRoom = useCallback(
    async (name: string, visibility: RoomVisibility = "private") => {
      const client = clientRef.current;
      if (!client) return;
      setStartError(null);
      try {
        attach(await client.create<ClientState>("auction", { name, visibility }));
      } catch (cause) {
        setStartError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [attach],
  );

  const joinPublicRoom = useCallback(
    async (name: string, roomId: string) => {
      const client = clientRef.current;
      if (!client) return;
      setStartError(null);
      try {
        // El listado se vuelve a validar al pulsar para distinguir una sala
        // que ya arrancó o se llenó mientras aparecía en pantalla.
        const rooms = await fetchPublicRooms();
        if (!rooms.some((candidate) => candidate.roomId === roomId)) {
          setStartError("Esa sala ya no está disponible. Actualiza el listado y prueba otra.");
          return;
        }
        attach(await client.joinById<ClientState>(roomId, { name }));
      } catch (cause) {
        setStartError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [attach],
  );

  const joinByCode = useCallback(
    async (name: string, code: string) => {
      const client = clientRef.current;
      if (!client) return;
      setStartError(null);
      try {
        const lookup = await lookupRoomByCode(code);
        if (!lookup.ok || !lookup.roomId) {
          setStartError(describeRoomLookupError(lookup.reason ?? ""));
          return;
        }
        attach(await client.joinById<ClientState>(lookup.roomId, { name }));
      } catch (cause) {
        setStartError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [attach],
  );

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

  const dismissReaction = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    room, state, connectionStatus, retryNow,
    startError, bidError, bidErrorSeq, reactions, tradeOffers, dismissReaction, createRoom, joinByCode, joinPublicRoom, send, leave,
  };
}

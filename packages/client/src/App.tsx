import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { ConnectionBanner } from "./components/ConnectionBanner.js";
import { FeedbackHost } from "./components/FeedbackDialog.js";
import { Auction } from "./screens/Auction.js";
import { Landing } from "./screens/Landing.js";
import { Lobby } from "./screens/Lobby.js";
import { Results } from "./screens/Results.js";
import { useRoom } from "./net/useRoom.js";

/**
 * Transicion entre pantallas (Landing -> Lobby -> Auction -> Results):
 * MASTER.md S5 no tabula esta transicion (es de navegacion, no un momento
 * de partida), asi que se aplica el mismo presupuesto minimo que el resto
 * del sistema -- solo transform/opacity, sin cruce elaborado, "cambio de
 * candidato" (300ms, ease-out) es la entrada mas parecida de la tabla y de
 * ahi se toma la duracion. Un solo elemento animado por transicion: la
 * pantalla saliente se desvanece, la entrante aparece con una subida breve.
 * `mode="wait"` evita que las dos pantallas convivan montadas a la vez (dos
 * <main> con controles interactivos duplicados seria peor que el corte
 * seco que esto reemplaza).
 */
const SCREEN_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export default function App() {
  const {
    room, state, connectionStatus, retryNow, startError, bidError, bidErrorSeq, reactions, tradeOffers, dismissReaction,
    createRoom, joinByCode, joinPublicRoom, send,
  } = useRoom();
  const inGame = state && state.phase !== "LOBBY";

  // La portada (Landing) es solo la puerta de entrada, antes de que exista
  // conexion: en cuanto `state` deja de ser null -- ya en LOBBY, esperando
  // en la sala -- el control vuelve al flujo existente (Lobby, sin tocar su
  // contenido ni su comportamiento). No hay libreria de routing instalada;
  // la unica frontera de ruta real de esta tarea es "/" (portada) contra
  // todo lo demas (partida en curso), y esa frontera ya la decide `state`
  // por si sola -- no hace falta leer `window.location.pathname` para
  // saber que mostrar.
  const showLanding = !state;

  // Refleja el codigo de sala en la URL en cuanto se conoce -- el codigo NO
  // es secreto (a diferencia del publicId de las cartas) y compartir la URL
  // es justo lo que pide B2. `replaceState`, no `pushState`: entrar a una
  // sala no es una navegacion que el usuario espere deshacer con "atras".
  useEffect(() => {
    if (!state?.roomCode) return;
    const next = `/sala/${state.roomCode}`;
    if (window.location.pathname !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [state?.roomCode]);

  const reducedMotion = useReducedMotion();

  // Clave de AnimatePresence: una de las cuatro etapas de navegacion
  // (portada / lobby / partida / resultados). Deliberadamente NO usa
  // `state.phase` en crudo para "partida" -- BIDDING/REVEAL/SKIP_VOTE
  // siguen siendo la misma pantalla (Auction) y no deben re-montar ni
  // re-animar entre si, solo la frontera entre las cuatro etapas de arriba
  // importa aqui.
  const screenKey = showLanding ? "landing" : !inGame ? "lobby" : state.phase === "RESULTS" ? "results" : "auction";

  return (
    <MotionConfig reducedMotion="user">
      <FeedbackHost />
      <main className="min-h-screen bg-canvas text-forest">
        {/* Por encima de cualquier pantalla: la conexion se puede caer estando
          en Landing, Lobby, Auction o Results por igual (ver ConnectionBanner). */}
        <ConnectionBanner status={connectionStatus} onRetry={retryNow} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            initial={reducedMotion ? undefined : SCREEN_VARIANTS.initial}
            animate={SCREEN_VARIANTS.animate}
            exit={reducedMotion ? undefined : SCREEN_VARIANTS.exit}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {showLanding && (
              <Landing
                error={startError}
                onCreate={(name, visibility) => void createRoom(name, visibility)}
                onJoinByCode={(name, code) => void joinByCode(name, code)}
                onJoinPublicRoom={(name, roomId) => void joinPublicRoom(name, roomId)}
              />
            )}
            {!showLanding && !inGame && (
              <Lobby
                state={state}
                error={startError}
                myId={room?.sessionId ?? ""}
                onKick={(playerId) => send("kick", { playerId })}
                onCreate={(name) => void createRoom(name)}
                onJoinByCode={(name, code) => void joinByCode(name, code)}
                onReady={() => send("ready", {})}
              />
            )}
            {/* El error de puja NO se pinta aqui: viaja hasta BidControls y sale
              junto al campo del importe, que es donde esta el problema. */}
            {inGame && room && state.phase !== "RESULTS" && (
              <Auction
                state={state}
                myId={room.sessionId}
                roomId={room.roomId}
                error={bidError}
                errorSeq={bidErrorSeq}
                reactions={reactions}
                onDismissReaction={dismissReaction}
                tradeOffers={tradeOffers}
                send={send}
              />
            )}
            {inGame && room && state.phase === "RESULTS" && (
              <Results state={state} myId={room.sessionId} roomId={room.roomId} send={send} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}

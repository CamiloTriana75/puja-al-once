import { useEffect } from "react";
import { ConnectionBanner } from "./components/ConnectionBanner.js";
import { Auction } from "./screens/Auction.js";
import { Landing } from "./screens/Landing.js";
import { Lobby } from "./screens/Lobby.js";
import { Results } from "./screens/Results.js";
import { useRoom } from "./net/useRoom.js";

export default function App() {
  const {
    room, state, connectionStatus, retryNow, startError, bidError, bidErrorSeq, createRoom, joinByCode, send,
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

  return (
    <main className="min-h-screen bg-deep text-white">
      {/* Por encima de cualquier pantalla: la conexion se puede caer estando
          en Landing, Lobby, Auction o Results por igual (ver ConnectionBanner). */}
      <ConnectionBanner status={connectionStatus} onRetry={retryNow} />
      {showLanding && (
        <Landing
          error={startError}
          onCreate={(name) => void createRoom(name)}
          onJoinByCode={(name, code) => void joinByCode(name, code)}
        />
      )}
      {!showLanding && !inGame && (
        <Lobby
          state={state}
          error={startError}
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
          send={send}
        />
      )}
      {inGame && room && state.phase === "RESULTS" && (
        <Results state={state} myId={room.sessionId} send={send} />
      )}
    </main>
  );
}

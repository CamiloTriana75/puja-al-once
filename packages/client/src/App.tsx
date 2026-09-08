import { Auction } from "./screens/Auction.js";
import { Lobby } from "./screens/Lobby.js";
import { useRoom } from "./net/useRoom.js";

export default function App() {
  const { room, state, startError, bidError, join, send } = useRoom();
  const inGame = state && state.phase !== "LOBBY";

  return (
    <main className="min-h-screen bg-deep text-white">
      {!inGame && (
        <Lobby state={state} error={startError} onJoin={(name) => void join(name)} onReady={() => send("ready", {})} />
      )}
      {/* El error de puja NO se pinta aqui: viaja hasta BidControls y sale
          junto al campo del importe, que es donde esta el problema. */}
      {inGame && room && state.phase !== "RESULTS" && (
        <Auction state={state} myId={room.sessionId} roomId={room.roomId} error={bidError} send={send} />
      )}
    </main>
  );
}

import { useRoom } from "./net/useRoom.js";
import { Lobby } from "./screens/Lobby.js";

export default function App() {
  const { state, error, join, send } = useRoom();

  return (
    <main className="min-h-screen bg-deep text-white">
      {error && <div className="bg-danger px-4 py-2 text-center text-sm font-semibold text-ink">{error}</div>}
      {(!state || state.phase === "LOBBY") && (
        <Lobby state={state} onJoin={(name) => void join(name)} onReady={() => send("ready", {})} />
      )}
    </main>
  );
}

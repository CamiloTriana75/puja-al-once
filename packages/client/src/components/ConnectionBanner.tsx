import { RefreshCw, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "../net/useRoom.js";

/**
 * Aviso de conexión por encima de cualquier pantalla: se puede caer estando
 * en la portada, la sala, la subasta o los resultados por igual.
 */
export function ConnectionBanner({ status, onRetry }: { status: ConnectionStatus; onRetry: () => void }) {
  if (status === "connected") return null;

  const reconnecting = status === "reconnecting";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 ${reconnecting ? "bg-gold text-forest" : "bg-alert text-white"}`}
    >
      {reconnecting ? <RefreshCw className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />}
      <p className="font-copy text-[1.02rem]">
        <span className="font-semibold">{reconnecting ? "Se perdió la conexión." : "Sin conexión con el servidor."}</span>{" "}
        {reconnecting ? "Reconectando…" : "No se pudo reconectar. Revisa tu red; el servidor puede haberse caído."}
      </p>
      {!reconnecting && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto h-11 min-w-[44px] cursor-pointer rounded-full bg-white px-5 font-copy text-[1rem] font-semibold text-alert transition-colors duration-200 hover:bg-canvas"
        >
          Reintentar ahora
        </button>
      )}
    </div>
  );
}

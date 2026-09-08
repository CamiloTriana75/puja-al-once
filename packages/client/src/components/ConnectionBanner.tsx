import type { ConnectionStatus } from "../net/useRoom.js";

/** Icono de enchufe desconectado, trazo 2 sobre 24x24 -- MASTER.md S7: SVG de Lucide, nunca emojis. */
function PlugOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path d="m2 2 20 20" />
      <path d="M9 8V2" />
      <path d="M15 8V4" />
      <path d="M8.5 8.5a3 3 0 0 0-.5 4L10 15l1.5-1.5" />
      <path d="M18 9.5a3 3 0 0 1-.5 4L15.5 16" />
      <path d="M17 22v-4" />
      <path d="M11 22v-2" />
    </svg>
  );
}

/**
 * Estado de conexion visible en TODA la aplicacion -- design-system/pages/sala-espera.md:
 * "Hace falta un estado visible de 'se perdio la conexion, reintentando' que
 * cubra toda la aplicacion, no solo esta pantalla". Se monta una vez en
 * App.tsx, por encima de cualquier pantalla (Landing, Lobby, Auction,
 * Results): la caida del socket no depende de en cual de ellas estabas.
 *
 * "connected" no renderiza nada -- no hay banner "todo va bien" en este
 * diseno (MASTER.md S5/pagina de sala de espera: cero animaciones
 * decorativas de espera, y un banner de exito permanente cae en la misma
 * categoria de ruido). Solo aparece cuando hay algo que decir.
 *
 * El color nunca es el unico indicador (MASTER.md S6): reconectando lleva
 * icono + texto "Reconectando…", desconectado lleva icono + texto distinto
 * + boton -- nunca se distinguen solo por el tono de fondo.
 */
export function ConnectionBanner({ status, onRetry }: { status: ConnectionStatus; onRetry: () => void }) {
  if (status === "connected") return null;

  const reconnecting = status === "reconnecting";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 px-4 py-3 sm:px-6 ${
        reconnecting ? "border-lime/40 bg-ink text-white" : "border-danger bg-ink text-white"
      }`}
    >
      <PlugOffIcon />
      <p className="font-display text-base font-bold uppercase tracking-wide sm:text-lg">
        {reconnecting ? (
          <>
            <span className="text-lime">Se perdió la conexión.</span>{" "}
            <span className="font-body text-sm font-semibold normal-case text-mute sm:text-base">
              Reconectando…
            </span>
          </>
        ) : (
          <>
            <span className="text-danger">Sin conexión con el servidor.</span>{" "}
            <span className="font-body text-sm font-semibold normal-case text-mute sm:text-base">
              No se pudo reconectar. Revisa tu red o el servidor puede haberse caído.
            </span>
          </>
        )}
      </p>

      {!reconnecting && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto h-11 min-w-[44px] cursor-pointer border-2 border-lime px-4 font-display text-sm font-bold uppercase tracking-wide text-lime transition-colors duration-200 hover:bg-lime hover:text-ink"
        >
          Reintentar ahora
        </button>
      )}
    </div>
  );
}

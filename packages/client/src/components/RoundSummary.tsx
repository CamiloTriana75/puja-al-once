import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { SLOT_LABEL } from "./game/slots.js";

const TOTAL_SLOTS = 11;
const AUTO_DISMISS_MS = 4000;

export interface RoundSummaryPlayer {
  playerId: string;
  name: string;
  budget: number;
  /** Cuantos de los 11 puestos ya tiene fichados. */
  squadSize: number;
}

/**
 * Parte entre rondas: el puesto que abre y lo único público durante la
 * partida (saldo y puestos cubiertos; el rating sigue oculto hasta el final).
 * No bloquea: se cierra solo o a mano, y nunca impide pujar.
 */
export function RoundSummary({
  nextSlot,
  players,
  onDismiss,
}: {
  nextSlot: string;
  players: RoundSummaryPlayer[];
  onDismiss: () => void;
}) {
  // El cierre automatico se arma UNA vez. Con `onDismiss` en las dependencias el
  // temporizador se reiniciaba en cada render del padre (la cuenta atras repinta
  // cada 100 ms) y el parte nunca se cerraba solo: se quedaba tapando la pantalla.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const id = window.setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="round-summary-in fixed inset-0 z-40 flex items-center justify-center bg-forest/45 p-4 backdrop-blur-[2px]" onClick={onDismiss}>
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-canvas shadow-[0_40px_80px_-30px_rgba(12,36,28,.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pitch-stripes px-6 py-6 text-white">
          <p className="font-copy text-[1rem] text-white/85">Abre el siguiente puesto</p>
          <h2 className="mt-1 font-headline text-[clamp(1.6rem,5vw,2.2rem)] font-bold leading-[1.05] tracking-[-0.04em]">
            {SLOT_LABEL[nextSlot] ?? nextSlot}
          </h2>
        </div>
        <ol className="divide-y divide-line px-6 py-3">
          {players.map((row) => (
            <li key={row.playerId} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1 truncate font-copy text-[1.05rem] font-medium text-forest">{row.name}</span>
              <span className="tnum font-headline text-[1rem] font-semibold text-forest">{row.budget} M</span>
              <span className="tnum w-14 text-right font-copy text-[0.95rem] text-slate">
                {row.squadSize}/{TOTAL_SLOTS}
              </span>
            </li>
          ))}
        </ol>
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-forest font-copy text-[1.02rem] font-semibold text-white transition-colors duration-200 hover:bg-[#163A2D]"
          >
            Seguir jugando
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

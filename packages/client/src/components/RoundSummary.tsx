import { useEffect } from "react";

const SLOT_LABEL: Record<string, string> = {
  GK: "Portero", LB: "Lateral izquierdo", CB1: "Central", CB2: "Central",
  RB: "Lateral derecho", CDM: "Mediocentro defensivo", CM: "Mediocentro",
  CAM: "Mediapunta", LW: "Extremo izquierdo", ST: "Delantero", RW: "Extremo derecho",
};

const TOTAL_SLOTS = 11;

/** Icono de flecha adelante, trazo 2 sobre 24x24 -- MASTER.md S7: SVG, nunca emoji. */
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const AUTO_DISMISS_MS = 4000;

export interface RoundSummaryPlayer {
  playerId: string;
  name: string;
  budget: number;
  /** Cuantos de los 11 puestos ya tiene fichados. */
  squadSize: number;
}

/**
 * Resumen entre rondas -- punto 4 del encargo B5, reescrito para F5/D3: con
 * el rating oculto hasta RESULTS (ver RevealBar.tsx, SquadGrid.tsx) ya no
 * hay forma honesta de calcular una clasificacion aqui -- todo cruce
 * cardId -> rating devolveria 0 para todo el mundo. En su lugar se muestra
 * lo unico que SI es publico durante la partida: dinero restante y puestos
 * ya cubiertos de cada jugador. Ver design-system/pages/partida.md: "El
 * resumen entre rondas deja de mostrar clasificacion... y muestra dinero
 * restante y puestos cubiertos de cada jugador."
 *
 * Auction.tsx lo monta solo durante la transicion (detecta el cambio de
 * `slotIndex`) y lo desmonta el mismo componente padre cuando toca.
 *
 * Deliberadamente NO bloqueante: quien quiera seguir jugando ya (la nueva
 * carta ya esta en BIDDING para cuando esto aparece) puede cerrarlo a mano o
 * dejar que se cierre solo -- nunca le impide pujar a quien no lo mira.
 *
 * Presupuesto de movimiento: MASTER.md S5 fija dos elementos por vista como
 * maximo, y el reveal que acaba de pasar ya gasto los suyos (silueta -> foto
 * + nombre entrando). Esto es SOLO opacidad, sin cruce ni coreografia --
 * informativo, no espectacular, tal como pide el encargo.
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
  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className="round-summary-in fixed inset-0 z-40 flex items-center justify-center bg-ink/80 p-4"
      onClick={onDismiss}
    >
      <div
        role="status"
        aria-live="polite"
        className="panel w-full max-w-md bg-ink p-6 pb-10"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-mute">Siguiente puesto</p>
        <h2 className="mt-1 font-display text-[clamp(2rem,6vw,3rem)] font-black uppercase leading-[0.9] tracking-tight text-lime">
          {SLOT_LABEL[nextSlot] ?? nextSlot}
        </h2>

        <p className="mt-6 font-display text-xs font-bold uppercase tracking-[0.12em] text-mute">
          Cómo va cada uno
        </p>
        <ol className="mt-2 flex flex-col gap-px bg-white/10">
          {players.map((row) => (
            <li key={row.playerId} className="flex items-baseline gap-3 bg-ink px-3 py-2">
              <span className="font-display text-base font-bold uppercase text-white">{row.name}</span>
              <span className="tnum ml-auto font-display text-lg font-extrabold text-green">
                {row.budget} M
              </span>
              <span className="tnum font-body text-sm text-mute">
                {row.squadSize}/{TOTAL_SLOTS} puestos
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 flex h-11 min-w-[44px] cursor-pointer items-center gap-2 border-2 border-white/30 px-4 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors duration-200 hover:border-lime hover:text-lime"
        >
          Seguir jugando
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { PlayerView, RevealedCardView } from "../net/types.js";
import { SLOT_ABBR, SLOT_ORDER } from "./game/slots.js";

interface Props {
  player: PlayerView;
  revealedCards: Map<string, RevealedCardView>;
  /** Huecos en los que este jugador tiene el mejor rating de la sala. */
  wonSlots?: Set<string>;
}

/**
 * Posiciones en el campo (% del ancho y del alto), ataque arriba y portero
 * abajo. Los once puestos del juego forman un 4-3-3: defensa de cuatro, un
 * pivote y dos interiores, y extremos con delantero.
 */
const POSITIONS: Record<string, { x: number; y: number }> = {
  GK: { x: 50, y: 92 },
  LB: { x: 13, y: 74 },
  CB1: { x: 37, y: 76.5 },
  CB2: { x: 63, y: 76.5 },
  RB: { x: 87, y: 74 },
  CDM: { x: 50, y: 60 },
  CM: { x: 26, y: 45 },
  CAM: { x: 74, y: 35 },
  LW: { x: 14, y: 21 },
  ST: { x: 50, y: 12 },
  RW: { x: 86, y: 21 },
};

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Líneas del campo: viewBox 300x400, mismo aspecto que el contenedor. */
function PitchLines() {
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
      <g stroke="white" strokeOpacity=".6" strokeWidth="2" vectorEffect="non-scaling-stroke">
        <rect x="8" y="8" width="284" height="384" rx="6" />
        <path d="M8 200h284" />
        <circle cx="150" cy="200" r="38" />
        <path d="M80 392V322h140v70M114 392v-34h72v34" />
        <path d="M80 8v70h140V8M114 8v34h72V8" />
      </g>
      <circle cx="150" cy="200" r="3" fill="white" fillOpacity=".7" />
    </svg>
  );
}

/**
 * El once de un jugador sobre el campo. Cada puesto muestra el rating en una
 * ficha y debajo el nombre; los puestos que gana llevan oro, check y texto
 * (para lectores de pantalla hay una lista completa debajo del campo).
 */
export function SquadGrid({ player, revealedCards, wonSlots }: Props) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div>
      <div className="@container">
        <div className="pitch-field relative aspect-[5/8] w-full @md:aspect-[3/4] overflow-hidden rounded-[1.25rem]">
          <PitchLines />
          <ul aria-hidden="true" className="absolute inset-0">
            {SLOT_ORDER.map((slot, index) => {
              const pos = POSITIONS[slot]!;
              const cardId = player.squad.get(slot);
              const card = cardId ? revealedCards.get(cardId) : undefined;
              const won = wonSlots?.has(slot) ?? false;
              const ratingHidden = card !== undefined && card.rating <= 0;
              return (
                <motion.li
                  key={slot}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: reducedMotion ? 0 : index * 0.04 }}
                  className="absolute flex w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <span
                    className={`tnum relative grid size-11 place-items-center rounded-full font-headline text-[0.95rem] font-bold tracking-[-0.04em] shadow-[0_8px_14px_-6px_rgba(12,36,28,.7)] @md:size-14 @md:text-[1.2rem] ${
                      !card
                        ? "border-2 border-dashed border-white/70 bg-white/15 text-white/80 shadow-none"
                        : won
                          ? "bg-gold text-forest ring-[3px] ring-white"
                          : "bg-white text-forest"
                    }`}
                  >
                    {card ? (ratingHidden ? "?" : card.rating) : "—"}
                    {won && (
                      <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-forest text-gold">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex max-w-full flex-col items-center rounded-xl bg-forest/92 px-2 py-0.5 font-copy text-[0.68rem] leading-tight text-white @md:text-[0.82rem]">
                    <span className="flex max-w-full items-center gap-1">
                      <span className="shrink-0 font-headline text-[0.9em] font-semibold text-gold">{SLOT_ABBR[slot]}</span>
                      <span className="truncate">
                        {card ? (
                          <>
                            <span className="@md:hidden">{lastName(card.name)}</span>
                            <span className="hidden @md:inline">{card.name}</span>
                          </>
                        ) : (
                          "Vacío"
                        )}
                      </span>
                    </span>
                    {card && <span className="tnum text-[0.9em] text-white/75">{card.season}</span>}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>

      <ul className="sr-only">
        {SLOT_ORDER.map((slot) => {
          const cardId = player.squad.get(slot);
          const card = cardId ? revealedCards.get(cardId) : undefined;
          return (
            <li key={slot}>
              {SLOT_ABBR[slot]}: {card ? `${card.name} ${card.season}, rating ${card.rating <= 0 ? "oculto" : card.rating}` : "sin fichaje"}
              {wonSlots?.has(slot) ? " (gana el puesto)" : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

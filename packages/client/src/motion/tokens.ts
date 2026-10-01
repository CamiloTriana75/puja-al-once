/**
 * Lenguaje de movimiento de Futbolera. Todas las animaciones del juego salen
 * de aqui para que duren y se muevan igual en cualquier pantalla.
 *
 * - Retroalimentacion de interfaz: 150-500 ms.
 * - Eventos grandes del juego (destape, mazo, campeon): 500-1200 ms.
 * - Sobreimpulso y resortes, con mesura: nunca todo a la vez.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const DURATION = {
  micro: 0.18,
  ui: 0.3,
  feedback: 0.45,
  event: 0.8,
} as const;

/** Resorte con un poco de rebote: para fichas, medallas y numeros que "caen". */
export const SPRING_POP = { type: "spring", stiffness: 420, damping: 18, mass: 0.8 } as const;

/** Instante (ms) en que el mazo toca el bloque en la animacion de cierre: lo que pasa a la vez (destello, pop) se cuadra con este valor. */
export const HAMMER_IMPACT_MS = 668;

/** Latido del precio al llegar una puja nueva. */
export const BID_PULSE_SCALE = [1, 1.1, 1];

/** Sacudida corta para rechazos y para el ultimo segundo del reloj. */
export const SHAKE = { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.28, ease: "easeInOut" } } as const;

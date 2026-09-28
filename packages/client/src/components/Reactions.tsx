import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Los seis emojis fijos del contrato -- design-system/pages/partida.md:
 * "Fila de 6 botones (44 px) con los emojis fijos del contrato. Los emojis
 * aqui son CONTENIDO del jugador, no iconos de interfaz: la regla de 'sin
 * emojis como iconos' (MASTER.md S7) no aplica aqui a proposito."
 *
 * Montado en `Auction.tsx` (encargo F-reacciones): `onSend` manda
 * `send("react", { emoji: REACTIONS.indexOf(emoji) })` y `incoming` recibe
 * lo que `useRoom.ts` acumula desde `onMessage("reaction", ...)` -- ver
 * `AuctionRoom.onReact` en el servidor para el contrato completo (rango,
 * limite de frecuencia).
 *
 * Exportado (no solo el tipo `ReactionEmoji`): quien lo monta necesita el
 * MISMO orden para traducir entre el emoji visual y el indice `0..5` que
 * viaja por red -- una sola fuente de verdad para el orden evita que
 * servidor y cliente diverjan si algun dia cambian los emojis.
 */
export const REACTIONS = ["😂", "😮", "🔥", "😭", "👏", "😡"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
const REACTION_NAMES = ["risa", "sorpresa", "fuego", "llanto", "aplausos", "rabia"] as const;

/** Enfriamiento visual tras cada pulsacion; el servidor tambien aplica el limite. */
const COOLDOWN_MS = 600;
/** Cuanto tarda la burbuja en subir y desvanecerse -- partida.md: "1.5s, ease-out". */
const BUBBLE_LIFETIME_MS = 1500;

export interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  senderName: string;
}

interface BubbleProps {
  reaction: FloatingReaction;
  onExpire: (id: string) => void;
  /** Desplazamiento horizontal estable para que burbujas seguidas no se apilen exactas. */
  offsetX: number;
  /**
   * Sin subida -- ni por `prefers-reduced-motion` (`reducedMotion`, ya
   * existia) ni porque quien monta el componente lo pide explicitamente
   * (`noRise`, D8/partida.md: "durante el reveal, que ya gasta el
   * presupuesto de animacion de la vista, las reacciones se muestran sin
   * subida"). Dos causas, un mismo efecto visual -- de ahi combinarlas en
   * un solo booleano en vez de bifurcar el JSX de abajo por cada una.
   */
  noRise: boolean;
}

function ReactionBubble({ reaction, onExpire, offsetX, noRise }: BubbleProps) {
  // useReducedMotion() tipa boolean | null ("todavia no se sabe", solo en el
  // primer render SSR/pre-hidratacion -- aqui no aplica, pero el tipo se
  // mantiene): se normaliza a boolean antes de combinar con `noRise`.
  const reducedMotion = useReducedMotion() ?? false;
  const skipRise = noRise || reducedMotion;

  // Sin subida, `initial` y `animate` son el mismo objeto: Framer no tiene
  // nada que animar y resuelve `onAnimationComplete` de inmediato (probado
  // con navegadores reales bajo `prefers-reduced-motion: reduce` -- NO
  // "nunca", como se penso en un primer intento de este arreglo: dispara
  // enseguida, al primer render). Sin este freno, una burbuja `skipRise`
  // desaparecia en el acto -- nunca llegaba a pintarse los 1.5s fijos que
  // pide partida.md ("aparecen 1.5s fijos... y desaparecen") -- porque
  // `onExpire` (para `incoming`) borra la entrada de la lista en
  // useRoom.ts antes de que React pinte el siguiente frame. Se ignora la
  // llamada de Framer en este caso y se usa solo el temporizador de abajo,
  // que si respeta los 1.5s.
  const handleAnimationComplete = useCallback(() => {
    if (skipRise) return;
    onExpire(reaction.id);
  }, [skipRise, onExpire, reaction.id]);

  useEffect(() => {
    if (!skipRise) return;
    const timer = window.setTimeout(() => onExpire(reaction.id), BUBBLE_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [skipRise, reaction.id, onExpire]);

  return (
    <motion.div
      role="status"
      initial={skipRise ? { opacity: 1 } : { opacity: 0, y: 0, scale: 0.8 }}
      animate={skipRise ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
      transition={{ duration: BUBBLE_LIFETIME_MS / 1000, ease: "easeOut" }}
      onAnimationComplete={handleAnimationComplete}
      className="pointer-events-none absolute bottom-0 flex flex-col items-center"
      style={{ left: `calc(50% + ${offsetX}px)` }}
    >
      <span className="text-4xl leading-none">{reaction.emoji}</span>
      <span className="mt-1 whitespace-nowrap bg-ink px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-white">
        {reaction.senderName}
      </span>
    </motion.div>
  );
}

interface Props {
  /** Nombre propio: viaja con cada reaccion que ESTE cliente manda, igual que hara el servidor cuando exista el mensaje de verdad. */
  myName: string;
  /**
   * Reacciones ya en vuelo a mostrar -- de otros jugadores o propias, tanto
   * da para pintarlas. Vive fuera del componente (en quien lo monte) porque
   * el origen real (server broadcast) todavia no existe: hoy quien lo monte
   * solo tiene las que genera `onSend` de este mismo componente, pero la
   * prop ya esta lista para recibir las de otros en cuanto el servidor las
   * reenvie.
   */
  incoming?: FloatingReaction[];
  /** Se llama al pulsar un emoji, ANTES de ningun efecto visual local -- quien lo monte decide si tambien lo manda a la sala. */
  onSend?: (emoji: ReactionEmoji) => void;
  /**
   * Sin animacion de subida, aunque el sistema no pida
   * `prefers-reduced-motion` -- partida.md, seccion "Reacciones": durante el
   * reveal (que ya gasta dos elementos del presupuesto de movimiento de la
   * vista) las burbujas aparecen fijas 1.5s y se desvanecen, igual que con
   * movimiento reducido. Por defecto `false`: fuera del reveal, sube igual
   * que siempre.
   */
  noRise?: boolean;
  /**
   * Se llama cuando CUALQUIER burbuja termina de animarse -- tanto una
   * propia (que este componente ya retira de `ownBubbles` por su cuenta)
   * como una de `incoming` (que este componente no posee: solo pintarla). Es
   * la unica forma que tiene quien monta esto de saber cuando retirar una
   * entrada de `incoming` sin que la lista crezca sin limite -- ver
   * `dismissReaction` en useRoom.ts.
   */
  onExpire?: (id: string) => void;
}

/**
 * Fila de reacciones -- design-system/pages/partida.md. Gestiona su propio
 * enfriamiento visual y sus propias burbujas locales (las que ESTE cliente
 * dispara); `incoming` permite fusionar burbujas de otros jugadores el dia
 * que el servidor las reenvie, sin cambiar la forma de este componente.
 */
export function Reactions({ myName, incoming = [], onSend, noRise = false, onExpire }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const skipRise = noRise || reducedMotion;
  const [ownBubbles, setOwnBubbles] = useState<FloatingReaction[]>([]);
  const [cooling, setCooling] = useState(false);
  const offsetsRef = useRef(new Map<string, number>());

  const bubbles = [...ownBubbles, ...incoming];

  const offsetFor = (id: string) => {
    if (!offsetsRef.current.has(id)) {
      // Determinista y estable entre renders: no introduce aleatoriedad ni
      // mutación de identidad visual mientras React vuelve a pintar.
      let hash = 2166136261;
      for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      offsetsRef.current.set(id, (Math.abs(hash) % 49) - 24);
    }
    return offsetsRef.current.get(id)!;
  };

  const expire = useCallback((id: string) => {
    setOwnBubbles((prev) => prev.filter((b) => b.id !== id));
    offsetsRef.current.delete(id);
    onExpire?.(id);
  }, [onExpire]);

  const send = (emoji: ReactionEmoji) => {
    if (cooling) return;
    onSend?.(emoji);
    const reaction: FloatingReaction = { id: `${Date.now()}-${Math.random()}`, emoji, senderName: myName };
    setOwnBubbles((prev) => [...prev, reaction]);
    // El respaldo de expiracion sin subida (skipRise) vive en ReactionBubble
    // -- cubre esta burbuja propia igual que cualquiera de `incoming`, ver
    // su comentario para el bug que cerro.
    setCooling(true);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className="relative">
      {/* Zona flotante -- z-index 20 fijado por design-system/pages/partida.md S "Escala de capas". */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center overflow-visible">
        <AnimatePresence>
          {bubbles.map((b) => (
            <ReactionBubble key={b.id} reaction={b} onExpire={expire} offsetX={offsetFor(b.id)} noRise={skipRise} />
          ))}
        </AnimatePresence>
      </div>

      <div role="group" aria-label="Reacciones" className="flex flex-wrap justify-center gap-2">
        {REACTIONS.map((emoji, index) => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            disabled={cooling}
            aria-label={`Reaccionar: ${REACTION_NAMES[index]}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-2 border-white/20 bg-ink text-2xl transition-colors duration-200 hover:border-lime disabled:cursor-not-allowed disabled:opacity-40"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

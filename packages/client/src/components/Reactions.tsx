import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

/**
 * Los seis emojis fijos del contrato -- design-system/pages/partida.md:
 * "Fila de 6 botones (44 px) con los emojis fijos del contrato. Los emojis
 * aqui son CONTENIDO del jugador, no iconos de interfaz: la regla de 'sin
 * emojis como iconos' (MASTER.md S7) no aplica aqui a proposito."
 *
 * HOY ESTE CONTRATO NO EXISTE EN EL SERVIDOR: `packages/server/src/AuctionRoom.ts`
 * no registra ningun `onMessage("reaction", ...)` ni reenvia nada parecido
 * a los demas clientes (confirmado leyendo ese fichero -- los unicos
 * mensajes son ready/bid/pass/voteSkip/rematch), y `AuctionRoomState` no
 * tiene ningun campo Schema para reacciones. Este componente construye
 * intencionadamente SOLO la mitad visual -- el emoji que sube y se
 * desvanece con el nombre de quien lo mando -- y expone `onSend` para que
 * quien lo monte decida como propagarlo. Sin cambios de servidor no hay
 * forma honesta de que la reaccion de un jugador llegue al resto: por eso
 * `Auction.tsx` (fuera de los limites de esta tarea, ver el encargo) no
 * inserta esto todavia. Ver el informe de esta tarea para el detalle.
 */
const REACTIONS = ["😂", "😮", "🔥", "😭", "👏", "😡"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

/** Enfriamiento visual tras cada pulsacion -- el servidor (cuando exista) limita igual, esto es solo el reflejo en el boton. */
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
  /** Desplazamiento horizontal aleatorio para que varias burbujas seguidas no se apilen exactas -- puramente cosmetico, decidido una vez por burbuja. */
  offsetX: number;
}

function ReactionBubble({ reaction, onExpire, offsetX }: BubbleProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 0, scale: 0.8 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
      transition={{ duration: BUBBLE_LIFETIME_MS / 1000, ease: "easeOut" }}
      onAnimationComplete={() => onExpire(reaction.id)}
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
}

/**
 * Fila de reacciones -- design-system/pages/partida.md. Gestiona su propio
 * enfriamiento visual y sus propias burbujas locales (las que ESTE cliente
 * dispara); `incoming` permite fusionar burbujas de otros jugadores el dia
 * que el servidor las reenvie, sin cambiar la forma de este componente.
 */
export function Reactions({ myName, incoming = [], onSend }: Props) {
  const reducedMotion = useReducedMotion();
  const [ownBubbles, setOwnBubbles] = useState<FloatingReaction[]>([]);
  const [cooling, setCooling] = useState(false);
  const offsetsRef = useRef(new Map<string, number>());

  const bubbles = [...ownBubbles, ...incoming];

  const offsetFor = (id: string) => {
    if (!offsetsRef.current.has(id)) {
      offsetsRef.current.set(id, Math.round((Math.random() - 0.5) * 48));
    }
    return offsetsRef.current.get(id)!;
  };

  const expire = useCallback((id: string) => {
    setOwnBubbles((prev) => prev.filter((b) => b.id !== id));
    offsetsRef.current.delete(id);
  }, []);

  const send = (emoji: ReactionEmoji) => {
    if (cooling) return;
    onSend?.(emoji);
    const reaction: FloatingReaction = { id: `${Date.now()}-${Math.random()}`, emoji, senderName: myName };
    setOwnBubbles((prev) => [...prev, reaction]);
    if (reducedMotion) {
      window.setTimeout(() => expire(reaction.id), BUBBLE_LIFETIME_MS);
    }
    setCooling(true);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className="relative">
      {/* Zona flotante -- z-index 20 fijado por design-system/pages/partida.md S "Escala de capas". */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center overflow-visible">
        <AnimatePresence>
          {bubbles.map((b) => (
            <ReactionBubble key={b.id} reaction={b} onExpire={expire} offsetX={offsetFor(b.id)} />
          ))}
        </AnimatePresence>
      </div>

      <div role="group" aria-label="Reacciones" className="flex flex-wrap justify-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            disabled={cooling}
            aria-label={`Reaccionar con ${emoji}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-2 border-white/20 bg-ink text-2xl transition-colors duration-200 hover:border-lime disabled:cursor-not-allowed disabled:opacity-40"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

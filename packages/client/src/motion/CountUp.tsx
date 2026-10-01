import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "./tokens.js";

/**
 * Cifra que sube o baja hasta su nuevo valor. Al montar muestra el valor final
 * sin animar (una partida a medias no debe contar desde cero), y con
 * movimiento reducido salta directa.
 */
export function CountUp({
  value,
  duration = 0.6,
  format = (n) => String(n),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reducedMotion || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (latest) => setShown(Math.round(latest)),
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => {
      from.current = shown;
      controls.stop();
    };
    // `shown` se lee solo en la limpieza para no perder el tramo ya recorrido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reducedMotion]);

  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}

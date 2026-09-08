import { useEffect, useRef, useState } from "react";
import { HTTP_URL } from "./endpoints.js";

/**
 * Cuenta atras hasta `endsAt`, que es hora del SERVIDOR. El navegador puede ir
 * adelantado o atrasado, asi que se mide el desfase una vez y se corrige.
 * Esto es decoracion: el resultado de la subasta lo decide el servidor.
 */
export function useServerClock(endsAt: number): number {
  const offsetRef = useRef(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sample = async () => {
      try {
        const sentAt = Date.now();
        const response = await fetch(`${HTTP_URL}/time`);
        const { now } = (await response.json()) as { now: number };
        const roundTrip = Date.now() - sentAt;
        if (!cancelled) offsetRef.current = now + roundTrip / 2 - Date.now();
      } catch (cause) {
        // Sin corregir el desfase el reloj sigue funcionando con la hora
        // local del navegador (offsetRef.current se queda en 0) -- es
        // decoracion, no decide nada -- pero un fallo mudo aqui deja a
        // quien depure sin ninguna pista de por que el contador a veces se
        // ve desfasado.
        if (!cancelled) console.error("useServerClock: no se pudo sincronizar con /time", cause);
      }
    };
    void sample();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - (Date.now() + offsetRef.current)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}

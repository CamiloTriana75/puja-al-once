import { useEffect, useRef, useState } from "react";

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
      const sentAt = Date.now();
      const response = await fetch(`${import.meta.env.VITE_HTTP_URL ?? "http://localhost:2567"}/time`);
      const { now } = (await response.json()) as { now: number };
      const roundTrip = Date.now() - sentAt;
      if (!cancelled) offsetRef.current = now + roundTrip / 2 - Date.now();
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

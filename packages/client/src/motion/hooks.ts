import { useEffect, useRef, useState } from "react";

/** Valor del render anterior (undefined en el primero). */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/**
 * Verdadero durante `ms` tras cada cambio de `value`, y falso al montar: sirve
 * para mensajes breves ("Ana", "-65 M") que no deben salir al entrar a una
 * partida ya en marcha.
 */
export function useRecentChange<T>(value: T, ms: number): boolean {
  const [recent, setRecent] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setRecent(true);
    const id = window.setTimeout(() => setRecent(false), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return recent;
}

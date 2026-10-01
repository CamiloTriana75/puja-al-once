import { useSyncExternalStore } from "react";
import gavelUrl from "../assets/gavel.wav";

const STORAGE_KEY = "futbolera:silencio";
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = readMuted();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura lo que dure la pestaña.
  }
  for (const listener of listeners) listener();
}

/** Preferencia de silencio compartida por toda la interfaz. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => muted,
    () => false,
  );
}

let gavel: HTMLAudioElement | null = null;

/** Carga el golpe de mazo con antelacion para que suene en el instante exacto. */
export function preloadGavel(): void {
  if (gavel || typeof Audio === "undefined") return;
  gavel = new Audio(gavelUrl);
  gavel.preload = "auto";
}

/** El audio ya empieza en el impacto (pico a ~11 ms): se llama justo cuando el mazo golpea. */
export function playGavel(): void {
  if (muted) return;
  preloadGavel();
  if (!gavel) return;
  gavel.currentTime = 0;
  const result = gavel.play() as Promise<void> | undefined;
  result?.catch?.(() => {
    // El navegador puede bloquear el audio hasta el primer gesto: no es un error del juego.
  });
}

import { useSyncExternalStore } from "react";

/**
 * Instalacion de la app (PWA).
 *
 * Chrome, Edge y Android disparan `beforeinstallprompt` UNA vez, muy pronto:
 * por eso este modulo se importa desde main.tsx y guarda el evento antes de
 * que React pinte nada. Safari en iPhone/iPad no lo tiene: ahi solo se puede
 * explicar el gesto manual (Compartir > Anadir a pantalla de inicio).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode =
  /** Ya esta instalada y abierta como app: no hay nada que ofrecer. */
  | "installed"
  /** El navegador ofrece instalar con un clic. */
  | "prompt"
  /** iPhone o iPad: instrucciones manuales. */
  | "ios"
  /** Cualquier otro navegador: instrucciones genericas. */
  | "manual";

export type InstallResult = "accepted" | "dismissed" | "unavailable";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ se presenta como Mac: se distingue por la pantalla tactil.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function currentMode(): InstallMode {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "manual";
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Lanza el dialogo nativo de instalacion, si el navegador lo ofrece. */
export async function promptInstall(): Promise<InstallResult> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome;
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentMode,
    () => "manual" as InstallMode,
  );
}

/** Registra el service worker solo en produccion: en desarrollo la cache estorba. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker el juego funciona igual: solo no se podra instalar.
    });
  });
}

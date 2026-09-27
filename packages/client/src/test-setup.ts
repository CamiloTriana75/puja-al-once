import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// @testing-library/react no limpia el DOM entre tests por su cuenta fuera
// de Jest (que lo hace via su integracion automatica) -- sin esto, cada
// test deja su arbol montado y el siguiente test que busque por texto o rol
// encuentra duplicados del test anterior.
afterEach(() => {
  cleanup();
});

// jsdom no implementa window.matchMedia (ver https://github.com/jsdom/jsdom/issues/3522)
// -- framer-motion.useReducedMotion() y el propio codigo del proyecto
// (Landing.tsx, Ceremony.tsx) lo llaman para leer prefers-reduced-motion.
// Sin este polyfill, ese matchMedia real de jsdom es `undefined` y la
// llamada revienta en tiempo de montaje, dejando el componente sin poder
// avanzar de estado. Por defecto simula "sin preferencia" (matches: false);
// un test concreto puede sobreescribirlo si necesita probar el otro caso.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

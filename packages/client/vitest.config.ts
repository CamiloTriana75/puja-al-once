import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Config propia del paquete cliente -- antes no existia (la raiz solo cubre
 * `tools/`, ver vitest.config.ts de la raiz) y `vitest run` caia en el
 * entorno por defecto ("node"), suficiente mientras todos los tests eran
 * logica pura sobre tipos planos (connectionStatus, endpoints,
 * liveStandings, roomLookup). Los componentes nuevos de la ceremonia
 * necesitan `document`/`window` de verdad para @testing-library/react, de
 * ahi jsdom -- no rompe los tests existentes porque ninguno toca una API
 * exclusiva de Node.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});

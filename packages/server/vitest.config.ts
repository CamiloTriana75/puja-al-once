import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    // Cada fichero de test de sala hace boot(appConfig), que arranca un
    // servidor de verdad en el puerto fijo 2568 (DEFAULT_TEST_PORT de
    // @colyseus/testing). Con paralelismo entre ficheros, dos boots a la vez
    // revientan con EADDRINUSE :::2568. Las Tasks 9-11 anaden cada una su
    // propio fichero de test de sala, asi que esto no es opcional.
    fileParallelism: false,
  },
});

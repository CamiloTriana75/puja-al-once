# Handoff para Codex — Subasta Futbolera

Pega esto como prompt inicial en Codex, en este directorio (`C:\Users\jtria\OneDrive\Desktop\Proyectos\Fut`), rama `subasta-futbolera`. HEAD de referencia al escribir esto: `6d11175`.

---

## Contexto del proyecto

Juego de navegador multijugador: 4 jugadores pujan por futbolistas ocultos tras una silueta. Al cerrarse cada puja se revela quién es, de qué temporada, y ahora también **su foto real de esa temporada exacta**. El rating se oculta durante toda la partida y solo se destapa al final. Servidor Colyseus 0.16 (TypeScript), cliente React + Vite + Tailwind 4.

**Documentos que hay que leer, en este orden, antes de tocar nada:**

1. `docs/superpowers/specs/2026-09-02-subasta-futbolera-design.md` — las reglas del juego, autoridad sobre el núcleo.
2. `docs/superpowers/plans/2026-09-25-alpha.md` — decisiones D1-D10 de la alpha (algunas ya hechas, otras en pausa, ver abajo).
3. `docs/superpowers/plans/2026-09-26-feedback-amigos.md` — feedback real de la primera partida jugada con amigos, y las decisiones F1-F5 que salieron de ahí.
4. `design-system/MASTER.md` y las páginas en `design-system/pages/` (`ceremonia.md`, `partida.md`, `sala-espera.md`, `landing.md`) — sistema de diseño **vinculante**. Estilo de retransmisión deportiva: bloques negros biselados, verde/lima saturado, tipografía condensada. Nunca esquinas redondeadas grandes, nunca texto blanco sobre el verde de marca (falla contraste, 2.28:1).
5. `.superpowers/sdd/2026-09-02-subasta-futbolera/progress.md` — el ledger completo de todo lo hecho hasta ahora, con las decisiones y sus porqués. Es la memoria del proyecto.

## Restricciones que NO se negocian

- **Colyseus se queda en la línea 0.16.** El cliente más nuevo publicado (`colyseus.js@0.16.22`) depende de `@colyseus/schema@^3`; las líneas 0.17/0.18 del servidor exigen schema 4/5 y no tienen cliente publicado. Subir de versión rompe el cliente.
- **`defineTypes()`, nunca `@type()`** en `packages/server/src/schema.ts` — los decoradores no sobreviven a esbuild (Vite/Vitest).
- **`packages/shared` no importa Colyseus, React ni Node.** Sin `Date.now()` ni `Math.random()` dentro: el tiempo y el azar entran siempre como parámetro.
- **El cliente nunca importa clases `Schema`.** Se tipa contra `packages/client/src/net/types.ts`.
- **Ningún dato privado de carta llega al navegador antes de su momento**: identidad (nombre, club, temporada, nación, liga) antes del reveal, y **rating antes de `RESULTS`**. Esto costó varias rondas de arreglos en el pasado — cualquier campo nuevo que toque el `Schema` necesita este mismo cuidado.
- TypeScript `6.0.3`. Commits terminados en una línea de coautoría (usa la que tu entorno tenga configurada).
- **Nunca `git add -A`.** Añade ficheros por nombre — hay agentes trabajando en paralelo sobre el mismo árbol y un `-A` se lleva por delante cambios ajenos sin commitear.
- Si `git commit` falla por `index.lock`, espera unos segundos y reintenta — no lo borres a mano.

## Qué está hecho (verificado, no solo "reportado")

- Motor de reglas completo en `packages/shared`, servidor completo en `packages/server`: partida jugable de principio a fin.
- **Mazo de 110 cartas** (10 por puesto), con foto y silueta **únicas por carta** — cada temporada tiene su propia imagen exacta de ese año, verificada contra el campo Date de Wikimedia Commons. `silhouetteId` coincide con `cardId`.
- D1 (ventana de apertura con reloj real), D2 (Paso sustituye a cerrar-sin-pujas), D3 (rating oculto hasta resultados), D5 (revancha): hechos en servidor y cliente.
- F1: `drawRound` nunca reparte dos temporadas del mismo futbolista en la misma ronda.
- F5: el cliente está alineado con el servidor en Paso, ventana de apertura, rating oculto y revancha — pero **verifica el estado real con `git log` y `f5-report.md`**, puede haber seguido evolucionando después de este documento.

## Qué puede estar en marcha ahora mismo

Dos agentes en paralelo, lanzados justo antes de este handoff:

1. **Voto de salto por todos** (informe esperado en `.superpowers/sdd/2026-09-02-subasta-futbolera/f-voto-report.md`): cambia la elegibilidad de voto de "solo quien necesita el puesto" a "todos los jugadores conectados". Toca `packages/shared` y `packages/server`.
2. **Frontend con Framer Motion** (informe esperado en `f-frontend-report.md`): rediseño de sala de espera, portada, ceremonia final de revelado de ratings, y reacciones. Toca `packages/client`.

**Antes de tocar nada, comprueba si esos informes ya existen y si hay commits nuevos desde `6d11175`.** Si los agentes terminaron, revisa su trabajo (léelo, no lo des por bueno a ciegas) y sigue desde ahí. Si se cortaron a medias, retómalos tú.

## En pausa — no las hagas salvo que se pida explícitamente

D6 (más de 4 jugadores), D7 (velocidad de partida), D8 (reacciones — puede que ya se esté haciendo, ver arriba), D9 (sonido), el primer despliegue permanente a producción (la infraestructura está preparada y documentada en `docs/PRODUCCION.md`; se hará en Render, no en Fly.io).

## Cómo trabajar en este repo

- Verifica siempre con datos reales, no supuestos: arranca `pnpm --filter @fut/server dev` (puerto 2567) y `pnpm --filter @fut/client dev` (puerto 5173), y prueba con varios navegadores reales (Playwright, `@playwright/test` ya instalado) antes de dar algo por terminado. Varias sesiones de este proyecto han encontrado bugs reales solo al probar así, nunca leyendo el código.
- Los tests del servidor solo pueden correr **un fichero a la vez** (`packages/server/vitest.config.ts` tiene `fileParallelism: false`) — no lo quites.
- La invariante de plantilla completa (`invariant.test.ts`) es el test más importante del proyecto: nadie puede terminar con un puesto vacío por culpa de las reglas. Ejecútala varias veces seguidas tras cualquier cambio de reglas, usa azar real.
- Guarda tus hallazgos y decisiones en `.superpowers/sdd/2026-09-02-subasta-futbolera/progress.md` (añade al final, no reescribas) para que la próxima sesión —tuya o de otra herramienta— tenga memoria de por qué se hizo cada cosa.

# Beta jugable — Plan

**Goal:** Llevar el juego de "4 jugadores exactos, sala única, sin portada" a una beta que se pueda enseñar: salas con código, landing que explica el juego enseñándolo, y las asperezas de la partida limadas.

**Spec base:** [`2026-09-02-subasta-futbolera-design.md`](../specs/2026-09-02-subasta-futbolera-design.md) — sigue siendo la autoridad sobre las reglas del juego. Este plan añade envoltorio, no cambia el núcleo.

**Sistema de diseño:** `design-system/MASTER.md`, y `design-system/pages/landing.md` para la portada.

## El bloqueo que ordena todo el plan

El mazo tiene **exactamente 5 cartas por puesto**. El reparto de cada ronda es `jugadores + 1`. Por tanto:

| Jugadores | Cartas necesarias por puesto | ¿Alcanza hoy? |
|---|---|---|
| 4 (la beta) | 5 | sí, pero sin holgura para saltar |
| 5 | 6 | **no** |
| 6 | 7 | **no** |

Subir `maxClients` sin ampliar el mazo hace que `drawRound` lance y la sala se quede sin arrancar. **Task B1 es requisito de Task B3**, no una mejora paralela.

## Global Constraints

Heredadas del plan anterior y siguen vigentes:

- **Colyseus en la línea 0.16**, ninguna versión sube. `colyseus.js@0.16.22`. Las líneas 0.17 y 0.18 no tienen cliente JS publicado.
- **`defineTypes()`, nunca `@type()`.** `useDefineForClassFields: false` en el servidor.
- **El cliente nunca importa clases `Schema`.**
- **`packages/shared` no importa Colyseus, React ni Node.** Sin `Date.now()` ni `Math.random()` dentro.
- **Ningún identificador estable de carta llega al navegador antes del reveal.** El `publicId` es aleatorio por partida. La foto solo se sirve para cartas ya reveladas.
- **Nunca texto blanco sobre `--green`** (2.28:1). `--mute` solo sobre `--ink`.
- TypeScript en `6.0.3`. Commits terminan con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task B1: Ampliar el mazo a 7 cartas por puesto

**Por qué:** con 7 cartas por puesto y 4 jugadores, cada ronda reparte 5 y **sobran 2**. Eso devuelve margen real al voto de salto — hoy, con 5 justas, el margen se agota casi de inmediato y el boton de saltar desaparece. Ademas da variedad entre partidas.

- `data/players.json`: de 55 a **77 cartas** — 7 por cada uno de los 11 puestos, 22 nuevas.
- Mantener la proporción de pares pico/declive: son el corazón del juego. Al menos 14 de las 77 deben ser segundas temporadas de un futbolista ya presente.
- Cada `silhouetteId` nuevo necesita fuente en `data/sources.json` con licencia libre de Wikimedia, y pasar por `pnpm silhouettes:build` para generar silueta **y** foto.
- `pnpm dataset:check` debe seguir saliendo con código 0.
- Actualizar `MIN_CARDS_PER_SLOT` si procede.

**Riesgo conocido:** Wikimedia limita el ritmo de descarga. El pipeline ya tiene pausa de 1 s y reintentos con espera creciente; no los quites.

---

### Task B2: Salas con código

- Código de sala de 4-6 caracteres, legible en voz alta: sin `0`/`O`, sin `1`/`I`/`L`.
- `POST`/mensaje para crear sala; unirse por código.
- El anfitrión es quien crea; si se va antes de empezar, migra al siguiente conectado.
- La sala se bloquea al arrancar la partida (ya existe `lock()`).
- **El código de sala no es secreto** y puede ir en la URL para compartir. No confundir con el `publicId` de las cartas, que sí lo es.
- Rechazar unirse a sala inexistente, llena, o ya en juego, con mensaje distinguible para cada caso — aquí sí conviene distinguirlos, al contrario que en la ruta de imágenes.

---

### Task B3: De 4 a 2-6 jugadores — CANCELADA

**Cancelada por decisión del usuario el 2026-09-08: la beta se queda en 4 jugadores.** El mazo ampliado de B1 se mantiene igualmente, y con 7 cartas por puesto para 4 jugadores el reparto es 5 con 2 sobrantes — lo que devuelve margen real al voto de salto, que hoy se agota casi siempre.

Lo que decía la tarea, por si se retoma:

- `maxClients` pasa a 6. Mínimo para arrancar: 2.
- **Verificar que la puntuación aguanta:** `scoreMatch` reparte un punto por puesto entre empatados; con 6 jugadores hay más empates posibles. Comprobar que la suma total sigue siendo 11.
- **Revisar el presupuesto:** con más jugadores compitiendo por las mismas cartas, el reservado (`posiciones_restantes × basePrice`) puede quedarse corto o largo. Medir jugando, no suponer.
- La invariante de plantilla completa debe seguir pasando con 2, 4 y 6 jugadores. Es el test más importante del proyecto.

---

### Task B4: Landing

Sigue `design-system/pages/landing.md`, que manda sobre este apartado.

- Ruta `/` con la portada; el juego pasa a `/sala/:codigo`.
- El hero usa assets reales del juego, alternando silueta y foto.
- Cuatro bloques: hero, cómo se juega, el gancho con el ejemplo de las dos temporadas, y entrar.

---

### Task B5: Asperezas de la partida

Cosas que se notan jugando y hoy no están:

- **Sala de espera con estado claro:** quién está listo, cuántos faltan, y el código a la vista para copiar.
- **Resumen entre rondas:** al cambiar de puesto, un momento que diga qué puesto viene y cómo va la clasificación.
- **Historial de la partida:** poder ver qué cartas salieron y a cuánto se fueron. El servidor ya guarda `revealedCards`.
- **Reconexión visible:** ya existe `rejoinPending` en el estado; falta que la pantalla lo explique bien.
- **Sonido del reveal**, opcional y desactivable. Es el momento del producto y ahora es mudo.

---

### Task B6: E2E y despliegue permanente

- El E2E de partida completa (Task 15 del plan anterior, nunca ejecutada) adaptado a salas.
- Despliegue en Fly.io con URL estable, en sustitución del túnel temporal.

---

## Orden y dependencias

```
B1 (mazo)  ──►  (B3 cancelada)
B2 (salas) ──►  B4 (landing)
                B5 (asperezas)  ──►  B6 (E2E + deploy)
```

B1 y B2 son independientes entre sí y pueden ir en paralelo si hiciera falta. B6 va al final porque prueba todo lo anterior.

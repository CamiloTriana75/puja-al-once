# Subasta Futbolera — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juego de navegador para 4 jugadores en sala privada que pujan por futbolistas ocultos tras siluetas y arman un 11 inicial; gana quien tenga el mejor rating en más posiciones.

**Architecture:** Monorepo pnpm de tres paquetes. Toda la lógica del juego vive en `shared/` como funciones puras sin dependencias de red ni de reloj — el tiempo entra siempre como parámetro. `server/` es una sala de Colyseus que posee el estado puro como fuente de verdad y lo *proyecta* sobre un `Schema` que solo contiene campos públicos. `client/` es React y solo dibuja el estado que le llega.

**Tech Stack:** TypeScript 6, Node 26, pnpm workspaces, Colyseus 0.16 + `@colyseus/schema` 3, colyseus.js 0.16, React 19 + Vite 8 + Tailwind 4, Vitest 4, Playwright, zod 4.

**Spec:** [`docs/superpowers/specs/2026-09-02-subasta-futbolera-design.md`](../specs/2026-09-02-subasta-futbolera-design.md)

## Global Constraints

Aplican a todas las tareas. Los valores son exactos, no orientativos.

- **La línea de Colyseus es la 0.16 y no se sube.** `@colyseus/core@0.16.25` tiene como peer `@colyseus/schema@^3.0.0`, y `colyseus.js@0.16.22` — el cliente de navegador más nuevo publicado — depende de `@colyseus/schema@^3.0.43`. Las líneas 0.17 (schema 4) y 0.18 (schema 5) del servidor **no tienen cliente JS publicado**: instalar `colyseus@0.18` deja un cliente que no puede decodificar el estado. Versiones exactas: `colyseus@0.16.5`, `@colyseus/core@0.16.25`, `@colyseus/schema@3.0.76`, `@colyseus/testing@0.16.3`, `colyseus.js@0.16.22`.
- **TypeScript se fija en `6.0.3`.** `@colyseus/schema@3` es de la era de los decoradores legados; TypeScript 7 sustituye el compilador por el nativo y no es terreno probado para esa combinación. `schema-codegen`, además, necesita la API JS del compilador, que TS 7 ya no expone.
- **Las clases `Schema` se declaran con `defineTypes()`, nunca con `@type()`.** El decorador no sobrevive a esbuild, que es lo que usan Vitest y Vite. `defineTypes(Klass, { campo: "tipo" })` produce exactamente la misma definición y el mismo formato binario.
- **`useDefineForClassFields: false` en `packages/server`.** `defineTypes` instala accesores en el prototipo para rastrear cambios; con la semántica moderna de campos de clase cada instancia los taparía con campos propios y la sincronización dejaría de detectar cambios sin dar ningún error.
- **El cliente nunca importa clases `Schema`.** Lee `room.state` por reflexión y se tipa contra interfaces planas escritas a mano. Así el paquete `client` no arrastra ninguna de las restricciones anteriores.
- **`packages/shared` no importa nada de Colyseus, React, ni Node.** Sin `Date.now()` dentro: el tiempo entra como parámetro `now: number`. Sin `Math.random()` dentro: el azar entra como parámetro `rng: Rng`.
- **El dinero son enteros en millones.** `100` significa 100 M. Nada de decimales, nada de céntimos.
- **Toda pantalla obedece a [`design-system/MASTER.md`](../../../design-system/MASTER.md).** Es la fuente de verdad visual: paleta, tipografía, formas, movimiento y anti-patrones. Cualquier tarea que escriba UI lo lee antes de escribir una línea. La regla que más se rompe: **nunca texto blanco sobre `--green`** — da 2.28:1 y falla WCAG; el texto blanco va sobre `--ink` o `--deep`.
- **Ningún campo privado de una carta (`name`, `season`, `club`, `league`, `nation`, `rating`) se escribe en el `Schema` antes de la fase `REVEAL`.** Es la regla de seguridad del juego: el `Schema` se sincroniza entero al navegador y se lee en DevTools aunque no se pinte.
- **Todos los commits terminan con:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Estructura de ficheros

```
fut/
├─ package.json                      workspace root, scripts agregados
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ shared/
│  │  ├─ src/types.ts                Slot, Rules, AuctionState, Result
│  │  ├─ src/budget.ts               reservedBudget, maxBid
│  │  ├─ src/bidding.ts              canBid, applyBid
│  │  ├─ src/skip.ts                 skipAllowed, resolveSkipVote
│  │  ├─ src/auction.ts              resolveAuction
│  │  ├─ src/scoring.ts              scoreMatch
│  │  ├─ src/dataset.ts              zod, derivados, loadDataset
│  │  └─ src/index.ts                superficie pública del paquete
│  ├─ server/
│  │  ├─ src/schema.ts               clases Schema (único sitio con decoradores)
│  │  ├─ src/project.ts              estado puro → Schema
│  │  ├─ src/AuctionRoom.ts          sala: mensajes, reloj, transiciones
│  │  ├─ src/setup.ts                reparto de cartas por ronda
│  │  └─ src/index.ts                arranque del servidor
│  └─ client/
│     ├─ src/index.css                  tokens del sistema de diseño
│     ├─ src/net/endpoints.ts           URLs: local contra producción
│     ├─ src/net/useRoom.ts             conexión y estado
│     ├─ src/net/useServerClock.ts      corrección de desfase de reloj
│     ├─ src/components/AuctionCard.tsx tarjeta de marca: oculta y revelada
│     ├─ src/components/ClueRow.tsx     las pistas
│     ├─ src/components/BidControls.tsx campo, botones y error de puja
│     ├─ src/components/RevealBar.tsx   veredicto tras el reveal
│     ├─ src/components/SquadGrid.tsx   plantilla de un jugador
│     ├─ src/screens/Lobby.tsx
│     ├─ src/screens/Auction.tsx
│     ├─ src/screens/Results.tsx
│     └─ src/App.tsx
├─ design-system/
│  ├─ MASTER.md                       fuente de verdad visual
│  └─ pages/                          desviaciones por pantalla, si hicieran falta
├─ data/
│  ├─ players.json
│  ├─ attributions.json
│  └─ silhouettes/
├─ tools/
│  └─ build-silhouettes.ts
└─ e2e/
   └─ full-match.spec.ts
```

---

### Task 1: Monorepo y reglas de presupuesto

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/types.ts`, `packages/shared/src/budget.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/test/budget.test.ts`

**Interfaces:**
- Consumes: nada, es la primera tarea
- Produces: `Slot`, `SLOTS`, `Foot`, `Continent`, `AgeBand`, `Rules`, `DEFAULT_RULES`, `PlayerState`, `Phase`, `AuctionState`, `Result<T,E>`, `ok()`, `err()`, `Rng`, `filledSlotCount(player)`, `reservedBudget(player, rules)`, `maxBid(player, rules)`

- [ ] **Step 1: Inicializar repo y workspace**

```bash
git init
node -e "require('fs').writeFileSync('.gitignore','node_modules/\ndist/\n.env\ntest-results/\nplaywright-report/\n')"
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

`package.json` (raíz):

```json
{
  "name": "fut",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "6.0.3"
  }
}
```

- [ ] **Step 2: Crear el paquete `shared`**

`packages/shared/package.json`:

```json
{
  "name": "@fut/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "4.5.4"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "4.1.11"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

`packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

Instalar:

```bash
pnpm install
```

- [ ] **Step 3: Escribir el test que falla**

`packages/shared/test/budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, maxBid, reservedBudget, type PlayerState } from "../src/index.js";

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    playerId: "p1",
    name: "Ana",
    budget: DEFAULT_RULES.startingBudget,
    squad: {},
    connected: true,
    ...overrides,
  };
}

describe("reservedBudget", () => {
  it("reserva el precio base de los huecos que quedarian tras ganar el actual", () => {
    // 11 huecos vacios: si gana el actual quedan 10 por llenar a 2 M cada uno
    expect(reservedBudget(player(), DEFAULT_RULES)).toBe(20);
  });

  it("no reserva nada cuando el hueco en juego es el ultimo", () => {
    const squad = {
      GK: "c1", LB: "c2", CB1: "c3", CB2: "c4", RB: "c5",
      CDM: "c6", CM: "c7", CAM: "c8", LW: "c9", ST: "c10",
    };
    expect(reservedBudget(player({ squad }), DEFAULT_RULES)).toBe(0);
  });
});

describe("maxBid", () => {
  it("permite gastar todo menos lo reservado", () => {
    expect(maxBid(player({ budget: 100 }), DEFAULT_RULES)).toBe(80);
  });

  it("permite gastar el saldo entero en el ultimo hueco", () => {
    const squad = {
      GK: "c1", LB: "c2", CB1: "c3", CB2: "c4", RB: "c5",
      CDM: "c6", CM: "c7", CAM: "c8", LW: "c9", ST: "c10",
    };
    expect(maxBid(player({ budget: 37, squad }), DEFAULT_RULES)).toBe(37);
  });

  it("nunca devuelve negativo", () => {
    expect(maxBid(player({ budget: 3 }), DEFAULT_RULES)).toBe(0);
  });
});
```

- [ ] **Step 4: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test`
Expected: FAIL — `Failed to resolve import "../src/index.js"`

- [ ] **Step 5: Escribir los tipos**

`packages/shared/src/types.ts`:

```ts
export const SLOTS = [
  "GK", "LB", "CB1", "CB2", "RB",
  "CDM", "CM", "CAM", "LW", "ST", "RW",
] as const;

export type Slot = (typeof SLOTS)[number];

export type Foot = "L" | "R" | "B";
export type Continent = "EU" | "SA" | "NA" | "AF" | "AS" | "OC";
export type AgeBand = "<21" | "21-25" | "26-30" | "31-34" | "35+";

export type Phase = "LOBBY" | "SETUP" | "BIDDING" | "SKIP_VOTE" | "REVEAL" | "RESULTS";

/** Fuente de azar inyectable. Devuelve [0, 1). */
export type Rng = () => number;

export interface Rules {
  /** Presupuesto inicial de cada jugador, en millones. */
  startingBudget: number;
  /** Precio de salida de cualquier candidato, en millones. */
  basePrice: number;
  /** Subida minima sobre la puja vigente, en millones. */
  minIncrement: number;
  /** Duracion de la subasta antes de la primera puja. */
  bidTimerMs: number;
  /** A cuanto se empuja el cierre tras cada puja aceptada. */
  antiSnipeMs: number;
  /** Duracion de la votacion de salto. */
  skipVoteMs: number;
  /** Cuanto se muestra la carta revelada. */
  revealMs: number;
  /** Margen de reconexion tras una desconexion. */
  reconnectSeconds: number;
}

export const DEFAULT_RULES: Rules = {
  startingBudget: 100,
  basePrice: 2,
  minIncrement: 1,
  bidTimerMs: 15_000,
  antiSnipeMs: 6_000,
  skipVoteMs: 10_000,
  revealMs: 6_000,
  reconnectSeconds: 60,
};

export interface PlayerState {
  playerId: string;
  name: string;
  /** Saldo restante en millones. */
  budget: number;
  /** Hueco de la formacion -> cardId fichado. */
  squad: Partial<Record<Slot, string>>;
  connected: boolean;
}

export interface AuctionState {
  phase: Phase;
  /** Indice dentro de SLOTS: la ronda en curso. */
  slotIndex: number;
  /**
   * Cartas de la ronda que aun no se han resuelto.
   * La posicion 0 es la que esta sobre la mesa ahora mismo.
   */
  remainingCards: string[];
  /** Puja vigente en millones. 0 significa que nadie ha pujado. */
  currentBid: number;
  currentBidderId: string | null;
  /** Cierre de la subasta como marca de tiempo absoluta en ms. */
  endsAt: number;
  /** playerId -> voto emitido en la votacion de salto. */
  skipVotes: Record<string, boolean>;
  /**
   * Tras una votacion de salto fallida, la lista de quienes pueden pujar.
   * `null` significa que la subasta esta abierta a todos.
   */
  restrictedBidders: string[] | null;
  players: PlayerState[];
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** El hueco de la formacion que se esta subastando ahora. */
export function currentSlot(state: AuctionState): Slot {
  const slot = SLOTS[state.slotIndex];
  if (!slot) throw new RangeError(`slotIndex fuera de rango: ${state.slotIndex}`);
  return slot;
}

/** La carta sobre la mesa, o null si la ronda no tiene ninguna. */
export function currentCardId(state: AuctionState): string | null {
  return state.remainingCards[0] ?? null;
}
```

- [ ] **Step 6: Escribir las reglas de presupuesto**

`packages/shared/src/budget.ts`:

```ts
import { SLOTS, type PlayerState, type Rules } from "./types.js";

export function filledSlotCount(player: PlayerState): number {
  return SLOTS.filter((slot) => player.squad[slot] !== undefined).length;
}

/**
 * Lo que el jugador debe conservar DESPUES de ganar la subasta actual, para
 * poder pagar el precio base de los huecos que le seguirian faltando.
 * El hueco en juego no cuenta: ganarlo es precisamente lo que lo llena.
 */
export function reservedBudget(player: PlayerState, rules: Rules): number {
  const missingAfterWin = SLOTS.length - filledSlotCount(player) - 1;
  return Math.max(0, missingAfterWin) * rules.basePrice;
}

/** El importe mas alto que este jugador puede pujar sin inhabilitarse. */
export function maxBid(player: PlayerState, rules: Rules): number {
  return Math.max(0, player.budget - reservedBudget(player, rules));
}
```

`packages/shared/src/index.ts`:

```ts
export * from "./types.js";
export * from "./budget.js";
```

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 5 tests

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: monorepo y reglas de presupuesto bloqueado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Validación y aplicación de pujas

**Files:**
- Create: `packages/shared/src/bidding.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/bidding.test.ts`

**Interfaces:**
- Consumes: `AuctionState`, `Rules`, `PlayerState`, `Result`, `ok`, `err`, `currentSlot`, `maxBid` (Task 1)
- Produces: `BidError` (union de strings), `minimumBid(state, rules): number`, `canBid(state, rules, playerId, amount, now): Result<void, BidError>`, `applyBid(state, rules, playerId, amount, now): AuctionState`

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/bidding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyBid, canBid, DEFAULT_RULES, minimumBid,
  type AuctionState, type PlayerState,
} from "../src/index.js";

const NOW = 1_000_000;

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 100, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    endsAt: NOW + 15_000,
    skipVotes: {},
    restrictedBidders: null,
    players: [player("p1"), player("p2")],
    ...overrides,
  };
}

describe("minimumBid", () => {
  it("es el precio base cuando nadie ha pujado", () => {
    expect(minimumBid(state(), DEFAULT_RULES)).toBe(2);
  });

  it("es la puja vigente mas el incremento minimo", () => {
    expect(minimumBid(state({ currentBid: 7 }), DEFAULT_RULES)).toBe(8);
  });
});

describe("canBid", () => {
  it("acepta una puja valida", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 2, NOW)).toEqual({ ok: true, value: undefined });
  });

  it("rechaza si la fase no es BIDDING", () => {
    const r = canBid(state({ phase: "REVEAL" }), DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("rechaza la puja que llega despues del cierre", () => {
    const r = canBid(state(), DEFAULT_RULES, "p1", 2, NOW + 15_001);
    expect(r).toEqual({ ok: false, error: "AUCTION_CLOSED" });
  });

  it("acepta la puja que llega justo en el instante del cierre", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 2, NOW + 15_000).ok).toBe(true);
  });

  it("rechaza a un jugador desconocido", () => {
    const r = canBid(state(), DEFAULT_RULES, "fantasma", 2, NOW);
    expect(r).toEqual({ ok: false, error: "UNKNOWN_PLAYER" });
  });

  it("rechaza a un jugador desconectado", () => {
    const s = state({ players: [player("p1", { connected: false }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "DISCONNECTED" });
  });

  it("rechaza si el jugador ya ficho para ese hueco", () => {
    const s = state({ players: [player("p1", { squad: { GK: "cx" } }), player("p2")] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "SLOT_ALREADY_FILLED" });
  });

  it("rechaza una puja por debajo del minimo", () => {
    const r = canBid(state({ currentBid: 7 }), DEFAULT_RULES, "p1", 7, NOW);
    expect(r).toEqual({ ok: false, error: "BID_TOO_LOW" });
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", () => {
    // 11 huecos vacios, saldo 100, reservado 20 -> tope 80
    const r = canBid(state(), DEFAULT_RULES, "p1", 81, NOW);
    expect(r).toEqual({ ok: false, error: "OVER_BUDGET" });
  });

  it("acepta justo en el tope del presupuesto", () => {
    expect(canBid(state(), DEFAULT_RULES, "p1", 80, NOW).ok).toBe(true);
  });

  it("rechaza a quien no esta en la lista tras un voto de salto fallido", () => {
    const s = state({ restrictedBidders: ["p2"] });
    const r = canBid(s, DEFAULT_RULES, "p1", 2, NOW);
    expect(r).toEqual({ ok: false, error: "NOT_ALLOWED_TO_BID" });
  });

  it("acepta a quien si esta en la lista restringida", () => {
    const s = state({ restrictedBidders: ["p1"] });
    expect(canBid(s, DEFAULT_RULES, "p1", 2, NOW).ok).toBe(true);
  });
});

describe("applyBid", () => {
  it("registra la puja y empuja el cierre (anti-snipe)", () => {
    const s = applyBid(state(), DEFAULT_RULES, "p1", 5, NOW + 14_900);
    expect(s.currentBid).toBe(5);
    expect(s.currentBidderId).toBe("p1");
    expect(s.endsAt).toBe(NOW + 14_900 + DEFAULT_RULES.antiSnipeMs);
  });

  it("no muta el estado recibido", () => {
    const original = state();
    applyBid(original, DEFAULT_RULES, "p1", 5, NOW);
    expect(original.currentBid).toBe(0);
    expect(original.currentBidderId).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test bidding`
Expected: FAIL — `minimumBid` no exportado

- [ ] **Step 3: Implementar**

`packages/shared/src/bidding.ts`:

```ts
import { maxBid } from "./budget.js";
import {
  currentSlot, err, ok,
  type AuctionState, type Result, type Rules,
} from "./types.js";

export type BidError =
  | "WRONG_PHASE"
  | "AUCTION_CLOSED"
  | "UNKNOWN_PLAYER"
  | "DISCONNECTED"
  | "SLOT_ALREADY_FILLED"
  | "NOT_ALLOWED_TO_BID"
  | "BID_TOO_LOW"
  | "OVER_BUDGET";

/** El importe mas bajo que ahora mismo constituye una puja valida. */
export function minimumBid(state: AuctionState, rules: Rules): number {
  return state.currentBid === 0 ? rules.basePrice : state.currentBid + rules.minIncrement;
}

/**
 * Unica autoridad sobre si una puja vale. `now` es la hora del servidor en el
 * momento de recibir el mensaje, no la del cliente.
 */
export function canBid(
  state: AuctionState,
  rules: Rules,
  playerId: string,
  amount: number,
  now: number,
): Result<void, BidError> {
  if (state.phase !== "BIDDING") return err("WRONG_PHASE");
  if (now > state.endsAt) return err("AUCTION_CLOSED");

  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return err("UNKNOWN_PLAYER");
  if (!player.connected) return err("DISCONNECTED");
  if (player.squad[currentSlot(state)] !== undefined) return err("SLOT_ALREADY_FILLED");

  if (state.restrictedBidders !== null && !state.restrictedBidders.includes(playerId)) {
    return err("NOT_ALLOWED_TO_BID");
  }

  if (!Number.isInteger(amount) || amount < minimumBid(state, rules)) return err("BID_TOO_LOW");
  if (amount > maxBid(player, rules)) return err("OVER_BUDGET");

  return ok(undefined);
}

/**
 * Registra una puja ya validada y empuja el cierre. Devuelve un estado nuevo:
 * no muta el recibido.
 */
export function applyBid(
  state: AuctionState,
  rules: Rules,
  playerId: string,
  amount: number,
  now: number,
): AuctionState {
  return {
    ...state,
    currentBid: amount,
    currentBidderId: playerId,
    endsAt: now + rules.antiSnipeMs,
  };
}
```

Añadir a `packages/shared/src/index.ts`:

```ts
export * from "./bidding.js";
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 20 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: validacion de pujas con anti-snipe y tope de presupuesto" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Votación de salto

**Files:**
- Create: `packages/shared/src/skip.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/skip.test.ts`

**Interfaces:**
- Consumes: `AuctionState`, `currentSlot`, `PlayerState` (Task 1)
- Produces: `playersNeedingSlot(state): PlayerState[]`, `skipAllowed(state): boolean`, `SkipOutcome = { kind: "SKIPPED" } | { kind: "RESUMED"; restrictedBidders: string[] }`, `resolveSkipVote(state): SkipOutcome`

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/skip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  playersNeedingSlot, resolveSkipVote, skipAllowed,
  type AuctionState, type PlayerState,
} from "../src/index.js";

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 100, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    players: [player("p1"), player("p2"), player("p3"), player("p4")],
    ...overrides,
  };
}

describe("playersNeedingSlot", () => {
  it("excluye a quien ya ficho y a los desconectados", () => {
    const s = state({
      players: [
        player("p1"),
        player("p2", { squad: { GK: "cx" } }),
        player("p3", { connected: false }),
        player("p4"),
      ],
    });
    expect(playersNeedingSlot(s).map((p) => p.playerId)).toEqual(["p1", "p4"]);
  });
});

describe("skipAllowed", () => {
  it("permite saltar mientras sobran cartas", () => {
    // 5 cartas, 4 jugadores necesitan el hueco
    expect(skipAllowed(state())).toBe(true);
  });

  it("prohibe saltar cuando quedan tantas cartas como jugadores por fichar", () => {
    expect(skipAllowed(state({ remainingCards: ["c1", "c2", "c3", "c4"] }))).toBe(false);
  });

  it("recupera el margen cuando alguien ya ficho el hueco", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });

  it("no cuenta a los desconectados para el margen", () => {
    const s = state({
      remainingCards: ["c1", "c2", "c3", "c4"],
      players: [player("p1", { connected: false }), player("p2"), player("p3"), player("p4")],
    });
    expect(skipAllowed(s)).toBe(true);
  });
});

describe("resolveSkipVote", () => {
  it("salta si todos los que necesitan el hueco votan saltar", () => {
    const s = state({ skipVotes: { p1: true, p2: true, p3: true, p4: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("ignora el voto de quien ya ficho el hueco", () => {
    const s = state({
      players: [player("p1", { squad: { GK: "cx" } }), player("p2"), player("p3"), player("p4")],
      skipVotes: { p2: true, p3: true, p4: true },
    });
    expect(resolveSkipVote(s)).toEqual({ kind: "SKIPPED" });
  });

  it("reanuda restringido a quien voto en contra", () => {
    const s = state({ skipVotes: { p1: true, p2: false, p3: true, p4: false } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: ["p2", "p4"] });
  });

  it("trata la abstencion como que no bloquea el salto pero tampoco habilita a pujar", () => {
    const s = state({ skipVotes: { p1: true, p2: true } });
    expect(resolveSkipVote(s)).toEqual({ kind: "RESUMED", restrictedBidders: [] });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test skip`
Expected: FAIL — `skipAllowed` no exportado

- [ ] **Step 3: Implementar**

`packages/shared/src/skip.ts`:

```ts
import { currentSlot, type AuctionState, type PlayerState } from "./types.js";

/** Jugadores conectados a los que aun les falta el hueco en juego. */
export function playersNeedingSlot(state: AuctionState): PlayerState[] {
  const slot = currentSlot(state);
  return state.players.filter((p) => p.connected && p.squad[slot] === undefined);
}

/**
 * Solo se puede saltar mientras sobren cartas. Cuando quedan tantas como
 * jugadores por fichar, cada carta tiene que acabar en un equipo: saltar
 * dejaria a alguien con el hueco vacio, asi que se prohibe.
 */
export function skipAllowed(state: AuctionState): boolean {
  return state.remainingCards.length > playersNeedingSlot(state).length;
}

export type SkipOutcome =
  | { kind: "SKIPPED" }
  | { kind: "RESUMED"; restrictedBidders: string[] };

/**
 * El salto exige unanimidad de los que necesitan el hueco. Si falla, la subasta
 * se reanuda pero solo pueden pujar quienes votaron explicitamente en contra:
 * votaste que la querias, pujala. Abstenerse no bloquea el salto ni habilita a
 * pujar, asi que una sala entera ausente termina en descarte y la ronda avanza.
 */
export function resolveSkipVote(state: AuctionState): SkipOutcome {
  const eligible = playersNeedingSlot(state).map((p) => p.playerId);
  const unanimous = eligible.length > 0 && eligible.every((id) => state.skipVotes[id] === true);
  if (unanimous) return { kind: "SKIPPED" };
  return {
    kind: "RESUMED",
    restrictedBidders: eligible.filter((id) => state.skipVotes[id] === false),
  };
}
```

Añadir a `packages/shared/src/index.ts`:

```ts
export * from "./skip.js";
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 29 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: votacion de salto con margen obligatorio" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Resolución de la subasta

**Files:**
- Create: `packages/shared/src/auction.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/auction.test.ts`

**Interfaces:**
- Consumes: `AuctionState`, `Rules`, `Rng`, `currentCardId`, `currentSlot` (Task 1), `skipAllowed`, `playersNeedingSlot` (Task 3)
- Produces: `AuctionOutcome`, `resolveAuction(state, rules, rng): AuctionOutcome`, `applyOutcome(state, outcome): AuctionState`

`AuctionOutcome`:

```ts
type AuctionOutcome =
  | { kind: "AWARDED"; cardId: string; playerId: string; price: number }
  | { kind: "FORCED"; cardId: string; playerId: string; price: number }
  | { kind: "DISCARDED"; cardId: string }
  | { kind: "OPEN_SKIP_VOTE"; cardId: string };
```

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/auction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyOutcome, DEFAULT_RULES, resolveAuction,
  type AuctionState, type PlayerState,
} from "../src/index.js";

const rngFirst = () => 0;      // elige siempre el primer candidato del sorteo
const rngLast = () => 0.999;   // elige siempre el ultimo

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 100, squad: {}, connected: true, ...overrides };
}

function state(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    phase: "BIDDING",
    slotIndex: 0,
    remainingCards: ["c1", "c2", "c3", "c4", "c5"],
    currentBid: 0,
    currentBidderId: null,
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    players: [player("p1"), player("p2"), player("p3"), player("p4")],
    ...overrides,
  };
}

describe("resolveAuction", () => {
  it("adjudica al mejor postor", () => {
    const s = state({ currentBid: 12, currentBidderId: "p3" });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "AWARDED", cardId: "c1", playerId: "p3", price: 12,
    });
  });

  it("abre la votacion de salto si nadie pujo y hay margen", () => {
    expect(resolveAuction(state(), DEFAULT_RULES, rngFirst)).toEqual({
      kind: "OPEN_SKIP_VOTE", cardId: "c1",
    });
  });

  it("descarta si nadie pujo tras un voto de salto fallido", () => {
    const s = state({ restrictedBidders: ["p2"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "DISCARDED", cardId: "c1",
    });
  });

  it("adjudica por sorteo si nadie pujo y no hay margen", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toEqual({
      kind: "FORCED", cardId: "c1", playerId: "p1", price: DEFAULT_RULES.basePrice,
    });
  });

  it("el sorteo recorre a todos los elegibles segun el rng", () => {
    const s = state({ remainingCards: ["c1", "c2", "c3", "c4"] });
    expect(resolveAuction(s, DEFAULT_RULES, rngLast)).toMatchObject({
      kind: "FORCED", playerId: "p4",
    });
  });

  it("el sorteo solo considera a quien necesita el hueco y esta conectado", () => {
    const s = state({
      remainingCards: ["c1", "c2"],
      players: [
        player("p1", { squad: { GK: "cx" } }),
        player("p2", { connected: false }),
        player("p3"),
        player("p4"),
      ],
    });
    expect(resolveAuction(s, DEFAULT_RULES, rngFirst)).toMatchObject({
      kind: "FORCED", playerId: "p3",
    });
  });
});

describe("applyOutcome", () => {
  it("cobra al ganador, le asigna el hueco y saca la carta de la ronda", () => {
    const s = state({ currentBid: 12, currentBidderId: "p3" });
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    const p3 = next.players.find((p) => p.playerId === "p3");
    expect(p3?.budget).toBe(88);
    expect(p3?.squad.GK).toBe("c1");
    expect(next.remainingCards).toEqual(["c2", "c3", "c4", "c5"]);
    expect(next.currentBid).toBe(0);
    expect(next.currentBidderId).toBeNull();
    expect(next.restrictedBidders).toBeNull();
    expect(next.skipVotes).toEqual({});
  });

  it("el descarte saca la carta sin cobrar a nadie", () => {
    const s = state({ restrictedBidders: ["p2"] });
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    expect(next.remainingCards).toEqual(["c2", "c3", "c4", "c5"]);
    expect(next.players.every((p) => p.budget === 100)).toBe(true);
  });

  it("abrir la votacion de salto no toca las cartas", () => {
    const s = state();
    const next = applyOutcome(s, resolveAuction(s, DEFAULT_RULES, rngFirst));
    expect(next.remainingCards).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(next.phase).toBe("SKIP_VOTE");
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test auction`
Expected: FAIL — `resolveAuction` no exportado

- [ ] **Step 3: Implementar**

`packages/shared/src/auction.ts`:

```ts
import { playersNeedingSlot, skipAllowed } from "./skip.js";
import {
  currentCardId, currentSlot,
  type AuctionState, type Rng, type Rules,
} from "./types.js";

export type AuctionOutcome =
  | { kind: "AWARDED"; cardId: string; playerId: string; price: number }
  | { kind: "FORCED"; cardId: string; playerId: string; price: number }
  | { kind: "DISCARDED"; cardId: string }
  | { kind: "OPEN_SKIP_VOTE"; cardId: string };

/**
 * Decide como termina la subasta de la carta que esta sobre la mesa. El orden
 * de las ramas importa: el descarte tras un voto fallido tiene que evaluarse
 * antes que el sorteo, porque el voto de salto solo puede haber ocurrido si
 * habia margen y en ese caso descartar es seguro.
 */
export function resolveAuction(state: AuctionState, rules: Rules, rng: Rng): AuctionOutcome {
  const cardId = currentCardId(state);
  if (cardId === null) throw new Error("resolveAuction sin carta sobre la mesa");

  if (state.currentBidderId !== null) {
    return { kind: "AWARDED", cardId, playerId: state.currentBidderId, price: state.currentBid };
  }

  if (state.restrictedBidders !== null) return { kind: "DISCARDED", cardId };

  if (skipAllowed(state)) return { kind: "OPEN_SKIP_VOTE", cardId };

  const eligible = playersNeedingSlot(state);
  if (eligible.length === 0) return { kind: "DISCARDED", cardId };

  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  const winner = eligible[index]!;
  return { kind: "FORCED", cardId, playerId: winner.playerId, price: rules.basePrice };
}

/** Aplica el desenlace y devuelve un estado nuevo. No muta el recibido. */
export function applyOutcome(state: AuctionState, outcome: AuctionOutcome): AuctionState {
  if (outcome.kind === "OPEN_SKIP_VOTE") {
    return { ...state, phase: "SKIP_VOTE", skipVotes: {} };
  }

  const slot = currentSlot(state);
  const players =
    outcome.kind === "DISCARDED"
      ? state.players
      : state.players.map((p) =>
          p.playerId === outcome.playerId
            ? { ...p, budget: p.budget - outcome.price, squad: { ...p.squad, [slot]: outcome.cardId } }
            : p,
        );

  return {
    ...state,
    players,
    remainingCards: state.remainingCards.slice(1),
    currentBid: 0,
    currentBidderId: null,
    restrictedBidders: null,
    skipVotes: {},
    phase: "REVEAL",
  };
}
```

Añadir a `packages/shared/src/index.ts`:

```ts
export * from "./auction.js";
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 38 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: resolucion de subasta con sorteo forzado sin margen" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Puntuación y desempates

**Files:**
- Create: `packages/shared/src/scoring.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/scoring.test.ts`

**Interfaces:**
- Consumes: `PlayerState`, `SLOTS` (Task 1)
- Produces: `Standing { playerId, points, totalRating, budgetLeft, rank }`, `scoreMatch(players, ratingOf): Standing[]`

`ratingOf` es `(cardId: string) => number`. Se inyecta porque los ratings son datos privados que viven en el servidor: `shared/` no debe conocer el dataset.

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreMatch, SLOTS, type PlayerState } from "../src/index.js";

/** Reparte un equipo entero con el mismo rating salvo las excepciones dadas. */
function squadOf(prefix: string): PlayerState["squad"] {
  return Object.fromEntries(SLOTS.map((s) => [s, `${prefix}-${s}`]));
}

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, name: id, budget: 0, squad: squadOf(id), connected: true, ...overrides };
}

/** rating por defecto 70; `over` sube cartas concretas. */
function ratings(over: Record<string, number> = {}) {
  return (cardId: string) => over[cardId] ?? 70;
}

describe("scoreMatch", () => {
  it("da un punto por cada hueco en el que se tiene el rating mas alto", () => {
    const players = [player("a"), player("b")];
    const table = scoreMatch(players, ratings({ "a-GK": 90, "a-LB": 90, "b-RW": 91 }));
    expect(table.find((s) => s.playerId === "a")?.points).toBe(2);
    expect(table.find((s) => s.playerId === "b")?.points).toBe(1);
  });

  it("reparte el punto entre los empatados en un hueco", () => {
    const players = [player("a"), player("b")];
    // todos los huecos empatan a 70 -> medio punto cada uno en los 11
    const table = scoreMatch(players, ratings());
    expect(table.find((s) => s.playerId === "a")?.points).toBe(5.5);
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5.5);
  });

  it("un hueco vacio nunca gana el punto", () => {
    const emptyGk = squadOf("b");
    delete emptyGk.GK;
    const players = [player("a"), player("b", { squad: emptyGk })];
    const table = scoreMatch(players, ratings());
    expect(table.find((s) => s.playerId === "a")?.points).toBe(1 + 5); // GK entero + medio en los otros 10
    expect(table.find((s) => s.playerId === "b")?.points).toBe(5);
  });

  it("desempata por suma total de ratings", () => {
    const players = [player("a"), player("b")];
    // a y b empatan a 5.5 puntos; a suma mas rating total
    const table = scoreMatch(players, ratings({ "a-GK": 99, "b-GK": 99, "a-LB": 71, "b-LB": 71 }));
    expect(table[0]?.playerId).toBe("a");
    expect(table[0]?.rank).toBe(1);
  });

  it("desempata por presupuesto sin gastar cuando el rating total tambien empata", () => {
    const players = [player("a", { budget: 3 }), player("b", { budget: 9 })];
    const table = scoreMatch(players, ratings());
    expect(table[0]?.playerId).toBe("b");
    expect(table[0]?.rank).toBe(1);
    expect(table[1]?.rank).toBe(2);
  });

  it("declara empate cuando ni puntos ni rating ni presupuesto separan", () => {
    const players = [player("a", { budget: 5 }), player("b", { budget: 5 })];
    const table = scoreMatch(players, ratings());
    expect(table[0]?.rank).toBe(1);
    expect(table[1]?.rank).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test scoring`
Expected: FAIL — `scoreMatch` no exportado

- [ ] **Step 3: Implementar**

`packages/shared/src/scoring.ts`:

```ts
import { SLOTS, type PlayerState } from "./types.js";

export interface Standing {
  playerId: string;
  /** Puede ser fraccionario: un hueco empatado reparte su punto. */
  points: number;
  totalRating: number;
  budgetLeft: number;
  /** 1 es el mejor. Dos jugadores comparten rango si empatan en todo. */
  rank: number;
}

/**
 * Compara hueco por hueco: un punto para el rating mas alto de cada posicion,
 * repartido si hay empate. Un hueco vacio nunca puntua.
 *
 * `ratingOf` se inyecta porque el rating es dato privado del servidor.
 */
export function scoreMatch(
  players: PlayerState[],
  ratingOf: (cardId: string) => number,
): Standing[] {
  const points = new Map(players.map((p) => [p.playerId, 0]));

  for (const slot of SLOTS) {
    const holders = players
      .map((p) => ({ playerId: p.playerId, cardId: p.squad[slot] }))
      .filter((h): h is { playerId: string; cardId: string } => h.cardId !== undefined)
      .map((h) => ({ playerId: h.playerId, rating: ratingOf(h.cardId) }));

    if (holders.length === 0) continue;

    const best = Math.max(...holders.map((h) => h.rating));
    const winners = holders.filter((h) => h.rating === best);
    const share = 1 / winners.length;
    for (const w of winners) points.set(w.playerId, (points.get(w.playerId) ?? 0) + share);
  }

  const rows = players.map((p) => ({
    playerId: p.playerId,
    points: points.get(p.playerId) ?? 0,
    totalRating: SLOTS.reduce((sum, slot) => {
      const cardId = p.squad[slot];
      return cardId === undefined ? sum : sum + ratingOf(cardId);
    }, 0),
    budgetLeft: p.budget,
    rank: 0,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.totalRating - a.totalRating ||
      b.budgetLeft - a.budgetLeft,
  );

  let rank = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied =
      prev !== undefined &&
      prev.points === row.points &&
      prev.totalRating === row.totalRating &&
      prev.budgetLeft === row.budgetLeft;
    if (!tied) rank = i + 1;
    row.rank = rank;
  });

  return rows;
}
```

Añadir a `packages/shared/src/index.ts`:

```ts
export * from "./scoring.js";
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 44 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: puntuacion por hueco y cadena de desempates" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Dataset de cartas

**Files:**
- Create: `packages/shared/src/dataset.ts`
- Create: `data/players.json`
- Modify: `packages/shared/src/index.ts`
- Modify: `package.json` (raíz): script `dataset:check`
- Create: `scripts/check-dataset.ts`
- Test: `packages/shared/test/dataset.test.ts`

**Interfaces:**
- Consumes: `Slot`, `SLOTS`, `Foot`, `Continent`, `AgeBand` (Task 1)
- Produces: `CardSourceSchema` (zod), `CardSource`, `CardPublic`, `CardPrivate`, `decadeOf(season)`, `ageBandOf(season, birthYear)`, `continentOf(nation)`, `toPublic(card)`, `toPrivate(card)`, `parseDataset(raw): CardSource[]`, `cardsBySlot(cards): Record<Slot, CardSource[]>`, `MIN_CARDS_PER_SLOT`

- [ ] **Step 1: Escribir el test que falla**

`packages/shared/test/dataset.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ageBandOf, cardsBySlot, continentOf, decadeOf, parseDataset,
  toPrivate, toPublic, type CardSource,
} from "../src/index.js";

const ronaldinho2006: CardSource = {
  cardId: "ronaldinho-2006",
  name: "Ronaldinho",
  season: 2006,
  birthYear: 1980,
  club: "FC Barcelona",
  league: "LaLiga",
  nation: "BRA",
  slot: "CAM",
  rating: 94,
  heightCm: 182,
  foot: "R",
  silhouetteId: "ronaldinho-01",
};

describe("derivados", () => {
  it("decadeOf agrupa por decada", () => {
    expect(decadeOf(2006)).toBe("2000s");
    expect(decadeOf(1999)).toBe("1990s");
    expect(decadeOf(2015)).toBe("2010s");
  });

  it("ageBandOf agrupa la edad en rangos", () => {
    expect(ageBandOf(2006, 1980)).toBe("26-30");
    expect(ageBandOf(2000, 1980)).toBe("<21");
    expect(ageBandOf(2003, 1980)).toBe("21-25");
    expect(ageBandOf(2013, 1980)).toBe("31-34");
    expect(ageBandOf(2016, 1980)).toBe("35+");
  });

  it("continentOf mapea la nacion", () => {
    expect(continentOf("BRA")).toBe("SA");
    expect(continentOf("ESP")).toBe("EU");
    expect(continentOf("CMR")).toBe("AF");
  });

  it("continentOf lanza ante una nacion desconocida", () => {
    expect(() => continentOf("XXX")).toThrow(/XXX/);
  });
});

describe("toPublic", () => {
  it("no deja pasar ningun campo privado", () => {
    const pub = toPublic(ronaldinho2006);
    expect(pub).toEqual({
      cardId: "ronaldinho-2006",
      slot: "CAM",
      silhouetteId: "ronaldinho-01",
      heightCm: 182,
      foot: "R",
      ageBand: "26-30",
      continent: "SA",
      decade: "2000s",
    });
    for (const leaked of ["name", "season", "club", "league", "nation", "rating"]) {
      expect(Object.hasOwn(pub, leaked)).toBe(false);
    }
  });
});

describe("toPrivate", () => {
  it("lleva los campos del reveal", () => {
    expect(toPrivate(ronaldinho2006)).toEqual({
      cardId: "ronaldinho-2006",
      name: "Ronaldinho",
      season: 2006,
      club: "FC Barcelona",
      league: "LaLiga",
      nation: "BRA",
      rating: 94,
    });
  });
});

describe("parseDataset", () => {
  it("acepta un dataset valido", () => {
    expect(parseDataset([ronaldinho2006])).toHaveLength(1);
  });

  it("rechaza un rating fuera de rango", () => {
    expect(() => parseDataset([{ ...ronaldinho2006, rating: 120 }])).toThrow();
  });

  it("rechaza un hueco que no existe en la formacion", () => {
    expect(() => parseDataset([{ ...ronaldinho2006, slot: "SW" }])).toThrow();
  });

  it("rechaza cardId duplicado", () => {
    expect(() => parseDataset([ronaldinho2006, ronaldinho2006])).toThrow(/duplicad/i);
  });
});

describe("cardsBySlot", () => {
  it("agrupa por hueco y deja vacios los que no tienen cartas", () => {
    const grouped = cardsBySlot([ronaldinho2006]);
    expect(grouped.CAM).toHaveLength(1);
    expect(grouped.GK).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/shared test dataset`
Expected: FAIL — `parseDataset` no exportado

- [ ] **Step 3: Implementar**

`packages/shared/src/dataset.ts`:

```ts
import { z } from "zod";
import { SLOTS, type AgeBand, type Continent, type Slot } from "./types.js";

/** Cada hueco necesita al menos esto para que dos partidas no se repitan. */
export const MIN_CARDS_PER_SLOT = 30;

export const CardSourceSchema = z.object({
  cardId: z.string().min(1),
  name: z.string().min(1),
  season: z.int().min(1950).max(2100),
  birthYear: z.int().min(1900).max(2100),
  club: z.string().min(1),
  league: z.string().min(1),
  /** Codigo ISO 3166-1 alfa-3. */
  nation: z.string().length(3),
  slot: z.enum(SLOTS),
  rating: z.int().min(1).max(99),
  heightCm: z.int().min(140).max(220),
  foot: z.enum(["L", "R", "B"]),
  silhouetteId: z.string().min(1),
});

export type CardSource = z.infer<typeof CardSourceSchema>;

export interface CardPublic {
  cardId: string;
  slot: Slot;
  silhouetteId: string;
  heightCm: number;
  foot: "L" | "R" | "B";
  ageBand: AgeBand;
  continent: Continent;
  decade: string;
}

export interface CardPrivate {
  cardId: string;
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
}

const NATION_CONTINENT: Record<string, Continent> = {
  ARG: "SA", BRA: "SA", URU: "SA", COL: "SA", CHI: "SA", PER: "SA", ECU: "SA", PAR: "SA", VEN: "SA", BOL: "SA",
  ESP: "EU", FRA: "EU", ITA: "EU", GER: "EU", ENG: "EU", POR: "EU", NED: "EU", BEL: "EU", CRO: "EU", SRB: "EU",
  POL: "EU", SWE: "EU", NOR: "EU", DEN: "EU", SUI: "EU", AUT: "EU", CZE: "EU", UKR: "EU", RUS: "EU", SCO: "EU",
  WAL: "EU", IRL: "EU", GRE: "EU", TUR: "EU", ROU: "EU", BUL: "EU", HUN: "EU", SVK: "EU", SVN: "EU", BIH: "EU",
  MEX: "NA", USA: "NA", CRC: "NA", CAN: "NA", HON: "NA", JAM: "NA", PAN: "NA",
  CMR: "AF", SEN: "AF", NGA: "AF", CIV: "AF", GHA: "AF", MAR: "AF", ALG: "AF", EGY: "AF", TUN: "AF", RSA: "AF", MLI: "AF", GUI: "AF",
  JPN: "AS", KOR: "AS", KSA: "AS", IRN: "AS", QAT: "AS", CHN: "AS", AUS: "AS", UZB: "AS",
  NZL: "OC", FIJ: "OC",
};

export function decadeOf(season: number): string {
  return `${Math.floor(season / 10) * 10}s`;
}

export function ageBandOf(season: number, birthYear: number): AgeBand {
  const age = season - birthYear;
  if (age < 21) return "<21";
  if (age <= 25) return "21-25";
  if (age <= 30) return "26-30";
  if (age <= 34) return "31-34";
  return "35+";
}

export function continentOf(nation: string): Continent {
  const continent = NATION_CONTINENT[nation];
  if (!continent) throw new Error(`Nacion sin continente en el mapa: ${nation}`);
  return continent;
}

/**
 * Proyeccion publica. Es la unica forma legitima de construir lo que se manda
 * al navegador antes del reveal: si un campo no esta aqui, no puede filtrarse.
 */
export function toPublic(card: CardSource): CardPublic {
  return {
    cardId: card.cardId,
    slot: card.slot,
    silhouetteId: card.silhouetteId,
    heightCm: card.heightCm,
    foot: card.foot,
    ageBand: ageBandOf(card.season, card.birthYear),
    continent: continentOf(card.nation),
    decade: decadeOf(card.season),
  };
}

export function toPrivate(card: CardSource): CardPrivate {
  return {
    cardId: card.cardId,
    name: card.name,
    season: card.season,
    club: card.club,
    league: card.league,
    nation: card.nation,
    rating: card.rating,
  };
}

/** Valida el dataset entero. Lanza con detalle: el servidor no debe arrancar con datos malos. */
export function parseDataset(raw: unknown): CardSource[] {
  const cards = z.array(CardSourceSchema).parse(raw);

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.cardId)) throw new Error(`cardId duplicado: ${card.cardId}`);
    seen.add(card.cardId);
    continentOf(card.nation); // lanza si la nacion no esta mapeada
  }

  return cards;
}

export function cardsBySlot(cards: CardSource[]): Record<Slot, CardSource[]> {
  const grouped = Object.fromEntries(SLOTS.map((s) => [s, [] as CardSource[]])) as Record<Slot, CardSource[]>;
  for (const card of cards) grouped[card.slot].push(card);
  return grouped;
}
```

Añadir a `packages/shared/src/index.ts`:

```ts
export * from "./dataset.js";
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/shared test`
Expected: PASS — 56 tests

- [ ] **Step 5: Crear el dataset semilla y su verificador**

`data/players.json` arranca con un mínimo jugable para los tests de integración: **5 cartas por cada uno de los 11 huecos, 55 en total**. Escribir las 55 entradas siguiendo exactamente este formato, con temporadas contrastadas del mismo futbolista donde exista el troleo (pico contra declive):

```json
[
  {
    "cardId": "ronaldinho-2006",
    "name": "Ronaldinho",
    "season": 2006,
    "birthYear": 1980,
    "club": "FC Barcelona",
    "league": "LaLiga",
    "nation": "BRA",
    "slot": "CAM",
    "rating": 94,
    "heightCm": 182,
    "foot": "R",
    "silhouetteId": "ronaldinho-01"
  },
  {
    "cardId": "ronaldinho-2015",
    "name": "Ronaldinho",
    "season": 2015,
    "birthYear": 1980,
    "club": "Fluminense",
    "league": "Serie A (BRA)",
    "nation": "BRA",
    "slot": "CAM",
    "rating": 74,
    "heightCm": 182,
    "foot": "R",
    "silhouetteId": "ronaldinho-01"
  }
]
```

`scripts/check-dataset.ts`:

```ts
import { readFileSync } from "node:fs";
import { cardsBySlot, MIN_CARDS_PER_SLOT, parseDataset, SLOTS } from "@fut/shared";

const cards = parseDataset(JSON.parse(readFileSync("data/players.json", "utf8")));
const grouped = cardsBySlot(cards);

const thin = SLOTS.filter((slot) => grouped[slot].length < MIN_CARDS_PER_SLOT);
console.log(`${cards.length} cartas cargadas.`);
for (const slot of SLOTS) console.log(`  ${slot.padEnd(4)} ${grouped[slot].length}`);

if (thin.length > 0) {
  console.warn(
    `\nHuecos por debajo de ${MIN_CARDS_PER_SLOT} cartas: ${thin.join(", ")}` +
      `\nEl juego funciona, pero las partidas repetiran candidatos.`,
  );
}

const unplayable = SLOTS.filter((slot) => grouped[slot].length < 5);
if (unplayable.length > 0) {
  console.error(`\nHuecos con menos de 5 cartas, no se puede jugar a 4: ${unplayable.join(", ")}`);
  process.exit(1);
}
```

Script en el `package.json` raíz:

```json
"dataset:check": "tsx scripts/check-dataset.ts"
```

Instalar `tsx` en la raíz:

```bash
pnpm add -Dw tsx@4.23.13 @types/node@26.4.1
```

- [ ] **Step 6: Ejecutar el verificador**

Run: `pnpm dataset:check`
Expected: sale 0, imprime `55 cartas cargadas.` y avisa de que los 11 huecos están por debajo de 30

> **Nota de alcance:** llegar a las 30 cartas por hueco es curación manual de datos, no programación. `pnpm dataset:check` es la puerta que dice cuánto falta. El juego es jugable con 5 por hueco desde esta tarea.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: dataset de cartas con validacion y separacion publico/privado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Pipeline de siluetas

**Files:**
- Create: `tools/build-silhouettes.ts`
- Create: `data/sources.json`
- Create: `data/attributions.json` (generado)
- Modify: `package.json` (raíz): script `silhouettes:build`
- Test: `tools/__tests__/silhouette.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces: `toSilhouette(input: Buffer): Promise<Buffer>` — PNG en negro sólido sobre transparente, alto normalizado a 512 px

- [ ] **Step 1: Instalar dependencias del pipeline**

```bash
pnpm add -Dw sharp vitest@4.1.11
```

`data/sources.json` describe de dónde sale cada silueta:

```json
[
  {
    "silhouetteId": "ronaldinho-01",
    "url": "https://upload.wikimedia.org/wikipedia/commons/…/Ronaldinho.jpg",
    "author": "Nombre del autor",
    "license": "CC BY-SA 3.0",
    "sourcePage": "https://commons.wikimedia.org/wiki/File:Ronaldinho.jpg"
  }
]
```

- [ ] **Step 2: Escribir el test que falla**

`tools/__tests__/silhouette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { toSilhouette } from "../build-silhouettes.js";

/** Un cuadrado rojo de 100x50 sobre fondo transparente. */
async function redBlob(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("toSilhouette", () => {
  it("normaliza la altura a 512 px", async () => {
    const out = await toSilhouette(await redBlob());
    const meta = await sharp(out).metadata();
    expect(meta.height).toBe(512);
  });

  it("deja todo pixel opaco en negro puro", async () => {
    const out = await toSilhouette(await redBlob());
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);

    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0) {
        opaque++;
        expect(data[i]).toBe(0);
        expect(data[i + 1]).toBe(0);
        expect(data[i + 2]).toBe(0);
      }
    }
    expect(opaque).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `pnpm vitest run tools`
Expected: FAIL — no existe `tools/build-silhouettes.ts`

- [ ] **Step 4: Implementar**

`tools/build-silhouettes.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const HEIGHT = 512;
/** Por debajo de esto un pixel se considera fondo y se descarta. */
const ALPHA_CUTOFF = 128;

interface Source {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
}

/**
 * Aplana la imagen a una silueta: todo pixel suficientemente opaco pasa a negro
 * puro, el resto a transparente. Altura normalizada para que todas las siluetas
 * se vean del mismo tamano y la estatura no se lea por accidente del encuadre.
 */
export async function toSilhouette(input: Buffer): Promise<Buffer> {
  const resized = sharp(input).resize({ height: HEIGHT, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const opaque = data[i + 3]! >= ALPHA_CUTOFF;
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = opaque ? 255 : 0;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main(): Promise<void> {
  const sources: Source[] = JSON.parse(await readFile("data/sources.json", "utf8"));
  await mkdir("data/silhouettes", { recursive: true });

  const attributions: Omit<Source, "url">[] = [];

  for (const source of sources) {
    const response = await fetch(source.url, { headers: { "User-Agent": "fut-subasta/0.1 (proyecto personal)" } });
    if (!response.ok) throw new Error(`${source.silhouetteId}: HTTP ${response.status} en ${source.url}`);

    const png = await toSilhouette(Buffer.from(await response.arrayBuffer()));
    await writeFile(`data/silhouettes/${source.silhouetteId}.png`, png);

    const { url: _url, ...credit } = source;
    attributions.push(credit);
    console.log(`ok ${source.silhouetteId}`);
  }

  await writeFile("data/attributions.json", `${JSON.stringify(attributions, null, 2)}\n`);
  console.log(`${attributions.length} siluetas generadas.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

Script en el `package.json` raíz:

```json
"silhouettes:build": "tsx tools/build-silhouettes.ts"
```

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

Run: `pnpm vitest run tools`
Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: pipeline offline de siluetas con registro de atribucion" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Sala de Colyseus — estado y lobby

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/vitest.config.ts`
- Create: `packages/server/src/schema.ts`, `packages/server/src/project.ts`, `packages/server/src/setup.ts`, `packages/server/src/AuctionRoom.ts`, `packages/server/src/index.ts`
- Test: `packages/server/test/lobby.test.ts`

**Interfaces:**
- Consumes: todo `@fut/shared` (Tasks 1-6)
- Produces: `AuctionRoomState`, `PlayerSchema`, `PublicCardSchema`, `RevealedCardSchema`, `StandingSchema` (clases Schema); `projectState(game: AuctionState, schema: AuctionRoomState, rules: Rules, cards: Map<string, CardSource>): void`; `drawRound(grouped: Record<Slot, CardSource[]>, slot: Slot, playerCount: number, rng: Rng, used: Set<string>): string[]`; `AuctionRoom`

- [ ] **Step 1: Crear el paquete `server`**

`packages/server/package.json`:

```json
{
  "name": "@fut/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@colyseus/core": "0.16.25",
    "@colyseus/schema": "3.0.76",
    "@colyseus/ws-transport": "0.16.5",
    "@fut/shared": "workspace:*",
    "colyseus": "0.16.5",
    "express": "5.2.1"
  },
  "devDependencies": {
    "@colyseus/testing": "0.16.3",
    "@types/node": "26.4.1",
    "tsx": "4.23.13",
    "typescript": "6.0.3",
    "vitest": "4.1.11"
  }
}
```

`packages/server/tsconfig.json` — **los decoradores legados solo aquí**:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src", "test"]
}
```

`packages/server/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 15_000 },
  esbuild: { target: "es2023" },
});
```

> **Por qué `defineTypes()` y no `@type()`.** Vitest transpila con esbuild, que no admite decoradores legados, así que un `schema.ts` con `@type()` no se podría testear. `defineTypes(Klass, { campo: "tipo" })` es la API equivalente sin decoradores de `@colyseus/schema@3` — misma `Definition`, mismo formato binario en el cable.
>
> **`useDefineForClassFields: false` sigue siendo obligatorio.** `defineTypes` instala accesores en el prototipo para rastrear los cambios. Con la semántica moderna de campos de clase (`useDefineForClassFields: true`), cada instancia crearía campos propios que tapan esos accesores y la sincronización dejaría de detectar cambios, en silencio. Vite y Vitest respetan el valor del tsconfig, por eso está fijado ahí.
>
> Los campos sin inicializador llevan `!` (`playerId!: string`) porque con `useDefineForClassFields: false` no emiten nada en tiempo de ejecución, pero `strictPropertyInitialization` los reclamaría igual.

```bash
pnpm install
```

- [ ] **Step 2: Escribir el test que falla**

`packages/server/test/lobby.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

describe("lobby", () => {
  it("admite cuatro jugadores y arranca en LOBBY", async () => {
    const room = await colyseus.createRoom("auction", {});
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      await colyseus.connectTo(room, { name });
    }
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.players.size).toBe(4);
    expect([...room.state.players.values()].map((p) => p.name)).toContain("Ana");
  });

  it("reparte jugadores + 1 candidatos y pasa a BIDDING cuando todos estan listos", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect(room.state.currentSlot).toBe("GK");
    expect(room.state.remainingCount).toBe(5);
    expect(room.state.currentCard?.cardId).toBeTruthy();
  });

  it("no filtra ningun campo privado de la carta antes del reveal", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const card = clients[0]!.state.currentCard;
    expect(card?.silhouetteId).toBeTruthy();
    expect(card?.name).toBe("");
    expect(card?.rating).toBe(0);
    expect(card?.season).toBe(0);
    expect(card?.revealed).toBe(false);
  });

  it("cada jugador arranca con el presupuesto inicial", async () => {
    const room = await colyseus.createRoom("auction", {});
    await colyseus.connectTo(room, { name: "Ana" });
    expect([...room.state.players.values()][0]?.budget).toBe(100);
  });
});
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/server test`
Expected: FAIL — no existe `../src/index.js`

- [ ] **Step 4: Escribir el Schema**

`packages/server/src/schema.ts`:

```ts
import { ArraySchema, defineTypes, MapSchema, Schema } from "@colyseus/schema";

/**
 * Un jugador humano de la sala.
 * `squad` mapea hueco de la formacion -> cardId fichado.
 */
export class PlayerSchema extends Schema {
  playerId!: string;
  name!: string;
  budget!: number;
  connected!: boolean;
  squad = new MapSchema<string>();
}
defineTypes(PlayerSchema, {
  playerId: "string",
  name: "string",
  budget: "number",
  connected: "boolean",
  squad: { map: "string" },
});

/**
 * La carta sobre la mesa.
 *
 * Los seis campos privados (`name`, `season`, `club`, `league`, `nation`,
 * `rating`) se quedan en su valor vacio hasta la fase REVEAL. Escribirlos antes
 * los publica al navegador: el Schema entero se sincroniza y se lee en DevTools.
 */
export class PublicCardSchema extends Schema {
  cardId!: string;
  slot!: string;
  silhouetteId!: string;
  heightCm!: number;
  foot!: string;
  ageBand!: string;
  continent!: string;
  decade!: string;

  revealed = false;
  name = "";
  season = 0;
  club = "";
  league = "";
  nation = "";
  rating = 0;
}
defineTypes(PublicCardSchema, {
  cardId: "string",
  slot: "string",
  silhouetteId: "string",
  heightCm: "number",
  foot: "string",
  ageBand: "string",
  continent: "string",
  decade: "string",
  revealed: "boolean",
  name: "string",
  season: "number",
  club: "string",
  league: "string",
  nation: "string",
  rating: "number",
});

/** Carta ya revelada, guardada para que el cliente pueda pintar las plantillas. */
export class RevealedCardSchema extends Schema {
  cardId!: string;
  slot!: string;
  silhouetteId!: string;
  name!: string;
  season!: number;
  club!: string;
  league!: string;
  nation!: string;
  rating!: number;
  /** Quien se la llevo, o "" si se descarto. */
  ownerId!: string;
  /** Lo que se pago. 0 si se descarto. */
  price!: number;
}
defineTypes(RevealedCardSchema, {
  cardId: "string",
  slot: "string",
  silhouetteId: "string",
  name: "string",
  season: "number",
  club: "string",
  league: "string",
  nation: "string",
  rating: "number",
  ownerId: "string",
  price: "number",
});

export class StandingSchema extends Schema {
  playerId!: string;
  points!: number;
  totalRating!: number;
  budgetLeft!: number;
  rank!: number;
}
defineTypes(StandingSchema, {
  playerId: "string",
  points: "number",
  totalRating: "number",
  budgetLeft: "number",
  rank: "number",
});

export class AuctionRoomState extends Schema {
  phase = "LOBBY";
  slotIndex = 0;
  currentSlot = "";
  currentCard: PublicCardSchema | undefined = undefined;
  currentBid = 0;
  currentBidderId = "";
  minimumBid = 0;
  /** Marca de tiempo absoluta del cierre, en ms. */
  endsAt = 0;
  /** Cartas que quedan por resolver en esta ronda, la de la mesa incluida. */
  remainingCount = 0;
  skipAvailable = false;
  skipVotes = new MapSchema<boolean>();
  restrictedBidders = new ArraySchema<string>();
  players = new MapSchema<PlayerSchema>();
  revealedCards = new MapSchema<RevealedCardSchema>();
  standings = new ArraySchema<StandingSchema>();
}
defineTypes(AuctionRoomState, {
  phase: "string",
  slotIndex: "number",
  currentSlot: "string",
  currentCard: PublicCardSchema,
  currentBid: "number",
  currentBidderId: "string",
  minimumBid: "number",
  endsAt: "number",
  remainingCount: "number",
  skipAvailable: "boolean",
  skipVotes: { map: "boolean" },
  restrictedBidders: ["string"],
  players: { map: PlayerSchema },
  revealedCards: { map: RevealedCardSchema },
  standings: [StandingSchema],
});
```

- [ ] **Step 5: Escribir la proyección y el reparto de ronda**

`packages/server/src/project.ts`:

```ts
import {
  currentCardId, currentSlot, minimumBid, skipAllowed,
  toPublic, type AuctionState, type CardSource, type Rules,
} from "@fut/shared";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import { AuctionRoomState, PlayerSchema, PublicCardSchema } from "./schema.js";

/**
 * Copia el estado puro sobre el Schema. Es el unico punto donde se decide que
 * ve el navegador: si un campo no se escribe aqui, no viaja.
 */
export function projectState(
  game: AuctionState,
  schema: AuctionRoomState,
  rules: Rules,
  cards: Map<string, CardSource>,
): void {
  schema.phase = game.phase;
  schema.slotIndex = game.slotIndex;
  schema.currentSlot = game.phase === "LOBBY" ? "" : currentSlot(game);
  schema.currentBid = game.currentBid;
  schema.currentBidderId = game.currentBidderId ?? "";
  schema.minimumBid = minimumBid(game, rules);
  schema.endsAt = game.endsAt;
  schema.remainingCount = game.remainingCards.length;
  schema.skipAvailable = game.phase === "SKIP_VOTE" && skipAllowed(game);

  schema.skipVotes.clear();
  for (const [playerId, vote] of Object.entries(game.skipVotes)) schema.skipVotes.set(playerId, vote);

  schema.restrictedBidders = new ArraySchema<string>(...(game.restrictedBidders ?? []));

  for (const player of game.players) {
    let row = schema.players.get(player.playerId);
    if (!row) {
      row = new PlayerSchema();
      row.playerId = player.playerId;
      row.squad = new MapSchema<string>();
      schema.players.set(player.playerId, row);
    }
    row.name = player.name;
    row.budget = player.budget;
    row.connected = player.connected;
    for (const [slot, cardId] of Object.entries(player.squad)) {
      if (cardId !== undefined) row.squad.set(slot, cardId);
    }
  }

  // Durante REVEAL la carta ya salio de remainingCards, asi que currentCardId
  // apuntaria a la SIGUIENTE. Proyectarla aqui haria dos destrozos a la vez:
  // borraria de pantalla la carta que se esta revelando, y adelantaria la
  // silueta del proximo candidato antes de tiempo. No se toca.
  if (game.phase === "REVEAL") return;

  const cardId = game.phase === "LOBBY" ? null : currentCardId(game);
  if (cardId === null) {
    schema.currentCard = undefined;
    return;
  }

  if (schema.currentCard?.cardId !== cardId) {
    const card = cards.get(cardId);
    if (!card) throw new Error(`cardId desconocido en el dataset: ${cardId}`);
    const pub = toPublic(card);
    const node = new PublicCardSchema();
    node.cardId = pub.cardId;
    node.slot = pub.slot;
    node.silhouetteId = pub.silhouetteId;
    node.heightCm = pub.heightCm;
    node.foot = pub.foot;
    node.ageBand = pub.ageBand;
    node.continent = pub.continent;
    node.decade = pub.decade;
    schema.currentCard = node;
  }
}
```

`packages/server/src/setup.ts`:

```ts
import type { CardSource, Rng, Slot } from "@fut/shared";

/**
 * Toma `playerCount + 1` cartas del mazo del hueco y las baraja.
 * Sobra siempre una: eso es lo que da margen para saltar y garantiza descarte.
 */
export function drawRound(
  grouped: Record<Slot, CardSource[]>,
  slot: Slot,
  playerCount: number,
  rng: Rng,
  used: Set<string>,
): string[] {
  const pool = grouped[slot].filter((card) => !used.has(card.cardId));
  const needed = playerCount + 1;
  if (pool.length < needed) {
    throw new Error(`El hueco ${slot} tiene ${pool.length} cartas libres y hacen falta ${needed}`);
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const drawn = shuffled.slice(0, needed);
  for (const card of drawn) used.add(card.cardId);
  return drawn.map((card) => card.cardId);
}
```

- [ ] **Step 6: Escribir la sala con lobby y arranque**

`packages/server/src/AuctionRoom.ts`:

```ts
import { Client, Room } from "@colyseus/core";
import {
  cardsBySlot, currentSlot, DEFAULT_RULES, parseDataset, SLOTS,
  type AuctionState, type CardSource, type Rng, type Rules,
} from "@fut/shared";
import { readFileSync } from "node:fs";
import { AuctionRoomState } from "./schema.js";
import { projectState } from "./project.js";
import { drawRound } from "./setup.js";

const DATASET: CardSource[] = parseDataset(JSON.parse(readFileSync("data/players.json", "utf8")));
const BY_SLOT = cardsBySlot(DATASET);
const BY_ID = new Map(DATASET.map((card) => [card.cardId, card]));

export class AuctionRoom extends Room<AuctionRoomState> {
  maxClients = 4;

  /** Fuente de verdad. El Schema es solo su proyeccion publica. */
  private game: AuctionState = {
    phase: "LOBBY",
    slotIndex: 0,
    remainingCards: [],
    currentBid: 0,
    currentBidderId: null,
    endsAt: 0,
    skipVotes: {},
    restrictedBidders: null,
    players: [],
  };

  private rules: Rules = DEFAULT_RULES;
  private rng: Rng = Math.random;
  private ready = new Set<string>();
  private usedCards = new Set<string>();

  onCreate(): void {
    this.setState(new AuctionRoomState());
    this.onMessage("ready", (client) => this.onReady(client));
    this.sync();
  }

  onJoin(client: Client, options?: { name?: string }): void {
    this.game.players.push({
      playerId: client.sessionId,
      name: options?.name ?? `Jugador ${this.game.players.length + 1}`,
      budget: this.rules.startingBudget,
      squad: {},
      connected: true,
    });
    this.sync();
  }

  onLeave(client: Client): void {
    this.setConnected(client.sessionId, false);
    this.sync();
  }

  /** Copia el estado puro sobre el Schema. Se llama tras cada cambio. */
  protected sync(): void {
    projectState(this.game, this.state, this.rules, BY_ID);
  }

  protected setConnected(playerId: string, connected: boolean): void {
    const player = this.game.players.find((p) => p.playerId === playerId);
    if (player) player.connected = connected;
  }

  private onReady(client: Client): void {
    if (this.game.phase !== "LOBBY") return;
    this.ready.add(client.sessionId);
    if (this.ready.size < this.game.players.length || this.game.players.length < 2) return;
    this.startRound(0);
  }

  /** Arranca la ronda del hueco `slotIndex` repartiendo jugadores + 1 candidatos. */
  protected startRound(slotIndex: number): void {
    this.game.slotIndex = slotIndex;
    this.game.remainingCards = drawRound(
      BY_SLOT,
      SLOTS[slotIndex]!,
      this.game.players.length,
      this.rng,
      this.usedCards,
    );
    this.openBidding();
  }

  /** Pone la carta de la mesa a subasta y arma el reloj de cierre. */
  protected openBidding(): void {
    this.game.phase = "BIDDING";
    this.game.currentBid = 0;
    this.game.currentBidderId = null;
    this.game.skipVotes = {};
    this.game.endsAt = Date.now() + this.rules.bidTimerMs;
    this.sync();
  }

  /** Expuesto para los tests: el hueco que se subasta ahora. */
  get slot(): string {
    return currentSlot(this.game);
  }
}
```

`packages/server/src/index.ts`:

```ts
import { config } from "@colyseus/tools";
import { AuctionRoom } from "./AuctionRoom.js";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("auction", AuctionRoom);
  },
});
```

Añadir `@colyseus/tools` a `packages/server`:

```bash
pnpm --filter @fut/server add @colyseus/tools@0.16.20
```

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/server test`
Expected: PASS — 4 tests

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: sala de Colyseus con lobby y estado publico separado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Fase de puja en el servidor

**Files:**
- Modify: `packages/server/src/AuctionRoom.ts`
- Test: `packages/server/test/bidding.test.ts`

**Interfaces:**
- Consumes: `AuctionRoom` (Task 8), `canBid`, `applyBid`, `minimumBid` (Task 2)
- Produces: mensaje entrante `bid` con `{ amount: number }`; mensaje saliente `bid:rejected` con `{ reason: BidError }`; método `protected onBidTimeout(): void`

- [ ] **Step 1: Escribir el test que falla**

`packages/server/test/bidding.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients };
}

describe("puja", () => {
  it("acepta una puja valida y la refleja en el estado", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    expect(room.state.currentBid).toBe(5);
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
    expect(room.state.minimumBid).toBe(6);
  });

  it("empuja el cierre en cada puja (anti-snipe)", async () => {
    const { room, clients } = await startedRoom();
    const before = room.state.endsAt;
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    const after = room.state.endsAt;

    // 15 s iniciales -> 6 s desde ahora: el cierre se adelanta pero queda anclado a la puja
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThan(Date.now());
  });

  it("rechaza una puja por debajo del minimo y avisa al que pujo", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[1]!.onMessage("bid:rejected", resolve);
    });
    clients[1]!.send("bid", { amount: 5 });
    expect((await rejection).reason).toBe("BID_TOO_LOW");
    expect(room.state.currentBidderId).toBe(clients[0]!.sessionId);
  });

  it("rechaza una puja que rompe el presupuesto bloqueado", async () => {
    const { clients } = await startedRoom();
    const rejection = new Promise<{ reason: string }>((resolve) => {
      clients[0]!.onMessage("bid:rejected", resolve);
    });
    clients[0]!.send("bid", { amount: 81 });
    expect((await rejection).reason).toBe("OVER_BUDGET");
  });

  it("al cerrarse el timer cobra al ganador y le asigna el hueco", async () => {
    const { room, clients } = await startedRoom();
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();

    // Forzar el cierre sin esperar 6 s reales
    (room as unknown as { onBidTimeout(): void }).onBidTimeout();
    await room.waitForNextPatch();

    const winner = room.state.players.get(clients[0]!.sessionId);
    expect(winner?.budget).toBe(95);
    expect(winner?.squad.get("GK")).toBeTruthy();
    expect(room.state.phase).toBe("REVEAL");
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/server test bidding`
Expected: FAIL — el mensaje `bid` no está registrado, `currentBid` sigue en 0

- [ ] **Step 3: Implementar**

En `packages/server/src/AuctionRoom.ts`, añadir los imports:

```ts
import {
  applyBid, applyOutcome, canBid, resolveAuction,
} from "@fut/shared";
import type { Delayed } from "@colyseus/core";
```

Añadir el campo del temporizador junto a los demás:

```ts
  private timer: Delayed | undefined;
```

Registrar el mensaje en `onCreate`, justo después del de `ready`:

```ts
    this.onMessage("bid", (client, message: { amount?: unknown }) => {
      this.onBid(client, message?.amount);
    });
```

Y añadir los métodos:

```ts
  private onBid(client: Client, amount: unknown): void {
    if (typeof amount !== "number") {
      client.send("bid:rejected", { reason: "BID_TOO_LOW" });
      return;
    }

    // La hora del servidor al entrar aqui es la unica que cuenta.
    const now = Date.now();
    const verdict = canBid(this.game, this.rules, client.sessionId, amount, now);
    if (!verdict.ok) {
      client.send("bid:rejected", { reason: verdict.error });
      return;
    }

    this.game = applyBid(this.game, this.rules, client.sessionId, amount, now);
    this.armTimer(this.game.endsAt - now);
    this.sync();
  }

  /** Reprograma el cierre. Cancela el anterior: nunca hay dos relojes vivos. */
  protected armTimer(delayMs: number): void {
    this.timer?.clear();
    this.timer = this.clock.setTimeout(() => this.onBidTimeout(), Math.max(0, delayMs));
  }

  /** Se dispara al agotarse el reloj de la subasta. */
  protected onBidTimeout(): void {
    if (this.game.phase !== "BIDDING") return;
    const outcome = resolveAuction(this.game, this.rules, this.rng);
    this.game = applyOutcome(this.game, outcome);
    this.sync();
  }
```

Y en `openBidding()`, armar el reloj tras fijar `endsAt`:

```ts
    this.game.endsAt = Date.now() + this.rules.bidTimerMs;
    this.armTimer(this.rules.bidTimerMs);
    this.sync();
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/server test`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fase de puja con reloj autoritativo y anti-snipe" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Voto de salto, reveal y avance de ronda

**Files:**
- Modify: `packages/server/src/AuctionRoom.ts`
- Test: `packages/server/test/round-flow.test.ts`

**Interfaces:**
- Consumes: `AuctionRoom` (Tasks 8-9), `resolveSkipVote`, `skipAllowed` (Task 3)
- Produces: mensaje entrante `voteSkip` con `{ skip: boolean }`; métodos `protected onSkipTimeout()`, `protected onRevealTimeout()`, `protected advance()`

- [ ] **Step 1: Escribir el test que falla**

`packages/server/test/round-flow.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks {
  onBidTimeout(): void;
  onSkipTimeout(): void;
  onRevealTimeout(): void;
}

async function startedRoom() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();
  return { room, clients, hooks: room as unknown as Hooks };
}

describe("voto de salto", () => {
  it("abre la votacion si nadie puja y hay margen", async () => {
    const { room, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("SKIP_VOTE");
    expect(room.state.skipAvailable).toBe(true);
  });

  it("descarta la carta si el voto es unanime", async () => {
    const { room, clients, hooks } = await startedRoom();
    const firstCard = room.state.currentCard?.cardId;
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    for (const client of clients) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("REVEAL");
    expect(room.state.revealedCards.get(firstCard!)?.ownerId).toBe("");
    expect(room.state.remainingCount).toBe(4);
  });

  it("reanuda restringido a quien voto en contra", async () => {
    const { room, clients, hooks } = await startedRoom();
    hooks.onBidTimeout();
    await room.waitForNextPatch();

    clients[0]!.send("voteSkip", { skip: true });
    clients[1]!.send("voteSkip", { skip: false });
    await room.waitForNextPatch();
    hooks.onSkipTimeout();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("BIDDING");
    expect([...room.state.restrictedBidders]).toEqual([clients[1]!.sessionId]);
  });

  it("no ofrece saltar cuando se agota el margen", async () => {
    const { room, clients, hooks } = await startedRoom();
    // Adjudicar una carta: pasan a quedar 4 cartas y 3 jugadores por fichar,
    // asi que el margen sigue existiendo. Adjudicar otra deja 3 y 2: sigue.
    // El margen solo desaparece si se descarta, no si se adjudica.
    for (let i = 0; i < 2; i++) {
      clients[i]!.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.remainingCount).toBe(3);

    // Un descarte unanime quita una carta sin quitar un jugador -> margen agotado
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    for (const client of clients.slice(2)) client.send("voteSkip", { skip: true });
    await room.waitForNextPatch();
    hooks.onRevealTimeout();
    await room.waitForNextPatch();

    expect(room.state.remainingCount).toBe(2);
    hooks.onBidTimeout();
    await room.waitForNextPatch();
    expect(room.state.phase).not.toBe("SKIP_VOTE");
  });
});

describe("reveal y avance", () => {
  it("el reveal publica los campos privados de la carta adjudicada", async () => {
    const { room, clients } = await startedRoom();
    const cardId = room.state.currentCard!.cardId;
    clients[0]!.send("bid", { amount: 5 });
    await room.waitForNextPatch();
    (room as unknown as Hooks).onBidTimeout();
    await room.waitForNextPatch();

    const revealed = room.state.revealedCards.get(cardId);
    expect(revealed?.name).toBeTruthy();
    expect(revealed?.rating).toBeGreaterThan(0);
    expect(revealed?.ownerId).toBe(clients[0]!.sessionId);
    expect(revealed?.price).toBe(5);
    expect(room.state.currentCard?.revealed).toBe(true);
  });

  it("pasa al siguiente hueco cuando todos han fichado el actual", async () => {
    const { room, clients, hooks } = await startedRoom();
    for (const client of clients) {
      client.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
    expect(room.state.currentSlot).toBe("LB");
    expect(room.state.remainingCount).toBe(5);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @fut/server test round-flow`
Expected: FAIL — el mensaje `voteSkip` no está registrado

- [ ] **Step 3: Implementar**

Imports adicionales en `AuctionRoom.ts`:

```ts
import { currentCardId, resolveSkipVote, SLOTS, toPrivate, toPublic } from "@fut/shared";
import { RevealedCardSchema } from "./schema.js";
import type { AuctionOutcome } from "@fut/shared";
```

Registrar el mensaje en `onCreate`:

```ts
    this.onMessage("voteSkip", (client, message: { skip?: unknown }) => {
      this.onVoteSkip(client, message?.skip === true);
    });
```

Reescribir `onBidTimeout` para que enrute el desenlace, y añadir el resto:

```ts
  protected onBidTimeout(): void {
    if (this.game.phase !== "BIDDING") return;
    const outcome = resolveAuction(this.game, this.rules, this.rng);
    this.game = applyOutcome(this.game, outcome);

    if (outcome.kind === "OPEN_SKIP_VOTE") {
      this.game.endsAt = Date.now() + this.rules.skipVoteMs;
      this.timer?.clear();
      this.timer = this.clock.setTimeout(() => this.onSkipTimeout(), this.rules.skipVoteMs);
      this.sync();
      return;
    }

    this.enterReveal(outcome);
  }

  private onVoteSkip(client: Client, skip: boolean): void {
    if (this.game.phase !== "SKIP_VOTE") return;
    this.game.skipVotes = { ...this.game.skipVotes, [client.sessionId]: skip };
    this.sync();

    // Si ya votaron todos los que podian, no hace falta agotar los 10 s.
    const pending = playersNeedingSlot(this.game).filter(
      (p) => this.game.skipVotes[p.playerId] === undefined,
    );
    if (pending.length === 0) this.onSkipTimeout();
  }

  protected onSkipTimeout(): void {
    if (this.game.phase !== "SKIP_VOTE") return;
    const outcome = resolveSkipVote(this.game);

    if (outcome.kind === "SKIPPED") {
      // applyOutcome es quien saca la carta de la ronda y limpia
      // restrictedBidders y skipVotes. enterReveal solo publica.
      const cardId = currentCardId(this.game)!;
      const discarded = { kind: "DISCARDED", cardId } as const;
      this.game = applyOutcome(this.game, discarded);
      this.enterReveal(discarded);
      return;
    }

    // Reanudar restringido: solo pueden pujar los que votaron en contra.
    this.game = {
      ...this.game,
      phase: "BIDDING",
      restrictedBidders: outcome.restrictedBidders,
      skipVotes: {},
      endsAt: Date.now() + this.rules.bidTimerMs,
    };
    this.armTimer(this.rules.bidTimerMs);
    this.sync();
  }

  /**
   * Publica los campos privados de la carta. Es el unico sitio del servidor
   * autorizado a hacerlo.
   */
  private enterReveal(outcome: AuctionOutcome): void {
    if (outcome.kind === "OPEN_SKIP_VOTE") throw new Error("enterReveal con OPEN_SKIP_VOTE");

    const card = BY_ID.get(outcome.cardId);
    if (!card) throw new Error(`cardId desconocido: ${outcome.cardId}`);
    const priv = toPrivate(card);
    const pub = toPublic(card);

    const row = new RevealedCardSchema();
    row.cardId = priv.cardId;
    row.slot = pub.slot;
    row.silhouetteId = pub.silhouetteId;
    row.name = priv.name;
    row.season = priv.season;
    row.club = priv.club;
    row.league = priv.league;
    row.nation = priv.nation;
    row.rating = priv.rating;
    row.ownerId = outcome.kind === "DISCARDED" ? "" : outcome.playerId;
    row.price = outcome.kind === "DISCARDED" ? 0 : outcome.price;
    this.state.revealedCards.set(row.cardId, row);

    this.game.phase = "REVEAL";
    this.game.endsAt = Date.now() + this.rules.revealMs;
    this.sync();

    // La carta de la mesa se mantiene visible con sus campos ya publicados.
    if (this.state.currentCard?.cardId === row.cardId) {
      this.state.currentCard.revealed = true;
      this.state.currentCard.name = row.name;
      this.state.currentCard.season = row.season;
      this.state.currentCard.club = row.club;
      this.state.currentCard.league = row.league;
      this.state.currentCard.nation = row.nation;
      this.state.currentCard.rating = row.rating;
    }

    this.timer?.clear();
    this.timer = this.clock.setTimeout(() => this.onRevealTimeout(), this.rules.revealMs);
  }

  protected onRevealTimeout(): void {
    if (this.game.phase !== "REVEAL") return;
    this.advance();
  }

  /** Siguiente carta de la ronda, o siguiente hueco, o fin de partida. */
  protected advance(): void {
    const stillNeeding = playersNeedingSlot(this.game).length;

    if (stillNeeding > 0 && this.game.remainingCards.length > 0) {
      this.state.currentCard = undefined; // fuerza a proyectar la carta nueva
      this.openBidding();
      return;
    }

    const next = this.game.slotIndex + 1;
    if (next >= SLOTS.length) {
      this.finish();
      return;
    }

    this.state.currentCard = undefined;
    this.startRound(next);
  }
```

Importar `playersNeedingSlot` desde `@fut/shared` en la lista de imports.

`finish()` se implementa en la Task 11; por ahora, un cuerpo mínimo para que compile:

```ts
  protected finish(): void {
    this.game.phase = "RESULTS";
    this.sync();
  }
```

**Regla de reparto entre `applyOutcome` y `enterReveal`, que es fácil de romper:** `applyOutcome` es quien avanza el estado — saca la carta de `remainingCards`, cobra al ganador y limpia `restrictedBidders` y `skipVotes`. `enterReveal` solo publica los campos privados. Cada desenlace pasa por `applyOutcome` **exactamente una vez**:

- `onBidTimeout` llama a `applyOutcome` y después a `enterReveal`.
- `onSkipTimeout`, en la rama `SKIPPED`, construye su propio `DISCARDED` y hace lo mismo.

Llamar dos veces sacaría dos cartas de la ronda; no llamar dejaría la restricción de pujadores viva sobre la carta siguiente.

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @fut/server test`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: voto de salto, reveal y avance de ronda" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Resultados, desconexión y la invariante

**Files:**
- Modify: `packages/server/src/AuctionRoom.ts`
- Test: `packages/server/test/results.test.ts`
- Test: `packages/server/test/invariant.test.ts`

**Interfaces:**
- Consumes: `AuctionRoom` (Tasks 8-10), `scoreMatch` (Task 5)
- Produces: `finish()` completo, `onLeave` con `allowReconnection`

- [ ] **Step 1: Escribir el test que falla**

`packages/server/test/results.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { SLOTS } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onRevealTimeout(): void }

/** Juega una partida entera: todos pujan el minimo, cada uno se lleva una carta por hueco. */
async function playFullMatch() {
  const room = await colyseus.createRoom("auction", {});
  const clients = [];
  for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  for (const client of clients) client.send("ready", {});
  await room.waitForNextPatch();

  const hooks = room as unknown as Hooks;
  for (let slot = 0; slot < SLOTS.length; slot++) {
    for (const client of clients) {
      client.send("bid", { amount: 2 });
      await room.waitForNextPatch();
      hooks.onBidTimeout();
      await room.waitForNextPatch();
      hooks.onRevealTimeout();
      await room.waitForNextPatch();
    }
  }
  return { room, clients };
}

describe("resultados", () => {
  it("termina en RESULTS con una fila por jugador", async () => {
    const { room } = await playFullMatch();
    expect(room.state.phase).toBe("RESULTS");
    expect(room.state.standings.length).toBe(4);
  });

  it("reparte exactamente 11 puntos entre los cuatro", async () => {
    const { room } = await playFullMatch();
    const total = [...room.state.standings].reduce((sum, s) => sum + s.points, 0);
    expect(total).toBeCloseTo(11, 5);
  });

  it("la clasificacion viene ordenada y con rango", async () => {
    const { room } = await playFullMatch();
    const rows = [...room.state.standings];
    expect(rows[0]?.rank).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.points).toBeLessThanOrEqual(rows[i - 1]!.points);
    }
  });
});

describe("desconexion", () => {
  it("marca al jugador como desconectado sin parar la partida", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const goneId = clients[3]!.sessionId;
    await clients[3]!.leave(false);
    await room.waitForNextPatch();

    expect(room.state.players.get(goneId)?.connected).toBe(false);
    expect(room.state.phase).toBe("BIDDING");
  });
});
```

`packages/server/test/invariant.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { SLOTS } from "@fut/shared";
import appConfig from "../src/index.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

interface Hooks { onBidTimeout(): void; onSkipTimeout(): void; onRevealTimeout(): void }

/**
 * La invariante que justifica el presupuesto bloqueado y el margen de salto:
 * jugando de la forma mas hostil posible — nadie puja nunca, todos votan
 * saltar siempre — ningun jugador conectado puede terminar con un hueco vacio.
 */
describe("invariante de plantilla completa", () => {
  it("nadie termina con huecos vacios aunque nadie puje jamas", async () => {
    const room = await colyseus.createRoom("auction", {});
    const clients = [];
    for (const name of ["Ana", "Bea", "Cid", "Dan"]) {
      clients.push(await colyseus.connectTo(room, { name }));
    }
    for (const client of clients) client.send("ready", {});
    await room.waitForNextPatch();

    const hooks = room as unknown as Hooks;
    // Cota generosa: 11 huecos x 5 cartas, con margen para votos y reveals.
    for (let step = 0; step < 400 && room.state.phase !== "RESULTS"; step++) {
      if (room.state.phase === "BIDDING") {
        hooks.onBidTimeout();
      } else if (room.state.phase === "SKIP_VOTE") {
        for (const client of clients) client.send("voteSkip", { skip: true });
        await room.waitForNextPatch();
        hooks.onSkipTimeout();
      } else if (room.state.phase === "REVEAL") {
        hooks.onRevealTimeout();
      }
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("RESULTS");
    for (const player of room.state.players.values()) {
      for (const slot of SLOTS) {
        expect(player.squad.get(slot), `${player.name} sin ${slot}`).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `pnpm --filter @fut/server test results invariant`
Expected: FAIL — `standings` vacío; la invariante no llega a `RESULTS`

- [ ] **Step 3: Implementar**

Imports adicionales en `AuctionRoom.ts`:

```ts
import { scoreMatch } from "@fut/shared";
import { StandingSchema } from "./schema.js";
import { ArraySchema } from "@colyseus/schema";
```

Sustituir el `finish()` provisional:

```ts
  protected finish(): void {
    this.timer?.clear();
    this.game.phase = "RESULTS";

    const table = scoreMatch(this.game.players, (cardId) => {
      const card = BY_ID.get(cardId);
      if (!card) throw new Error(`cardId desconocido al puntuar: ${cardId}`);
      return card.rating;
    });

    this.state.standings = new ArraySchema<StandingSchema>(
      ...table.map((row) => {
        const node = new StandingSchema();
        node.playerId = row.playerId;
        node.points = row.points;
        node.totalRating = row.totalRating;
        node.budgetLeft = row.budgetLeft;
        node.rank = row.rank;
        return node;
      }),
    );

    this.sync();
  }
```

Sustituir `onLeave` por la versión con reconexión:

```ts
  async onLeave(client: Client, consented?: boolean): Promise<void> {
    this.setConnected(client.sessionId, false);
    this.sync();

    if (consented) return;

    try {
      await this.allowReconnection(client, this.rules.reconnectSeconds);
      this.setConnected(client.sessionId, true);
      this.sync();
    } catch {
      // No volvio dentro del margen: sus huecos quedan vacios y suman 0.
    }
  }
```

- [ ] **Step 4: Ejecutar todos los tests y verificar que pasan**

Run: `pnpm -r test`
Expected: PASS — 56 en `shared`, 2 en `tools`, 21 en `server`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: resultados, reconexion e invariante de plantilla completa" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Cliente — conexión y lobby

**Files:**
- Create: `packages/client/package.json`, `packages/client/tsconfig.json`, `packages/client/vite.config.ts`, `packages/client/index.html`
- Create: `packages/client/src/main.tsx`, `packages/client/src/index.css`, `packages/client/src/App.tsx`
- Create: `packages/client/src/net/types.ts`, `packages/client/src/net/useRoom.ts`, `packages/client/src/net/useServerClock.ts`
- Create: `packages/client/src/screens/Lobby.tsx`

**Interfaces:**
- Consumes: el servidor de la Task 11 por WebSocket
- Produces: `ClientState` (interfaz plana que describe `room.state` sin importar clases Schema), `useRoom()`, `useServerClock(room)`

- [ ] **Step 1: Crear el paquete `client`**

`packages/client/package.json`:

```json
{
  "name": "@fut/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "colyseus.js": "0.16.22",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.3.3",
    "@types/react": "19.2.8",
    "@types/react-dom": "19.2.8",
    "@vitejs/plugin-react": "6.1.1",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3",
    "vite": "8.2.2"
  }
}
```

`packages/client/tsconfig.json` — **sin decoradores**, el cliente nunca importa clases Schema:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/client/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/silhouettes": { target: "http://localhost:2567", changeOrigin: true } },
  },
});
```

`packages/client/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subasta Futbolera</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/client/src/index.css` — los tokens de [`design-system/MASTER.md`](../../../design-system/MASTER.md) §2-§5, en la sintaxis `@theme` de Tailwind 4:

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@theme {
  --color-ink: #12100F;
  --color-green: #16C64F;
  --color-lime: #C6F833;
  --color-deep: #0B3D2E;
  --color-mute: #A8B3AD;
  --color-danger: #FF4D3D;

  --font-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --font-body: "Barlow", system-ui, sans-serif;
}

:root {
  /* Bisel de la esquina inferior derecha: la forma de marca de todo panel. */
  --clip-panel: polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%);
}

body {
  background: var(--color-deep);
  color: white;
  font-family: var(--font-body);
}

.panel {
  clip-path: var(--clip-panel);
}

/* Cifras que no bailan al cambiar: saldos, pujas, cuenta atras. */
.tnum {
  font-variant-numeric: tabular-nums;
}

:where(button, a, input, [tabindex]):focus-visible {
  outline: 3px solid var(--color-lime);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`packages/client/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```bash
pnpm install
```

- [ ] **Step 2: Escribir el tipado plano del estado**

El cliente decodifica por reflexión y **no** importa clases `Schema`. Estas interfaces describen a mano lo que llega.

`packages/client/src/net/types.ts`:

```ts
export interface PlayerView {
  playerId: string;
  name: string;
  budget: number;
  connected: boolean;
  /** Hueco -> cardId. Llega como MapSchema, se recorre con .forEach o .entries(). */
  squad: Map<string, string>;
}

export interface CardView {
  cardId: string;
  slot: string;
  silhouetteId: string;
  heightCm: number;
  foot: string;
  ageBand: string;
  continent: string;
  decade: string;
  revealed: boolean;
  /** Vacios hasta el reveal. */
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
}

export interface RevealedCardView {
  cardId: string;
  slot: string;
  silhouetteId: string;
  name: string;
  season: number;
  club: string;
  league: string;
  nation: string;
  rating: number;
  ownerId: string;
  price: number;
}

export interface StandingView {
  playerId: string;
  points: number;
  totalRating: number;
  budgetLeft: number;
  rank: number;
}

export interface ClientState {
  phase: "LOBBY" | "SETUP" | "BIDDING" | "SKIP_VOTE" | "REVEAL" | "RESULTS";
  slotIndex: number;
  currentSlot: string;
  currentCard?: CardView;
  currentBid: number;
  currentBidderId: string;
  minimumBid: number;
  endsAt: number;
  remainingCount: number;
  skipAvailable: boolean;
  skipVotes: Map<string, boolean>;
  restrictedBidders: string[];
  players: Map<string, PlayerView>;
  revealedCards: Map<string, RevealedCardView>;
  standings: StandingView[];
}
```

- [ ] **Step 3: Escribir la conexión y el reloj**

`packages/client/src/net/useRoom.ts`:

```tsx
import { Client, type Room } from "colyseus.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientState } from "./types.js";

const ENDPOINT = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

export interface Connection {
  room: Room<ClientState> | null;
  state: ClientState | null;
  error: string | null;
  join: (name: string, roomId?: string) => Promise<void>;
  send: (type: string, payload?: unknown) => void;
}

export function useRoom(): Connection {
  const clientRef = useRef<Client | null>(null);
  const [room, setRoom] = useState<Room<ClientState> | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientRef.current = new Client(ENDPOINT);
  }, []);

  const join = useCallback(async (name: string, roomId?: string) => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const joined = roomId
        ? await client.joinById<ClientState>(roomId, { name })
        : await client.joinOrCreate<ClientState>("auction", { name });

      // onStateChange dispara en cada patch: React vuelve a pintar con el objeto vivo.
      joined.onStateChange((next) => setState({ ...next } as ClientState));
      joined.onMessage("bid:rejected", (msg: { reason: string }) => setError(msg.reason));
      setRoom(joined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      room?.send(type, payload);
      setError(null);
    },
    [room],
  );

  return { room, state, error, join, send };
}
```

`packages/client/src/net/useServerClock.ts`:

```tsx
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
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - (Date.now() + offsetRef.current)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}
```

Añadir el endpoint `/time` y el servido de siluetas en el servidor. En `packages/server/src/index.ts`:

```ts
import { config } from "@colyseus/tools";
import express from "express";
import { AuctionRoom } from "./AuctionRoom.js";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("auction", AuctionRoom);
  },
  initializeExpress: (app) => {
    app.use((_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    });
    app.get("/time", (_req, res) => res.json({ now: Date.now() }));
    app.use("/silhouettes", express.static("data/silhouettes"));
  },
});
```

- [ ] **Step 4: Escribir el lobby y el `App`**

`packages/client/src/screens/Lobby.tsx`:

```tsx
import { useState } from "react";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState | null;
  onJoin: (name: string) => void;
  onReady: () => void;
}

export function Lobby({ state, onJoin, onReady }: Props) {
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  if (!state) {
    return (
      <form
        className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onJoin(name.trim());
        }}
      >
        <h1 className="font-display text-[clamp(3rem,10vw,6rem)] font-black uppercase leading-[0.85] tracking-tighter">
          <span className="text-lime">Subasta</span>
          <br />
          <span className="text-white">Futbolera</span>
        </h1>
        <label className="sr-only" htmlFor="player-name">Tu nombre</label>
        <input
          id="player-name"
          className="h-12 border-2 border-white/20 bg-ink px-3 font-display text-xl font-bold text-white"
          placeholder="Tu nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white"
        >
          Entrar
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col gap-4 p-6">
      <h2 className="font-display text-3xl font-black uppercase tracking-wide text-white">
        Sala ({state.players.size}/4)
      </h2>
      <ul className="flex flex-col gap-px bg-white/10">
        {[...state.players.values()].map((player) => (
          <li key={player.playerId} className="flex justify-between bg-ink px-4 py-3">
            <span className="font-display text-lg font-bold uppercase text-white">{player.name}</span>
            <span className="tnum font-display text-lg font-extrabold text-green">{player.budget} M</span>
          </li>
        ))}
      </ul>
      <button
        className="h-12 cursor-pointer bg-lime font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={ready}
        onClick={() => { setReady(true); onReady(); }}
      >
        {ready ? "Esperando al resto…" : "Listo"}
      </button>
    </div>
  );
}
```

`packages/client/src/App.tsx`:

```tsx
import { useRoom } from "./net/useRoom.js";
import { Lobby } from "./screens/Lobby.js";

export default function App() {
  const { state, error, join, send } = useRoom();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {error && (
        <div className="bg-red-900 px-4 py-2 text-center text-sm">{error}</div>
      )}
      {(!state || state.phase === "LOBBY") && (
        <Lobby state={state} onJoin={(name) => void join(name)} onReady={() => send("ready", {})} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verificar a mano que se conecta**

```bash
pnpm --filter @fut/server dev
```

En otra terminal:

```bash
pnpm --filter @fut/client dev
```

Abrir `http://localhost:5173` en dos pestañas, entrar con dos nombres.
Expected: cada pestaña ve a los dos jugadores con 100 M.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cliente React con conexion, lobby y reloj corregido" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Cliente — pantalla de subasta

**Files:**
- Create: `packages/client/src/screens/Auction.tsx`
- Create: `packages/client/src/components/AuctionCard.tsx`
- Create: `packages/client/src/components/ClueRow.tsx`
- Create: `packages/client/src/components/BidControls.tsx`
- Create: `packages/client/src/net/endpoints.ts`
- Modify: `packages/client/src/App.tsx`

**Interfaces:**
- Consumes: `ClientState`, `CardView`, `useServerClock` (Task 12), `design-system/MASTER.md`
- Produces: `<AuctionCard card revealed price />`, `<ClueRow card />`, `<BidControls … />`, `<Auction state myId send />`

> **Antes de escribir código, leer [`design-system/MASTER.md`](../../../design-system/MASTER.md) entero.** Esta pantalla es el producto: un gráfico de retransmisión deportiva, no un panel con acento verde. Las tres decisiones que la definen están en §1 — la silueta rompe el marco por arriba, el texto vive sobre negro y el color detrás, y la revelación es la única animación coreografiada.

- [ ] **Step 1: Escribir la tarjeta de subasta**

Es el componente de marca del proyecto. Un solo componente cubre los dos estados — oculto y revelado — porque son la misma tarjeta con distinto contenido, y hacer dos divergiría.

`packages/client/src/components/AuctionCard.tsx`:

```tsx
import { HTTP_URL } from "../net/endpoints.js";
import type { CardView } from "../net/types.js";

const SLOT_LABEL: Record<string, string> = {
  GK: "Portero", LB: "Lateral izquierdo", CB1: "Central", CB2: "Central",
  RB: "Lateral derecho", CDM: "Mediocentro defensivo", CM: "Mediocentro",
  CAM: "Mediapunta", LW: "Extremo izquierdo", ST: "Delantero", RW: "Extremo derecho",
};

interface Props {
  card: CardView;
  /** Puja vigente en millones. Se muestra en el estado oculto. */
  price: number;
}

export function AuctionCard({ card, price }: Props) {
  const revealed = card.revealed;

  return (
    <figure className="relative isolate w-full overflow-hidden bg-green" style={{ aspectRatio: "16 / 6" }}>
      {/* Cuña diagonal lima: cruza por detras de la silueta y sale del encuadre. */}
      <div
        aria-hidden
        className="absolute -right-24 top-0 h-full w-2/5 bg-lime"
        style={{ transform: "skewX(-18deg)" }}
      />
      {/* Banda inferior: ancla al jugador y evita que flote. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-deep" />

      {/* El jugador rompe el borde superior: es lo que separa el grafico deportivo
          del rectangulo generico. -top-6 con overflow-hidden lo recorta arriba. */}
      <img
        src={`${HTTP_URL}/silhouettes/${card.silhouetteId}.png`}
        alt={revealed ? `${card.name}, temporada ${card.season}` : "Silueta de un futbolista sin identificar"}
        className="absolute -top-6 right-[8%] z-10 h-[115%] w-auto object-contain object-bottom"
        style={{ filter: revealed ? "none" : "brightness(0) invert(1)" }}
      />

      {/* Panel negro: el unico soporte de texto. Nunca texto blanco sobre verde. */}
      <figcaption className="panel absolute left-0 top-[10%] z-20 max-w-[58%] bg-ink px-6 py-5 pr-14">
        {revealed ? (
          <>
            <p className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[0.85] tracking-tight text-green">
              {card.name.split(" ")[0]}
            </p>
            <p className="font-display text-[clamp(2rem,5vw,3.75rem)] font-black uppercase leading-[0.85] tracking-tight text-white">
              {card.name.split(" ").slice(1).join(" ") || card.name}
            </p>
            <p className="mt-3 inline-block bg-white px-3 py-1 font-display text-lg font-extrabold tracking-wide text-ink tnum">
              {card.season}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold uppercase leading-[0.85] tracking-tight text-white">
              Precio
            </p>
            <p className="font-display text-[clamp(3.5rem,9vw,7rem)] font-black leading-[0.8] tracking-tighter text-green tnum">
              ${price}M
            </p>
            <p className="mt-2 font-display text-[clamp(0.9rem,1.6vw,1.25rem)] font-bold uppercase tracking-[0.08em] text-lime">
              {SLOT_LABEL[card.slot] ?? card.slot}
            </p>
          </>
        )}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 2: Escribir la ficha de pistas**

`packages/client/src/components/ClueRow.tsx`:

```tsx
import type { CardView } from "../net/types.js";

const FOOT: Record<string, string> = { L: "Zurdo", R: "Diestro", B: "Ambidiestro" };
const CONTINENT: Record<string, string> = {
  EU: "Europa", SA: "Sudamérica", NA: "Norteamérica", AF: "África", AS: "Asia", OC: "Oceanía",
};

/** Las pistas son el juego: lo unico que se sabe antes de pujar. */
export function ClueRow({ card }: { card: CardView }) {
  const clues: [string, string][] = [
    ["Altura", `${card.heightCm} cm`],
    ["Pie", FOOT[card.foot] ?? card.foot],
    ["Edad", card.ageBand],
    ["Origen", CONTINENT[card.continent] ?? card.continent],
    ["Década", card.decade],
  ];

  return (
    <dl className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-5">
      {clues.map(([label, value]) => (
        <div key={label} className="bg-ink px-4 py-3">
          <dt className="font-display text-xs font-bold uppercase tracking-[0.08em] text-mute">{label}</dt>
          <dd className="font-display text-xl font-extrabold text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 3: Escribir los controles de puja**

Separados de la pantalla porque concentran las reglas de interacción de §6: objetivo táctil de 44 px, botón deshabilitado mientras el servidor no contesta, y **el error junto al campo, no en una barra global** — el mensaje tiene que estar donde está el problema.

`packages/client/src/components/BidControls.tsx`:

```tsx
import { useEffect, useState } from "react";

interface Props {
  minimumBid: number;
  disabled: boolean;
  /** Motivo del ultimo rechazo, o null. Se pinta junto al campo. */
  error: string | null;
  onBid: (amount: number) => void;
}

const REASON: Record<string, string> = {
  BID_TOO_LOW: "Esa puja no llega al mínimo.",
  OVER_BUDGET: "No puedes: te dejaría sin dinero para llenar el resto del once.",
  SLOT_ALREADY_FILLED: "Ya fichaste para este puesto.",
  NOT_ALLOWED_TO_BID: "Votaste saltar esta carta: no puedes pujar por ella.",
  AUCTION_CLOSED: "La subasta ya se cerró.",
  WRONG_PHASE: "Ahora mismo no se puede pujar.",
  DISCONNECTED: "Te desconectaste.",
  UNKNOWN_PLAYER: "No estás en esta partida.",
};

export function BidControls({ minimumBid, disabled, error, onBid }: Props) {
  const [amount, setAmount] = useState(minimumBid);
  const [pending, setPending] = useState(false);

  // El minimo sube con cada puja ajena: seguirlo mientras no se haya tocado a mano.
  useEffect(() => { setAmount((current) => (current < minimumBid ? minimumBid : current)); }, [minimumBid]);

  // El servidor contesto (aceptando o rechazando): se puede volver a pulsar.
  useEffect(() => { setPending(false); }, [minimumBid, error]);

  const submit = (value: number) => {
    if (disabled || pending) return;
    setPending(true);
    onBid(value);
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => { event.preventDefault(); submit(amount); }}
      >
        <label className="sr-only" htmlFor="bid-amount">Importe de tu puja en millones</label>
        <input
          id="bid-amount"
          type="number"
          className="tnum h-12 w-28 border-2 border-white/20 bg-ink px-3 font-display text-2xl font-extrabold text-white"
          min={minimumBid}
          step={1}
          value={amount}
          aria-invalid={error !== null}
          aria-describedby={error ? "bid-error" : undefined}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <button
          type="submit"
          disabled={disabled || pending}
          className="h-12 cursor-pointer bg-lime px-6 font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Enviando…" : "Pujar"}
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => { setAmount(minimumBid); submit(minimumBid); }}
          className="tnum h-12 cursor-pointer border-2 border-lime px-4 font-display text-lg font-bold uppercase text-lime transition-colors duration-200 hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mínimo {minimumBid} M
        </button>
      </form>

      {error && (
        <p id="bid-error" role="alert" className="font-body text-sm font-semibold text-danger">
          {REASON[error] ?? error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Escribir la pantalla de subasta**

`packages/client/src/screens/Auction.tsx`:

```tsx
import { AuctionCard } from "../components/AuctionCard.js";
import { BidControls } from "../components/BidControls.js";
import { ClueRow } from "../components/ClueRow.js";
import { useServerClock } from "../net/useServerClock.js";
import type { ClientState } from "../net/types.js";

interface Props {
  state: ClientState;
  myId: string;
  error: string | null;
  send: (type: string, payload?: unknown) => void;
}

export function Auction({ state, myId, error, send }: Props) {
  const remaining = useServerClock(state.endsAt);
  const me = state.players.get(myId);
  const card = state.currentCard;

  const alreadySigned = me?.squad.has(state.currentSlot) ?? false;
  const restricted = state.restrictedBidders.length > 0 && !state.restrictedBidders.includes(myId);
  const canBid = state.phase === "BIDDING" && !alreadySigned && !restricted;
  const urgent = remaining < 5000 && state.phase === "BIDDING";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      {card && <AuctionCard card={card} price={state.currentBid || state.minimumBid} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {card && <ClueRow card={card} />}

          <div className="panel flex flex-wrap items-baseline gap-x-6 gap-y-2 bg-ink px-6 py-4 pr-12">
            <p
              className={`tnum font-display text-5xl font-black leading-none ${urgent ? "animate-pulse text-danger" : "text-lime"}`}
              aria-live="off"
            >
              {(remaining / 1000).toFixed(1)}s
            </p>
            <p className="font-display text-xl font-bold uppercase tracking-wide text-white">
              {state.currentBid > 0 ? (
                <>
                  <span className="tnum text-green">{state.currentBid} M</span>{" "}
                  <span className="text-mute">va ganando</span>{" "}
                  {state.players.get(state.currentBidderId)?.name}
                </>
              ) : (
                <span className="text-mute">Nadie ha pujado todavía</span>
              )}
            </p>
            <p className="ml-auto font-body text-sm text-mute">
              Quedan {state.remainingCount} cartas en este puesto
            </p>
          </div>

          {state.phase === "SKIP_VOTE" ? (
            <div className="flex flex-col gap-2">
              <p className="font-display text-lg font-bold uppercase tracking-wide text-white">
                Nadie pujó. ¿Se descarta esta carta?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => send("voteSkip", { skip: true })}
                  className="h-12 cursor-pointer bg-lime px-6 font-display text-xl font-black uppercase text-ink transition-colors duration-200 hover:bg-white"
                >
                  Saltarla
                </button>
                <button
                  onClick={() => send("voteSkip", { skip: false })}
                  className="h-12 cursor-pointer border-2 border-white/30 px-6 font-display text-xl font-bold uppercase text-white transition-colors duration-200 hover:border-white"
                >
                  La quiero
                </button>
              </div>
              <p className="font-body text-sm text-mute">
                Hace falta unanimidad. Si dices que la quieres, serás el único que pueda pujar por ella.
              </p>
            </div>
          ) : (
            <BidControls
              minimumBid={state.minimumBid}
              disabled={!canBid}
              error={error}
              onBid={(amount) => send("bid", { amount })}
            />
          )}

          {alreadySigned && (
            <p className="font-body text-sm text-mute">Ya fichaste para este puesto. Mira cómo se pelean los demás.</p>
          )}
        </div>

        <ul className="flex flex-col gap-px bg-white/10">
          {[...state.players.values()].map((player) => {
            const leading = player.playerId === state.currentBidderId;
            return (
              <li
                key={player.playerId}
                className={`flex items-center justify-between px-4 py-3 ${leading ? "bg-lime text-ink" : "bg-ink text-white"}`}
              >
                <span className="font-display text-lg font-bold uppercase">
                  {player.name}
                  {/* El color no es el unico indicador: tambien va la etiqueta. */}
                  {leading && <span className="ml-2 text-xs font-black tracking-widest">GANANDO</span>}
                  {!player.connected && <span className="ml-2 text-xs font-bold text-danger">SIN CONEXIÓN</span>}
                </span>
                <span className={`tnum font-display text-lg font-extrabold ${leading ? "text-ink" : "text-green"}`}>
                  {player.budget}M · {player.squad.size}/11
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Escribir `endpoints.ts` y enrutar en `App.tsx`**

`packages/client/src/net/endpoints.ts` — un único sitio decide las URLs, para que la Task 16 no tenga que tocar tres ficheros:

```ts
const isProd = import.meta.env.PROD;

/** En produccion el cliente se sirve desde el propio servidor: mismo origen. */
export const HTTP_URL = isProd ? window.location.origin : "http://localhost:2567";

export const WS_URL = isProd
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
  : "ws://localhost:2567";
```

Sustituir en `useRoom.ts` y `useServerClock.ts` los `import.meta.env.VITE_*` por `WS_URL` / `HTTP_URL` importados de aquí.

`packages/client/src/App.tsx`:

```tsx
import { Auction } from "./screens/Auction.js";
import { useRoom } from "./net/useRoom.js";
import { Lobby } from "./screens/Lobby.js";

export default function App() {
  const { room, state, error, join, send } = useRoom();
  const inGame = state && state.phase !== "LOBBY";

  return (
    <main className="min-h-screen bg-deep text-white">
      {!inGame && (
        <Lobby state={state} onJoin={(name) => void join(name)} onReady={() => send("ready", {})} />
      )}
      {/* El error de puja NO se pinta aqui: viaja hasta BidControls y sale
          junto al campo del importe, que es donde esta el problema. */}
      {inGame && room && state.phase !== "RESULTS" && (
        <Auction state={state} myId={room.sessionId} error={error} send={send} />
      )}
    </main>
  );
}
```

- [ ] **Step 6: Verificar contra el sistema de diseño**

Arrancar servidor y cliente, abrir 4 pestañas, entrar con 4 nombres, pulsar Listo en las 4.

Comprobar, además de que funciona:

- La silueta **rompe el borde superior** de la tarjeta, no queda contenida dentro.
- No hay **ni un solo texto blanco sobre verde**. Buscar en el DOM: si aparece, arreglarlo.
- La cuenta atrás y los saldos usan cifras tabulares: los números **no se mueven** al cambiar.
- Rechazar una puja a propósito (pujar 1 M): el mensaje sale **junto al campo**, en castellano, no un código como `BID_TOO_LOW`.
- Con `prefers-reduced-motion: reduce` activado en el navegador, la partida sigue siendo jugable y el pulso del reloj desaparece.
- A 375 px de ancho no hay desplazamiento horizontal.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: pantalla de subasta con silueta, pistas y puja" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Cliente — reveal y resultados

**Files:**
- Create: `packages/client/src/screens/Results.tsx`
- Create: `packages/client/src/components/RevealBar.tsx`
- Create: `packages/client/src/components/SquadGrid.tsx`
- Modify: `packages/client/src/App.tsx`, `packages/client/src/screens/Auction.tsx`

**Interfaces:**
- Consumes: `ClientState`, `RevealedCardView`, `StandingView` (Task 12), `<AuctionCard>` (Task 13)
- Produces: `<RevealBar card state />`, `<SquadGrid player revealedCards wonSlots />`, `<Results state />`

> Leer [`design-system/MASTER.md`](../../../design-system/MASTER.md) §5. **La revelación es el único momento coreografiado del juego**: la silueta cruza a foto en 450 ms y el nombre entra 150 ms después. `<AuctionCard>` ya cambia solo al llegar `card.revealed`; esta tarea añade la transición y el veredicto debajo.

- [ ] **Step 1: Escribir la barra de revelación**

La tarjeta ya muestra nombre y temporada al revelarse. Esta barra añade lo que la tarjeta no cabe: club, liga, rating y quién se lo llevó.

`packages/client/src/components/RevealBar.tsx`:

```tsx
import type { CardView, ClientState } from "../net/types.js";

interface Props {
  card: CardView;
  state: ClientState;
}

export function RevealBar({ card, state }: Props) {
  const revealed = state.revealedCards.get(card.cardId);
  if (!revealed) return null;

  const owner = revealed.ownerId ? state.players.get(revealed.ownerId)?.name : null;

  return (
    <div className="panel flex flex-wrap items-center gap-x-8 gap-y-3 bg-ink px-6 py-4 pr-12">
      <p className="tnum font-display text-6xl font-black leading-none text-lime">{revealed.rating}</p>

      <div>
        <p className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
          {revealed.club}
        </p>
        <p className="font-body text-sm text-mute">
          {revealed.league} · {revealed.nation} · temporada {revealed.season}
        </p>
      </div>

      <p className="ml-auto font-display text-xl font-bold uppercase tracking-wide">
        {owner ? (
          <>
            <span className="text-mute">Para</span> <span className="text-green">{owner}</span>{" "}
            <span className="tnum text-white">{revealed.price} M</span>
          </>
        ) : (
          <span className="text-mute">Descartado: nadie lo quiso</span>
        )}
      </p>
    </div>
  );
}
```

Añadir la transición de la revelación al `<img>` de `AuctionCard.tsx`, sustituyendo su `style` por:

```tsx
        style={{
          filter: revealed ? "none" : "brightness(0) invert(1)",
          transition: "filter 450ms cubic-bezier(.16,1,.3,1)",
        }}
```

Y el nombre entra desde la izquierda 150 ms después, con una animación declarada en `index.css`:

```css
@keyframes reveal-in {
  from { opacity: 0; transform: translateX(-1.5rem); }
  to   { opacity: 1; transform: translateX(0); }
}

.reveal-in {
  animation: reveal-in 450ms cubic-bezier(.16, 1, .3, 1) 150ms both;
}
```

En `AuctionCard.tsx`, la rama revelada del `<figcaption>` envuelve su contenido en `<div className="reveal-in">`. Son los dos únicos elementos animados de la vista, que es el presupuesto que fija §5. El bloque `prefers-reduced-motion` de `index.css` ya reduce ambos a duración cero: la revelación sigue ocurriendo, simplemente sin cruce.

- [ ] **Step 2: Escribir la plantilla y los resultados**

`packages/client/src/components/SquadGrid.tsx`:

```tsx
import type { PlayerView, RevealedCardView } from "../net/types.js";

const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

interface Props {
  player: PlayerView;
  revealedCards: Map<string, RevealedCardView>;
  /** Huecos en los que este jugador tiene el mejor rating de la sala. */
  wonSlots?: Set<string>;
}

export function SquadGrid({ player, revealedCards, wonSlots }: Props) {
  return (
    <table className="w-full font-body text-sm">
      <caption className="sr-only">Plantilla de {player.name}. Las filas marcadas ganan el puesto.</caption>
      <tbody>
        {SLOTS.map((slot) => {
          const cardId = player.squad.get(slot);
          const card = cardId ? revealedCards.get(cardId) : undefined;
          const won = wonSlots?.has(slot) ?? false;
          return (
            <tr key={slot} className={won ? "bg-lime text-ink" : "text-white"}>
              <td className="py-1 pl-2 pr-3 font-display font-bold uppercase opacity-70">{slot}</td>
              <td className="py-1">
                {card ? `${card.name} ${card.season}` : "—"}
                {/* El color no basta como indicador: la fila ganadora se dice tambien. */}
                {won && <span className="sr-only"> (gana el puesto)</span>}
              </td>
              <td className={`tnum py-1 pr-2 text-right font-display text-lg font-black ${won ? "text-ink" : "text-green"}`}>
                {card?.rating ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

`packages/client/src/screens/Results.tsx`:

```tsx
import { SquadGrid } from "../components/SquadGrid.js";
import type { ClientState } from "../net/types.js";

const SLOTS = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

/** Recalcula, solo para pintar, que huecos gano cada jugador. */
function wonSlotsByPlayer(state: ClientState): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const player of state.players.values()) result.set(player.playerId, new Set());

  for (const slot of SLOTS) {
    const holders = [...state.players.values()]
      .map((p) => ({ id: p.playerId, card: p.squad.get(slot) }))
      .filter((h): h is { id: string; card: string } => h.card !== undefined)
      .map((h) => ({ id: h.id, rating: state.revealedCards.get(h.card)?.rating ?? -1 }));

    if (holders.length === 0) continue;
    const best = Math.max(...holders.map((h) => h.rating));
    for (const holder of holders) {
      if (holder.rating === best) result.get(holder.id)?.add(slot);
    }
  }
  return result;
}

export function Results({ state }: { state: ClientState }) {
  const won = wonSlotsByPlayer(state);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-6 font-display text-[clamp(2.5rem,7vw,5rem)] font-black uppercase leading-none tracking-tighter text-lime">
        Resultados
      </h1>

      <ol className="mb-10 flex flex-col gap-px bg-white/10">
        {state.standings.map((row) => {
          const champion = row.rank === 1;
          return (
            <li
              key={row.playerId}
              className={`flex flex-wrap items-baseline gap-x-4 px-5 py-4 ${champion ? "bg-green text-ink" : "bg-ink text-white"}`}
            >
              <span className="font-display text-3xl font-black tnum">{row.rank}</span>
              <span className="font-display text-2xl font-extrabold uppercase tracking-wide">
                {state.players.get(row.playerId)?.name}
              </span>
              <span className={`tnum ml-auto font-display text-3xl font-black ${champion ? "text-ink" : "text-lime"}`}>
                {row.points} pts
              </span>
              <span className={`tnum w-full font-body text-sm ${champion ? "text-ink/70" : "text-mute"}`}>
                rating total {row.totalRating} · {row.budgetLeft} M sin gastar
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...state.players.values()].map((player) => (
          <div key={player.playerId} className="panel bg-ink p-3 pb-8">
            <h2 className="mb-3 font-display text-xl font-extrabold uppercase tracking-wide text-green">
              {player.name}
            </h2>
            <SquadGrid
              player={player}
              revealedCards={state.revealedCards}
              wonSlots={won.get(player.playerId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Enrutar en `App.tsx` y montar el reveal en `Auction.tsx`**

En `App.tsx`, añadir:

```tsx
import { Results } from "./screens/Results.js";
```

y la rama:

```tsx
      {inGame && state.phase === "RESULTS" && <Results state={state} />}
```

En `Auction.tsx`, añadir el import:

```tsx
import { RevealBar } from "../components/RevealBar.js";
```

y sustituir la línea `{card && <ClueRow card={card} />}` por el intercambio entre pistas y veredicto — durante el reveal las pistas ya no sirven, la respuesta está delante:

```tsx
          {card && (state.phase === "REVEAL"
            ? <RevealBar card={card} state={state} />
            : <ClueRow card={card} />)}
```

- [ ] **Step 4: Verificar a mano una partida completa**

Arrancar servidor y cliente, 4 pestañas, jugar los 11 huecos pujando el mínimo.
Expected: cada adjudicación muestra nombre, temporada, club y rating; al final aparece la clasificación con los huecos ganados resaltados en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: reveal de carta y pantalla de resultados" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: E2E con cuatro navegadores

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/full-match.spec.ts`
- Modify: `package.json` (raíz): scripts `e2e`, `dev`

**Interfaces:**
- Consumes: servidor y cliente completos (Tasks 11, 14)
- Produces: suite E2E que abre 4 contextos de navegador y juega una partida

- [ ] **Step 1: Instalar Playwright**

```bash
pnpm add -Dw @playwright/test@1.62.1 concurrently
pnpm exec playwright install chromium
```

Scripts en el `package.json` raíz:

```json
"dev": "concurrently -n server,client \"pnpm --filter @fut/server dev\" \"pnpm --filter @fut/client dev\"",
"e2e": "playwright test"
```

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Escribir el test que falla**

`e2e/full-match.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const NAMES = ["Ana", "Bea", "Cid", "Dan"];

test("cuatro jugadores completan una partida entera", async ({ browser }) => {
  const contexts = await Promise.all(NAMES.map(() => browser.newContext()));
  const pages: Page[] = await Promise.all(contexts.map((c) => c.newPage()));

  // Entrar
  for (const [i, page] of pages.entries()) {
    await page.goto("/");
    await page.getByPlaceholder("Tu nombre").fill(NAMES[i]!);
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  // Todos ven a los cuatro
  await expect(pages[0]!.getByText("Sala (4/4)")).toBeVisible();

  // Listos
  for (const page of pages) await page.getByRole("button", { name: "Listo" }).click();

  // Arranca la subasta del portero: silueta oculta y precio en la tarjeta
  await expect(pages[0]!.getByAltText("Silueta de un futbolista sin identificar")).toBeVisible();
  await expect(pages[0]!.getByText("Precio")).toBeVisible();
  await expect(pages[0]!.getByText("Portero")).toBeVisible();

  // Once huecos, cuatro fichajes cada uno: cada jugador puja el minimo por turnos
  for (let slot = 0; slot < 11; slot++) {
    for (const page of pages) {
      const button = page.getByRole("button", { name: /^Mínimo/ });
      await expect(button).toBeEnabled();
      await button.click();
      // El anti-snipe deja 6 s; se espera al reveal y al siguiente candidato
      await expect(page.getByText(/Para |Descartado/)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Para |Descartado/)).toBeHidden({ timeout: 20_000 });
    }
  }

  // Resultados
  for (const page of pages) {
    await expect(page.getByRole("heading", { name: "Resultados" })).toBeVisible();
    await expect(page.getByText("1.")).toBeVisible();
  }

  // Ninguna plantilla tiene huecos vacios
  for (const page of pages) {
    await expect(page.getByText("—")).toHaveCount(0);
  }

  await Promise.all(contexts.map((c) => c.close()));
});
```

- [ ] **Step 3: Ejecutar el test y verificar que falla o pasa**

Run: `pnpm e2e`
Expected: PASS. Si el paso de la puja se agota por tiempo, es señal de que la UI no habilita el botón para el jugador al que le toca — corregir la condición `canBid` en `Auction.tsx`, no el test.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: E2E de partida completa con cuatro navegadores" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Despliegue

**Files:**
- Create: `Dockerfile`
- Create: `fly.toml`
- Create: `.dockerignore`
- Modify: `packages/client/vite.config.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: imagen que sirve el servidor de Colyseus y el cliente compilado desde el mismo proceso

- [ ] **Step 1: Servir el cliente compilado desde el servidor**

En `packages/server/src/index.ts`, dentro de `initializeExpress`, añadir al final:

```ts
    // En produccion el cliente compilado se sirve desde el mismo proceso:
    // asi el WebSocket y la pagina comparten origen y no hace falta CORS.
    if (process.env.NODE_ENV === "production") {
      app.use(express.static("packages/client/dist"));
      app.get("/{*splat}", (_req, res) => res.sendFile("index.html", { root: "packages/client/dist" }));
    }
```

`packages/client/src/net/endpoints.ts` ya se escribió en la Task 13 y resuelve las URLs al propio origen cuando `import.meta.env.PROD` es cierto, así que el cliente no necesita ningún cambio aquí. Verificar solamente que ningún fichero conserva un `import.meta.env.VITE_` suelto:

```bash
grep -rn "import.meta.env.VITE_" packages/client/src || echo "limpio"
```

- [ ] **Step 2: Escribir el Dockerfile**

`.dockerignore`:

```
node_modules
**/node_modules
**/dist
.git
test-results
playwright-report
```

`Dockerfile`:

```dockerfile
FROM node:26-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @fut/client build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
EXPOSE 2567
CMD ["pnpm", "--filter", "@fut/server", "start"]
```

`fly.toml`:

```toml
app = "fut-subasta"
primary_region = "mad"

[build]

[http_service]
  internal_port = 2567
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

> El estado de partida vive en memoria: **una sola máquina**. Con varias, dos jugadores pueden aterrizar en procesos distintos y no verse. Escalar horizontalmente exige el driver de Redis de Colyseus, que queda fuera de este plan.

- [ ] **Step 3: Verificar el build de producción en local**

```bash
docker build -t fut .
docker run --rm -p 2567:2567 fut
```

Abrir `http://localhost:2567` en dos pestañas.
Expected: la página carga desde el propio servidor, las dos pestañas se ven en la sala, y las siluetas se muestran.

- [ ] **Step 4: Escribir el README**

`README.md`:

```markdown
# Subasta Futbolera

Juego de navegador para 4 jugadores: pujan por futbolistas ocultos tras siluetas
y arman un 11 inicial. Al cerrarse cada puja se revela quién es y **de qué
temporada**. Gana quien tenga el mejor rating en más posiciones.

## Arrancar en local

```bash
pnpm install
pnpm silhouettes:build   # genera data/silhouettes desde data/sources.json
pnpm dataset:check       # valida data/players.json y avisa de huecos flacos
pnpm dev                 # servidor en :2567, cliente en :5173
```

## Pruebas

```bash
pnpm -r test   # unitarias e integración
pnpm e2e       # partida completa en cuatro navegadores
```

## Versiones fijadas

Colyseus se queda en la **línea 0.16**. Las líneas 0.17 y 0.18 del servidor no
tienen cliente JS publicado: `colyseus.js@0.16.22` depende de
`@colyseus/schema@^3`, mientras que el core 0.18 exige `^5`. Formatos de
codificación distintos — el cliente no podría decodificar el estado.

TypeScript se queda en 6.x por los decoradores legados de `@colyseus/schema@3`.

## Despliegue

Una sola máquina: el estado de partida vive en memoria. Escalar
horizontalmente exigiría el driver de Redis de Colyseus.

```bash
fly deploy
```

## Datos y licencias

Las siluetas se generan a partir de fotos de Wikimedia Commons con licencia
libre. La atribución de cada imagen está en `data/attributions.json`.

Los nombres e imágenes de futbolistas reales están licenciados. Este proyecto
es privado. Antes de abrirlo al público o monetizarlo hay que revisarlo.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: despliegue en Fly.io sirviendo cliente y servidor juntos" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Cobertura del spec

| Sección del spec | Tarea |
|---|---|
| §3.1 Formación | 1 (`SLOTS`) |
| §3.2 Economía y presupuesto bloqueado | 1 (`reservedBudget`, `maxBid`), 2 (`canBid`) |
| §3.3 Ronda de posición, carta sobrante sin revelar | 8 (`drawRound`), 10 (`advance`) |
| §3.4 Subasta, anti-snipe, rechazos, sorteo sin margen | 2, 4, 9 |
| §3.5 Votación de salto, margen, reanudación restringida | 3, 10 |
| §3.6 Puntuación y desempates | 5, 11 |
| §4.1 Carta y campos públicos/privados | 6 (`toPublic`, `toPrivate`) |
| §4.2 Dataset y variedad mínima | 6 (`parseDataset`, `dataset:check`) |
| §4.3 Siluetas y atribución | 7 |
| §4.4 Aviso legal | 16 (README) |
| §5.1 `shared/` puro | 1-6 |
| §5.2 Separación público/privado en el Schema | 8 (`schema.ts`, `project.ts`), 10 (`enterReveal`) |
| §5.3 Cliente solo dibuja, reloj corregido | 12, 13, 14 |
| §5.4 Máquina de estados | 8-11 |
| §5.5 Sin persistencia, dataset validado al arrancar | 8 |
| §5.6 Despliegue | 16 |
| §6 Errores y bordes | 9 (`bid:rejected`), 11 (`allowReconnection`) |
| §7 Pruebas y la invariante | 1-11, 15 |

## Desviaciones del spec, deliberadas

**No hay anfitrión, así que no hay migración de anfitrión.** El spec §6 preveía que el anfitrión migrase al siguiente jugador conectado. El plan arranca la partida cuando **todos** pulsan Listo, no cuando un anfitrión decide, así que el rol no existe y no hay nada que migrar. Un jugador que se va antes del arranque deja de contar para el recuento de listos porque `onLeave` lo marca desconectado. Menos estado, menos bordes.

**La sala se destruye sola.** El spec §6 pedía destruirla cuando se van todos; Colyseus ya lo hace con `autoDispose`, que viene activado por defecto. No hace falta código.

## Trabajo de datos que el plan no puede escribir por ti

Dos ficheros son contenido, no programación, y las tareas los dejan planteados pero vacíos:

- **`data/players.json`** (Task 6): las 55 cartas semilla — 5 por cada uno de los 11 huecos — hay que escribirlas con nombres, temporadas y ratings reales. El formato está fijado y `pnpm dataset:check` verifica que no falte ninguno, pero los datos son curación humana. Es también donde se decide el juego: emparejar pico y declive del mismo futbolista es lo que produce el troleo.
- **`data/sources.json`** (Task 7): la URL del ejemplo lleva puntos suspensivos a propósito. Cada entrada necesita la URL real del fichero en Wikimedia Commons, su autor y su licencia. `pnpm silhouettes:build` falla con el código HTTP si una URL no resuelve.

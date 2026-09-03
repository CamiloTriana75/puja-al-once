# Subasta Futbolera — Diseño

Fecha: 2026-09-02
Estado: aprobado, pendiente de plan de implementación

## 1. Qué es

Juego de navegador para 4 jugadores en sala privada. Cada jugador arma un 11 inicial
pujando por futbolistas cuya identidad está oculta tras una silueta. Al cerrarse cada
puja se revela quién es y **de qué temporada**, que es donde vive la gracia: podés ganar
la subasta de Ronaldinho y descubrir que es el Ronaldinho de 2015 en Fluminense.

Cuando los cuatro equipos están completos se comparan posición contra posición. Un punto
para el mejor rating de cada una. Once puntos en juego.

## 2. Decisiones tomadas

| Decisión | Valor | Por qué |
|---|---|---|
| Alcance v1 | Salas privadas, sin cuentas | Lo más rápido a algo jugable; la arquitectura no bloquea añadir cuentas después |
| Ganador | 1 punto al mejor rating por posición | Ganar por 1 vale igual que ganar por 20, así que pagar de más deja de ser rentable |
| Candidatos por posición | jugadores + 1 | Siempre sobra uno: hay descarte real, nadie tiene fichaje garantizado gratis |
| Salto de candidato | Unánime y solo con margen | Permite descartar basura sin dejar a nadie con un hueco imposible de llenar |
| Precio base | Fijo, sin relación con el rating | Un precio que escale con el rating revela el rating y mata el juego |
| Stack | Colyseus + React/Vite/Tailwind | Salas, sync de estado, reloj autoritativo y reconexión ya resueltos |
| Autoridad | Servidor, siempre | Timer y saldo en el cliente = trampas el primer día |

## 3. Reglas del juego

### 3.1 Formación

Los once huecos son idénticos para todos, porque la puntuación compara hueco contra
hueco. 4-3-3 con etiquetas distintas:

```
GK · LB · CB1 · CB2 · RB · CDM · CM · CAM · LW · ST · RW
```

### 3.2 Economía

| Parámetro | Valor inicial |
|---|---|
| Presupuesto por jugador | 100 M |
| Precio base de cualquier candidato | 2 M |
| Incremento mínimo de puja | 1 M |
| Presupuesto bloqueado | `posiciones_que_te_faltan × 2 M` |

Todos son ajustables tras las primeras partidas de prueba. Con 11 huecos, el gasto
forzado mínimo es 22 M y quedan 78 M discrecionales.

El **presupuesto bloqueado** es la regla que impide inhabilitarse: no podés pujar un
importe que deje tu saldo por debajo de lo que necesitás para llenar los huecos que te
faltan. Sin ella, alguien funde el presupuesto en tres fichajes y pasa ocho rondas
mirando.

### 3.3 Ronda de posición

Once rondas, una por posición, en el orden fijo de la formación.

Al empezar cada ronda el servidor toma `jugadores_activos + 1` cartas del mazo de esa
posición y las baraja. Los candidatos salen a subasta de uno en uno hasta que los cuatro
jugadores han fichado para esa posición. La carta que sobre al cerrarse la ronda se
descarta sin revelarse: nadie llega a saber quién era, y eso alimenta la duda sobre si
saltar fue buena idea.

### 3.4 Subasta de un candidato

1. Sale la silueta con sus pistas públicas. Precio base 2 M. Timer a 15 s.
2. Cada puja válida se acepta y empuja el cierre a `ahora + 6 s`. Eso es el anti-snipe:
   pujar en el último segundo no cierra la subasta, la alarga.
3. Si el timer llega a cero con al menos una puja, se adjudica al mejor postor.
4. Si llega a cero sin ninguna puja, hay dos caminos según §3.5:
   - **con margen de salto** — se abre la votación de salto
   - **sin margen** — la carta se **adjudica por sorteo** a precio base entre los
     jugadores que aún necesitan esa posición
5. Adjudicado o descartado, se revela la carta durante 6 s y sale el siguiente candidato.

El sorteo del caso sin margen es lo que impide el bloqueo: cuando quedan tantas cartas
como jugadores por fichar, cada carta tiene que acabar en algún equipo sí o sí, y sin
esta regla una ronda en la que nadie puja no puede avanzar. Que sea sorteo y no orden
fijo evita que alguien lo pueda calcular y esperar a propósito.

Una puja se **rechaza** si, evaluada con la hora del servidor al entrar al handler:

- la fase no es `BIDDING`
- `ahora > auctionEndsAt` — atrapa el mensaje que llega justo en el límite del timer
- el importe no supera la puja actual más el incremento mínimo
- el importe excede `saldo − bloqueado`
- el jugador ya tiene fichado ese hueco

El rechazo devuelve el motivo al que pujó y no toca el estado de la sala.

### 3.5 Votación de salto

Solo se ofrece si
`candidatos_restantes > jugadores_activos_que_aún_necesitan_esta_posición`.

Cuando el margen se agota, el botón desaparece y hay que pujar: es lo que garantiza que
nadie termine con un hueco vacío por culpa de las reglas.

El voto dura 10 s y necesita unanimidad de los jugadores activos que aún necesitan la
posición.

Si el voto **falla**, la subasta se reanuda a precio base pero **solo pueden pujar los
que votaron en contra de saltar** — votaste que lo querías, pujá. Si aun así nadie puja,
la carta se descarta automáticamente. Esto cierra el bucle: ninguna carta puede quedar
en limbo indefinidamente.

### 3.6 Puntuación

Al completarse las once rondas se revelan los cuatro equipos y se compara hueco por
hueco. **Un punto para el rating más alto de cada posición.** Once puntos en total.

Si dos jugadores empatan en rating en una posición, el punto se reparte entre los
empatados.

Desempate del total, en orden:

1. Suma de todos los ratings del once
2. Presupuesto sin gastar
3. Empate declarado

## 4. Datos

### 4.1 La carta

```
id, name, season, club, league, nation, position,
rating, heightCm, foot, ageAtSeason, silhouetteId
```

| Campo | Durante la puja | Tras el reveal |
|---|---|---|
| Silueta, posición, altura, pie, década, continente | visible | — |
| Nombre, temporada, club, liga, nación, rating | oculto | visible |

`ageBand`, `decade` y `continent` son campos derivados que se calculan al cargar el
dataset: agrupar la edad y el año en rangos da pista sin dar la respuesta.

### 4.2 El dataset

Curado a mano: alrededor de 250 futbolistas con 2 o 3 temporadas cada uno — pico,
declive y retiro — dando unas 600 cartas. La curación **es** el diseño del juego: es lo
que garantiza que el Ronaldinho de 2015 esté en el mazo junto al de 2006.

Requisito de variedad: mínimo 30 cartas por hueco de la formación, para que dos partidas
seguidas no repitan candidatos.

Fuente de ratings por temporada: datasets públicos de FIFA/sofifa, que dan valoración
por año. Es exactamente el "buen momento contra retirado" que el juego necesita, y que
las APIs de fútbol normales no tienen.

### 4.3 Siluetas

Pipeline **offline**, no en tiempo de ejecución. `tools/build-silhouettes.ts`:

1. Descarga la foto desde Wikimedia Commons (CC-BY, CC-BY-SA o dominio público)
2. Recorta el fondo
3. Umbral a negro sólido sobre transparente
4. Normaliza a altura fija y escribe el PNG en `data/silhouettes/`

La atribución de licencia de cada imagen se guarda en `data/attributions.json` y se
muestra en un aviso dentro del juego.

Que algunas siluetas sean reconocibles no rompe nada: aunque identifiques a Ronaldinho,
seguís sin saber **qué** Ronaldinho es. La temporada es la variable oculta de verdad.

### 4.4 Aviso legal

Nombres e imágenes de futbolistas reales están licenciados. Para un proyecto privado el
riesgo es bajo. Antes de abrir al público o monetizar hay que revisarlo: probablemente
implique sustituir las siluetas por arte propio y los nombres por alias.

## 5. Arquitectura

```
fut/
├─ packages/
│  ├─ shared/    reglas puras + tipos
│  ├─ server/    sala de Colyseus, carga de dataset
│  └─ client/    React + Vite + Tailwind
├─ data/
│  ├─ players.json
│  ├─ attributions.json
│  └─ silhouettes/
└─ tools/
   └─ build-silhouettes.ts
```

Monorepo con workspaces de pnpm. TypeScript en los tres paquetes.

### 5.1 `shared/` — las reglas, aisladas

Funciones puras. Sin Colyseus, sin sockets, sin React, sin reloj propio: el tiempo entra
como parámetro.

```ts
canBid(state, playerId, amount, now): Result<void, BidError>
skipAllowed(state): boolean
resolveAuction(state, now): AuctionOutcome
resolveSkipVote(state): SkipOutcome
scoreMatch(squads): Standings
lockedBudget(player, state): number
```

Es donde vive todo lo que puede estar mal, y se prueba en milisegundos sin levantar
nada. El servidor las llama; no las contiene.

### 5.2 `server/` — la sala

Una `Room` de Colyseus por partida. Responsabilidades: ciclo de vida de la sala,
traducir mensajes a llamadas de `shared/`, poseer el reloj, y decidir qué se publica.

**Separación de estado público y privado.** Colyseus sincroniza el `Schema` entero al
cliente automáticamente. Si la carta completa entra en el estado, el rating y el nombre
viajan al navegador y se leen en DevTools aunque no se pinten.

```ts
// Schema sincronizado — solo lo público
class PublicCard extends Schema {
  silhouetteId, position, heightCm, foot, ageBand, continent, decade
}

// Fuera del Schema, solo en memoria del servidor
privateCards: Map<cardId, { name, season, club, league, nation, rating }>
```

El reveal es el momento en que el servidor decide copiar los campos privados al estado
público. Antes de eso no existen para el cliente.

### 5.3 `client/` — solo dibuja

React + Vite + Tailwind. Se suscribe al estado de la sala y lo pinta. Manda tres
mensajes: `bid`, `voteSkip`, `ready`.

La cuenta atrás se dibuja desde `auctionEndsAt` con corrección del desfase de reloj
medido en el handshake. Es decoración: no decide nada, y si el navegador va adelantado o
atrasado el resultado no cambia.

### 5.4 Máquina de estados

```
LOBBY → SETUP → ┌─ BIDDING ⇄ SKIP_VOTE ─┐ → RESULTS
                └──── REVEAL ←──────────┘
                  (× 11 posiciones)
```

### 5.5 Persistencia

Ninguna en v1. El estado de partida vive en memoria de la sala. `players.json` se carga
al arrancar el proceso y se valida contra el esquema — si el dataset está mal, el
servidor no arranca.

### 5.6 Despliegue

Fly.io o Railway: hace falta un proceso persistente para los WebSockets. Vercel no sirve
para el servidor; el cliente estático puede ir donde sea.

## 6. Errores y bordes

| Situación | Qué pasa |
|---|---|
| Puja inválida | Se rechaza con motivo, el estado no se toca |
| Jugador se desconecta | `allowReconnection` 60 s; mientras, la partida sigue sin él |
| No vuelve | Sus huecos quedan vacíos y suman 0 puntos |
| El anfitrión se va | El anfitrión migra al siguiente jugador conectado |
| Todos se desconectan | La sala se destruye tras el margen de reconexión |
| Dataset inválido al arrancar | El proceso falla inmediatamente, con el error de validación |

Borde que se escapa fácil: `skipAllowed` debe contar **solo jugadores activos**. Si
cuenta a los desconectados, alguien que se fue bloquea el botón de saltar para el resto
de la partida.

## 7. Pruebas

**Unitarias sobre `shared/`** — el grueso, sin servidor ni navegador:

- presupuesto bloqueado, incluido el caso de la última posición
- `skipAllowed` justo en el borde donde debe desactivarse
- rechazo de puja tardía con `now` pasado el cierre
- anti-snipe: una puja válida empuja el cierre
- votación de salto fallida y su reanudación restringida
- cero pujas sin margen de salto: adjudicación por sorteo, la ronda avanza
- puntuación con empate de rating en una posición
- la cadena completa de desempates

**Integración** con clientes de prueba de Colyseus: una partida entera de 4 jugadores,
más un caso de desconexión y reconexión a mitad de subasta.

**E2E** con Playwright y 4 contextos de navegador: humo de una partida completa.

**Invariante con test propio**, porque es la que justifica media reglamentación:

> Ningún jugador puede terminar con un hueco sin llenar por culpa de las reglas.
> Solo por desconexión.

El presupuesto bloqueado y el margen de salto existen exactamente para garantizarlo.

## 8. Fuera de alcance en v1

Cuentas y autenticación. Ranking e historial. Chat. Partidas de un tamaño distinto de 4
jugadores. Formaciones alternativas. Modo espectador. Sonido y animaciones más allá de
lo mínimo del reveal.

La arquitectura no los estorba — Colyseus ya trae matchmaker, y las reglas viven aisladas
en `shared/` sin saber de sockets — pero no entran en este spec.

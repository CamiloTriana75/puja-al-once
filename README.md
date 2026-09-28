# Subasta Futbolera

Juego de subastas para 2-4 jugadores (el lobby tambien deja empezar solo, util
para probar una partida rapido). Cada ronda sale la foto recortada de un
futbolista y hay que pujar por el. Gana quien mejor complete el once al final, y el
dinero es el limite: no se pueden comprar los once iconos.

El mazo son 110 cartas reales (10 por puesto de una formacion 4-3-3), cada una
con su temporada, su valoracion y su precio de salida. El resto se descubre
pujando.

## Como se juega

1. Alguien crea una sala y comparte el codigo, o se entra en una publica desde
   el vestuario.
2. Todos pulsan Listo y arranca la partida.
3. **11 rondas**, una por puesto, en orden: portero, laterales, centrales,
   pivote, centrocampistas, mediapunta, extremos y delantero.
4. En cada ronda el servidor saca una carta al azar y solo se ven cuatro pistas:
   **altura, pie, origen y decada**. Ni nombre, ni temporada, ni club,
   ni edad. El precio de salida si es publico.
5. Se puja. Cada puja minima sube el precio y reinicia el reloj. Si la ventana
   se agota sin puja, la carta se resuelve sola. Cualquier jugador conectado
   puede pasar la carta (pasar los demas, no votar): si pasan todos se descarta,
   y solo se sortea entre quienes aun necesitan ese puesto cuando ya no queda
   margen.
6. Tambien se puede votar saltar la carta, y requiere **unanimidad** de la sala
   entera, no solo de quien aun la necesita. Si el voto falla, la subasta sigue
   pero en fase restringida: solo puja quien aun necesita el puesto y voto en
   contra.
7. Al revelarse, todos ven quien era y cuanto costaba. Si no cabe en el
   presupuesto, se descarta.
8. Al final se gana un punto por cada hueco donde tu carta sea la mejor
   valorada, y los empates se reparten. Desempate: valoracion total del once y,
   si sigue igual, quien conserve mas dinero.

Las reglas de precio, los tiempos y la puntuacion estan en
[`docs/COMO-JUGAR.md`](docs/COMO-JUGAR.md).

## Requisitos

- Node 26 (o 22+ segun `engines`)
- pnpm 9.15.9

## Puesta en marcha

```powershell
pnpm install --frozen-lockfile

# Terminal 1: el servidor (Colyseus + API + estaticos)
pnpm --filter @fut/server start:dev

# Terminal 2: el cliente con recarga en caliente
pnpm --filter @fut/client dev
```

El cliente busca el servidor en `http://localhost:2567`. Para apuntarlo a otro
sitio se compila con `VITE_SERVER_URL` (ver `.env.example`).

El servidor tambien sirve el cliente compilado, lo que permite exponer el
juego por un unico origen y asi un solo tunel:

```powershell
pnpm build
$env:NODE_ENV='production'; pnpm --filter @fut/server start:dev
# http://localhost:2567
```

## Comprobaciones

Cada push corre todo esto en CI (`.github/workflows/ci.yml`):

```powershell
pnpm dataset:check   # mazo: variedad por puesto y economia del presupuesto
pnpm typecheck       # tsc --noEmit en los tres paquetes
pnpm test            # vitest en shared, client, server y tools
pnpm build           # shared -> client -> server
docker build --tag subasta-futbolera:ci .
bash scripts/smoke-container.sh subasta-futbolera:ci
```

`dataset:check` no es decorativo: mide lo que cuesta un once entero con las
cartas mas baratas, las mas caras y una cualquiera, y falla si la economia se
desvia de la ventana calibrada en `DEFAULT_RULES`. Si se anaden cartas al mazo,
el presupuesto hay que recalibrarlo o el aviso salta solo.

## Estructura

| Ruta | Que hay |
|---|---|
| `packages/shared` | Tipos, reglas, motor de pujas, economia, validacion del mazo. Sin dependencias de framework. |
| `packages/server` | Sala Colyseus, proyeccion del estado al Schema, express, health checks. |
| `packages/client` | React + Vite + Tailwind. No importa `shared`: duplica a proposito los tipos que necesita. |
| `data/` | `players.json` (el mazo), `photos/` y `silhouettes/` (una imagen por carta), `attributions.json`. |
| `scripts/` | `check-dataset.ts`, `smoke-container.sh`. |
| `tools/` | Generacion de siluetas y de `CREDITS.md`. |
| `design-system/` | Reglas de interfaz. `pages/partida.md` es la referencia de la pantalla de puja. |
| `docs/` | Como jugar, produccion y el historial de planes. |

### Donde vive la respuesta

La carta sobre la mesa nunca viaja con su identidad. El servidor manda un
`publicId` opaco, unico por partida; el `cardId` real y el nombre de la
silueta no salen del servidor hasta el reveal, y la imagen se sirve por
`/silhouettes/:roomId/:publicId.png` precisamente para que la URL no la
filtre. `project.ts` es el unico punto donde se decide que ve el navegador, y
`test/lobby.test.ts` mantiene una lista blanca de campos publicos: anadir uno
nuevo al Schema rompe el test en vez de colarse.

## Despliegue

Ver [`docs/PRODUCCION.md`](docs/PRODUCCION.md). En resumen: una imagen Docker,
un proceso, y **una sola Machine** de Fly -- las salas viven en memoria, asi
que dos instancias separarian a los jugadores y un reinicio termina las
partidas en curso.

## Licencia

Codigo bajo MIT (ver [`LICENSE`](LICENSE)). Las fotografias de `data/photos/` y
las siluetas de `data/silhouettes/` son de Wikimedia Commons y conservan sus
licencias CC BY y CC BY-SA, con la atribucion de las 110 en
[`CREDITS.md`](CREDITS.md).

# syntax=docker/dockerfile:1

# Imagen multi-etapa: compila el cliente Y el servidor (con tsc) en etapas
# desechables, y en runtime arranca JavaScript ya compilado con `node` a
# secas -- NUNCA `tsx` en produccion. Node 26 y pnpm via corepack, como pide
# el proyecto.
#
# Por que NO usar tsx en produccion, a pesar de que localmente
# `pnpm --filter @fut/server start` lo use (tsx watch/tsx sobre la fuente):
# probado en runtime real dentro de esta misma imagen base (node:26-slim) y
# reproducido con dos pestañas de navegador reales entrando a la misma
# partida (exactamente el caso de dos amigos abriendo el enlace): en cuanto
# el segundo jugador se une, el primer broadcastPatch periodico de la sala
# (Room.mjs, el temporizador que Colyseus arma solo para difundir el
# delta -- no un handler de AuctionRoom) hace que tsx resuelva
# `@colyseus/schema` hacia SU CODIGO FUENTE (.ts, dentro de node_modules)
# en vez de hacia su build compilado (build/esm/index.mjs) pese a que el
# `package.json` de ese paquete y el propio codigo compilado de
# @colyseus/core piden expresamente el build vía "@colyseus/schema" (bare
# specifier, sin ninguna ruta profunda). El codigo fuente sin compilar de
# @colyseus/schema no lleva el polyfill de `Symbol.metadata` que SI lleva
# su build (`Symbol.metadata ??= Symbol.for(...)`) -- así que la sala
# revienta con `TypeError: Cannot read properties of undefined (reading
# 'Symbol(Symbol.metadata)')` y tira abajo el proceso entero (excepcion sin
# capturar dentro de un temporizador interno de Colyseus), matando la
# partida para todos los jugadores conectados. No reproduce en Windows en
# local -- solo dentro de este contenedor Linux -- y no es un fallo de
# AuctionRoom.ts ni de packages/shared/src (ninguno de los dos interviene
# en esta ruta: el trace pasa por Room.mjs -> SchemaSerializer ->
# @colyseus/schema, código de terceros). La compilacion con tsc de
# server+shared, mas correr el resultado con `node` puro, evita esta
# resolución ambigua por completo: el JS ya compilado importa
# "@colyseus/schema" igual que build/esm/index.mjs, y sin tsx de por medio
# no hay heurística que lo desvíe hacia la fuente.

FROM node:26-slim AS base
# openssl: requerido por Corepack para verificar la firma de los paquetes
# de pnpm que descarga. libc6-compat no hace falta (node:26-slim es Debian,
# no Alpine); sharp/imgly no viajan a esta imagen (ver mas abajo).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# A partir de Node 25/26, Corepack ya NO viene preinstalado (antes bastaba
# `corepack enable`) -- hay que instalarlo aparte via npm antes de poder
# habilitarlo. Confirmado contra la imagen real: `corepack enable` a secas
# falla con "not found" en node:26-slim.
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# --- Etapa "deps": instala TODO el workspace una sola vez -----------------
# Un solo `pnpm install` en la raiz resuelve los tres paquetes (shared,
# server, client) porque son un workspace pnpm real (pnpm-workspace.yaml) --
# separarlo por paquete duplicaria la resolucion y podria desincronizar el
# lockfile. Se copian antes que el resto del codigo para que esta capa (la
# mas lenta) solo se invalide cuando cambian las dependencias, no en cada
# cambio de codigo.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
# --frozen-lockfile: falla en vez de reescribir el lockfile si algo no
# encaja -- una imagen de produccion nunca deberia instalar versiones
# distintas a las que el repo fijo.
RUN pnpm install --frozen-lockfile

# --- Etapa "client-build": compila el cliente con Vite ---------------------
# Necesita el codigo de shared y client (el cliente no importa shared en
# runtime, pero sus tipos si se resuelven en build). No necesita el codigo
# del servidor.
FROM deps AS client-build
COPY packages/shared/src packages/shared/src
COPY packages/client packages/client
# Enlace de donaciones (opcional): Vite lo incrusta al compilar. Render pasa las
# variables del servicio como build args; sin el, el apartado de apoyo no se pinta.
ARG VITE_DONATE_URL
ENV VITE_DONATE_URL=$VITE_DONATE_URL
RUN pnpm --filter @fut/client build

# --- Etapa "server-build": compila shared + server con tsc -----------------
# Ninguno de los dos tiene script `build` propio (ambos corren su fuente
# directo con tsx/vitest en local -- ver sus package.json), así que se
# invoca tsc a mano contra cada tsconfig.json tal cual está, sin tocarlo:
# mismo target/module/strict que usa el propio `typecheck` de cada paquete,
# solo que aquí SÍ se emite JS (--noEmit false) en vez de solo comprobar
# tipos. Como conserva sus `import "./Foo.js"` (ya .js en el propio
# TypeScript, por verbatimModuleSyntax) el resultado es JS de Node estandar,
# sin ninguna de las heurísticas de tsx que causan el fallo documentado
# arriba.
FROM deps AS server-build
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/server/src packages/server/src
COPY packages/server/tsconfig.json packages/server/tsconfig.json
# --rootDir src: sin el, tsc no sabe si la raiz comun de "include": ["src",
# "test"] es src o test y se niega a emitir (TS5011). --excludeDirectories
# test: los tests no tienen sitio en la imagen de produccion -- ademas
# arrastrarian @colyseus/testing como import en tiempo de compilacion sin
# necesidad.
RUN pnpm --filter @fut/shared exec tsc --noEmit false --outDir dist --declaration false --rootDir src --excludeDirectories test -p tsconfig.json \
    && pnpm --filter @fut/server exec tsc --noEmit false --outDir dist --declaration false --rootDir src --excludeDirectories test -p tsconfig.json

# --- Etapa final: runtime -------------------------------------------------
# Imagen unica que sirve cliente y servidor desde el mismo proceso (ver el
# comentario de packages/server/src/index.ts sobre por que comparten
# origen). Arranca con `node` puro sobre JS ya compilado -- ver el porque
# al principio de este fichero.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=deps /app/packages/server/package.json packages/server/package.json
COPY --from=deps /app/packages/server/node_modules packages/server/node_modules
COPY --from=deps /app/packages/client/package.json packages/client/package.json

COPY --from=server-build /app/packages/server/dist packages/server/dist

# `@fut/shared` en package.json (repo, sin tocar) apunta su `exports` a
# `./src/index.ts` a proposito -- pensado para consumirse via tsx/bundler,
# no para Node puro, que no sabe importar .ts. En vez de tocar ese
# package.json (fuera de los limites de esta tarea) se sustituye SOLO
# dentro de esta capa de la imagen el contenido de
# node_modules/@fut/shared (hoy un symlink de pnpm hacia el paquete real)
# por una copia con su JS ya compilado y un package.json minimo que sí
# apunta a ese JS. El repo -- y lo que ve el otro agente trabajando en
# packages/shared -- no cambia en absoluto; esto solo existe dentro de la
# imagen Docker.
RUN rm -f packages/server/node_modules/@fut/shared
COPY --from=server-build /app/packages/shared/dist packages/server/node_modules/@fut/shared/dist
RUN echo '{"name":"@fut/shared","version":"0.0.0","type":"module","main":"./dist/index.js","exports":{".":"./dist/index.js"}}' \
    > packages/server/node_modules/@fut/shared/package.json
# zod es la unica dependencia real de @fut/shared (ver su package.json) --
# dataset.ts la usa para validar el dataset. El symlink sintetico de arriba
# no hereda su propio node_modules/zod (pnpm ya no lo tiene detras del
# symlink real que se borro), asi que sin este enlace el import de zod
# fallaria con ERR_MODULE_NOT_FOUND en cuanto AuctionRoom cargara el
# dataset. El store de pnpm tiene MAS de una version de zod instalada (otra
# dependencia trae una version distinta como transitiva) -- adivinar por
# nombre de carpeta se equivocaria a veces. En vez de eso, se copia
# directamente el symlink que la etapa "deps" ya resolvio bien para
# packages/shared (ese es siempre el correcto por construccion, sin
# ambiguedad posible) -- COPY sigue symlinks por defecto y copia el
# contenido real del paquete, no un enlace roto.
COPY --from=deps /app/packages/shared/node_modules/zod packages/server/node_modules/@fut/shared/node_modules/zod

# Cliente ya compilado por la etapa client-build: es lo unico del paquete
# client que el servidor necesita en runtime (ver CLIENT_DIST en index.ts).
COPY --from=client-build /app/packages/client/dist packages/client/dist

# Dataset y assets binarios que AuctionRoom e index.ts leen por ruta de
# disco (DATASET_PATH, SILHOUETTES_DIR, PHOTOS_DIR) -- no se importan como
# modulo, asi que sin este COPY el servidor arranca pero cada partida y
# cada peticion de imagen fallaria con 404/500 en cuanto tocara el dataset.
COPY data data

EXPOSE 2567

# JS compilado, Node puro -- sin tsx en produccion (ver el porque al
# principio de este fichero). index.ts/AuctionRoom.ts anclan sus rutas de
# disco via import.meta.url relativo al PROPIO fichero (no al cwd, ver sus
# comentarios): siguen resolviendo bien porque dist/ conserva la misma
# profundidad de carpetas que src/ (packages/server/dist/index.js en vez
# de packages/server/src/index.ts).
CMD ["node", "packages/server/dist/index.js"]

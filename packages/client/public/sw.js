/*
 * Service worker de Puja el Once. Hace lo minimo para que la app sea instalable
 * y abra rapido, y NADA mas: es un juego multijugador en vivo, asi que la
 * partida, las salas y las imagenes de cartas jamas se guardan en cache.
 *
 *  - Paginas (navegacion): red primero. Si no hay conexion, pagina de aviso.
 *    No se cachea el HTML: asi nunca apunta a ficheros con hash que ya no existen.
 *  - /assets/* (JS, CSS y fuentes con hash en el nombre) e iconos: cache primero.
 *  - Todo lo demas, y todo lo que no sea GET o de otro origen: pasa de largo.
 *
 * Fotos y siluetas (/photos, /silhouettes) estan en la lista de exclusion a
 * proposito: su URL contiene el identificador secreto de la carta de esa sala.
 */
const VERSION = "v1";
const STATIC_CACHE = `pujaelonce-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

const NEVER_CACHE = [
  /^\/matchmake\//,
  /^\/rooms\//,
  /^\/feedback/,
  /^\/silhouettes\//,
  /^\/photos\//,
  /^\/time/,
  /^\/health\//,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("pujaelonce-") && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

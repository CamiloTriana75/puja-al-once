# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Grupos de 2 a 4 amigos hispanohablantes que saben de fútbol. Juegan casi siempre desde PC, cada uno en su casa y hablando por llamada, en una partida de una tarde. El trabajo: pujar contra los demás por futbolistas ocultos, armar el mejor once y presumir (o sufrir) el resultado.

## Product Purpose

Puja el Once es un juego de subastas a ciegas en el navegador. Cada carta es un futbolista de una temporada concreta, visible solo como silueta y cuatro pistas (altura, pie, origen, década). Se puja con un presupuesto de 1.000 M; al caer el martillo se revela quién es y de qué temporada. El rating se oculta hasta la ceremonia final, que da un punto por puesto al mejor y corona al ganador. Éxito: que el grupo quiera la revancha.

## Positioning

La mecánica que nadie puede copiar: pujar sin saber a quién, y descubrir que el mismo jugador vale muy distinto según la temporada (Ronaldinho 2006 es 94, 2015 es 74). La sorpresa del destape y la discusión del grupo son el producto.

## Operating Context

- Flujo: portada → crear sala o unirse con código de 5 letras (o sala pública) → sala de espera, todos pulsan Listo → 11 rondas, una por puesto (POR, LI, DFC×2, LD, MCD, MC, MP, EI, DC, ED) → mercado de transferencias (intercambio de cartas) → ceremonia y resultados → revancha.
- Reloj real: 25 s para abrir la puja, cada puja deja 10 s; puja mínima +10 M; precio de salida por tramo de rating (30/50/70/90/200 M).
- Paso colectivo y voto de salto por unanimidad; reacciones en vivo; el anfitrión puede expulsar en la sala de espera.
- Los jugadores se ven y se oyen por la llamada: la pantalla debe sostener la conversación, no competir con ella.

## Capabilities and Constraints

- Cliente React 19 + Vite + Tailwind 4 + Framer Motion; servidor Colyseus 0.16 (no subir de línea).
- Ningún dato privado de carta llega al navegador antes de tiempo: identidad antes del reveal, rating antes de RESULTS.
- El cliente nunca importa el dataset; las imágenes de cartas salen de rutas del servidor por `publicId`.
- Salas de hasta 4 jugadores. No se quitan cartas del mazo. Se mantienen los tramos de precio.
- `prefers-reduced-motion` respetado en todas las pantallas.

## Brand Commitments

- Nombre: Puja el Once. Español neutro, tuteo, tono de grupo de amigos.
- Una sola identidad para portada y juego, inspirada en https://landing.scoutium.com/ (TeamScope) y en la portada actual. El usuario la marcó como vinculante para todas las pantallas.
- Nada de la interfaz actual es intocable.

## Evidence on Hand

- 149 cartas con foto real de Wikimedia Commons y atribución (`data/`, `CREDITS.md`).
- Sin testimonios, sin métricas de uso, sin logos de clubes: no inventarlos.

## Product Principles

1. La carta oculta es la protagonista: todo lo demás le deja sitio.
2. Cada decisión de puja se toma en segundos: precio, reloj y quién va ganando se leen de un vistazo.
3. El destape es un momento compartido: que se note en todas las pantallas a la vez.
4. Honestidad: solo hechos reales del juego, nunca prueba social inventada.

## Accessibility & Inclusion

WCAG AA de contraste, foco visible, objetivos de 44 px, el color nunca es el único indicador, movimiento reducido respetado.

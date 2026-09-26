# Feedback de la partida con amigos — Plan

Fecha: 2026-09-26. Origen: primera partida real del usuario con amigos (build beta).

## Lo que pidieron

1. **Ningun jugador repetido en una ronda.** Salian Casillas 2010 y Casillas 2016 como candidatos del mismo puesto.
2. **Foto exacta de la temporada de cada carta.** Messi 2015 -> foto de Messi en 2015. Marcelo 2017 -> foto de 2017. Ninguna foto compartida entre cartas.
3. **Arreglar el apartado de saltar jugador.** Botones que no funcionan bien.

## Diagnostico (verificado, no supuesto)

- (1) `drawRound` baraja el mazo del puesto sin mirar el nombre. Hay 27 pares de temporadas del mismo jugador.
- (3) Dos causas:
  - **Anoche**: sin reloj hasta la primera puja, una carta sin pujas se quedaba congelada para siempre salvo que alguien pulsara "cerrar sin pujas". Ya arreglado (D1, ventana de apertura con reloj real).
  - **Hoy**: el servidor sustituyo `closeWithoutBid` por `pass` (D2) pero el cliente sigue mandando `closeWithoutBid`. Boton muerto. Confirmado en el log: `room onMessage for "closeWithoutBid" not registered`.
  - Dos partidas reales con 4 navegadores golpeando los botones a la vez (cerrar sin pujas x4; saltar x3 + "la quiero" x1): **sin caida de servidor ni errores**.

## Decisiones

| # | Decision | Por que |
|---|---|---|
| F1 | Unicidad de jugador **dentro de cada ronda, obligatoria**. Entre rondas de la misma partida, preferible si el mazo lo permite; nunca a costa de que el reparto falle | Es lo que pidieron. El mazo tiene margen de sobra por puesto |
| F2 | **Una imagen por carta**: `silhouetteId` pasa a ser unico por carta. Silueta y foto salen de la misma foto de esa temporada | Pidieron foto exacta de cada ano. Las parejas pico/declive dejan de compartir imagen |
| F3 | **Si no hay foto libre de ese ano exacto**: la del ano mas cercano verificable en Commons, anotando la diferencia. Nunca inventar ni forzar fechas; nunca quedarse sin foto | Commons no cubre todos los anos (sobre todo los 70). Sin foto el reveal pierde su gracia |
| F4 | La fecha de la foto se toma del campo "Date" de la pagina de Commons, no de la intuicion | Es la unica fuente verificable |
| F5 | El cliente se alinea con lo que el servidor ya tiene (D1-D3, D5): boton Paso, cuenta atras de apertura, rating oculto en partida, revancha | Hoy el cliente esta desincronizado: boton muerto y ratings a 0 en pantalla |

## En pausa (hasta que el usuario diga)

D6 (6 jugadores), D7 (velocidad), D8 (reacciones), D9 (sonido), ceremonia final. La partida funciona sin ellos: sin ceremonia, los ratings aparecen en la pantalla de resultados.

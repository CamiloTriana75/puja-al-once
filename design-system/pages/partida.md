# Partida — anadidos de la alpha

Anula a `MASTER.md` solo donde se diga. Complementa lo que ya existe en la pantalla de subasta.

## Ventana de apertura

Antes de la primera puja, cada carta tiene una ventana (25 s en normal, 15 s en rapida). Se muestra **distinta** del reloj anti-snipe:
- **Ventana de apertura**: "Abre la puja · 18 s", texto blanco sobre `--ink`, sin pulso.
- **Anti-snipe** (ya existe): cifra grande lima, pulso rojo en los ultimos 5 s.

El cliente distingue una de otra por `currentBid === 0`.

## Paso

- Boton "PASO" junto a los controles de puja, secundario (borde, no relleno). 44 px de alto.
- Tras pasar: "PASASTE", deshabilitado. Pasar no es vinculante: si nadie mas pasa y alguien puja, se puede seguir pujando.
- En la lista de jugadores, etiqueta "PASA" en quien haya pasado (texto, no solo color).
- Cuando pasan todos, la carta se resuelve sola en el servidor.

## Rating oculto

Desde la alpha, el rating **no se muestra en ningun sitio durante la partida**: ni en el reveal, ni en la plantilla, ni en el historial, ni en el resumen entre rondas. Donde antes habia un numero, "?" en `--mute` sobre `--ink`. El resumen entre rondas deja de mostrar clasificacion (no se puede calcular) y muestra lo que si se sabe: dinero restante y puestos cubiertos de cada jugador.

## Reacciones

- Fila de 6 botones (44 px) con los emojis fijos del contrato. Los emojis aqui son **contenido del jugador**, no iconos de interfaz: la regla de "sin emojis como iconos" no aplica.
- Al pulsar, el emoji sube y se desvanece sobre la zona de la carta (transform + opacidad, 1.5 s, ease-out) con el nombre de quien lo mando en pequeno.
- Enfriamiento visual de 600 ms tras cada pulsacion (el servidor limita igual).
- Con `prefers-reduced-motion`: sin subida; aparecen 1.5 s fijos en una franja y desaparecen.
- **Posicion**: en movil, una fila justo encima de los controles de puja fijos. En escritorio, bajo la tarjeta.
- Presupuesto de movimiento: las reacciones cuentan como un elemento. Durante el reveal, que ya gasta dos, las reacciones se muestran sin subida.

## Sonido

Sintetizado con Web Audio, sin ficheros. Volumen bajo.
- Puja aceptada: tic corto.
- Te superan la puja: dos notas descendentes, solo para quien iba ganando.
- Vendido / reveal: golpe grave + barrido corto.
- Ceremonia: campanita por punto; arpegio al campeon.
- **Sin** tics de cuenta atras: cansan.

Boton de silencio en la cabecera: icono SVG de altavoz, 44 px, `aria-label` que diga lo que hara ("Silenciar" / "Activar sonido"), recordado en `localStorage`. El `AudioContext` se crea en la primera interaccion del usuario (unirse a la sala ya lo es).

## Como se juega

Modal accesible desde la sala de espera y desde un boton "?" en la cabecera de la partida.
- Foco atrapado dentro, `Escape` cierra, el foco vuelve al boton que lo abrio.
- Contenido: el objetivo, la puja, el paso, el voto de salto, que el rating se descubre al final, y como se puntua. Frases cortas.

## Escala de capas (z-index)

| Capa | z |
|---|---|
| Controles de puja fijos (movil) | 10 |
| Reacciones flotantes | 20 |
| Aviso de conexion perdida | 30 |
| Avisos breves | 40 |
| Modal | 50 |

## Sala de espera: velocidad

- El anfitrion ve un control segmentado "NORMAL · RAPIDA" con una linea que explique cada uno.
- El resto lo ve en solo lectura.
- Seis huecos dibujados (capacidad de la sala), los libres como huecos.

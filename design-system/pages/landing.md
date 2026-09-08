# Landing — Subasta Futbolera

Anula a `MASTER.md` solo donde se diga. Todo lo no listado aquí hereda del Master: paleta, tipografía, formas, movimiento, contrastes.

Patrón elegido: **Before-After Transformation** (ui-ux-pro-max, dominio landing). Es el patrón correcto porque el mecanismo del juego **es** una transformación: silueta negra → foto real. No hay que explicar el producto con palabras; se enseña.

## Estructura

1. **Hero — la transformación en vivo.** Una tarjeta de subasta real, del tamaño que tiene en el juego, alternando sola entre silueta y foto revelada cada pocos segundos. Al lado, el nombre del juego y el botón de crear sala. Nada de texto explicando qué es: el bucle lo dice.
2. **Cómo se juega — tres pasos.** Pujas a ciegas por una silueta / Se revela quién es y de qué temporada / Gana quien tenga el mejor en más puestos. Tres bloques `--ink` biselados, numerados, sin iconos decorativos.
3. **El gancho, con ejemplo real.** Dos tarjetas lado a lado: mismo futbolista, dos temporadas, dos ratings muy distintos. Ronaldinho 2006 (94) contra Ronaldinho 2015 (74). El texto: "Ganaste la subasta. Ahora descubre cuál te tocó."
4. **Entrar.** Crear sala o unirse con código. Es el único formulario de la página.

## Reglas propias de esta página

- **El hero no lleva foto de stock ni ilustración.** Usa los assets reales del juego. Una landing de un juego cuyo hero no muestra el juego está mintiendo.
- **La alternancia silueta↔foto respeta `prefers-reduced-motion`**: con movimiento reducido, se muestran las dos versiones lado a lado en vez de alternar. La información no puede depender de la animación.
- **Un solo llamado a la acción por pantalla.** Crear sala arriba, crear/unirse abajo. Nada de tres botones compitiendo.
- **Sin testimonios, sin métricas, sin logos de empresas.** Es un juego entre amigos, no un SaaS. Inventar prueba social sería mentir y además se nota.
- **Sin scroll infinito ni secciones de relleno.** Cuatro bloques y fuera. Si alguien llega buscando jugar, que pueda hacerlo sin scrollear.

## Anti-patrones específicos

Además de los de `MASTER.md` §9:

- Héroe con degradado y texto centrado genérico — es la plantilla que el usuario rechazó explícitamente.
- Contadores animados de "partidas jugadas" con números inventados.
- Sección de precios. Esto no se vende.

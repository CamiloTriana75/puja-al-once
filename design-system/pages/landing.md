# Landing — Puja el Once

La landing es la entrada emocional a una subasta con amigos. Conserva el sistema deportivo de `MASTER.md`, con más ritmo y escala que el resto de las pantallas.

## Dirección

- Gráfica de retransmisión: campo táctico, diagonales, bloques biselados, verde profundo, lima y tipografía Barlow Condensed a gran escala.
- El titular presenta el pique; la carta de demostración enseña la mecánica real del producto: puja oculta y revelación.
- Ronaldinho, 94 y 74 son ejemplos del dataset. No mostrar métricas de actividad, testimonios ni urgencia inventada.
- El recorrido es corto: apertura, tres fases de juego, diferencia entre temporadas y formulario de entrada.

## Movimiento

- La carta de ejemplo alterna entre silueta y retrato, y tiene un control manual para revelar u ocultar al jugador.
- La banda lima se desplaza, las secciones entran una sola vez al aparecer y las tarjetas de ejemplo llegan con movimiento corto.
- El movimiento refuerza la lectura y no bloquea el formulario. Con `prefers-reduced-motion`, se detiene la alternancia automática y el usuario conserva el control manual.
- Se permite más movimiento simultáneo que en las pantallas de partida: esta excepción es propia de la portada y no cambia el presupuesto de animación durante el juego.

## Entrada a una sala

- Compartir una sala copia o envía `/sala/:codigo`.
- Al abrir ese enlace, la portada reconoce el código y prepara el modo «Unirme» con el campo rellenado.
- El jugador escribe su nombre y confirma; nunca se le mete a una sala sin su acción.
- Los campos mantienen etiquetas visibles, validación nativa y estado de conexión durante la entrada.
- CTA y enlaces llevan al mismo formulario; crear o unirse continúa usando el flujo de red existente.

## Accesibilidad y límites

- Contraste legible sobre verde y lima, foco visible y objetivos táctiles de al menos 44 px.
- La información no depende de una animación; el ticker decorativo se oculta a tecnologías de asistencia.
- Sin testimonios, logos de empresas, contadores inventados, precios ni bloques de relleno.

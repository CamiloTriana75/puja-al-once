# Ceremonia final — pagina de diseno

Anula a `MASTER.md` solo donde se diga. Hereda paleta, tipografia, formas y contrastes.

## Por que existe

Desde la alpha el rating queda oculto hasta el final (plan alpha, D3). Durante la partida cada jugador sabe **a quien** compro, pero no **cuanto rinde**. La ceremonia es donde se descubre: el momento de mas tension del juego y el que decide quien gana. Tiene que sentirse como el final de una retransmision, no como una tabla que aparece.

## Secuencia

1. **Entrada** (~2 s): "LA HORA DE LA VERDAD" en display, y el marcador con todos a 0.
2. **Once pasos, uno por puesto** (~4.8 s cada uno, en el orden de la formacion):
   - Etiqueta del puesto grande: PORTERO, LATERAL IZQUIERDO...
   - Una carta por jugador para ese puesto: foto recortada, nombre, temporada, dueno, precio pagado. Rating tapado con "?".
   - A los ~1.8 s, **todos los ratings se destapan a la vez**. El mejor se marca en lima con la etiqueta "GANA" (texto, no solo color) y su dueno suma en el marcador. Empate: "+0.5" a cada uno.
   - El paso es el momento donde se ve, puesto a puesto, que jugador eligio cada uno: va lento a proposito, para leer la carta y ver el destape antes de que llegue el siguiente puesto. El boton de saltar esta siempre a mano para quien no quiere esperar.
   - Hueco vacio (jugador desconectado): carta "Sin fichaje", nunca gana.
3. **Campeon**: nombre enorme, "CAMPEON", trofeo en SVG (nunca emoji), confeti.
4. **Premios**: tres tarjetas cortas (ver abajo).
5. **Resultados completos**: clasificacion, plantillas, y los botones de salida.

**Cada cliente reproduce la ceremonia por su cuenta** al entrar en `RESULTS`. Llega el mismo parche a todos a la vez, asi que van practicamente sincronizados sin coordinacion de servidor.

El marcador de la ceremonia es **derivado**, no acumulado: son los puntos de los pasos ya revelados, recalculados desde los mismos pasos que se pintan. Asi un patch del servidor a mitad de secuencia (alguien que se desconecta) reinicia el temporizador del paso, pero nunca vuelve a sumar un punto que ya estaba sumando.

**Quien es campeon lo decide la clasificacion del servidor** (`standings`, con su desempate por puntos, rating total y presupuesto restante), no los puntos de la ceremonia. Las dos pantallas tienen que contar lo mismo: si la ceremonia declarara un campeon que la tabla de abajo no pone primero, el final se contradiria a si mismo.

**Boton "Saltar ceremonia"** siempre visible, para quien ya la vio o tiene prisa. Solo afecta a su pantalla.

## Premios (calculados en el cliente con datos publicos en RESULTS)

Rankings sobre todas las cartas adjudicadas de la partida (no las descartadas):

- **Peor fichaje**: mayor (posicion en ranking de precio) − (posicion en ranking de rating). "Pago como el 2.o mas caro y rindio como el 19.o". Mostrar precio y rating, no la formula.
- **Mejor robo**: al reves, mayor (ranking de rating) − (ranking de precio).
- **Mas gastador**: el jugador que mas dinero gasto en total.

Si un premio no tiene candidato claro (partida sin pujas), no se muestra.

## Movimiento

Presupuesto de `MASTER.md` §5: dos elementos por vista.
- **Pasos por puesto**: el destape del rating (opacidad o giro corto, 300 ms, ease-out) + el incremento del marcador. Nada mas se mueve.
- **Campeon**: la entrada del nombre + el confeti. El confeti es la unica excepcion al "solo transform/opacity": se dibuja en canvas y dura menos de 3 s.
- **Con `prefers-reduced-motion`**: sin giros ni confeti. Los pasos muestran el rating ya destapado y avanzan igual. La informacion nunca depende de la animacion.

## Accesibilidad

- `aria-live="polite"` que anuncie cada puesto: "Portero: gana Ana con Casillas 2010, rating 90".
- El marcador con cifras tabulares.
- El boton de saltar y los de salida alcanzables con teclado, foco visible.

## Salida

- **Anfitrion**: "REVANCHA" como accion principal (lima). Reinicia la sala con los mismos jugadores.
- **Resto**: "Esperando a que <anfitrion> pida la revancha…" en panel `--ink`.
- **Todos**: "Salir" secundaria.

## Anti-patrones

- Mostrar la clasificacion final antes de terminar los once pasos: mata la tension.
- Destapar los ratings de uno en uno con 6 jugadores: once pasos por seis destapes es demasiado lento.
- Trofeo, medallas o fuegos como emoji.

## Presentación de cartas

- Cada tarjeta de puesto incluye la foto de la temporada revelada, jugador que la fichó, precio y rating.
- La foto de ceremonia se solicita por identificador de carta revelada; una carta aún no revelada sigue respondiendo 404.
- Si hay empate en puntos al final, desempata el servidor por rating total y luego por presupuesto sin gastar, igual que la clasificacion de la tabla; solo hay varios campeones cuando el empate es en los tres criterios.
- La pantalla completa puede desplazarse en móvil; el progreso y el control para saltar permanecen visibles respetando el área segura superior.

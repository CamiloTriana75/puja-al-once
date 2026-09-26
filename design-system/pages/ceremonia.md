# Ceremonia final — pagina de diseno

Anula a `MASTER.md` solo donde se diga. Hereda paleta, tipografia, formas y contrastes.

## Por que existe

Desde la alpha el rating queda oculto hasta el final (plan alpha, D3). Durante la partida cada jugador sabe **a quien** compro, pero no **cuanto rinde**. La ceremonia es donde se descubre: el momento de mas tension del juego y el que decide quien gana. Tiene que sentirse como el final de una retransmision, no como una tabla que aparece.

## Secuencia

1. **Entrada** (~1.5 s): "LA HORA DE LA VERDAD" en display, y el marcador con todos a 0.
2. **Once pasos, uno por puesto** (~3 s cada uno, en el orden de la formacion):
   - Etiqueta del puesto grande: PORTERO, LATERAL IZQUIERDO...
   - Una carta por jugador para ese puesto: foto recortada, nombre, temporada, dueno, precio pagado. Rating tapado con "?".
   - A los ~0.8 s, **todos los ratings se destapan a la vez**. El mejor se marca en lima con la etiqueta "GANA" (texto, no solo color) y su dueno suma en el marcador. Empate: "+0.5" a cada uno.
   - Hueco vacio (jugador desconectado): carta "Sin fichaje", nunca gana.
3. **Campeon**: nombre enorme, "CAMPEON", trofeo en SVG (nunca emoji), confeti.
4. **Premios**: tres tarjetas cortas (ver abajo).
5. **Resultados completos**: clasificacion, plantillas, y los botones de salida.

**Cada cliente reproduce la ceremonia por su cuenta** al entrar en `RESULTS`. Llega el mismo parche a todos a la vez, asi que van practicamente sincronizados sin coordinacion de servidor.

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

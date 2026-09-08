# Sala de espera — página de diseño


Anula a `MASTER.md` solo donde se diga. Todo lo demás hereda: paleta, tipografía, formas, movimiento.

## Qué problema resuelve

Hoy el lobby es una lista de nombres y un botón. Con salas y hasta seis jugadores pasa a ser el sitio donde la gente espera, y esperar sin información es donde se abandona una partida antes de empezar.

## Estructura

1. **El código, enorme y copiable.** Es lo primero que busca quien acaba de crear la sala, porque tiene que pasárselo a alguien. Tipografía display al tamaño de la cifra heroica de `MASTER.md` §3, con botón de copiar al lado. Al copiar, confirmación visible — no un toast que se va antes de leerse.
2. **Quién está y quién falta.** Una fila por jugador con su estado: listo, esperando, reconectando. Los huecos libres se dibujan como huecos, no se omiten: ver "2 de 6" en abstracto informa menos que ver cuatro sitios vacíos.
3. **Qué falta para empezar.** Una frase que diga exactamente qué bloquea el arranque: "Faltan 2 jugadores por estar listos" o "Puedes empezar cuando quieras". Nunca un botón deshabilitado sin explicación.
4. **Botón de empezar**, solo para el anfitrión.

## Reglas propias

- **El código de sala se lee en voz alta.** Sin `0`/`O`, sin `1`/`I`/`L`. Se va a dictar por teléfono o por audio de WhatsApp.
- **El estado "listo" no es solo color.** Lleva texto, como ya hace la etiqueta "GANANDO" de la pantalla de subasta. `MASTER.md` §6.
- **Reconectando es su propio estado**, distinto de desconectado. Ya existe `rejoinPending` en el servidor; aquí se ve por primera vez de forma explícita.
- **Nada de animaciones de espera decorativas.** Ni puntos suspensivos que rebotan ni barras indeterminadas: el presupuesto de movimiento de `MASTER.md` §5 se gasta en el reveal, que es el momento del producto.

## El estado que hoy no existe y hace falta

**La conexión caída.** Anotado como pendiente desde la Task 13: si el servidor muere, la interfaz se queda congelada sin avisar. Con severidad alta en las guías de UX, y en una sala de espera es peor todavía — la gente se queda mirando una lista que ya no se actualiza.

Hace falta un estado visible de "se perdió la conexión, reintentando" que cubra toda la aplicación, no solo esta pantalla.

## Anti-patrones

- Barra de progreso falsa que avanza sola sin corresponder a nada.
- Contador de tiempo de espera. Solo genera ansiedad.
- Ocultar los huecos libres para que la sala parezca más llena.

# Design System — Subasta Puja el Once

**Fuente de verdad global.** Toda pantalla parte de aquí. Una página solo se desvía si existe un fichero en `design-system/pages/<pagina>.md`, y entonces ese fichero manda sobre este.

Derivado con `ui-ux-pro-max` (patrón *Vibrant & Block-based*, pareja tipográfica *Sports/Fitness*) y ajustado a la referencia visual del proyecto: gráfico de retransmisión deportiva, no interfaz de aplicación.

---

## 1. La idea

Esto no se parece a un panel de administración con acento verde. Se parece al gráfico que la televisión saca a pantalla cuando anuncian un fichaje: **bloques negros angulares recortados sobre verde saturado, tipografía condensada enorme, y el futbolista sobresaliendo del bloque**.

Tres decisiones cargan todo el peso:

1. **La silueta rompe el marco.** El jugador sale por encima del borde superior del panel. Es lo que separa el gráfico deportivo del rectángulo genérico.
2. **El texto vive en negro, el color vive detrás.** Los bloques negros son los que sostienen la lectura; el verde es fondo y energía, nunca soporte de texto pequeño.
3. **La revelación es el momento del producto.** La silueta pasando a foto y el nombre entrando es la única animación que merece coreografía. Todo lo demás es funcional.

---

## 2. Color

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#12100F` | Paneles, texto sobre claro. Casi negro, no negro puro. |
| `--green` | `#16C64F` | Fondo de marca, campo de la tarjeta. |
| `--lime` | `#C6F833` | Acento: subrayados, cuñas diagonales, estado activo. |
| `--deep` | `#0B3D2E` | Verde profundo: banda inferior, fondo de página. |
| `--white` | `#FFFFFF` | Texto sobre `ink` y sobre `deep`. Silueta. |
| `--mute` | `#A8B3AD` | Texto secundario **solo sobre `ink`**. |
| `--danger` | `#FF4D3D` | Puja rechazada, desconexión. |

### Contraste, medido no supuesto

| Combinación | Ratio | Veredicto |
|---|---|---|
| `white` sobre `ink` | 18.97:1 | ✅ |
| `lime` sobre `ink` | 15.25:1 | ✅ |
| `green` sobre `ink` | 8.34:1 | ✅ |
| `ink` sobre `green` | 8.34:1 | ✅ |
| `ink` sobre `lime` | 15.25:1 | ✅ |
| `white` sobre `deep` | 12.20:1 | ✅ |
| `mute` sobre `ink` | 8.78:1 | ✅ |
| **`white` sobre `green`** | **2.28:1** | ❌ **PROHIBIDO** |

> **Regla dura:** nunca texto blanco sobre `--green`. Falla WCAG por más del doble. Si un texto tiene que ir sobre verde, va en `--ink`. Si tiene que ir en blanco, va sobre un panel `--ink` o sobre `--deep`. La referencia visual hace exactamente esto y por eso funciona.

Fondo de página: `--deep`. La tarjeta de subasta es la que trae el `--green`.

---

## 3. Tipografía

Pareja *Sports/Fitness*: **Barlow Condensed** para display, **Barlow** para el resto. Ambas en Google Fonts, ambas con rango completo de pesos y cifras que alinean.

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
```

```css
@theme {
  --font-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --font-body: "Barlow", system-ui, sans-serif;
}
```

| Rol | Familia | Peso | Tamaño | Tracking | Caja |
|---|---|---|---|---|---|
| Cifra heroica (`$50 M`) | display | 900 | `clamp(3.5rem, 9vw, 7rem)` | `-0.03em` | mayúsculas |
| Etiqueta sobre la cifra (`PRECIO`) | display | 800 | `clamp(1.75rem, 4vw, 3rem)` | `-0.02em` | mayúsculas |
| Nombre revelado | display | 900 | `clamp(2rem, 5vw, 3.75rem)` | `-0.02em` | mayúsculas |
| Sub-etiqueta (`LATERAL IZQUIERDO`) | display | 700 | `clamp(0.9rem, 1.6vw, 1.25rem)` | `0.08em` | mayúsculas |
| Cuerpo, pistas, listas | body | 400–600 | `1rem` mínimo | normal | normal |
| Cifras de dinero y reloj | body | 700 | según contexto | normal | `tabular-nums` |

**Cifras tabulares obligatorias** en saldos, pujas y cuenta atrás. Sin ellas los números bailan al cambiar y la subasta parece rota.

Mínimo 16 px de cuerpo en móvil. Nada de texto de interfaz por debajo de 14 px.

---

## 4. Formas

La geometría es tan de marca como el color.

- **Panel negro:** esquina superior izquierda recta, esquina inferior derecha con un bisel de 28 px. Un solo `clip-path` reutilizado.
  ```css
  --clip-panel: polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%);
  ```
- **Cuña diagonal:** franja lima a 18° que cruza por detrás de la silueta, saliendo del encuadre por ambos lados.
- **Banda inferior:** `--deep`, ocupa el cuarto inferior, ancla visualmente al jugador.
- **Radios:** `4px` en controles, `0` en paneles de marca. La tarjeta no lleva esquinas redondeadas grandes: eso la devuelve a interfaz genérica.

---

## 5. Movimiento

Presupuesto de animación: **dos elementos por vista como máximo**. Todo lo demás cambia sin transición o solo de color.

| Momento | Qué se mueve | Duración | Curva |
|---|---|---|---|
| Puja aceptada | Cifra de la puja: subida de 8 px + destello lima | 200 ms | `ease-out` |
| Reloj bajo 5 s | Pulso de escala del contador, 1 por segundo | 400 ms | `ease-in-out` |
| Revelación | Silueta → foto en cruz, y el nombre entra desde la izquierda tras 150 ms | 450 ms | `cubic-bezier(.16,1,.3,1)` |
| Cambio de candidato | Tarjeta sale a la izquierda, entra la nueva | 300 ms | `ease-out` |

Solo `transform` y `opacity`. Nunca animar `width`, `height` ni `top`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Con movimiento reducido la revelación sigue ocurriendo: cambia el contenido de golpe, sin cruce. La información nunca depende de la animación.

---

## 6. Interacción

- Todo lo pulsable lleva `cursor-pointer` y un estado de foco visible: `outline: 3px solid var(--lime); outline-offset: 2px`.
- Objetivo táctil mínimo **44 × 44 px**. El botón de pujar es el elemento más importante de la pantalla: dale sitio.
- El botón de pujar se deshabilita mientras el servidor no ha contestado, para que nadie duplique la puja al golpear dos veces.
- El rechazo de una puja aparece **junto al campo de importe**, no en una barra global arriba. El error tiene que estar donde está el problema.
- El color nunca es el único indicador: quien va ganando la puja lleva además una etiqueta de texto, no solo el fondo lima.

---

## 7. Iconos

SVG de Lucide, `viewBox` 24×24, trazo 2. **Nunca emojis.** Los pocos que hacen falta: reloj, martillo de subasta, usuario desconectado, tick de listo.

---

## 8. Responsive

Puntos de control: 375, 768, 1024, 1440.

- **Móvil:** la tarjeta pasa a vertical, la silueta se recorta a la mitad superior, las pistas se apilan en dos columnas. Los controles de puja quedan fijos abajo, dentro del pulgar.
- **Escritorio:** tarjeta apaisada como la referencia, pistas a la derecha, marcador de jugadores en columna lateral.
- Nada de desplazamiento horizontal en ningún ancho.

---

## 9. Errores que devuelven el diseño a lo genérico

- Esquinas redondeadas grandes en la tarjeta de subasta.
- Texto blanco sobre verde (además de ilegible, es lo primero que delata una plantilla).
- Sombras difusas tipo tarjeta de material. Aquí el volumen lo dan los bloques planos y los recortes.
- La silueta contenida dentro de su caja en vez de rompiendo el borde superior.
- Grises azulados de interfaz por defecto. Los neutros de este proyecto tiran a verde.
- Cuerpo en Barlow Condensed. La condensada es solo display; leer párrafos en condensada cansa.

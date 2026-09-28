"""
Genera los iconos y la imagen social del cliente.

    python tools/build-og-assets.py

Escribe en packages/client/public/:
    favicon.png          32x32   fallback para navegadores sin SVG
    apple-touch-icon.png 180x180 iOS no acepta transparencia ni esquinas
    og-image.png         1200x630 previsualizacion al compartir el enlace

Por que un script y no los binarios a mano: los PNG quedan versionados,
pero se regeneran con `pnpm og:assets` cuando cambia el nombre, el lema
o la paleta. Editar el PNG a mano lo deja desincronizado de index.html,
que es donde se referencian.

La geometria del balon es la misma que favicon.svg y que BallIcon en
src/screens/Landing.tsx, expresada una sola vez en HEXAGON/SPOKES para
que los tres ficheros no se separen al tocar uno.

Las fuentes (Barlow Condensed, OFL 1.1) estan vendorizadas en
tools/fonts/ para que la generacion no dependa de la red.
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC = os.path.join(ROOT, "packages", "client", "public")
FONTS = os.path.join(HERE, "fonts")
CLIENT_ASSETS = os.path.join(ROOT, "packages", "client", "src", "assets")

# Paleta de packages/client/src/index.css (@theme).
INK = (0x12, 0x10, 0x0F)
DEEP = (0x0B, 0x3D, 0x2E)
GREEN = (0x16, 0xC6, 0x4F)
LIME = (0xC6, 0xF8, 0x33)
WHITE = (255, 255, 255)
MUTE = (0xA8, 0xB3, 0xAD)

# Gradiente de 150 grados del panel AuctionStage: 150deg en CSS va de
# arriba-izquierda a abajo-derecha, y es el fondo que ya usa el juego.
GRADIENT = ((0x17, 0x23, 0x1C), 0.56, (0x12, 0x10, 0x0F), (0x0B, 0x3D, 0x2E))

# Texto. Sale del texto real de la landing, no de nada inventado:
# el kicker es el eyebrow del hero, el lema el parrafo de debajo del H1.
KICKER = "LA SUBASTA PARA LOS QUE SABEN DE FUTBOL"
TITLE_1 = "PUJA A CIEGAS."
TITLE_2 = "ARMA LA LEYENDA."
TAGLINE = "El nombre esta oculto. La puja esta abierta."

SS = 4  # supermuestreo para los bordes de los iconos pequenos

# Balon en espacio 24x24, identico a favicon.svg / BallIcon.
HEXAGON = [(12, 7), (15, 9), (15, 13), (12, 15), (9, 13), (9, 9)]
SPOKES = [((9, 9), (6, 8)), ((18, 10), (21, 9)), ((9, 15), (6, 17)),
          ((18, 13), (21, 15)), ((12, 6), (12, 3)), ((12, 15), (12, 21))]
BALL_R = 9.0


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        sys.exit(f"Falta {path}. Las fuentes Barlow van vendorizadas en tools/fonts/.")
    return ImageFont.truetype(path, size)


def track(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str,
          fnt: ImageFont.FreeTypeFont, fill, spacing: float) -> float:
    """Escribe con interletraje manual y devuelve la x advanced."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + spacing
    return x - spacing


def gradient(size: tuple[int, int]) -> Image.Image:
    """Gradiente diagonal, generado en baja resolucion y escalado."""
    small = Image.new("RGB", (64, 36))
    sd = ImageDraw.Draw(small)
    start, mid_at, mid, end = GRADIENT
    diag = 64 + 36
    for px in range(64):
        for py in range(36):
            t = (px * 0.56 + py * 0.44) / diag
            if t <= mid_at:
                k = t / mid_at
                c = tuple(round(a + (b - a) * k) for a, b in zip(start, mid))
            else:
                k = (t - mid_at) / (1 - mid_at)
                c = tuple(round(a + (b - a) * k) for a, b in zip(mid, end))
            sd.point((px, py), c)
    return small.resize(size, Image.BICUBIC)


def pitch_arcs(size: tuple[int, int]) -> Image.Image:
    """Los arcos del panel de la subasta, en lima al 22% como en la app."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r in range(320, 1560, 150):
        d.ellipse([w * 0.72 - r, h * 0.30 - r, w * 0.72 + r, h * 0.30 + r],
                  outline=LIME + (56,), width=3)
    return layer


def glow(size: tuple[int, int], center: tuple[int, int], radius: int, color) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([center[0] - radius, center[1] - radius,
               center[0] + radius, center[1] + radius], fill=color)
    return layer.filter(ImageFilter.GaussianBlur(radius // 2))


def skew_bar(size: tuple[int, int], color) -> Image.Image:
    """La barra lima inclinada que cierra los paneles del juego."""
    w, h = size
    bar = Image.new("RGBA", (int(w * 0.30), h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rectangle([0, 0, bar.width, h], fill=color)
    return bar.transform(bar.size, Image.AFFINE, (1, -0.7, 0, 0, 1, 0),
                         resample=Image.BICUBIC)


def draw_ball(d: ImageDraw.ImageDraw, size: int, color) -> None:
    """La marca del balon, escalada a `size` px, con el trazo de 2.2/24."""
    k = size / 24.0
    s = SS if size <= 64 else 1
    w = max(1, round(2.2 * k * s))
    c = size * s / 2
    r = BALL_R * k * s
    d.ellipse([c - r, c - r, c + r, c + r], outline=color, width=w)
    d.polygon([(x * k * s, y * k * s) for x, y in HEXAGON], outline=color, width=w)
    for a, b in SPOKES:
        d.line([(a[0] * k * s, a[1] * k * s), (b[0] * k * s, b[1] * k * s)],
               fill=color, width=w, joint="curve")


def build_icon(size: int, path: str) -> None:
    """Cuadrado lima con el balon. Sin transparencia: iOS la descarta."""
    total = size * SS
    img = Image.new("RGB", (total, total), LIME)
    draw_ball(ImageDraw.Draw(img), total, INK)
    img.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, ROOT)}  {size}x{size}")


def build_og(path: str) -> None:
    w, h = 1200, 630
    margin = 72
    gutter = 40
    base = gradient((w, h)).convert("RGBA")

    sil_path = os.path.join(CLIENT_ASSETS, "hero-silhouette.png")
    if not os.path.exists(sil_path):
        sys.exit(f"Falta {sil_path}.")
    sil = Image.open(sil_path).convert("RGBA")
    # La silueta es negra pura con alfa: el color lo pone la mascara.
    shape = Image.new("RGBA", sil.size, WHITE + (255,))
    shape.putalpha(sil.getchannel("A"))
    target_h = 600
    scale = target_h / sil.height
    shape = shape.resize((max(1, round(sil.width * scale)), target_h), Image.LANCZOS)
    shape = shape.filter(ImageFilter.GaussianBlur(1.2))
    shape.putalpha(shape.getchannel("A").point(lambda a: int(a * 0.92)))
    # Se sale por la derecha a proposito: recorta el hombro, no la cara, y
    # deja la columna de texto con sitio.
    sx = w + 40 - shape.width
    sy = h - shape.height

    layers = [
        pitch_arcs((w, h)),
        glow((w, h), (int(w * 0.70), int(h * 0.22)), 330, GREEN + (60,)),
        glow((w, h), (int(w * 0.06), int(h * 0.95)), 260, LIME + (26,)),
    ]
    for extra in layers:
        base = Image.alpha_composite(base, extra)
    # paste con mascara y no alpha_composite: recorta el desborde solo.
    base.paste(shape, (sx, sy), shape)

    draw = ImageDraw.Draw(base)
    # (texto, fuente, cuerpo, interletraje, color, x, y)
    title_size = 90
    items = [
        (KICKER, "BarlowCondensed-SemiBold.ttf", 27, 4.6, LIME + (235,), margin, 96),
        (TITLE_1, "BarlowCondensed-Black.ttf", title_size, 1.0, WHITE + (255,), margin, 148),
        (TITLE_2, "BarlowCondensed-Black.ttf", title_size, 1.0, LIME + (255,), margin, 148 + 96),
        (TAGLINE, "BarlowCondensed-SemiBold.ttf", 38, 0.0, WHITE + (188,), margin, 148 + 96 + 96 + 14),
    ]

    # La silueta es blanca, asi que un titulo encima desaparece en vez de
    # solaparse. Se comprueba con las medidas reales, no a ojo: si alguien
    # alarga el lema, esto para el build en vez de colar una imagen mala.
    right = 0.0
    for text, fname, size, spacing, _, x, _y in items:
        f = font(fname, size)
        width = sum(draw.textlength(c, font=f) + spacing for c in text) - spacing
        right = max(right, x + width)
    if right > sx - gutter:
        sys.exit(
            f"El texto llega a x={right:.0f} y la silueta empieza en x={sx}. "
            f"Hacen falta {gutter}px de separacion: acorta el copy o baja el cuerpo "
            f"del titulo (ahora {title_size}px)."
        )

    for text, fname, size, spacing, color, x, y in items:
        if spacing:
            track(draw, (x, y), text, font(fname, size), color, spacing)
        else:
            draw.text((x, y), text, font=font(fname, size), fill=color)

    base.alpha_composite(skew_bar((210, 13), LIME + (255,)), (margin, h - 78))

    base.convert("RGB").save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, ROOT)}  {w}x{h}  texto hasta x={right:.0f}, silueta desde x={sx}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=PUBLIC, help="directorio de salida")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    print("Generando assets de paquetes/client/public:")
    build_icon(32, os.path.join(args.out, "favicon.png"))
    build_icon(180, os.path.join(args.out, "apple-touch-icon.png"))
    build_og(os.path.join(args.out, "og-image.png"))
    print("Listo.")


if __name__ == "__main__":
    main()

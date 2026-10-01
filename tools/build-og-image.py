"""
Genera la vista previa del enlace (og-image.png, 1200x630) de Puja el Once.

    python tools/build-og-image.py

Composicion: campo de cesped con franjas, tarjeta crema con el logo, el lema y
tres datos clave, y a la derecha la carta misteriosa (silueta + precio de salida)
que es lo que hace el juego. Usa el logo ya recortado (public/logo-symbol.png y
public/logo-wordmark.png: ejecuta antes tools/build-logo.cjs) y las tipografias de
la web (Unbounded y Jost, OFL 1.1, vendorizadas en tools/fonts/).

Se dibuja al doble de tamano y se reduce, para que los bordes redondeados salgan
limpios.
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC = os.path.join(ROOT, "packages", "client", "public")
ASSETS = os.path.join(ROOT, "packages", "client", "src", "assets")
FONTS = os.path.join(HERE, "fonts")

W, H, S = 1200, 630, 2  # S = factor de supermuestreo

FOREST = (0x0C, 0x24, 0x1C)
FOREST_2 = (0x12, 0x34, 0x28)
PINE = (0x0E, 0x51, 0x38)
PITCH = (0x15, 0x83, 0x4A)
PITCH_SOFT = (0xE4, 0xF0, 0xDF)
GOLD = (0xF0, 0xB8, 0x3D)
CANVAS = (0xF5, 0xF4, 0xEC)
SLATE = (0x53, 0x61, 0x58)


def font(name: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(os.path.join(FONTS, name), size * S)
    f.set_variation_by_axes([weight])
    return f


def unbounded(size: int, weight: int = 800) -> ImageFont.FreeTypeFont:
    return font("Unbounded[wght].ttf", size, weight)


def jost(size: int, weight: int = 600) -> ImageFont.FreeTypeFont:
    return font("Jost[wght].ttf", size, weight)


def gradient(size: tuple[int, int], a: tuple, b: tuple, angle_deg: float = 120) -> Image.Image:
    """Degradado lineal como el CSS `linear-gradient(120deg, a, b)`."""
    import math

    w, h = size
    rad = math.radians(angle_deg)
    dx, dy = math.sin(rad), -math.cos(rad)
    length = abs(w * dx) + abs(h * dy)
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = ((x - w / 2) * dx + (y - h / 2) * dy) / length + 0.5
            t = max(0.0, min(1.0, t))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_rounded(base: Image.Image, fill: Image.Image | tuple, box: tuple[int, int, int, int], radius: int) -> None:
    x0, y0, x1, y1 = (v * S for v in box)
    size = (x1 - x0, y1 - y0)
    layer = fill if isinstance(fill, Image.Image) else Image.new("RGB", size, fill)
    base.paste(layer.convert("RGB"), (x0, y0), rounded_mask(size, radius * S))


def text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], value: str, fnt, fill, anchor: str = "la") -> None:
    draw.text((xy[0] * S, xy[1] * S), value, font=fnt, fill=fill, anchor=anchor)


def text_width(draw: ImageDraw.ImageDraw, value: str, fnt) -> float:
    return draw.textlength(value, font=fnt) / S


def load(path: str, width: int | None = None, height: int | None = None) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    if width:
        height = round(im.height * width / im.width)
    elif height:
        width = round(im.width * height / im.height)
    return im.resize((width * S, height * S), Image.LANCZOS)


def main() -> None:
    # --- fondo: cesped con franjas segadas -----------------------------------
    img = gradient((W * S, H * S), PINE, PITCH, 120)
    stripes = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    for x in range(0, W * S, 144 * S):
        sd.rectangle((x, 0, x + 72 * S, H * S), fill=(0, 0, 0, 18))
    img.paste(stripes, (0, 0), stripes)
    # circulo central del campo, de adorno (en una capa aparte para que la transparencia cuente)
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cx, cy, r = 1010, 560, 330
    ImageDraw.Draw(ring).ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), outline=(255, 255, 255, 38), width=8 * S)
    img.paste(ring, (0, 0), ring)
    draw = ImageDraw.Draw(img)

    # --- tarjeta crema (logo + lema + datos) ----------------------------------
    paste_rounded(img, CANVAS, (56, 56, 706, 574), 44)
    draw = ImageDraw.Draw(img)

    symbol = load(os.path.join(PUBLIC, "logo-symbol.png"), width=150)
    img.paste(symbol, (92 * S, 92 * S), symbol)
    wordmark = load(os.path.join(PUBLIC, "logo-wordmark.png"), width=420)
    img.paste(wordmark, (262 * S, round((92 + (150 - wordmark.height / S) / 2) * S)), wordmark)

    tagline = jost(35, 600)
    lines = ["Pujas por una silueta, se revela", "quién es y armas tu once."]
    for i, line in enumerate(lines):
        text(draw, (92, 288 + i * 46), line, tagline, FOREST)

    # datos clave
    chips = ["2–4 jugadores", "Gratis", "Sin cuentas"]
    chip_font = jost(26, 700)
    x = 92
    for chip in chips:
        w = text_width(draw, chip, chip_font) + 44
        draw.rounded_rectangle((x * S, 424 * S, (x + w) * S, 480 * S), radius=28 * S, fill=PITCH_SOFT)
        text(draw, (x + 22, 452), chip, chip_font, PINE, anchor="lm")
        x += w + 14
    text(draw, (92, 520), "pujaelonce · juego de amigos, en el navegador", jost(23, 500), SLATE, anchor="lm")

    # --- carta misteriosa ----------------------------------------------------
    box = (746, 56, 1144, 574)
    paste_rounded(img, GOLD, box, 44)
    inner = (box[0] + 8, box[1] + 8, box[2] - 8, box[3] - 8)
    paste_rounded(img, gradient(((inner[2] - inner[0]) * S, (inner[3] - inner[1]) * S), FOREST_2, FOREST, 160), inner, 37)
    draw = ImageDraw.Draw(img)

    # silueta en blanco (la imagen es negra sobre transparente: se usa solo su alfa)
    sil = Image.open(os.path.join(ASSETS, "hero-silhouette.png")).convert("RGBA")
    # El alfa de la imagen trae motas semitransparentes (tablero) en la zona del pecho:
    # se binariza para quedarse solo con la silueta, y se desvanece por abajo para que
    # el corte recto del recorte no se note.
    alpha = sil.getchannel("A").point(lambda v: 255 if v > 150 else 0)
    fade_from = round(alpha.height * 0.56)
    fade = Image.new("L", alpha.size, 255)
    fd = ImageDraw.Draw(fade)
    for y in range(fade_from, alpha.height):
        fd.line((0, y, alpha.width, y), fill=round(255 * (1 - (y - fade_from) / (alpha.height - fade_from))))
    from PIL import ImageChops

    alpha = ImageChops.multiply(alpha, fade)
    white = Image.new("RGBA", sil.size, (255, 255, 255, 235))
    white.putalpha(alpha)
    sil_h = 430
    white = white.resize((round(white.width * sil_h / white.height) * S, sil_h * S), Image.LANCZOS)
    sx = (box[0] + box[2]) // 2 - white.width // (2 * S)
    img.paste(white, (sx * S, (inner[3] - sil_h - 76) * S), white)

    # precio de salida y pregunta
    label = "SALE A 90 M"
    lf = unbounded(21, 800)
    lw = text_width(draw, label, lf) + 40
    draw.rounded_rectangle(((box[0] + 30) * S, (box[1] + 30) * S, (box[0] + 30 + lw) * S, (box[1] + 82) * S), radius=26 * S, fill=GOLD)
    text(draw, (box[0] + 50, box[1] + 56), label, lf, FOREST, anchor="lm")

    text(draw, ((box[0] + box[2]) / 2, inner[3] - 36), "¿QUIÉN ES?", unbounded(28, 800), GOLD, anchor="mm")

    out = img.resize((W, H), Image.LANCZOS)
    path = os.path.join(PUBLIC, "og-image.png")
    out.save(path, optimize=True)
    print(f"{os.path.relpath(path, ROOT)} ({W}x{H}, {os.path.getsize(path) // 1024} KB)")


if __name__ == "__main__":
    main()

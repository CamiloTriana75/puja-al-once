"""
Genera las imagenes del servidor de Discord con la identidad del juego.

    python scripts/make-images.py

Escribe en assets/:
    icon.png        1024x1024  icono del servidor (logo sobre bosque)
    banner.png      960x540    banner (requiere boost nivel 2)
    splash.png      1920x1080  fondo de las invitaciones (boost nivel 1)
    welcome.png, rules.png, howto.png   1200x300  cabeceras de los mensajes fijos
    emoji-*.png     128x128    emojis del servidor

Usa el logo ya recortado (packages/client/public/logo-symbol.png) y las tipografias de
la web (Unbounded y Jost, OFL 1.1, en tools/fonts/). Dibuja al doble y reduce, para que
los bordes salgan limpios.
"""

from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(HERE, "..", "assets")
FONTS = os.path.join(ROOT, "tools", "fonts")
SYMBOL = os.path.join(ROOT, "packages", "client", "public", "logo-symbol.png")
SILHOUETTE = os.path.join(ROOT, "packages", "client", "src", "assets", "hero-silhouette.png")

FOREST = (0x0C, 0x24, 0x1C)
FOREST_2 = (0x12, 0x34, 0x28)
PINE = (0x0E, 0x51, 0x38)
PITCH = (0x15, 0x83, 0x4A)
GOLD = (0xF0, 0xB8, 0x3D)
GOLD_SOFT = (0xF5, 0xC6, 0x5C)
CANVAS = (0xF5, 0xF4, 0xEC)
WHITE = (255, 255, 255)

os.makedirs(OUT, exist_ok=True)


def font(name: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    f.set_variation_by_axes([weight])
    return f


def unbounded(size: int, weight: int = 800):
    return font("Unbounded[wght].ttf", size, weight)


def jost(size: int, weight: int = 600):
    return font("Jost[wght].ttf", size, weight)


def gradient(size, a, b, angle_deg=120):
    w, h = size
    rad = math.radians(angle_deg)
    dx, dy = math.sin(rad), -math.cos(rad)
    length = abs(w * dx) + abs(h * dy)
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = max(0.0, min(1.0, ((x - w / 2) * dx + (y - h / 2) * dy) / length + 0.5))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def striped(size, a=PINE, b=PITCH, stripe=72):
    img = gradient(size, a, b, 120)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, size[0], stripe * 2):
        d.rectangle((x, 0, x + stripe, size[1]), fill=(0, 0, 0, 20))
    img.paste(layer, (0, 0), layer)
    return img


def symbol(px: int) -> Image.Image:
    return Image.open(SYMBOL).convert("RGBA").resize((px, px), Image.LANCZOS)


def paste_center(base: Image.Image, top: Image.Image, cx: int, cy: int) -> None:
    base.paste(top, (cx - top.width // 2, cy - top.height // 2), top)


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print(f"assets/{name} ({img.width}x{img.height}, {os.path.getsize(path) // 1024} KB)")


# --------------------------------------------------------------------------- icono y banners


def make_icon() -> None:
    img = gradient((1024, 1024), FOREST_2, FOREST, 160)
    paste_center(img, symbol(820), 512, 512)
    save(img.convert("RGB"), "icon.png")


def make_banner(w: int, h: int, name: str) -> None:
    k = w / 960
    img = striped((w, h), PINE, PITCH, round(60 * k))
    d = ImageDraw.Draw(img)
    paste_center(img, symbol(round(300 * k)), round(190 * k), h // 2)
    title = unbounded(round(64 * k), 800)
    d.text((round(380 * k), round(h / 2 - 70 * k)), "PUJA", font=title, fill=WHITE, anchor="ls")
    d.text((round(380 * k), round(h / 2 + 10 * k)), "EL ONCE", font=title, fill=GOLD, anchor="ls")
    d.text((round(384 * k), round(h / 2 + 70 * k)), "Puja a ciegas. Arma tu once.", font=jost(round(30 * k), 600), fill=WHITE, anchor="ls")
    save(img, name)


def make_header(name: str, title: str, subtitle: str) -> None:
    w, h = 1200, 300
    img = striped((w, h), FOREST_2, FOREST, 60)
    d = ImageDraw.Draw(img)
    paste_center(img, symbol(190), 150, h // 2)
    d.text((290, h // 2 - 8), title, font=unbounded(64 if len(title) < 12 else 52, 800), fill=GOLD, anchor="ls")
    d.text((294, h // 2 + 56), subtitle, font=jost(34, 500), fill=WHITE, anchor="ls")
    d.rectangle((0, h - 10, w, h), fill=PITCH)
    save(img, name)


# --------------------------------------------------------------------------- emojis (128x128)

S = 4  # supermuestreo
E = 128 * S


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (E, E), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def finish(img: Image.Image, name: str) -> None:
    save(img.resize((128, 128), Image.LANCZOS), f"emoji-{name}.png")


def ball(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill=GOLD, ink=FOREST) -> None:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill, outline=ink, width=round(r * 0.09))
    k = r / 14.5

    def pt(x, y):
        return (cx + (x - 16) * k, cy + (y - 16) * k)

    pent = [pt(16, 10.2), pt(21.52, 14.21), pt(19.41, 20.69), pt(12.59, 20.69), pt(10.48, 14.21)]
    d.polygon(pent, fill=ink)
    for a, b in (((16, 10.2), (16, 3.4)), ((21.52, 14.21), (28.12, 12.07)), ((19.41, 20.69), (23.49, 26.31)), ((12.59, 20.69), (8.51, 26.31)), ((10.48, 14.21), (3.88, 12.07))):
        d.line((pt(*a), pt(*b)), fill=ink, width=round(1.7 * k), joint="curve")


def emoji_balon() -> None:
    img, d = canvas()
    ball(d, E / 2, E / 2, E * 0.47)
    finish(img, "balon")


def emoji_puja() -> None:
    img, _ = canvas()
    s = Image.open(SYMBOL).convert("RGBA").resize((round(E * 0.96), round(E * 0.96)), Image.LANCZOS)
    paste_center(img, s, E // 2, E // 2)
    finish(img, "puja")


def emoji_mazo() -> None:
    img, d = canvas()
    layer = Image.new("RGBA", (E, E), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    c = E / 2
    ld.rounded_rectangle((c - E * 0.06, c - E * 0.02, c + E * 0.06, c + E * 0.46), radius=E * 0.05, fill=(200, 137, 44))
    ld.rounded_rectangle((c - E * 0.34, c - E * 0.28, c + E * 0.34, c + E * 0.02), radius=E * 0.08, fill=FOREST)
    for x in (c - E * 0.21, c + E * 0.13):
        ld.rectangle((x, c - E * 0.28, x + E * 0.08, c + E * 0.02), fill=GOLD)
    layer = layer.rotate(35, resample=Image.BICUBIC, center=(c, c))
    img.paste(layer, (0, 0), layer)
    finish(img, "mazo")


def emoji_vendido() -> None:
    img, d = canvas()
    c, r = E / 2, E * 0.47
    d.ellipse((c - r, c - r, c + r, c + r), fill=GOLD, outline=FOREST, width=round(E * 0.04))
    d.line([(c - r * 0.5, c + r * 0.02), (c - r * 0.12, c + r * 0.4), (c + r * 0.52, c - r * 0.36)], fill=FOREST, width=round(E * 0.1), joint="curve")
    finish(img, "vendido")


def emoji_silueta() -> None:
    img, d = canvas()
    c, r = E / 2, E * 0.47
    d.ellipse((c - r, c - r, c + r, c + r), fill=FOREST_2, outline=GOLD, width=round(E * 0.04))
    sil = Image.open(SILHOUETTE).convert("RGBA")
    a = sil.getchannel("A").point(lambda v: 255 if v > 150 else 0)
    box = a.getbbox()
    top = a.crop((box[0], box[1], box[2], box[1] + int((box[3] - box[1]) * 0.62)))
    white = Image.new("RGBA", top.size, WHITE)
    white.putalpha(top)
    scale = (E * 0.72) / white.height
    white = white.resize((round(white.width * scale), round(white.height * scale)), Image.LANCZOS)
    mask = Image.new("L", (E, E), 0)
    ImageDraw.Draw(mask).ellipse((c - r + E * 0.03, c - r + E * 0.03, c + r - E * 0.03, c + r - E * 0.03), fill=255)
    layer = Image.new("RGBA", (E, E), (0, 0, 0, 0))
    layer.paste(white, (round(c - white.width / 2), round(c + r - white.height - E * 0.04)), white)
    layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (E, E), 0), mask))
    img.paste(layer, (0, 0), layer)
    finish(img, "silueta")


def emoji_once() -> None:
    img, d = canvas()
    c, r = E / 2, E * 0.47
    d.ellipse((c - r, c - r, c + r, c + r), fill=GOLD, outline=FOREST, width=round(E * 0.04))
    d.text((c, c + E * 0.01), "11", font=unbounded(round(E * 0.42), 900), fill=FOREST, anchor="mm")
    finish(img, "once")


def emoji_hinchada() -> None:
    img, d = canvas()
    pts = []
    for i in range(361):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((E / 2 + x * E * 0.027, E * 0.46 - y * E * 0.027))
    d.polygon(pts, fill=GOLD, outline=FOREST, width=round(E * 0.035))
    finish(img, "hinchada")


if __name__ == "__main__":
    make_icon()
    make_banner(960, 540, "banner.png")
    make_banner(1920, 1080, "splash.png")
    make_header("welcome.png", "BIENVENIDO", "Al vestuario de Puja el Once")
    make_header("rules.png", "REGLAS", "Pujar fuerte sí. Faltar al respeto, no.")
    make_header("howto.png", "CÓMO SE JUEGA", "El juego en un minuto")
    emoji_puja()
    emoji_balon()
    emoji_mazo()
    emoji_vendido()
    emoji_silueta()
    emoji_once()
    emoji_hinchada()

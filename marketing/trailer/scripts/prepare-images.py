"""
Limpia la silueta para el video: la imagen original trae un tramo con un
cuadriculado de transparencia (cuadros opacos y vacios alternos) abajo a la
derecha, que se nota a 1080x1920. Se cierran esos huecos (dilatar + erosionar
el alfa) y se binariza el borde.
"""
import os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(HERE, "..", "public", "img", "hero-silhouette.png")
im = Image.open(path).convert("RGBA")
alpha = im.getchannel("A")
closed = alpha.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.MinFilter(17))
closed = closed.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(0.8))
black = Image.new("RGBA", im.size, (0, 0, 0, 255))
black.putalpha(closed)
black.save(path)
print("public/img/hero-silhouette.png (limpia)")

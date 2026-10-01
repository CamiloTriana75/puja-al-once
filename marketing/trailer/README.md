# Trailer vertical de Puja el Once

Video de 29 s en 1080x1920 (TikTok, Reels, Shorts) hecho con [Remotion](https://www.remotion.dev).
No forma parte del workspace pnpm: tiene su propio `npm install`.

```bash
cd marketing/trailer
npm install
npm run assets             # copia logo, retrato, silueta, mazo y fuentes del juego; sintetiza musica y efectos
npm run render             # out/puja-el-once-trailer.mp4
npm run render:sin-musica  # solo efectos, para poner encima un audio de tendencia en la app
npm run studio             # editor en el navegador para retocar escenas y tiempos
```

- Escenas en `src/scenes.tsx`; tiempos en `src/timeline.json` (lo leen el video y el script de audio,
  asi el golpe del mazo cae justo en el "drop" de la musica).
- Audio: `scripts/make-audio.py` lo sintetiza todo con numpy (musica a 120 BPM y efectos: silbato,
  balon, publico, whoosh...). No usa muestras de terceros. El mazo es el `gavel.wav` del juego
  (ver creditos del sonido en la web).
- Licencia de Remotion: gratis para particulares y empresas de hasta 3 personas.

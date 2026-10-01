"""
Sintetiza la musica y los efectos del trailer (solo numpy, sin muestras de terceros).

    python scripts/make-audio.py

Escribe en public/audio/:
    music.wav      base electronica a 120 BPM, La menor (Am-F-C-G), 29 s.
                   Intro -> entra el bombo -> subida -> silencio -> "drop" justo
                   en el golpe de mazo (timeline.json: gavelImpact) -> golpe final
                   en el cierre (endHit) y se apaga.
    whistle.wav, whistle-final.wav, kick-ball.wav, crowd.wav, whoosh.wav,
    pop.wav, coin.wav, tick.wav, reveal.wav, boom.wav

Todo es sintesis propia: no hay derechos de terceros en el audio. El mazo
(gavel.wav) es el del juego, ver los creditos del sonido en la web.
"""

from __future__ import annotations

import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "public", "audio")
TIMELINE = json.load(open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf8"))

SR = 44100
FPS = TIMELINE["fps"]
BEAT = 60 / TIMELINE["bpm"]  # 0.5 s
BAR = 4 * BEAT  # 2 s
LENGTH = TIMELINE["durationInFrames"] / FPS  # 29 s
DROP = TIMELINE["gavelImpact"] / FPS  # 14 s
END_HIT = TIMELINE["endHit"] / FPS  # 26 s

rng = np.random.default_rng(11)


# --------------------------------------------------------------------------- utilidades


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def noise(seconds: float) -> np.ndarray:
    return rng.standard_normal(int(seconds * SR))


def band(x: np.ndarray, lo: float | None = None, hi: float | None = None, edge: float = 0.15) -> np.ndarray:
    """Filtro paso banda por FFT con bordes suaves (offline, sin fase que importe)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    gain = np.ones_like(f)
    if lo:
        gain *= np.clip((f - lo * (1 - edge)) / (lo * edge * 2), 0, 1)
    if hi:
        gain *= np.clip((hi * (1 + edge) - f) / (hi * edge * 2), 0, 1)
    return np.fft.irfft(spec * gain, len(x))


def sweep_band(x: np.ndarray, centers: np.ndarray, q: float = 0.6, win: int = 2048) -> np.ndarray:
    """Paso banda que se mueve en el tiempo (solapar-sumar con ventanas de Hann)."""
    hop = win // 4
    out = np.zeros(len(x) + win)
    window = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    for start in range(0, len(x), hop):
        chunk = np.zeros(win)
        seg = x[start : start + win]
        chunk[: len(seg)] = seg
        c = centers[min(start + win // 2, len(centers) - 1)]
        width = c * q
        gain = np.exp(-0.5 * ((f - c) / width) ** 2)
        out[start : start + win] += np.fft.irfft(np.fft.rfft(chunk * window) * gain, win) * window
    return out[: len(x)] / 1.5


def saw(freq: float, seconds: float, cutoff: float = 6000, detune: float = 0.0) -> np.ndarray:
    """Diente de sierra aditivo con los armonicos ya filtrados (paso bajo suave en `cutoff`)."""
    t = t_axis(seconds)
    out = np.zeros_like(t)
    f0 = freq * (1 + detune)
    k = 1
    while k * f0 < min(12000, SR / 2 - 200) and k <= 60:
        weight = (1 / k) / (1 + (k * f0 / cutoff) ** 2)
        out += weight * np.sin(2 * np.pi * k * f0 * t + k * 0.7)
        k += 1
    return out


def env(seconds: float, attack: float = 0.003, decay: float = 0.2, sustain: float = 0.0, release_at: float | None = None) -> np.ndarray:
    t = t_axis(seconds)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = sustain + (1 - sustain) * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))
    e = a * d
    if release_at is not None:
        e *= np.clip(1 - (t - release_at) / 0.05, 0, 1)
    return e


def place(track: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(track):
        return
    n = min(len(sound), len(track) - i)
    track[i : i + n] += sound[:n] * gain


def note(name: str) -> float:
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def write(name: str, data: np.ndarray, peak: float = 0.89) -> None:
    data = np.atleast_2d(data)
    if data.shape[0] == 1:
        data = np.vstack([data, data])
    m = np.max(np.abs(data)) or 1
    data = data / m * peak
    pcm = (np.clip(data.T, -1, 1) * 32767).astype("<i2")
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"public/audio/{name} ({data.shape[1] / SR:.2f} s)")


# --------------------------------------------------------------------------- bateria


def kick() -> np.ndarray:
    t = t_axis(0.45)
    f = 44 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = band(noise(0.45), 1500, 6000) * np.exp(-t * 400) * 0.6
    return np.tanh((body + click) * 1.6)


def clap() -> np.ndarray:
    n = band(noise(0.35), 900, 3200)
    t = t_axis(0.35)
    e = np.zeros_like(t)
    for offset in (0, 0.011, 0.022):
        e += np.where(t >= offset, np.exp(-(t - offset) / 0.007), 0) * (t < offset + 0.03)
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.11), 0) * 0.7
    return n * e


def hat(open_: bool = False) -> np.ndarray:
    seconds = 0.18 if open_ else 0.06
    return band(noise(seconds), 7000) * env(seconds, 0.001, 0.07 if open_ else 0.018)


def snare() -> np.ndarray:
    t = t_axis(0.25)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return band(noise(0.25), 1500, 7000) * np.exp(-t * 18) + tone * 0.6


def crash(seconds: float = 2.2) -> np.ndarray:
    return band(noise(seconds), 3500) * env(seconds, 0.002, 0.6) + band(noise(seconds), 800, 3500) * env(seconds, 0.002, 0.25) * 0.4


def sub_boom(seconds: float = 1.4) -> np.ndarray:
    t = t_axis(seconds)
    f = 38 + 40 * np.exp(-t * 8)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)


# --------------------------------------------------------------------------- musica

CHORDS = [
    ("A2", ["A3", "C4", "E4"], ["A4", "C5", "E5", "A5"]),
    ("F2", ["F3", "A3", "C4"], ["F4", "A4", "C5", "F5"]),
    ("C3", ["C4", "E4", "G4"], ["C5", "E5", "G5", "C6"]),
    ("G2", ["G3", "B3", "D4"], ["G4", "B4", "D5", "G5"]),
]


def chord_at(t: float):
    return CHORDS[int(t // BAR) % 4]


def music() -> np.ndarray:
    total = LENGTH + 0.2
    L = np.zeros(int(total * SR))
    R = np.zeros(int(total * SR))
    both = lambda s, at, g=1.0, pan=0.0: (place(L, s, at, g * (1 - max(pan, 0))), place(R, s, at, g * (1 + min(pan, 0))))

    build_start = DROP - 2 * BEAT * 2  # 2 s de subida
    k, c, hh, hho, sn = kick(), clap(), hat(), hat(True), snare()

    # --- pad (todo el tema, mas presente en la intro y el cierre)
    for bar in range(int(LENGTH // BAR) + 1):
        t0 = bar * BAR
        if build_start <= t0 < DROP:
            continue
        _, pad_notes, _ = chord_at(t0)
        level = 0.18 if t0 < 8 or t0 >= END_HIT else 0.09
        for i, n in enumerate(pad_notes):
            for det, pan in ((-0.004, -0.6), (0.004, 0.6)):
                tone = saw(note(n), BAR + 0.4, cutoff=900 if t0 < 8 else 1600, detune=det)
                e = env(BAR + 0.4, attack=0.35, decay=3.0, sustain=0.7)
                e *= np.clip((BAR + 0.4 - t_axis(BAR + 0.4)) / 0.4, 0, 1)
                both(tone * e, t0, level / 3, pan)

    # --- bombo, palmas, platos, bajo, acordes y arpegio
    beats = int(LENGTH / BEAT)
    for b in range(beats):
        t = b * BEAT
        in_build = build_start <= t < DROP
        in_drop = DROP <= t < END_HIT
        root, notes, arp = chord_at(t)

        # el bombo crece por tramos para que el drop (mazo) sea lo mas fuerte
        if not in_build and t < END_HIT:
            if t < 4:
                if b % 2 == 0:
                    both(k, t, 0.35)
            else:
                both(k, t, 0.55 if t < 8 else 0.68 if t < DROP else 1.0)
        if t >= 8 and b % 2 == 1 and not in_build and t < END_HIT:
            both(c, t, 0.5 if in_drop else 0.26, pan=0.1)
        if t < END_HIT and not in_build:
            for half in (0, 0.5):
                both(hho if (half and in_drop) else hh, t + half * BEAT, 0.16 if half else 0.09, pan=-0.3)
            if in_drop:
                for q in (0.25, 0.75):
                    both(hh, t + q * BEAT, 0.07, pan=0.35)

        # bajo en contratiempo (desde el segundo 4)
        if t >= 4 and t < END_HIT and not in_build:
            bass = saw(note(root), BEAT / 2, cutoff=420 if not in_drop else 700) * env(BEAT / 2, 0.004, 0.16, 0.35, release_at=BEAT / 2 - 0.05)
            sub = np.sin(2 * np.pi * note(root) / 2 * t_axis(BEAT / 2)) * env(BEAT / 2, 0.004, 0.2, 0.5, release_at=BEAT / 2 - 0.05)
            both(bass * 0.5 + sub * 0.5, t + BEAT / 2, 0.6 if in_drop else 0.42)

        # acordes sincopados (desde el 8)
        if t >= 8 and t < END_HIT and not in_build and b % 4 in (0, 2):
            for i, n in enumerate(notes):
                stab = saw(note(n), 0.3, cutoff=1400 if not in_drop else 2600, detune=0.003 * (i - 1))
                both(stab * env(0.3, 0.003, 0.09), t + (0.75 * BEAT if b % 4 == 2 else 0), 0.11, pan=0.25 * (i - 1))

        # arpegio en semicorcheas durante el drop
        if in_drop:
            for s in range(4):
                n = arp[(b * 4 + s) % 4] if s != 3 else arp[(b + 1) % 4]
                pluck = saw(note(n), 0.18, cutoff=3200) * env(0.18, 0.002, 0.06)
                both(pluck, t + s * BEAT / 4, 0.08, pan=0.4 if s % 2 else -0.4)

    # --- subida: redoble que se acelera + ruido que sube + tono que sube
    roll_t = build_start
    while roll_t < DROP - 0.06:
        progress = (roll_t - build_start) / (DROP - build_start)
        step = BEAT / 2 if progress < 0.5 else BEAT / 4 if progress < 0.8 else BEAT / 8
        both(sn, roll_t, 0.12 + 0.3 * progress, pan=0.1)
        both(k, roll_t, 0.25 + 0.4 * progress) if step >= BEAT / 4 else None
        roll_t += step
    rise_s = DROP - build_start
    rt = t_axis(rise_s)
    centers = 300 * (6000 / 300) ** (rt / rise_s)
    riser = sweep_band(noise(rise_s), np.repeat(centers, 1)[: len(rt)], q=0.5) * (rt / rise_s) ** 2
    tone_f = 110 * 2 ** (3 * rt / rise_s)
    riser_tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * (rt / rise_s) ** 1.5 * 0.25
    gap = np.clip((DROP - 0.08 - (build_start + rt)) / 0.02, 0, 1)  # corte seco antes del drop
    both((riser * 0.9 + riser_tone) * gap, build_start, 0.6)

    # --- golpes: drop (mazo) y cierre
    for at, g in ((DROP, 1.0), (DROP + 4 * BAR, 0.55), (END_HIT, 1.0)):
        both(crash(1.6), at, 0.32 * g, pan=-0.2)
        both(crash(1.6), at + 0.01, 0.26 * g, pan=0.3)
    for at in (DROP, END_HIT):
        both(sub_boom(), at, 0.9)
        both(k, at, 1.0)

    # --- acorde final que se apaga
    for n in ("A3", "C4", "E4", "A4"):
        tail = saw(note(n), LENGTH - END_HIT + 0.2, cutoff=1500) * env(LENGTH - END_HIT + 0.2, 0.01, 1.4)
        both(tail, END_HIT, 0.12)

    mix = np.vstack([L, R])[:, : int(LENGTH * SR)]
    tt = t_axis(LENGTH)
    fade = np.clip((LENGTH - tt) / 1.2, 0, 1)
    # silencio seco justo antes del mazo: la caida al drop se nota mas
    gate = np.clip(np.maximum((DROP - 0.14 - tt) / 0.01, (tt - DROP) / 0.002 + 1), 0, 1)
    mix *= fade * gate
    mix = np.tanh(mix * 0.6) / np.tanh(0.6)  # compresion suave
    return mix


# --------------------------------------------------------------------------- efectos


def whistle(seconds: float = 0.42) -> np.ndarray:
    t = t_axis(seconds)
    trill = np.sin(2 * np.pi * 36 * t)
    f = 3050 + 160 * trill
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    am = 0.72 + 0.28 * trill
    breath = band(noise(seconds), 2200, 5200) * 0.12
    e = np.clip(t / 0.015, 0, 1) * np.clip((seconds - t) / 0.06, 0, 1)
    return (tone * am + breath) * e


def whistle_final() -> np.ndarray:
    parts = [whistle(0.22), np.zeros(int(0.13 * SR)), whistle(0.22), np.zeros(int(0.13 * SR)), whistle(0.95)]
    return np.concatenate(parts)


def kick_ball() -> np.ndarray:
    t = t_axis(0.25)
    f = 55 + 90 * np.exp(-t * 60)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)
    slap = band(noise(0.25), 900, 4200) * np.exp(-t * 140)
    return thump * 0.9 + slap * 0.8


def crowd(seconds: float = 3.6) -> np.ndarray:
    t = t_axis(seconds)
    swell = np.clip(t / 0.22, 0, 1) * np.clip((seconds - t) / 2.2, 0, 1) ** 1.3
    out = []
    for _ in range(2):
        roar = band(noise(seconds), 220, 1900)
        cheer = band(noise(seconds), 1400, 4200) * 0.35
        # ondulacion lenta: muchas voces que no gritan a la vez
        wobble = band(noise(seconds), None, 6) * 25
        wobble = 0.8 + 0.2 * np.tanh(wobble)
        voices = np.zeros_like(t)
        for _v in range(18):
            f0 = rng.uniform(320, 900)
            start = rng.uniform(0, 0.6)
            vt = np.clip(t - start, 0, None)
            vib = f0 * (1 + 0.04 * np.sin(2 * np.pi * rng.uniform(4, 7) * vt))
            ve = np.clip(vt / 0.1, 0, 1) * np.exp(-vt / rng.uniform(0.6, 1.4))
            voices += np.sin(2 * np.pi * np.cumsum(vib) / SR) * ve * (t >= start)
        voices = band(voices, 250, 2500) * 0.035
        out.append((roar + cheer) * wobble * swell + voices * swell)
    return np.vstack(out)


def whoosh(seconds: float = 0.42) -> np.ndarray:
    t = t_axis(seconds)
    shape = np.sin(np.pi * t / seconds) ** 2
    centers = 400 + 3200 * np.sin(np.pi * t / seconds) ** 1.5
    return sweep_band(noise(seconds), centers, q=0.7) * shape


def pop() -> np.ndarray:
    t = t_axis(0.12)
    f = 480 + 900 * (1 - np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) + band(noise(0.12), 2000) * np.exp(-t * 300) * 0.3


def coin() -> np.ndarray:
    a = np.sin(2 * np.pi * note("B5") * t_axis(0.09)) * env(0.09, 0.002, 0.05)
    tb = t_axis(0.55)
    b = (np.sin(2 * np.pi * note("E6") * tb) + 0.25 * np.sin(2 * np.pi * note("E6") * 2 * tb)) * env(0.55, 0.002, 0.22)
    out = np.zeros(int(0.65 * SR))
    place(out, a, 0, 0.7)
    place(out, b, 0.07, 1.0)
    return out


def tick() -> np.ndarray:
    t = t_axis(0.08)
    return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 90) + band(noise(0.08), 3000) * np.exp(-t * 400) * 0.4


def reveal() -> np.ndarray:
    out = np.zeros(int(1.4 * SR))
    for i, n in enumerate(("A5", "C6", "E6", "A6")):
        tt = t_axis(0.9)
        tone = (np.sin(2 * np.pi * note(n) * tt) + 0.3 * np.sin(2 * np.pi * note(n) * 2.01 * tt)) * env(0.9, 0.004, 0.35)
        place(out, tone, i * 0.06, 0.6)
    place(out, whoosh(0.5) * 0.6, 0, 1)
    return out


def boom() -> np.ndarray:
    out = np.zeros(int(1.6 * SR))
    place(out, sub_boom(1.5), 0, 1.0)
    place(out, kick(), 0, 0.8)
    place(out, crash(1.5) * 0.1, 0, 1)
    return out


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    write("music.wav", music(), peak=0.9)
    write("whistle.wav", whistle())
    write("whistle-final.wav", whistle_final())
    write("kick-ball.wav", kick_ball())
    write("crowd.wav", crowd())
    write("whoosh.wav", whoosh())
    write("pop.wav", pop())
    write("coin.wav", coin())
    write("tick.wav", tick())
    write("reveal.wav", reveal())
    write("boom.wav", boom())


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generates the focus-timer alarm sounds in assets/sounds/.

The three tones are synthesised rather than sampled so the repo carries no
licensed audio. Re-run after changing any of the recipes below:

    python3 tool/generate_alarm_sounds.py

16-bit mono PCM at 22.05 kHz — more than enough for a chime, and a third the
size of a 44.1 kHz stereo file.
"""

import array
import math
import os
import wave

RATE = 22050
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")


def write_wav(name, samples):
    """Normalises to -1.6 dBFS and writes 16-bit PCM."""
    peak = max(abs(s) for s in samples) or 1.0
    scale = 0.83 / peak
    frames = array.array("h", (int(max(-1.0, min(1.0, s * scale)) * 32767) for s in samples))
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(frames.tobytes())
    print(f"{path}  {len(frames) / RATE:.2f}s  {os.path.getsize(path) // 1024} KB")


def envelope(i, n, attack=0.004, decay=6.0):
    """Click-free attack, then exponential decay."""
    t = i / RATE
    a = min(1.0, t / attack) if attack else 1.0
    return a * math.exp(-decay * (i / n))


def tone(freq, seconds, partials=((1.0, 1.0),), decay=6.0, attack=0.004):
    n = int(RATE * seconds)
    out = []
    for i in range(n):
        t = i / RATE
        v = sum(amp * math.sin(2 * math.pi * freq * ratio * t) for ratio, amp in partials)
        out.append(v * envelope(i, n, attack, decay))
    return out


def mix(*layers):
    """Overlays layers of differing length, summing where they overlap."""
    out = [0.0] * max(len(layer) for layer in layers)
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    return out


def pad(offset_seconds, samples):
    return [0.0] * int(RATE * offset_seconds) + samples


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Chime — A5 then D6, the second struck while the first is still ringing.
    write_wav("chime.wav", mix(
        tone(880.00, 1.30, partials=((1.0, 1.0), (2.0, 0.28), (3.0, 0.09)), decay=5.0),
        pad(0.26, tone(1174.66, 1.40, partials=((1.0, 1.0), (2.0, 0.24), (3.0, 0.08)), decay=4.4)),
    ))

    # Bell — inharmonic partials over a C5 fundamental give the metallic ring.
    write_wav("bell.wav", tone(
        523.25, 2.20,
        partials=((1.0, 1.0), (2.0, 0.55), (2.76, 0.34), (5.40, 0.18), (8.93, 0.07)),
        decay=3.2,
    ))

    # Beep — three insistent bursts, the one that will actually wake you.
    write_wav("beep.wav", mix(*[
        pad(k * 0.22, tone(1000.0, 0.14, partials=((1.0, 1.0), (3.0, 0.22)), decay=3.0, attack=0.003))
        for k in range(3)
    ]))


if __name__ == "__main__":
    main()

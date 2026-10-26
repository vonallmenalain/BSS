/**
 * Erzeugt die Soundeffekte der Shorts (eigene Synthese, keine Samples, frei verwendbar):
 * Plopp, Benachrichtigung, Tippen, Pixel-Töne, Wusch, Stempel, Trommel, Klirren … und die leisen
 * Klänge für sparsame Folgen (Klopfen, Warm, Hauch).
 *
 *   npm run sfx                      → public/sfx/<name>.wav
 *
 * Die Dateien sind klein (Mono, 44.1 kHz) und liegen im Repo; dieses Skript zeigt, woher sie kommen.
 */
import fs from "node:fs";
import path from "node:path";
import { writeWav } from "./lib/wav";

const SR = 44100;
const OUT = path.resolve(import.meta.dirname, "../public/sfx");

let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const buf = (sec: number) => new Float32Array(Math.round(sec * SR));
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Hüllkurve: Anstieg a, exponentielles Abklingen mit Zeitkonstante d (Sekunden). */
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** Rechteck mit leicht abgerundeten Kanten (weniger schrill als ein hartes Rechteck). */
const square = (ph: number) => Math.tanh(4 * Math.sin(ph));

/** Biquad-Bandpass (RBJ), Mittenfrequenz pro Sample änderbar. */
const bandpass = (x: Float32Array, f: (i: number) => number, q = 1.2) => {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = (2 * Math.PI * Math.min(f(i), SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
};

const lowpass = (x: Float32Array, a: number) => {
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i] - y);
  return x;
};

const mixInto = (dst: Float32Array, src: Float32Array, at = 0, gain = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
  return dst;
};

/** Glocke aus Teiltönen, die unterschiedlich schnell abklingen. */
const bell = (f: number, sec: number, partials: Array<[number, number, number]> = [[1, 1, 0.5], [2.76, 0.4, 0.18], [5.4, 0.18, 0.08]]) => {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [r, a, d] of partials) s += a * Math.sin(2 * Math.PI * f * r * t) * env(t, 0.003, d);
    b[i] = s;
  }
  return b;
};

const sounds: Record<string, () => Float32Array> = {
  /** Chat-Blase: kurzer, runder Plopp nach oben */
  pop: () => {
    const b = buf(0.16);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const f = 420 + 900 * Math.min(1, t / 0.05);
      ph += (2 * Math.PI * f) / SR;
      b[i] = Math.sin(ph) * env(t, 0.004, 0.035);
    }
    return b;
  },
  /** Benachrichtigung: zwei helle Glockentöne */
  ding: () => {
    const b = buf(1.2);
    mixInto(b, bell(midi(88), 1.1), 0, 0.6);
    mixInto(b, bell(midi(95), 1.0), 0.13, 0.5);
    return b;
  },
  /** Tippen: drei weiche Klicks */
  type: () => {
    const b = buf(0.5);
    [0, 0.13, 0.27, 0.36].forEach((at) => {
      const c = buf(0.03);
      for (let i = 0; i < c.length; i++) c[i] = rnd() * env(i / SR, 0.0005, 0.004);
      mixInto(b, bandpass(c, () => 3200, 2), at, 0.7);
    });
    return b;
  },
  /** Pixel-Ton */
  blip: () => {
    const b = buf(0.09);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = square(2 * Math.PI * 1320 * t) * 0.45 * (t < 0.07 ? 1 : 1 - (t - 0.07) / 0.02);
    }
    return b;
  },
  /** Münze: zwei Pixel-Töne nach oben */
  coin: () => {
    const b = buf(0.42);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const f = t < 0.07 ? midi(83) : midi(88);
      const a = t < 0.07 ? 1 : Math.exp(-(t - 0.07) / 0.12);
      b[i] = square(2 * Math.PI * f * t) * 0.42 * a;
    }
    return b;
  },
  /** Level-up: Pixel-Arpeggio mit Vibrato am Schluss */
  levelup: () => {
    const notes = [72, 76, 79, 84, 88, 91];
    const b = buf(1.05);
    notes.forEach((n, k) => {
      const last = k === notes.length - 1;
      const len = last ? 0.6 : 0.075;
      const s = buf(len);
      for (let i = 0; i < s.length; i++) {
        const t = i / SR;
        const vib = last ? 1 + 0.012 * Math.sin(2 * Math.PI * 7 * t) : 1;
        s[i] = square(2 * Math.PI * midi(n) * vib * t) * 0.38 * (last ? Math.exp(-t / 0.25) : 1);
      }
      mixInto(b, s, k * 0.075);
    });
    return b;
  },
  /** Freischalten: Glitzer aus vielen hohen Glöckchen */
  unlock: () => {
    const b = buf(1.4);
    for (let k = 0; k < 16; k++) {
      const at = k * 0.045 + (rnd() + 1) * 0.02;
      mixInto(b, bell(1800 + (k % 6) * 420 + rnd() * 120, 0.8, [[1, 1, 0.22], [2.4, 0.3, 0.1]]), at, 0.16);
    }
    const n = buf(0.6);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * Math.sin((Math.PI * i) / n.length);
    mixInto(b, bandpass(n, (i) => 800 + 6000 * (i / n.length), 1.5), 0, 0.25);
    return b;
  },
  /** Wusch: Rauschen mit wanderndem Filter */
  whoosh: () => {
    const n = buf(0.5);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * Math.sin((Math.PI * i) / n.length) ** 1.5;
    return bandpass(n, (i) => 300 + 2600 * (i / n.length) ** 1.3, 1.1);
  },
  /** Wisch nach oben: kurz und hell */
  swipe: () => {
    const n = buf(0.28);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * Math.sin((Math.PI * i) / n.length);
    return bandpass(n, (i) => 900 + 4000 * (i / n.length), 1.4);
  },
  /** Stempel: dumpfer Schlag mit Klick */
  stamp: () => {
    const b = buf(0.4);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (55 + 80 * Math.exp(-t / 0.03))) / SR;
      b[i] = Math.sin(ph) * env(t, 0.002, 0.09) + rnd() * env(t, 0.0005, 0.008) * 0.5;
    }
    return b;
  },
  /** Trommel (Taiko-artig) */
  drum: () => {
    const b = buf(0.9);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (48 + 60 * Math.exp(-t / 0.05))) / SR;
      b[i] = Math.sin(ph) * env(t, 0.003, 0.22) * 0.9;
    }
    const n = buf(0.12);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * env(i / SR, 0.001, 0.02);
    return mixInto(b, lowpass(n, 0.2), 0, 0.6);
  },
  /** Klirren: metallische Teiltöne */
  clash: () => {
    const b = buf(0.8);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      let s = 0;
      [1530, 2390, 3410, 4720, 6150].forEach((f, k) => (s += Math.sin(2 * Math.PI * f * t + k) * env(t, 0.001, 0.12 + k * 0.02) / (k + 1.5)));
      b[i] = s + rnd() * env(t, 0.0005, 0.015) * 0.5;
    }
    return b;
  },
  /** Uhr-Tick für den Tageszähler */
  tick: () => {
    const c = buf(0.06);
    for (let i = 0; i < c.length; i++) c[i] = rnd() * env(i / SR, 0.0003, 0.003);
    return bandpass(c, () => 2400, 3);
  },
  /** Störung beim Einblenden im Game-Look */
  glitch: () => {
    const b = buf(0.3);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const step = Math.floor(t * 40);
      const f = [220, 1760, 440, 3520, 330, 880][step % 6];
      b[i] = square(2 * Math.PI * f * t) * 0.25 * (step % 3 === 1 ? 0.3 : 1) * (1 - t / 0.3);
    }
    return b;
  },
  /** Weicher Akkord für «Frieden» und «Hoffnung» */
  chime: () => {
    const b = buf(2.2);
    [84, 88, 91, 96].forEach((n, k) => {
      const s = buf(2.2 - k * 0.08);
      for (let i = 0; i < s.length; i++) {
        const t = i / SR;
        s[i] = Math.sin(2 * Math.PI * midi(n) * t) * Math.min(1, t / 0.05) * Math.exp(-t / 0.9);
      }
      mixInto(b, s, k * 0.08, 0.28);
    });
    return b;
  },
  /** Fragezeichen: zwei Töne nach oben, verspielt */
  question: () => {
    const b = buf(0.5);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const f = t < 0.16 ? 520 : 520 + 300 * Math.min(1, (t - 0.16) / 0.12);
      ph += (2 * Math.PI * f) / SR;
      b[i] = Math.sin(ph) * (t < 0.14 ? env(t, 0.005, 0.08) : env(t - 0.16, 0.005, 0.14)) * 0.7;
    }
    return b;
  },
  /*
   * Die leisen Klänge für Folgen mit wenig Effekten (`sfx: "sparse"`): tief, weich, ohne
   * helle Teiltöne – sie ersetzen dort Glocken, Pixel-Töne und Münzen.
   */
  /** Klopfen: dumpf und kurz, wie ein Buch, das auf den Tisch gelegt wird */
  thud: () => {
    const b = buf(0.35);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (70 + 45 * Math.exp(-t / 0.025))) / SR;
      b[i] = Math.sin(ph) * env(t, 0.004, 0.07);
    }
    const n = buf(0.05);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * env(i / SR, 0.002, 0.012);
    return mixInto(b, lowpass(n, 0.06), 0, 0.35);
  },
  /** Warm: ein tiefer, weicher Akkord, der langsam anschwillt – für gute Momente */
  warm: () => {
    const b = buf(2);
    [48, 55, 60].forEach((n, k) => {
      const s = buf(2 - k * 0.05);
      for (let i = 0; i < s.length; i++) {
        const t = i / SR;
        const ph = 2 * Math.PI * midi(n) * t;
        s[i] = (Math.sin(ph) + 0.15 * Math.sin(2 * ph)) * Math.min(1, t / 0.12) * Math.exp(-t / 0.75);
      }
      mixInto(b, s, k * 0.05, 0.35);
    });
    return lowpass(b, 0.25);
  },
  /** Hauch: ein leiser, tiefer Wusch */
  breath: () => {
    const n = buf(0.7);
    for (let i = 0; i < n.length; i++) n[i] = rnd() * Math.sin((Math.PI * i) / n.length) ** 2;
    return lowpass(bandpass(n, (i) => 160 + 380 * (i / n.length), 0.8), 0.12);
  },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const x = make();
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = (0.7 / (peak || 1)) * 32767;
  // Kurze Ausblendung am Ende gegen Knackser
  const fade = Math.min(x.length, Math.round(0.01 * SR));
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const f = i > x.length - fade ? (x.length - i) / fade : 1;
    out[i] = Math.round(x[i] * g * f);
  }
  fs.writeFileSync(path.join(OUT, `${name}.wav`), writeWav({ sampleRate: SR, channels: 1, samples: out }));
  console.log(`♪ sfx/${name}.wav (${(x.length / SR).toFixed(2)} s)`);
}

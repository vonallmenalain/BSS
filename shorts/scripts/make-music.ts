/**
 * Erzeugt Hintergrundmusik in vier Stilen (eigene Synthese, keine Samples, frei verwendbar).
 * Unter der Stimme wird sie ohnehin stark abgesenkt – sie soll Tempo und Stimmung geben.
 *
 *   npm run music -- --style arcade --sec 70 --out public/music/arcade.wav
 *
 * Stile: arcade (Chiptune), lofi (Handy, ruhig), chase (Trommeln, Spannung), anthem (Stadion),
 * temple (Altertum: Bordun, Rahmentrommel, gezupfte Saiten), space (Weltraum: Flächen, Glocken-Arpeggio),
 * mystery (Krimi und Traum: Moll, Pizzicato-Bass, Vibraphon).
 * Fürs Repo danach verkleinern: ffmpeg -i x.wav -b:a 160k x.mp3
 * (Der ursprüngliche Sonnenaufgangs-Pad kommt aus scripts/make-pad.ts.)
 */
import fs from "node:fs";
import path from "node:path";
import { writeWav } from "./lib/wav";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const STYLE = opt("style", "arcade");
const SEC = Number(opt("sec", "70"));
const OUT = path.resolve(opt("out", `public/music/${STYLE}.wav`));
const SR = 44100;
const N = Math.round(SEC * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

let seed = 99;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Einen Ton (Funktion der Zeit seit Anschlag) in den Stereo-Mix schreiben. */
const note = (at: number, len: number, pan: number, gain: number, voice: (t: number, i: number) => number) => {
  const i0 = Math.max(0, Math.round(at * SR));
  const i1 = Math.min(N, Math.round((at + len) * SR));
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = i0; i < i1; i++) {
    const v = voice((i - i0) / SR, i);
    L[i] += v * gl;
    R[i] += v * gr;
  }
};

const adsr = (t: number, len: number, a: number, d: number, s: number, r: number) => {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len - r) return s;
  return Math.max(0, s * ((len - t) / r));
};

/** Rechteck aus ungeraden Obertönen bis ~6 kHz – Chiptune-Farbe ohne scharfes Zischen */
const squareBL = (f: number, t: number) => {
  let s = 0;
  for (let k = 1; k <= 15 && f * k < 6000; k += 2) s += Math.sin(2 * Math.PI * f * k * t) / k;
  return s * 0.75;
};
const tri = (ph: number) => (2 / Math.PI) * Math.asin(Math.sin(ph));
/** Sägezahn aus Obertönen – bandbegrenzt, klingt weicher als der rohe Zacken */
const saw = (f: number, t: number, n = 14) => {
  let s = 0;
  for (let k = 1; k <= n && f * k < 9000; k++) s += Math.sin(2 * Math.PI * f * k * t) / k;
  return s * 0.55;
};

const kick = (at: number, gain = 0.9) =>
  note(at, 0.35, 0, gain, (t) => {
    const f = 45 + 110 * Math.exp(-t / 0.035);
    return Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.12);
  });
const snare = (at: number, gain = 0.4, tone = 190) =>
  note(at, 0.25, 0.05, gain, (t) => rnd() * Math.exp(-t / 0.05) * 0.8 + Math.sin(2 * Math.PI * tone * t) * Math.exp(-t / 0.04) * 0.5);
const hat = (at: number, gain = 0.12, pan = 0.2) => {
  let y = 0, x1 = 0;
  note(at, 0.06, pan, gain, (t) => {
    const x = rnd();
    y = 0.7 * (y + x - x1); // Hochpass
    x1 = x;
    return y * Math.exp(-t / 0.012);
  });
};
const clap = (at: number, gain = 0.3) =>
  [0, 0.011, 0.022].forEach((o) => note(at + o, 0.18, -0.1, gain, (t) => rnd() * Math.exp(-t / 0.03)));
const taiko = (at: number, gain = 0.8, pitch = 1) =>
  note(at, 0.9, 0, gain, (t) => {
    const f = (52 + 70 * Math.exp(-t / 0.05)) * pitch;
    return Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.25) + rnd() * Math.exp(-t / 0.015) * 0.25;
  });
/** E-Piano: Sinus mit glockigem Anschlag, leicht verstimmt */
const epiano = (at: number, len: number, m: number, pan: number, gain: number) =>
  note(at, len + 0.6, pan, gain, (t) => {
    const f = midi(m) * (1 + 0.0015 * Math.sin(2 * Math.PI * 0.7 * (at + t)));
    const e = Math.exp(-t / 1.4) * Math.min(1, t / 0.006) * (t > len ? Math.exp(-(t - len) / 0.2) : 1);
    return (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t / 0.25) + 0.12 * Math.sin(2 * Math.PI * f * 7 * t) * Math.exp(-t / 0.05)) * e;
  });
const pad = (at: number, len: number, m: number, pan: number, gain: number, bright = 6) =>
  note(at, len, pan, gain, (t) => {
    const f = midi(m);
    return (saw(f * 1.003, t, bright) + saw(f * 0.997, t + 0.01, bright)) * adsr(t, len, 0.4, 0.3, 0.8, 0.5);
  });

/** Gezupfte Saite (Karplus-Strong) – Oud oder Harfe */
const pluck = (at: number, len: number, m: number, pan: number, gain: number, damp = 0.996, soft = 4) => {
  const period = Math.max(2, Math.round(SR / midi(m)));
  const buf = new Float32Array(period);
  for (let k = 0; k < period; k++) buf[k] = rnd();
  // Weicher Anschlag: das Rauschen vorher glätten, sonst knackt jeder Ton
  for (let pass = 0; pass < soft; pass++) {
    let prev = buf[period - 1];
    for (let k = 0; k < period; k++) {
      const cur = buf[k];
      buf[k] = 0.25 * prev + 0.5 * cur + 0.25 * buf[(k + 1) % period];
      prev = cur;
    }
  }
  let mean = 0;
  for (let k = 0; k < period; k++) mean += buf[k] / period;
  for (let k = 0; k < period; k++) buf[k] = (buf[k] - mean) * 1.8;
  let idx = 0;
  note(at, len, pan, gain, () => {
    const next = (idx + 1) % period;
    const v = buf[idx];
    buf[idx] = damp * 0.5 * (buf[idx] + buf[next]);
    idx = next;
    return v;
  });
};
/** Glocke: zwei unharmonische Teiltöne, lang ausklingend */
const bell = (at: number, m: number, pan: number, gain: number, decay = 2.4) =>
  note(at, decay * 2, pan, gain, (t) => {
    const f = midi(m);
    return (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / 0.4)) * Math.exp(-t / decay) * Math.min(1, t / 0.004);
  });
/** Rahmentrommel: tiefes «Dum» oder helles «Tek» */
const frame = (at: number, low: boolean, gain: number) =>
  note(at, low ? 0.6 : 0.2, low ? 0 : 0.15, gain, (t) =>
    low
      ? Math.sin(2 * Math.PI * (70 + 40 * Math.exp(-t / 0.04)) * t) * Math.exp(-t / 0.18) + rnd() * Math.exp(-t / 0.01) * 0.15
      : (rnd() * 0.35 + Math.sin(2 * Math.PI * 420 * t) * 0.6) * Math.exp(-t / 0.03) * Math.min(1, t / 0.002),
  );

const beat = (bpm: number) => 60 / bpm;

/* ---------------- Stile ---------------- */

const styles: Record<string, () => void> = {
  /** Chiptune: Arpeggios über Am–F–C–G, Dreiecksbass, Rauschen als Hi-Hat */
  arcade: () => {
    const b = beat(124);
    const chords = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const c = chords[bar % 4];
      const t0 = bar * 4 * b;
      const intro = bar < 1;
      for (let s = 0; s < 16; s++) {
        const m = c[s % 3] + 12 + (s % 6 === 5 ? 12 : 0);
        note(t0 + s * (b / 4), b / 4 - 0.01, 0.25 * Math.sin(s), intro ? 0.06 : 0.1, (t) => squareBL(midi(m), t) * Math.exp(-t / 0.09));
      }
      for (let s = 0; s < 8; s++) {
        const m = c[0] - 12 + (s % 4 === 3 ? 7 : 0);
        note(t0 + s * (b / 2), b / 2 - 0.02, 0, 0.32, (t) => tri(2 * Math.PI * midi(m) * t) * adsr(t, b / 2 - 0.02, 0.005, 0.05, 0.7, 0.03));
      }
      if (!intro) {
        for (let k = 0; k < 4; k++) kick(t0 + k * b, 0.55);
        snare(t0 + b, 0.18, 240);
        snare(t0 + 3 * b, 0.18, 240);
        for (let k = 0; k < 8; k++) hat(t0 + k * (b / 2) + b / 4, 0.09);
      }
      // Melodie alle zwei Takte
      if (bar % 2 === 1 && bar > 2) {
        const mel = [c[2] + 12, c[1] + 12, c[2] + 14, c[0] + 24];
        mel.forEach((m, k) => note(t0 + k * b, b * 0.9, -0.2, 0.08, (t) => squareBL(midi(m) * (1 + 0.004 * Math.sin(30 * t)), t) * adsr(t, b * 0.9, 0.01, 0.1, 0.6, 0.08)));
      }
    }
  },
  /** Lo-Fi: weiche E-Piano-Akkorde, verschlafener Beat, Knistern */
  lofi: () => {
    const b = beat(78);
    const chords = [[50, 57, 60, 65], [43, 55, 59, 65], [48, 55, 59, 64], [45, 55, 60, 64]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const c = chords[bar % 4];
      const t0 = bar * 4 * b;
      c.forEach((m, k) => epiano(t0 + k * 0.025, 4 * b - 0.1, m + 12, (k - 1.5) * 0.25, 0.1));
      epiano(t0 + 2.5 * b, b, c[3] + 24, 0.3, 0.05);
      note(t0, 4 * b, 0, 0.22, (t) => Math.sin(2 * Math.PI * midi(c[0] - 12) * t) * adsr(t, 4 * b, 0.02, 0.4, 0.6, 0.3));
      if (bar > 0) {
        kick(t0, 0.5);
        kick(t0 + 2.5 * b, 0.4);
        snare(t0 + b, 0.13, 170);
        snare(t0 + 3 * b, 0.13, 170);
        for (let k = 0; k < 8; k++) hat(t0 + k * (b / 2) + (k % 2 ? 0.03 : 0), k % 2 ? 0.05 : 0.07);
      }
    }
    // Plattenknistern
    for (let i = 0; i < N; i++) {
      if ((rnd() + 1) / 2 < 0.0009) {
        const a = 0.05 + ((rnd() + 1) / 2) * 0.12;
        for (let k = 0; k < 30 && i + k < N; k++) {
          const v = rnd() * a * Math.exp(-k / 6);
          L[i + k] += v;
          R[i + k] += v * 0.8;
        }
      }
      const hiss = rnd() * 0.006;
      L[i] += hiss;
      R[i] += hiss;
    }
  },
  /** Verfolgungsjagd: Ostinato im Bass, Taiko-Trommeln, Streicherfläche, steigt an */
  chase: () => {
    const b = beat(136);
    const roots = [38, 38, 41, 36];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const r = roots[bar % 4];
      const t0 = bar * 4 * b;
      const lift = Math.min(1, bar / (bars * 0.8));
      for (let s = 0; s < 16; s++) {
        const m = r + (s % 4 === 2 ? 12 : 0) + (s === 14 ? 3 : 0);
        note(t0 + s * (b / 4), b / 4 - 0.01, 0, 0.16, (t) => saw(midi(m), t, 8) * Math.exp(-t / 0.07));
      }
      pad(t0, 4 * b + 0.3, r + 24, -0.3, 0.035 + 0.03 * lift, 5);
      pad(t0, 4 * b + 0.3, r + 27 + (bar % 4 === 2 ? 1 : 0), 0.3, 0.03 + 0.03 * lift, 5);
      if (bar > 0) {
        taiko(t0, 0.75);
        taiko(t0 + 1.5 * b, 0.5, 1.2);
        taiko(t0 + 2 * b, 0.65);
        taiko(t0 + 3 * b, 0.45, 1.35);
        taiko(t0 + 3.5 * b, 0.45, 1.35);
        for (let k = 0; k < 8; k++) hat(t0 + k * (b / 2), 0.05 + 0.04 * lift);
      }
    }
  },
  /** Stadion-Hymne: Klavierakkorde I–V–vi–IV, Bass, Kick auf allen Vieren, Klatschen */
  anthem: () => {
    const b = beat(112);
    const chords = [[52, 59, 64, 68], [47, 59, 62, 66], [49, 56, 61, 64], [45, 57, 61, 64]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const c = chords[bar % 4];
      const t0 = bar * 4 * b;
      const full = bar >= 2;
      for (let k = 0; k < 4; k++) c.forEach((m, j) => epiano(t0 + k * b + j * 0.01, b * 0.9, m + 12, (j - 1.5) * 0.2, k === 0 ? 0.09 : 0.06));
      for (let k = 0; k < 8; k++) note(t0 + k * (b / 2), b / 2 - 0.03, 0, 0.26, (t) => (Math.sin(2 * Math.PI * midi(c[0] - 12) * t) + 0.3 * Math.sin(4 * Math.PI * midi(c[0] - 12) * t)) * adsr(t, b / 2 - 0.03, 0.005, 0.08, 0.6, 0.04));
      pad(t0, 4 * b + 0.3, c[1] + 12, 0, full ? 0.03 : 0.015, 6);
      if (full) {
        for (let k = 0; k < 4; k++) kick(t0 + k * b, 0.6);
        clap(t0 + b, 0.22);
        clap(t0 + 3 * b, 0.22);
        for (let k = 0; k < 8; k++) hat(t0 + k * (b / 2) + b / 4, 0.08);
        for (let s = 0; s < 8; s++) note(t0 + s * (b / 2), b / 2, 0.35, 0.04, (t) => Math.sin(2 * Math.PI * midi(c[s % 4] + 24) * t) * Math.exp(-t / 0.2));
      }
    }
  },
  /** Altertum: Bordun auf D, Hijaz-Skala (D Es Fis G A B C), Rahmentrommel, gezupfte Saiten */
  temple: () => {
    const b = beat(92);
    const scale = [62, 63, 66, 67, 69, 70, 72, 74];
    const phrases = [[0, 1, 2, 1, 0], [3, 4, 5, 4, 3, 2], [4, 3, 2, 1, 2, 0], [7, 6, 5, 4, 2, 1, 0]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * b;
      pad(t0, 4 * b + 0.4, 38, -0.2, 0.05, 4);
      pad(t0, 4 * b + 0.4, 45, 0.2, 0.035, 4);
      if (bar > 0) {
        // Dum – tek tek – dum – tek
        frame(t0, true, 0.55);
        frame(t0 + b, false, 0.16);
        frame(t0 + 1.5 * b, false, 0.12);
        frame(t0 + 2 * b, true, 0.45);
        frame(t0 + 3 * b, false, 0.16);
        frame(t0 + 3.5 * b, false, 0.1);
      }
      if (bar % 2 === 1) {
        const ph = phrases[Math.floor(bar / 2) % phrases.length];
        ph.forEach((k, j) => pluck(t0 + j * (4 * b) / ph.length, 1.6, scale[k], -0.25 + 0.1 * j, 0.22));
      } else {
        for (let k = 0; k < 4; k++) pluck(t0 + k * b, 1.2, [50, 57, 50, 57][k], 0.3, 0.12);
      }
    }
  },
  /** Weltraum: weite Flächen in Lydisch, Glocken-Arpeggio, leiser Puls */
  space: () => {
    const b = beat(84);
    const chords = [[48, 55, 62, 66], [50, 57, 64, 69], [45, 52, 59, 66], [47, 54, 62, 66]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const c = chords[bar % 4];
      const t0 = bar * 4 * b;
      c.forEach((m, k) => pad(t0, 4 * b + 1.2, m + 12, (k - 1.5) * 0.3, 0.03, 3));
      note(t0, 4 * b, 0, 0.2, (t) => Math.sin(2 * Math.PI * midi(c[0] - 12) * t) * adsr(t, 4 * b, 0.6, 0.5, 0.7, 0.8));
      for (let s = 0; s < 8; s++) bell(t0 + s * (b / 2), c[(s * 3) % 4] + 24 + (s % 4 === 3 ? 12 : 0), Math.sin(s * 1.3) * 0.6, 0.05, 1.6);
      if (bar > 1) {
        kick(t0, 0.35);
        kick(t0 + 2 * b, 0.28);
        for (let k = 0; k < 4; k++) hat(t0 + k * b + b / 2, 0.035, -0.3);
      }
    }
  },
  /** Krimi und Traum: Moll-Septakkorde, Pizzicato-Bass, Vibraphon, Besen */
  mystery: () => {
    const b = beat(86);
    const chords = [[45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 53, 58], [40, 47, 50, 56]];
    const bars = Math.ceil(SEC / (4 * b));
    for (let bar = 0; bar < bars; bar++) {
      const c = chords[bar % 4];
      const t0 = bar * 4 * b;
      c.forEach((m, k) => pad(t0, 4 * b + 0.4, m + 12, (k - 1.5) * 0.25, 0.022, 3));
      // Gehender Pizzicato-Bass
      [0, 7, 12, 10].forEach((d, k) => pluck(t0 + k * b, b * 0.9, c[0] - 12 + d, 0, 0.3, 0.99, 10));
      // Vibraphon: wenige Töne, viel Luft
      if (bar % 2 === 1) [3, 2, 1].forEach((k, j) => bell(t0 + (j * 1.5 + 0.5) * b, c[k] + 24, 0.3 - 0.3 * j, 0.06, 1.2));
      if (bar > 0) {
        for (let k = 0; k < 4; k++) hat(t0 + k * b + (k % 2 ? 0.04 : 0), 0.05, 0.25);
        snare(t0 + 3 * b, 0.05, 160);
      }
    }
  },
};

if (!styles[STYLE]) {
  console.error(`Unbekannter Stil ${STYLE}. Möglich: ${Object.keys(styles).join(", ")}`);
  process.exit(1);
}
styles[STYLE]();

// Sanfter Tiefpass, Ein-/Ausblenden, auf −3 dBFS normalisieren
const lp = (x: Float32Array, a: number) => {
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i] - y);
};
const cutoff = STYLE === "lofi" || STYLE === "mystery" ? 0.18 : STYLE === "arcade" ? 0.32 : STYLE === "space" ? 0.25 : 0.4;
lp(L, cutoff);
lp(R, cutoff);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 1.5) * Math.min(1, (SEC - t) / 3);
  L[i] = Math.tanh(L[i] * 1.2) * g;
  R[i] = Math.tanh(R[i] * 1.2) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = (0.707 / (peak || 1)) * 32767;
const out = new Int16Array(N * 2);
for (let i = 0; i < N; i++) {
  out[2 * i] = Math.round(L[i] * norm);
  out[2 * i + 1] = Math.round(R[i] * norm);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, writeWav({ sampleRate: SR, channels: 2, samples: out }));
console.log(`♪ ${path.relative(process.cwd(), OUT)} (${STYLE}, ${SEC} s)`);

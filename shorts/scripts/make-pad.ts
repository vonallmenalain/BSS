/**
 * Erzeugt einen lizenzfreien Ambient-Pad (eigene Synthese, keine Samples) als Platzhalter-Musik.
 * Akkordfolge h-moll – G – D – A (vi–IV–I–V in D-Dur), langsam ansteigende Helligkeit
 * passend zum "Sonnenaufgang" im Template.
 *
 *   npm run pad -- --sec 75 --out public/music/pad-dawn.wav
 *
 * Für echte Produktionen besser: Musik mit klarer Lizenz (z.B. YouTube Audio Library,
 * eigene Komposition). Diese Datei ist bewusst schlicht.
 */
import fs from "node:fs";
import path from "node:path";
import { writeWav } from "./lib/wav";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const SEC = Number(opt("sec", "75"));
const OUT = path.resolve(opt("out", "public/music/pad-dawn.wav"));
const SR = 44100;
const N = Math.round(SEC * SR);

const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
// Voicings (MIDI): Bm, G, D, A
const CHORDS = [
  [47, 54, 59, 62, 66],
  [43, 55, 59, 62, 67],
  [50, 57, 62, 66, 69],
  [45, 57, 61, 64, 69],
];
const BAR = 8; // Sekunden pro Akkord
const XF = 2.5; // Überblendung zwischen Akkorden

const L = new Float32Array(N);
const R = new Float32Array(N);

// Harmonische mit fallender Amplitude: warm, nicht scharf
const HARM = [1, 0.42, 0.2, 0.09, 0.04];
const detune = [-0.0024, 0.0024]; // ±4 Cent für Chorus

const env = (t: number, start: number, end: number) => {
  if (t < start - XF / 2 || t > end + XF / 2) return 0;
  const a = Math.min(1, (t - (start - XF / 2)) / XF);
  const r = Math.min(1, (end + XF / 2 - t) / XF);
  const x = Math.max(0, Math.min(a, r));
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
};

const bars = Math.ceil(SEC / BAR) + 1;
for (let b = 0; b < bars; b++) {
  const chord = CHORDS[b % CHORDS.length];
  const start = b * BAR;
  const end = start + BAR;
  const i0 = Math.max(0, Math.floor((start - XF) * SR));
  const i1 = Math.min(N, Math.ceil((end + XF) * SR));
  chord.forEach((note, ni) => {
    const f0 = midi(note);
    const pan = (ni / (chord.length - 1)) * 0.6 - 0.3;
    detune.forEach((d, di) => {
      const f = f0 * (1 + d);
      const phase0 = (b * 7 + ni * 3 + di) * 0.37;
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        const e = env(t, start, end);
        if (e === 0) continue;
        const bright = 0.55 + 0.45 * (t / SEC); // Obertöne nehmen über die Zeit zu
        let s = 0;
        for (let h = 0; h < HARM.length; h++) s += HARM[h] * (h === 0 ? 1 : bright) * Math.sin(2 * Math.PI * f * (h + 1) * t + phase0 * (h + 1));
        const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t + ni);
        const v = s * e * trem * (note < 50 ? 0.9 : 0.55);
        L[i] += v * (di === 0 ? 1 - pan : 0.85 - pan * 0.5);
        R[i] += v * (di === 1 ? 1 + pan : 0.85 + pan * 0.5);
      }
    });
  });
}

// Glitzer: weiche Glockentöne aus den Akkordtönen, zwei Oktaven höher, mit Echo
const delayL = Math.round(0.375 * SR);
const delayR = Math.round(0.5 * SR);
const shimmer = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let t = 1.0; t < SEC - 2; t += 1.0 + rnd() * 0.5) {
  const chord = CHORDS[Math.floor(t / BAR) % CHORDS.length];
  const f = midi(chord[1 + Math.floor(rnd() * (chord.length - 1))] + 24);
  const amp = 0.05 + 0.13 * (t / SEC);
  const i0 = Math.floor(t * SR);
  const len = Math.floor(2.2 * SR);
  for (let k = 0; k < len && i0 + k < N; k++) {
    const tt = k / SR;
    shimmer[i0 + k] += amp * Math.exp(-tt * 2.2) * Math.min(1, tt * 60) * Math.sin(2 * Math.PI * f * tt);
  }
}
for (let i = 0; i < N; i++) {
  const dl = i >= delayL ? shimmer[i - delayL] * 0.35 : 0;
  const dr = i >= delayR ? shimmer[i - delayR] * 0.35 : 0;
  L[i] += shimmer[i] + dl;
  R[i] += shimmer[i] + dr;
}

// Einpoliger Tiefpass gegen Härte
const lp = (x: Float32Array, a: number) => {
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i] - y);
};
lp(L, 0.25);
lp(R, 0.25);

// Ein-/Ausblenden und Normalisieren auf −3 dBFS Spitze
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 2.5) * Math.min(1, (SEC - t) / 3.5);
  L[i] *= g;
  R[i] *= g;
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
console.log(`♪ ${path.relative(process.cwd(), OUT)} (${SEC} s, ${SR} Hz, stereo)`);

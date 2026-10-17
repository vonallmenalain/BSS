/**
 * Minimaler WAV-Parser/-Writer (PCM 16 bit) und Sprachanalyse.
 * Keine Abhängigkeiten – läuft auf dem NAS genauso wie auf dem Desktop.
 */

export type Pcm = { sampleRate: number; channels: number; samples: Int16Array };

export const parseWav = (buf: Buffer): Pcm => {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Kein RIFF/WAVE-Header");
  }
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number; format: number } | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      if (!fmt) throw new Error("data-Chunk vor fmt-Chunk");
      if (fmt.format !== 1 || fmt.bits !== 16) throw new Error(`Nur PCM16 unterstützt (format=${fmt.format}, bits=${fmt.bits})`);
      // Edge Case: Streaming-Encoder schreiben manchmal 0 oder 0xFFFFFFFF als Grösse.
      if (size === 0 || size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      const aligned = Buffer.from(buf.subarray(body, body + size - (size % 2)));
      const samples = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.length / 2);
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, samples };
    }
    off = body + size + (size % 2);
  }
  throw new Error("Kein data-Chunk gefunden");
};

export const writeWav = (pcm: Pcm): Buffer => {
  const dataBytes = pcm.samples.length * 2;
  const b = Buffer.alloc(44 + dataBytes);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write("WAVE", 8, "ascii");
  b.write("fmt ", 12, "ascii");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(pcm.channels, 22);
  b.writeUInt32LE(pcm.sampleRate, 24);
  b.writeUInt32LE(pcm.sampleRate * pcm.channels * 2, 28);
  b.writeUInt16LE(pcm.channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "ascii");
  b.writeUInt32LE(dataBytes, 40);
  Buffer.from(pcm.samples.buffer, pcm.samples.byteOffset, dataBytes).copy(b, 44);
  return b;
};

export const durationSec = (pcm: Pcm) => pcm.samples.length / pcm.channels / pcm.sampleRate;

export type SpeechAnalysis = {
  durationSec: number;
  speechStartSec: number;
  speechEndSec: number;
  /** Sprechpausen innerhalb der Sprache (Start/Ende in Sekunden) */
  gaps: Array<{ start: number; end: number }>;
};

/**
 * Energiebasierte Sprecherkennung in 10-ms-Fenstern.
 * Schwelle relativ zum lautesten Fenster, damit leise und laute Stimmen gleich behandelt werden.
 */
export const analyzeSpeech = (pcm: Pcm, minGapSec = 0.12): SpeechAnalysis => {
  const win = Math.max(1, Math.round(pcm.sampleRate * 0.01)) * pcm.channels;
  const n = Math.floor(pcm.samples.length / win);
  const db = new Float32Array(n);
  let peak = -120;
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = i * win; j < (i + 1) * win; j++) acc += pcm.samples[j] * pcm.samples[j];
    const rms = Math.sqrt(acc / win) / 32768;
    db[i] = rms > 0 ? 20 * Math.log10(rms) : -120;
    if (db[i] > peak) peak = db[i];
  }
  const thr = Math.max(peak - 32, -58);
  const voiced = Array.from(db, (d) => d > thr);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  const total = durationSec(pcm);
  if (first < 0) return { durationSec: total, speechStartSec: 0, speechEndSec: total, gaps: [] };

  const gaps: SpeechAnalysis["gaps"] = [];
  let runStart = -1;
  for (let i = first; i <= last; i++) {
    if (!voiced[i] && runStart < 0) runStart = i;
    if (voiced[i] && runStart >= 0) {
      if ((i - runStart) * 0.01 >= minGapSec) gaps.push({ start: runStart * 0.01, end: i * 0.01 });
      runStart = -1;
    }
  }
  return { durationSec: total, speechStartSec: first * 0.01, speechEndSec: (last + 1) * 0.01, gaps };
};

/**
 * Legt Textphrasen auf das Audio: erwartete Grenzen proportional zur Textlänge,
 * dann auf die nächstgelegene echte Sprechpause einrasten (monoton, jede Pause nur einmal).
 * Ergebnis ist ohne Whisper meist auf ±100 ms genau – genug für Wort-Highlighting.
 */
export const alignPhrases = (
  phrases: string[],
  strongBoundary: boolean[],
  a: SpeechAnalysis,
): Array<{ text: string; start: number; end: number }> => {
  const w = phrases.map((p) => p.replace(/[^\p{L}\p{N}]/gu, "").length + 3);
  const total = w.reduce((x, y) => x + y, 0) || 1;
  const span = a.speechEndSec - a.speechStartSec;
  const avg = span / Math.max(1, phrases.length);

  const bounds: Array<{ end: number; start: number }> = [];
  let cum = 0;
  let gapIdx = 0;
  let lastT = a.speechStartSec;
  for (let k = 0; k < phrases.length - 1; k++) {
    cum += w[k];
    const expected = a.speechStartSec + (cum / total) * span;
    const tol = strongBoundary[k] ? Math.max(0.6, avg * 0.6) : Math.max(0.25, avg * 0.3);
    let best = -1;
    let bestDist = Infinity;
    for (let g = gapIdx; g < a.gaps.length; g++) {
      const c = (a.gaps[g].start + a.gaps[g].end) / 2;
      if (c <= lastT) continue;
      const d = Math.abs(c - expected);
      if (d < bestDist && d <= tol) {
        best = g;
        bestDist = d;
      }
      if (c > expected + tol) break;
    }
    if (best >= 0) {
      bounds.push({ end: a.gaps[best].start, start: a.gaps[best].end });
      lastT = a.gaps[best].end;
      gapIdx = best + 1;
    } else {
      const t = Math.max(expected, lastT + 0.05);
      bounds.push({ end: t, start: t });
      lastT = t;
    }
  }

  return phrases.map((text, i) => {
    const start = i === 0 ? a.speechStartSec : bounds[i - 1].start;
    const end = i === phrases.length - 1 ? a.speechEndSec : bounds[i].end;
    return { text, start, end: Math.max(end, start + 0.08) };
  });
};

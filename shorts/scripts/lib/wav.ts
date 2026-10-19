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
 *
 * Die erwarteten Grenzen kommen auf zwei Wegen zustande: über die ganze Sprechzeit oder nur über
 * die gesprochene Zeit ohne Pausen (besser nach kurzen Rufen mit langen Pausen wie «Drei. Zwei.
 * Eins. Start!»). Genommen wird der Weg, dessen Phrasen in der Länge besser zum Text passen.
 */
export const alignPhrases = (
  phrases: string[],
  strongBoundary: boolean[],
  a: SpeechAnalysis,
): Array<{ text: string; start: number; end: number }> => {
  // Gewicht nach gesprochener Länge: Ziffern dauern länger als Buchstaben («2020» = «zweitausendzwanzig»)
  const w = phrases.map((p) => p.replace(/\d/g, "ddd").replace(/[^\p{L}\p{N}]/gu, "").length + 3);
  const total = w.reduce((x, y) => x + y, 0) || 1;
  const span = a.speechEndSec - a.speechStartSec;

  // Gesprochene Abschnitte zwischen den Pausen
  const voiced: Array<[number, number]> = [];
  let from = a.speechStartSec;
  for (const g of a.gaps) {
    if (g.start > from) voiced.push([from, g.start]);
    from = Math.max(from, g.end);
  }
  if (a.speechEndSec > from) voiced.push([from, a.speechEndSec]);
  const voicedTotal = voiced.reduce((x, [s0, s1]) => x + (s1 - s0), 0) || span;
  const voicedIn = (t0: number, t1: number) =>
    voiced.reduce((x, [s0, s1]) => x + Math.max(0, Math.min(t1, s1) - Math.max(t0, s0)), 0);
  const atVoiced = (f: number) => {
    let left = f * voicedTotal;
    for (const [s0, s1] of voiced) {
      if (left <= s1 - s0) return s0 + left;
      left -= s1 - s0;
    }
    return a.speechEndSec;
  };

  const candidates = [
    snapToGaps(w, total, strongBoundary, a, (f) => a.speechStartSec + f * span),
    ...(voiced.length ? [snapToGaps(w, total, strongBoundary, a, atVoiced)] : []),
  ].map((bounds) => {
    const out = phrases.map((text, i) => {
      const start = i === 0 ? a.speechStartSec : bounds[i - 1].start;
      const end = i === phrases.length - 1 ? a.speechEndSec : bounds[i].end;
      return { text, start, end: Math.max(end, start + 0.08) };
    });
    // Wie gut die gesprochene Länge jeder Phrase zu ihrem Textanteil passt
    const cost = out.reduce((x, p, i) => x + (voicedIn(p.start, p.end) / voicedTotal - w[i] / total) ** 2, 0);
    return { out, cost };
  });
  return candidates.reduce((best, c) => (c.cost < best.cost ? c : best)).out;
};

/** Grenzen an die nächste Pause rasten; `expectedAt` legt fest, wo eine Grenze nach Textanteil läge. */
const snapToGaps = (
  w: number[],
  total: number,
  strongBoundary: boolean[],
  a: SpeechAnalysis,
  expectedAt: (fraction: number) => number,
): Array<{ end: number; start: number }> => {
  const avg = (a.speechEndSec - a.speechStartSec) / Math.max(1, w.length);
  const bounds: Array<{ end: number; start: number }> = [];
  let cum = 0;
  let gapIdx = 0;
  let lastT = a.speechStartSec;
  for (let k = 0; k < w.length - 1; k++) {
    cum += w[k];
    const expected = expectedAt(cum / total);
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
  return bounds;
};

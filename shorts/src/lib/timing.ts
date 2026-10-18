/**
 * Timing-Logik: Manifest (echte Audiodauern + Phrasen) → Wörter mit Zeiten → Frames.
 * Läuft im Remotion-Bundle (calculateMetadata) und ist frei von Node-APIs.
 */
import {
  type Episode,
  type Manifest,
  type ManifestScene,
  type Scene,
  normalize,
  splitPhrases,
  stripMarkup,
} from "../schema";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Vorlauf vor der Stimme – länger als die Überblendung, damit kein Wort im Crossfade beginnt. */
export const HEAD_SEC = 0.4;
/** Nachlauf nach der Stimme. */
export const TAIL_SEC = 0.45;
/** Dauer der Überblendung zwischen Szenen. */
export const TRANSITION_FRAMES = 9;
/** Mindestlänge einer Szene, damit kurze Sätze nicht hektisch wirken. */
export const MIN_SCENE_SEC = 2.2;

export type Word = {
  text: string;
  /** normalisierte Form für Cue-Suche */
  key: string;
  start: number;
  end: number;
  index: number;
};

export type TimelineScene = {
  scene: Scene;
  /** globaler Startframe (inkl. Überlappung durch Transitions) */
  from: number;
  durationInFrames: number;
  /** Startframe der Stimme relativ zur Szene */
  audioOffsetFrames: number;
  audioSrc: string | null;
  words: Word[];
  speechStartSec: number;
  speechEndSec: number;
  /** Ende der Stimme relativ zum Szenenstart in Sekunden */
  voiceEndSec: number;
};

export type Timeline = {
  scenes: TimelineScene[];
  totalFrames: number;
  /** globale Sprech-Intervalle in Frames – für Musik-Ducking */
  speech: Array<[number, number]>;
  estimated: boolean;
};

/* ---------- Schätzung, solange noch kein Audio existiert ---------- */

const PAUSE_SEC: Record<string, number> = {
  "[pause short]": 0.3,
  "[pause]": 0.5,
  "[pause long]": 0.8,
};

/** Grobe Schätzung (~2.5 Wörter/s bei Rate 1.0), damit Studio und Vorschau ohne TTS funktionieren. */
export const estimateScene = (narration: string, rate: number): ManifestScene => {
  const wps = 2.5 * rate;
  let t = 0.05;
  const phrases: ManifestScene["phrases"] = [];
  const tokens = narration.split(/(\[pause(?: short| long)?\])/g);
  for (const tok of tokens) {
    if (PAUSE_SEC[tok] !== undefined) {
      t += PAUSE_SEC[tok] / rate;
      continue;
    }
    for (const p of splitPhrases(tok)) {
      const n = p.split(/\s+/).length;
      const d = n / wps;
      phrases.push({ text: p, start: t, end: t + d });
      t += d + (/[.!?;:]$/.test(p) ? 0.28 : /,$/.test(p) ? 0.12 : 0.05) / rate;
    }
  }
  const end = phrases.length ? phrases[phrases.length - 1].end : 0.5;
  return {
    id: "",
    file: "",
    hash: "estimate",
    durationSec: end + 0.15,
    speechStartSec: phrases[0]?.start ?? 0,
    speechEndSec: end,
    phrases,
  };
};

/* ---------- Wörter aus Phrasen ---------- */

/** Verteilt die Phrasendauer auf Wörter nach Buchstabenzahl (+Grundgewicht). */
export const wordsFromPhrases = (phrases: ManifestScene["phrases"]): Word[] => {
  const words: Word[] = [];
  for (const p of phrases) {
    // Ein allein stehender Gedankenstrich gehört zum Wort davor – sonst steht er im Untertitel auf einer eigenen Zeile
    const parts = p.text
      .split(/\s+/)
      .filter(Boolean)
      .reduce<string[]>((acc, w) => {
        if (/^[–—-]$/.test(w) && acc.length) acc[acc.length - 1] += ` ${w}`;
        else acc.push(w);
        return acc;
      }, []);
    const weights = parts.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let t = p.start;
    parts.forEach((w, i) => {
      const d = ((p.end - p.start) * weights[i]) / total;
      words.push({ text: w, key: normalize(w), start: t, end: t + d, index: words.length });
      t += d;
    });
  }
  return words;
};

/** Findet eine Phrase in der Wortliste. Gibt Index-Bereich [start, end] (inklusiv) zurück. */
export const findCue = (words: Word[], phrase: string): { first: number; last: number } | null => {
  const target = normalize(phrase).split(" ").filter(Boolean);
  if (!target.length) return null;
  const keys = words.map((w) => w.key);
  outer: for (let i = 0; i + target.length <= keys.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (keys[i + j] !== target[j]) continue outer;
    }
    return { first: i, last: i + target.length - 1 };
  }
  return null;
};

export const cueTime = (words: Word[], phrase: string | undefined, fallback: number) => {
  if (!phrase) return fallback;
  const c = findCue(words, phrase);
  return c ? words[c.first].start : fallback;
};

/* ---------- Timeline ---------- */

const sceneSeconds = (scene: Scene, voiceSec: number) =>
  Math.max(MIN_SCENE_SEC, HEAD_SEC + voiceSec + TAIL_SEC + scene.holdAfterSec);

export const buildTimeline = (episode: Episode, manifest: Manifest | null): Timeline => {
  const byId = new Map((manifest?.scenes ?? []).map((s) => [s.id, s]));
  let cursor = 0;
  const scenes: TimelineScene[] = [];
  const speech: Array<[number, number]> = [];
  let estimated = false;

  episode.scenes.forEach((scene, i) => {
    let m = byId.get(scene.id);
    // Edge Case: Manifest veraltet (Text geändert, Szene neu) → für diese Szene schätzen statt falsch synchronisieren.
    if (!m || !manifestMatches(scene, m)) {
      m = estimateScene(scene.narration, episode.voice.speakingRate);
      estimated = true;
    }
    const voiceSec = m.durationSec;
    const durationInFrames = Math.round(sceneSeconds(scene, voiceSec) * FPS);
    const from = i === 0 ? 0 : cursor - TRANSITION_FRAMES;
    const audioOffsetFrames = Math.round(HEAD_SEC * FPS);

    speech.push([
      from + audioOffsetFrames + Math.floor(m.speechStartSec * FPS),
      from + audioOffsetFrames + Math.ceil(m.speechEndSec * FPS),
    ]);

    scenes.push({
      scene,
      from,
      durationInFrames,
      audioOffsetFrames,
      audioSrc: m.file || null,
      words: wordsFromPhrases(m.phrases),
      speechStartSec: m.speechStartSec,
      speechEndSec: m.speechEndSec,
      voiceEndSec: HEAD_SEC + m.speechEndSec,
    });
    cursor = from + durationInFrames;
  });

  return { scenes, totalFrames: cursor, speech, estimated };
};

/** Prüft, ob der Manifest-Text noch zur Episode passt (Edge Case: Narration editiert, TTS nicht neu gelaufen). */
export const manifestMatches = (scene: Scene, m: ManifestScene) =>
  normalize(m.phrases.map((p) => p.text).join(" ")) === normalize(stripMarkup(scene.narration));

/**
 * Gemeinsames Datenmodell für Node-Skripte (TTS, Render) und das Remotion-Bundle.
 * Ein Episode-JSON in /content wird hiergegen validiert – Fehler fallen also
 * schon beim TTS-Lauf auf, nicht erst nach Minuten im Render.
 */
import { z } from "zod";

const idRegex = /^[a-z0-9][a-z0-9-]*$/;

const base = z.object({
  id: z.string().regex(idRegex, "Szenen-ID: nur a-z, 0-9 und '-'"),
  /** Text für die Stimme. Erlaubt Chirp-Pausen-Tags: [pause short] | [pause] | [pause long] */
  narration: z.string().min(1).max(1200),
  /** 0 = Nacht, 1 = goldener Morgen. Wird über Szenengrenzen weich interpoliert. */
  sky: z.number().min(0).max(1).default(0.5),
  /** Untertitel ganz abschalten (z.B. wenn der Text ohnehin gross im Bild steht). */
  captions: z.boolean().default(true),
  /** Die ersten n Wörter nicht untertiteln (z.B. weil eine grosse Zahl sie schon zeigt). */
  captionSkipWords: z.number().int().min(0).default(0),
  /** Zusätzliche Standzeit nach dem Sprechen (Lesezeit für Karten). */
  holdAfterSec: z.number().min(0).max(10).default(0),
  /** Bibelstelle oder Quelle, klein im Bild. */
  ref: z.string().optional(),
});

export const sceneSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("bigNumber"),
    number: z.number().int().min(1).max(100000),
    label: z.string().optional(),
  }),
  base.extend({
    type: z.literal("illustration"),
    /** Generatives Motiv, falls kein Bild gesetzt ist. */
    motif: z.enum(["swords", "horizon", "none"]).default("none"),
    /** Optionales Bild in /public (9:16 oder grösser), läuft mit Ken-Burns-Bewegung. */
    image: z.string().optional(),
    /**
     * Phrase in der narration, bei der das Motiv seinen Moment hat: bei `swords` steigen die Söhne
     * auf, bei `horizon` leuchtet die kleine Gruppe. Ohne Angabe sucht es die Phrase der
     * Oktober-Episode («Also traten» bzw. «Helaman fragt») und nimmt sonst eine feste Zeit.
     */
    cue: z.string().optional(),
  }),
  base.extend({
    type: z.literal("quote"),
    /** Muss wortwörtlich in der narration vorkommen, damit die Wörter synchron erscheinen. */
    quote: z.string().min(1),
  }),
  base.extend({
    type: z.literal("dotField"),
    count: z.number().int().min(100).max(4000).default(2000),
    /** Phrase in der narration, bei der alle Punkte leuchten. */
    completeAt: z.string().optional(),
    /** Phrase in der narration, bei der der Titel erscheint. */
    titleAt: z.string().optional(),
    title: z.string().optional(),
  }),
  base.extend({
    type: z.literal("kinetic"),
    /** Jede Zeile muss in der narration vorkommen; sie erscheint, wenn sie gesprochen wird. */
    lines: z.array(z.string().min(1)).min(1).max(6),
  }),
  base.extend({
    type: z.literal("cta"),
    question: z.string().min(1),
    challenge: z.object({ label: z.string(), text: z.string() }).optional(),
    footer: z.string().optional(),
  }),
]);

export const episodeSchema = z
  .object({
    id: z.string().regex(idRegex),
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    series: z.string().optional(),
    brand: z.object({ name: z.string(), label: z.string().optional() }),
    voice: z.object({
      provider: z.enum(["google", "piper"]).default("google"),
      languageCode: z.string().default("de-DE"),
      name: z.string().default("de-DE-Chirp3-HD-Charon"),
      speakingRate: z.number().min(0.25).max(2).default(1),
    }),
    pronunciations: z
      .array(z.object({ phrase: z.string(), ipa: z.string() }))
      .default([]),
    music: z
      .object({
        src: z.string(),
        volume: z.number().min(0).max(1).default(0.3),
        duckTo: z.number().min(0).max(1).default(0.1),
      })
      .optional(),
    scenes: z.array(sceneSchema).min(1).max(20),
  })
  .superRefine((ep, ctx) => {
    const seen = new Set<string>();
    ep.scenes.forEach((s, i) => {
      if (seen.has(s.id)) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "id"], message: `Doppelte Szenen-ID "${s.id}"` });
      }
      seen.add(s.id);
      // Cues und Zitate müssen in der Narration auffindbar sein, sonst läuft die Synchronisation ins Leere.
      const spoken = normalize(stripMarkup(s.narration));
      const mustContain: Array<[string, string]> = [];
      if (s.type === "quote") mustContain.push(["quote", s.quote]);
      if (s.type === "dotField") {
        if (s.completeAt) mustContain.push(["completeAt", s.completeAt]);
        if (s.titleAt) mustContain.push(["titleAt", s.titleAt]);
      }
      if (s.type === "kinetic") s.lines.forEach((l, j) => mustContain.push([`lines.${j}`, l]));
      if (s.type === "illustration" && s.cue) mustContain.push(["cue", s.cue]);
      for (const [field, text] of mustContain) {
        if (!spoken.includes(normalize(text))) {
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, field],
            message: `"${text}" kommt in der narration von "${s.id}" nicht wörtlich vor`,
          });
        }
      }
    });
  });

export type Episode = z.infer<typeof episodeSchema>;
export type Scene = z.infer<typeof sceneSchema>;

/* ---------- Manifest, das scripts/tts.ts schreibt ---------- */

export const phraseSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const manifestSchema = z.object({
  episodeId: z.string(),
  provider: z.enum(["google", "piper"]),
  voice: z.string(),
  generatedAt: z.string(),
  scenes: z.array(
    z.object({
      id: z.string(),
      file: z.string(),
      hash: z.string(),
      durationSec: z.number(),
      speechStartSec: z.number(),
      speechEndSec: z.number(),
      phrases: z.array(phraseSchema),
    }),
  ),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestScene = Manifest["scenes"][number];

/* ---------- Text-Helfer (von Node und Browser genutzt) ---------- */

/** Entfernt Chirp-Markup wie [pause short] und glättet Leerraum. */
export const stripMarkup = (s: string) =>
  s.replace(/\[pause(?: short| long)?\]/g, " ").replace(/\s+/g, " ").trim();

/** Für Vergleiche: Kleinschreibung, Satzzeichen weg, typografische Varianten vereinheitlichen. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„“”"'’‚‘]/g, "")
    .replace(/[.,;:!?–—…()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Zerlegt Narration in Phrasen an Satzzeichen und Pausen-Tags.
 * Diese Phrasen sind die Einheiten, die scripts/tts.ts an echte Sprechpausen im Audio anlegt.
 */
export const splitPhrases = (narration: string): string[] =>
  narration
    .split(/\[pause(?: short| long)?\]/g)
    .flatMap((chunk) => chunk.match(/[^.!?;:,]+[.!?;:,]?/g) ?? [])
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.replace(/[.!?;:,]/g, "").trim().length > 0);

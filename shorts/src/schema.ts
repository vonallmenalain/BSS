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
    /** Nur `swords`: «bury» = Schwerter versinken, ohne Söhne; «rise» = Schwerter liegen schon, die Söhne steigen am `cue` auf. */
    phase: z.enum(["both", "bury", "rise"]).default("both"),
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
  /*
   * Ab hier die Szenen der Looks (siehe src/looks.tsx). Alle Zeitpunkte sind Phrasen aus der
   * narration (`at`, `cues`): Etwas passiert genau dann, wenn die Stimme es sagt.
   */
  base.extend({
    /** Game-Look: Charakterkarte mit Pixel-Figur, Chips, Wertebalken und freischaltbarer Fähigkeit */
    type: z.literal("hero"),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    /** Pfeile links und rechts wie bei der Charakterwahl */
    select: z.boolean().default(false),
    /** Ohne `at` stehen Chips und Werte schon zu Beginn da */
    chips: z.array(z.object({ text: z.string().min(1), at: z.string().min(1).optional(), tone: z.enum(["zero", "plus"]).default("plus") })).max(6).default([]),
    stats: z.array(z.object({ label: z.string().min(1), value: z.number().min(0).max(100), at: z.string().min(1).optional() })).max(4).default([]),
    unlock: z.object({ badge: z.string().min(1), text: z.string().min(1), at: z.string().min(1) }).optional(),
  }),
  base.extend({
    /** Handy: Sperrbildschirm mit Benachrichtigung oder Chatverlauf */
    type: z.literal("chat"),
    mode: z.enum(["lock", "thread"]).default("thread"),
    contact: z.string().min(1),
    contactSub: z.string().optional(),
    lock: z.object({ time: z.string(), date: z.string(), title: z.string(), preview: z.string() }).optional(),
    messages: z
      .array(
        z.object({
          kind: z.enum(["text", "sticker", "plan", "divider"]).default("text"),
          text: z.string().default(""),
          /** Phrase, bei der die Nachricht ankommt. Ohne `at` steht sie schon im Verlauf. */
          at: z.string().optional(),
          meta: z.string().optional(),
        }),
      )
      .max(12)
      .default([]),
  }),
  base.extend({
    /** Kartentisch: die Lockvogel-Taktik aus Alma 56 in Etappen; `cues` sind die Takte der Etappe */
    type: z.literal("map"),
    stage: z.enum(["intro", "plan", "bait", "chase", "halt", "battle", "count"]),
    cues: z.array(z.string().min(1)).max(8).default([]),
    hud: z.string().optional(),
  }),
  base.extend({
    /** Stadion: Glaube als Staffelstab – von den Eltern zu den Söhnen zu dir */
    type: z.literal("relay"),
    stage: z.enum(["sword", "run", "mother", "handoff", "you"]),
    cues: z.array(z.string().min(1)).max(6).default([]),
    /** Grosse Zeile im Bild; muss wörtlich in der narration stehen und erscheint, wenn sie gesprochen wird */
    line: z.string().optional(),
    chips: z.array(z.string().min(1)).max(4).default([]),
  }),
  base.extend({
    /** Detektiv: Gegenüberstellung – ein Lichtkegel wandert zu der Figur, die gerade genannt wird */
    type: z.literal("lineup"),
    title: z.string().optional(),
    suspects: z
      .array(z.object({ name: z.string().min(1), figure: z.enum(["captain", "dream", "enemies", "mothers"]), at: z.string().min(1) }))
      .min(2)
      .max(4),
  }),
  base.extend({
    /** Quizshow: Aussage auf der Leinwand, zwei Buzzer, Countdown – ohne Auflösung */
    type: z.literal("buzzer"),
    statement: z.string().min(1),
    /** Phrase, bei der die Aussage erscheint */
    at: z.string().optional(),
    buttons: z.tuple([z.string(), z.string()]).default(["Fakt", "Mythos"]),
  }),
  base.extend({
    /** Game-Look: Wortblöcke fallen durcheinander in einen Schacht (wie beim Vers-Puzzle) */
    type: z.literal("blocks"),
    /** In richtiger Reihenfolge – die Szene mischt sie selbst */
    words: z.array(z.string().min(1)).min(3).max(14),
    /** «fall»: Blöcke fallen nacheinander; «stack»: liegen schon da und zittern */
    mode: z.enum(["fall", "stack"]).default("fall"),
  }),
  base.extend({
    /** Kartentisch: handgeschriebene Liste, Zeile für Zeile */
    type: z.literal("ledger"),
    title: z.string().min(1),
    lines: z
      .array(z.object({ label: z.string().min(1), value: z.string().min(1), at: z.string().min(1), mark: z.enum(["check", "cross", "circle", "none"]).default("none") }))
      .min(1)
      .max(6),
  }),
  base.extend({
    /** Kartentisch: Schatzkarte – der Weg führt zu einer Schriftstelle */
    type: z.literal("treasure"),
    target: z.string().min(1),
    /** [Weg beginnt, X erscheint] */
    cues: z.array(z.string().min(1)).max(2).default([]),
  }),
  base.extend({
    /** Notizbuch: Einträge erscheinen handgeschrieben, mit kleinen Zeichnungen */
    type: z.literal("journal"),
    title: z.string().min(1),
    entries: z
      .array(z.object({ text: z.string().min(1), at: z.string().min(1), icon: z.enum(["runner", "shield", "sword", "heart", "star"]) }))
      .min(1)
      .max(4),
  }),
  base.extend({
    /** Game-Look: die Pixel-Figur rennt, springt über Ausreden und sammelt Aufgaben ein */
    type: z.literal("jumper"),
    hurdles: z.array(z.object({ emoji: z.string(), label: z.string(), at: z.string().min(1) })).max(5).default([]),
    pickups: z.array(z.object({ emoji: z.string(), label: z.string(), at: z.string().min(1) })).max(5).default([]),
  }),
  base.extend({
    /** Vorschau auf die nächste Karte im Feed – damit das Video zur Umfrage oder Aufgabe überleitet */
    type: z.literal("teaser"),
    label: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).max(4).default([]),
    scale: z.object({ min: z.number(), max: z.number(), minLabel: z.string(), maxLabel: z.string() }).optional(),
    hint: z.string().default("Wisch weiter"),
  }),
]);

export const episodeSchema = z
  .object({
    id: z.string().regex(idRegex),
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    series: z.string().optional(),
    brand: z.object({ name: z.string(), label: z.string().optional() }),
    /** Visueller Stil der ganzen Episode (src/looks.tsx) */
    look: z.enum(["dawn", "arcade", "chat", "map", "track", "noir", "show", "journal"]).default("dawn"),
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
      if (s.type === "hero") {
        s.chips.forEach((c, j) => c.at && mustContain.push([`chips.${j}.at`, c.at]));
        s.stats.forEach((c, j) => c.at && mustContain.push([`stats.${j}.at`, c.at]));
        if (s.unlock) mustContain.push(["unlock.at", s.unlock.at]);
      }
      if (s.type === "chat") s.messages.forEach((m, j) => m.at && mustContain.push([`messages.${j}.at`, m.at]));
      if (s.type === "map" || s.type === "relay") s.cues.forEach((c, j) => mustContain.push([`cues.${j}`, c]));
      if (s.type === "relay" && s.line) mustContain.push(["line", s.line]);
      if (s.type === "lineup") s.suspects.forEach((x, j) => mustContain.push([`suspects.${j}.at`, x.at]));
      if (s.type === "buzzer" && s.at) mustContain.push(["at", s.at]);
      if (s.type === "ledger") s.lines.forEach((x, j) => mustContain.push([`lines.${j}.at`, x.at]));
      if (s.type === "treasure") s.cues.forEach((c, j) => mustContain.push([`cues.${j}`, c]));
      if (s.type === "journal") s.entries.forEach((x, j) => mustContain.push([`entries.${j}.at`, x.at]));
      if (s.type === "jumper") [...s.hurdles, ...s.pickups].forEach((x, j) => mustContain.push([`jumper.${j}.at`, x.at]));
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
 * Zerlegt Narration in Phrasen an Satzzeichen, Gedankenstrichen und Pausen-Tags.
 * Diese Phrasen sind die Einheiten, die scripts/tts.ts an echte Sprechpausen im Audio anlegt.
 * Ein Gedankenstrich ist eine Pause wie ein Komma (siehe `speakable`).
 */
export const splitPhrases = (narration: string): string[] =>
  narration
    .split(/\[pause(?: short| long)?\]/g)
    // Kapitel:Vers (53:20) und Zahlen wie 20 000 bleiben eine Einheit – sonst stünde «20.» allein im Untertitel
    .map((chunk) => chunk.replace(/\s+[-–—](?=\s|$)/g, " –").replace(/(\d):(\d)/g, "$1\u0000$2"))
    .flatMap((chunk) => chunk.match(/[^.!?;:,–—]+[.!?;:,–—]?/g) ?? [])
    .map((p) => p.replace(/\u0000/g, ":").replace(/\s+/g, " ").trim())
    .filter((p) => p.replace(/[.!?;:,–—]/g, "").trim().length > 0);

/* ---------- Was die Stimme bekommt ---------- */

const ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreissig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
const MONTHS = /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/;

/** Grundzahl in Worten (0 … 9999): 53 → «dreiundfünfzig». */
export const cardinal = (n: number): string => {
  const pre = (k: number) => (k === 1 ? "ein" : ONES[k]);
  if (n < 20) return ONES[n];
  if (n < 100) return (n % 10 ? `${pre(n % 10)}und` : "") + TENS[Math.floor(n / 10)];
  if (n < 1000) return `${pre(Math.floor(n / 100))}hundert${n % 100 ? cardinal(n % 100) : ""}`;
  if (n < 10000) return `${pre(Math.floor(n / 1000))}tausend${n % 1000 ? cardinal(n % 1000) : ""}`;
  return String(n);
};

/**
 * Der Text, den die Stimme spricht – die Untertitel zeigen weiter die narration.
 *
 * - **Gedankenstriche sind Pausen**, kein «Minus»: «besiegt – da greifen» wird «besiegt, da greifen».
 *   Nur zwischen zwei Zahlen bleibt der Strich (eine Rechnung wie 10 - 4).
 * - **Zahl vor einem Satzpunkt ist eine Grundzahl**: «Alma 53.» würde sonst «dreiundfünfzigste»
 *   gelesen; daraus wird «Alma dreiundfünfzig.». Vor einem Monat bleibt die Ordnungszahl («19. Oktober»).
 * - **Kapitel:Vers** wird ausgesprochen: «53:20» → «dreiundfünfzig, Vers zwanzig».
 */
export const speakable = (text: string): string =>
  text
    .replace(/(\d+):(\d+)/g, (_, a: string, b: string) => `${cardinal(Number(a))}, Vers ${cardinal(Number(b))}`)
    .replace(/(\S)\s+[-–—]\s+(?=\S)/g, (m: string, before: string, offset: number, all: string) => {
      const after = all.slice(offset + m.length);
      return /\d/.test(before) && /^\d/.test(after) ? m : `${before.replace(/[,;]$/, "")}, `;
    })
    .replace(/\s+[-–—]\s*$/g, "")
    .replace(/\b(\d{1,4})\.(?=\s|$)/g, (m: string, n: string, offset: number, all: string) => {
      const next = all.slice(offset + m.length).trimStart();
      return MONTHS.test(next) ? m : `${cardinal(Number(n))}.`;
    })
    .replace(/,\s*,/g, ",");

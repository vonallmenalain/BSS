/**
 * Vertonung einer Episode: Episode-JSON → WAV pro Szene → manifest.json
 *
 *   npm run tts -- content/2026-10-25-treu-zu-allen-zeiten.json
 *   npm run tts -- content/…json --voice de-DE-Chirp3-HD-Puck --rate 1.05
 *   npm run tts -- content/…json --provider piper        (offline, z.B. auf der 4090)
 *   npm run tts -- content/…json --dry-run               (zeigt Requests, kein API-Call)
 *
 * Eigenschaften
 * - Cache: pro Szene Hash über Provider, Stimme, Rate, Text, Aussprache. Unveränderte Szenen
 *   kosten beim nächsten Lauf nichts. --force erzwingt Neuvertonung.
 * - Robust: Retry mit Backoff bei 429/5xx/Netzfehlern, Timeout pro Request, begrenzte Parallelität.
 * - Graceful Degradation: Aussprache-Overrides und Pausen-Markup sind bei Chirp 3 HD Preview-Features.
 *   Lehnt die API sie ab, wird automatisch ohne sie neu angefragt (mit Warnung).
 * - Timing: Sprechanfang/-ende und Pausen werden aus dem Audio gemessen; Phrasen rasten auf echte
 *   Pausen ein. Remotion nutzt das für Wort-Highlighting und Musik-Ducking.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type Episode, type Manifest, episodeSchema, speakable, splitPhrases, stripMarkup } from "../src/schema";
import { loadDotEnv } from "./lib/env";
import { alignPhrases, analyzeSpeech, parseWav, writeWav } from "./lib/wav";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const GOOGLE_MAX_BYTES = 4800; // API-Limit 5000 Bytes pro Request, mit Reserve

/* ---------- CLI & Umgebung ---------- */

type Args = {
  episodePath: string;
  provider?: "google" | "piper";
  voice?: string;
  rate?: number;
  force: boolean;
  dryRun: boolean;
  concurrency: number;
};

const parseArgs = (argv: string[]): Args => {
  const a: Args = { episodePath: "", force: false, dryRun: false, concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--force") a.force = true;
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--provider") a.provider = argv[++i] as Args["provider"];
    else if (v === "--voice") a.voice = argv[++i];
    else if (v === "--rate") a.rate = Number(argv[++i]);
    else if (v === "--concurrency") a.concurrency = Math.max(1, Number(argv[++i]));
    else if (!v.startsWith("--")) a.episodePath = v;
    else throw new Error(`Unbekannte Option ${v}`);
  }
  if (!a.episodePath) throw new Error("Pfad zum Episode-JSON fehlt, z.B. npm run tts -- content/<episode>.json");
  if (a.provider && !["google", "piper"].includes(a.provider)) throw new Error("--provider muss google oder piper sein");
  if (a.rate !== undefined && !(a.rate >= 0.25 && a.rate <= 2)) throw new Error("--rate muss zwischen 0.25 und 2 liegen");
  return a;
};

/* ---------- Provider ---------- */

type SynthRequest = { markup: string; voice: string; languageCode: string; rate: number; pronunciations: Episode["pronunciations"] };

class FatalError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const googleAuth = (): { url: string; headers: Record<string, string> } => {
  const base = (process.env.GOOGLE_TTS_ENDPOINT || "https://texttospeech.googleapis.com").replace(/\/$/, "");
  const url = `${base}/v1/text:synthesize`;
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  if (process.env.GOOGLE_CLOUD_PROJECT) headers["x-goog-user-project"] = process.env.GOOGLE_CLOUD_PROJECT;

  if (process.env.GOOGLE_TTS_API_KEY) {
    headers["x-goog-api-key"] = process.env.GOOGLE_TTS_API_KEY;
    return { url, headers };
  }
  let token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    try {
      token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      /* gcloud nicht installiert oder nicht eingeloggt */
    }
  }
  if (!token) {
    throw new FatalError(
      "Keine Google-Zugangsdaten. Setze GOOGLE_TTS_API_KEY in .env oder melde dich mit `gcloud auth login` an.",
    );
  }
  headers.Authorization = `Bearer ${token}`;
  return { url, headers };
};

const synthGoogle = async (req: SynthRequest): Promise<Buffer> => {
  const { url, headers } = googleAuth();
  let useMarkup = true;
  let usePron = req.pronunciations.length > 0;

  for (let attempt = 1; ; attempt++) {
    const input: Record<string, unknown> = useMarkup ? { markup: req.markup } : { text: stripMarkup(req.markup) };
    if (usePron) {
      input.customPronunciations = {
        pronunciations: req.pronunciations.map((p) => ({
          phrase: p.phrase,
          phoneticEncoding: "PHONETIC_ENCODING_IPA",
          pronunciation: p.ipa,
        })),
      };
    }
    const body = {
      input,
      voice: { languageCode: req.languageCode, name: req.voice },
      audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate: req.rate },
    };

    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) {
      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error("Antwort ohne audioContent");
      const raw = Buffer.from(json.audioContent, "base64");
      // LINEAR16 kommt normalerweise mit WAV-Header; falls nicht, Header selbst bauen.
      if (raw.toString("ascii", 0, 4) === "RIFF") return raw;
      const pcm = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
      return writeWav({ sampleRate: 24000, channels: 1, samples: pcm });
    }

    const errText = await res.text();
    if (res.status === 400 && usePron && /pronunciation/i.test(errText)) {
      console.warn("  ⚠ Aussprache-Overrides abgelehnt – erneut ohne. API:", short(errText));
      usePron = false;
      continue;
    }
    if (res.status === 400 && useMarkup && /markup/i.test(errText)) {
      console.warn("  ⚠ Markup (Pausen-Tags) abgelehnt – erneut als reiner Text. API:", short(errText));
      useMarkup = false;
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new FatalError(
        `Google TTS ${res.status}: ${short(errText)}\n→ Ist die Text-to-Speech API im Projekt aktiviert, Billing aktiv und der Key für diese API freigegeben?`,
      );
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }
    throw new Error(`Google TTS ${res.status}: ${short(errText)}`);
  }
};

const synthPiper = (req: SynthRequest, outFile: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const model = process.env.PIPER_MODEL;
    if (!model || !fs.existsSync(model)) {
      reject(new FatalError("PIPER_MODEL zeigt auf kein .onnx-Modell (z.B. de_DE-thorsten-high.onnx)."));
      return;
    }
    const bin = process.env.PIPER_BIN || "piper";
    const args = ["-m", model, "-f", outFile, "--sentence-silence", "0.3", "--length-scale", String(1 / req.rate)];
    const p = spawn(bin, args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new FatalError(`Piper nicht startbar (${bin}): ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Piper exit ${code}: ${short(err)}`))));
    // Piper kennt keine Pausen-Tags; Satzpausen kommen über --sentence-silence.
    p.stdin.end(stripMarkup(req.markup));
  });

const backoff = (attempt: number) => Math.min(16_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 400;
const short = (s: string) => s.replace(/\s+/g, " ").slice(0, 300);

/* ---------- Phrasen mit Grenzstärke ---------- */

/** Wie splitPhrases, markiert aber, ob nach einer Phrase eine echte Pause zu erwarten ist. */
const phrasesWithStrength = (narration: string) => {
  const chunks = narration.split(/\[pause(?: short| long)?\]/g);
  const phrases: string[] = [];
  const strong: boolean[] = [];
  chunks.forEach((chunk, ci) => {
    const ps = splitPhrases(chunk);
    ps.forEach((p, pi) => {
      phrases.push(p);
      const endOfChunk = pi === ps.length - 1 && ci < chunks.length - 1;
      strong.push(endOfChunk || /[.!?;:]$/.test(p));
    });
  });
  return { phrases, strong };
};

/* ---------- Ablauf ---------- */

const pool = async <T,>(items: T[], n: number, fn: (t: T) => Promise<void>) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
};

const main = async () => {
  loadDotEnv(ROOT);
  const args = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(fs.readFileSync(path.resolve(args.episodePath), "utf8"));
  const parsed = episodeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Episode ungültig:");
    for (const i of parsed.error.issues) console.error(`  • ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }
  const ep = parsed.data;
  const provider = args.provider ?? ep.voice.provider;
  const voice = provider === "piper" ? path.basename(process.env.PIPER_MODEL || "piper") : (args.voice ?? ep.voice.name);
  const rate = args.rate ?? ep.voice.speakingRate;

  const audioDirRel = `episodes/${ep.id}/audio`;
  const audioDir = path.join(PUBLIC, audioDirRel);
  fs.mkdirSync(audioDir, { recursive: true });

  console.log(`▶ ${ep.title} (${ep.scenes.length} Szenen) · ${provider} · ${voice} · Rate ${rate}`);

  const results = new Map<string, Manifest["scenes"][number]>();
  const stats = { cached: 0, synthesized: 0 };

  await pool(ep.scenes, provider === "piper" ? 1 : args.concurrency, async (scene) => {
    // Die Stimme bekommt die sprechbare Fassung (Striche als Pausen, Zahlen als Grundzahlen);
    // Phrasen und Untertitel kommen aus der narration selbst.
    const narration = scene.narration.trim();
    const markup = speakable(narration);
    const bytes = Buffer.byteLength(markup, "utf8");
    if (provider === "google" && bytes > GOOGLE_MAX_BYTES) {
      throw new FatalError(`Szene "${scene.id}": ${bytes} Bytes – Google erlaubt max. 5000 pro Request. Szene aufteilen.`);
    }
    const hash = createHash("sha256")
      .update(JSON.stringify({ provider, voice, rate, markup, p: provider === "google" ? ep.pronunciations : [] }))
      .digest("hex")
      .slice(0, 12);
    const fileRel = `${audioDirRel}/${scene.id}-${hash}.wav`;
    const fileAbs = path.join(PUBLIC, fileRel);
    const req: SynthRequest = { markup, voice, languageCode: ep.voice.languageCode, rate, pronunciations: ep.pronunciations };

    if (args.dryRun) {
      console.log(`  [dry] ${scene.id}: ${bytes} B → ${fileRel}\n        «${markup}»`);
      return;
    }

    if (fs.existsSync(fileAbs) && !args.force) {
      stats.cached++;
    } else {
      const tmp = `${fileAbs}.part`;
      if (provider === "google") fs.writeFileSync(tmp, await synthGoogle(req));
      else await synthPiper(req, tmp);
      fs.renameSync(tmp, fileAbs); // atomar: abgebrochene Läufe hinterlassen keine halben Dateien im Cache
      stats.synthesized++;
    }

    const analysis = analyzeSpeech(parseWav(fs.readFileSync(fileAbs)));
    const { phrases, strong } = phrasesWithStrength(narration);
    const aligned = alignPhrases(phrases, strong, analysis);
    results.set(scene.id, {
      id: scene.id,
      file: fileRel,
      hash,
      durationSec: round(analysis.durationSec),
      speechStartSec: round(analysis.speechStartSec),
      speechEndSec: round(analysis.speechEndSec),
      phrases: aligned.map((p) => ({ text: p.text, start: round(p.start), end: round(p.end) })),
    });
    const snapped = analysis.gaps.length;
    console.log(
      `  ✓ ${scene.id.padEnd(10)} ${analysis.durationSec.toFixed(2).padStart(5)} s  ${phrases.length} Phrasen / ${snapped} Pausen erkannt`,
    );
  });

  if (args.dryRun) return;

  const manifest: Manifest = {
    episodeId: ep.id,
    provider,
    voice,
    generatedAt: new Date().toISOString(),
    scenes: ep.scenes.map((s) => results.get(s.id)!),
  };
  const manifestPath = path.join(PUBLIC, `episodes/${ep.id}/manifest.json`);
  fs.writeFileSync(`${manifestPath}.part`, JSON.stringify(manifest, null, 2));
  fs.renameSync(`${manifestPath}.part`, manifestPath);

  // Erst NACH erfolgreichem Manifest aufräumen: bricht ein Lauf mittendrin ab,
  // zeigt das alte Manifest weiterhin auf existierende Dateien.
  const keep = new Set(manifest.scenes.map((s) => path.basename(s.file)));
  for (const f of fs.readdirSync(audioDir)) {
    if (!keep.has(f)) fs.rmSync(path.join(audioDir, f), { force: true });
  }

  const voiceTotal = manifest.scenes.reduce((a, s) => a + s.durationSec, 0);
  console.log(
    `■ ${stats.synthesized} neu, ${stats.cached} aus Cache · Stimme gesamt ${voiceTotal.toFixed(1)} s · Manifest: ${path.relative(ROOT, manifestPath)}`,
  );
};

const round = (n: number) => Math.round(n * 1000) / 1000;

main().catch((e) => {
  console.error(e instanceof FatalError ? `✗ ${e.message}` : e);
  process.exit(1);
});

/**
 * Was jede Szene hat – in einer eigenen Datei, damit die Szenen einer Woche ihr Schema
 * selbst mitbringen können (`scenes/w46/*.schema.ts`), ohne dass sich die Dateien
 * gegenseitig im Kreis importieren.
 */
import { z } from "zod";

export const idRegex = /^[a-z0-9][a-z0-9-]*$/;

export const sceneBase = z.object({
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


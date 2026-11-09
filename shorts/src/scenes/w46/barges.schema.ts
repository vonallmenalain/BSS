import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Meer bei Nacht: die Schiffe der Jarediten und die sechzehn Steine (Ether 2–3, 6).
 *
 * hook: acht Schiffe, sechzehn Steine, null Fenster · build: die Werft, dicht wie eine Schüssel ·
 * air: die Probleme und die Löcher oben und unten · dark: drinnen dunkel, der Herr fragt zurück ·
 * stones: am Berg Schelem, das Schmelzfeuer · mount: auf den Gipfel, die Bitte · touch: Stein um
 * Stein leuchtet · voyage: Sturm und 344 Tage · recap: Stück für Stück.
 */
export const schema = sceneBase.extend({
  type: z.literal("barges"),
  stage: z.enum(["hook", "build", "air", "dark", "stones", "mount", "touch", "voyage", "recap"]),
  /** Die Takte der Etappe – Phrasen aus der narration */
  cues: z.array(z.string().min(1)).max(6).default([]),
  /**
   * Grosse Zeilen im Bild (hook: die Zähler; air: die Probleme; recap: die Liste). Erscheinen bei
   * `at`; die gesprochene Phrase `at` wird nicht noch einmal untertitelt.
   */
  lines: z.array(z.object({ text: z.string().min(1), at: z.string().min(1) })).max(4).default([]),
  /** Eine grosse Zeile (dark: die Frage zurück; recap: die Pointe) – bei `at`, nicht untertitelt */
  say: z.object({ text: z.string().min(1), at: z.string().min(1) }).optional(),
});

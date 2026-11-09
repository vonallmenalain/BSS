import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Labor mit Pflanzenlicht: das Experiment mit dem Samenkorn (Alma 32). Die Etappen:
 * hook – das Korn unter der Lupe; outcast – die Zoramiten vor der Synagoge (auf dem Bildschirm
 * im Labor); ask – die Frage an Alma auf dem Hügel und seine Antwort; material – Korn, Boden,
 * Wunsch; swell – es quillt, keimt, wächst; know – Ergebnis mit Stempel; neglect – die
 * Gegenprobe ohne Pflege; tree – der Baum; you – Pflänzchen in allen Grössen und die Frage.
 */
export const schema = sceneBase.extend({
  type: z.literal("seed"),
  stage: z.enum(["hook", "outcast", "ask", "material", "swell", "know", "neglect", "tree", "you"]),
  /** Kopfzeile des Versuchsprotokolls */
  title: z.string().optional(),
  /** Zeilen im Protokoll – erscheinen bei `at` (ohne `at`: stehen schon da) */
  lines: z.array(z.object({ label: z.string().min(1), text: z.string().min(1), at: z.string().min(1).optional() })).max(5).default([]),
  /** Stempel auf dem Protokoll */
  stamp: z.object({ text: z.string().min(1), at: z.string().min(1) }).optional(),
  /** Sprechblasen (Etappe ask): das Volk fragt, Alma antwortet */
  say: z.array(z.object({ who: z.enum(["volk", "alma"]), text: z.string().min(1), at: z.string().min(1) })).max(2).default([]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

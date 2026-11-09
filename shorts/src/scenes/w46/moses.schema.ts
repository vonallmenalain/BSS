import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Hoher Berg unter einem Himmel voller Welten: Mose erkennt die Fälschung (Mose 1).
 *
 * hook: «Echt oder Fälschung?» über dem Gipfel · glory: Gottes Herrlichkeit als Licht · weak: das
 * Licht geht, Mose sinkt zu Boden, die Sterne ziehen ihre Bahnen · tempter: eine dunkle Gestalt
 * und ihre Worte · compare: Mose steht auf und fragt · judge: die Echtheitsprüfung – Original
 * gegen Prüfling · depart: Satan tobt, Mose ruft Gott an, die Gestalt zerfällt · worlds: die
 * Erde, Menschen ohne Zahl, Welten · answer: die Stelle, die Gottes Antwort trägt – versiegelt.
 */
export const schema = sceneBase.extend({
  type: z.literal("moses"),
  stage: z.enum(["hook", "glory", "weak", "tempter", "compare", "judge", "depart", "worlds", "answer"]),
  /** Was Satan sagt – flackernde Schrift ohne Glanz, erscheint bei `at` */
  attack: z.object({ text: z.string().min(1), at: z.string().min(1) }).optional(),
  /** Grosse Zeilen im Bild (Moses Antworten, «Weiche, Satan!», die Fragen) – erscheinen bei `at` */
  lines: z.array(z.object({ text: z.string().min(1), at: z.string().min(1) })).max(4).default([]),
  /** Die Takte der Etappe, in der Reihenfolge, in der die Szene sie braucht */
  cues: z.array(z.string().min(1)).max(6).default([]),
});

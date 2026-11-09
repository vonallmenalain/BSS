import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Thronsaal aus Zedernholz: zwei Frauen, ein Kind und Salomos Urteil (1 Könige 3:9–28).
 *
 * hook: zwei Frauen im Lichtkegel, das Kind in der Mitte; wish: Salomo bittet um ein hörendes
 * Herz statt Reichtum; women: Rückblick aufs Haus in der Nacht; claims: Gegenüberstellung mit
 * Waage; sword: das Schwert wird gebracht und erhoben; mother: die beiden Antworten; verdict:
 * das Kind geht zur Mutter; wisdom: ganz Israel erkennt Gottes Weisheit.
 */
export const schema = sceneBase.extend({
  type: z.literal("verdict"),
  stage: z.enum(["hook", "wish", "women", "claims", "sword", "mother", "verdict", "wisdom"]),
  /** Die Takte der Etappe – je Etappe in fester Reihenfolge (siehe `verdict.tsx`) */
  cues: z.array(z.string().min(1)).max(6).default([]),
  /**
   * Sprechblasen über den Frauen (`a` links, `b` rechts). Jede erscheint, wenn die Stimme `at`
   * spricht, und löst die vorige derselben Frau ab. Der Text steht so in der narration und wird
   * darum nicht noch einmal untertitelt.
   */
  bubbles: z.array(z.object({ who: z.enum(["a", "b"]), text: z.string().min(1), at: z.string().min(1) })).max(4).default([]),
});

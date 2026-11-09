import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Heiligtum in Schilo bei Nacht: die Lampe Gottes, Samuel und Eli (1 Samuel 3). Samuel schläft
 * links beim Leuchter, Eli rechts in seiner Kammer; dazwischen läuft Samuel hin und her. Am Ende
 * der Morgen in der offenen Tür.
 *
 * Die Takte (`cues`) je Etappe:
 * - `hook` – [Nacht, der Name, «Wer war das?»]
 * - `temple` – [Schilo, Samuel, Eli, selten]
 * - `call` – [Lampe, Samuel schläft, springt auf, rennt zu Eli]
 * - `eli` – [Eli spricht, «Leg dich wieder hin» – Samuel kehrt um]
 * - `again` – [rennt zu Eli, kennt den Herrn noch nicht]
 * - `understand` – [Eli begreift, «Der Herr ruft», sagt ihm die Antwort]
 * - `answer` – [legt sich hin, still, antwortet anders]
 * - `grow` – [Türen auf, wächst heran, der Herr mit ihm, kein Wort fällt]
 */
export const schema = sceneBase.extend({
  type: z.literal("samuel"),
  stage: z.enum(["hook", "temple", "call", "eli", "again", "understand", "answer", "grow"]),
  /**
   * Die Rufe: Bei `at` hallt der Name (`text`) durchs Heiligtum, und der Zähler springt auf `n`.
   * Wörter der Phrase, die im Namen stehen, werden nicht noch einmal untertitelt.
   */
  calls: z
    .array(z.object({ n: z.number().int().min(1).max(4), at: z.string().min(1), text: z.string().min(1).default("SAMUEL!") }))
    .max(3)
    .default([]),
  /** Der Zähler der Rufe zu Beginn der Szene (0 = noch keiner, unsichtbar) */
  count: z.number().int().min(0).max(4).default(0),
  /**
   * Sprechblasen, die bei `at` aufgehen. Steht der Text in der narration, wird er nicht untertitelt.
   * `sealed`: Die Blase bleibt versiegelt – was darin steht, verrät die Folge nicht.
   */
  say: z
    .array(z.object({ who: z.enum(["samuel", "eli"]), text: z.string().min(1), at: z.string().min(1), sealed: z.boolean().default(false) }))
    .max(3)
    .default([]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

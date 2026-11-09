import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Bildergeschichte: Nephi, Laman und Lemuel und dieselbe Frage (1 Nephi 10–11, 15). Jede Szene
 * ist eine Comicseite: oben ein grosses Panel, unten (unter den Untertiteln) ein Streifen mit
 * kleinen Panels. Panels, Blasen und Boxen erscheinen bei der Phrase, die die Stimme gerade sagt.
 */
export const schema = sceneBase.extend({
  type: z.literal("comic"),
  /**
   * hook: drei Brüder, drei Fragezeichen, Licht auf einen; dream: Lehi erzählt vom Ölbaum;
   * ponder: Nephi sinnt nach und wird entrückt; dispute: Streit im Zelt; ask: «Habt ihr den
   * Herrn gefragt?»; reply: die Antwort der Brüder; answer: Gottes Versprechen; peace: Ruhe am Feuer.
   */
  stage: z.enum(["hook", "dream", "ponder", "dispute", "ask", "reply", "answer", "peace"]),
  /** Kleine gelbe Erzählbox oben links im Panel – nicht gesprochen («Zurück im Zelt») */
  caption: z.string().optional(),
  /** Sprechblase; der Text wird wörtlich gesprochen und darum nicht untertitelt. Sie erscheint bei `at`. */
  bubble: z
    .object({
      text: z.string().min(1),
      at: z.string().min(1),
      who: z.enum(["nephi", "brothers"]),
    })
    .optional(),
  /** Kleine Panels im Streifen unten (Etappe answer): Bild und Wort, erscheinen bei `at` */
  items: z.array(z.object({ text: z.string().min(1), icon: z.enum(["heart", "hands", "tablets"]), at: z.string().min(1) })).max(3).default([]),
  /** Die Takte der Etappe – siehe die Szene (`scenes/w46/comic.tsx`) */
  cues: z.array(z.string().min(1)).max(6).default([]),
});

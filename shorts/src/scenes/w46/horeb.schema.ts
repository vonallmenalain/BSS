import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Berg Horeb im Unwetter: Sturm, Beben, Feuer – und die leise Stimme (1 Könige 19:2–13); dazu
 * James im Hallenbad, der auf einen leisen Gedanken hört (Für eine starke Jugend, Oktober 2026).
 *
 * Etappen: hook – Sturm, Erdbeben, Feuer in drei Schlägen; broom – Elija unter dem Ginsterstrauch;
 * angel – der Engel stärkt ihn, vierzig Tage bis zum Horeb; cave – in der Höhle; wind – der Sturm
 * zerbricht die Felsen; quakefire – Erdbeben und Feuer; whisper – das leise Säuseln, Elija verhüllt
 * sein Gesicht; pool – James auf dem Hochsitz, der Gedanke; report – er meldet es, der Frau geht es
 * wieder gut; end – die Frage zum Schluss.
 */
export const schema = sceneBase.extend({
  type: z.literal("horeb"),
  stage: z.enum(["hook", "broom", "angel", "cave", "wind", "quakefire", "whisper", "pool", "report", "end"]),
  /** Die Takte der Etappe – Phrasen der narration (siehe horeb.tsx, je Etappe) */
  cues: z.array(z.string().min(1)).max(6).default([]),
  /**
   * Zeilen, die gross im Bild stehen und bei `at` erscheinen. `big`: Schlagzeile («Nicht im Sturm.»),
   * `voice`: die Frage Gottes, `say`: was eine Figur sagt, `thought`: ein leiser Gedanke, `quote`:
   * ein Satz mit Namen darunter (`by`). Ihre Wörter werden nicht noch einmal untertitelt.
   */
  lines: z
    .array(
      z.object({
        text: z.string().min(1),
        at: z.string().min(1),
        style: z.enum(["big", "voice", "say", "thought", "quote", "question"]).default("big"),
        by: z.string().optional(),
      }),
    )
    .max(4)
    .default([]),
});

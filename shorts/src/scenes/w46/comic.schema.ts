import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Bildergeschichte: Nephi, Laman und Lemuel und dieselbe Frage (1 Nephi 15) */
export const schema = sceneBase.extend({
  type: z.literal("comic"),
  stage: z.enum(["dream", "dispute", "ponder", "ask", "reply", "answer", "peace"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

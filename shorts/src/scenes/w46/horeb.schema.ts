import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Berg Horeb im Unwetter: Sturm, Beben, Feuer – und die leise Stimme (1 Könige 19) */
export const schema = sceneBase.extend({
  type: z.literal("horeb"),
  stage: z.enum(["hook", "flee", "cave", "wind", "quake", "fire", "whisper", "pool"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

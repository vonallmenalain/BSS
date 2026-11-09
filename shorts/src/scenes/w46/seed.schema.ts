import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Labor mit Pflanzenlicht: das Experiment mit dem Samenkorn (Alma 32) */
export const schema = sceneBase.extend({
  type: z.literal("seed"),
  stage: z.enum(["hook", "outcast", "wish", "plant", "swell", "grow", "neglect", "tree"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Hoher Berg unter einem Himmel voller Welten: Mose erkennt die Fälschung (Mose 1) */
export const schema = sceneBase.extend({
  type: z.literal("moses"),
  stage: z.enum(["hook", "glory", "weak", "tempter", "compare", "depart", "worlds", "question"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

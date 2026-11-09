import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Thronsaal aus Zedernholz: zwei Frauen, ein Kind und Salomos Urteil (1 Könige 3) */
export const schema = sceneBase.extend({
  type: z.literal("verdict"),
  stage: z.enum(["hook", "wish", "women", "claims", "sword", "mother", "wisdom"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

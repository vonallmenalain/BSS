import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Nachrichtensender: drei Städte, drei Arten, eine Botschaft aufzunehmen (Apostelgeschichte 17) */
export const schema = sceneBase.extend({
  type: z.literal("news"),
  stage: z.enum(["breaking", "thessalonich", "riot", "beroea", "check", "athens", "trend", "choice"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

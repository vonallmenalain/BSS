import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Heiligtum in Schilo bei Nacht: die Lampe Gottes, Samuel und Eli (1 Samuel 3) */
export const schema = sceneBase.extend({
  type: z.literal("samuel"),
  stage: z.enum(["hook", "temple", "call", "eli", "again", "understand", "answer", "grow"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

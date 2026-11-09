import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/** Farmhaus 1829 bei Kerzenlicht: Oliver Cowdery, ein Gebet in der Nacht, das niemand kennt (LuB 6:22–23) */
export const schema = sceneBase.extend({
  type: z.literal("oliver"),
  stage: z.enum(["hook", "school", "night", "secret", "journey", "scribe", "revelation", "witness"]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

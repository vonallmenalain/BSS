import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Farmhaus 1829 bei Kerzenlicht: Oliver Cowdery, ein Gebet in der Nacht, das niemand kennt
 * (LuB 6:14–24). Die Etappen:
 *
 * - `hook`: das Haus im Schnitt, alle schlafen – nur in einer Kammer steigt ein Gebet auf
 * - `house`: das Farmhaus im Schnee, Oliver kommt mit seinen Büchern, die goldenen Platten
 * - `night`: Oliver im Bett, die Kerze geht aus, Mondlicht – und dann Frieden
 * - `secret`: ein Brief wird versiegelt: «Nur Gott und Oliver»
 * - `journey`: die Karte von Manchester nach Harmony, Frühling 1829
 * - `revelation`: am Tisch – die Worte der Offenbarung erscheinen in Handschrift (`lines`)
 * - `witness`: Oliver erstarrt, das Siegel bricht auf
 *
 * `cues` sind die Takte der Etappe (in der Reihenfolge, in der sie gesprochen werden).
 */
export const schema = sceneBase.extend({
  type: z.literal("oliver"),
  stage: z.enum(["hook", "house", "night", "secret", "journey", "revelation", "witness"]),
  /** Etappe `revelation`: Zeilen in Handschrift – erscheinen Wort für Wort, wenn sie gesprochen werden */
  lines: z.array(z.object({ text: z.string().min(1), at: z.string().min(1) })).max(3).default([]),
  /** Ein Wort, das in der Handschrift golden aufleuchtet, wenn es gesprochen wird */
  glowAt: z.string().optional(),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

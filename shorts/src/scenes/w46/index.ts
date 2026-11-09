import type React from "react";
import type { TimelineScene } from "../../lib/timing";
import * as oliver from "./oliver";
import * as samuel from "./samuel";
import * as seed from "./seed";
import * as comic from "./comic";
import * as news from "./news";
import * as barges from "./barges";
import * as moses from "./moses";
import * as horeb from "./horeb";
import * as verdict from "./verdict";

/*
 * Die Szenen der Woche zur Suche nach Wahrheit (9.–15. November). Jede liegt in einer eigenen
 * Datei und bringt zweierlei: die Szene selbst (`Scene`) und die Wörter, die nicht unten
 * untertitelt werden, weil sie gross im Bild stehen (`hidden`). Ihr Schema steht daneben
 * (`<typ>.schema.ts`), ihr Look ebenso (`<typ>.look.ts`).
 */
export const W46_SCENES: Record<string, { Scene: React.FC<{ ts: TimelineScene }>; hidden: (ts: TimelineScene) => Set<number> }> = {
  oliver, samuel, seed, comic, news, barges, moses, horeb, verdict,
};

import type React from "react";
import type { TimelineScene } from "../../lib/timing";
import * as emmaus from "./emmaus";
import * as enos from "./enos";
import * as feed from "./feed";
import * as jordan from "./jordan";
import * as menu from "./menu";
import * as quest from "./quest";
import * as stack from "./stack";
import * as templefind from "./templefind";
import * as tracking from "./tracking";
import * as wilderness from "./wilderness";

/*
 * Die Szenen der Woche zum Schriftstudium (2.–8. November). Jede liegt in einer eigenen Datei
 * und bringt zweierlei: die Szene selbst (`Scene`) und die Wörter, die nicht unten untertitelt
 * werden, weil sie gross im Bild stehen (`hidden`).
 */
export const W45_SCENES: Record<string, { Scene: React.FC<{ ts: TimelineScene }>; hidden: (ts: TimelineScene) => Set<number> }> = {
  quest,
  wilderness,
  templefind,
  tracking,
  feed,
  menu,
  jordan,
  emmaus,
  enos,
  stack,
};

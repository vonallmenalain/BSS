/*
 * Die Schemas der Szenen der Woche 9.–15. November (Suche nach Wahrheit). Jede Szene bringt
 * ihr Schema in ihrer eigenen Datei mit (`<typ>.schema.ts`); hier stehen sie beisammen, damit
 * `schema.ts` sie in die Liste aller Szenen aufnimmt.
 */
import { schema as oliver } from "./oliver.schema";
import { schema as samuel } from "./samuel.schema";
import { schema as seed } from "./seed.schema";
import { schema as comic } from "./comic.schema";
import { schema as news } from "./news.schema";
import { schema as barges } from "./barges.schema";
import { schema as moses } from "./moses.schema";
import { schema as horeb } from "./horeb.schema";
import { schema as verdict } from "./verdict.schema";

export const W46_SCHEMAS = [oliver, samuel, seed, comic, news, barges, moses, horeb, verdict] as const;

/** Die Szenentypen der Woche – ihre Phrasen sammelt `phrasesOf` von selbst. */
export const W46_TYPES = new Set<string>(W46_SCHEMAS.map((s) => s.shape.type.value));

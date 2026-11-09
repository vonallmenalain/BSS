/* Die Looks der Woche 9.–15. November – je einer in der Datei seiner Folge (`<typ>.look.ts`). */
import { look as oliver } from "./oliver.look";
import { look as samuel } from "./samuel.look";
import { look as seed } from "./seed.look";
import { look as comic } from "./comic.look";
import { look as news } from "./news.look";
import { look as barges } from "./barges.look";
import { look as moses } from "./moses.look";
import { look as horeb } from "./horeb.look";
import { look as verdict } from "./verdict.look";

export const W46_LOOKS = { candle: oliver, lamp: samuel, lab: seed, comic: comic, news: news, sea: barges, summit: moses, storm: horeb, court: verdict } as const;

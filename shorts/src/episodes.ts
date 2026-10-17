/**
 * Register der Episoden. Neue Woche = neues JSON in /content und hier eine Zeile ergänzen.
 * (Statischer Import, weil das Remotion-Bundle im Browser läuft und kein Dateisystem kennt.)
 */
import anpacken from "../content/2026-10-19-anpacken-statt-warten.json";
import verwundet from "../content/2026-10-21-verwundet-nicht-gefallen.json";
import treu from "../content/2026-10-25-treu-zu-allen-zeiten.json";

export const episodes: Array<{ id: string } & Record<string, unknown>> = [anpacken, verwundet, treu];

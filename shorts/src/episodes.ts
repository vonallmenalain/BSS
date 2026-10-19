/**
 * Register der Episoden. Neue Woche = neues JSON in /content und hier eine Zeile ergänzen.
 * (Statischer Import, weil das Remotion-Bundle im Browser läuft und kein Dateisystem kennt.)
 */
import anpackenStattWarten from "../content/2026-10-19-anpacken-statt-warten.json";
import verwundetNichtGefallen from "../content/2026-10-21-verwundet-nicht-gefallen.json";
import treuZuAllenZeiten from "../content/2026-10-25-treu-zu-allen-zeiten.json";
import waehleDeinenHelden from "../content/2026-10-19-waehle-deinen-helden.json";
import nachrichtVonHelaman from "../content/2026-10-20-nachricht-von-helaman.json";
import missionLockvogel from "../content/2026-10-22-mission-lockvogel.json";
import dieStaerksteWaffe from "../content/2026-10-24-die-staerkste-waffe.json";
import vergrabeneSchwerter from "../content/2026-10-19-vergrabene-schwerter.json";
import werWars from "../content/2026-10-20-wer-wars.json";
import faktOderMythos from "../content/2026-10-21-fakt-oder-mythos.json";
import versPuzzle from "../content/2026-10-22-vers-puzzle.json";
import alleVerwundet from "../content/2026-10-23-alle-verwundet.json";
import deinMonat from "../content/2026-10-24-dein-monat.json";
import keineAusreden from "../content/2026-10-25-keine-ausreden.json";
import gruppenchat1820 from "../content/2026-10-26-gruppenchat-1820.json";
import wasIstWahrheit from "../content/2026-10-26-was-ist-wahrheit.json";
import ichNehmeNichtsZurueck from "../content/2026-10-27-ich-nehme-nichts-zurueck.json";
import missionMars from "../content/2026-10-27-mission-mars.json";
import verfluchtesItem from "../content/2026-10-28-verfluchtes-item.json";
import derFallKorihor from "../content/2026-10-29-der-fall-korihor.json";
import fuerEineZeitWieDiese from "../content/2026-10-30-fuer-eine-zeit-wie-diese.json";
import nebelDerFinsternis from "../content/2026-10-31-nebel-der-finsternis.json";
import dreiLuegen from "../content/2026-11-01-drei-luegen.json";
import kettenSprengen from "../content/2026-11-01-ketten-sprengen.json";

export const episodes: Array<{ id: string } & Record<string, unknown>> = [
  anpackenStattWarten,
  verwundetNichtGefallen,
  treuZuAllenZeiten,
  waehleDeinenHelden,
  nachrichtVonHelaman,
  missionLockvogel,
  dieStaerksteWaffe,
  vergrabeneSchwerter,
  werWars,
  faktOderMythos,
  versPuzzle,
  alleVerwundet,
  deinMonat,
  keineAusreden,
  gruppenchat1820,
  wasIstWahrheit,
  ichNehmeNichtsZurueck,
  missionMars,
  verfluchtesItem,
  derFallKorihor,
  fuerEineZeitWieDiese,
  nebelDerFinsternis,
  dreiLuegen,
  kettenSprengen,
];

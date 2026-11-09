import { z } from "zod";
import { sceneBase } from "../../schemaBase";

/**
 * Nachrichtensender: drei Städte, drei Arten, eine Botschaft aufzunehmen (Apostelgeschichte 17).
 * Über allen Etappen derselbe Bildschirm («Live-Schaltung») mit Bauchbinde darunter; die
 * Etappen zeichnen hinein, was gerade berichtet wird. Alles erscheint, wenn die Stimme es sagt.
 */
export const schema = sceneBase.extend({
  type: z.literal("news"),
  /**
   * breaking: «Eilmeldung», zwei Wanderer vor der Stadt · route: Karte mit den drei Städten ·
   * thessalonich: Paulus erklärt in der Synagoge · riot: Menge mit Fackeln, Kommentare ·
   * beroea: Flucht in der Nacht, dann offene Zuhörer · check: Schriftrolle, Tag für Tag geprüft ·
   * athens: Gegner hinterher, Athen und die Trend-Liste · choice: drei Städte, drei Reaktionen
   */
  stage: z.enum(["breaking", "route", "thessalonich", "riot", "beroea", "check", "athens", "choice"]),
  /** Bauchbinde: rotes Etikett links («LIVE · THESSALONICH») */
  tag: z.string().optional(),
  /** Bauchbinde: die Schlagzeile */
  headline: z.string().optional(),
  /** Sprechblase im Bild (thessalonich) – steht gross da und wird darum nicht untertitelt */
  bubble: z.string().optional(),
  /** Nur im Bild, nicht gesprochen: Kommentare (riot) oder Trends (athens) */
  items: z.array(z.string().min(1)).max(6).default([]),
  cues: z.array(z.string().min(1)).max(6).default([]),
});

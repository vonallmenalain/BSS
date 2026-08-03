// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import type { AnnouncementEntry, AnnouncementSeries } from './types.ts'

/**
 * Wann eine wiederkehrende Bekanntmachung fällig ist.
 *
 * Der ganze Umgang mit Serien hängt an einer einzigen Frage: Gilt diese
 * Serie an diesem Sonntag? Sie wird hier beantwortet – ohne Firestore, ohne
 * React und ohne `Date`-Arithmetik, die über Zeitzonen stolpern könnte:
 * Gerechnet wird auf dem Datumstext «yyyy-MM-dd», wie ihn die App überall
 * als Schlüssel eines Sonntags verwendet.
 *
 * «Jeden 3. Sonntag im Monat» heisst dabei: der dritte Sonntag dieses
 * Monats – nicht «21 Tage nach dem ersten». Wer im Kalender nachzählt,
 * zählt genauso, und ein Monat, der mit einem Sonntag beginnt, verschiebt
 * darum nichts.
 */

/** Der wievielte Sonntag seines Monats ist dieser Tag? (1–5) */
export function weekOfMonth(dateKey: string): number {
  const day = Number(dateKey.slice(8, 10))
  return Math.floor((day - 1) / 7) + 1
}

/**
 * Ist es der letzte Sonntag des Monats?
 *
 * Sieben Tage weiter wäre schon der nächste Monat – mehr braucht es nicht,
 * und die Monatslängen bleiben aussen vor.
 */
export function isLastWeekOfMonth(dateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day + 7 > daysInMonth
}

/** Gilt die Serie an diesem Sonntag? */
export function seriesAppliesTo(series: AnnouncementSeries, dateKey: string): boolean {
  if (dateKey < series.startDate) return false
  if (series.endDate && dateKey > series.endDate) return false
  if (series.skipDates?.includes(dateKey)) return false
  if (series.rhythm === 'weekly') return true

  const weeks = series.weeks ?? []
  if (weeks.length === 0) return false
  return weeks.some((week) =>
    week === -1 ? isLastWeekOfMonth(dateKey) : week === weekOfMonth(dateKey),
  )
}

/**
 * Die ID, unter der ein errechneter Eintrag im Programm erscheint.
 *
 * Sie hängt am Sonntag, nicht nur an der Serie: Sonst trüge derselbe
 * Eintrag an zwei Sonntagen dieselbe ID, und React zeigte beim Blättern
 * kurz den falschen Text.
 */
export function seriesEntryId(seriesId: string, dateKey: string): string {
  return `serie:${seriesId}:${dateKey}`
}

/** Gehört dieser Eintrag zu einer Serie und wurde nur errechnet? */
export function isSeriesEntry(entry: AnnouncementEntry): boolean {
  return entry.id.startsWith('serie:')
}

/**
 * Wie eine Serie an einem bestimmten Sonntag klingt.
 *
 * `null` bedeutet: Die Serie ist zwar fällig, ihr Text liess sich aber
 * nicht füllen – beim Putzplan etwa, wenn für diese Woche niemand
 * eingetragen ist. Dann steht am Sonntag lieber nichts als ein Satz mit
 * einer Lücke darin.
 */
export type SeriesTextResolver = (
  series: AnnouncementSeries,
  dateKey: string,
) => { text: string; details: string } | null

/**
 * Die Bekanntmachungen eines Sonntags: erfasste zuerst, Serien danach.
 *
 * Serien stehen hinten, weil sie das Wiederkehrende sind – was diesen
 * Sonntag besonders macht, gehört nach vorn. Wer eine Serie an einem
 * einzelnen Sonntag anders einordnen will, passt sie dort an; sie wird
 * damit zu einem gewöhnlichen Eintrag und lässt sich frei verschieben.
 *
 * Eine Serie, die an diesem Sonntag bereits von Hand angepasst wurde,
 * erscheint **nicht** zusätzlich: Der angepasste Eintrag trägt ihre ID und
 * tritt an ihre Stelle.
 */
export function announcementsFor(
  dateKey: string,
  stored: AnnouncementEntry[],
  series: AnnouncementSeries[],
  resolve: SeriesTextResolver,
): AnnouncementEntry[] {
  const detached = new Set(stored.flatMap((entry) => (entry.seriesId ? [entry.seriesId] : [])))

  const generated = series.flatMap((entry): AnnouncementEntry[] => {
    if (detached.has(entry.id)) return []
    if (!seriesAppliesTo(entry, dateKey)) return []
    const filled = resolve(entry, dateKey)
    if (!filled || !filled.text.trim()) return []
    return [
      {
        id: seriesEntryId(entry.id, dateKey),
        text: filled.text,
        details: filled.details,
        seriesId: entry.id,
      },
    ]
  })

  return [...stored, ...generated]
}

/**
 * Was von einer Serie beim Löschen bleibt.
 *
 * Zwei Wege, und die Wahl gehört der Bischofschaft: Ein einzelner Sonntag
 * fällt aus – dann bleibt die Serie – oder die Serie endet. Vergangene
 * Sonntage werden in keinem Fall angetastet; was einmal von der Kanzel
 * gesagt wurde, lässt sich nicht nachträglich streichen.
 */
export function withoutSunday(
  series: AnnouncementSeries,
  dateKey: string,
): Pick<AnnouncementSeries, 'skipDates'> {
  return { skipDates: [...new Set([...(series.skipDates ?? []), dateKey])] }
}

/**
 * Beendet eine Serie ab einem Sonntag – dieser eingeschlossen.
 *
 * Firestore kennt kein «gilt bis ausschliesslich», deshalb wird der
 * Vortag als Ende festgehalten. Liegt der Sonntag vor dem Beginn, hat die
 * Serie nie gegolten; sie kann dann gelöscht werden statt beendet – das
 * meldet der Rückgabewert.
 */
export function endedBefore(
  series: AnnouncementSeries,
  dateKey: string,
): { endDate: string } | 'delete' {
  if (dateKey <= series.startDate) return 'delete'
  return { endDate: previousDay(dateKey) }
}

/** Der Vortag als «yyyy-MM-dd». */
export function previousDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day - 1))
  return date.toISOString().slice(0, 10)
}

import { useCallback, useMemo } from 'react'
import { useAnnouncementSeries, useCleaningWeeks } from '@/hooks/useFirestore'
import { announcementsFor, seriesAppliesTo, type SeriesTextResolver } from '@/lib/series'
import { cleaningAround, fillCleaningText } from '@/services/importCleaning'
import type { AnnouncementEntry, AnnouncementSeries, CleaningWeek } from '@/lib/types'

/**
 * Die Bekanntmachungen eines Sonntags – erfasste und wiederkehrende.
 *
 * Beide Ansichten brauchen dieselbe Liste: «Bekanntmachungen» zum
 * Bearbeiten und «Leitung» zum Vorlesen. Sie hier zusammenzurechnen hält
 * die beiden Seiten deckungsgleich – am Pult steht sonst etwas anderes als
 * im Formular.
 *
 * Die Serien werden **nicht** in den Sonntag geschrieben. Wer den Wortlaut
 * ändert, ändert ihn damit für jeden künftigen Sonntag; und ein Sonntag,
 * den niemand geöffnet hat, trägt die Bekanntmachung trotzdem.
 *
 * Die Reihenfolge dagegen gehört dem Sonntag: `order` ist sein
 * `announcementOrder` und ordnet beide Arten miteinander – eine Serie lässt
 * sich damit nach vorn holen, ohne sie anzutasten.
 */
export interface SundayAnnouncements {
  /** Erfasste Einträge und fällige Serien in der Folge, in der sie vorgelesen werden */
  entries: AnnouncementEntry[]
  /** Alle Serien, unabhängig vom Sonntag */
  series: AnnouncementSeries[]
  /** Serien, die an diesem Sonntag fällig wären – auch die ohne Text */
  dueSeries: AnnouncementSeries[]
  weeks: CleaningWeek[]
  /** Wortlaut einer Serie an diesem Sonntag – `null`, wenn er sich nicht füllen liess */
  resolve: SeriesTextResolver
}

/** Damit ein weggelassenes Argument nicht bei jedem Rendern eine neue Liste ist. */
const NO_ORDER: string[] = []

export function useSundayAnnouncements(
  dateKey: string,
  stored: AnnouncementEntry[],
  /** Die von Hand gelegte Reihenfolge – leer heisst: erfasste zuerst, Serien danach */
  order: string[] = NO_ORDER,
): SundayAnnouncements {
  const { data: series } = useAnnouncementSeries()
  const { data: weeks } = useCleaningWeeks()

  const resolve = useCallback<SeriesTextResolver>(
    (entry, key) => {
      const details = entry.details ?? ''
      if (entry.source !== 'cleaning') return { text: entry.text, details }

      /*
       * Der Sonntag liegt zwischen zwei Putzwochen: Die eine ist am Vortag
       * zu Ende gegangen, die andere beginnt am Montag. Fehlt eine davon –
       * am Anfang des Plans, am Ende, oder weil der Plan eine Lücke hat –,
       * bleibt die Bekanntmachung weg. Ein Dank an niemanden wäre schlimmer
       * als gar keiner.
       */
      const { previous, next } = cleaningAround(weeks, key)
      const facts = {
        previousGroup: previous?.group ?? '',
        previousTeam: previous?.team ?? '',
        nextGroup: next?.group ?? '',
        nextTeam: next?.team ?? '',
      }

      const text = fillCleaningText(entry.text, facts)
      if (text === null) return null
      return { text, details: fillCleaningText(details, facts) ?? '' }
    },
    [weeks],
  )

  const entries = useMemo(
    () => announcementsFor(dateKey, stored, series, resolve, order),
    [dateKey, stored, series, resolve, order],
  )

  const dueSeries = useMemo(
    () => series.filter((entry) => seriesAppliesTo(entry, dateKey)),
    [series, dateKey],
  )

  return { entries, series, dueSeries, weeks, resolve }
}

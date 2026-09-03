import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMeetings } from '@/hooks/useFirestore'
import { completeStandingRound } from '@/services/agenda'
import { toDate } from '@/lib/dates'
import { dayKey, formatDayKey, isStanding, type StandingMeeting } from '@/lib/standing'
import type { AgendaItem } from '@/lib/types'

/**
 * «Erledigt» an einer ständigen Pendenz.
 *
 * Vier Stellen haken einen Eintrag ab – die Zeile in der Liste, die Karte auf
 * der Übersicht, das Fenster über der Sitzungsliste und der Sitzungsmodus –,
 * und alle vier müssen dasselbe tun: Eine ständige Pendenz wird nicht
 * abgeschlossen, sondern auf ihre nächste Runde gesetzt. Damit das nicht
 * viermal dasteht (und dreimal veraltet), steht es hier.
 *
 * Der Hook liefert eine Funktion, die `true` zurückgibt, wenn sie
 * zuständig war – dann ist der Griff erledigt. Bei `false` war es eine
 * gewöhnliche Pendenz, und der Aufrufer macht weiter wie bisher.
 *
 * Die Sitzungen kommen aus dem gemeinsamen Bestand und kosten nichts
 * Zusätzliches (siehe `lib/collectionStore`). Gebraucht werden sie für die
 * Frage, wohin die Pendenz wandert: in die nächste geplante Sitzung oder in
 * die erste, die nach dem eingestellten Zeitraum liegt.
 */
export function useStandingRound(): (item: AgendaItem) => Promise<boolean> {
  const { profile } = useAuth()
  const toast = useToast()
  // Weit genug voraus für jeden Takt, den jemand einstellen kann – und weit
  // genug zurück, damit eine Pendenz aus einer alten Sitzung ihre Stelle in
  // der Reihe wiederfindet.
  const { data: meetings } = useMeetings(200)

  const open = useMemo<StandingMeeting[]>(
    () =>
      meetings
        .filter((meeting) => meeting.status !== 'closed')
        .map((meeting) => ({ id: meeting.id, date: toDate(meeting.date) }))
        .filter((entry): entry is { id: string; date: Date } => entry.date !== null)
        .map((entry) => ({ id: entry.id, date: dayKey(entry.date) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [meetings],
  )

  return useCallback(
    async (item: AgendaItem) => {
      if (!profile || !isStanding(item)) return false
      try {
        const { round } = await completeStandingRound(item, open, {
          id: profile.id,
          name: profile.displayName,
        })
        /*
         * Gemeldet wird, wann es weitergeht – und nicht, dass etwas erledigt
         * sei. Der Punkt verschwindet ja nicht: Er steht gleich darauf in
         * einer anderen Sitzung, und ohne diesen Satz sähe es aus, als hätte
         * der Griff nichts bewirkt.
         */
        const next = round.meetingId
          ? open.find((meeting) => meeting.id === round.meetingId)
          : undefined
        toast.success(
          next
            ? `Erledigt – wieder in der Sitzung vom ${formatDayKey(next.date)}.`
            : round.dueFrom
              ? `Erledigt – wieder fällig ab ${formatDayKey(round.dueFrom)}.`
              : 'Erledigt – steht in der nächsten Sitzung wieder da.',
        )
      } catch (error) {
        console.error(error)
        toast.error('Status konnte nicht geändert werden.')
      }
      return true
    },
    [profile, open, toast],
  )
}

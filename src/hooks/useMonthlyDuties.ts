import { useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useDutyItems, useMonthLeaders, useMonthlyDuties } from '@/hooks/useFirestore'
import { useNow } from '@/hooks/useNow'
import { monthKey, pendingDutyActions } from '@/lib/monthlyDuties'
import { applyDutyActions } from '@/services/monthlyDuties'

/**
 * Wie oft nachgesehen wird, ob der Monat gewechselt hat.
 *
 * Halbstündlich genügt: Die App wird ohnehin mehrmals täglich neu geöffnet,
 * und wer sie über Mitternacht des Ersten offen liegen lässt, hat es nicht
 * eilig. Minütlich zu rechnen hiesse, den ganzen Rahmen der App sechzigmal
 * pro Stunde neu zu zeichnen, um in aller Regel dieselben sieben Zeichen zu
 * erhalten.
 */
const CHECK_EVERY_MS = 30 * 60_000

/** Der laufende Monat – «2026-08». */
export function useCurrentMonth(): string {
  const now = useNow(CHECK_EVERY_MS)
  return useMemo(() => monthKey(new Date(now)), [now])
}

/**
 * Legt die Pendenzen des laufenden Monats an – einmal beim Start der App.
 *
 * Die Aufgaben der Monatsverantwortung stehen als Vorlage da; hier entsteht
 * daraus, was in diesem Monat wirklich zu tun ist: je Vorlage eine Pendenz,
 * zugewiesen an den, der den Monat führt. Wechselt die Leitung mitten im
 * Monat, wandert die Pendenz mit (siehe `lib/monthlyDuties`).
 *
 * **Der Client tut das und kein Server.** Diese App hat keinen – es gibt
 * nichts, was nachts um vier laufen könnte. Also tut es, wer als Erster
 * hinsieht. Das ist unbedenklich, weil die ID der Pendenz aus Vorlage und
 * Monat gerechnet wird und angelegt wird, was auf dem Server fehlt: Öffnen
 * drei Personen gleichzeitig die App, entsteht trotzdem genau eine Pendenz
 * (siehe `services/monthlyDuties`).
 *
 * Gewartet wird, bis der Bestand geladen ist. Sonst sähe der erste Durchgang
 * eine leere Liste und fragte den Server nach lauter Einträgen, die längst
 * dastehen.
 */
export function useEnsureMonthlyDuties(): void {
  const { isApproved, profile } = useAuth()
  const { userName } = useData()
  const month = useCurrentMonth()

  const { data: duties, loading: dutiesLoading } = useMonthlyDuties()
  const { data: items, loading: itemsLoading } = useDutyItems()
  const { leaders, loading: sundaysLoading } = useMonthLeaders()

  const actions = useMemo(
    () =>
      isApproved && !dutiesLoading && !itemsLoading && !sundaysLoading
        ? pendingDutyActions(duties, items, leaders, month)
        : [],
    [isApproved, dutiesLoading, itemsLoading, sundaysLoading, duties, items, leaders, month],
  )

  /*
   * Ein Durchgang nach dem anderen.
   *
   * Das Anlegen schreibt in denselben Bestand, aus dem gelesen wird – die
   * Liste der offenen Punkte ändert sich also, während gearbeitet wird, und
   * der Effekt läuft erneut. Ohne diese Sperre schickte er dieselben
   * Transaktionen ein zweites Mal los, bevor die ersten durch sind.
   */
  const running = useRef(false)

  useEffect(() => {
    if (actions.length === 0 || running.current || !profile) return
    running.current = true

    // Wer die Aufgabe eingerichtet hat, steht später unter «Erfasst» – nicht,
    // wer heute zufällig als Erster die App geöffnet hat. Ist das Konto
    // inzwischen weg, tritt die angemeldete Person an seine Stelle.
    const author = (userId: string | null | undefined) => {
      if (!userId) return { id: profile.id, name: profile.displayName }
      const name = userName(userId)
      return name === 'Unbekannt'
        ? { id: profile.id, name: profile.displayName }
        : { id: userId, name }
    }

    void applyDutyActions(actions, author)
      .catch((error: unknown) => {
        // Kein Toast: Das läuft im Hintergrund, ohne dass jemand danach
        // gefragt hat. Beim nächsten Start wird es nachgeholt.
        console.error('[monatspendenzen]', error)
      })
      .finally(() => {
        running.current = false
      })
  }, [actions, profile, userName])
}

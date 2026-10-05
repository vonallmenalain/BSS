import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useImpulseAuth, useImpulseNow, useImpulseWrites } from '@/hooks/useImpulseRuntime'
import { impulseWeekToday, weekDays } from '@/lib/impulse'

/*
 * Die beiden Aufgaben neben dem Feed – das Wochenziel mit seinem einen
 * Haken, die Tages-Challenge mit ihren sieben.
 *
 * Abgehakt wird an zwei Orten: gleich in der Mission der Woche auf der
 * Übersicht und im Vollbild-Raum der Aufgabe. Beide teilen sich hier
 * dieselbe Logik – speichern, rückmelden, das kleine Fest beim Haken –,
 * damit sich der Haken an beiden Orten gleich anfühlt.
 *
 * Abgehakt wird per Selbstauskunft: Die Aufgaben fragen nicht nach, sie
 * glauben es. Mit `preview` lebt der Haken nur im Fenster (die Vorschau
 * einer einzelnen Karte in der Redaktion), gespeichert wird nichts.
 */

/** Die Tage der Tages-Challenge, Montag bis Sonntag. */
export const CHALLENGE_DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

/** Das Wochenziel abhaken – oder den Haken zurücknehmen. */
export function useWeekGoal(week: string, done: boolean, preview = false) {
  const { profile } = useImpulseAuth()
  const { setImpulseWeekGoal } = useImpulseWrites()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [previewDone, setPreviewDone] = useState(false)
  /*
   * Ob der Haken **in dieser Sitzung** gesetzt wurde – nur dann springt
   * er herein. Ein schon erledigtes Ziel steht beim Öffnen einfach da:
   * Bewegung zeigt den Wechsel, nicht den Bestand.
   */
  const [celebrate, setCelebrate] = useState(false)

  const isDone = preview ? previewDone : done

  const toggle = async () => {
    setCelebrate(!isDone)
    if (preview) {
      setPreviewDone((value) => !value)
      return
    }
    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await setImpulseWeekGoal(
        { uid: profile.id, displayName: profile.displayName },
        week,
        !done,
      )
      toast.saved(!done ? 'Wochenziel geschafft – stark!' : 'Haken zurückgenommen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return { isDone, busy, celebrate, toggle }
}

/** Die Tage der Tages-Challenge abhaken – oder einen Haken zurücknehmen. */
export function useChallengeDays(week: string, days: readonly string[], preview = false) {
  const { profile } = useImpulseAuth()
  const { setImpulseChallengeDay } = useImpulseWrites()
  const toast = useToast()
  const now = useImpulseNow()
  /* Gesperrt wird je Tag, nicht die ganze Reihe: Wer schnell hintereinander
     mehrere Tage antippt, soll keinen Tipp verlieren, solange der erste
     noch gespeichert wird. */
  const [busyDays, setBusyDays] = useState<ReadonlySet<string>>(new Set())
  const [previewDays, setPreviewDays] = useState<Set<string>>(new Set())
  /* Wie beim Wochenziel: Nur der eben gesetzte Haken springt – die
     schon abgehakten Tage stehen beim Öffnen still da. */
  const [celebrateDay, setCelebrateDay] = useState<string | null>(null)

  const allDays = weekDays(week)
  // Bei einer früher freigeschalteten Woche gilt bis Montag der Montag als heute.
  const today = impulseWeekToday(week, now)
  const checked: ReadonlySet<string> = preview ? previewDays : new Set(days)
  const doneCount = allDays.filter((day) => checked.has(day)).length
  /* Künftige Tage warten – abgehakt wird, was war, nicht was sein soll. */
  const isFuture = (day: string) => !preview && day > today

  const toggle = async (day: string) => {
    setCelebrateDay(checked.has(day) ? null : day)
    if (preview) {
      setPreviewDays((value) => {
        const next = new Set(value)
        if (next.has(day)) next.delete(day)
        else next.add(day)
        return next
      })
      return
    }
    if (!profile || busyDays.has(day)) return
    setBusyDays((current) => new Set(current).add(day))
    try {
      const outcome = await setImpulseChallengeDay(
        { uid: profile.id, displayName: profile.displayName },
        week,
        day,
        !checked.has(day),
      )
      toast.saved(!checked.has(day) ? 'Tag abgehakt.' : 'Haken zurückgenommen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    } finally {
      setBusyDays((current) => {
        const next = new Set(current)
        next.delete(day)
        return next
      })
    }
  }

  return { allDays, today, checked, doneCount, busyDays, celebrateDay, isFuture, toggle }
}

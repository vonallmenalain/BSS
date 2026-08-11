import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, type SaveOutcome } from '@/lib/sync'
import { endedBefore, withoutSunday } from '@/lib/series'
import type { AnnouncementSeries, SeriesRhythm, SeriesSource } from '@/lib/types'

/*
 * Wiederkehrende Bekanntmachungen.
 *
 * Sie liegen in einer eigenen Sammlung und nicht im Sonntagsprogramm: Eine
 * Serie gilt für viele Sonntage zugleich, auch für solche, die niemand je
 * geöffnet hat. Stünde sie in den einzelnen Programmen, müsste sie beim
 * Anlegen in die Zukunft hineingeschrieben werden – und beim Ändern des
 * Wortlauts überall zugleich nachgeführt.
 */

const seriesRef = collection(db, COLLECTIONS.announcementSeries)

export interface SeriesInput {
  text: string
  details: string
  rhythm: SeriesRhythm
  weeks: number[]
  startDate: string
  endDate: string | null
  source: SeriesSource
}

export function createSeries(input: SeriesInput, authorId: string | null): Promise<SaveOutcome> {
  return commit(
    setDoc(doc(seriesRef), {
      text: input.text.trim(),
      details: input.details.trim(),
      rhythm: input.rhythm,
      weeks: input.rhythm === 'monthly' ? input.weeks : [],
      startDate: input.startDate,
      endDate: input.endDate,
      skipDates: [],
      source: input.source,
      createdById: authorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

export function updateSeries(id: string, input: SeriesInput): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.announcementSeries, id), {
      text: input.text.trim(),
      details: input.details.trim(),
      rhythm: input.rhythm,
      weeks: input.rhythm === 'monthly' ? input.weeks : [],
      startDate: input.startDate,
      endDate: input.endDate,
      source: input.source,
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Die ganze Serie entfernen – auch aus vergangenen Sonntagen. */
export async function deleteSeries(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.announcementSeries, id)))
  forgetDoc(COLLECTIONS.announcementSeries, id)
  return outcome
}

/** Nur diesen einen Sonntag streichen; die Serie läuft weiter. */
export function skipSunday(series: AnnouncementSeries, dateKey: string): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.announcementSeries, series.id), {
      ...withoutSunday(series, dateKey),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Diesen Sonntag und alle künftigen streichen.
 *
 * Vergangene Sonntage behalten die Bekanntmachung: Dort ist sie gesagt
 * worden, und ein Programm von damals soll lesbar bleiben, wie es war.
 */
export function endSeries(series: AnnouncementSeries, dateKey: string): Promise<SaveOutcome> {
  const result = endedBefore(series, dateKey)
  if (result === 'delete') return deleteSeries(series.id)
  return commit(
    updateDoc(doc(db, COLLECTIONS.announcementSeries, series.id), {
      ...result,
      updatedAt: serverTimestamp(),
    }),
  )
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc, resyncCollections } from '@/lib/collectionStore'
import { commit, requireOnline, type SaveOutcome } from '@/lib/sync'
import type { ParsedApActivity, ParsedApMonth } from '@/services/importApActivities'
import type { ApActivity, ApActivityKind } from '@/lib/types'

/*
 * Der Aktivitätenplan der AP in Firestore.
 *
 * Zwei Sammlungen: die Termine und – getrennt davon – das führende
 * Kollegium je Monat. Getrennt, weil die Monatsangabe keinem einzelnen
 * Termin gehört: Wer den letzten Mittwoch im März löscht, soll nicht die
 * Überschrift «März – Leitung Diakone» mitlöschen.
 *
 * Die Termine tragen eine eigene ID und nicht das Datum: An einem Sonntag
 * können Klasse und Anlass zusammenfallen, und im Plan der Gemeinde tun
 * sie das auch (22. März: Klasse und Jugendrat). Das Datum ist deshalb ein
 * Feld, kein Schlüssel.
 */

export interface ApActivityInput {
  date: string
  endDate: string | null
  /** Beginn, «19:30» */
  time: string
  /** Ende, «21:00» – leer, solange niemand es einträgt */
  endTime: string
  kind: ApActivityKind
  title: string
  location: string
  leader: string
  bishopric: string
  advisor: string
  note: string
}

/** Leeres Formular – zugleich die Vorlage für neue Einträge. */
export const EMPTY_AP_ACTIVITY: ApActivityInput = {
  date: '',
  endDate: null,
  time: '',
  endTime: '',
  kind: 'activity',
  title: '',
  location: '',
  leader: '',
  bishopric: '',
  advisor: '',
  note: '',
}

/** Anlegen oder ändern. Ohne `id` entsteht ein neuer Eintrag. */
export async function saveApActivity(
  id: string | null,
  input: ApActivityInput,
  userId?: string | null,
): Promise<SaveOutcome> {
  const data = {
    ...input,
    endDate: input.endDate || null,
    updatedAt: serverTimestamp(),
    updatedById: userId ?? null,
  }

  if (id) return commit(updateDoc(doc(db, COLLECTIONS.apActivities, id), data))

  return commit(
    addDoc(collection(db, COLLECTIONS.apActivities), {
      ...data,
      createdAt: serverTimestamp(),
      createdById: userId ?? null,
    }),
  )
}

export async function deleteApActivity(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.apActivities, id)))
  forgetDoc(COLLECTIONS.apActivities, id)
  return outcome
}

/** Das führende Kollegium eines Monats – «2026-03», «Leitung Diakone». */
export async function saveApMonth(month: string, leadership: string): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.apMonths, month),
      { month, leadership: leadership.trim(), updatedAt: serverTimestamp() },
      { merge: true },
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Mehrere auf einmal                                                  */
/* ------------------------------------------------------------------ */

const CHUNK_SIZE = 400

/** Legt eine Reihe von Terminen an – für das erzeugte Grundgerüst. */
export async function createApActivities(
  entries: Pick<ApActivityInput, 'date' | 'kind' | 'title' | 'time' | 'endTime'>[],
  userId?: string | null,
): Promise<number> {
  requireOnline()

  for (let offset = 0; offset < entries.length; offset += CHUNK_SIZE) {
    const batch = writeBatch(db)
    for (const entry of entries.slice(offset, offset + CHUNK_SIZE)) {
      batch.set(doc(collection(db, COLLECTIONS.apActivities)), {
        ...EMPTY_AP_ACTIVITY,
        ...entry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdById: userId ?? null,
        updatedById: userId ?? null,
      })
    }
    await batch.commit()
  }

  return entries.length
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export interface ApImportResult {
  written: number
  removed: number
  months: number
}

/**
 * Schreibt einen eingelesenen Plan.
 *
 * `replace` räumt vorher alles weg, was im Zeitraum der Datei schon im
 * Plan steht. Das ist der Normalfall beim einmaligen Übernehmen der
 * Excel-Tabelle: Sie **ist** der Plan, und ein zweiter Anlauf nach einer
 * Korrektur soll nicht jeden Termin doppelt hinterlassen. Ohne die Option
 * kommt die Datei zum Bestehenden dazu – für den Fall, dass jemand nur
 * einen Nachtrag einliest.
 */
export async function importApPlan(
  activities: ParsedApActivity[],
  months: ParsedApMonth[],
  replace: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<ApImportResult> {
  requireOnline()

  let removed = 0

  if (replace && activities.length > 0) {
    const dates = activities.map((activity) => activity.date)
    const first = dates.reduce((min, date) => (date < min ? date : min), dates[0])
    const last = activities.reduce((max, activity) => {
      const end = activity.endDate ?? activity.date
      return end > max ? end : max
    }, activities[0].endDate ?? activities[0].date)

    const existing = await getDocs(
      query(
        collection(db, COLLECTIONS.apActivities),
        where('date', '>=', first),
        where('date', '<=', last),
      ),
    )

    for (let offset = 0; offset < existing.docs.length; offset += CHUNK_SIZE) {
      const batch = writeBatch(db)
      for (const found of existing.docs.slice(offset, offset + CHUNK_SIZE)) batch.delete(found.ref)
      await batch.commit()
    }
    removed = existing.docs.length
  }

  for (let offset = 0; offset < activities.length; offset += CHUNK_SIZE) {
    const chunk = activities.slice(offset, offset + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const activity of chunk) {
      batch.set(doc(collection(db, COLLECTIONS.apActivities)), {
        date: activity.date,
        endDate: activity.endDate,
        time: '',
        endTime: '',
        kind: activity.kind,
        title: activity.title,
        location: activity.location,
        leader: activity.leader,
        bishopric: activity.bishopric,
        advisor: activity.advisor,
        note: activity.note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, activities.length), activities.length)
  }

  if (months.length > 0) {
    const batch = writeBatch(db)
    for (const month of months) {
      batch.set(
        doc(db, COLLECTIONS.apMonths, month.month),
        { month: month.month, leadership: month.leadership, updatedAt: serverTimestamp() },
        { merge: true },
      )
    }
    await batch.commit()
  }

  // Gelöschtes sieht der schrittweise Abgleich nicht – siehe `resyncCollections`.
  if (removed > 0) resyncCollections([COLLECTIONS.apActivities])

  return { written: activities.length, removed, months: months.length }
}

/* ------------------------------------------------------------------ */
/* Auswerten                                                           */
/* ------------------------------------------------------------------ */

/** Ein Eintrag gilt bis zum Ende seines letzten Tages als «kommend». */
export function apActivityEnd(activity: Pick<ApActivity, 'date' | 'endDate'>): string {
  return activity.endDate || activity.date
}

/**
 * Die nächsten Termine, ausgefallene ausgenommen.
 *
 * Ein abgesagter Mittwoch gehört in den Plan, aber nicht in die Antwort auf
 * «was kommt als Nächstes» – sonst stünde dort «keine Aktivität».
 */
export function upcomingApActivities(activities: ApActivity[], todayKey: string): ApActivity[] {
  return activities
    .filter((activity) => apActivityEnd(activity) >= todayKey && activity.kind !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Alle Termine eines Monats – «2026-03». */
export function apActivitiesOfMonth(activities: ApActivity[], month: string): ApActivity[] {
  return activities.filter((activity) => activity.date.startsWith(month))
}

/**
 * Vorschläge für ein Feld, aus dem, was schon im Plan steht.
 *
 * Leitung, Treffpunkt und die Teilnehmenden sind Freitext – dieselben
 * fünf Namen, den ganzen Plan hindurch. Eine Vorschlagsliste erspart das
 * Tippen und hält die Schreibweise einheitlich.
 */
export function apSuggestions(
  activities: ApActivity[],
  field: 'location' | 'leader' | 'bishopric' | 'advisor',
): string[] {
  const counts = new Map<string, number>()
  for (const activity of activities) {
    const value = (activity[field] ?? '').trim()
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value)
}

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
import { apClassHours, type ApActivity, type ApActivityKind } from '@/lib/types'
import type { ParsedApActivity, ParsedApMonth } from '@/services/importApActivities'

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
/* Themen der AP-Klasse                                                */
/* ------------------------------------------------------------------ */

/** Eine Klasse, wie der Themen-Import sie schreiben will. */
export interface ApTopicWrite {
  /** «2026-09-06» */
  date: string
  /** Das Thema – leer bleibt «Thema noch offen» */
  title: string
  /** Die bestehende Klasse an diesem Sonntag, sonst `null` */
  id: string | null
}

export interface ApTopicImportResult {
  created: number
  updated: number
}

/**
 * Die Themen eines Monats in den Plan schreiben.
 *
 * Zwei Fälle, und der zweite ist beim Umstieg der übliche: Steht der
 * Sonntag schon als Klasse im Plan, bekommt er sein Thema – geändert wird
 * nur der Titel, denn eine verschobene Zeit oder ein erfasster Treffpunkt
 * gehören dem Termin und nicht dem Heft. Steht er noch nicht da, legt der
 * Import ihn an, samt der Stunde, die an diesem Tag üblich ist.
 *
 * Ein Sonntag ohne vorgegebenes Thema wird trotzdem angelegt: Die Klasse
 * findet statt, nur das Thema fehlt noch – und genau das sagt «Thema noch
 * offen» im Plan. Ein bestehender Titel wird davon nicht überschrieben; wer
 * von Hand etwas eingetragen hat, behält es.
 */
export async function importApTopics(
  rows: ApTopicWrite[],
  userId?: string | null,
): Promise<ApTopicImportResult> {
  requireOnline()

  let created = 0
  let updated = 0

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const batch = writeBatch(db)

    for (const row of rows.slice(offset, offset + CHUNK_SIZE)) {
      if (row.id) {
        if (!row.title) continue
        batch.update(doc(db, COLLECTIONS.apActivities, row.id), {
          title: row.title,
          updatedAt: serverTimestamp(),
          updatedById: userId ?? null,
        })
        updated++
      } else {
        const hours = apClassHours(row.date)
        batch.set(doc(collection(db, COLLECTIONS.apActivities)), {
          ...EMPTY_AP_ACTIVITY,
          date: row.date,
          kind: 'class',
          title: row.title,
          time: hours.start,
          endTime: hours.end,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdById: userId ?? null,
          updatedById: userId ?? null,
        })
        created++
      }
    }

    await batch.commit()
  }

  return { created, updated }
}

/* ------------------------------------------------------------------ */
/* Auswerten                                                           */
/* ------------------------------------------------------------------ */

/*
 * Ob ein Termin kommt, läuft oder vorbei ist, steht in `lib/types`
 * (`apActivityPhase`): Es hängt an der Uhrzeit und nicht bloss am Tag, und
 * die Uhrzeiten eines Termins werden ohnehin dort ausgewertet.
 */

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

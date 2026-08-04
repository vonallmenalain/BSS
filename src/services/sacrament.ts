import { deleteField, doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { toDate, toDateInput } from '@/lib/dates'
import { stripUndefined, uid } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import { planProgramOrder } from '@/lib/program'
import { updateTalk } from '@/services/talks'
import {
  HYMN_SLOTS,
  type AnnouncementEntry,
  type BusinessEntry,
  type MusicalNumber,
  type SacramentKind,
  type SacramentMeeting,
  type Talk,
} from '@/lib/types'

/*
 * Das Ordnen des Programmteils liegt firestore-frei in `lib/program`, die
 * Frage «was findet an diesem Sonntag statt?» in `lib/sunday` – von hier
 * mitverteilt, damit die Oberfläche nur einen Ort kennen muss.
 */
export {
  buildProgram,
  nextTalkSlot,
  openSlotKey,
  planProgramOrder,
  programKey,
  type ProgramEntry,
  type ProgramEntryKind,
} from '@/lib/program'

export {
  automaticSacramentKind,
  openTalkSlots,
  plannedTalksFor,
  sundayProgram,
  type SundayProgram,
} from '@/lib/sunday'

/* ------------------------------------------------------------------ */
/* Dokumente pro Sonntag                                               */
/* ------------------------------------------------------------------ */

/**
 * Die Dokument-ID ist das Datum («2026-08-09»).
 *
 * Damit gibt es pro Sonntag garantiert genau ein Programm – egal, aus
 * welchem Bereich heraus gespeichert wird. Ohne diesen festen Schlüssel
 * würden Musik und Gebet leicht zwei konkurrierende Dokumente anlegen.
 */
export function sacramentDocId(date: Date | string): string {
  return typeof date === 'string' ? date : toDateInput(date)
}

/** Der leere Zustand – so sieht ein Sonntag aus, für den noch nichts erfasst ist. */
export function emptySacramentMeeting(date: Date): SacramentMeeting {
  return {
    id: sacramentDocId(date),
    date: Timestamp.fromDate(date),
    // `null` heisst «automatisch»: Was an diesem Sonntag stattfindet,
    // ergibt sich aus dem Kalender, solange es niemand festgelegt hat.
    kind: null,
    meets: null,
    plansTalks: null,
    presidingId: null,
    conductingId: null,
    presidingName: null,
    conductingName: null,
    visitors: '',
    talkSlots: null,
    hymns: {},
    musicalNumbers: [],
    announcements: [],
    business: [],
    programOrder: [],
    notes: '',
  }
}

/**
 * Schreibt Teile des Programms.
 *
 * `setDoc(..., { merge: true })` statt `updateDoc`, weil das Dokument beim
 * ersten Eintrag eines Sonntags noch gar nicht existiert. Das Datum wird
 * immer mitgeschrieben – es ist zwar in der ID enthalten, wird aber für
 * Sortierung und Abfragen als Zeitstempel gebraucht.
 */
export async function saveSacramentMeeting(
  date: Date,
  patch: Partial<Omit<SacramentMeeting, 'id' | 'date'>>,
): Promise<SaveOutcome> {
  const data = stripUndefined(patch as Record<string, unknown>)

  /*
   * `merge: true` führt auch verschachtelte Objekte zusammen. Ein entferntes
   * Zwischenlied bliebe deshalb stehen: Es fehlt zwar im neuen Objekt, wird
   * aber nicht überschrieben. Jeder Liedplatz wird darum ausdrücklich gesetzt
   * oder gelöscht.
   */
  if (patch.hymns) {
    data.hymns = Object.fromEntries(
      HYMN_SLOTS.map((slot) => [slot, patch.hymns?.[slot] ?? deleteField()]),
    )
  }

  return commit(
    setDoc(
      doc(db, COLLECTIONS.sacramentMeetings, sacramentDocId(date)),
      {
        ...data,
        date: Timestamp.fromDate(date),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Listen (Bekanntmachungen, Angelegenheiten, Musikeinlagen)           */
/* ------------------------------------------------------------------ */

export function newAnnouncement(text = ''): AnnouncementEntry {
  return { id: uid(), text, details: '' }
}

export function newBusinessEntry(partial: Partial<BusinessEntry> = {}): BusinessEntry {
  return {
    id: uid(),
    type: partial.type ?? 'sustaining',
    text: partial.text ?? '',
    memberIds: partial.memberIds ?? [],
    callingId: partial.callingId ?? null,
  }
}

export function newMusicalNumber(partial: Partial<MusicalNumber> = {}): MusicalNumber {
  return {
    id: uid(),
    title: partial.title ?? '',
    memberIds: partial.memberIds ?? [],
    performers: partial.performers ?? '',
    notes: partial.notes ?? '',
  }
}

/** Ein Element in einer Liste ersetzen – ohne die übrigen anzufassen. */
export function replaceInList<T extends { id: string }>(list: T[], next: T): T[] {
  return list.map((entry) => (entry.id === next.id ? next : entry))
}

/** Ein Element um eine Position nach oben oder unten schieben. */
export function moveInList<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || target < 0 || target >= list.length) return list
  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry)
  return next
}

/* ------------------------------------------------------------------ */
/* Programmteil «Botschaften und Musik»                                */
/* ------------------------------------------------------------------ */

/** Ansprachen und Zeugnisse eines Sonntags, ohne abgesagte, nach Position sortiert. */
export function talksForDate(talks: Talk[], date: Date): Talk[] {
  const key = toDateInput(date)
  return talks
    .filter((talk) => toDateInput(toDate(talk.date)) === key)
    .filter((talk) => talk.status !== 'cancelled' && talk.status !== 'declined')
    .sort((a, b) => a.slot - b.slot)
}

/**
 * Hält eine neue Reihenfolge fest – an beiden Orten zugleich.
 *
 * Die Reihenfolge steht zweimal: im Ablauf als `programOrder` und bei den
 * Ansprachen als Position (`slot`). Beide werden hier zusammen nachgeführt,
 * sonst zeigte «Ansprachen» eine andere Folge als «Leitung». Offene
 * Programmplätze zählen als Position mit und bleiben – auf ihre neue Nummer
 * umgeschrieben – im Schlüsselband stehen; sonst wäre nicht festgehalten, ob
 * ein Zwischenlied vor oder nach einem noch offenen Platz steht.
 */
export async function saveProgramOrder(
  date: Date,
  keys: string[],
  talks: Talk[],
): Promise<SaveOutcome> {
  const { order, slots } = planProgramOrder(keys, talks)
  await Promise.all(slots.map((entry) => updateTalk(entry.id, { slot: entry.slot })))
  return saveSacramentMeeting(date, { programOrder: order })
}

/**
 * Das Programm eines Sonntags festlegen – oder wieder der Regel überlassen.
 *
 * Beide Seiten schreiben hierher, «Leitung» wie «Ansprachen»: Es ist
 * dasselbe Dokument, und ein an einem Ort festgelegter Sonntag ist am
 * anderen sofort derselbe. `kind: null` heisst «automatisch», die beiden
 * Haken stehen auf `null`, solange sie der Art folgen.
 */
export async function saveSundayProgram(
  date: Date,
  program: { kind: SacramentKind | null; meets: boolean | null; plansTalks: boolean | null },
): Promise<SaveOutcome> {
  return saveSacramentMeeting(date, {
    kind: program.kind,
    meets: program.meets,
    plansTalks: program.plansTalks,
  })
}

/**
 * Einen weiteren Programmplatz für Ansprachen vorsehen.
 *
 * Gezählt wird ab dem höchsten belegten Platz: Sonst käme bei drei bereits
 * vergebenen Ansprachen und zwei vorgesehenen Plätzen kein freier Platz dazu.
 */
export async function addTalkSlot(
  date: Date,
  talks: Talk[],
  planned: number,
): Promise<SaveOutcome> {
  const highest = talks.reduce((max, talk) => Math.max(max, talk.slot), planned)
  return saveSacramentMeeting(date, { talkSlots: highest + 1 })
}

/** Einen offenen Programmplatz streichen – die dahinterliegenden rücken auf. */
export async function removeTalkSlot(
  date: Date,
  slot: number,
  talks: Talk[],
  planned: number,
  defaultCount: number,
): Promise<SaveOutcome> {
  await Promise.all(
    talks
      .filter((talk) => talk.slot > slot)
      .map((talk) => updateTalk(talk.id, { slot: talk.slot - 1 })),
  )
  const next = Math.max(0, planned - 1)
  return saveSacramentMeeting(date, { talkSlots: next === defaultCount ? null : next })
}

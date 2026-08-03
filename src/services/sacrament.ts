import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { toDate, toDateInput } from '@/lib/dates'
import { stripUndefined, uid } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import {
  ACTIVE_TALK_STATUSES,
  HYMN_SLOT_LABELS,
  TALK_KIND_LABELS,
  type AnnouncementEntry,
  type BusinessEntry,
  type HymnChoice,
  type HymnSlot,
  type MusicalNumber,
  type SacramentMeeting,
  type Talk,
  type TalkKind,
} from '@/lib/types'

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
    kind: 'regular',
    presidingId: null,
    conductingId: null,
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
  return commit(
    setDoc(
      doc(db, COLLECTIONS.sacramentMeetings, sacramentDocId(date)),
      {
        ...stripUndefined(patch as Record<string, unknown>),
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

export type ProgramEntryKind = 'talk' | 'testimony' | 'hymn' | 'music'

export interface ProgramEntry {
  /** Stabiler Schlüssel, z. B. «talk:abc123» oder «hymn:intermediate» */
  key: string
  kind: ProgramEntryKind
  /** Art des Punktes: «Ansprache», «Zeugnis», «Zwischenlied», «Musikeinlage» */
  label: string
  /** Wer bzw. was – Name der Person oder Titel des Liedes */
  title: string
  detail?: string
  /** Noch unvollständig (z. B. Lied ohne Nummer) – im Ablauf sichtbar machen */
  incomplete?: boolean
}

export function programKey(kind: 'talk' | 'music' | 'hymn', id: string): string {
  return `${kind}:${id}`
}

/** Ansprachen und Zeugnisse eines Sonntags, ohne abgesagte, nach Position sortiert. */
export function talksForDate(talks: Talk[], date: Date): Talk[] {
  const key = toDateInput(date)
  return talks
    .filter((talk) => toDateInput(toDate(talk.date)) === key)
    .filter((talk) => talk.status !== 'cancelled' && talk.status !== 'declined')
    .sort((a, b) => a.slot - b.slot)
}

/**
 * Setzt den Teil «Botschaften und Musik» zusammen.
 *
 * Die Werte kommen aus den Fachbereichen: Ansprachen aus `talks`, Lieder und
 * Musikeinlagen aus dem Programm. Eine unter «Leitung» festgelegte
 * Reihenfolge hat Vorrang; alles, was danach neu dazukommt, hängt sich hinten
 * an und kann von dort verschoben werden.
 */
export function buildProgram(
  meeting: SacramentMeeting | null,
  talks: Talk[],
  hymnTitle: (choice: HymnChoice | undefined) => string,
): ProgramEntry[] {
  const entries: ProgramEntry[] = []

  talks.forEach((talk) => {
    const kind: TalkKind = talk.kind ?? 'talk'
    entries.push({
      key: programKey('talk', talk.id),
      kind,
      label: TALK_KIND_LABELS[kind],
      title: talk.memberName,
      detail: talk.topic,
    })
  })

  const intermediate = meeting?.hymns?.intermediate
  if (intermediate && (intermediate.number || intermediate.title)) {
    entries.push({
      key: programKey('hymn', 'intermediate'),
      kind: 'hymn',
      label: HYMN_SLOT_LABELS.intermediate,
      title: hymnTitle(intermediate),
      incomplete: !intermediate.number,
    })
  }

  ;(meeting?.musicalNumbers ?? []).forEach((number) => {
    entries.push({
      key: programKey('music', number.id),
      kind: 'music',
      label: 'Musikeinlage',
      title: number.title || 'Musikeinlage',
      incomplete: !number.title,
    })
  })

  const order = meeting?.programOrder ?? []
  if (order.length === 0) return entries

  const rank = new Map(order.map((key, index) => [key, index]))
  return [...entries].sort((a, b) => {
    const rankA = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER
    const rankB = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER
    if (rankA !== rankB) return rankA - rankB
    // Gleichstand heisst: beide sind neu. Dann zählt die Standardreihenfolge.
    return entries.indexOf(a) - entries.indexOf(b)
  })
}

/** Anzahl vorgesehener Ansprachen für einen Sonntag (Standard oder Ausnahme). */
export function talkSlotsFor(meeting: SacramentMeeting | null, defaultCount: number): number {
  const override = meeting?.talkSlots
  return typeof override === 'number' && override > 0 ? override : defaultCount
}

/** Wie viele Programmplätze sind an diesem Sonntag noch offen? */
export function openTalkSlots(
  meeting: SacramentMeeting | null,
  talks: Talk[],
  defaultCount: number,
): number {
  const planned = talkSlotsFor(meeting, defaultCount)
  const taken = new Set(
    talks
      .filter((talk) => ACTIVE_TALK_STATUSES.concat('held').includes(talk.status))
      .map((t) => t.slot),
  )
  let open = 0
  for (let slot = 1; slot <= planned; slot++) if (!taken.has(slot)) open++
  return open
}

/* ------------------------------------------------------------------ */
/* Vollständigkeit                                                     */
/* ------------------------------------------------------------------ */

export interface ProgramGap {
  area: string
  label: string
  to: string
}

/**
 * Was fehlt für diesen Sonntag noch?
 * Wird unter «Leitung» als kurze Liste gezeigt, damit vor dem Sonntag klar
 * ist, wo noch etwas offen ist.
 */
export function findGaps(
  meeting: SacramentMeeting | null,
  talks: Talk[],
  prayerSlots: { opening: boolean; closing: boolean },
  defaultTalkCount: number,
): ProgramGap[] {
  const gaps: ProgramGap[] = []

  const open = openTalkSlots(meeting, talks, defaultTalkCount)
  if (open > 0) {
    gaps.push({
      area: 'Ansprachen',
      label: `${open} Programmplatz${open === 1 ? '' : 'plätze'} offen`,
      to: '/abendmahl/ansprachen',
    })
  }

  const requiredHymns: HymnSlot[] = ['opening', 'sacrament', 'closing']
  const missingHymns = requiredHymns.filter((slot) => !meeting?.hymns?.[slot]?.number)
  if (missingHymns.length > 0) {
    gaps.push({
      area: 'Musik',
      label: missingHymns.map((slot) => HYMN_SLOT_LABELS[slot]).join(', ') + ' fehlt',
      to: '/abendmahl/musik',
    })
  }

  if (!prayerSlots.opening || !prayerSlots.closing) {
    const missing = [!prayerSlots.opening && 'Anfangsgebet', !prayerSlots.closing && 'Schlussgebet']
      .filter(Boolean)
      .join(', ')
    gaps.push({ area: 'Gebet', label: `${missing} offen`, to: '/abendmahl/gebet' })
  }

  return gaps
}

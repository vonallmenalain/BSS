import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { monthsSince, toDate } from '@/lib/dates'
import { stripUndefined } from '@/lib/utils'
import { ACTIVE_TALK_STATUSES, type Member, type Talk, type TalkStatus } from '@/lib/types'

const talksRef = collection(db, COLLECTIONS.talks)

export interface TalkInput {
  memberId: string
  memberName: string
  date: Date
  slot: number
  topic?: string
  durationMinutes?: number
  status?: TalkStatus
  askedById?: string | null
  notes?: string
}

export async function createTalk(input: TalkInput): Promise<string> {
  const docRef = await addDoc(talksRef, {
    ...stripUndefined({
      topic: input.topic?.trim(),
      notes: input.notes?.trim(),
      durationMinutes: input.durationMinutes,
    }),
    memberId: input.memberId,
    memberName: input.memberName,
    date: Timestamp.fromDate(input.date),
    slot: input.slot,
    status: input.status ?? 'planned',
    askedById: input.askedById ?? null,
    askedAt: input.status === 'asked' ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateTalk(
  id: string,
  patch: Partial<Omit<Talk, 'id' | 'date'>> & { date?: Date },
): Promise<void> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  if (patch.date) data.date = Timestamp.fromDate(patch.date)
  await updateDoc(doc(db, COLLECTIONS.talks, id), { ...data, updatedAt: serverTimestamp() })
}

/**
 * Setzt den Status einer Ansprache.
 *
 * Beim Wechsel auf «gehalten» wird `lastTalkDate` des Mitglieds nachgeführt –
 * genau dieser Wert treibt später die Auswertung «wer war lange nicht dran».
 * Der Zähler wird nur bei einem echten Statuswechsel verändert, damit
 * mehrfaches Klicken die Zahl nicht verfälscht.
 */
export async function setTalkStatus(id: string, status: TalkStatus): Promise<void> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return

  const talk = { id: snapshot.id, ...snapshot.data() } as Talk
  const wasHeld = talk.status === 'held'
  const isHeld = status === 'held'

  await updateDoc(ref, {
    status,
    askedAt: status === 'asked' && !talk.askedAt ? serverTimestamp() : (talk.askedAt ?? null),
    updatedAt: serverTimestamp(),
  })

  if (isHeld === wasHeld) return

  const memberRef = doc(db, COLLECTIONS.members, talk.memberId)
  const memberSnapshot = await getDoc(memberRef)
  if (!memberSnapshot.exists()) return

  if (isHeld) {
    const member = memberSnapshot.data() as Member
    const existing = toDate(member.lastTalkDate)
    const talkDate = toDate(talk.date)
    // Nur nach vorne korrigieren: ein nachgetragener alter Termin darf
    // ein neueres Datum nicht überschreiben.
    const shouldUpdate = talkDate && (!existing || talkDate > existing)
    await updateDoc(memberRef, {
      ...(shouldUpdate ? { lastTalkDate: Timestamp.fromDate(talkDate) } : {}),
      talkCount: increment(1),
      updatedAt: serverTimestamp(),
    })
  } else {
    // Zurückgenommen: Zähler korrigieren und letztes Datum neu bestimmen.
    await updateDoc(memberRef, { talkCount: increment(-1), updatedAt: serverTimestamp() })
    await recalculateLastTalk(talk.memberId)
  }
}

/** Ermittelt `lastTalkDate` neu aus den tatsächlich gehaltenen Ansprachen. */
export async function recalculateLastTalk(memberId: string): Promise<void> {
  const snapshot = await getDocs(
    query(talksRef, where('memberId', '==', memberId), where('status', '==', 'held')),
  )
  let latest: Date | null = null
  snapshot.docs.forEach((d) => {
    const date = toDate((d.data() as Talk).date)
    if (date && (!latest || date > latest)) latest = date
  })
  await updateDoc(doc(db, COLLECTIONS.members, memberId), {
    lastTalkDate: latest ? Timestamp.fromDate(latest) : null,
    talkCount: snapshot.size,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTalk(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  const talk = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Talk) : null
  await deleteDoc(ref)
  // War die Ansprache bereits gehalten, muss die Mitgliederstatistik nachgeführt werden.
  if (talk?.status === 'held') await recalculateLastTalk(talk.memberId)
}

/* ------------------------------------------------------------------ */
/* Vorschlagsliste                                                     */
/* ------------------------------------------------------------------ */

export interface TalkCandidate {
  member: Member
  /** Monate seit der letzten Ansprache; `null` = noch nie gesprochen */
  monthsSince: number | null
  /** Bereits eine Ansprache eingeplant? Dann nicht doppelt anfragen. */
  alreadyPlanned: boolean
  /** Je höher, desto dringender ist eine Anfrage */
  score: number
}

/**
 * Ermittelt, wer als Nächstes für eine Ansprache angefragt werden sollte.
 *
 * Ganz oben stehen aktive Mitglieder, die noch nie gesprochen haben, danach
 * jene mit dem längsten Abstand. Bereits eingeplante Personen werden nach
 * hinten sortiert, statt sie zu verstecken – so bleibt sichtbar, dass sie dran sind.
 */
export function rankTalkCandidates(
  members: Member[],
  plannedTalks: Talk[],
  options: { gapMonths?: number; onlyActive?: boolean } = {},
): TalkCandidate[] {
  const { gapMonths = 18, onlyActive = true } = options
  const plannedMemberIds = new Set(
    plannedTalks.filter((t) => ACTIVE_TALK_STATUSES.includes(t.status)).map((t) => t.memberId),
  )

  return members
    .filter((member) => {
      if (!member.availableForTalks) return false
      if (onlyActive && member.status !== 'active') return false
      return true
    })
    .map((member) => {
      const months = monthsSince(member.lastTalkDate)
      const alreadyPlanned = plannedMemberIds.has(member.id)

      // Noch nie gesprochen erhält bewusst mehr Gewicht als der reine Zeitabstand.
      let score = months === null ? gapMonths * 2 + 24 : months
      if (alreadyPlanned) score -= 1000

      return { member, monthsSince: months, alreadyPlanned, score }
    })
    .sort((a, b) => b.score - a.score)
}

/** Ansprachen eines Datums, nach Programmposition sortiert. */
export async function getTalksForDate(date: Date): Promise<Talk[]> {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const snapshot = await getDocs(
    query(
      talksRef,
      where('date', '>=', Timestamp.fromDate(start)),
      where('date', '<=', Timestamp.fromDate(end)),
      orderBy('date'),
    ),
  )
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Talk)
    .sort((a, b) => a.slot - b.slot)
}

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { getAge, monthsSince, toDate } from '@/lib/dates'
import { stripUndefined } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import {
  ACTIVE_TALK_STATUSES,
  type Member,
  type Talk,
  type TalkKind,
  type TalkStatus,
} from '@/lib/types'

const talksRef = collection(db, COLLECTIONS.talks)

export interface TalkInput {
  /** Leer lassen, wenn der Name von Hand erfasst wurde (siehe `TalkSpeaker`) */
  memberId?: string
  memberName: string
  date: Date
  slot: number
  /** Ansprache oder Zeugnis – beides belegt einen Programmplatz */
  kind?: TalkKind
  topic?: string
  durationMinutes?: number
  status?: TalkStatus
  askedById?: string | null
  notes?: string
}

/**
 * Wer spricht: ein Mitglied **oder** ein von Hand erfasster Name.
 *
 * Am Pult steht nicht immer jemand aus der eigenen Gemeinde – ein besuchender
 * Hoher Rat, die Missionare, «Zeugnisse der neuen Ältesten». Ein Mitglied wird
 * deshalb nur zugeordnet, wenn es ausdrücklich aus der Mitgliederliste gewählt
 * wurde; alles andere bleibt reiner Text und lässt die Auswertung «wer war
 * lange nicht dran» unberührt.
 */
export type TalkSpeaker = { member: Member } | { name: string }

/** Die beiden Felder, die eine Ansprache über die sprechende Person führt. */
export function speakerFields(speaker: TalkSpeaker): { memberId: string; memberName: string } {
  if ('member' in speaker) {
    const { id, firstName, lastName } = speaker.member
    return { memberId: id, memberName: `${firstName} ${lastName}`.trim() }
  }
  return { memberId: '', memberName: speaker.name.trim() }
}

export async function createTalk(input: TalkInput): Promise<{ id: string; outcome: SaveOutcome }> {
  // Die ID entsteht im Client, damit sie auch ohne Netz sofort feststeht.
  const docRef = doc(talksRef)
  const outcome = await commit(
    setDoc(docRef, {
      ...stripUndefined({
        topic: input.topic?.trim(),
        notes: input.notes?.trim(),
        durationMinutes: input.durationMinutes,
      }),
      memberId: input.memberId ?? '',
      memberName: input.memberName,
      date: Timestamp.fromDate(input.date),
      slot: input.slot,
      kind: input.kind ?? 'talk',
      status: input.status ?? 'planned',
      askedById: input.askedById ?? null,
      askedAt: input.status === 'asked' ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
  return { id: docRef.id, outcome }
}

export async function updateTalk(
  id: string,
  patch: Partial<Omit<Talk, 'id' | 'date'>> & { date?: Date },
): Promise<SaveOutcome> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  if (patch.date) data.date = Timestamp.fromDate(patch.date)
  return commit(
    updateDoc(doc(db, COLLECTIONS.talks, id), { ...data, updatedAt: serverTimestamp() }),
  )
}

/**
 * Trägt ein, wer spricht – ein Mitglied oder ein Name von Hand.
 *
 * Wechselt eine bereits gehaltene Ansprache die Person, werden beide
 * Mitgliederstatistiken neu berechnet: Sonst zählte die Ansprache weiterhin
 * bei derjenigen, die sie gar nicht gehalten hat. Ohne Mitglied gibt es nichts
 * nachzuführen.
 */
export async function setTalkSpeaker(id: string, speaker: TalkSpeaker): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  const previous = snapshot.exists() ? (snapshot.data() as Talk) : null
  const fields = speakerFields(speaker)

  const outcome = await commit(updateDoc(ref, { ...fields, updatedAt: serverTimestamp() }))

  if (previous?.status === 'held' && previous.memberId !== fields.memberId) {
    if (previous.memberId) await recalculateLastTalk(previous.memberId)
    if (fields.memberId) await recalculateLastTalk(fields.memberId)
  }
  return outcome
}

/**
 * Setzt den Status einer Ansprache.
 *
 * Beim Wechsel auf «gehalten» wird `lastTalkDate` des Mitglieds nachgeführt –
 * genau dieser Wert treibt später die Auswertung «wer war lange nicht dran».
 * Der Zähler wird nur bei einem echten Statuswechsel verändert, damit
 * mehrfaches Klicken die Zahl nicht verfälscht.
 */
export async function setTalkStatus(id: string, status: TalkStatus): Promise<SaveOutcome | null> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

  const talk = { id: snapshot.id, ...snapshot.data() } as Talk
  const wasHeld = talk.status === 'held'
  const isHeld = status === 'held'

  const outcome = await commit(
    updateDoc(ref, {
      status,
      askedAt: status === 'asked' && !talk.askedAt ? serverTimestamp() : (talk.askedAt ?? null),
      updatedAt: serverTimestamp(),
    }),
  )

  if (isHeld === wasHeld) return outcome
  // Ein von Hand erfasster Name gehört zu keinem Mitglied – es gibt keine
  // Statistik, die nachzuführen wäre.
  if (!talk.memberId) return outcome

  const memberRef = doc(db, COLLECTIONS.members, talk.memberId)
  const memberSnapshot = await getDoc(memberRef)
  if (!memberSnapshot.exists()) return outcome

  if (isHeld) {
    const member = memberSnapshot.data() as Member
    const existing = toDate(member.lastTalkDate)
    const talkDate = toDate(talk.date)
    // Nur nach vorne korrigieren: ein nachgetragener alter Termin darf
    // ein neueres Datum nicht überschreiben.
    const shouldUpdate = talkDate && (!existing || talkDate > existing)
    await commit(
      updateDoc(memberRef, {
        ...(shouldUpdate ? { lastTalkDate: Timestamp.fromDate(talkDate) } : {}),
        talkCount: increment(1),
        updatedAt: serverTimestamp(),
      }),
    )
  } else {
    // Zurückgenommen: Zähler korrigieren und letztes Datum neu bestimmen.
    await commit(updateDoc(memberRef, { talkCount: increment(-1), updatedAt: serverTimestamp() }))
    await recalculateLastTalk(talk.memberId)
  }
  return outcome
}

/** Ermittelt `lastTalkDate` neu aus den tatsächlich gehaltenen Ansprachen. */
export async function recalculateLastTalk(memberId: string): Promise<SaveOutcome> {
  const snapshot = await getDocs(
    query(talksRef, where('memberId', '==', memberId), where('status', '==', 'held')),
  )
  let latest: Date | null = null
  snapshot.docs.forEach((d) => {
    const date = toDate((d.data() as Talk).date)
    if (date && (!latest || date > latest)) latest = date
  })
  return commit(
    updateDoc(doc(db, COLLECTIONS.members, memberId), {
      lastTalkDate: latest ? Timestamp.fromDate(latest) : null,
      talkCount: snapshot.size,
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function deleteTalk(id: string): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  const talk = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Talk) : null
  const outcome = await commit(deleteDoc(ref))
  // War die Ansprache bereits gehalten, muss die Mitgliederstatistik nachgeführt werden.
  if (talk?.status === 'held' && talk.memberId) await recalculateLastTalk(talk.memberId)
  return outcome
}

/* ------------------------------------------------------------------ */
/* Vorschlagsliste                                                     */
/* ------------------------------------------------------------------ */

export interface TalkCandidate {
  member: Member
  /** Alter in Jahren; `null`, wenn kein Geburtsdatum erfasst ist */
  age: number | null
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
 *
 * `minAge` hält die Kinder heraus. Ohne diese Grenze stünden sie zuoberst,
 * denn sie haben noch nie gesprochen. Wer kein Geburtsdatum hat, bleibt in
 * der Liste: Ein fehlendes Datum ist kein Grund, jemanden zu übergehen.
 */
export function rankTalkCandidates(
  members: Member[],
  plannedTalks: Talk[],
  options: { gapMonths?: number; onlyActive?: boolean; minAge?: number } = {},
): TalkCandidate[] {
  const { gapMonths = 18, onlyActive = true, minAge = 0 } = options
  const plannedMemberIds = new Set(
    plannedTalks.filter((t) => ACTIVE_TALK_STATUSES.includes(t.status)).map((t) => t.memberId),
  )

  return members
    .map((member) => ({ member, age: getAge(member.birthDate) }))
    .filter(({ member, age }) => {
      if (!member.availableForTalks) return false
      if (onlyActive && member.status !== 'active') return false
      if (minAge > 0 && age !== null && age < minAge) return false
      return true
    })
    .map(({ member, age }) => {
      const months = monthsSince(member.lastTalkDate)
      const alreadyPlanned = plannedMemberIds.has(member.id)

      // Noch nie gesprochen erhält bewusst mehr Gewicht als der reine Zeitabstand.
      let score = months === null ? gapMonths * 2 + 24 : months
      if (alreadyPlanned) score -= 1000

      return { member, age, monthsSince: months, alreadyPlanned, score }
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

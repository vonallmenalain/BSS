import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { toDate } from '@/lib/dates'
import { stripUndefined } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import {
  HELD_STATUS_QUERY,
  type Talk,
  type Member,
  type TalkKind,
  type TalkStatus,
} from '@/lib/types'

const talksRef = collection(db, COLLECTIONS.talks)

export interface TalkInput {
  /** Leer lassen, wenn der Name von Hand erfasst wurde (siehe `TalkSpeaker`) */
  memberId?: string
  /** Leer heisst «Platzhalter»: der Platz steht, der Name kommt später */
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
 *
 * `null` heisst: noch niemand. Der Punkt steht dann als Platzhalter im
 * Programm (siehe `isTalkPlaceholder`).
 */
export type TalkSpeaker = { member: Member } | { name: string }

/** Die beiden Felder, die eine Ansprache über die sprechende Person führt. */
export function speakerFields(speaker: TalkSpeaker | null): {
  memberId: string
  memberName: string
} {
  if (!speaker) return { memberId: '', memberName: '' }
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
  // Wer beim Erfassen gleich zusagt, hat gesprochen – die Statistik gehört
  // schon hier nachgeführt und nicht erst beim nächsten Statuswechsel.
  if ((input.status ?? 'planned') === 'confirmed' && input.memberId) {
    await recalculateLastTalk(input.memberId)
  }
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
 * Trägt ein, wer spricht – ein Mitglied, ein Name von Hand oder niemand.
 *
 * Wechselt eine zugesagte Ansprache die Person, werden beide
 * Mitgliederstatistiken neu berechnet: Sonst zählte die Ansprache weiterhin
 * bei derjenigen, die sie gar nicht gehalten hat. Genau dafür ist der
 * Handgriff unter «Leitung» da – wer kurzfristig einspringt, wird dort
 * eingetragen, und die Auswertung stimmt wieder. Ohne Mitglied gibt es
 * nichts nachzuführen.
 *
 * `null` nimmt den Namen wieder weg, ohne den Punkt zu löschen: Art, Dauer
 * und Thema bleiben stehen, der Platz wird zum Platzhalter. Wer den Punkt
 * ganz loswerden will, entfernt ihn (siehe `deleteTalk`).
 */
export async function setTalkSpeaker(
  id: string,
  speaker: TalkSpeaker | null,
): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  const previous = snapshot.exists() ? (snapshot.data() as Talk) : null
  const fields = speakerFields(speaker)

  const outcome = await commit(updateDoc(ref, { ...fields, updatedAt: serverTimestamp() }))

  if (previous && countsAsHeld(previous.status) && previous.memberId !== fields.memberId) {
    if (previous.memberId) await recalculateLastTalk(previous.memberId)
    if (fields.memberId) await recalculateLastTalk(fields.memberId)
  }
  return outcome
}

/** Zählt dieser Status als gesprochen? «Gehalten» steht noch im Altbestand. */
function countsAsHeld(status: unknown): boolean {
  return status === 'confirmed' || status === 'held'
}

/**
 * Setzt den Status einer Ansprache.
 *
 * Eine Zusage zählt: Wer zugesagt hat, spricht – ein zusätzlicher Klick
 * «gehalten» nach der Versammlung wäre einer, den niemand macht, und ohne
 * ihn stimmte die Auswertung «wer war lange nicht dran» nicht mehr. Wird
 * die Zusage zurückgenommen oder die Person ausgetauscht, wird die
 * Statistik hier gleich wieder berichtigt.
 *
 * Gezählt wird nicht hoch und runter, sondern aus dem Bestand neu bestimmt.
 * Das ist eine Abfrage mehr und dafür immer richtig – ein Zähler, der sich
 * einmal verzählt, bleibt für immer daneben.
 */
export async function setTalkStatus(id: string, status: TalkStatus): Promise<SaveOutcome | null> {
  const ref = doc(db, COLLECTIONS.talks, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

  const talk = { id: snapshot.id, ...snapshot.data() } as Talk
  const before = countsAsHeld(talk.status)

  const outcome = await commit(
    updateDoc(ref, {
      status,
      askedAt: status === 'asked' && !talk.askedAt ? serverTimestamp() : (talk.askedAt ?? null),
      updatedAt: serverTimestamp(),
    }),
  )

  // Ein von Hand erfasster Name gehört zu keinem Mitglied – es gibt keine
  // Statistik, die nachzuführen wäre.
  if (before !== countsAsHeld(status) && talk.memberId) await recalculateLastTalk(talk.memberId)
  return outcome
}

/** Ermittelt `lastTalkDate` und `talkCount` neu aus den zugesagten Ansprachen. */
export async function recalculateLastTalk(memberId: string): Promise<SaveOutcome> {
  const snapshot = await getDocs(
    query(talksRef, where('memberId', '==', memberId), where('status', 'in', HELD_STATUS_QUERY)),
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
  forgetDoc(COLLECTIONS.talks, id)
  // Zählte die Ansprache bereits, muss die Mitgliederstatistik nachgeführt werden.
  if (countsAsHeld(talk?.status) && talk?.memberId) await recalculateLastTalk(talk.memberId)
  return outcome
}

/* ------------------------------------------------------------------ */
/* Vorschlagsliste                                                     */
/* ------------------------------------------------------------------ */

/*
 * Wer angefragt werden sollte, steht firestore-frei in `lib/talkCandidates` –
 * von hier mitverteilt, damit die Oberfläche nur einen Ort kennen muss. Wie
 * bei `services/sacrament` und `lib/sunday`.
 */
export {
  activeTalkFilterCount,
  DEFAULT_TALK_FILTER,
  filterTalkCandidates,
  NEVER_SPOKE,
  plannedTalkMemberIds,
  rankTalkCandidates,
  talkYearOptions,
  type TalkCandidate,
  type TalkCandidateFilter,
  type TalkGenderFilter,
} from '@/lib/talkCandidates'

/**
 * Ein Mitglied nicht anfragen – oder wieder aufnehmen.
 *
 * Ein Zustand am Mitglied und nicht an einer Ansprache: Es gibt keine, und
 * genau darum geht es. Wer ausgenommen ist, fällt aus den Vorschlägen
 * heraus, bleibt aber über den Filter sichtbar (siehe `lib/talkCandidates`).
 *
 * `until` sagt, bis wann – ohne Datum gilt der Vermerk auf Weiteres. Der
 * frühere zweite Haken `talkHold` wird dabei weggeräumt: Bliebe er stehen,
 * hielte er die Person auch dann noch heraus, wenn sie eben aufgenommen
 * wurde (siehe `lib/availability`).
 */
export async function setTalkAvailability(
  memberId: string,
  available: boolean,
  until: Date | null = null,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.members, memberId), {
      availableForTalks: available,
      talkHoldUntil: available || !until ? null : Timestamp.fromDate(until),
      talkAvailabilityChangedAt: serverTimestamp(),
      talkHold: deleteField(),
      updatedAt: serverTimestamp(),
    }),
  )
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

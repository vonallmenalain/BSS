import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { differenceInMonths, toDate, toDateInput } from '@/lib/dates'
import type { Member, Prayer, PrayerSlot } from '@/lib/types'

/**
 * Ein Gebet je Sonntag und Platz – die Dokument-ID stellt das sicher.
 * Ein zweites Anfangsgebet für denselben Sonntag kann so gar nicht entstehen.
 */
export function prayerDocId(date: Date | string, slot: PrayerSlot): string {
  const key = typeof date === 'string' ? date : toDateInput(date)
  return `${key}_${slot}`
}

/** Weist ein Gebet zu. `member = null` gibt den Platz wieder frei. */
export async function setPrayer(
  date: Date,
  slot: PrayerSlot,
  member: Member | null,
  notes = '',
): Promise<void> {
  const ref = doc(db, COLLECTIONS.prayers, prayerDocId(date, slot))

  if (!member) {
    await deleteDoc(ref)
    return
  }

  await setDoc(
    ref,
    {
      date: Timestamp.fromDate(date),
      slot,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      notes,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function updatePrayerNotes(
  date: Date,
  slot: PrayerSlot,
  notes: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.prayers, prayerDocId(date, slot)),
    { notes, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/* ------------------------------------------------------------------ */
/* Auswertung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Letztes Gebet je Mitglied.
 *
 * Bewusst aus der Sammlung berechnet statt am Mitglied gespeichert: Gebete
 * werden häufig umdisponiert, und ein denormalisiertes Datum müsste bei jedem
 * Wechsel nachgeführt werden. Die Liste ist klein genug (zwei Einträge pro
 * Sonntag), um sie im Client auszuwerten.
 */
export function lastPrayerByMember(prayers: Prayer[], until = new Date()): Map<string, Date> {
  const result = new Map<string, Date>()
  for (const prayer of prayers) {
    const date = toDate(prayer.date)
    if (!date || date > until) continue
    const existing = result.get(prayer.memberId)
    if (!existing || date > existing) result.set(prayer.memberId, date)
  }
  return result
}

/** Alle künftigen Zuteilungen – wer schon eingeplant ist, wird nicht doppelt gefragt. */
export function plannedPrayerMemberIds(prayers: Prayer[], from = new Date()): Set<string> {
  const ids = new Set<string>()
  for (const prayer of prayers) {
    const date = toDate(prayer.date)
    if (date && date >= from) ids.add(prayer.memberId)
  }
  return ids
}

export interface PrayerCandidate {
  member: Member
  /** Monate seit dem letzten Gebet; `null` = noch nie gebetet */
  monthsSince: number | null
  lastDate: Date | null
  /** Bereits für einen kommenden Sonntag eingeteilt */
  alreadyPlanned: boolean
  score: number
}

/**
 * Wer sollte als Nächstes um ein Gebet gebeten werden?
 *
 * Gleiche Logik wie bei den Ansprachen: Zuoberst steht, wer noch nie gebetet
 * hat, danach der längste Abstand. Bereits eingeteilte Personen rutschen nach
 * hinten, bleiben aber sichtbar.
 */
export function rankPrayerCandidates(
  members: Member[],
  prayers: Prayer[],
  options: { gapMonths?: number; onlyActive?: boolean } = {},
): PrayerCandidate[] {
  const { gapMonths = 6, onlyActive = true } = options
  const lastByMember = lastPrayerByMember(prayers)
  const planned = plannedPrayerMemberIds(prayers)
  const now = new Date()

  return members
    .filter((member) => (onlyActive ? member.status === 'active' : true))
    .map((member) => {
      const lastDate = lastByMember.get(member.id) ?? null
      const monthsSince = lastDate ? differenceInMonths(now, lastDate) : null
      const alreadyPlanned = planned.has(member.id)

      // «Noch nie gebetet» wiegt schwerer als ein langer Abstand.
      let score = monthsSince === null ? gapMonths * 2 + 24 : monthsSince
      if (alreadyPlanned) score -= 1000

      return { member, monthsSince, lastDate, alreadyPlanned, score }
    })
    .sort((a, b) => b.score - a.score)
}

/** Gehaltene bzw. geplante Gebete, nach Datum absteigend – für den Verlauf. */
export function sortPrayersByDate(prayers: Prayer[]): Prayer[] {
  return [...prayers].sort(
    (a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0),
  )
}

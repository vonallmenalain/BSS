import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { prayerAvailability } from '@/lib/availability'
import { addDays, differenceInMonths, toDate, toDateInput } from '@/lib/dates'
import { commit, type SaveOutcome } from '@/lib/sync'
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
): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.prayers, prayerDocId(date, slot))

  if (!member) {
    const outcome = await commit(deleteDoc(ref))
    forgetDoc(COLLECTIONS.prayers, ref.id)
    return outcome
  }

  return commit(
    setDoc(
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
    ),
  )
}

export async function updatePrayerNotes(
  date: Date,
  slot: PrayerSlot,
  notes: string,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.prayers, prayerDocId(date, slot)),
      { notes, updatedAt: serverTimestamp() },
      { merge: true },
    ),
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

/* ------------------------------------------------------------------ */
/* Vorerst überspringen                                                */
/* ------------------------------------------------------------------ */

/**
 * Wie lange «Heute nicht» gilt.
 *
 * Vier Wochen und ein bisschen: Wer diesen Sonntag nicht gefragt werden soll,
 * ist meist auch am nächsten und übernächsten kein Thema – und nach einem
 * Monat hat sich die Lage in aller Regel geändert. Länger wäre eine
 * Entscheidung, die niemand getroffen hat.
 */
export const PRAYER_HOLD_DAYS = 30

/** Ist dieses Mitglied gerade ausgenommen? Siehe `lib/availability`. */
export function isPrayerHeld(member: Member, now = new Date()): boolean {
  return !prayerAvailability(member, now).available
}

/**
 * Ein Mitglied aus den Vorschlägen nehmen – oder es wieder aufnehmen.
 *
 * Der Zustand steht am Mitglied und damit in Firestore: Wer zuteilt, wechselt
 * sich in einer Bischofschaft ab, und ein Vermerk, den nur ein Gerät kennt,
 * hilft dem nächsten nicht.
 *
 * `until` sagt, bis wann – ohne Datum gilt der Vermerk auf Weiteres. Das
 * «Heute nicht» der Zuteilung setzt es auf `PRAYER_HOLD_DAYS` voraus; im
 * Profil lässt sich jedes andere Datum eintragen.
 */
export async function setPrayerAvailability(
  memberId: string,
  available: boolean,
  until: Date | null = null,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.members, memberId), {
      availableForPrayers: available,
      prayerHoldUntil: available || !until ? null : Timestamp.fromDate(until),
      prayerAvailabilityChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/** «Heute nicht» – für die nächsten Wochen überspringen, oder wieder aufnehmen. */
export async function setPrayerHold(
  memberId: string,
  days: number = PRAYER_HOLD_DAYS,
): Promise<SaveOutcome> {
  return setPrayerAvailability(memberId, days <= 0, days > 0 ? addDays(new Date(), days) : null)
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
  options: { gapMonths?: number; onlyActive?: boolean; includeHeld?: boolean } = {},
): PrayerCandidate[] {
  const { gapMonths = 6, onlyActive = true, includeHeld = false } = options
  const lastByMember = lastPrayerByMember(prayers)
  const planned = plannedPrayerMemberIds(prayers)
  const now = new Date()

  return (
    members
      .filter((member) => (onlyActive ? member.status === 'active' : true))
      // «Heute nicht» nimmt jemanden für ein paar Wochen heraus. Mit
      // `includeHeld` lässt sich nachsehen, wen das gerade betrifft.
      .filter((member) => includeHeld || !isPrayerHeld(member, now))
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
  )
}

/** Gehaltene bzw. geplante Gebete, nach Datum absteigend – für den Verlauf. */
export function sortPrayersByDate(prayers: Prayer[]): Prayer[] {
  return [...prayers].sort(
    (a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0),
  )
}

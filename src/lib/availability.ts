import { toDate } from './dates.ts'
import type { Member } from './types.ts'

/**
 * Wer angefragt werden darf – für eine Ansprache und für ein Gebet.
 *
 * Beide Fragen werden gleich beantwortet, und deshalb stehen sie hier
 * beisammen: ein Vermerk «nicht anfragen», wahlweise mit einem Datum, bis zu
 * dem er gilt. Ohne Datum gilt er auf Weiteres – das ist der Fall «spricht
 * grundsätzlich nicht». Mit Datum ist es ein «im Moment nicht», das von
 * selbst wieder abläuft.
 *
 * **Früher waren es zwei Haken.** «Kann für Ansprachen angefragt werden» und
 * daneben «vorerst nicht anfragen» – dieselbe Frage zweimal, und beide
 * zugleich angehakt ergaben keinen Sinn. Zusammengelegt bleibt eine
 * Entscheidung, und das Datum sagt, wie lange sie gilt.
 *
 * Firestore-frei wie `lib/talkCandidates` und `lib/sunday`, damit sich die
 * Regel prüfen lässt (`tests/availability.test.ts`).
 */
export interface Availability {
  /** Kann diese Person gerade angefragt werden? */
  available: boolean
  /** Bis wann der Vermerk gilt – `null` heisst «auf Weiteres» */
  until: Date | null
  /** Wann die Entscheidung zuletzt getroffen wurde */
  changedAt: Date | null
  /**
   * Der Vermerk steht noch da, sein Datum ist aber verstrichen.
   *
   * Die Person gilt damit wieder als anfragbar. Aufgeräumt wird nichts:
   * Ein Hintergrundlauf, der Datensätze anfasst, die niemand angesehen hat,
   * wäre für eine Anzeige zu viel Aufwand – und beim nächsten Speichern
   * bereinigt sich der Vermerk von selbst.
   */
  expired: boolean
}

function resolve(
  blocked: boolean,
  untilValue: Parameters<typeof toDate>[0],
  changedValue: Parameters<typeof toDate>[0],
  now: Date,
): Availability {
  const until = toDate(untilValue)
  const changedAt = toDate(changedValue)
  const expired = blocked && until !== null && until <= now
  return { available: !blocked || expired, until, changedAt, expired }
}

/**
 * Ansprachen.
 *
 * Der Altbestand kannte zwei Felder. `talkHold` war der zweite Haken; wo er
 * noch steht, gilt er wie ein abgewähltes «kann angefragt werden», damit
 * niemand durch die Zusammenlegung unversehens wieder in den Vorschlägen
 * auftaucht.
 */
export function talkAvailability(member: Member, now = new Date()): Availability {
  const blocked = member.availableForTalks === false || member.talkHold === true
  return resolve(blocked, member.talkHoldUntil, member.talkAvailabilityChangedAt, now)
}

/**
 * Gebete.
 *
 * Hier stand im Altbestand allein das Datum für den Vermerk: Ein gesetztes
 * `prayerHoldUntil` hiess «zurückgestellt». Fehlt der neue Haken, gilt
 * deshalb weiterhin das Datum als Vermerk.
 */
export function prayerAvailability(member: Member, now = new Date()): Availability {
  const blocked =
    member.availableForPrayers === undefined
      ? member.prayerHoldUntil != null
      : member.availableForPrayers === false
  return resolve(blocked, member.prayerHoldUntil, member.prayerAvailabilityChangedAt, now)
}

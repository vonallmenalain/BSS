import { toDate } from './dates.ts'
import { MEMBER_ORGANIZATION_TAGS, type Member, type MemberOrganization } from './types.ts'

/**
 * In welcher Organisation der Gemeinde jemand ist.
 *
 * Vier Gruppen, und sie schliessen lückenlos aneinander an: **PV** von
 * anderthalb Jahren bis zum Ende des Jahres, in dem jemand elf wird –
 * **JD/AP** von Anfang des Jahres, in dem jemand zwölf wird, bis zum
 * achtzehnten Geburtstag – **JAE** ab achtzehn, solange unverheiratet –
 * **AE** ab sechsunddreissig, solange unverheiratet.
 *
 * **Zwei davon rechnet die App, zwei nicht.** PV und JD/AP hängen allein am
 * Geburtsdatum; das steht am Mitglied, und daraus ergibt sich die Gruppe von
 * selbst. Ob jemand verheiratet ist, steht dagegen nirgends – deshalb kommen
 * JAE und AE aus den Listen des LCR und stehen danach als Schlagwort am
 * Mitglied (siehe `services/importSingles`). Wer zwischen zwei Importen
 * achtzehn wird, bekommt das Schlagwort im Profil mit einem Griff.
 *
 * Firestore-frei wie `lib/availability`, damit sich die Grenzen prüfen
 * lassen (`tests/organizations.test.ts`). Der Stichtag wird übergeben und
 * nicht gelesen: Eine Regel, die «heute» selbst bestimmt, lässt sich nicht
 * an einem 31. Dezember prüfen.
 */

/* ------------------------------------------------------------------ */
/* PV                                                                  */
/* ------------------------------------------------------------------ */

/** Ab welchem Alter ein Kind in die PV kommt – in Monaten. */
const PRIMARY_FROM_MONTHS = 18

/** Bis zum Ende des Jahres, in dem ein Kind so alt wird. */
const PRIMARY_UNTIL_AGE = 11

/** Ab dem Jahr, in dem jemand so alt wird, gehört er zu JD/AP. */
const YOUTH_FROM_AGE = 12

/** Mit diesem Geburtstag endet JD/AP – dort beginnt JAE. */
const YOUTH_UNTIL_AGE = 18

/**
 * Denselben Tag ein paar Monate später – ohne in den Folgemonat zu rutschen.
 *
 * `new Date(2024, 0 + 18, 31)` wäre der 3. März statt des 31. Juli: Der Juli
 * hat einunddreissig Tage, aber `Date` rechnet stur weiter, wenn der Tag im
 * Zielmonat nicht existiert. Beim Geburtstag eines Kindes wäre das ein
 * Fehler von drei Tagen – klein, aber an der Grenze entscheidend.
 */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

/**
 * Der Tag, an dem ein Kind anderthalb Jahre alt wird.
 *
 * «Ab genau 1.5 Jahren» heisst genau das: nicht ab dem zweiten Geburtstag
 * und nicht ab dem Jahr, in dem es zwei wird, sondern achtzehn Monate nach
 * dem Geburtstag.
 */
export function primaryStart(birth: Date): Date {
  return addMonths(birth, PRIMARY_FROM_MONTHS)
}

/**
 * Gehört dieses Geburtsdatum am Stichtag zur PV?
 *
 * Oben schneidet nicht der Geburtstag ab, sondern der Jahreswechsel: Wer im
 * laufenden Jahr elf wird, bleibt bis zum 31. Dezember in der PV – auch wenn
 * er im Januar Geburtstag hatte. Am 1. Januar darauf ist er bei JD/AP, und
 * genau so wechseln die Klassen auch in der Gemeinde.
 */
export function isPrimaryAge(birth: Date, now: Date): boolean {
  if (now < primaryStart(birth)) return false
  return now.getFullYear() <= birth.getFullYear() + PRIMARY_UNTIL_AGE
}

/* ------------------------------------------------------------------ */
/* JD / AP                                                             */
/* ------------------------------------------------------------------ */

/** Der Geburtstag, an dem jemand aus JD/AP herauswächst. */
function birthday(birth: Date, age: number): Date {
  return new Date(birth.getFullYear() + age, birth.getMonth(), birth.getDate())
}

/**
 * Gehört dieses Geburtsdatum am Stichtag zu den Jungen Damen bzw. zum
 * Aaronischen Priestertum?
 *
 * Unten beginnt es mit dem Jahr und nicht mit dem Geburtstag – nahtlos dort,
 * wo die PV aufhört. Oben endet es mit dem achtzehnten Geburtstag, auf den
 * Tag genau: Dort beginnt JAE, und niemand soll für ein halbes Jahr in
 * beiden Listen stehen.
 */
export function isYouthAge(birth: Date, now: Date): boolean {
  if (now.getFullYear() < birth.getFullYear() + YOUTH_FROM_AGE) return false
  return now < birthday(birth, YOUTH_UNTIL_AGE)
}

/* ------------------------------------------------------------------ */
/* Die Gruppe eines Mitglieds                                          */
/* ------------------------------------------------------------------ */

/**
 * Wer seit dem letzten Import der JAE-Liste achtzehn geworden ist, gilt als
 * JAE.
 *
 * **Die Lücke zwischen zwei Importen.** JD/AP endet auf den Tag genau mit
 * dem achtzehnten Geburtstag. Die JAE-Liste wird alle paar Monate neu
 * eingelesen – wer dazwischen achtzehn wird, stünde bis dahin in keiner
 * Gruppe mehr, obwohl jeder in der Gemeinde weiss, wohin er gehört.
 *
 * Geschlossen wird das mit dem Datum des letzten Imports und nicht mit einer
 * Frist: «Wer nach dem letzten Import achtzehn wurde, kann noch nicht auf der
 * Liste stehen» ist keine Schätzung, sondern eine Tatsache – und sie hört
 * von selbst auf zu gelten, sobald die Liste das nächste Mal eingelesen wird.
 * Geschrieben wird dafür nichts: Ein Schlagwort, das die App selbst setzt,
 * müsste sie auch selbst wieder wegräumen, sobald jemand heiratet.
 *
 * Zwei Vorbehalte, beide bewusst:
 *
 *  - **Ohne Import geschieht nichts.** Solange keine Liste eingelesen wurde,
 *    weiss die App über den Familienstand gar nichts; jeden Achtzehnjährigen
 *    zum JAE zu erklären wäre geraten.
 *  - **Wer schon zu den Alleinstehenden Erwachsenen zählt, bleibt dort.**
 *    Das kommt mit achtzehn nicht vor, kostet aber nichts – und hielte einen
 *    Widerspruch aus der Liste heraus, sollte er je entstehen.
 */
export function turnedEighteenSince(
  member: Member,
  since: Date | null | undefined,
  now: Date,
): boolean {
  if (!since) return false
  const birth = toDate(member.birthDate)
  if (!birth) return false
  const eighteenth = birthday(birth, YOUTH_UNTIL_AGE)
  return eighteenth > since && eighteenth <= now
}

/**
 * In welchen Gruppen ein Mitglied am Stichtag steht.
 *
 * `jaeImportedAt` ist der Zeitpunkt, zu dem die JAE-Liste zuletzt eingelesen
 * wurde – daran hängt, wer seither dazugekommen ist (siehe
 * `turnedEighteenSince`). Ohne diese Angabe zählt allein, was in den Listen
 * stand.
 *
 * Mehrere Gruppen sind möglich, auch wenn es selten vorkommt: Wer das
 * Schlagwort «JAE» behalten hat und inzwischen sechsunddreissig ist, stünde
 * in beiden Listen. Aufgeräumt wird das beim nächsten Import; bis dahin ist
 * die doppelte Nennung die ehrlichere Auskunft.
 *
 * Ohne Geburtsdatum bleiben PV und JD/AP aussen vor: Über das Alter lässt
 * sich dann nichts sagen, und zu raten wäre schlimmer als zu schweigen.
 */
export function organizationsOf(
  member: Member,
  now = new Date(),
  jaeImportedAt?: Date | null,
): MemberOrganization[] {
  const found: MemberOrganization[] = []
  const birth = toDate(member.birthDate)

  if (birth) {
    if (isPrimaryAge(birth, now)) found.push('pv')
    if (isYouthAge(birth, now)) found.push('jdap')
  }

  const tags = member.tags ?? []
  const isAe = tags.includes(MEMBER_ORGANIZATION_TAGS.ae)

  if (
    tags.includes(MEMBER_ORGANIZATION_TAGS.jae) ||
    (!isAe && turnedEighteenSince(member, jaeImportedAt, now))
  ) {
    found.push('jae')
  }
  if (isAe) found.push('ae')

  return found
}

/**
 * Passt das Mitglied zu einer der gewählten Gruppen?
 *
 * **Oder, nicht und.** Wer «JAE» und «AE» wählt, will beide Listen sehen und
 * nicht die leere Schnittmenge – so wie bei den Jahrzahlen der Sitzungsliste.
 * Nichts gewählt heisst «alle»; dann wird gar nicht erst gerechnet.
 */
export function matchesOrganizations(
  member: Member,
  wanted: MemberOrganization[] | undefined,
  now = new Date(),
  jaeImportedAt?: Date | null,
): boolean {
  if (!wanted || wanted.length === 0) return true
  const found = organizationsOf(member, now, jaeImportedAt)
  return wanted.some((organization) => found.includes(organization))
}

/* ------------------------------------------------------------------ */
/* Das Schlagwort                                                      */
/* ------------------------------------------------------------------ */

/** Alle Schlagwörter, die eine Organisation bezeichnen. */
const ORGANIZATION_TAGS: string[] = Object.values(MEMBER_ORGANIZATION_TAGS)

/**
 * Ist das ein Schlagwort, das eine Organisation bezeichnet?
 *
 * Gebraucht dort, wo diese Schlagwörter anders aussehen sollen als die frei
 * vergebenen: Sie kommen aus einer Liste und stehen für eine Zugehörigkeit,
 * nicht für eine Notiz.
 */
export function isOrganizationTag(tag: string): boolean {
  return ORGANIZATION_TAGS.includes(tag)
}

/**
 * Ein Schlagwort setzen oder wegnehmen – ohne die übrigen anzurühren.
 *
 * Die Reihenfolge bleibt, wie sie war, und ein bereits vorhandenes
 * Schlagwort wird nicht ein zweites Mal angehängt. Beides ist wichtiger, als
 * es klingt: Daneben stehen die frei vergebenen Schlagwörter, und ein Import,
 * der sie umsortiert oder verdoppelt, machte sie mit der Zeit unlesbar.
 */
export function withTag(tags: string[] | undefined, tag: string, present: boolean): string[] {
  const current = tags ?? []
  if (present) return current.includes(tag) ? current : [...current, tag]
  return current.filter((entry) => entry !== tag)
}

// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import type { AgendaItem, MonthlyDuty } from './types.ts'

/**
 * Die Aufgaben, die zur Leitung eines Monats gehören.
 *
 * Die Bischofschaft teilt die Monate unter sich auf: Einer nimmt den August,
 * der nächste den September. Wer den Monat führt, hat für diesen Monat immer
 * dieselben Dinge zu tun – und im nächsten Monat hat sie ein anderer.
 *
 * Hier steht die ganze Rechnung dazu, und zwar ohne Firestore, ohne React und
 * ohne `Date`-Arithmetik, die über Zeitzonen stolpern könnte: Gerechnet wird
 * auf dem Text «yyyy-MM», wie ihn die App als Schlüssel eines Monats
 * verwendet. Geschrieben wird in `services/monthlyDuties`, geprüft in
 * `tests/monthly-duties.test.ts`.
 *
 * Drei Fragen, mehr ist es nicht:
 *
 * 1. **Wer führt diesen Monat?** – `monthLeaders()`, aus den Zuständigkeiten
 *    der Sonntage. Eine zweite Liste dafür gibt es bewusst nicht: Die Angabe
 *    steht bereits unter «Abendmahl → Leitung → Zuständig» und wird dort
 *    ohnehin monatsweise gesetzt (Haken «Für den ganzen Monat»).
 * 2. **Fällt diese Aufgabe in diesem Monat an?** – `dutyAppliesTo()`.
 * 3. **Wem gehört die Pendenz, wenn die Leitung wechselt?** –
 *    `dutyAssignees()`.
 */

/* ------------------------------------------------------------------ */
/* Monate                                                              */
/* ------------------------------------------------------------------ */

const MONTH_PATTERN = /^\d{4}-\d{2}$/

/** Sieht das aus wie ein Monat («2026-08»)? */
export function isMonthKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/**
 * Der Monat, zu dem ein Tag gehört – «2026-08».
 *
 * Aus einem `Date` wird die **lokale** Zeit gelesen und nicht die von
 * Greenwich: Der 1. August um 00:30 Uhr ist hierzulande der August, in UTC
 * aber noch der Juli. Ein Datumsschlüssel («2026-08-09») trägt den Monat
 * bereits in sich und wird nur vorne abgeschnitten.
 */
export function monthKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 7)
  const month = value.getMonth() + 1
  return `${value.getFullYear()}-${month < 10 ? '0' : ''}${month}`
}

/** Der Monat davor – über den Jahreswechsel hinweg. */
export function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4))
  const index = Number(month.slice(5, 7))
  return index === 1 ? `${year - 1}-12` : `${year}-${index < 10 ? '0' : ''}${index - 1}`
}

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/**
 * «2026-08» als «August 2026».
 *
 * Von Hand und nicht über `formatMonth()` aus `lib/dates`: Dort geht ein
 * Datum hinein, und `new Date('2026-08')` liest Firefox als Mitternacht in
 * Greenwich – womit der August westlich davon zum Juli würde. Aus zwei
 * Zahlen einen Monatsnamen zu machen ist die kürzere und die sichere Rechnung.
 */
export function formatMonthKey(month: string): string {
  if (!isMonthKey(month)) return month
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

/* ------------------------------------------------------------------ */
/* Wer führt den Monat?                                                */
/* ------------------------------------------------------------------ */

/**
 * Welche Person welchen Monat führt – aus den Zuständigkeiten der Sonntage.
 *
 * Die Dokument-ID eines Sonntagsprogramms ist sein Datum («2026-08-09»),
 * daraus ergibt sich der Monat. Üblicherweise trägt jeder Sonntag eines
 * Monats dieselbe Person – der Dialog schreibt sie auf Wunsch gleich auf
 * alle (siehe `services/sacrament`). Weicht ein einzelner Sonntag ab, weil
 * jemand in den Ferien war, gilt für den Monat trotzdem die Person, die die
 * **meisten** Sonntage hält: Ein Vertretungssonntag macht niemanden zum
 * Monatsverantwortlichen. Bei Gleichstand entscheidet der frühere Sonntag –
 * eine Regel, die nicht davon abhängt, in welcher Reihenfolge die Daten
 * hereinkommen.
 *
 * Monate ohne jede Angabe fehlen in der Karte. Das ist keine Lücke, die zu
 * füllen wäre: Solange niemand eingetragen ist, gehört die Arbeit des Monats
 * niemandem, und die Pendenz wartet ohne Zuständigen.
 */
export function monthLeaders(
  sundays: { id: string; responsibleId?: string | null }[],
): Map<string, string> {
  /** Je Monat: wer wie viele Sonntage hält – und ab welchem. */
  const tally = new Map<string, Map<string, { sundays: number; from: string }>>()

  for (const sunday of sundays) {
    const leader = sunday.responsibleId
    if (!leader) continue
    const month = monthKey(sunday.id)
    if (!isMonthKey(month)) continue

    let perMonth = tally.get(month)
    if (!perMonth) {
      perMonth = new Map()
      tally.set(month, perMonth)
    }

    const seen = perMonth.get(leader)
    if (seen) {
      seen.sundays += 1
      if (sunday.id < seen.from) seen.from = sunday.id
    } else {
      perMonth.set(leader, { sundays: 1, from: sunday.id })
    }
  }

  const leaders = new Map<string, string>()
  for (const [month, perMonth] of tally) {
    let best: { id: string; sundays: number; from: string } | null = null
    for (const [id, seen] of perMonth) {
      const better =
        !best ||
        seen.sundays > best.sundays ||
        (seen.sundays === best.sundays && seen.from < best.from)
      if (better) best = { id, ...seen }
    }
    if (best) leaders.set(month, best.id)
  }
  return leaders
}

/* ------------------------------------------------------------------ */
/* Fällt die Aufgabe an?                                               */
/* ------------------------------------------------------------------ */

/** Gilt diese Aufgabe in diesem Monat? */
export function dutyAppliesTo(
  duty: Pick<MonthlyDuty, 'startMonth' | 'endMonth'>,
  month: string,
): boolean {
  if (!isMonthKey(month) || !isMonthKey(duty.startMonth)) return false
  if (month < duty.startMonth) return false
  if (duty.endMonth && month > duty.endMonth) return false
  return true
}

/** Läuft diese Aufgabe noch – oder ist sie beendet? */
export function dutyIsRunning(duty: Pick<MonthlyDuty, 'endMonth'>, currentMonth: string): boolean {
  return !duty.endMonth || duty.endMonth >= currentMonth
}

/**
 * Die Dokument-ID der Pendenz, die aus einer Aufgabe für einen Monat entsteht.
 *
 * Sie wird gerechnet und nicht gewürfelt, und das ist der ganze Schutz gegen
 * Doppelte: Öffnen zwei Personen die App am selben Morgen, schreiben beide
 * dasselbe Dokument statt zweier gleichlautender Pendenzen. Firestore-IDs
 * dürfen keinen Schrägstrich enthalten – der Bindestrich dazwischen ist
 * unbedenklich.
 */
export function dutyItemId(dutyId: string, month: string): string {
  return `${dutyId}-${month}`
}

/** Ist dieser Eintrag aus einer Monatspendenz entstanden? */
export function isDutyItem(item: Pick<AgendaItem, 'dutyId'>): boolean {
  return Boolean(item.dutyId)
}

/* ------------------------------------------------------------------ */
/* Wem gehört sie?                                                     */
/* ------------------------------------------------------------------ */

/**
 * Die Zuständigen einer Monatspendenz, wenn die Leitung wechselt.
 *
 * Getauscht wird genau eine Person: Die bisherige Leitung tritt ab, die neue
 * tritt an ihre Stelle. Wer von Hand dazugeschrieben wurde – «ich helfe mit» –
 * bleibt stehen; die Liste ganz zu ersetzen nähme ihn wieder weg, und zwar
 * ohne dass jemand es merkte.
 *
 * Ohne neue Leitung (im Monat ist niemand eingetragen) bleibt die Pendenz bei
 * dem, der sie hatte: Eine Aufgabe verliert ihren Zuständigen nicht, bloss
 * weil in der Planung eine Lücke entstanden ist.
 */
export function dutyAssignees(
  current: string[] | undefined,
  previousLeader: string | null | undefined,
  nextLeader: string | null | undefined,
): string[] {
  const assignees = current ?? []
  if (!nextLeader) return assignees
  const others = assignees.filter((id) => id !== previousLeader && id !== nextLeader)
  return [nextLeader, ...others]
}

/* ------------------------------------------------------------------ */
/* Was zu tun ist                                                      */
/* ------------------------------------------------------------------ */

/**
 * Was an einer Monatspendenz fehlt: anlegen oder umschreiben.
 *
 * `create` – für diesen Monat steht noch keine Pendenz da.
 * `reassign` – sie steht da, aber der Monat wird inzwischen von jemand
 * anderem geführt.
 */
export type DutyAction =
  | { kind: 'create'; duty: MonthlyDuty; month: string; leader: string | null }
  | { kind: 'reassign'; itemId: string; leader: string; assignees: string[] }

/**
 * Der Abgleich zwischen den Vorlagen und dem, was schon dasteht.
 *
 * Er läuft bei jedem Start der App und gerade oft genug: für **einen** Monat,
 * den laufenden. Ein Blick zurück wäre falsch – ein Monat, in dem niemand die
 * App geöffnet hat, ist vorbei, und eine Pendenz nachträglich anzulegen hiesse,
 * jemandem Arbeit für den letzten August in die Liste zu legen. Ein Blick
 * voraus wäre es ebenso: Wer im August die Liste öffnet, will den August sehen
 * und nicht schon den September.
 *
 * Erledigte Pendenzen werden nicht mehr angefasst. Wer den Monat geführt und
 * die Aufgabe abgehakt hat, bleibt der, der sie erledigt hat – auch wenn die
 * Leitung danach noch wechselt.
 */
export function pendingDutyActions(
  duties: MonthlyDuty[],
  items: Pick<AgendaItem, 'id' | 'dutyId' | 'dutyLeaderId' | 'assignees' | 'status'>[],
  leaders: Map<string, string>,
  month: string,
): DutyAction[] {
  if (!isMonthKey(month)) return []

  const byId = new Map(items.map((item) => [item.id, item]))
  const leader = leaders.get(month) ?? null

  const actions: DutyAction[] = []
  for (const duty of duties) {
    if (!dutyAppliesTo(duty, month)) continue

    const existing = byId.get(dutyItemId(duty.id, month))
    if (!existing) {
      actions.push({ kind: 'create', duty, month, leader })
      continue
    }

    if (!leader) continue
    if (existing.status === 'done') continue
    if (existing.dutyLeaderId === leader) continue

    actions.push({
      kind: 'reassign',
      itemId: existing.id,
      leader,
      assignees: dutyAssignees(existing.assignees, existing.dutyLeaderId, leader),
    })
  }
  return actions
}

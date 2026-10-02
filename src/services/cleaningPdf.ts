// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { tablePdf, type PdfCell } from '../lib/pdf.ts'
import { qrCode } from '../lib/qr.ts'
import { sundayProgram, type StoredSunday } from '../lib/sunday.ts'
import type { CleaningWeek } from '../lib/types.ts'

/**
 * Der Putzplan als PDF zum Ausdrucken.
 *
 * Bewusst schlicht: je Woche eine Zeile mit der Kalenderwoche, den Tagen,
 * wer an der Reihe ist, und der Gruppe. Bemerkungen und alles Übrige bleiben
 * in der App – der Ausdruck hängt am Anschlagbrett und soll sich im
 * Vorbeigehen lesen lassen. Mit einer Ausnahme: Ist eine Gruppe zwei Wochen
 * hintereinander dran, steht der Grund dahinter, «(Generalkonferenz)» –
 * sonst sähe es nach einem Fehler im Plan aus (siehe `repeatReasons`).
 *
 * Bewusst frei von Firestore und React, damit sich die Aufbereitung mit
 * `node --test` prüfen lässt.
 */

type Week = Pick<CleaningWeek, 'startDate' | 'endDate' | 'group' | 'team' | 'note'>

/** Ein erfasster Sonntag – die Dokument-ID ist sein Datum, «2026-11-15». */
export type CleaningSunday = StoredSunday & { id: string }

/**
 * Die Seite des Putzplans – für alle dieselbe Adresse (siehe `App.tsx`).
 *
 * Fest die Adresse der App und nicht die, unter der das PDF gerade entsteht:
 * Ein Ausdruck aus der Vorschau eines Entwurfs hängt sonst monatelang mit
 * einem QR-Code am Brett, der ins Leere führt.
 */
export const CLEANING_PLAN_URL = 'https://bss.alae.app/putzplan'

/** Die Adresse, wie sie unter dem QR-Code steht – ohne «https://». */
export const CLEANING_PLAN_LABEL = CLEANING_PLAN_URL.replace(/^https:\/\//, '')

const MONTHS = [
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
 * Die Kalenderwoche nach ISO 8601 – so zählt man sie hierzulande.
 *
 * Gerechnet wird über den Donnerstag derselben Woche: Er entscheidet nach
 * ISO, zu welchem Jahr eine Woche gehört.
 */
export function isoWeek(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, date))
  const weekday = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(value.getUTCFullYear(), 0, 1)
  return Math.ceil(((value.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/**
 * Die Kalenderwoche einer Putzwoche.
 *
 * Die Wochen des Plans laufen mal von Montag, mal von Sonntag bis Samstag
 * (siehe README, «Putzplan»). Ein Sonntag gehört nach ISO noch zur Woche
 * davor – gezählt wird deshalb die Mitte der Putzwoche: Sie liegt in beiden
 * Fällen in der Kalenderwoche ihrer Werktage.
 */
export function cleaningWeekNumber(week: Pick<Week, 'startDate' | 'endDate'>): number {
  const day = (key: string) => {
    const [year, month, date] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, date)
  }
  const start = day(week.startDate)
  const days = Math.max(0, Math.round((day(week.endDate) - start) / 86_400_000))
  const middle = new Date(start + Math.floor(days / 2) * 86_400_000)
  return isoWeek(middle.toISOString().slice(0, 10))
}

/** «05.10. – 10.10.2026» – wie in der Liste der App. */
export function cleaningPeriod(week: Pick<Week, 'startDate' | 'endDate'>): string {
  const [, startMonth, startDay] = week.startDate.split('-')
  const [endYear, endMonth, endDay] = week.endDate.split('-')
  return `${startDay}.${startMonth}. – ${endDay}.${endMonth}.${endYear}`
}

/** «Gruppe 2» → «2». Was keine Nummer trägt, bleibt, wie es ist. */
export function groupNumber(group: string): string {
  const match = group.match(/\d+/)
  return match ? match[0] : group.trim()
}

/** «5. Oktober 2026» */
function longDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${date}. ${MONTHS[month - 1]} ${year}`
}

/** «02.10.2026» */
function shortDate(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

/**
 * Die Wochen, die in den Zeitraum fallen – der Reihe nach.
 *
 * Dazu zählt jede Woche, die ihn berührt: Wer ab Mittwoch druckt, will die
 * laufende Woche noch auf dem Blatt haben.
 */
export function weeksInRange<T extends Week>(weeks: T[], from: string, to: string): T[] {
  return weeks
    .filter((week) => week.startDate <= to && week.endDate >= from)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/* ------------------------------------------------------------------ */
/* Zweimal hintereinander                                              */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000

function dayValue(key: string): number {
  const [year, month, date] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

/** Ist es dieselbe Gruppe? Verglichen wird die Nummer – ohne Nummer das Team. */
function sameTurn(before: Week, week: Week): boolean {
  const turn = (entry: Week) =>
    (groupNumber(entry.group) || entry.team).trim().toLocaleLowerCase('de-CH')
  return turn(before) !== '' && turn(before) === turn(week)
}

/**
 * Die Sonntage zwischen zwei Wochen, die aneinanderstossen – vom letzten Tag
 * der einen bis zum ersten der anderen.
 *
 * Läuft der Plan von Sonntag bis Samstag, ist es der erste Tag der zweiten
 * Woche; läuft er von Montag bis Samstag, der Tag dazwischen. Beginnt die
 * zweite Woche später als zwei Tage nach dem Ende der ersten, stossen sie
 * nicht aneinander – dann gibt `null` an, dass die beiden nicht als
 * «hintereinander» zählen, auch wenn sie in der Liste aufeinanderfolgen.
 */
function sundaysBetween(before: Week, week: Week): string[] | null {
  const from = dayValue(before.endDate)
  const to = dayValue(week.startDate)
  if (to - from > 2 * DAY || to < from) return null
  const sundays: string[] = []
  for (let day = from; day <= to; day += DAY) {
    if (new Date(day).getUTCDay() === 0) sundays.push(new Date(day).toISOString().slice(0, 10))
  }
  return sundays
}

/**
 * Eine Bemerkung aus der Tabelle, ausgeschrieben: Die Tabelle kürzt ab
 * («Generalkonf.», «Pfahlkonf.»), das Blatt am Anschlagbrett nicht.
 */
export function spellOutNote(note: string | null | undefined): string {
  return (note ?? '')
    .trim()
    .replace(/^\((.*)\)$/s, '$1')
    .replace(/(k)onf(?:\.|(?!\p{L}))/giu, (_, k: string) => `${k}onferenz`)
    .trim()
}

/**
 * Warum eine Gruppe ein zweites Mal hintereinander an der Reihe ist – je
 * Woche, die eine andere wiederholt, unter ihrem ersten Tag.
 *
 * Meist, weil an einem Sonntag dazwischen in der Gemeinde keine Versammlung
 * ist: Dann wird das Gemeindehaus kaum gebraucht, und dieselbe Gruppe putzt
 * eine Woche länger. Der Grund kommt deshalb zuerst aus dem Programm dieses
 * Sonntags – wie es unter «Abendmahl» steht oder sich aus der Regel ergibt
 * (`lib/sunday`): Die Generalkonferenz erkennt der Plan von selbst, eine
 * Pfahlkonferenz, sobald sie dort eingetragen ist.
 *
 * Findet sich dort nichts, gilt die Bemerkung aus der Tabelle – zuerst die
 * der wiederholten Woche, dann die der Woche davor; die Gemeinde schreibt
 * ihr «Generalkonf.» meist neben die erste der beiden. Ohne beides bleibt die
 * Woche ohne Grund, und auf dem Blatt steht nur, wer dran ist.
 *
 * Verglichen wird der ganze Plan, nicht bloss der gedruckte Zeitraum: Beginnt
 * der Ausdruck mit der zweiten Woche eines Paares, trägt auch sie ihren Grund.
 */
export function repeatReasons(
  plan: readonly Week[],
  sundays: readonly CleaningSunday[] = [],
): Map<string, string> {
  const sorted = [...plan].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const stored = new Map(sundays.map((sunday) => [sunday.id, sunday]))
  const reasons = new Map<string, string>()

  sorted.forEach((week, index) => {
    const before = sorted[index - 1]
    if (!before || !sameTurn(before, week)) return
    const between = sundaysBetween(before, week)
    if (!between) return

    const labels = new Set<string>()
    for (const key of between) {
      const [year, month, date] = key.split('-').map(Number)
      const program = sundayProgram(new Date(year, month - 1, date), stored.get(key) ?? null)
      if (!program.meets) labels.add(program.label)
    }
    const reason = [...labels].join(', ') || spellOutNote(week.note) || spellOutNote(before.note)
    if (reason) reasons.set(week.startDate, reason)
  })

  return reasons
}

/**
 * Je Woche eine Zeile: Woche, Datum, wer an der Reihe ist, Gruppe.
 *
 * Wiederholt eine Woche die vorige, steht der Grund grau in Klammern hinter
 * den Namen (`reasons`, siehe `repeatReasons`).
 */
export function cleaningRows(
  weeks: Week[],
  reasons: ReadonlyMap<string, string> = new Map(),
): PdfCell[][] {
  return weeks.map((week) => {
    const team = week.team.trim() || '–'
    const reason = reasons.get(week.startDate)
    return [
      String(cleaningWeekNumber(week)),
      cleaningPeriod(week),
      reason ? { text: team, aside: `(${reason})` } : team,
      groupNumber(week.group) || '–',
    ]
  })
}

/** «Putzplan_2026-10-05_bis_2027-03-27.pdf» – sortiert sich im Download-Ordner von selbst. */
export function cleaningPdfFilename(from: string, to: string): string {
  return `Putzplan_${from}_bis_${to}.pdf`
}

export interface CleaningPdfOptions {
  /** Der ganze Plan – ausgewählt wird hier */
  weeks: Week[]
  /** «2026-10-05» */
  from: string
  /** «2027-03-27» */
  to: string
  /** Aus den Einstellungen – erscheint über der Tabelle, sofern gesetzt */
  wardName?: string
  /** Heute als «2026-10-02» – für den Stand unten links */
  today: string
  createdAt?: Date
  /** Die erfassten Sonntage – woher «Pfahlkonferenz» kommt (siehe `repeatReasons`) */
  sundays?: readonly CleaningSunday[]
  /** Unten auf jeder Seite die Adresse des Plans samt QR-Code */
  withLink?: boolean
}

/**
 * Das PDF – oder `null`, wenn im Zeitraum keine Woche liegt.
 *
 * Über der Tabelle steht nur der Name der Gemeinde. Der Zeitraum steht in
 * der Tabelle selbst, ein zweites Mal darüber wäre er bloss im Weg; in den
 * Eigenschaften der Datei steht er trotzdem, dort hilft er beim Wiederfinden.
 */
export function cleaningPdf(options: CleaningPdfOptions): Uint8Array | null {
  const weeks = weeksInRange(options.weeks, options.from, options.to)
  if (weeks.length === 0) return null

  const first = weeks[0].startDate
  const last = weeks.reduce(
    (latest, week) => (week.endDate > latest ? week.endDate : latest),
    first,
  )
  const range = `${longDate(first)} – ${longDate(last)}`
  // «Gemeinde» ist die Voreinstellung und sagt auf dem Blatt nichts.
  const ward = options.wardName?.trim()

  return tablePdf({
    title: 'Putzplan',
    subtitle: ward && ward !== 'Gemeinde' ? ward : undefined,
    documentTitle: `Putzplan ${range}`,
    // «An der Reihe» so breit, dass auch der längste Name der Gemeinde samt
    // «(Generalkonferenz)» auf eine Zeile passt.
    columns: [
      { label: 'Woche', width: 1, align: 'center' },
      { label: 'Datum', width: 2.4 },
      { label: 'An der Reihe', width: 5.5 },
      { label: 'Gruppe', width: 1.1, align: 'center' },
    ],
    rows: cleaningRows(weeks, repeatReasons(options.weeks, options.sundays)),
    footer: `Stand: ${shortDate(options.today)}`,
    link: options.withLink
      ? {
          caption: 'Immer aktuell unter',
          label: CLEANING_PLAN_LABEL,
          qr: qrCode(CLEANING_PLAN_URL),
        }
      : undefined,
    createdAt: options.createdAt,
  })
}

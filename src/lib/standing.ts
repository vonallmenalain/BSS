// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import {
  STANDING_UNIT_LABELS,
  STANDING_UNIT_PLURAL,
  toItemKind,
  type AgendaItem,
  type MeetingSection,
  type StandingRule,
  type StandingUndo,
  type StandingUnit,
} from './types.ts'

/**
 * Ständige Pendenzen – was wiederkehrt, statt abgeschlossen zu werden.
 *
 * Hier steht die ganze Rechnung dazu, und zwar ohne Firestore, ohne React und
 * ohne `Date`-Arithmetik, die über Zeitzonen stolpern könnte: Gerechnet wird
 * auf dem Text «yyyy-MM-dd», wie ihn die App als Schlüssel eines Tages
 * verwendet. Geschrieben wird in `services/agenda`, geprüft in
 * `tests/standing.test.ts`.
 *
 * Zwei Fragen, mehr ist es nicht:
 *
 * 1. **Wann ist sie das nächste Mal dran?** – `nextStandingRound()`, im
 *    Augenblick des Abhakens. Heraus kommt ein Tag, ab dem sie wieder fällig
 *    ist, und die Sitzung, in der sie damit steht.
 * 2. **Wartet sie gerade?** – `standingWaits()`. Eine Pendenz, deren nächste
 *    Runde erst im Oktober beginnt, gehört im September nirgendwohin: nicht
 *    in den Sammelkorb, nicht in eine Sitzung, nicht in die Zahl der offenen
 *    Punkte auf der Übersicht.
 *
 * Der Unterschied zur Monatspendenz (`lib/monthlyDuties`) steht bei
 * `StandingRule`: Dort entsteht Monat für Monat ein neuer Eintrag aus einer
 * Vorlage, weil die Person wechselt. Hier bleibt es derselbe Eintrag.
 */

/* ------------------------------------------------------------------ */
/* Tage                                                                */
/* ------------------------------------------------------------------ */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Sieht das aus wie ein Tag («2026-08-04»)? */
export function isDayKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && DAY_PATTERN.test(value)
}

/**
 * Der Tag, an dem etwas liegt – «2026-08-04».
 *
 * Aus einem `Date` wird die **lokale** Zeit gelesen und nicht die von
 * Greenwich: Eine Sitzung am 4. August um 20:00 Uhr ist hierzulande der
 * 4. August, in UTC aber schon der 5. Aus demselben Grund rechnet alles
 * Weitere unten mit der Mittagsstunde – so kippt eine Zeitumstellung den Tag
 * nicht.
 */
export function dayKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  const month = value.getMonth() + 1
  const day = value.getDate()
  return `${value.getFullYear()}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`
}

/**
 * «2026-08-04» als «04.08.2026».
 *
 * Von Hand und nicht über `formatDate()` aus `lib/dates`: Dort geht ein Datum
 * hinein, und `new Date('2026-08-04')` liest jeder Browser als Mitternacht in
 * Greenwich – womit der 4. August westlich davon zum 3. würde. Drei Zahlen
 * umzustellen ist die kürzere und die sichere Rechnung.
 */
export function formatDayKey(key: string): string {
  if (!isDayKey(key)) return key
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`
}

function parts(key: string): [number, number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10))]
}

/** Tage dazuzählen – über Monats- und Jahresgrenzen hinweg. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = parts(key)
  const date = new Date(year, month - 1, day, 12)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

/**
 * Monate dazuzählen.
 *
 * Der 31. Januar plus einen Monat ist der 28. Februar und nicht der 3. März:
 * Wer eine Pendenz am Monatsletzten abhakt, meint den nächsten Monatsletzten
 * und nicht einen Tag im übernächsten Monat.
 */
export function addMonths(key: string, months: number): string {
  const [year, month, day] = parts(key)
  // Der Nullte des Folgemonats ist dessen Vortag – der letzte Tag des Ziels.
  const lastDay = new Date(year, month + months, 0, 12).getDate()
  return dayKey(new Date(year, month - 1 + months, Math.min(day, lastDay), 12))
}

/* ------------------------------------------------------------------ */
/* Der Takt                                                            */
/* ------------------------------------------------------------------ */

const UNITS: StandingUnit[] = ['meeting', 'day', 'week', 'month']

/**
 * Wie viele Sitzungen sich eine ständige Pendenz merkt, in denen sie
 * abgehakt wurde.
 *
 * Jede Sitzung eines Jahres und noch etwas mehr – genug, damit auch ältere
 * Protokolle sie als erledigt zeigen, und wenig genug, dass der Eintrag über
 * die Jahre nicht anwächst.
 */
export const STANDING_DONE_KEPT = 60

/** Der Takt, mit dem eine neue ständige Pendenz beginnt: jede Sitzung. */
export const DEFAULT_STANDING: StandingRule = { every: 1, unit: 'meeting' }

/**
 * Was in Firestore steht, auf einen brauchbaren Takt zurückführen.
 *
 * Alles, was nicht danach aussieht, gilt als «keine ständige Pendenz» – ein
 * halb geschriebenes Feld darf keine Pendenz erzeugen, die niemand mehr
 * abschliessen kann. `every` wird auf ganze Zahlen ab 1 gezogen; bei «jede
 * Sitzung» ist es immer 1 (siehe `StandingUnit`).
 */
export function normalizeStanding(value: unknown): StandingRule | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<StandingRule>
  const unit = UNITS.includes(raw.unit as StandingUnit) ? (raw.unit as StandingUnit) : null
  if (!unit) return null

  // Die Einheit trägt die Aussage; eine unbrauchbare Zahl daneben ist eine 1
  // und kein Grund, den ganzen Takt zu verwerfen.
  const counted = Math.round(Number(raw.every))
  const every =
    unit === 'meeting' || !Number.isFinite(counted) ? 1 : Math.max(1, Math.min(99, counted))

  const rule: StandingRule = { every, unit }
  if (isDayKey(raw.dueFrom)) rule.dueFrom = raw.dueFrom
  if (typeof raw.doneCount === 'number' && raw.doneCount > 0) {
    rule.doneCount = Math.round(raw.doneCount)
  }
  if (typeof raw.lastDoneAt === 'string' && raw.lastDoneAt) rule.lastDoneAt = raw.lastDoneAt
  if (Array.isArray(raw.doneIn)) {
    const doneIn = raw.doneIn.filter((id): id is string => typeof id === 'string' && id !== '')
    if (doneIn.length > 0) rule.doneIn = doneIn.slice(-STANDING_DONE_KEPT)
  }
  const undo = normalizeUndo(raw.undo)
  if (undo) rule.undo = undo
  return rule
}

/** Der Stand vor der letzten Runde – oder `null`, wenn er nicht brauchbar ist. */
function normalizeUndo(value: unknown): StandingUndo | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<StandingUndo>
  if (typeof raw.meetingId !== 'string' || !raw.meetingId) return null
  return {
    meetingId: raw.meetingId,
    dueFrom: isDayKey(raw.dueFrom) ? raw.dueFrom : null,
    lastDoneAt: typeof raw.lastDoneAt === 'string' && raw.lastDoneAt ? raw.lastDoneAt : null,
  }
}

/**
 * Der Takt, wie er in Firestore steht – alle Felder ausgeschrieben.
 *
 * Ausgeschrieben und nicht weggelassen, weil ein fehlendes Feld sich beim
 * Zusammenführen anders verhält als ein leeres: `undefined` weist Firestore
 * zurück, und ein Takt, an dem `dueFrom` fehlt statt `null` zu sein, liesse
 * ein altes Datum stehen, das längst nicht mehr gilt.
 */
export function serializeStanding(rule: StandingRule): StandingRule {
  return {
    every: rule.unit === 'meeting' ? 1 : Math.max(1, Math.min(99, Math.round(rule.every))),
    unit: rule.unit,
    dueFrom: rule.dueFrom ?? null,
    doneCount: rule.doneCount ?? 0,
    lastDoneAt: rule.lastDoneAt ?? null,
    doneIn: (rule.doneIn ?? []).slice(-STANDING_DONE_KEPT),
    undo: rule.undo ?? null,
  }
}

/** Ist das eine ständige Pendenz? */
export function isStanding(item: Pick<AgendaItem, 'standing'>): boolean {
  return normalizeStanding(item.standing) !== null
}

/**
 * Der Takt als Satzteil – «jede Sitzung», «alle 3 Wochen».
 *
 * Einzahl und Mehrzahl auseinanderzuhalten lohnt sich: «alle 1 Monat» steht
 * in keiner Liste gut, und die Zahl 1 sagt ohnehin nichts, was das Wort nicht
 * schon sagt.
 */
export function standingLabel(rule: StandingRule): string {
  const single = rule.unit === 'month' ? 'jeden' : 'jede'
  if (rule.every <= 1) return `${single} ${STANDING_UNIT_LABELS[rule.unit]}`
  return `alle ${rule.every} ${STANDING_UNIT_PLURAL[rule.unit]}`
}

/** Dasselbe gross geschrieben – für Etiketten und Überschriften. */
export function standingTitle(rule: StandingRule): string {
  const label = standingLabel(rule)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/* ------------------------------------------------------------------ */
/* Wartet sie gerade?                                                  */
/* ------------------------------------------------------------------ */

/**
 * Wartet diese Pendenz noch auf ihre nächste Runde?
 *
 * Eine ständige Pendenz, die eben abgehakt und auf den Oktober gesetzt wurde,
 * ist offen – erledigt wird sie ja nie. Sie ist aber nicht **dran**, und
 * genau das ist hier die Frage: Sie gehört so lange in keine Sitzung, in
 * keinen Sammelkorb und in keine Zahl offener Punkte.
 */
export function standingWaits(item: Pick<AgendaItem, 'standing'>, today: string): boolean {
  const rule = normalizeStanding(item.standing)
  if (!rule || !rule.dueFrom) return false
  return rule.dueFrom > today
}

/* ------------------------------------------------------------------ */
/* Wann ist sie das nächste Mal dran?                                  */
/* ------------------------------------------------------------------ */

/** Eine Sitzung, wie die Rechnung sie braucht: eine ID und ein Tag. */
export interface StandingMeeting {
  id: string
  /** «2026-08-04» */
  date: string
}

/** Die nächste Runde – ab wann sie gilt und wo die Pendenz damit steht. */
export interface StandingRound {
  /** Frühestens ab diesem Tag wieder fällig; `null` heisst: sofort. */
  dueFrom: string | null
  /** Die Sitzung, in der sie damit steht; `null` heisst: im Sammelkorb. */
  meetingId: string | null
}

/**
 * Wohin eine ständige Pendenz beim Abhaken wandert.
 *
 * **Jede Sitzung** ist die einfache Hälfte: die nächste geplante Sitzung nach
 * der, in der eben abgehakt wurde. Ist keine geplant, wartet die Pendenz ohne
 * Datum im Sammelkorb – sie kommt mit der nächsten Sitzung mit, wann immer
 * sie angesetzt wird. Ein gerechnetes Datum wäre hier falsch: Es hielte die
 * Pendenz von einer Sitzung fern, die früher stattfindet als vermutet.
 *
 * **Ein Zeitraum** wird gerechnet, und zwar ab heute und nicht ab dem Tag der
 * Sitzung: Wer eine monatliche Pendenz in der Sitzung von vorletzter Woche
 * abhakt, hat sie heute erledigt, und der nächste Monat beginnt heute. Nur
 * eine Sitzung, die noch bevorsteht, zählt als Bezugspunkt – dort wird
 * vorgearbeitet, und der Takt soll an ihr hängen.
 *
 * Danach wird die erste Sitzung gesucht, die an oder nach diesem Tag
 * stattfindet. Findet sich keine, wartet die Pendenz mit ihrem Datum im
 * Sammelkorb, bis eine Sitzung geplant wird, die spät genug liegt (siehe
 * `standingWaits`).
 */
export function nextStandingRound(
  rule: StandingRule,
  options: {
    /** Die Sitzung, in der abgehakt wurde – `null`, wenn in keiner. */
    fromMeetingId?: string | null
    /** Die noch offenen Sitzungen; Reihenfolge egal, sortiert wird hier. */
    meetings: StandingMeeting[]
    /** Heute – «2026-08-04». */
    today: string
  },
): StandingRound {
  const { fromMeetingId = null, meetings, today } = options

  const sorted = [...meetings].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
  const index = fromMeetingId ? sorted.findIndex((meeting) => meeting.id === fromMeetingId) : -1
  const from = index >= 0 ? sorted[index] : null

  /*
   * Was danach kommt.
   *
   * Steht die Sitzung, in der abgehakt wurde, in der Liste, zählt ihre Stelle
   * darin und nicht ihr Datum – zwei Sitzungen am selben Tag wären sonst
   * nicht auseinanderzuhalten. Sonst gilt: alles ab heute.
   */
  const later =
    index >= 0 ? sorted.slice(index + 1) : sorted.filter((meeting) => meeting.date >= today)

  if (rule.unit === 'meeting') {
    const next = later[0]
    return next ? { dueFrom: next.date, meetingId: next.id } : { dueFrom: null, meetingId: null }
  }

  const base = from && from.date > today ? from.date : today
  const dueFrom =
    rule.unit === 'month'
      ? addMonths(base, rule.every)
      : addDays(base, rule.every * (rule.unit === 'week' ? 7 : 1))

  const next = later.find((meeting) => meeting.date >= dueFrom)
  return { dueFrom, meetingId: next?.id ?? null }
}

/**
 * Der Takt nach einer abgeschlossenen Runde – gezählt und datiert.
 *
 * Der Zähler ist keine Statistik, sondern die einzige Spur, die eine ständige
 * Pendenz hinterlässt: Sie wird nie erledigt und steht deshalb nie im Archiv.
 * Ohne ihn wäre an ihr nicht abzulesen, ob sie seit einem halben Jahr läuft
 * oder erst gestern erfasst wurde.
 *
 * Wurde in einer Sitzung abgehakt (`meetingId`), merkt sich der Takt auch
 * diese – dort steht die Pendenz weiter mit dem grünen Haken (siehe
 * `itemsOfMeeting`) – und den Stand von davor, damit sich der Haken in
 * derselben Sitzung zurücknehmen lässt (`revertStanding`). Ohne Sitzung gibt
 * es keinen Ort, an den sie zurückkehren könnte; das Zurücknehmen entfällt.
 */
export function advanceStanding(
  rule: StandingRule,
  round: StandingRound,
  now: Date,
  meetingId: string | null = null,
): StandingRule {
  const next: StandingRule = {
    every: rule.every,
    unit: rule.unit,
    dueFrom: round.dueFrom,
    doneCount: (rule.doneCount ?? 0) + 1,
    lastDoneAt: now.toISOString(),
  }

  if (meetingId) {
    const earlier = (rule.doneIn ?? []).filter((id) => id !== meetingId)
    next.doneIn = [...earlier, meetingId].slice(-STANDING_DONE_KEPT)
    next.undo = { meetingId, dueFrom: rule.dueFrom ?? null, lastDoneAt: rule.lastDoneAt ?? null }
  } else if (rule.doneIn) {
    next.doneIn = rule.doneIn
  }
  return next
}

/**
 * Der Takt nach dem Zurücknehmen des letzten Hakens – oder `null`, wenn sich
 * in dieser Sitzung nichts zurücknehmen lässt.
 *
 * Zurücknehmen lässt sich nur die **letzte** Runde, und nur in der Sitzung,
 * in der sie abgehakt wurde: Wer am 1. Oktober abhakt und am 8. wieder, kann
 * am 8. zurücknehmen – der Haken vom 1. ist dann Geschichte.
 */
export function revertStanding(rule: StandingRule, meetingId: string): StandingRule | null {
  const doneIn = rule.doneIn ?? []
  if (rule.undo?.meetingId !== meetingId || doneIn.at(-1) !== meetingId) return null

  return {
    every: rule.every,
    unit: rule.unit,
    dueFrom: rule.undo.dueFrom,
    doneCount: Math.max(0, (rule.doneCount ?? 1) - 1),
    lastDoneAt: rule.undo.lastDoneAt,
    doneIn: doneIn.slice(0, -1),
    undo: null,
  }
}

/* ------------------------------------------------------------------ */
/* In der Sitzung erledigt                                             */
/* ------------------------------------------------------------------ */

/** Wurde in dieser Sitzung eine Runde abgehakt? */
export function standingDoneIn(item: Pick<AgendaItem, 'standing'>, meetingId: string): boolean {
  return normalizeStanding(item.standing)?.doneIn?.includes(meetingId) ?? false
}

/** Lässt sich der Haken in dieser Sitzung noch zurücknehmen? */
export function canUndoStanding(item: Pick<AgendaItem, 'standing'>, meetingId: string): boolean {
  const rule = normalizeStanding(item.standing)
  return rule !== null && revertStanding(rule, meetingId) !== null
}

/**
 * Die Pendenz, wie sie in einer Sitzung dasteht, in der sie abgehakt wurde:
 * erledigt.
 *
 * Steht sie dort nicht mehr als erledigt – weil der Haken eben
 * zurückgenommen wurde –, kommt sie unverändert zurück.
 */
export function asDoneIn<T extends AgendaItem>(item: T, meetingId: string): T {
  if (item.meetingId === meetingId || !standingDoneIn(item, meetingId)) return item
  return { ...item, status: 'done', doneInMeeting: meetingId }
}

/**
 * Die Einträge einer Sitzung – samt den ständigen Pendenzen, die in ihr
 * abgehakt wurden.
 *
 * Eine ständige Pendenz wandert beim Abhaken in die nächste Sitzung und ist
 * dort wieder offen. In der Sitzung, in der sie abgehakt wurde, soll sie
 * trotzdem stehen bleiben: mit dem grünen Haken, wie jede andere erledigte
 * Pendenz. Sonst verschwände sie mitten in der Sitzung aus der Liste, und
 * ob der Griff gewirkt hat, liesse sich nur noch in der nächsten nachsehen.
 */
export function itemsOfMeeting<T extends AgendaItem>(items: T[], meetingId: string): T[] {
  return items.flatMap((item) => {
    if (item.meetingId === meetingId) return [item]
    return standingDoneIn(item, meetingId) ? [asDoneIn(item, meetingId)] : []
  })
}

/** Dasselbe für viele Sitzungen auf einmal – je Sitzung ihre Einträge. */
export function itemsByMeeting<T extends AgendaItem>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  const add = (meetingId: string, item: T) => {
    const list = map.get(meetingId)
    if (list) list.push(item)
    else map.set(meetingId, [item])
  }

  for (const item of items) {
    if (item.meetingId) add(item.meetingId, item)
    for (const meetingId of normalizeStanding(item.standing)?.doneIn ?? []) {
      if (meetingId !== item.meetingId) add(meetingId, asDoneIn(item, meetingId))
    }
  }
  return map
}

/* ------------------------------------------------------------------ */
/* Die drei Abschnitte einer Sitzung                                   */
/* ------------------------------------------------------------------ */

/**
 * Worunter ein Eintrag in der Sitzung steht.
 *
 * Zuerst die ständigen Pendenzen – der feste Teil jeder Sitzung –, danach die
 * neuen Traktanden, zuletzt die übrigen Pendenzen. Die ständige Pendenz bleibt
 * dabei eine Pendenz (`toItemKind()` sagt weiterhin «pendenz»); sie steht
 * bloss an einer anderen Stelle der Liste.
 */
export function sectionOf(
  item: Pick<AgendaItem, 'standing' | 'kind' | 'meetingId' | 'firstMeetingId'>,
): MeetingSection {
  if (isStanding(item)) return 'standing'
  return toItemKind(item)
}

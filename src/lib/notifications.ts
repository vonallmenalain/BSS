import type {
  ApActivityKind,
  ApNotifyScope,
  NotificationMode,
  NotificationSchedule,
  NotificationSettings,
} from '@/lib/types'

/*
 * Die Rechenstube der Benachrichtigungen – ohne Firebase, ohne Browser.
 *
 * Alles hier ist reine Rechnerei über Zeit und Text, und das aus einem
 * Grund: Dieselben Funktionen laufen im Browser (die Einstellungen zeigen,
 * was sie bedeuten) und in der geplanten Netlify-Function (sie entscheidet,
 * wer jetzt an der Reihe ist). Wäre die Logik dort ein zweites Mal
 * geschrieben, liefen die beiden Fassungen früher oder später auseinander –
 * und niemand merkte es, weil eine Benachrichtigung, die nicht kommt, keine
 * Fehlermeldung erzeugt.
 */

/**
 * Gerechnet wird in Schweizer Zeit.
 *
 * Wer «08:00» einstellt, meint acht Uhr am Frühstückstisch – im Sommer wie
 * im Winter. Der Versand rechnet deshalb nie mit UTC-Uhrzeiten, sondern
 * fragt die Wanduhr in Zürich (`wallClock`); die Zeitumstellung geht damit
 * spurlos vorbei, ganz ohne Sonderfall im Kalender.
 */
export const NOTIFY_TIMEZONE = 'Europe/Zurich'

const MINUTES_PER_DAY = 1440

/**
 * Wie lange eine fällige Erinnerung noch nachgereicht wird.
 *
 * Der Lauf kommt alle Viertelstunde vorbei, aber er kann ausfallen –
 * ein Deployment, eine Störung bei Netlify. Ohne Nachlauf wäre die
 * Erinnerung dieser Woche dann einfach weg. Zwei Stunden später ist sie
 * immer noch richtig; am Abend wäre sie es nicht mehr.
 */
export const DUE_WINDOW_MINUTES = 120

/**
 * Mindestabstand zwischen zwei Traktanden-Nachrichten.
 *
 * Wer an einem Abend fünf Traktanden erfasst, löst eine Nachricht aus und
 * nicht fünf. Das ist die halbe Miete gegen die häufigste Art, eine
 * Benachrichtigung unbrauchbar zu machen – zu viele davon.
 */
export const AGENDA_GAP_MINUTES = 30

/** Wie lange vor der Sitzung erinnert wird – und wie breit das Fenster ist. */
export const MEETING_LEAD_MINUTES = 60
const MEETING_WINDOW_MINUTES = 15

/** Ein frisches Einstellungsblatt: alles aus, Anti Doom montags um acht. */
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<NotificationSettings, 'id' | 'uid'> = {
  impuls: { on: false, mode: 'weekly', weekday: 1, time: '08:00' },
  agenda: { on: false },
  meeting: { on: false },
  ap: { on: false, hoursBefore: 1, scope: 'alle' },
}

/**
 * Die wählbaren Vorlaufzeiten für den AP-Kalender, in Stunden.
 *
 * 24 heisst «einen Tag vorher». Mehr Feinheit gäbe es nur um den Preis
 * einer Auswahl, die man einmal trifft und nie wieder versteht.
 */
export const AP_LEAD_HOURS = [1, 2, 3, 4, 6, 12, 24] as const

/** «1 Stunde vorher», «6 Stunden vorher», «1 Tag vorher». */
export function apLeadLabel(hours: number): string {
  if (hours >= 24) return '1 Tag vorher'
  return hours === 1 ? '1 Stunde vorher' : `${hours} Stunden vorher`
}

/**
 * Zählt ein Termin dieser Art zur gewählten Auswahl?
 *
 * Besondere Anlässe gehören zu den Aktivitäten; Ausgefallenes erinnert
 * nie – eine Erinnerung an etwas, das nicht stattfindet, wäre Spott.
 */
export function apScopeIncludes(scope: ApNotifyScope, kind: ApActivityKind): boolean {
  if (kind === 'cancelled') return false
  if (kind === 'class') return scope !== 'aktivitaeten'
  return scope !== 'klassen'
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

/**
 * Die wählbaren Uhrzeiten – jede halbe Stunde.
 *
 * Halbe Stunden und nicht jede Minute: Der Lauf kommt alle Viertelstunde
 * vorbei, und jede angebotene Zeit soll er auch genau treffen. Eine
 * Auswahl, die «08:07» zulässt und dann um 08:15 sendet, wäre ein
 * Versprechen, das die Technik nicht hält.
 */
export const NOTIFY_TIMES: string[] = Array.from({ length: 48 }, (_, index) =>
  formatTime(index * 30),
)

/* ------------------------------------------------------------------ */
/* Zeit                                                                */
/* ------------------------------------------------------------------ */

/** «08:30» → 510 Minuten. Unlesbares fällt auf acht Uhr zurück. */
export function parseTime(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return 8 * 60

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return 8 * 60
  return hours * 60 + minutes
}

/** 510 → «08:30». */
export function formatTime(minutes: number): string {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

const wallClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: NOTIFY_TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Die Wanduhr in Zürich zu einem Zeitpunkt: Wochentag und Tagesminute.
 *
 * Über `Intl` und nicht über eine eigene Rechnung mit Offsets – die
 * Zeitzonendaten stecken ohnehin in der Laufzeitumgebung, und jede
 * selbstgebaute Umrechnung müsste die Umstellungstermine kennen.
 */
export function wallClock(date: Date): { weekday: number; minutes: number } {
  const parts = wallClockFormat.formatToParts(date)
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

  return {
    weekday: WEEKDAY_INDEX[find('weekday')] ?? 1,
    minutes: Number(find('hour')) * 60 + Number(find('minute')),
  }
}

/** Die Uhrzeit eines Zeitpunkts, wie sie in der Schweiz auf der Uhr steht. */
export function clockLabel(date: Date): string {
  return formatTime(wallClock(date).minutes)
}

/* ------------------------------------------------------------------ */
/* Fälligkeit                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ist die eingestellte Erinnerung jetzt fällig?
 *
 * Zwei Bedingungen, und beide arbeiten allein mit der Wanduhr: Der
 * Zeitpunkt muss erreicht (und noch nicht überholt) sein, und seit der
 * letzten Nachricht muss genug Zeit vergangen sein. Der Mindestabstand
 * ist der eigentliche Schutz gegen Doppelungen – er hält auch dann, wenn
 * ein Lauf zweimal startet oder die Sommerzeit eine Stunde verschiebt.
 */
export function scheduleDue(
  schedule: NotificationSchedule,
  now: Date,
  lastSentAt: Date | null,
): boolean {
  const { weekday, minutes } = wallClock(now)
  if (schedule.mode === 'weekly' && weekday !== schedule.weekday) return false

  const target = parseTime(schedule.time)
  if (minutes < target) return false
  if (minutes >= Math.min(target + DUE_WINDOW_MINUTES, MINUTES_PER_DAY)) return false

  if (lastSentAt) {
    const sinceMinutes = (now.getTime() - lastSentAt.getTime()) / 60_000
    // Täglich: ein halber Tag Ruhe. Wöchentlich: drei Tage – kurz genug,
    // dass ein verschobener Wochentag noch greift, lang genug gegen zwei
    // Nachrichten in derselben Woche.
    const minimum = schedule.mode === 'daily' ? 12 * 60 : 3 * MINUTES_PER_DAY
    if (sinceMinutes < minimum) return false
  }

  return true
}

/** Darf jetzt wieder über neue Traktanden benachrichtigt werden? */
export function agendaDue(now: Date, lastSentAt: Date | null): boolean {
  if (!lastSentAt) return true
  return (now.getTime() - lastSentAt.getTime()) / 60_000 >= AGENDA_GAP_MINUTES
}

/** Beginnt die Sitzung in ungefähr einer Stunde? */
export function meetingDue(startsAt: Date, now: Date): boolean {
  const minutes = (startsAt.getTime() - now.getTime()) / 60_000
  return (
    minutes > MEETING_LEAD_MINUTES - MEETING_WINDOW_MINUTES &&
    minutes <= MEETING_LEAD_MINUTES + MEETING_WINDOW_MINUTES
  )
}

/**
 * Ist die Erinnerung an einen AP-Termin jetzt fällig?
 *
 * Fällig heisst: Der gewählte Vorlauf ist erreicht, aber höchstens zwei
 * Stunden überschritten – derselbe Nachlauf wie bei den übrigen
 * Erinnerungen (`DUE_WINDOW_MINUTES`), damit ein ausgefallener Lauf die
 * Erinnerung nicht verschluckt. Nach dem Beginn kommt nichts mehr: Eine
 * Erinnerung an Vergangenes wäre keine. Dass sie höchstens einmal kommt,
 * sichert die Marke `apNotified` am Einstellungsdokument.
 */
export function apReminderDue(startsAt: Date, now: Date, leadMinutes: number): boolean {
  const minutes = (startsAt.getTime() - now.getTime()) / 60_000
  return minutes > Math.max(leadMinutes - DUE_WINDOW_MINUTES, 0) && minutes <= leadMinutes
}

/**
 * Der Zeitpunkt, zu dem eine Zürcher Wanduhr «date, time» zeigt.
 *
 * Die Umkehrung von `wallClock` – gebraucht vom Versand: Der AP-Kalender
 * speichert Tag («2026-08-19») und Uhrzeit («19:30») als Schweizer
 * Wandzeit, der Server rechnet aber in UTC. Zwei Näherungsschritte über
 * `Intl` genügen: Der erste Versuch liegt höchstens um den Zonenversatz
 * daneben, der zweite sitzt – auch über die Zeitumstellung hinweg.
 */
const zurichParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: NOTIFY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function zurichTime(date: string, time: string): Date {
  const target = Date.parse(`${date}T${time}:00Z`)
  let result = new Date(target)
  for (let i = 0; i < 2; i += 1) {
    const parts = zurichParts.formatToParts(result)
    const find = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
    const wall = Date.parse(
      `${find('year')}-${find('month')}-${find('day')}T${find('hour')}:${find('minute')}:00Z`,
    )
    result = new Date(result.getTime() + (target - wall))
  }
  return result
}

/** Der Kalendertag eines Zeitpunkts in Zürich – «2026-08-19». */
export function zurichDay(date: Date): string {
  const parts = zurichParts.formatToParts(date)
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${find('year')}-${find('month')}-${find('day')}`
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

/** Der Vorname aus einem angezeigten Namen – «Josh Weber» wird «Josh». */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName.trim()
}

/** «Josh», «Josh und Maria», «Josh, Maria und 2 weitere». */
export function joinNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))]
  if (unique.length === 0) return ''
  if (unique.length === 1) return unique[0]
  if (unique.length === 2) return `${unique[0]} und ${unique[1]}`
  if (unique.length === 3) return `${unique[0]}, ${unique[1]} und ${unique[2]}`
  return `${unique[0]}, ${unique[1]} und ${unique.length - 2} weitere`
}

export interface PushMessage {
  title: string
  body: string
}

/**
 * «Josh hat ein neues Traktandum angelegt.»
 *
 * Der Name steht vorn, weil er das ist, was die Nachricht beantwortet:
 * Es ist etwas dazugekommen, und zwar von jemandem. Aus mehreren
 * Traktanden wird eine Nachricht mit Zahl statt ein Stapel Meldungen.
 */
export function agendaMessage(names: string[], count: number): PushMessage {
  const what = count === 1 ? 'ein neues Traktandum' : `${count} neue Traktanden`
  const who = joinNames(names)
  const verb = new Set(names.filter(Boolean)).size === 1 ? 'hat' : 'haben'

  return {
    title: count === 1 ? 'Neues Traktandum' : 'Neue Traktanden',
    body: who
      ? `${who} ${verb} ${what} angelegt.`
      : `Es gibt ${count === 1 ? 'ein neues Traktandum' : `${count} neue Traktanden`}.`,
  }
}

/**
 * Die Erinnerung an «Anti Doom».
 *
 * Beim Wochentakt kündigt sie die neue Woche an, beim Tagestakt nicht:
 * «Die neue Woche ist da» wäre am Donnerstag schlicht falsch, und eine
 * Nachricht, die sich selbst widerspricht, liest man beim zweiten Mal
 * nicht mehr.
 */
export function impulsMessage(mode: NotificationMode): PushMessage {
  return {
    title: 'Anti Doom',
    body:
      mode === 'daily'
        ? 'Wochenthema, Quiz und Challenge dieser Woche warten.'
        : 'Die neue Woche ist da – Wochenthema, Quiz und Challenges warten.',
  }
}

/**
 * «Morgen: AP-Klasse» / «In 2 Stunden: AP-Aktivität» – mit Titel und Zeit.
 *
 * Der Vorlauf im Titel ist der eingestellte, nicht der gemessene: Wer
 * «1 Tag vorher» bestellt hat, liest «Morgen», auch wenn der Lauf ein
 * paar Minuten später kam.
 */
export function apReminderMessage(input: {
  kind: ApActivityKind
  title: string
  startsAt: Date
  leadHours: number
}): PushMessage {
  const what = input.kind === 'class' ? 'AP-Klasse' : 'AP-Aktivität'
  const lead =
    input.leadHours >= 24
      ? 'Morgen'
      : input.leadHours === 1
        ? 'In einer Stunde'
        : `In ${input.leadHours} Stunden`
  return {
    title: `${lead}: ${what}`,
    body: `«${input.title}» um ${clockLabel(input.startsAt)}.`,
  }
}

/** «Bischofschaftssitzung um 19:00 – 5 Traktanden, 3 Pendenzen.» */
export function meetingMessage(
  meeting: { title: string; startsAt: Date },
  counts: { traktanden: number; pendenzen: number },
): PushMessage {
  const parts: string[] = []
  if (counts.traktanden > 0) {
    parts.push(counts.traktanden === 1 ? '1 Traktandum' : `${counts.traktanden} Traktanden`)
  }
  if (counts.pendenzen > 0) {
    parts.push(counts.pendenzen === 1 ? '1 Pendenz' : `${counts.pendenzen} Pendenzen`)
  }

  const title = meeting.title.trim() || 'Sitzung'
  const time = clockLabel(meeting.startsAt)

  return {
    title: 'Sitzung in einer Stunde',
    body:
      parts.length > 0
        ? `${title} um ${time} – ${parts.join(', ')}.`
        : `${title} um ${time} – noch nichts traktandiert.`,
  }
}

/** Wie der eingestellte Takt in einem Satz klingt – für die Einstellungen. */
export function scheduleLabel(schedule: NotificationSchedule): string {
  const time = formatTime(parseTime(schedule.time))
  return schedule.mode === 'daily'
    ? `Täglich um ${time}`
    : `Jeden ${WEEKDAY_LABELS[schedule.weekday] ?? 'Montag'} um ${time}`
}

import { AP_CLASS_DURATION_MINUTES, apStartTime, type ApActivityKind } from './types.ts'

/**
 * Der Aktivitätenplan als abonnierbarer Kalender (`.ics`, RFC 5545).
 *
 * Ein Abo ist etwas anderes als ein Export: Google und Apple holen sich die
 * Datei von sich aus immer wieder, ersetzen damit den ganzen Kalender und
 * zeigen deshalb stets den Stand aus der App – neue Termine erscheinen,
 * geänderte rücken, gelöschte verschwinden. Niemand muss etwas exportieren
 * oder importieren; der Plan bleibt hier die Quelle, und der Kalender ist
 * sein Spiegel.
 *
 * Firestore-frei wie `lib/apCalendar` und aus demselben Grund: So lässt sich
 * die Übersetzung prüfen (`tests/ap-ics.test.ts`), und dieselbe Datei kann
 * die Netlify-Function verwenden, die den Feed ausliefert. Sie hängt weder an
 * einem Browser noch am Firebase-SDK.
 *
 * Drei Dinge entscheiden darüber, ob ein Kalender die Datei annimmt, und alle
 * drei sind unauffällig genug, um sie zu übersehen:
 *
 *  1. **Zeilenenden sind CRLF**, und keine Zeile ist länger als 75 Oktette.
 *     Längere werden umgebrochen und mit einem Leerzeichen fortgesetzt –
 *     gezählt wird in Bytes, nicht in Zeichen, sonst zerfällt ein «ä» mitten
 *     im Umbruch in zwei halbe.
 *  2. **`DTEND` ist bei ganztägigen Terminen exklusiv.** Ein Lager, das am
 *     Sonntag endet, trägt den Montag – wer den Sonntag einträgt, verliert
 *     den letzten Tag.
 *  3. **`UID` bleibt gleich.** Sie ist die Firestore-ID des Termins. Genau
 *     daran erkennt ein Kalender beim nächsten Abholen, dass ein Termin
 *     derselbe ist – sonst stünde jede Änderung als zweiter Eintrag daneben.
 */

/** Zeitzone des Plans. Die Gemeinde liegt in der Schweiz, und dabei bleibt es. */
export const AP_TIMEZONE = 'Europe/Zurich'

/**
 * Wie lange ein Termin mit Uhrzeit dauert.
 *
 * Der Plan kennt nur den Beginn – eine Aktivität endet, wenn sie zu Ende ist.
 * Ein Kalender braucht dennoch eine Länge, sonst zeichnet er einen Strich
 * statt eines Blocks. Anderthalb Stunden sind die übliche Länge eines
 * Mittwochabends; wer es genauer braucht, ändert diesen Wert.
 *
 * Die AP-Klasse ist davon ausgenommen: Sie dauert nicht «ungefähr so lange»,
 * sondern genau ihre Stunde – siehe `AP_CLASS_DURATION_MINUTES`.
 */
export const AP_DEFAULT_DURATION_MINUTES = 90

/** Was vor dem Titel steht, wenn ein Abend ausfällt. */
export const AP_CANCELLED_PREFIX = 'Fällt aus – '

/**
 * Ein Termin, so wie ihn der Kalender braucht.
 *
 * Nicht `ApActivity` selbst: Dort ist `updatedAt` ein Firestore-Zeitstempel,
 * und den kennt weder Node noch ein Test. Die Umrechnung passiert dort, wo
 * die Daten herkommen.
 */
export interface IcsActivity {
  /** Die Firestore-ID – sie wird zur UID und darf sich nie ändern */
  id: string
  /** «2026-01-07» */
  date: string
  /** Letzter Tag bei mehrtägigen Anlässen */
  endDate?: string | null
  /** «19:30» – leer, wenn die übliche Zeit gilt */
  time?: string
  kind: ApActivityKind
  title: string
  location?: string
  leader?: string
  bishopric?: string
  advisor?: string
  note?: string
  /** Wann der Termin zuletzt geändert wurde – wird zu `LAST-MODIFIED` */
  updatedAt?: Date | null
}

export interface IcsOptions {
  /** Der Name, unter dem der Kalender in Google und Apple erscheint */
  name: string
  /**
   * Der Host der App, «bischofschaft.example.ch».
   *
   * Steht in der UID hinter dem `@` und macht sie damit weltweit eindeutig –
   * so, wie es der Standard verlangt.
   */
  domain: string
  /** Zeitpunkt der Auslieferung – wird zu `DTSTAMP` */
  now: Date
  /** Ein Satz zum Kalender, den manche Programme unter dem Namen zeigen */
  description?: string
  /** Führendes Kollegium je Monat: «2026-03» → «Leitung Diakone» */
  leadership?: Map<string, string>
  /**
   * Länge eines Termins mit Uhrzeit, in Minuten.
   *
   * Gilt für alles, dessen Länge der Plan nicht kennt. Die AP-Klasse behält
   * ihre Stunde – die ist keine Schätzung, die sich vorgeben liesse.
   */
  durationMinutes?: number
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/**
 * Text so absichern, dass er einen Eintrag nicht zerlegt.
 *
 * Komma und Semikolon trennen im Format selbst Werte voneinander; ein
 * Titel wie «Kleine Entscheidungen, grosse Folgen» beendete den Eintrag
 * sonst mitten im Satz. Der Doppelpunkt bleibt bewusst unangetastet – er
 * darf im Wert stehen und wird oft fälschlich mitmaskiert.
 *
 * Die Reihenfolge ist wesentlich: Der Rückstrich zuerst, sonst maskiert der
 * zweite Durchgang die eben gesetzten Maskierungen gleich wieder mit.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Eine Zeile auf 75 Oktette umbrechen, Fortsetzungen mit einem Leerzeichen.
 *
 * Gezählt wird in Bytes: «Jugendrat im Gemeindehaus Zürich» ist als UTF-8
 * länger, als es Zeichen hat. Umbrochen wird zudem nur zwischen ganzen
 * Zeichen – ein halbes «ü» im Umbruch macht die Datei ungültig.
 *
 * Das führende Leerzeichen der Fortsetzung zählt mit, deshalb bleiben dort
 * nur noch 74 Oktette für den Inhalt.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []

  let current = ''
  let bytes = 0
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += char
    bytes += size
  }

  parts.push(current)
  return parts.join('\r\n ')
}

/** «2026-01-07» → «20260107». */
export function icsDay(dateKey: string): string {
  return dateKey.replace(/-/g, '')
}

/**
 * Der Tag nach einem Datum – für das exklusive `DTEND`.
 *
 * Gerechnet wird in UTC und nicht in der Ortszeit: Der 26. Oktober 2026 hat
 * in Zürich 25 Stunden, und «plus 24 Stunden» landet dann auf demselben Tag.
 * Ein Tagesschlüssel trägt ohnehin keine Zeitzone.
 */
export function nextDayKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return next.toISOString().slice(0, 10)
}

/** «2026-08-07T09:41:12.000Z» → «20260807T094112Z». */
export function icsStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/**
 * Die Uhrzeit eines Termins, so nachsichtig gelesen wie sie erfasst wird.
 *
 * Das Feld ist Freitext: «19:30» steht dort meistens, «19.30» und «19:30 Uhr»
 * kommen vor. Was sich nicht als Zeit lesen lässt, gilt als keine Zeit – dann
 * wird der Termin ganztägig, und das ist allemal besser als eine erfundene
 * Stunde.
 */
export function parseIcsTime(value: string | undefined): { hour: number; minute: number } | null {
  const match = /^\s*(\d{1,2})\s*[:.h]?\s*(\d{2})?/.exec(value ?? '')
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  if (hour > 23 || minute > 59) return null

  return { hour, minute }
}

/**
 * Die Zeitzone als eigener Block.
 *
 * Ohne ihn müsste jede Uhrzeit in UTC stehen – und läge im Sommer eine Stunde
 * daneben, sobald die Umstellung dazwischen liegt. Die beiden Regeln
 * beschreiben die Umstellung, statt sie für jedes Jahr auszurechnen: letzter
 * Sonntag im März vor, letzter Sonntag im Oktober zurück.
 */
function timezoneBlock(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${AP_TIMEZONE}`,
    'X-LIC-LOCATION:Europe/Zurich',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

/**
 * Was unter dem Titel steht: wer leitet, wer dabei ist, was sonst gilt.
 *
 * Nur gefüllte Felder – eine Zeile «Berater:» ohne Namen dahinter ist keine
 * Auskunft, sondern Lärm.
 */
function description(activity: IcsActivity, leadership: string | undefined): string {
  const lines: string[] = []
  const add = (label: string, value: string | undefined | null) => {
    const clean = (value ?? '').trim()
    if (clean) lines.push(`${label}: ${clean}`)
  }

  /*
   * Ein mehrtägiger Anlass steht als ganztägiger Balken im Kalender, auch
   * wenn eine Uhrzeit erfasst ist – wann ein Lager endet, weiss der Plan
   * nicht. Die Zeit geht deshalb nicht verloren, sie wandert hierher.
   */
  if (isMultiDay(activity) && parseIcsTime(activity.time)) {
    add('Beginn', activity.time)
  }

  add('Zuständig AP', activity.leader)
  add('Bischofschaft', activity.bishopric)
  add('Berater', activity.advisor)
  add('Monat', leadership)
  add('Bemerkung', activity.note)

  return lines.join('\n')
}

function isMultiDay(activity: IcsActivity): boolean {
  return Boolean(activity.endDate && activity.endDate !== activity.date)
}

/**
 * Wie lange der Termin im Kalender steht.
 *
 * Für die Klasse ist das keine Annahme, sondern die Sache selbst: Sie geht
 * von 11 bis 12. Bei allem Übrigen kennt der Plan nur den Beginn, und dann
 * bleibt es bei der üblichen Länge – ein Block, der ungefähr stimmt, statt
 * eines Strichs, der gar nichts sagt.
 */
function duration(activity: IcsActivity, options: IcsOptions): number {
  if (activity.kind === 'class') return AP_CLASS_DURATION_MINUTES
  return options.durationMinutes ?? AP_DEFAULT_DURATION_MINUTES
}

/* ------------------------------------------------------------------ */
/* Ein Termin                                                          */
/* ------------------------------------------------------------------ */

function event(activity: IcsActivity, options: IcsOptions): string[] {
  const stamp = icsStamp(options.now)
  const time = parseIcsTime(apStartTime(activity))
  const multiDay = isMultiDay(activity)

  const lines = ['BEGIN:VEVENT', `UID:${activity.id}@${options.domain}`, `DTSTAMP:${stamp}`]

  if (multiDay || !time) {
    /*
     * Ganztägig – und `DTEND` ist der Tag **danach**.
     *
     * Ein Termin ohne Uhrzeit bekommt bewusst keine erfundene: Wann der
     * Mittwochabend beginnt, hält der Plan nirgends fest. Ein Balken über
     * dem Tag sagt die Wahrheit, «19:30» wäre geraten. Die Klasse ist die
     * Ausnahme – ihre Stunde steht fest und kommt aus `apStartTime`.
     */
    const last = multiDay ? (activity.endDate ?? activity.date) : activity.date
    lines.push(`DTSTART;VALUE=DATE:${icsDay(activity.date)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDay(nextDayKey(last))}`)
  } else {
    const clock = `${String(time.hour).padStart(2, '0')}${String(time.minute).padStart(2, '0')}00`
    lines.push(`DTSTART;TZID=${AP_TIMEZONE}:${icsDay(activity.date)}T${clock}`)
    lines.push(`DURATION:PT${duration(activity, options)}M`)
  }

  /*
   * Ein ausgefallener Abend bleibt im Kalender stehen und sagt es im Titel.
   *
   * `STATUS:CANCELLED` wäre die formal richtige Auszeichnung – nur blenden
   * etliche Kalender solche Einträge ganz aus, und dann fehlt genau die
   * Erklärung für die Lücke, deretwegen der Eintrag im Plan steht. Wer sie
   * nicht sehen will, nimmt die Art aus dem Abo heraus.
   */
  const title = activity.title.trim() || 'Noch offen'
  const summary = activity.kind === 'cancelled' ? `${AP_CANCELLED_PREFIX}${title}` : title
  lines.push(`SUMMARY:${escapeIcsText(summary)}`)

  const where = (activity.location ?? '').trim()
  if (where) lines.push(`LOCATION:${escapeIcsText(where)}`)

  const text = description(activity, options.leadership?.get(activity.date.slice(0, 7)))
  if (text) lines.push(`DESCRIPTION:${escapeIcsText(text)}`)

  /*
   * Nur ein Termin mit Uhrzeit belegt Zeit.
   *
   * Sonst stünde man für jeden ganztägigen Eintrag – und für jeden
   * ausgefallenen Abend – den ganzen Tag als beschäftigt da, und die
   * Terminsuche von Google fände nie mehr einen freien Mittwoch.
   */
  const busy = !multiDay && time && activity.kind !== 'cancelled'
  lines.push(`TRANSP:${busy ? 'OPAQUE' : 'TRANSPARENT'}`)

  if (activity.updatedAt) lines.push(`LAST-MODIFIED:${icsStamp(activity.updatedAt)}`)

  lines.push('END:VEVENT')
  return lines
}

/* ------------------------------------------------------------------ */
/* Der ganze Kalender                                                  */
/* ------------------------------------------------------------------ */

/**
 * Der Plan als Kalenderdatei.
 *
 * `REFRESH-INTERVAL` ist eine Bitte, kein Befehl: Apple hält sich daran,
 * Google entscheidet selbst und holt den Feed typischerweise alle paar
 * Stunden. Das lässt sich von hier aus nicht erzwingen – wer eine Änderung
 * sofort braucht, sagt sie besser noch dazu.
 */
export function buildApIcs(activities: IcsActivity[], options: IcsOptions): string {
  const sorted = [...activities].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bischofschaft//Aktivitaetenplan AP//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeIcsText(options.name)}`,
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
    `X-WR-TIMEZONE:${AP_TIMEZONE}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  if (options.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(options.description)}`)
    lines.push(`X-WR-CALDESC:${escapeIcsText(options.description)}`)
  }

  lines.push(...timezoneBlock())
  for (const activity of sorted) lines.push(...event(activity, options))
  lines.push('END:VCALENDAR')

  // Der abschliessende Umbruch gehört dazu: Manche Programme lesen die
  // letzte Zeile sonst nicht zu Ende.
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

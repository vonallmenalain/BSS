import { toDate } from './dates.ts'
import {
  ACTIVE_TALK_STATUSES,
  SACRAMENT_KIND_INFO,
  type SacramentKindInfo,
  type SacramentMeeting,
  type Talk,
} from './types.ts'

/**
 * Was an einem Sonntag stattfindet – und was daraus folgt.
 *
 * Der Plan der Gemeinde ist regelmässig, aber nicht gleichförmig: Am ersten
 * Sonntag im Monat ist Zeugnisversammlung und es werden keine Ansprachen
 * vergeben; im April und im Oktober fällt an diesem Tag die
 * Generalkonferenz dazwischen und in der Gemeinde findet gar nichts statt;
 * zweimal im Jahr kommt eine Pfahlkonferenz an einem beliebigen Datum
 * hinzu. Dazu Sonntage, die eine Leitung brauchen, aber keine Ansprachen –
 * die Darbietung der Kinder etwa.
 *
 * Das alles steht hier an **einem** Ort und firestore-frei, damit «Leitung»,
 * «Ansprachen» und die Übersicht dieselbe Antwort geben und sich die Regel
 * prüfen lässt (`tests/sunday.test.ts`).
 *
 * Der Vorrang ist immer derselbe: Was am Sonntag erfasst ist, gilt; ist
 * nichts erfasst, gilt die Regel. Deshalb bleibt ein von Hand festgelegter
 * Sonntag mit einem Griff wieder «automatisch».
 */

export interface SundayProgram {
  /** Eine der eingebauten Arten oder die ID eines selbst erfassten Grundes */
  kind: string
  /** Die Art stammt aus der Regel und nicht aus dem Sonntag selbst. */
  automatic: boolean
  /** Findet in der Gemeinde eine Versammlung statt? */
  meets: boolean
  /** Werden Ansprachen eingeplant? */
  plansTalks: boolean
  /** Mindestens ein Haken weicht von der Art ab. */
  adjusted: boolean
  label: string
  /** Was die Art selbst vorgibt – ohne die Haken dieses Sonntags. */
  defaults: { meets: boolean; plansTalks: boolean }
}

/**
 * Was hinter einem gespeicherten `kind` steckt.
 *
 * Eingebaut oder selbst erfasst – für alles Weitere spielt das keine Rolle,
 * nur die drei Angaben Bezeichnung, Versammlung und Ansprachen zählen. Ein
 * selbst erfasster Grund, der inzwischen aus den Einstellungen genommen
 * wurde, bleibt lesbar: Seine Bezeichnung steht am Sonntag mit (`kindLabel`),
 * und die beiden Haken stehen dort ohnehin.
 */
function kindInfo(kind: string, meeting: SacramentMeeting | null): SacramentKindInfo {
  const known = SACRAMENT_KIND_INFO[kind as keyof typeof SACRAMENT_KIND_INFO]
  if (known) return known
  return {
    value: 'special',
    label: meeting?.kindLabel || 'Besonderer Anlass',
    meets: meeting?.meets ?? true,
    plansTalks: meeting?.plansTalks ?? false,
    hint: 'Ein selbst erfasster Grund – was daraus folgt, sagen die beiden Haken.',
  }
}

/**
 * Die Art, die sich ohne Zutun ergibt.
 *
 * Der «erste Sonntag im Monat» ist schlicht der erste Tag dieses Wochentags –
 * er fällt immer auf den 1. bis 7. Damit stimmt die Regel auch dann, wenn
 * die Abendmahlsversammlung einer Gemeinde nicht am Sonntag stattfindet.
 *
 * Die Generalkonferenz liegt am ersten Wochenende im April und im Oktober.
 * Sie geht der Zeugnisversammlung vor: An diesem Tag ist in Burgdorf nichts.
 */
export function automaticSacramentKind(
  date: Date,
): 'regular' | 'general_conference' | 'fast_testimony' {
  if (date.getDate() > 7) return 'regular'
  const month = date.getMonth()
  if (month === 3 || month === 9) return 'general_conference'
  return 'fast_testimony'
}

/** Was für diesen Sonntag gilt – Erfasstes vor Regel. */
export function sundayProgram(date: Date, meeting: SacramentMeeting | null): SundayProgram {
  const stored = meeting?.kind ?? null
  const kind = stored ?? automaticSacramentKind(date)
  const info = kindInfo(kind, meeting)

  const meets = typeof meeting?.meets === 'boolean' ? meeting.meets : info.meets
  // Ohne Versammlung gibt es auch nichts zu sprechen – der Haken kann das
  // nicht aufheben, sonst stünden Ansprachen an einem Tag, an dem niemand da ist.
  const plansTalks =
    meets && (typeof meeting?.plansTalks === 'boolean' ? meeting.plansTalks : info.plansTalks)

  return {
    kind,
    automatic: stored === null,
    meets,
    plansTalks,
    adjusted: meets !== info.meets || plansTalks !== info.plansTalks,
    label: info.label,
    defaults: { meets: info.meets, plansTalks: info.plansTalks },
  }
}

/**
 * Anzahl vorgesehener Ansprachen für einen Sonntag.
 *
 * Der Standard steht in den Einstellungen, die Ausnahme am Sonntag selbst –
 * und `0` ist eine gültige Ausnahme. Sonntage ohne Ansprachen (Zeugnis-
 * versammlung, DKA, Konferenz) kommen ohne Ausnahme auf null: Was aus der
 * Art folgt, muss niemand von Hand nachtragen.
 */
export function plannedTalksFor(
  date: Date,
  meeting: SacramentMeeting | null,
  defaultCount: number,
): number {
  if (!sundayProgram(date, meeting).plansTalks) return 0
  const override = meeting?.talkSlots
  return typeof override === 'number' && override >= 0 ? override : defaultCount
}

/** Wie viele Programmplätze sind an diesem Sonntag noch offen? */
export function openTalkSlots(
  date: Date,
  meeting: SacramentMeeting | null,
  talks: Talk[],
  defaultCount: number,
): number {
  const planned = plannedTalksFor(date, meeting, defaultCount)
  const taken = new Set(
    talks.filter((talk) => ACTIVE_TALK_STATUSES.includes(talk.status)).map((talk) => talk.slot),
  )
  let open = 0
  for (let slot = 1; slot <= planned; slot++) if (!taken.has(slot)) open++
  return open
}

/**
 * Hat diese Ansprache stattgefunden?
 *
 * Eine Zusage in der Vergangenheit – mehr braucht es nicht. Einen Status
 * «gehalten» gibt es nicht mehr: Er wäre ein Klick nach der Versammlung, den
 * niemand macht, und ohne ihn stimmte der Verlauf nicht.
 *
 * Die Mitgliederstatistik zählt dagegen jede Zusage, auch die für den
 * nächsten Sonntag – wer zugesagt hat, wird nicht gleich noch einmal
 * angefragt (siehe `services/talks`).
 */
export function wasHeld(talk: Talk, now: Date = new Date()): boolean {
  const date = toDate(talk.date)
  return talk.status === 'confirmed' && date !== null && date < now
}

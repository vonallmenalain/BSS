import {
  ACTIVE_TALK_STATUSES,
  SACRAMENT_KIND_INFO,
  type SacramentKind,
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
  kind: SacramentKind
  /** Die Art stammt aus der Regel und nicht aus dem Sonntag selbst. */
  automatic: boolean
  /** Findet in der Gemeinde eine Versammlung statt? */
  meets: boolean
  /** Werden Ansprachen eingeplant? */
  plansTalks: boolean
  /** Mindestens ein Haken weicht von der Art ab. */
  adjusted: boolean
  label: string
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
export function automaticSacramentKind(date: Date): SacramentKind {
  if (date.getDate() > 7) return 'regular'
  const month = date.getMonth()
  if (month === 3 || month === 9) return 'general_conference'
  return 'fast_testimony'
}

/** Was für diesen Sonntag gilt – Erfasstes vor Regel. */
export function sundayProgram(date: Date, meeting: SacramentMeeting | null): SundayProgram {
  const stored = meeting?.kind ?? null
  const kind = stored ?? automaticSacramentKind(date)
  const info = SACRAMENT_KIND_INFO[kind] ?? SACRAMENT_KIND_INFO.regular

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
    talks
      .filter((talk) => ACTIVE_TALK_STATUSES.concat('held').includes(talk.status))
      .map((talk) => talk.slot),
  )
  let open = 0
  for (let slot = 1; slot <= planned; slot++) if (!taken.has(slot)) open++
  return open
}

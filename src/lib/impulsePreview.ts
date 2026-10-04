import { addDays, differenceInCalendarDays } from 'date-fns'
import { impulseWeekKey, weekStart } from './impulse.ts'
import type {
  ImpulseAnswer,
  ImpulseComment,
  ImpulseProgress,
  ImpulseSubmission,
  ImpulseWeekProgress,
  TS,
} from './types.ts'

/**
 * Die Vorschau der Redaktion: der Bereich genau so, wie ihn die
 * Jugendlichen sehen – Übersicht, Wochen-Wappen, Feed mit Leiste, Räume,
 * Feier –, für eine gewählte Woche, als wäre sie die laufende.
 *
 * **Gespeichert wird nichts.** Was die Jugendlichen in die Datenbank
 * schrieben (Antworten, Stimmen, Haken, angeschaute Karten, das Wappen …),
 * landet in einem Stand im Arbeitsspeicher (`ImpulsePreviewData`), und
 * die Seite liest ihn zum echten Bestand dazu. Gespielt wird dabei eine
 * eigene Person, `PREVIEW_UID`, mit dem Vornamen der Redaktion: Ihre
 * echten Antworten zählen in der Vorschau nicht als die eigenen, und die
 * Vorschau beginnt immer bei null – wie bei einem Jugendlichen, der die
 * Woche zum ersten Mal öffnet.
 *
 * Hier liegt nur, was sich ohne React und ohne Firebase rechnen lässt –
 * der gespielte Tag und wie ein Schreibvorgang den Stand verändert. Die
 * Schreibwege selbst stehen in `hooks/useImpulseRuntime`.
 */

/** Die gespielte Person der Vorschau – keine echte UID sieht so aus. */
export const PREVIEW_UID = 'vorschau'

export interface ImpulsePreviewData {
  answers: ImpulseAnswer[]
  comments: ImpulseComment[]
  /** Das Fortschrittsdokument der gespielten Person – `null`, bis etwas geschieht. */
  progress: ImpulseProgress | null
  submissions: ImpulseSubmission[]
  /**
   * Die Feier des Wappens. Im Bereich merkt sich das Gerät, dass sie
   * gelaufen ist (localStorage); die Vorschau soll sie bei jedem Besuch
   * wieder zeigen und darf das Gerät nicht anfassen.
   */
  celebrated: string
}

export function emptyPreviewData(): ImpulsePreviewData {
  return { answers: [], comments: [], progress: null, submissions: [], celebrated: '' }
}

/** Montag bis Sonntag, 0 bis 6. */
function clampDay(day: number): number {
  return Math.min(6, Math.max(0, Math.round(day)))
}

/**
 * Der Wochentag (0 = Montag … 6 = Sonntag), mit dem die Vorschau einer
 * Woche beginnt: heute, wenn sie die laufende ist – sonst ihr Montag, der
 * Tag, an dem die Jugendlichen sie zum ersten Mal sehen.
 */
export function initialPreviewDay(week: string, realNow: number): number {
  const start = weekStart(week)
  if (!start || impulseWeekKey(realNow) !== week) return 0
  return clampDay(differenceInCalendarDays(realNow, start))
}

/**
 * Der gespielte Zeitpunkt: der gewählte Tag der Vorschauwoche, zur echten
 * Uhrzeit. So stimmen Countdown, Tages-Challenge und Sonntag mit dem Tag
 * überein, den die Leiste zeigt.
 */
export function previewMoment(week: string, day: number, realNow: number): number {
  const start = weekStart(week)
  if (!start) return realNow
  const real = new Date(realNow)
  const moment = addDays(start, clampDay(day))
  moment.setHours(real.getHours(), real.getMinutes(), real.getSeconds(), real.getMilliseconds())
  return moment.getTime()
}

/** Ein Dokument einsetzen – gleiche ID ersetzt, neue kommt dazu. */
export function upsertPreviewDoc<T extends { id: string }>(list: T[], next: T): T[] {
  const index = list.findIndex((entry) => entry.id === next.id)
  if (index === -1) return [...list, next]
  return list.map((entry, position) => (position === index ? next : entry))
}

/** Ein Dokument nachführen – fehlt es, bleibt die Liste, wie sie ist. */
export function patchPreviewDoc<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return list.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
}

/** Ein Dokument entfernen. */
export function removePreviewDoc<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id)
}

/**
 * Der echte Bestand mit dem Stand der Vorschau darüber: Bei gleicher ID
 * gewinnt die Vorschau, sonst kommt sie hinten dazu. Ohne Vorschau-Stand
 * bleibt die Liste dieselbe – kein neues Objekt, kein neues Rechnen.
 */
export function withPreviewDocs<T extends { id: string }>(real: T[], preview: T[]): T[] {
  if (preview.length === 0) return real
  const ids = new Set(preview.map((entry) => entry.id))
  return [...real.filter((entry) => !ids.has(entry.id)), ...preview]
}

/**
 * Was ein Schreibvorgang am eigenen Fortschrittsdokument ändert – dieselben
 * Felder, die die Dienste in `services/impulse` schreiben:
 *
 * - `week`: ein Haken der Woche (Wochenziel, Feed, Teilen) oder der Tag
 *   des vollendeten Wappens;
 * - `week-list`: ein Eintrag in einer Liste der Woche (Challenge-Tage,
 *   angeschaute Karten und Vertiefungen) – dazu oder weg, wie
 *   `arrayUnion` und `arrayRemove`;
 * - `list`: dasselbe für die Listen am Dokument (Amen, Gemerkt, Gemeldet);
 * - `last-seen`: die zuletzt angeschaute Woche – beim ersten Mal auch die
 *   erste (`firstSeenWeek`).
 */
export type PreviewProgressChange =
  | {
      kind: 'week'
      week: string
      patch: Pick<ImpulseWeekProgress, 'goal' | 'feed' | 'share' | 'crest'>
    }
  | {
      kind: 'week-list'
      week: string
      field: 'days' | 'cards' | 'deepened'
      value: string
      add: boolean
    }
  | { kind: 'list'; field: 'amens' | 'favorites' | 'reports'; value: string; add: boolean }
  | { kind: 'last-seen'; week: string; firstSeenWeek?: string }

/** `arrayUnion` bzw. `arrayRemove` auf einer Liste. */
function toggleEntry(list: string[] | undefined, value: string, add: boolean): string[] {
  const current = list ?? []
  if (add) return current.includes(value) ? current : [...current, value]
  return current.filter((entry) => entry !== value)
}

/**
 * Das Fortschrittsdokument nach einem Schreibvorgang – so, wie Firestore
 * es mit `setDoc(…, { merge: true })` zusammenführen würde: Vorname und
 * Zeitstempel werden jedes Mal mitgeschrieben, alles andere bleibt.
 */
export function changePreviewProgress(
  progress: ImpulseProgress | null,
  person: { uid: string; firstName: string },
  change: PreviewProgressChange,
  at: TS,
): ImpulseProgress {
  const base: ImpulseProgress = progress ?? {
    id: person.uid,
    uid: person.uid,
    firstName: person.firstName,
    createdAt: at,
  }
  const next: ImpulseProgress = { ...base, firstName: person.firstName, updatedAt: at }

  switch (change.kind) {
    case 'week': {
      const week = { ...base.weeks?.[change.week], ...change.patch }
      return { ...next, weeks: { ...base.weeks, [change.week]: week } }
    }
    case 'week-list': {
      const current = base.weeks?.[change.week] ?? {}
      const week = {
        ...current,
        [change.field]: toggleEntry(current[change.field], change.value, change.add),
      }
      return { ...next, weeks: { ...base.weeks, [change.week]: week } }
    }
    case 'list':
      return { ...next, [change.field]: toggleEntry(base[change.field], change.value, change.add) }
    case 'last-seen':
      return {
        ...next,
        lastSeenWeek: change.week,
        ...(change.firstSeenWeek ? { firstSeenWeek: change.firstSeenWeek } : {}),
      }
  }
}

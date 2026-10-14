import { addMonths, toDate, toTimestamp } from './dates.ts'
import type { Calling, Gender, Member } from './types.ts'

/**
 * Wer auf Mission ist – und was daraus folgt.
 *
 * Eine Vollzeitmission ist kein «nicht anfragen» wie bei Ansprachen und
 * Gebeten: Die Person ist schlicht nicht da. Sie steht deshalb für die Dauer
 * der Mission in **keiner** Vorschlagsliste – weder für Ansprachen noch für
 * Gebete –, und unter «Ohne Berufung» fehlt sie ebenfalls. Unter den
 * Berufungen steht sie stattdessen als «Vollzeitmission», obwohl das im LCR
 * keine Berufung der Gemeinde ist (siehe `missionCalling`).
 *
 * **Es zählt der Zeitraum, nicht der Haken.** Vor dem ersten Tag steht die
 * Person noch in den Listen – die Abschiedsansprache will ja jemand
 * einplanen –, und nach dem letzten ist sie von selbst wieder da. Die Daten
 * bleiben danach stehen: Im Profil steht die Mission dann unter den früheren
 * Berufungen.
 *
 * Firestore-frei wie `lib/availability`, damit sich die Regel prüfen lässt
 * (`tests/mission.test.ts`).
 */

/** Wie die Mission gerade steht. */
export type MissionPhase = 'planned' | 'away' | 'returned'

export interface Mission {
  from: Date
  /** Voraussichtliche Rückkehr – `null` heisst «offen» */
  until: Date | null
  phase: MissionPhase
}

/**
 * Wie lange eine Mission üblicherweise dauert – in Monaten.
 *
 * Ältesten dienen zwei Jahre, Schwestern anderthalb. Wo das Geschlecht nicht
 * erfasst ist, gilt die längere Dauer: Ein zu spätes «Bis» lässt sich im
 * Formular kürzen, ein zu frühes holte die Person mitten in der Mission in
 * die Vorschläge zurück.
 */
export function missionMonths(gender: Gender): number {
  return gender === 'f' ? 18 : 24
}

/**
 * Das vorgeschlagene «Bis» zu einem «Von».
 *
 * Als Wert für ein Datumsfeld («yyyy-MM-dd»), denn dort wird es gebraucht.
 * Ein leeres oder ungültiges «Von» ergibt ein leeres «Bis».
 */
export function defaultMissionUntil(from: string, gender: Gender): string {
  if (!from) return ''
  const start = new Date(`${from}T12:00:00`)
  if (Number.isNaN(start.getTime())) return ''
  const end = addMonths(start, missionMonths(gender))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
}

/**
 * Die Mission eines Mitglieds – oder `null`, wenn keine erfasst ist.
 *
 * Das «Von» gilt ab Tagesbeginn, das «Bis» bis zum Ende des Tages (so wird
 * es gespeichert, siehe `pages/MemberDetail`). Fehlt das «Bis», läuft die
 * Mission, bis jemand den Haken entfernt oder ein Datum nachträgt.
 */
export function missionOf(
  member: Pick<Member, 'missionFrom' | 'missionUntil'>,
  now = new Date(),
): Mission | null {
  const from = toDate(member.missionFrom)
  if (!from) return null
  const until = toDate(member.missionUntil)
  const phase: MissionPhase =
    now < from ? 'planned' : until !== null && until < now ? 'returned' : 'away'
  return { from, until, phase }
}

/** Ist dieses Mitglied gerade auf Mission? Dann fragt es niemand an. */
export function isOnMission(
  member: Pick<Member, 'missionFrom' | 'missionUntil'>,
  now = new Date(),
): boolean {
  return missionOf(member, now)?.phase === 'away'
}

/** Die Bezeichnung unter den Berufungen. */
export const MISSION_POSITION = 'Vollzeitmission'

/**
 * Die Mission als Eintrag unter den Berufungen.
 *
 * **Sie wird nirgends gespeichert.** Berufungen kommen allein aus dem LCR
 * (siehe `services/callings`); dieser Eintrag entsteht beim Anzeigen aus den
 * Daten am Mitglied und verschwindet mit ihnen. Weil er wie eine Berufung
 * aussieht, zählt er überall mit, wo nach einer laufenden Berufung gefragt
 * wird – allen voran bei «Ohne Berufung».
 *
 * Er steht «ausserhalb der Einheit», denn dorthin gehört eine Mission: Sie
 * ist keine Aufgabe im Organisationsplan der Gemeinde. Während der Mission
 * gilt sie als «eingesetzt», danach als «entlassen» – und eine Mission, die
 * erst bevorsteht, ist noch keine.
 */
export function missionCalling(
  member: Pick<Member, 'id' | 'firstName' | 'lastName' | 'missionFrom' | 'missionUntil'>,
  now = new Date(),
): Calling | null {
  const mission = missionOf(member, now)
  if (!mission || mission.phase === 'planned') return null
  const away = mission.phase === 'away'

  return {
    id: `mission-${member.id}`,
    memberId: member.id,
    // Wie beim Import aus dem LCR: «Nachname, Vorname».
    memberName: `${member.lastName}, ${member.firstName}`.trim(),
    position: MISSION_POSITION,
    organization: 'missionary',
    status: away ? 'set_apart' : 'released',
    proposedDate: null,
    extendedDate: null,
    sustainedDate: null,
    setApartDate: toTimestamp(mission.from),
    releasedDate: away ? null : toTimestamp(mission.until),
    plannedEndDate: away ? toTimestamp(mission.until) : null,
    outOfUnit: true,
  }
}

/** Die Missionen aller Mitglieder als Einträge unter den Berufungen. */
export function missionCallings(
  members: readonly Pick<
    Member,
    'id' | 'firstName' | 'lastName' | 'missionFrom' | 'missionUntil'
  >[],
  now = new Date(),
): Calling[] {
  return members
    .map((member) => missionCalling(member, now))
    .filter((calling): calling is Calling => calling !== null)
}

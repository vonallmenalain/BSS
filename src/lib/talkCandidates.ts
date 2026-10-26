import { talkAvailability } from './availability.ts'
import { getAge, monthsSince, startOfDay, toDate } from './dates.ts'
import { missionOf } from './mission.ts'
import { matchesSearch, normalize } from './utils.ts'
import { ACTIVE_TALK_STATUSES, type Member, type Talk, type TalkStatus } from './types.ts'

/**
 * Wer als Nächstes für eine Ansprache angefragt werden sollte – und wie sich
 * die Liste eingrenzen lässt.
 *
 * Firestore-frei wie `lib/sunday`, damit sich die Regel prüfen lässt
 * (`tests/talk-candidates.test.ts`); `services/talks` verteilt sie weiter, und
 * die Oberfläche kennt nur diesen einen Ort.
 */

/** Die nächste Ansprache, für die jemand schon eingetragen ist. */
export interface UpcomingTalk {
  /** Der Sonntag */
  date: Date
  /** Vorgesehen, angefragt oder zugesagt */
  status: TalkStatus
}

export interface TalkCandidate {
  member: Member
  /** Alter in Jahren; `null`, wenn kein Geburtsdatum erfasst ist */
  age: number | null
  /**
   * Monate seit der letzten Ansprache; `null` = noch nie gesprochen.
   *
   * Wer für einen kommenden Sonntag eingetragen ist, zählt schon ab diesem
   * Sonntag (`0`) – siehe `rankTalkCandidates`.
   */
  monthsSince: number | null
  /** Jahr der letzten Ansprache – oder der eingetragenen; `null` = noch nie gesprochen */
  lastTalkYear: number | null
  /** Für einen **kommenden** Sonntag eingeplant? Dann nicht doppelt anfragen. */
  alreadyPlanned: boolean
  /** Für welchen Sonntag und wie weit – `null`, wenn nichts eingetragen ist */
  upcoming: UpcomingTalk | null
  /** Von Hand ausgenommen – nicht anfragen (siehe `lib/availability`). */
  onHold: boolean
  /** Bis wann der Vermerk gilt; `null` heisst «auf Weiteres» */
  holdUntil: Date | null
  /** Gerade auf Mission – anfragen lässt sich niemand, der nicht da ist (siehe `lib/mission`). */
  onMission: boolean
  /** Voraussichtliche Rückkehr; `null`, wenn offen oder nicht auf Mission */
  missionUntil: Date | null
  /** Je höher, desto dringender ist eine Anfrage */
  score: number
}

/** Ein Name, wie er sich vergleichen lässt – ohne Gross/Klein, Akzente und doppelte Leerzeichen. */
const nameKey = (name: string) => normalize(name).replace(/\s+/g, ' ')

/**
 * Die Mitglieder, die sich über ihren Namen eindeutig finden lassen.
 *
 * Tragen zwei denselben Namen, bleibt er aussen vor: Welche von beiden
 * gemeint ist, wäre geraten.
 */
function membersByName(members: Member[]): Map<string, string> {
  const byName = new Map<string, string>()
  const twice = new Set<string>()
  for (const member of members) {
    const key = nameKey(`${member.firstName ?? ''} ${member.lastName ?? ''}`)
    if (!key) continue
    if (byName.has(key)) twice.add(key)
    byName.set(key, member.id)
  }
  for (const key of twice) byName.delete(key)
  return byName
}

/**
 * Wer für einen kommenden Sonntag bereits eingetragen ist – mit der
 * nächsten Ansprache je Mitglied.
 *
 * Entscheidend ist das **Datum**, nicht der Status: Eine Zusage bleibt am
 * Eintrag stehen, auch wenn der Sonntag längst vorbei ist – sie ist der
 * Verlauf und der Grund, warum die Auswertung «wer war lange nicht dran»
 * überhaupt funktioniert. Ohne diese Grenze gälte jede je gehaltene
 * Ansprache als «bereits eingeplant», und in der Vorschlagsliste wäre
 * gesperrt, wer schon einmal gesprochen hat.
 *
 * Gezählt wird ab Tagesbeginn: Am Sonntagmorgen steht die Ansprache noch
 * bevor, am Nachmittag ist sie gehalten – anfragen würde man an diesem Tag
 * in beiden Fällen niemanden mehr.
 */
export function upcomingTalksByMember(
  talks: Talk[],
  members: Member[] = [],
  from: Date = new Date(),
): Map<string, UpcomingTalk> {
  const start = startOfDay(from)
  const byName = membersByName(members)
  const upcoming = new Map<string, UpcomingTalk>()
  for (const talk of talks) {
    if (!ACTIVE_TALK_STATUSES.includes(talk.status)) continue
    const date = toDate(talk.date)
    if (!date || date < start) continue
    /* Ein von Hand erfasster Name gehört zu keinem Mitglied – ausser er ist
       genau der Name eines Mitglieds. Wer «Anna Beispiel» tippt und die
       Eingabetaste drückt, hat sie angefragt, auch wenn der Eintrag nur den
       Namen trägt. */
    const memberId = talk.memberId || byName.get(nameKey(talk.memberName ?? ''))
    if (!memberId) continue
    const known = upcoming.get(memberId)
    if (!known || date < known.date) upcoming.set(memberId, { date, status: talk.status })
  }
  return upcoming
}

/** Nur die Mitglieder aus `upcomingTalksByMember`. */
export function plannedTalkMemberIds(
  talks: Talk[],
  from: Date = new Date(),
  members: Member[] = [],
): Set<string> {
  return new Set(upcomingTalksByMember(talks, members, from).keys())
}

/**
 * Ermittelt, wer als Nächstes für eine Ansprache angefragt werden sollte.
 *
 * Ganz oben stehen aktive Mitglieder, die noch nie gesprochen haben, danach
 * jene mit dem längsten Abstand. Bereits eingeplante und ausgenommene
 * Personen werden nach hinten sortiert, statt sie hier zu verstecken – ob
 * sie in der Liste erscheinen, entscheiden die Filter (siehe
 * `filterTalkCandidates`).
 *
 * **Auch wer gar nicht angefragt werden soll, wird bewertet.** Früher fiel
 * er hier heraus und war damit unauffindbar; wer ihn wieder aufnehmen wollte,
 * musste sein Profil suchen. Jetzt steht er zuunterst, der Filter
 * «Ausgenommene zeigen» holt ihn hervor, und ein Griff nimmt ihn zurück in
 * die Liste.
 *
 * `minAge` hält die Kinder heraus. Ohne diese Grenze stünden sie zuoberst,
 * denn sie haben noch nie gesprochen. Wer kein Geburtsdatum hat, bleibt in
 * der Liste: Ein fehlendes Datum ist kein Grund, jemanden zu übergehen.
 *
 * **Wer schon eingetragen ist** – vorgesehen, angefragt oder zugesagt –,
 * reiht sich beim Sonntag seiner Ansprache ein, als hätte er dann schon
 * gesprochen: kein «noch nie gesprochen» und kein «zuletzt vor 21 Monaten»
 * mehr, im Jahr der Ansprache und nicht mehr überfällig. Wird der Eintrag
 * gelöscht oder die Person ausgetauscht, gilt wieder die letzte gehaltene
 * Ansprache.
 *
 * **Wer auf Mission ist, fällt dagegen ganz heraus** – er ist nicht da, und
 * kein Filter macht ihn anfragbar. Nur die Suche neben den Filtern holt ihn
 * mit `includeMission` zurück, damit «wann hat sie zuletzt gesprochen?» auch
 * für sie eine Antwort hat.
 */
export function rankTalkCandidates(
  members: Member[],
  plannedTalks: Talk[],
  options: {
    gapMonths?: number
    onlyActive?: boolean
    minAge?: number
    includeMission?: boolean
    now?: Date
  } = {},
): TalkCandidate[] {
  const {
    gapMonths = 18,
    onlyActive = true,
    minAge = 0,
    includeMission = false,
    now = new Date(),
  } = options
  const upcomingTalks = upcomingTalksByMember(plannedTalks, members, now)

  return members
    .map((member) => ({ member, age: getAge(member.birthDate), mission: missionOf(member, now) }))
    .filter(({ member, age, mission }) => {
      if (onlyActive && member.status !== 'active') return false
      if (minAge > 0 && age !== null && age < minAge) return false
      if (!includeMission && mission?.phase === 'away') return false
      return true
    })
    .map(({ member, age, mission }) => {
      const upcoming = upcomingTalks.get(member.id) ?? null
      const months = upcoming ? 0 : monthsSince(member.lastTalkDate)
      const alreadyPlanned = upcoming !== null
      const availability = talkAvailability(member, now)
      const onHold = !availability.available
      const onMission = mission?.phase === 'away'

      // Noch nie gesprochen erhält bewusst mehr Gewicht als der reine Zeitabstand.
      let score = months === null ? gapMonths * 2 + 24 : months
      if (alreadyPlanned) score -= 1000
      // Ausgenommene stehen auch dann zuunterst, wenn sie eingeblendet
      // werden – sie sind die Antwort auf «wer kommt sonst noch in Frage?».
      if (onHold) score -= 2000
      if (onMission) score -= 4000

      return {
        member,
        age,
        monthsSince: months,
        lastTalkYear: upcoming
          ? upcoming.date.getFullYear()
          : (toDate(member.lastTalkDate)?.getFullYear() ?? null),
        alreadyPlanned,
        upcoming,
        onHold,
        holdUntil: onHold ? availability.until : null,
        onMission,
        missionUntil: onMission ? (mission?.until ?? null) : null,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/* ------------------------------------------------------------------ */
/* Filter                                                              */
/* ------------------------------------------------------------------ */

export type TalkGenderFilter = 'all' | 'f' | 'm'

/**
 * «Noch nie gesprochen» als Jahrzahl.
 *
 * Damit bleibt die Auswahl eine einzige Liste von Zahlen, statt daneben noch
 * einen Sonderfall zu führen – und das Jahr 0 kommt in keinem Verlauf vor.
 */
export const NEVER_SPOKE = 0

export interface TalkCandidateFilter {
  search: string
  /** Nur, wer seit über `gapMonths` Monaten nicht mehr dran war */
  onlyOverdue: boolean
  /** Erst ab dem Mindestalter aus den Einstellungen */
  minAge: boolean
  onlyActive: boolean
  gender: TalkGenderFilter
  /** Jahre der letzten Ansprache; leer heisst «alle». `0` = noch nie gesprochen */
  years: number[]
  /** Ausgenommene mitzeigen */
  showOnHold: boolean
}

/**
 * Womit die Liste aufgeht.
 *
 * Die drei Haken sind gesetzt, weil sie die Frage der Seite stellen: Wer aus
 * der Gemeinde ist erwachsen, aktiv und lange nicht dran gewesen? Alles
 * Weitere ist offen – und wer ausgenommen wurde, bleibt aussen vor.
 */
export const DEFAULT_TALK_FILTER: TalkCandidateFilter = {
  search: '',
  onlyOverdue: true,
  minAge: true,
  onlyActive: true,
  gender: 'all',
  years: [],
  showOnHold: false,
}

/**
 * Wie viele Filter von der Voreinstellung abweichen.
 *
 * Steht am Knopf, damit ein gesetzter Filter auch dann sichtbar ist, wenn das
 * Menü zu ist – sonst sucht man den Grund für eine kurze Liste im Bestand
 * statt in der eigenen Auswahl. Die Namenssuche zählt nicht mit: Sie steht
 * sichtbar daneben.
 */
export function activeTalkFilterCount(filter: TalkCandidateFilter): number {
  let count = 0
  if (filter.onlyOverdue !== DEFAULT_TALK_FILTER.onlyOverdue) count++
  if (filter.minAge !== DEFAULT_TALK_FILTER.minAge) count++
  if (filter.onlyActive !== DEFAULT_TALK_FILTER.onlyActive) count++
  if (filter.gender !== 'all') count++
  if (filter.years.length > 0) count++
  if (filter.showOnHold) count++
  return count
}

/**
 * Die Vorschlagsliste eingrenzen.
 *
 * Zuständig für alles, was die **Anzeige** betrifft. Wer überhaupt bewertet
 * wird – Mindestalter und «nur Aktive» –, entscheidet `rankTalkCandidates`;
 * beide Angaben stehen im selben Filter und werden dort hineingereicht.
 *
 * Eine gewählte Jahrzahl sticht «nur seit über X Monaten»: Wer 2025 zuletzt
 * gesprochen hat, ist per Definition nicht überfällig – die Frage liesse sich
 * sonst gar nicht stellen.
 */
export function filterTalkCandidates(
  candidates: TalkCandidate[],
  filter: TalkCandidateFilter,
  gapMonths: number,
): TalkCandidate[] {
  const byYear = filter.years.length > 0
  return candidates.filter((candidate) => {
    // Auch «Ausgenommene zeigen» holt niemanden von der Mission zurück.
    if (candidate.onMission) return false
    if (candidate.onHold && !filter.showOnHold) return false

    if (byYear) {
      const year = candidate.lastTalkYear ?? NEVER_SPOKE
      if (!filter.years.includes(year)) return false
    } else if (filter.onlyOverdue) {
      if (candidate.monthsSince !== null && candidate.monthsSince < gapMonths) return false
    }

    if (filter.gender !== 'all' && candidate.member.gender !== filter.gender) return false

    if (filter.search.trim()) {
      const name = `${candidate.member.firstName} ${candidate.member.lastName}`
      if (!matchesSearch(name, filter.search)) return false
    }
    return true
  })
}

/**
 * Die Jahre, die in dieser Liste überhaupt vorkommen – für die Auswahl.
 *
 * Aus dem Bestand und nicht aus dem Kalender: Ein Jahr, in dem niemand
 * gesprochen hat, wäre eine Auswahl, die zu nichts führt. Das jüngste steht
 * zuoberst, «noch nie» führt die Liste an – es ist die dringendste Antwort.
 */
export function talkYearOptions(candidates: TalkCandidate[]): number[] {
  const years = new Set<number>()
  let never = false
  for (const candidate of candidates) {
    if (candidate.lastTalkYear === null) never = true
    else years.add(candidate.lastTalkYear)
  }
  const sorted = [...years].sort((a, b) => b - a)
  return never ? [NEVER_SPOKE, ...sorted] : sorted
}

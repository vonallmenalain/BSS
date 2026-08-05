import { useMemo } from 'react'

import { Award, ChevronRight, Search, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberLink } from '@/components/ui/MemberLink'
import { useCallings } from '@/hooks/useFirestore'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Pickers'
import { CallingStatusBadge, MemberStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { MenuChoice, MenuDivider, MenuRange, MenuSort, ViewMenu } from '@/components/ui/ViewMenu'
import { getAge, toDate } from '@/lib/dates'
import { cn, compareNames, groupBy, matchesSearch } from '@/lib/utils'
import { activeCallings, callingPeriod, isWardCalling } from '@/services/callings'
import { filterMembers, sortMembers, type MemberSortKey } from '@/services/members'
import {
  CALLING_AUDIENCE_LABELS,
  CALLING_SCOPE_LABELS,
  CALLING_SORT_LABELS,
  DEFAULT_CALLINGS_VIEW,
  GENDER_SCOPE_LABELS,
  ORGANIZATION_LABELS,
  type Calling,
  type CallingAudience,
  type CallingScope,
  type CallingSort,
  type CallingsView,
  type Gender,
  type Member,
  type SortDirection,
} from '@/lib/types'

/** Woher der Weg kam – damit «Zurück» im Profil hierher führt. */
const FROM_LABEL = 'Berufungen'

/**
 * Wonach die Liste «Ohne Berufung» geordnet wird.
 *
 * Dort stehen Personen und keine Berufungen: «Bezeichnung» und «Bestätigung»
 * gibt es nicht, und sie fallen auf den Namen zurück, statt eine Ordnung zu
 * behaupten, die keine ist.
 */
const MEMBER_SORT_FOR: Record<CallingSort, MemberSortKey> = {
  organization: 'name',
  name: 'name',
  position: 'name',
  age: 'age',
  sustained: 'name',
}

export function Callings() {
  /*
   * Grosszügig bemessen: Die Seite zählt und filtert selbst, und seit die
   * Berufungshistorie mitkommt, umfasst der Bestand einer Gemeinde leicht
   * einige hundert Einträge. Ein zu kleiner Ausschnitt liesse ausgerechnet
   * die laufenden Berufungen verschwinden – sie sind die ältesten.
   *
   * Für «ohne Berufung» hängt daran mehr als die Vollständigkeit einer
   * Liste: Eine fehlende Berufung liesse ihren Träger dort auftauchen, als
   * hätte er keine. Der Ausschnitt nimmt die zuletzt geänderten Einträge –
   * und der Import berührt jedes Mal den ganzen laufenden Bestand. Was
   * gerade gilt, steht damit zuvorderst; abgeschnitten wird höchstens
   * Vergangenheit.
   */
  const { data: callings, loading: callingsLoading } = useCallings(2000)
  const { members, membersById, loading: membersLoading } = useData()
  /* Die Suche steht in der Adresse – damit «Zurück» aus einem Profil
     dieselbe Liste wiederfindet (siehe `hooks/useUrlState`). Alles Übrige
     steht hinter «Ansicht» und bleibt am Gerät. */
  const [search, setSearch] = useUrlState<string>('suche', '')
  const [stored, setView] = useLocalStorage<CallingsView>(
    'bss:berufungen:ansicht',
    DEFAULT_CALLINGS_VIEW,
  )
  // Fehlende Angaben aus einer früheren Fassung mit der Vorgabe auffüllen.
  const view = useMemo(() => ({ ...DEFAULT_CALLINGS_VIEW, ...stored }), [stored])
  const scope = view.scope

  const loading = callingsLoading || membersLoading

  /**
   * Ob eine Berufung zur eingestellten Personengruppe gehört.
   *
   * Ohne Einschränkung bleibt jede Berufung sichtbar – auch die von jemandem,
   * der im Verzeichnis nicht (mehr) steht: Über seinen Status lässt sich
   * nichts sagen, und ihn stillschweigend verschwinden zu lassen wäre das
   * Schlechtere. Sobald aber nach Geschlecht oder Alter eingeschränkt wird,
   * fällt heraus, wer sich nicht zuordnen lässt – sonst stünde in einer
   * Liste «nur Frauen» am Ende doch jemand ohne Datensatz.
   */
  const personFilter = useMemo(() => {
    const restricted = view.gender !== 'all' || view.minAge != null || view.maxAge != null
    return (memberId: string) => {
      const member = membersById.get(memberId)
      if (view.audience === 'active' && member && member.status !== 'active') return false
      if (!restricted) return true
      if (!member) return false
      if (view.gender !== 'all' && member.gender !== view.gender) return false
      const age = getAge(member.birthDate)
      if (view.minAge != null && (age === null || age < view.minAge)) return false
      if (view.maxAge != null && (age === null || age > view.maxAge)) return false
      return true
    }
  }, [membersById, view.audience, view.gender, view.minAge, view.maxAge])

  const pool = useMemo(
    () => callings.filter((calling) => personFilter(calling.memberId)),
    [callings, personFilter],
  )

  const running = useMemo(() => activeCallings(pool), [pool])
  const released = useMemo(() => pool.filter(isReleased), [pool])

  /*
   * Mitglieder ohne laufende Berufung.
   *
   * Gezählt wird gegen den **ganzen** Bestand und nicht gegen die gewählte
   * Gruppe: Wer eine Berufung hat, hat sie auch dann, wenn seine Berufung
   * gerade ausgeblendet ist. Berufungen ausserhalb der Einheit – Pfahl,
   * Seminar, Institut – zählen mit; auch sie sind eine Aufgabe.
   */
  const withoutCalling = useMemo(() => {
    const busy = new Set(activeCallings(callings).map((calling) => calling.memberId))
    const remaining = members.filter((member) => !busy.has(member.id))
    return sortMembers(
      filterMembers(remaining, {
        status: view.audience === 'active' ? 'active' : 'all',
        gender: view.gender,
        minAge: view.minAge,
        maxAge: view.maxAge,
      }),
      MEMBER_SORT_FOR[view.sort],
      view.direction,
    )
  }, [
    members,
    callings,
    view.audience,
    view.gender,
    view.minAge,
    view.maxAge,
    view.sort,
    view.direction,
  ])

  const counts = useMemo(
    () => ({
      active: running.length,
      without: withoutCalling.length,
      released: released.length,
      all: pool.length,
    }),
    [running, withoutCalling, released, pool],
  )

  const visible = useMemo(() => {
    if (scope === 'without') return []
    const base = scope === 'active' ? running : scope === 'released' ? released : pool

    if (!search.trim()) return base
    return base.filter((calling) =>
      matchesSearch(
        `${calling.memberName} ${calling.position} ${ORGANIZATION_LABELS[calling.organization]}`,
        search,
      ),
    )
  }, [pool, running, released, scope, search])

  const visibleMembers = useMemo(() => {
    if (!search.trim()) return withoutCalling
    return withoutCalling.filter((member) =>
      matchesSearch(`${member.firstName} ${member.lastName}`, search),
    )
  }, [withoutCalling, search])

  /*
   * Nach Organisation bleibt die Liste in Sparten – jede andere Ordnung macht
   * daraus eine einzige.
   *
   * Anders ginge es nicht: «Alle nach Alter» hat keine Antwort, solange die
   * Sparten dazwischenstehen; man läse fünf kurze Listen statt einer. In der
   * flachen Liste steht dafür die Organisation bei jedem Eintrag – sonst
   * ginge unterwegs verloren, wohin eine Berufung gehört.
   */
  const grouped = view.sort === 'organization'
  const factor = view.direction === 'asc' ? 1 : -1

  const sortCallings = (entries: Calling[]): Calling[] => {
    const ageOf = (calling: Calling) => getAge(membersById.get(calling.memberId)?.birthDate)
    const sustainedAt = (calling: Calling) => toDate(calling.sustainedDate)?.getTime() ?? null
    /** Ohne Angabe immer ans Ende – in beide Richtungen. */
    const missingLast = (a: number | null, b: number | null, compare: () => number) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return compare()
    }

    const sorted = [...entries]
    switch (view.sort) {
      case 'name':
        return sorted.sort((a, b) => factor * compareNames(a.memberName, b.memberName))
      case 'position':
        return sorted.sort((a, b) => factor * compareNames(a.position, b.position))
      case 'age':
        return sorted.sort((a, b) => {
          const left = ageOf(a)
          const right = ageOf(b)
          return missingLast(left, right, () => factor * (left! - right!))
        })
      case 'sustained':
        return sorted.sort((a, b) => {
          const left = sustainedAt(a)
          const right = sustainedAt(b)
          return missingLast(left, right, () => factor * (left! - right!))
        })
      default:
        // Innerhalb einer Sparte gilt die Reihenfolge des LCR.
        return sorted.sort(compareByImportOrder)
    }
  }

  // Zwei Sparten. Der Sonntagsschulpräsident des Pfahls ist nicht der
  // Sonntagsschulpräsident der Gemeinde – nebeneinander in derselben Liste
  // sähen sie aber genau so aus.
  const byOrganization = useMemo(() => {
    if (!grouped) return []
    const sections = groupBy(visible.filter(isWardCalling), (calling) => calling.organization)
    return [...sections.entries()].sort(
      ([a], [b]) => factor * compareNames(ORGANIZATION_LABELS[a], ORGANIZATION_LABELS[b]),
    )
  }, [visible, grouped, factor])

  const outsideUnit = useMemo(
    () => (grouped ? visible.filter((calling) => !isWardCalling(calling)) : []),
    [visible, grouped],
  )

  return (
    <>
      {/* Kein Knopf für eine neue Berufung, kein Bearbeiten, kein Löschen:
          Wer welche Berufung hat, sagt das LCR. Von Hand nachgeführt hiesse,
          zwei Stände nebeneinander zu führen – und der eine wäre falsch. */}
      <PageHeader
        title="Berufungen"
        actions={<CallingsMenu view={view} counts={counts} onChange={setView} />}
      />

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          className="input pl-9"
          placeholder={scope === 'without' ? 'Name suchen …' : 'Name, Position, Organisation …'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : scope === 'without' ? (
        <WithoutCallingSection
          entries={visibleMembers}
          callings={callings}
          searching={Boolean(search.trim())}
          hasMembers={members.length > 0}
        />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Award}
            title={callings.length === 0 ? 'Noch keine Berufungen erfasst' : 'Nichts gefunden'}
            description={
              callings.length === 0
                ? 'Die Berufungen kommen aus dem LCR: «Einstellungen › Importe › Berufungen», eingefügt aus der Zwischenablage.'
                : 'Passe die Suche an oder lockere unter «Ansicht» die Filter.'
            }
          />
        </div>
      ) : grouped ? (
        <div className="space-y-5">
          {byOrganization.map(([organization, entries]) => (
            <CallingSection
              key={organization}
              title={ORGANIZATION_LABELS[organization]}
              entries={sortCallings(entries)}
            />
          ))}

          {outsideUnit.length > 0 && (
            <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
              <CallingSection
                title="Ausserhalb der Einheit"
                hint="Pfahl, Seminar, Institut und Mission – nicht Teil des Organisationsplans der Gemeinde."
                entries={sortCallings(outsideUnit)}
              />
            </div>
          )}
        </div>
      ) : (
        <CallingSection
          title={`Nach ${CALLING_SORT_LABELS[view.sort]}`}
          hint="Alle Sparten in einer Liste – die Organisation steht bei jedem Eintrag."
          entries={sortCallings(visible)}
          showOrganization
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/** Entlassen oder abgelehnt – die Berufung ist vorbei. */
function isReleased(calling: Calling): boolean {
  return calling.status === 'released' || calling.status === 'declined'
}

/**
 * Reihenfolge innerhalb einer Organisation – wie im LCR.
 *
 * Dort steht zuoberst der Präsident, dann die Ratgeber, dann die übrigen.
 * Das ist die Ordnung, in der die Bischofschaft eine Organisation denkt;
 * alphabetisch sortiert stünde der Bischof unter «B» zwischen den Lehrern.
 *
 * Berufungen aus einem älteren Import tragen keine Nummer. Sie kommen ans
 * Ende und sind dort nach Bezeichnung geordnet – irgendwo müssen sie hin,
 * und hinten stören sie die eingelesene Ordnung nicht.
 */
function compareByImportOrder(a: Calling, b: Calling): number {
  const left = a.order ?? Number.MAX_SAFE_INTEGER
  const right = b.order ?? Number.MAX_SAFE_INTEGER
  return left - right || compareNames(a.position, b.position)
}

/* ------------------------------------------------------------------ */

/** Eine Sparte der Berufungsliste – eine Organisation oder der Bereich ausserhalb. */
function CallingSection({
  title,
  hint,
  entries,
  showOrganization = false,
}: {
  title: string
  hint?: string
  entries: Calling[]
  /** In der flachen Liste: die Organisation bei jedem Eintrag mitschreiben */
  showOrganization?: boolean
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title} ({entries.length})
      </h2>
      {hint && <p className="hint mb-2">{hint}</p>}
      <ul className={cn('card divide-list overflow-hidden', !hint && 'mt-2')}>
        {entries.map((calling) => (
          <li key={calling.id}>
            {/* Der Griff auf eine Zeile führt zur Person: Was die App hier
                beantworten kann, ist «wer ist das?» – und das steht im
                Profil, mitsamt allem, was diese Person sonst noch tut. */}
            <MemberLink
              memberId={calling.memberId}
              label={FROM_LABEL}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Avatar name={calling.memberName} id={calling.memberId} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{calling.position}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  <span className="group-hover:underline">{calling.memberName}</span>
                  {showOrganization && ` · ${ORGANIZATION_LABELS[calling.organization]}`}
                  {callingPeriod(calling) && ` · ${callingPeriod(calling)}`}
                </p>
              </div>
              <CallingStatusBadge status={calling.status} />
              <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
            </MemberLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Wer keine Berufung hat.
 *
 * Die Liste beantwortet die Frage, die vor jeder Berufung steht – und sie
 * beantwortet sie ehrlich: Sie enthält die ganze Gemeinde, Kinder
 * eingeschlossen. Deshalb steht das Alter dabei, und deshalb gibt es den
 * Umschalter auf «nur Aktive».
 */
function WithoutCallingSection({
  entries,
  callings,
  searching,
  hasMembers,
}: {
  entries: Member[]
  callings: Calling[]
  searching: boolean
  /** Ob überhaupt Mitglieder erfasst sind – sonst hiesse «alle haben eine». */
  hasMembers: boolean
}) {
  const lastCallings = useMemo(() => lastReleasedByMember(callings), [callings])

  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Users}
          title={
            !hasMembers
              ? 'Noch keine Mitglieder'
              : searching
                ? 'Nichts gefunden'
                : 'Alle haben eine Berufung'
          }
          description={
            !hasMembers
              ? 'Ohne Mitgliederliste lässt sich nicht sagen, wer keine Berufung hat. Sie kommt unter «Einstellungen › Importe › Mitglieder».'
              : searching
                ? 'Passe Suche oder Filter an.'
                : 'Zu jedem Mitglied dieser Auswahl ist eine laufende Berufung erfasst.'
          }
        />
      </div>
    )
  }

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Ohne Berufung ({entries.length})
      </h2>
      <p className="hint mb-2">
        Mitglieder, zu denen keine laufende Berufung erfasst ist. Berufungen ausserhalb der Einheit
        – Pfahl, Seminar, Institut – zählen mit.
      </p>
      <ul className="card divide-list overflow-hidden">
        {entries.map((member) => {
          const age = getAge(member.birthDate)
          const last = lastCallings.get(member.id)
          const period = last ? callingPeriod(last) : ''
          const facts = [
            age !== null ? `${age} Jahre` : null,
            last ? `zuletzt ${last.position}${period ? ` (${period})` : ''}` : null,
          ].filter(Boolean)

          return (
            <li key={member.id}>
              <MemberLink
                memberId={member.id}
                label={FROM_LABEL}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:underline">
                    {member.lastName}, {member.firstName}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {facts.length > 0 ? facts.join(' · ') : 'Noch keine Berufung erfasst'}
                  </p>
                </div>
                {member.status !== 'active' && <MemberStatusBadge status={member.status} />}
                <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
              </MemberLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Die zuletzt abgegebene Berufung je Person.
 *
 * Sie beantwortet in der Liste «Ohne Berufung» die Frage, die sich sofort
 * stellt: War da schon einmal etwas – und wie lange ist es her?
 */
function lastReleasedByMember(callings: Calling[]): Map<string, Calling> {
  const latest = new Map<string, Calling>()
  for (const calling of callings) {
    if (!isReleased(calling)) continue
    const current = latest.get(calling.memberId)
    if (!current || releasedAt(calling) > releasedAt(current)) latest.set(calling.memberId, calling)
  }
  return latest
}

/** Wann die Berufung endete – ohne erfasstes Datum ganz nach hinten. */
function releasedAt(calling: Calling): number {
  return toDate(calling.releasedDate)?.getTime() ?? 0
}

/* ------------------------------------------------------------------ */
/* Ansicht anpassen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Das Ansichtsmenü der Berufungen.
 *
 * Über der Liste standen bisher zwei Knopfleisten – «Aktuell / Ohne Berufung
 * / Entlassen / Alle» und «Alle Mitglieder / Nur Aktive». Zusammen mit den
 * neuen Einschränkungen nach Geschlecht und Alter wären es vier; sie nähmen
 * am Telefon die halbe erste Bildschirmhöhe ein. Hier stehen sie am selben
 * Ort wie auf jeder anderen Seite.
 */
function CallingsMenu({
  view,
  counts,
  onChange,
}: {
  view: CallingsView
  counts: { active: number; without: number; released: number; all: number }
  onChange: (next: CallingsView) => void
}) {
  const patch = (changes: Partial<CallingsView>) => onChange({ ...view, ...changes })

  return (
    <ViewMenu width="sm:w-80">
      <MenuChoice<CallingScope>
        label="Ausschnitt"
        value={view.scope}
        onChange={(scope) => patch({ scope })}
        options={(Object.keys(CALLING_SCOPE_LABELS) as CallingScope[]).map((value) => ({
          value,
          label: CALLING_SCOPE_LABELS[value],
          count: counts[value],
        }))}
      />

      <MenuChoice<CallingAudience>
        label="Kreis"
        value={view.audience}
        onChange={(audience) => patch({ audience })}
        options={(Object.keys(CALLING_AUDIENCE_LABELS) as CallingAudience[]).map((value) => ({
          value,
          label: CALLING_AUDIENCE_LABELS[value],
        }))}
      />

      <MenuChoice<Gender | 'all'>
        label="Geschlecht"
        value={view.gender}
        onChange={(gender) => patch({ gender })}
        options={[
          { value: 'all', label: GENDER_SCOPE_LABELS.all },
          { value: 'm', label: GENDER_SCOPE_LABELS.m },
          { value: 'f', label: GENDER_SCOPE_LABELS.f },
        ]}
      />

      <MenuRange
        label="Alter"
        from={view.minAge}
        to={view.maxAge}
        onChange={({ from, to }) => patch({ minAge: from, maxAge: to })}
        hint="Beides freilassbar. Wer nicht im Verzeichnis steht, erscheint bei gesetzter Grenze nicht."
      />

      <MenuDivider />

      <MenuSort<CallingSort>
        value={view.sort}
        direction={view.direction}
        onChange={(sort) => patch({ sort })}
        onDirection={(direction: SortDirection) => patch({ direction })}
        options={(Object.keys(CALLING_SORT_LABELS) as CallingSort[]).map((value) => ({
          value,
          label: CALLING_SORT_LABELS[value],
        }))}
      />
    </ViewMenu>
  )
}

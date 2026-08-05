import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Award, ChevronRight, Search, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useCallings } from '@/hooks/useFirestore'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { CallingStatusBadge, MemberStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { getAge, toDate } from '@/lib/dates'
import { cn, compareNames, groupBy, matchesSearch } from '@/lib/utils'
import { activeCallings, callingPeriod, isWardCalling } from '@/services/callings'
import { ORGANIZATION_LABELS, type Calling, type Member } from '@/lib/types'

/**
 * Was die Liste zeigt.
 *
 * `without` fällt aus der Reihe: Dort stehen keine Berufungen, sondern die
 * Personen, zu denen keine gehört – die Frage vor jeder neuen Berufung.
 */
type Scope = 'active' | 'without' | 'released' | 'all'

/** Ob die ganze Gemeinde zählt oder nur, wer aktiv ist. */
type Audience = 'all' | 'active'

/** Woher der Weg kam – damit «Zurück» im Profil hierher führt. */
const FROM_LABEL = 'Berufungen'

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
  const location = useLocation()
  const [scope, setScope] = useState<Scope>('active')
  const [audience, setAudience] = useState<Audience>('all')
  const [search, setSearch] = useState('')

  const loading = callingsLoading || membersLoading
  const from = `${location.pathname}${location.search}`

  /*
   * Der Bestand, auf den die Wahl «alle / nur Aktive» schon angewandt ist.
   *
   * Wer im Verzeichnis nicht (mehr) steht, bleibt sichtbar: Über seinen
   * Status lässt sich nichts sagen, und eine Berufung stillschweigend
   * verschwinden zu lassen wäre das Schlechtere.
   */
  const pool = useMemo(() => {
    if (audience === 'all') return callings
    return callings.filter((calling) => {
      const member = membersById.get(calling.memberId)
      return !member || member.status === 'active'
    })
  }, [callings, audience, membersById])

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
    return members
      .filter((member) => !busy.has(member.id))
      .filter((member) => audience === 'all' || member.status === 'active')
      .sort((a, b) => compareNames(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`))
  }, [members, callings, audience])

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

  // Zwei Sparten. Der Sonntagsschulpräsident des Pfahls ist nicht der
  // Sonntagsschulpräsident der Gemeinde – nebeneinander in derselben Liste
  // sähen sie aber genau so aus.
  const byOrganization = useMemo(() => {
    const grouped = groupBy(visible.filter(isWardCalling), (calling) => calling.organization)
    return [...grouped.entries()].sort(([a], [b]) =>
      compareNames(ORGANIZATION_LABELS[a], ORGANIZATION_LABELS[b]),
    )
  }, [visible])

  const outsideUnit = useMemo(
    () => visible.filter((calling) => !isWardCalling(calling)).sort(compareByImportOrder),
    [visible],
  )

  return (
    <>
      {/* Kein Knopf für eine neue Berufung, kein Bearbeiten, kein Löschen:
          Wer welche Berufung hat, sagt das LCR. Von Hand nachgeführt hiesse,
          zwei Stände nebeneinander zu führen – und der eine wäre falsch. */}
      <PageHeader
        title="Berufungen"
        subtitle="Aus dem LCR übernommen – erfasst wird unter «Einstellungen › Importe»"
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            size="sm"
            options={[
              { value: 'active', label: 'Aktuell', count: counts.active },
              { value: 'without', label: 'Ohne Berufung', count: counts.without },
              { value: 'released', label: 'Entlassen', count: counts.released },
              { value: 'all', label: 'Alle', count: counts.all },
            ]}
          />

          <SegmentedControl<Audience>
            value={audience}
            onChange={setAudience}
            size="sm"
            options={[
              { value: 'all', label: 'Alle Mitglieder' },
              { value: 'active', label: 'Nur Aktive' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : scope === 'without' ? (
        <WithoutCallingSection
          entries={visibleMembers}
          callings={callings}
          from={from}
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
                : 'Passe Suche oder Filter an.'
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {byOrganization.map(([organization, entries]) => (
            <CallingSection
              key={organization}
              title={ORGANIZATION_LABELS[organization]}
              entries={entries.sort(compareByImportOrder)}
              from={from}
            />
          ))}

          {outsideUnit.length > 0 && (
            <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
              <CallingSection
                title="Ausserhalb der Einheit"
                hint="Pfahl, Seminar, Institut und Mission – nicht Teil des Organisationsplans der Gemeinde."
                entries={outsideUnit}
                from={from}
              />
            </div>
          )}
        </div>
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
  from,
}: {
  title: string
  hint?: string
  entries: Calling[]
  from: string
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
            <Link
              to={`/mitglieder/${calling.memberId}`}
              state={{ from, fromLabel: FROM_LABEL }}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Avatar name={calling.memberName} id={calling.memberId} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{calling.position}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  <span className="group-hover:underline">{calling.memberName}</span>
                  {callingPeriod(calling) && ` · ${callingPeriod(calling)}`}
                </p>
              </div>
              <CallingStatusBadge status={calling.status} />
              <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
            </Link>
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
  from,
  searching,
  hasMembers,
}: {
  entries: Member[]
  callings: Calling[]
  from: string
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
              <Link
                to={`/mitglieder/${member.id}`}
                state={{ from, fromLabel: FROM_LABEL }}
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
              </Link>
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

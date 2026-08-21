import { useMemo } from 'react'
import { Mail, Phone, RotateCcw, Search, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { OtherResults } from '@/components/ui/OtherResults'
import { PageHeader } from '@/components/ui/Pickers'
import { MemberStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import {
  MenuAction,
  MenuChips,
  MenuChoice,
  MenuDivider,
  MenuRange,
  MenuSort,
  ViewMenu,
} from '@/components/ui/ViewMenu'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { usePrayers } from '@/hooks/useFirestore'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberLink } from '@/components/ui/MemberLink'
import { formatDate, getAge, monthsSince, toDate } from '@/lib/dates'
import { formatPhone, telHref } from '@/lib/utils'
import { lastPrayerByMember } from '@/services/prayers'
import { filterMembers, sortMembers, type MemberFilter } from '@/services/members'
import {
  DEFAULT_MEMBERS_VIEW,
  GENDER_SCOPE_LABELS,
  hasMemberFilters,
  MEMBER_ORGANIZATION_LABELS,
  MEMBER_SORT_LABELS,
  MEMBER_STATUS_SCOPE_LABELS,
  MEMBERS_FILTER_RESET,
  type Gender,
  type Member,
  type MemberOrganization,
  type MemberSort,
  type MembersView,
  type MemberStatus,
  type SortDirection,
} from '@/lib/types'

export function Members() {
  const { members, settings, loading } = useData()
  /* Für «Gebet zuletzt»: Wann jemand zuletzt gebetet hat, steht nicht am
     Mitglied, sondern in den Gebeten. */
  const { data: prayers } = usePrayers(600)

  /*
   * Die Suche steht in der Adresse.
   *
   * Wer ein Mitglied öffnet und zurückkommt, findet damit dieselbe Liste
   * vor, die er verlassen hat (siehe `hooks/useUrlState`). Alles andere ist
   * eine Einstellung des Geräts und liegt im Browser: Wer nach Alter sortiert
   * arbeitet, will das morgen wieder so vorfinden.
   */
  const [search, setSearch] = useUrlState<string>('suche', '')
  const [stored, setView] = useLocalStorage<MembersView>(
    'bss:mitglieder:ansicht',
    DEFAULT_MEMBERS_VIEW,
  )
  // Fehlende Angaben aus einer früheren Fassung mit der Vorgabe auffüllen.
  const view = useMemo(() => ({ ...DEFAULT_MEMBERS_VIEW, ...stored }), [stored])

  const counts = useMemo(
    () => ({
      all: members.length,
      active: members.filter((m) => m.status === 'active').length,
      inactive: members.filter((m) => m.status !== 'active').length,
    }),
    [members],
  )

  const lastPrayer = useMemo(() => lastPrayerByMember(prayers), [prayers])

  /*
   * Wann die JAE-Liste zuletzt eingelesen wurde.
   *
   * Wer seither achtzehn geworden ist, gilt als JAE, obwohl er noch auf
   * keiner Liste steht – so klafft zwischen zwei Importen keine Lücke
   * (siehe `lib/organizations`).
   */
  const jaeImportedAt = useMemo(
    () => toDate(settings.singlesImportedAt?.jae),
    [settings.singlesImportedAt],
  )

  const searching = search.trim() !== ''

  const visible = useMemo(() => {
    const filter: MemberFilter = {
      search,
      status: view.status,
      gender: view.gender,
      organizations: view.organizations,
      jaeImportedAt,
      minAge: view.minAge,
      maxAge: view.maxAge,
    }
    return sortMembers(filterMembers(members, filter), view.sort, view.direction, lastPrayer)
  }, [members, search, view, lastPrayer, jaeImportedAt])

  /*
   * Wen die Suche findet, den die Filter aber wegnehmen.
   *
   * Der Filter sagt, welchen Ausschnitt der Gemeinde man liest; die Suche
   * fragt nach einer bestimmten Person – und die ist entweder da oder nicht,
   * ganz gleich, ob sie als aktiv geführt wird. Wer «Meier» sucht und nur die
   * Aktiven eingestellt hat, soll nicht erst den Filter zurückstellen müssen,
   * um zu erfahren, dass es einen inaktiven Meier gibt.
   *
   * Gesucht wird deshalb ein zweites Mal, mit **derselben** Suche und ohne
   * jeden Filter; abgezogen wird, was oben schon dasteht.
   */
  const otherHits = useMemo(() => {
    if (!searching) return []
    const shown = new Set(visible.map((member) => member.id))
    const found = filterMembers(members, { search }).filter((member) => !shown.has(member.id))
    return sortMembers(found, view.sort, view.direction, lastPrayer)
  }, [searching, visible, members, search, view.sort, view.direction, lastPrayer])

  return (
    <>
      {/* Kein «Neu»: Das Verzeichnis kommt aus dem LCR und wird dort
          gepflegt – ein von Hand erfasstes Mitglied wäre beim nächsten
          Import entweder doppelt oder ein Datensatz, den niemand
          wiederfindet. Erfasst wird unter «Einstellungen › Importe ›
          Mitglieder». */}
      <PageHeader
        title="Mitglieder"
        subtitle={`${counts.all} Personen erfasst`}
        actions={<MembersMenu view={view} counts={counts} onChange={setView} />}
      />

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          className="input pl-9"
          placeholder="Name, E-Mail, Telefon, Ort …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          {visible.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Users}
                title={members.length === 0 ? 'Noch keine Mitglieder' : 'Nichts gefunden'}
                description={
                  members.length === 0
                    ? 'Die Mitgliederliste kommt aus dem LCR: «Einstellungen › Importe › Mitglieder».'
                    : otherHits.length > 0
                      ? 'In diesem Ausschnitt passt niemand zur Suche – darunter steht, wen sie sonst findet.'
                      : 'Passe die Suche an oder lockere unter «Ansicht» die Filter.'
                }
              />
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                {visible.length} von {members.length} angezeigt
              </p>
              <ul className="card divide-list overflow-hidden">
                {visible.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    lastPrayer={view.sort === 'lastPrayer' ? lastPrayer : undefined}
                  />
                ))}
              </ul>
            </>
          )}

          {/* Was ausserhalb der Filter zur Suche passt – inaktive
              Mitglieder, ein anderes Alter, eine andere Organisation. */}
          {searching && (
            <OtherResults
              items={otherHits}
              listKey={`${search.trim()}|${JSON.stringify(view)}`}
              pageSize={30}
              hint="Diese Personen passen zur Suche, werden aber durch die Filter unter «Ansicht» ausgeblendet – etwa weil sie nicht als aktiv geführt sind."
            >
              {(page) => (
                <ul className="card divide-list overflow-hidden">
                  {page.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      lastPrayer={view.sort === 'lastPrayer' ? lastPrayer : undefined}
                    />
                  ))}
                </ul>
              )}
            </OtherResults>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ein Mitglied in der Liste.
 *
 * Beide Listen zeichnen dieselbe Zeile – die des Ausschnitts und die der
 * Treffer daneben. Zwei Fassungen davon liefen unweigerlich auseinander.
 *
 * `lastPrayer` steht nur da, wo danach geordnet wird: Wer nach dem Gebet
 * sortiert, will auch sehen, wonach – sonst steht die Liste in einer
 * Reihenfolge, die sie nicht ausweist.
 */
function MemberRow({ member, lastPrayer }: { member: Member; lastPrayer?: Map<string, Date> }) {
  const age = getAge(member.birthDate)
  const months = monthsSince(member.lastTalkDate)

  return (
    <li>
      <MemberLink
        memberId={member.id}
        label="Mitglieder"
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {member.lastName}, {member.firstName}
            </span>
            {member.status !== 'active' && <MemberStatusBadge status={member.status} />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
            {age !== null && <span>{age} Jahre</span>}
            {member.city && <span>{member.city}</span>}
            <span>
              {member.lastTalkDate
                ? `Ansprache ${formatDate(member.lastTalkDate)}${
                    months !== null ? ` (vor ${months} Mt.)` : ''
                  }`
                : 'Noch keine Ansprache'}
            </span>
            {lastPrayer && (
              <span>
                {lastPrayer.has(member.id)
                  ? `Gebet ${formatDate(lastPrayer.get(member.id)!)}`
                  : 'Noch kein Gebet'}
              </span>
            )}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              onClick={(event) => event.stopPropagation()}
              className="btn-ghost p-2"
              aria-label={`E-Mail an ${member.firstName} ${member.lastName}`}
              title={member.email}
            >
              <Mail className="size-4" aria-hidden />
            </a>
          )}
          {(member.mobile || member.phone) && (
            <a
              href={telHref(member.mobile || member.phone) ?? '#'}
              onClick={(event) => event.stopPropagation()}
              className="btn-ghost p-2"
              aria-label={`Anrufen: ${member.firstName} ${member.lastName}`}
              title={formatPhone(member.mobile || member.phone)}
            >
              <Phone className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </MemberLink>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Ansicht anpassen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Das Ansichtsmenü der Mitgliederliste.
 *
 * Was früher als Knopfleiste über der Liste stand – Aktiv / Inaktiv / Alle
 * und die Sortierung –, steht jetzt darin, zusammen mit dem, was neu dazu
 * gehört: Geschlecht und Alter. Über der Liste bleibt die Suche und sonst
 * nichts; Filter, die man einmal setzt und lange behält, nehmen der Liste
 * nicht mehr die obersten Zeilen weg.
 */
function MembersMenu({
  view,
  counts,
  onChange,
}: {
  view: MembersView
  counts: { all: number; active: number; inactive: number }
  onChange: (next: MembersView) => void
}) {
  const patch = (changes: Partial<MembersView>) => onChange({ ...view, ...changes })

  return (
    <ViewMenu width="sm:w-80">
      <MenuChoice<MemberStatus | 'all'>
        label="Status"
        value={view.status}
        onChange={(status) => patch({ status })}
        options={[
          { value: 'active', label: MEMBER_STATUS_SCOPE_LABELS.active, count: counts.active },
          { value: 'inactive', label: MEMBER_STATUS_SCOPE_LABELS.inactive, count: counts.inactive },
          { value: 'all', label: MEMBER_STATUS_SCOPE_LABELS.all, count: counts.all },
        ]}
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

      {/* Die Organisation als Chips und nicht als Knopfleiste: Es sind vier
          gleichrangige Gruppen, und «JAE und AE» ist eine gewöhnliche Frage.
          Nichts gewählt heisst «alle» – genau das sagt der erste Chip. */}
      <MenuChips<MemberOrganization>
        label="Organisation"
        values={view.organizations}
        onChange={(organizations) => patch({ organizations })}
        options={(Object.keys(MEMBER_ORGANIZATION_LABELS) as MemberOrganization[]).map((value) => ({
          value,
          label: MEMBER_ORGANIZATION_LABELS[value],
        }))}
        hint="PV und JD/AP ergeben sich aus dem Geburtsdatum. JAE und AE kommen aus den beiden Listen des LCR – «Einstellungen › Importe › Alleinstehende»."
      />

      <MenuRange
        label="Alter"
        from={view.minAge}
        to={view.maxAge}
        onChange={({ from, to }) => patch({ minAge: from, maxAge: to })}
      />

      <MenuAction
        label="Filter zurücksetzen"
        icon={RotateCcw}
        disabled={!hasMemberFilters(view)}
        onClick={() => patch(MEMBERS_FILTER_RESET)}
        hint="Status, Geschlecht, Organisation und Alter – danach steht wieder die ganze Gemeinde da. Die Sortierung bleibt."
      />

      <MenuDivider />

      <MenuSort<MemberSort>
        value={view.sort}
        direction={view.direction}
        onChange={(sort) => patch({ sort })}
        onDirection={(direction: SortDirection) => patch({ direction })}
        options={(Object.keys(MEMBER_SORT_LABELS) as MemberSort[]).map((value) => ({
          value,
          label: MEMBER_SORT_LABELS[value],
        }))}
      />
    </ViewMenu>
  )
}

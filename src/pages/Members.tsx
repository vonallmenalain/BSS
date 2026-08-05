import { useMemo } from 'react'
import { Mail, Phone, Search, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Pickers'
import { MemberStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { MenuChoice, MenuDivider, MenuRange, MenuSort, ViewMenu } from '@/components/ui/ViewMenu'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { usePrayers } from '@/hooks/useFirestore'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberLink } from '@/components/ui/MemberLink'
import { formatDate, getAge, monthsSince } from '@/lib/dates'
import { formatPhone, telHref } from '@/lib/utils'
import { lastPrayerByMember } from '@/services/prayers'
import { filterMembers, sortMembers, type MemberFilter } from '@/services/members'
import {
  DEFAULT_MEMBERS_VIEW,
  GENDER_SCOPE_LABELS,
  MEMBER_SORT_LABELS,
  MEMBER_STATUS_SCOPE_LABELS,
  type Gender,
  type MemberSort,
  type MembersView,
  type MemberStatus,
  type SortDirection,
} from '@/lib/types'

export function Members() {
  const { members, loading } = useData()
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

  const visible = useMemo(() => {
    const filter: MemberFilter = {
      search,
      status: view.status,
      gender: view.gender,
      minAge: view.minAge,
      maxAge: view.maxAge,
    }
    return sortMembers(filterMembers(members, filter), view.sort, view.direction, lastPrayer)
  }, [members, search, view, lastPrayer])

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
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={members.length === 0 ? 'Noch keine Mitglieder' : 'Nichts gefunden'}
            description={
              members.length === 0
                ? 'Die Mitgliederliste kommt aus dem LCR: «Einstellungen › Importe › Mitglieder».'
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
            {visible.map((member) => {
              const age = getAge(member.birthDate)
              const months = monthsSince(member.lastTalkDate)
              return (
                <li key={member.id}>
                  <MemberLink
                    memberId={member.id}
                    label="Mitglieder"
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <Avatar
                      name={`${member.firstName} ${member.lastName}`}
                      id={member.id}
                      size="lg"
                    />

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
                        {/* Wer nach dem Gebet ordnet, will auch sehen, wonach
                            geordnet wurde – sonst steht die Liste in einer
                            Reihenfolge, die sie nicht ausweist. */}
                        {view.sort === 'lastPrayer' && (
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
            })}
          </ul>
        </>
      )}
    </>
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

      <MenuRange
        label="Alter"
        from={view.minAge}
        to={view.maxAge}
        onChange={({ from, to }) => patch({ minAge: from, maxAge: to })}
        hint="Beides freilassbar. Wessen Geburtsdatum fehlt, erscheint bei gesetzter Grenze nicht."
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

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownUp, Mail, Phone, Plus, Search, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { MemberStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { MemberForm } from '@/pages/MemberDetail'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDate, getAge, monthsSince } from '@/lib/dates'
import { formatPhone, telHref } from '@/lib/utils'
import {
  filterMembers,
  sortMembers,
  type MemberFilter,
  type MemberSortKey,
} from '@/services/members'
import type { MemberStatus } from '@/lib/types'

const SORT_OPTIONS: { value: MemberSortKey; label: string }[] = [
  { value: 'name', label: 'Nachname' },
  { value: 'firstName', label: 'Vorname' },
  { value: 'age', label: 'Alter' },
  { value: 'lastTalk', label: 'Letzte Ansprache' },
  { value: 'status', label: 'Status' },
]

export function Members() {
  const { members, loading } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MemberStatus | 'all'>('active')
  const [sortKey, setSortKey] = useLocalStorage<MemberSortKey>('bss:members:sort', 'name')
  const [direction, setDirection] = useLocalStorage<'asc' | 'desc'>('bss:members:dir', 'asc')
  const [formOpen, setFormOpen] = useState(false)

  const counts = useMemo(
    () => ({
      all: members.length,
      active: members.filter((m) => m.status === 'active').length,
      inactive: members.filter((m) => m.status !== 'active').length,
    }),
    [members],
  )

  const visible = useMemo(() => {
    const filter: MemberFilter = { search, status }
    return sortMembers(filterMembers(members, filter), sortKey, direction)
  }, [members, search, status, sortKey, direction])

  return (
    <>
      <PageHeader
        title="Mitglieder"
        subtitle={`${counts.all} Personen erfasst`}
        actions={
          /* Import und Export stehen gesammelt unter «Einstellungen ›
             Importe». Auf dieser Seite geht es um die Personen selbst –
             ein Knopf, der die halbe Liste ersetzen kann, gehört nicht
             neben «Neu». */
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Neu</span>
          </button>
        }
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
            placeholder="Name, E-Mail, Telefon, Ort …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl<MemberStatus | 'all'>
            value={status}
            onChange={setStatus}
            size="sm"
            options={[
              { value: 'active', label: 'Aktiv', count: counts.active },
              { value: 'inactive', label: 'Inaktiv', count: counts.inactive },
              { value: 'all', label: 'Alle', count: counts.all },
            ]}
          />

          <div className="flex items-center gap-1">
            <select
              className="input w-auto py-1.5 text-xs"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as MemberSortKey)}
              aria-label="Sortieren nach"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
              aria-label={direction === 'asc' ? 'Absteigend sortieren' : 'Aufsteigend sortieren'}
              title={direction === 'asc' ? 'Aufsteigend' : 'Absteigend'}
            >
              <ArrowDownUp className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
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
                ? 'Erfasse Personen einzeln – oder übernimm die ganze Liste unter «Einstellungen › Importe».'
                : 'Passe Suche oder Filter an.'
            }
            action={
              members.length === 0 && (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Person erfassen
                </button>
              )
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
                  <Link
                    to={`/mitglieder/${member.id}`}
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
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <MemberForm open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  )
}

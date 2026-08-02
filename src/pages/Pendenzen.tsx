import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { AgendaItemCard } from '@/components/agenda/AgendaItemCard'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDateShort, getDueInfo, toDate } from '@/lib/dates'
import { matchesSearch } from '@/lib/utils'
import { sortForPendenzen } from '@/services/agenda'
import { CATEGORY_LABELS, type AgendaItem, type ItemCategory } from '@/lib/types'

type Scope = 'all' | 'mine' | 'overdue' | 'unassigned'

export function Pendenzen() {
  const { profile } = useAuth()
  const { userName } = useData()
  const navigate = useNavigate()
  const { data: items, loading } = useOpenItems()
  const { data: meetings } = useMeetings(30)

  const [scope, setScope] = useLocalStorage<Scope>('bss:pendenzen:scope', 'all')
  const [category, setCategory] = useState<ItemCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<AgendaItem | null>(null)

  /** Nächste offene Sitzung – Ziel für «auf nächste Sitzung verschieben». */
  const nextMeetingRef = useMemo(() => {
    const next = meetings
      .filter((m) => m.status !== 'closed')
      .map((m) => ({ id: m.id, date: toDate(m.date) }))
      .filter((entry): entry is { id: string; date: Date } => entry.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    return next ?? null
  }, [meetings])

  const meetingLabels = useMemo(() => {
    const map = new Map<string, string>()
    meetings.forEach((meeting) => map.set(meeting.id, formatDateShort(meeting.date)))
    return map
  }, [meetings])

  const counts = useMemo(
    () => ({
      all: items.length,
      mine: items.filter((item) => item.assignees?.includes(profile?.id ?? '')).length,
      overdue: items.filter((item) => getDueInfo(item.dueDate)?.overdue).length,
      unassigned: items.filter((item) => !item.meetingId).length,
    }),
    [items, profile?.id],
  )

  const visible = useMemo(() => {
    let result = items

    if (scope === 'mine') {
      result = result.filter((item) => item.assignees?.includes(profile?.id ?? ''))
    } else if (scope === 'overdue') {
      result = result.filter((item) => getDueInfo(item.dueDate)?.overdue)
    } else if (scope === 'unassigned') {
      result = result.filter((item) => !item.meetingId)
    }

    if (category !== 'all') result = result.filter((item) => item.category === category)

    if (search.trim()) {
      result = result.filter((item) =>
        matchesSearch(
          [item.title, item.description, ...(item.assignees ?? []).map(userName)]
            .filter(Boolean)
            .join(' '),
          search,
        ),
      )
    }

    return sortForPendenzen(result)
  }, [items, scope, category, search, profile?.id, userName])

  const handleOpen = (item: AgendaItem) => {
    if (item.meetingId) navigate(`/sitzungen/${item.meetingId}`)
    else setEditItem(item)
  }

  return (
    <>
      <PageHeader
        title="Pendenzen"
        subtitle="Alles, was noch offen ist – über alle Sitzungen hinweg"
        actions={
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Neu</span>
          </button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'Alle', count: counts.all },
              { value: 'mine', label: 'Meine', count: counts.mine },
              { value: 'overdue', label: 'Überfällig', count: counts.overdue },
              { value: 'unassigned', label: 'Ohne Sitzung', count: counts.unassigned },
            ]}
          />
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filter
          </button>
        </div>

        {showFilters && (
          <div className="card animate-slide-up flex flex-wrap items-end gap-3 p-3">
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="pendenz-search">
                Suchen
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="pendenz-search"
                  type="search"
                  className="input pl-9"
                  placeholder="Titel, Beschreibung, Zuständige …"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="min-w-40">
              <label className="label" htmlFor="pendenz-category">
                Bereich
              </label>
              <select
                id="pendenz-category"
                className="input"
                value={category}
                onChange={(event) => setCategory(event.target.value as ItemCategory | 'all')}
              >
                <option value="all">Alle Bereiche</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CheckCircle2}
            title={items.length === 0 ? 'Keine offenen Pendenzen' : 'Nichts gefunden'}
            description={
              items.length === 0
                ? 'Alles erledigt – sehr gut.'
                : 'Kein Eintrag passt zu den gewählten Filtern.'
            }
            action={
              items.length === 0 && (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Traktandum erfassen
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <AgendaItemCard
              key={item.id}
              item={item}
              onOpen={handleOpen}
              onEdit={setEditItem}
              nextMeeting={nextMeetingRef}
              meetingLabel={item.meetingId ? meetingLabels.get(item.meetingId) : undefined}
            />
          ))}
        </div>
      )}

      <AgendaItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meetingId={null}
      />

      <AgendaItemForm
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        item={editItem}
        meetingId={editItem?.meetingId ?? null}
      />
    </>
  )
}

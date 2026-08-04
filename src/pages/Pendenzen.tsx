import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Plus, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { AgendaItemRow } from '@/components/agenda/AgendaItemRow'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDateShort, getDueInfo, toDate } from '@/lib/dates'
import { matchesSearch } from '@/lib/utils'
import { sortForPendenzen } from '@/services/agenda'
import { toItemKind } from '@/lib/types'

type Scope = 'all' | 'mine' | 'overdue' | 'unassigned'

/** Der aufgeklappte Eintrag steht in der Adresse – so führt «Zurück» hierher. */
const OPEN_PARAM = 'pendenz'

export function Pendenzen() {
  const { profile } = useAuth()
  const { userName } = useData()
  const { data: items, loading } = useOpenItems()
  const { data: meetings } = useMeetings(30)

  const [scope, setScope] = useLocalStorage<Scope>('bss:pendenzen:scope', 'all')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const openId = searchParams.get(OPEN_PARAM)
  const toggleOpen = (id: string) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (next.get(OPEN_PARAM) === id) next.delete(OPEN_PARAM)
        else next.set(OPEN_PARAM, id)
        return next
      },
      { replace: true },
    )

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
  }, [items, scope, search, profile?.id, userName])

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

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input pl-9"
            aria-label="Pendenzen durchsuchen"
            placeholder="Titel, Beschreibung, Zuständige …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
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
                : 'Kein Eintrag passt zur Suche oder zum gewählten Ausschnitt.'
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
        /* Aufgeklappt steht alles da und lässt sich unmittelbar ändern –
           für Titel und Beschreibung genügt ein Griff in den Text. */
        <ul className="space-y-2">
          {visible.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              expanded={openId === item.id}
              onToggle={() => toggleOpen(item.id)}
              nextMeeting={nextMeetingRef}
              showKind={toItemKind(item) === 'pendenz'}
              meetingLabel={item.meetingId ? meetingLabels.get(item.meetingId) : undefined}
              meetingHref={
                item.meetingId
                  ? `/sitzungen/${item.meetingId}?${FOCUS_PARAM}=${item.id}`
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      <AgendaItemForm open={formOpen} onClose={() => setFormOpen(false)} meetingId={null} />
    </>
  )
}

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { AgendaItemRow } from '@/components/agenda/AgendaItemRow'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDateShort, toDate } from '@/lib/dates'
import { layoutToText } from '@/lib/layout'
import { matchesSearch } from '@/lib/utils'
import { sortForPendenzen } from '@/services/agenda'
import { toItemKind } from '@/lib/types'

type Scope = 'all' | 'mine'

/** Der aufgeklappte Eintrag steht in der Adresse – so führt «Zurück» hierher. */
const OPEN_PARAM = 'pendenz'

/**
 * Offene Pendenzen über alle Sitzungen hinweg.
 *
 * Eine Übersicht, kein Eingabeort: Erfasst wird in der Sitzung, denn dort
 * gehört ein Punkt hin. Hier steht nur, was eine Sitzung überstanden hat,
 * ohne erledigt zu werden – ein neu erfasstes Traktandum erscheint erst,
 * wenn seine Sitzung abgeschlossen ist und der Haken fehlt.
 *
 * Fast alles trägt dabei den Namen seiner Sitzung. Ohne Sitzung steht nur,
 * was zwischen zwei Terminen liegt: Die letzte Sitzung ist abgeschlossen,
 * die nächste noch nicht geplant. Sobald eine geplant ist, lässt sich das
 * mit einem Griff nachholen («Pendenzen übernehmen» in der Sitzung).
 */
export function Pendenzen() {
  const { profile } = useAuth()
  const { userName, memberName } = useData()
  const { data: items, loading } = useOpenItems()
  const { data: meetings } = useMeetings(30)

  const [scope, setScope] = useLocalStorage<Scope>('bss:pendenzen:scope', 'all')
  const [search, setSearch] = useState('')
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

  /*
   * Nur Pendenzen – neue Traktanden bleiben in ihrer Sitzung.
   *
   * Ein Punkt, der eben für die kommende Sitzung erfasst wurde, ist nichts
   * Liegengebliebenes. Stünde er hier, wäre diese Liste eine zweite Ansicht
   * derselben Sitzung, und die Frage «was ist offen geblieben?» beantwortete
   * sie nicht mehr. Zur Pendenz wird ein Traktandum genau dann, wenn seine
   * Sitzung abgeschlossen wird und der Haken fehlt (siehe `closeMeeting`).
   */
  const pendenzen = useMemo(() => items.filter((item) => toItemKind(item) === 'pendenz'), [items])

  const counts = useMemo(
    () => ({
      all: pendenzen.length,
      mine: pendenzen.filter((item) => item.assignees?.includes(profile?.id ?? '')).length,
    }),
    [pendenzen, profile?.id],
  )

  const visible = useMemo(() => {
    let result = pendenzen

    if (scope === 'mine') {
      result = result.filter((item) => item.assignees?.includes(profile?.id ?? ''))
    }

    if (search.trim()) {
      result = result.filter((item) =>
        matchesSearch(
          [
            item.title,
            item.description,
            // Wer statt einer Beschreibung ein Raster gebaut hat, soll es
            // trotzdem wiederfinden – gesucht wird im ganzen Eintrag.
            item.layout
              ? layoutToText(item.layout, (id) => {
                  const user = userName(id)
                  return user === 'Unbekannt' ? memberName(id) : user
                })
              : '',
            ...(item.assignees ?? []).map(userName),
          ]
            .filter(Boolean)
            .join(' '),
          search,
        ),
      )
    }

    return sortForPendenzen(result)
  }, [pendenzen, scope, search, profile?.id, userName, memberName])

  return (
    <>
      <PageHeader
        title="Pendenzen"
        subtitle="Was eine Sitzung überstanden hat, ohne erledigt zu werden"
      />

      <div className="mb-4 space-y-3">
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Alle', count: counts.all },
            { value: 'mine', label: 'Meine', count: counts.mine },
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
            title={pendenzen.length === 0 ? 'Keine offenen Pendenzen' : 'Nichts gefunden'}
            description={
              pendenzen.length === 0
                ? 'Alles erledigt – sehr gut. Neue Punkte werden in der Sitzung erfasst.'
                : 'Kein Eintrag passt zur Suche oder zum gewählten Ausschnitt.'
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
    </>
  )
}

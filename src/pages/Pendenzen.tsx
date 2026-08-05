import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, Plus, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useDoneItems, useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { AgendaItemRow } from '@/components/agenda/AgendaItemRow'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { AddButton, MenuSection, ViewMenu } from '@/components/ui/ViewMenu'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDateLong, formatDateShort, toDate, toDateInput } from '@/lib/dates'
import { layoutToText } from '@/lib/layout'
import { cn, matchesSearch } from '@/lib/utils'
import { lastEditedAt, toItemKind, type AgendaItem, type MeetingStatus } from '@/lib/types'

/** Welcher Ausschnitt gezeigt wird. */
type Scope = 'open' | 'mine' | 'done'

/** «Alle» hiess der offene Ausschnitt früher – alte Merkwerte fallen zurück. */
const SCOPES: Scope[] = ['open', 'mine', 'done']

/**
 * Wonach sortiert und gruppiert wird.
 *
 * Beides in einem: Die Zwischentitel der Liste sind die Tage des
 * Sortierfeldes. Etwas nach dem einen Datum zu ordnen und nach dem anderen zu
 * gruppieren ergäbe eine Liste, deren Überschriften vor- und zurückspringen.
 */
type SortField = 'created' | 'updated'
type SortDir = 'desc' | 'asc'
interface SortState {
  field: SortField
  dir: SortDir
}

/** Ganze Einträge oder nur ihre Titel. */
type Detail = 'titles' | 'full'

const SORT_FIELD_LABELS: Record<SortField, string> = {
  created: 'Erfassungsdatum',
  updated: 'Bearbeitungsdatum',
}

const SORT_DIR_LABELS: Record<SortDir, string> = {
  desc: 'Neuste zuerst',
  asc: 'Älteste zuerst',
}

const DETAIL_LABELS: Record<Detail, string> = {
  titles: 'Nur Titel anzeigen',
  full: 'Alles anzeigen',
}

/** Offen: das zuletzt Erfasste zuoberst. */
const DEFAULT_SORT: SortState = { field: 'created', dir: 'desc' }

/** Erledigt: das zuletzt Abgehakte zuoberst – der Weg zurück nach einem Versehen. */
const DEFAULT_DONE_SORT: SortState = { field: 'updated', dir: 'desc' }

/**
 * Wie viele Einträge auf einmal gezeichnet werden.
 *
 * Aufgeklappt ist jeder Eintrag ein vollständiges Formular; das Archiv zählt
 * nach ein paar Jahren Hunderte davon. Der Rest kommt auf Knopfdruck nach –
 * gesucht wird ohnehin, statt gescrollt.
 */
const PAGE_SIZE: Record<Detail, number> = { titles: 200, full: 50 }

/** Der aufgeklappte Eintrag steht in der Adresse – so führt «Zurück» hierher. */
const OPEN_PARAM = 'pendenz'

/**
 * Nach welchem Datum ein Eintrag einsortiert wird.
 *
 * Fehlt das gefragte Feld – bei allem, was aus dem Import der alten Protokolle
 * stammt –, wird genommen, was der Datensatz sonst hergibt. Ein Eintrag ohne
 * jedes Datum steht am Schluss unter «Ohne Datum».
 */
function sortDate(item: AgendaItem, field: SortField): Date | null {
  if (field === 'created') return toDate(item.createdAt) ?? toDate(lastEditedAt(item))
  // Beim erledigten Punkt ist das zugleich der Moment, in dem er abgehakt
  // wurde: «Erledigt» schreibt beide Zeitstempel.
  //
  // Gefragt ist das Bearbeitungs- und nicht das Änderungsdatum: Umsortieren
  // hebt den Stand des Datensatzes, ist aber keine Bearbeitung – sonst
  // sprängen nach jedem Umsortieren einer Sitzung lauter unveränderte Punkte
  // an den Anfang der Liste (siehe `lastEditedAt`).
  return toDate(lastEditedAt(item)) ?? toDate(item.completedAt) ?? toDate(item.createdAt)
}

/** Ein Tag mit allem, was an ihm erfasst bzw. bearbeitet wurde. */
interface DayGroup {
  key: string
  label: string
  items: AgendaItem[]
}

/**
 * Die sortierte Liste in Tage schneiden.
 *
 * Sie ist bereits nach demselben Feld geordnet – deshalb genügt ein Durchgang:
 * Wechselt der Tag, beginnt ein neuer Abschnitt.
 */
function groupByDay(items: AgendaItem[], field: SortField): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const date = sortDate(item, field)
    const key = date ? toDateInput(date) : 'ohne-datum'
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, label: date ? formatDateLong(date) : 'Ohne Datum', items: [item] })
  }
  return groups
}

/**
 * Offene Pendenzen über alle Sitzungen hinweg – und das Erledigte daneben.
 *
 * Unter «Pendent» steht, was eine Sitzung überstanden hat, ohne erledigt zu
 * werden – ein in der Sitzung erfasstes Traktandum erscheint erst, wenn seine
 * Sitzung abgeschlossen ist und der Haken fehlt.
 *
 * Erfasst wird auch hier: Der Knopf oben rechts fragt zuerst, ob ein
 * **Traktandum** oder eine **Pendenz** entstehen soll. Beides landet in der
 * nächsten Sitzung – das eine als Thema, über das gesprochen wird, das andere
 * als Aufgabe, die dort unter den Pendenzen mitläuft.
 *
 * Fast alles trägt dabei den Namen seiner Sitzung. Ohne Sitzung steht nur,
 * was zwischen zwei Terminen liegt: Die letzte Sitzung ist abgeschlossen,
 * die nächste noch nicht geplant. Sobald eine geplant ist, lässt sich das
 * mit einem Griff nachholen («Pendenzen übernehmen» in der Sitzung).
 *
 * «Erledigt» ist das Gegenstück und der Weg zurück: Wer versehentlich
 * abhakt, findet den Punkt dort zuoberst und öffnet ihn wieder.
 */
export function Pendenzen() {
  const { profile } = useAuth()
  const { userName, memberName } = useData()

  const [storedScope, setScope] = useLocalStorage<Scope>('bss:pendenzen:scope', 'open')
  const scope = SCOPES.includes(storedScope) ? storedScope : 'open'

  const { data: items, loading: openLoading } = useOpenItems()
  // Das Archiv wird erst gelesen, wenn jemand hinsieht.
  const { data: doneItems, loading: doneLoading } = useDoneItems(scope === 'done')
  // Weit zurück, damit auch alte Einträge ihre Sitzung benennen können.
  const { data: meetings } = useMeetings(200)

  /*
   * Sortierung je Ausschnitt gemerkt.
   *
   * Die beiden Listen beantworten verschiedene Fragen: bei den offenen «was
   * kam wann herein?», im Archiv «was habe ich zuletzt abgehakt?». Eine
   * gemeinsame Einstellung wäre nach jedem Wechsel die falsche.
   */
  const [openSort, setOpenSort] = useLocalStorage<SortState>(
    'bss:pendenzen:sortierung',
    DEFAULT_SORT,
  )
  const [doneSort, setDoneSort] = useLocalStorage<SortState>(
    'bss:pendenzen:sortierung:erledigt',
    DEFAULT_DONE_SORT,
  )
  const sort = scope === 'done' ? doneSort : openSort
  const setSort = scope === 'done' ? setDoneSort : setOpenSort

  const [detail, setDetail] = useLocalStorage<Detail>('bss:pendenzen:umfang', 'titles')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  /*
   * Zugeklappt: der eine Eintrag aus der Adresse. Aufgeklappt («Alles
   * anzeigen»): alle – bis auf die, die von Hand zugeklappt wurden. Beim
   * Umschalten beginnt die Ansicht wieder von vorn.
   */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const openId = searchParams.get(OPEN_PARAM)
  const isExpanded = (id: string) => (detail === 'full' ? !collapsed.has(id) : openId === id)

  const toggleOpen = (id: string) => {
    if (detail === 'full') {
      setCollapsed((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      return
    }
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (next.get(OPEN_PARAM) === id) next.delete(OPEN_PARAM)
        else next.set(OPEN_PARAM, id)
        return next
      },
      { replace: true },
    )
  }

  const changeDetail = (next: Detail) => {
    setCollapsed(new Set())
    setDetail(next)
  }

  /**
   * Nächste offene Sitzung.
   *
   * Zwei Aufgaben: Ziel für «auf nächste Sitzung verschieben» – und für alles,
   * was hier neu erfasst wird. Ist keine geplant, landet der Eintrag im
   * Sammelkorb und wird beim Planen der nächsten Sitzung übernommen.
   */
  const nextMeeting = useMemo(() => {
    const next = meetings
      .filter((m) => m.status !== 'closed')
      .map((m) => ({ id: m.id, date: toDate(m.date), status: m.status }))
      .filter(
        (entry): entry is { id: string; date: Date; status: MeetingStatus } => entry.date !== null,
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    return next ?? null
  }, [meetings])

  const nextMeetingRef = useMemo(
    () => (nextMeeting ? { id: nextMeeting.id, date: nextMeeting.date } : null),
    [nextMeeting],
  )

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
   *
   * Im Archiv gilt das nicht: Dort steht, was abgeschlossen wurde – gleich, ob
   * es je liegengeblieben ist.
   */
  const pendenzen = useMemo(() => items.filter((item) => toItemKind(item) === 'pendenz'), [items])

  const counts = useMemo(
    () => ({
      open: pendenzen.length,
      mine: pendenzen.filter((item) => item.assignees?.includes(profile?.id ?? '')).length,
    }),
    [pendenzen, profile?.id],
  )

  /** Was durchsucht wird – der ganze Eintrag, nicht bloss sein Titel. */
  const haystack = useCallback(
    (item: AgendaItem) =>
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
    [userName, memberName],
  )

  const visible = useMemo(() => {
    const base =
      scope === 'done'
        ? doneItems
        : scope === 'mine'
          ? pendenzen.filter((item) => item.assignees?.includes(profile?.id ?? ''))
          : pendenzen

    const found = search.trim()
      ? base.filter((item) => matchesSearch(haystack(item), search))
      : base

    // Ohne Datum ans Ende, in beiden Richtungen: Es steht nicht «vor» dem
    // ältesten Eintrag, es fehlt schlicht.
    return [...found].sort((a, b) => {
      const at = sortDate(a, sort.field)?.getTime()
      const bt = sortDate(b, sort.field)?.getTime()
      if (at === undefined) return bt === undefined ? 0 : 1
      if (bt === undefined) return -1
      return sort.dir === 'asc' ? at - bt : bt - at
    })
  }, [scope, doneItems, pendenzen, profile?.id, search, haystack, sort])

  /*
   * Jede neue Zusammenstellung beginnt wieder oben.
   *
   * Zurückgesetzt wird beim Zeichnen und nicht in einem Effekt: Sonst stünde
   * für einen Durchgang die alte Anzahl an der neuen Liste – und wer von
   * «Nur Titel» auf «Alles» umstellt, bekäme kurz 200 aufgeklappte Einträge.
   */
  const pageSize = PAGE_SIZE[detail]
  const listKey = `${scope}|${detail}|${sort.field}|${sort.dir}|${search.trim()}`
  const [shown, setShown] = useState(pageSize)
  const [shownFor, setShownFor] = useState(listKey)
  if (shownFor !== listKey) {
    setShownFor(listKey)
    setShown(pageSize)
  }

  const groups = useMemo(
    () => groupByDay(visible.slice(0, shown), sort.field),
    [visible, shown, sort.field],
  )
  const rest = Math.max(0, visible.length - shown)

  const loading = scope === 'done' ? doneLoading : openLoading
  const searching = search.trim() !== ''

  return (
    <>
      <PageHeader
        title="Pendenzen"
        subtitle={
          scope === 'done'
            ? 'Abgeschlossene Traktanden und Pendenzen aus früheren Sitzungen'
            : undefined
        }
        actions={
          <>
            <PendenzenMenu
              sort={sort}
              onSortChange={setSort}
              detail={detail}
              onDetailChange={changeDetail}
            />
            <AddButton label="Pendenz" onClick={() => setFormOpen(true)} />
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'open', label: 'Pendent', count: counts.open },
            { value: 'mine', label: 'Meine', count: counts.mine },
            // Ohne Zahl: Das Archiv wird erst gelesen, wenn es gewählt ist –
            // eine 0, die später aufspringt, wäre eine falsche Auskunft.
            { value: 'done', label: 'Erledigt' },
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
            aria-label={scope === 'done' ? 'Erledigtes durchsuchen' : 'Pendenzen durchsuchen'}
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
            title={
              searching
                ? 'Nichts gefunden'
                : scope === 'done'
                  ? 'Noch nichts erledigt'
                  : 'Keine offenen Pendenzen'
            }
            description={
              searching
                ? 'Kein Eintrag passt zur Suche.'
                : scope === 'done'
                  ? 'Hier steht, was abgeschlossen wurde – auch das versehentlich Abgehakte.'
                  : 'Alles erledigt – sehr gut.'
            }
            action={
              !searching &&
              scope !== 'done' && (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Pendenz erfassen
                </button>
              )
            }
          />
        </div>
      ) : (
        /* Ein Abschnitt je Tag: Die Überschrift ist das Datum, nach dem
           sortiert wird – erfasst oder zuletzt bearbeitet. */
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <span className="tabular text-xs text-slate-400">{group.items.length}</span>
              </div>

              {/* Aufgeklappt steht alles da und lässt sich unmittelbar ändern –
                  für Titel und Beschreibung genügt ein Griff in den Text. */}
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <AgendaItemRow
                    key={item.id}
                    item={item}
                    expanded={isExpanded(item.id)}
                    onToggle={() => toggleOpen(item.id)}
                    nextMeeting={nextMeetingRef}
                    meetingLabel={item.meetingId ? meetingLabels.get(item.meetingId) : undefined}
                    meetingHref={
                      item.meetingId
                        ? `/sitzungen/${item.meetingId}?${FOCUS_PARAM}=${item.id}`
                        : undefined
                    }
                    meetingDate={(id) => meetingLabels.get(id)}
                  />
                ))}
              </ul>
            </section>
          ))}

          {rest > 0 && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setShown((current) => current + pageSize)}
            >
              Weitere anzeigen · noch {rest}
            </button>
          )}
        </div>
      )}

      {/* Erfasst wird für die nächste Sitzung. Ist keine geplant, landet der
          Eintrag im Sammelkorb und wird beim Planen mit einem Griff
          übernommen. */}
      <AgendaItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meetingId={nextMeeting?.id ?? null}
        defaultStatus={nextMeeting?.status === 'running' ? 'pending' : 'new'}
        kindChoice
        defaultKind="pendenz"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ansicht anpassen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Sortierung und Umfang der Liste – ein Menü, kein zweiter Umschalter.
 *
 * Es sind drei Einstellungen, die selten geändert werden und die Liste
 * jedesmal ganz umstellen. Als Knopfleiste stünden sie dauerhaft über der
 * Liste und nähmen ihr den Platz; hier stehen sie beisammen und bleiben
 * offen, solange jemand daran dreht.
 */
function PendenzenMenu({
  sort,
  onSortChange,
  detail,
  onDetailChange,
}: {
  sort: SortState
  onSortChange: (next: SortState) => void
  detail: Detail
  onDetailChange: (next: Detail) => void
}) {
  return (
    <ViewMenu width="w-64">
      <MenuSection label="Sortieren nach">
        <div className="-mx-1">
          {(Object.keys(SORT_FIELD_LABELS) as SortField[]).map((field) => (
            <MenuRadio
              key={field}
              label={SORT_FIELD_LABELS[field]}
              selected={sort.field === field}
              onClick={() => onSortChange({ ...sort, field })}
            />
          ))}
        </div>
      </MenuSection>

      <MenuSection label="Reihenfolge">
        <div className="-mx-1">
          {(Object.keys(SORT_DIR_LABELS) as SortDir[]).map((dir) => (
            <MenuRadio
              key={dir}
              label={SORT_DIR_LABELS[dir]}
              selected={sort.dir === dir}
              onClick={() => onSortChange({ ...sort, dir })}
            />
          ))}
        </div>
      </MenuSection>

      <MenuSection label="Einträge">
        <div className="-mx-1">
          {(Object.keys(DETAIL_LABELS) as Detail[]).map((value) => (
            <MenuRadio
              key={value}
              label={DETAIL_LABELS[value]}
              selected={detail === value}
              onClick={() => onDetailChange(value)}
            />
          ))}
        </div>
      </MenuSection>
    </ViewMenu>
  )
}

function MenuRadio({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700',
        selected && 'font-medium',
      )}
    >
      <Check
        className={cn(
          'size-4 shrink-0',
          selected ? 'text-brand-600 dark:text-brand-300' : 'opacity-0',
        )}
        aria-hidden
      />
      {label}
    </button>
  )
}

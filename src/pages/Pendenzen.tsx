import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, Plus, Search } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useDoneItems, useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { AgendaItemRow } from '@/components/agenda/AgendaItemRow'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { AddButton, MenuSection, MenuToggle, ViewMenu } from '@/components/ui/ViewMenu'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useOwnItem } from '@/hooks/useOwnItem'
import { savePendenzenOrder } from '@/services/agenda'
import { saveSettings } from '@/services/settings'
import { formatDateLong, formatDateShort, toDate, toDateInput } from '@/lib/dates'
import { callingChangesToText } from '@/lib/callingChanges'
import { layoutToText } from '@/lib/layout'
import { cn, matchesSearch } from '@/lib/utils'
import {
  DEFAULT_PENDENZEN_DONE_SORT,
  lastEditedAt,
  normalizePendenzenSort,
  PENDENZEN_SORT_LABELS,
  toItemKind,
  type AgendaItem,
  type MeetingStatus,
  type PendenzenSort,
  type PendenzenSortState,
  type SortDirection,
} from '@/lib/types'

/** Welcher Ausschnitt gezeigt wird. */
type Scope = 'open' | 'mine' | 'done'

/** «Alle» hiess der offene Ausschnitt früher – alte Merkwerte fallen zurück. */
const SCOPES: Scope[] = ['open', 'mine', 'done']

/**
 * Die beiden Datumsfelder, nach denen sortiert **und** gruppiert wird.
 *
 * Beides in einem: Die Zwischentitel der Liste sind die Tage des
 * Sortierfeldes. Etwas nach dem einen Datum zu ordnen und nach dem anderen zu
 * gruppieren ergäbe eine Liste, deren Überschriften vor- und zurückspringen.
 *
 * Die dritte Wahl – die von Hand gelegte Reihenfolge – kennt keine Tage und
 * damit auch keine Zwischentitel; sie steht als eine Liste da.
 */
type DateField = Exclude<PendenzenSort, 'manual'>

/** Ganze Einträge oder nur ihre Titel. */
type Detail = 'titles' | 'full'

const SORT_DIR_LABELS: Record<SortDirection, string> = {
  desc: 'Neuste zuerst',
  asc: 'Älteste zuerst',
}

const DETAIL_LABELS: Record<Detail, string> = {
  titles: 'Nur Titel anzeigen',
  full: 'Alles anzeigen',
}

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
function sortDate(item: AgendaItem, field: DateField): Date | null {
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

/**
 * Ein Abschnitt der Liste – ein Tag mit allem, was an ihm erfasst bzw.
 * bearbeitet wurde.
 *
 * `offset` ist der Platz des ersten Eintrags in der ganzen Liste. Ohne ihn
 * wüsste die Zeile beim Umsortieren nicht, an welcher Stelle sie steht: Der
 * Index innerhalb des Abschnitts beginnt bei jedem Titel wieder bei null.
 * `label` bleibt leer, wo es nichts zu überschreiben gibt – bei der von Hand
 * gelegten Reihenfolge.
 */
interface DayGroup {
  key: string
  label: string
  offset: number
  items: AgendaItem[]
}

/**
 * Die sortierte Liste in Tage schneiden.
 *
 * Sie ist bereits nach demselben Datum geordnet – deshalb genügt ein
 * Durchgang: Wechselt der Tag, beginnt ein neuer Abschnitt. Gefragt wird
 * dasselbe `dateOf` wie beim Sortieren; zwei verschiedene Auskünfte ergäben
 * eine Liste, deren Überschriften nicht zu ihrer Reihenfolge passen.
 */
function groupByDay(items: AgendaItem[], dateOf: (item: AgendaItem) => Date | null): DayGroup[] {
  const groups: DayGroup[] = []
  items.forEach((item, index) => {
    const date = dateOf(item)
    const key = date ? toDateInput(date) : 'ohne-datum'
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else {
      groups.push({
        key,
        label: date ? formatDateLong(date) : 'Ohne Datum',
        offset: index,
        items: [item],
      })
    }
  })
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
 * **Sortiert wird für alle gleich.** Nach dem Erfassungs- oder dem
 * Bearbeitungsdatum – dann trägt die Liste die Tage als Zwischentitel – oder
 * in der Reihenfolge, die jemand von Hand gelegt hat. Die Wahl steht in den
 * Einstellungen und nicht im Browser: Am Sitzungstisch schauen alle auf
 * dieselbe Liste, und «der dritte Punkt» soll bei allen der dritte sein.
 *
 * «Erledigt» ist das Gegenstück und der Weg zurück: Wer versehentlich
 * abhakt, findet den Punkt dort zuoberst und öffnet ihn wieder.
 */
export function Pendenzen() {
  const { userName, memberName, settings } = useData()
  const toast = useToast()

  const [storedScope, setScope] = useLocalStorage<Scope>('bss:pendenzen:scope', 'open')
  const scope = SCOPES.includes(storedScope) ? storedScope : 'open'

  const { data: items, loading: openLoading } = useOpenItems()
  // Das Archiv wird erst gelesen, wenn jemand hinsieht.
  const { data: doneItems, loading: doneLoading } = useDoneItems(scope === 'done')
  // Weit zurück, damit auch alte Einträge ihre Sitzung benennen können.
  const { data: meetings } = useMeetings(200)

  /*
   * Sortierung je Ausschnitt – und für alle dieselbe.
   *
   * Sie steht in den Einstellungen und nicht im Browser: Die Bischofschaft
   * geht die Pendenzen gemeinsam durch, und «der dritte Punkt» ist nur dann
   * eine Angabe, wenn er bei allen der dritte ist. Wer hier etwas umstellt,
   * stellt es deshalb für alle um – so wie die Reihenfolge einer
   * Traktandenliste auch für alle gilt.
   *
   * Zwei Einstellungen, weil die beiden Listen verschiedene Fragen
   * beantworten: bei den offenen «was kam wann herein?», im Archiv «was wurde
   * zuletzt abgehakt?». Eine gemeinsame wäre nach jedem Wechsel die falsche.
   */
  const openSort = useMemo(
    () => normalizePendenzenSort(settings.pendenzenSort),
    [settings.pendenzenSort],
  )
  const doneSort = useMemo(() => {
    const stored = normalizePendenzenSort(settings.pendenzenDoneSort, DEFAULT_PENDENZEN_DONE_SORT)
    // Von Hand gelegt wird die Arbeitsliste, nicht das Archiv: Was erledigt
    // ist, wird nachgeschlagen und nicht mehr geordnet. Stünde der Wert
    // trotzdem da (andere Fassung, andere Reihenfolge der Entwicklung), gilt
    // wieder die Vorgabe.
    return stored.field === 'manual'
      ? { ...stored, field: DEFAULT_PENDENZEN_DONE_SORT.field }
      : stored
  }, [settings.pendenzenDoneSort])
  const sort = scope === 'done' ? doneSort : openSort

  const [detail, setDetail] = useLocalStorage<Detail>('bss:pendenzen:umfang', 'titles')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * «Reihenfolge anpassen» – die Pfeile und das Ziehen.
   *
   * Sie sind zu Beginn ausgeschaltet und bleiben es, bis jemand sie im
   * Ansichtsmenü einschaltet: Die Liste wird gelesen und selten umgestellt,
   * und wo an jeder Zeile zwei Pfeile stehen, greift man beim Blättern
   * daneben. Ausgeschaltet verschwinden bloss die Griffe – die gelegte
   * Reihenfolge bleibt.
   *
   * Ein Zustand der Seite und keiner des Kontos: Er sagt, was man **gerade**
   * tut, und nicht, wie die Liste auszusehen hat.
   */
  const [reordering, setReordering] = useState(false)

  const searching = search.trim() !== ''
  const manual = sort.field === 'manual'

  /*
   * Umsortiert wird nur an der **vollständigen** Liste.
   *
   * Geschrieben wird die Position jedes Eintrags; ein Ausschnitt sagt aber
   * nichts darüber, wo das Ausgeblendete steht. Wer unter «Meine» oder in
   * einer Suche zöge, schriebe eine Reihenfolge, die es so nie gab. Deshalb
   * fehlen dort die Griffe – und das Menü sagt, was zu tun ist.
   */
  const sortable = manual && scope === 'open' && !searching
  const reorder = sortable && reordering

  const changeSort = (next: PendenzenSortState) => {
    // Aus der gelegten Reihenfolge heraus braucht es die Griffe nicht mehr;
    // beim nächsten Mal beginnt die Wahl wieder ausgeschaltet.
    if (next.field !== 'manual') setReordering(false)
    void saveSettings(
      scope === 'done' ? { pendenzenDoneSort: next } : { pendenzenSort: next },
    ).catch((error) => {
      console.error(error)
      toast.error('Sortierung konnte nicht gespeichert werden.')
    })
  }

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

  /*
   * «Meine» ist mehr als «mir zugewiesen».
   *
   * Bei einem gewöhnlichen Eintrag bleibt es dabei; eine Berufungsrunde
   * dagegen wird zeilenweise verteilt und gehört auch dem, der darin eine
   * Zeile trägt oder namentlich darin steht (siehe `hooks/useOwnItem`).
   */
  const ownItem = useOwnItem()

  const counts = useMemo(
    () => ({
      open: pendenzen.length,
      mine: pendenzen.filter(ownItem).length,
    }),
    [pendenzen, ownItem],
  )

  /** Was durchsucht wird – der ganze Eintrag, nicht bloss sein Titel. */
  const haystack = useCallback(
    (item: AgendaItem) => {
      // Konten und Mitglieder stehen in denselben Feldern; gesucht wird der
      // Name, gleich woher er kommt.
      const name = (id: string) => {
        const user = userName(id)
        return user === 'Unbekannt' ? memberName(id) : user
      }
      return [
        item.title,
        item.description,
        // Wer statt einer Beschreibung ein Raster gebaut hat oder eine
        // Berufungsrunde führt, soll sie trotzdem wiederfinden – gesucht wird
        // im ganzen Eintrag.
        item.layout ? layoutToText(item.layout, name) : '',
        callingChangesToText(item.callingChanges, name),
        ...(item.assignees ?? []).map(userName),
      ]
        .filter(Boolean)
        .join(' ')
    },
    [userName, memberName],
  )

  /** Der Ausschnitt, aus dem die Liste gezeichnet wird. */
  const pool = useMemo(
    () => (scope === 'done' ? doneItems : scope === 'mine' ? pendenzen.filter(ownItem) : pendenzen),
    [scope, doneItems, pendenzen, ownItem],
  )

  /*
   * Die Liste bleibt stehen, solange jemand in ihr schreibt.
   *
   * Gespeichert wird, während getippt wird: kurz nach dem letzten Tastendruck
   * geht der Eintrag zu Firestore und kommt als geändert zurück. Nach
   * «Bearbeitungsdatum» sortiert heisst das mitten im Satz: Der Eintrag
   * springt an den Anfang und unter die Überschrift von heute, React baut ihn
   * an der neuen Stelle neu auf – und der Cursor ist weg. Genau das war beim
   * Schreiben einer Berufungsrunde nicht auszuhalten.
   *
   * Deshalb gilt, solange der Fokus in der Liste steht, das Datum von vorhin;
   * die Reihenfolge und die Zwischentitel bleiben, wie sie waren. Was
   * geschrieben wird, steht trotzdem sofort da – eingefroren ist die
   * Gliederung, nicht der Inhalt. Sobald das Feld verlassen wird, ordnet sich
   * die Liste in einem Zug neu; dann stört es niemanden.
   */
  const dateField: DateField = sort.field === 'manual' ? 'created' : sort.field

  const freshDates = useMemo(() => {
    const dates = new Map<string, Date | null>()
    pool.forEach((item) => dates.set(item.id, sortDate(item, dateField)))
    return dates
  }, [pool, dateField])

  /**
   * Der Stand von dem Moment, in dem jemand in die Liste griff – oder `null`,
   * solange niemand darin schreibt.
   *
   * Nach welchem Feld damals einsortiert wurde, steht dabei: Wer die
   * Sortierung umstellt, will die neue Reihenfolge sehen und nicht die alte
   * mit neuer Überschrift.
   */
  const [held, setHeld] = useState<{ field: DateField; dates: Map<string, Date | null> } | null>(
    null,
  )

  const dates = held && held.field === dateField ? held.dates : freshDates
  const dateOf = useCallback(
    (item: AgendaItem) => {
      // Was seither dazugekommen ist, kennt der festgehaltene Stand nicht –
      // dafür gilt das Datum, das der Eintrag jetzt trägt. Ein Eintrag ganz
      // ohne Datum steht dort als `null` und ist damit bekannt.
      const known = dates.get(item.id)
      return known === undefined ? sortDate(item, dateField) : known
    },
    [dates, dateField],
  )

  const visible = useMemo(() => {
    const found = search.trim()
      ? pool.filter((item) => matchesSearch(haystack(item), search))
      : pool

    /*
     * Die von Hand gelegte Reihenfolge.
     *
     * Ein Eintrag ohne Position wurde noch nie einsortiert – er steht
     * zuoberst, dort, wo er auch nach «Erfassungsdatum» stünde. So beginnt die
     * Ansicht mit derselben Liste, die man vorher gesehen hat, und eine eben
     * erfasste Pendenz verschwindet nicht am Ende. Ein Griff auf den Pfeil
     * setzt sie dorthin, wo sie hingehört.
     */
    if (sort.field === 'manual') {
      const platz = (item: AgendaItem) =>
        typeof item.pendenzOrder === 'number' ? item.pendenzOrder : null
      const erfasst = (item: AgendaItem) => dateOf(item)?.getTime() ?? 0
      return [...found].sort((a, b) => {
        const links = platz(a)
        const rechts = platz(b)
        if (links === null && rechts === null) return erfasst(b) - erfasst(a)
        if (links === null) return -1
        if (rechts === null) return 1
        return links - rechts
      })
    }

    // Ohne Datum ans Ende, in beiden Richtungen: Es steht nicht «vor» dem
    // ältesten Eintrag, es fehlt schlicht.
    return [...found].sort((a, b) => {
      const at = dateOf(a)?.getTime()
      const bt = dateOf(b)?.getTime()
      if (at === undefined) return bt === undefined ? 0 : 1
      if (bt === undefined) return -1
      return sort.dir === 'asc' ? at - bt : bt - at
    })
  }, [pool, search, haystack, sort, dateOf])

  /*
   * Umsortieren – mit den Pfeilen und durch Ziehen.
   *
   * Beide Wege schreiben dasselbe: die ganze Liste in ihrer neuen Reihenfolge.
   * Danach trägt jeder Eintrag seine Position, und die Liste steht bei allen
   * gleich (siehe `savePendenzenOrder`).
   */
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const move = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= visible.length || to >= visible.length) return
    const next = [...visible]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    try {
      await savePendenzenOrder(next)
    } catch (error) {
      console.error(error)
      toast.error('Reihenfolge konnte nicht gespeichert werden.')
    }
  }

  const drop = (targetId: string) => {
    setOverId(null)
    if (!dragId || dragId === targetId) return
    void move(
      visible.findIndex((item) => item.id === dragId),
      visible.findIndex((item) => item.id === targetId),
    )
    setDragId(null)
  }

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

  /*
   * Die Liste in Abschnitte – oder eben nicht.
   *
   * Nach einem Datum sortiert bekommt jeder Tag seine Überschrift. Die von
   * Hand gelegte Reihenfolge kennt keine Tage: Sie steht als **eine** Liste
   * da, sonst zerschnitte ein Zwischentitel genau die Abfolge, die jemand
   * eben gelegt hat.
   */
  const groups = useMemo(() => {
    const page = visible.slice(0, shown)
    if (sort.field === 'manual') return [{ key: 'manuell', label: '', offset: 0, items: page }]
    return groupByDay(page, dateOf)
  }, [visible, shown, sort.field, dateOf])
  const rest = Math.max(0, visible.length - shown)

  const loading = scope === 'done' ? doneLoading : openLoading

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
              onSortChange={changeSort}
              // Gelegt wird die Reihenfolge der offenen Punkte – im Archiv
              // steht die Wahl deshalb gar nicht erst zur Verfügung.
              manualAllowed={scope !== 'done'}
              sortable={sortable}
              reordering={reordering}
              onReorderingChange={setReordering}
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

        {/* Eingeschaltet, aber gerade nicht möglich: Wer die Griffe sucht,
            soll nicht raten müssen, warum sie fehlen. */}
        {manual && reordering && !sortable && (
          <p className="hint">
            Umsortiert wird unter «Pendent» und ohne Suche – ein Ausschnitt sagt nichts über die
            Reihenfolge der ganzen Liste.
          </p>
        )}
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
           sortiert wird – erfasst oder zuletzt bearbeitet. Von Hand gelegt
           steht die Liste ohne Überschrift da, in einem Stück. */
        <div
          className="space-y-5"
          /* Steht der Fokus in der Liste, wird in ihr geschrieben – dann hält
             sie den Stand von diesem Augenblick fest und ordnet sich nicht um
             (siehe oben). React meldet den Wechsel bis hierher hoch; ein
             Sprung von einem Feld ins nächste bleibt dabei innerhalb der
             Liste und zählt nicht als Verlassen. */
          onFocus={() => setHeld((current) => current ?? { field: dateField, dates: freshDates })}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return
            setHeld(null)
          }}
        >
          {groups.map((group) => (
            <section key={group.key}>
              {group.label && (
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="tabular text-xs text-slate-400">{group.items.length}</span>
                </div>
              )}

              {/* Aufgeklappt steht alles da und lässt sich unmittelbar ändern –
                  für Titel und Beschreibung genügt ein Griff in den Text. */}
              <ul className="space-y-2">
                {group.items.map((item, index) => {
                  /* Der Platz in der ganzen Liste – nicht der im Abschnitt. */
                  const place = group.offset + index
                  return (
                    <AgendaItemRow
                      key={item.id}
                      item={item}
                      /* Die Nummer steht nur an der vollständigen, von Hand
                         gelegten Liste: Dort ist sie die Reihenfolge, auf die
                         sich alle beziehen. In einem Ausschnitt zählte sie
                         bloss den Ausschnitt. */
                      position={sortable ? place + 1 : undefined}
                      expanded={isExpanded(item.id)}
                      onToggle={() => toggleOpen(item.id)}
                      onMove={reorder ? (delta) => void move(place, place + delta) : undefined}
                      first={place === 0}
                      last={place === visible.length - 1}
                      onDragStart={
                        reorder
                          ? (event: DragEvent<HTMLElement>) => {
                              setDragId(item.id)
                              event.dataTransfer.effectAllowed = 'move'
                            }
                          : undefined
                      }
                      onDragOver={
                        reorder
                          ? (event: DragEvent<HTMLElement>) => {
                              if (!dragId) return
                              event.preventDefault()
                              event.dataTransfer.dropEffect = 'move'
                              setOverId(item.id)
                            }
                          : undefined
                      }
                      onDrop={
                        reorder
                          ? (event: DragEvent<HTMLElement>) => {
                              event.preventDefault()
                              drop(item.id)
                            }
                          : undefined
                      }
                      onDragEnd={
                        reorder
                          ? () => {
                              setDragId(null)
                              setOverId(null)
                            }
                          : undefined
                      }
                      dragging={dragId === item.id}
                      dropTarget={overId === item.id && dragId !== item.id}
                      nextMeeting={nextMeetingRef}
                      meetingLabel={item.meetingId ? meetingLabels.get(item.meetingId) : undefined}
                      meetingHref={
                        item.meetingId
                          ? `/sitzungen/${item.meetingId}?${FOCUS_PARAM}=${item.id}`
                          : undefined
                      }
                      meetingDate={(id) => meetingLabels.get(id)}
                    />
                  )
                })}
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
 *
 * Die Sortierung gilt für alle – deshalb steht es auch dort. Der Haken
 * «Reihenfolge anpassen» tut es nicht: Er sagt bloss, dass **hier gerade**
 * umsortiert wird, und wäre bei allen anderen ein Paar Pfeile, um das
 * niemand gebeten hat.
 */
function PendenzenMenu({
  sort,
  onSortChange,
  manualAllowed,
  sortable,
  reordering,
  onReorderingChange,
  detail,
  onDetailChange,
}: {
  sort: PendenzenSortState
  onSortChange: (next: PendenzenSortState) => void
  /** Steht die von Hand gelegte Reihenfolge in dieser Liste zur Wahl? */
  manualAllowed: boolean
  /** Lässt sich hier und jetzt umsortieren – vollständige Liste, keine Suche? */
  sortable: boolean
  reordering: boolean
  onReorderingChange: (next: boolean) => void
  detail: Detail
  onDetailChange: (next: Detail) => void
}) {
  const fields = (Object.keys(PENDENZEN_SORT_LABELS) as PendenzenSort[]).filter(
    (field) => manualAllowed || field !== 'manual',
  )

  return (
    <ViewMenu width="sm:w-72">
      <MenuSection label="Sortieren nach" hint="Gilt für alle – wie in einer Sitzung auch.">
        <div className="-mx-1">
          {fields.map((field) => (
            <MenuRadio
              key={field}
              label={PENDENZEN_SORT_LABELS[field]}
              selected={sort.field === field}
              onClick={() => onSortChange({ ...sort, field })}
            />
          ))}
        </div>
      </MenuSection>

      {/* Auf- oder absteigend gibt es nur, wo ein Datum ordnet: Die von Hand
          gelegte Reihenfolge ist die Reihenfolge – rückwärts gelesen wäre sie
          eine andere, um die niemand gebeten hat. An ihrer Stelle steht der
          Haken, der die Griffe zum Umsortieren einschaltet. */}
      {sort.field === 'manual' ? (
        sortable ? (
          <MenuToggle
            label="Reihenfolge anpassen"
            checked={reordering}
            onChange={onReorderingChange}
            hint="Mit den Pfeilen an jeder Zeile oder durch Ziehen und Ablegen. Die Reihenfolge gilt für alle."
          />
        ) : (
          <p className="hint">
            Umsortiert wird unter «Pendent» und ohne Suche – ein Ausschnitt sagt nichts über die
            Reihenfolge der ganzen Liste.
          </p>
        )
      ) : (
        <MenuSection label="Reihenfolge">
          <div className="-mx-1">
            {(Object.keys(SORT_DIR_LABELS) as SortDirection[]).map((dir) => (
              <MenuRadio
                key={dir}
                label={SORT_DIR_LABELS[dir]}
                selected={sort.dir === dir}
                onClick={() => onSortChange({ ...sort, dir })}
              />
            ))}
          </div>
        </MenuSection>
      )}

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

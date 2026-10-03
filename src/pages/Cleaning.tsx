import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Brush,
  CalendarPlus,
  CalendarRange,
  Eye,
  FileDown,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningReminder } from '@/hooks/useCleaningReminder'
import { useAllSacramentMeetings, useCleaningGroups, useCleaningWeeks } from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { usePutzplanPreview } from '@/hooks/usePutzplanPreview'
import { CleaningGenerateDialog } from '@/components/cleaning/CleaningGenerateDialog'
import { CleaningCalendarDialog } from '@/components/cleaning/CleaningCalendarDialog'
import { CleaningGroupDialog } from '@/components/cleaning/CleaningGroupDialog'
import { CleaningGroupsDialog } from '@/components/cleaning/CleaningGroupsDialog'
import { CleaningInstallCard } from '@/components/cleaning/CleaningInstallCard'
import { CleaningReminderDialog } from '@/components/cleaning/CleaningReminderDialog'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { OtherResults } from '@/components/ui/OtherResults'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { formatDateLong, toDateInput } from '@/lib/dates'
import { cn, matchesSearch } from '@/lib/utils'
import { deleteCleaningWeek, saveCleaningWeek } from '@/services/cleaning'
import { refreshCleaningReminder } from '@/services/cleaningReminder'
import { pushConfigured } from '@/services/push'
import {
  CLEANING_PLAN_LABEL,
  cleaningGroupsPdf,
  cleaningGroupsPdfFilename,
  cleaningPdf,
  cleaningPdfFilename,
  cleaningPdfLayout,
  weeksInRange,
} from '@/services/cleaningPdf'
import { cleaningGroupNumber } from '@/lib/cleaningGroups'
import { cleaningAround, cleaningNow } from '@/lib/cleaningPlan'
import { fromIsoDate } from '@/services/importHistory'
import type { CleaningGroup, CleaningWeek } from '@/lib/types'

type Scope = 'upcoming' | 'past' | 'all'

/**
 * Der Putzplan der Gemeinde.
 *
 * Er entsteht aus der Gruppeneinteilung: Unter «Generieren» wird er für
 * einige Monate fortgeführt, eine Gruppe nach der anderen; die Einteilung
 * selbst steht unter «Gruppeneinteilung» (siehe `components/cleaning`). Hier
 * steht er zum Nachschauen – und als Grundlage für die wiederkehrende
 * Bekanntmachung, die am Sonntag dem einen Team dankt und das nächste
 * ankündigt.
 *
 * Einzelne Wochen lassen sich von Hand ändern: Wer kurzfristig tauscht,
 * soll dafür nicht den ganzen Zeitraum neu generieren müssen. Wird derselbe
 * Zeitraum später neu generiert, gilt allerdings wieder die Einteilung.
 *
 * **Ohne Vollzugriff ist die Seite ein Anschlagbrett.** Sie steht unter
 * `/putzplan` für alle offen (siehe `PUBLIC_PATHS` in `App.tsx`) – der
 * QR-Code auf dem ausgedruckten Plan führt hierher. Wer kein Konto hat
 * oder nur den AP-Kalender bzw. die Assistenz, sieht oben gross, wer diese
 * Woche dran ist und wer nächste Woche, darunter Suche, Auswahl und Liste
 * wie gewohnt. Was ein Konto braucht, fehlt: Ändern, Export und die
 * Sonntagskarte der Leitung – wem am Sonntag gedankt wird, ist deren
 * Sache.
 *
 * **Die Erinnerung gibt es für alle.** Über den Knopf «Erinnerung» lässt
 * sich jedes Gerät benachrichtigen, wenn eine Gruppe dran ist – ohne Konto,
 * und mit Konto in jeder Rolle (siehe `components/cleaning/
 * CleaningReminderPanel`). Ebenso für alle der Knopf «Kalender»: die
 * Wochen einer Gruppe als Abo oder Datei im eigenen Kalender (siehe
 * `CleaningCalendarDialog`). Wer ohne Konto liest, bekommt dazu den Hinweis,
 * den Putzplan als App zu installieren; installiert wird er unter eigenem
 * Namen und beginnt auf dieser Seite (`usePutzplanManifest`).
 *
 * **Die Vorschau.** Mit Vollzugriff zeigt «Vorschau öffentlicher Putzplan»
 * dieselbe Seite so, wie sie ohne Konto aussieht – Anschlagbrett statt
 * Bearbeitung, samt Hinweis zur App –, bis «Zurück zur Bearbeitung» oder
 * «Vorschau verlassen» oben rechts sie wieder schliesst (siehe
 * `usePutzplanPreview`).
 */
export function Cleaning() {
  const { isApproved, isGuest } = useAuth()
  const preview = usePutzplanPreview()
  // In der Vorschau wie ohne Konto: nichts zu ändern, das Anschlagbrett.
  const editable = isApproved && !preview.active
  const asGuest = isGuest || preview.active
  const { data: weeks, loading, error } = useCleaningWeeks()
  const { data: groups } = useCleaningGroups()
  const [scope, setScope] = useState<Scope>('upcoming')
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  /** Die Gruppe, deren Übersicht offensteht – ohne Vollzugriff ein Antippen entfernt. */
  const [groupShown, setGroupShown] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editWeek, setEditWeek] = useState<CleaningWeek | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  /** Der Dialog «Erinnerung» – mit der Gruppe, aus deren Übersicht man kommt. */
  const [reminderFor, setReminderFor] = useState<{ group: number | null } | null>(null)
  /** Der Dialog «Kalender» – ebenso mit der Gruppe aus der Übersicht. */
  const [calendarFor, setCalendarFor] = useState<{ group: number | null } | null>(null)
  const reminder = useCleaningReminder()
  const remindable = pushConfigured()

  const today = toDateInput(new Date())

  usePutzplanManifest(asGuest)

  /*
   * Stimmt die Anmeldung der Erinnerung noch? Browser vergeben ihre Adresse
   * ab und zu neu – beim Öffnen des Plans fällt das auf, und das Gerät
   * meldet sich unter der neuen an (siehe `refreshCleaningReminder`).
   */
  useEffect(() => {
    if (!remindable) return
    refreshCleaningReminder().catch((error) =>
      console.warn('[putzplan] Erinnerung nicht nachgeführt:', error),
    )
  }, [remindable])

  /** Eine Woche zum Ändern öffnen – aus beiden Listen derselbe Weg. */
  const openWeek = (week: CleaningWeek) => {
    setEditWeek(week)
    setFormOpen(true)
  }

  /** Ohne Vollzugriff führt das Antippen einer Woche zur Übersicht ihrer Gruppe. */
  const showGroup = (week: CleaningWeek) => {
    const number = cleaningGroupNumber(week.group)
    if (number !== null) setGroupShown(number)
  }
  const onRow = editable ? openWeek : showGroup

  const counts = useMemo(
    () => ({
      upcoming: weeks.filter((week) => week.endDate >= today).length,
      past: weeks.filter((week) => week.endDate < today).length,
      all: weeks.length,
    }),
    [weeks, today],
  )

  const searching = search.trim() !== ''

  const visible = useMemo(() => {
    let result = weeks
    if (scope === 'upcoming') result = result.filter((week) => week.endDate >= today)
    // Vergangenes andersherum: Das zuletzt Gewesene interessiert zuerst.
    else if (scope === 'past') {
      result = [...result].filter((week) => week.endDate < today).reverse()
    }
    if (search.trim()) {
      result = result.filter((week) => matchesSearch(`${week.group} ${week.team}`, search))
    }
    return result
  }, [weeks, scope, search, today])

  /*
   * Was die Suche ausserhalb des gewählten Zeitraums findet.
   *
   * «Kommend» sagt, welchen Teil des Plans man liest; die Suche fragt nach
   * einer Gruppe oder einem Namen. Wer nachschaut, wann die Familie Meier
   * dran ist, und nichts findet, soll lesen, dass sie im März dran **war** –
   * statt erst auf «Alle» umzustellen, um es zu erfahren.
   *
   * Das Vergangene rückwärts, wie unter «Vergangen»: Das zuletzt Gewesene
   * interessiert zuerst.
   */
  const otherHits = useMemo(() => {
    if (!searching) return []
    const shown = new Set(visible.map((week) => week.id))
    const rest = weeks.filter(
      (week) => !shown.has(week.id) && matchesSearch(`${week.group} ${week.team}`, search),
    )
    // Steht oben das Kommende, ist das Übrige Vergangenheit – und die liest
    // sich von hinten.
    return scope === 'upcoming' ? [...rest].reverse() : rest
  }, [searching, visible, weeks, search, scope])

  /** Die Woche, in der heute liegt – sie steht hervorgehoben in der Liste. */
  const currentId = useMemo(
    () => weeks.find((week) => week.startDate <= today && today <= week.endDate)?.id ?? null,
    [weeks, today],
  )

  return (
    <>
      {/* Oben rechts die Handgriffe der Leitung: die Einteilung der Gruppen
          pflegen, den Plan daraus generieren, ihn ausdrucken – und ansehen,
          wie ihn alle anderen sehen. Wer eine einzelne Woche korrigieren muss,
          tut das am Stift in der Zeile. */}
      <PageHeader
        title="Putzplan"
        actions={
          <div className="flex flex-wrap gap-2">
            {/* Für alle, mit und ohne Konto: die Erinnerung an die Putzwoche. */}
            {remindable && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReminderFor({ group: null })}
                title={
                  reminder
                    ? `Erinnerung für Gruppe ${reminder.group} eingeschaltet`
                    : 'Benachrichtigen, wenn eine Gruppe dran ist'
                }
              >
                {reminder ? (
                  <BellRing className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
                ) : (
                  <Bell className="size-4" aria-hidden />
                )}
                Erinnerung
              </button>
            )}
            {/* Ebenso für alle: die Wochen einer Gruppe im eigenen Kalender. */}
            {(weeks.length > 0 || groups.length > 0) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCalendarFor({ group: null })}
                title="Die Putzwochen einer Gruppe in Google Calendar oder Apple Kalender"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Kalender
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGroupsOpen(true)}
                title="Die Gruppen und wer dazugehört"
              >
                <Users className="size-4" aria-hidden />
                Gruppeneinteilung
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGenerateOpen(true)}
                title="Den Plan für die nächsten Monate einteilen"
              >
                <Sparkles className="size-4" aria-hidden />
                Generieren
              </button>
            )}
            {editable && (weeks.length > 0 || groups.length > 0) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setExportOpen(true)}
                title="Putzplan oder Gruppeneinteilung als PDF zum Ausdrucken herunterladen"
              >
                <FileDown className="size-4" aria-hidden />
                Export
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="btn-secondary"
                onClick={preview.enter}
                title="Den Putzplan so ansehen, wie er ohne Anmeldung aussieht"
              >
                <Eye className="size-4" aria-hidden />
                Vorschau öffentlicher Putzplan
              </button>
            )}
          </div>
        }
      />

      {/* Die Vorschau sagt, was sie ist – sonst fragt man sich, wo die
          Knöpfe geblieben sind. */}
      {preview.active && (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
          <p className="flex min-w-0 flex-1 items-start gap-2.5">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Vorschau:</span> So sehen den Putzplan alle, die nicht
              angemeldet sind – etwa über den QR-Code am Anschlagbrett.
            </span>
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm self-start sm:self-auto"
            onClick={preview.leave}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Zurück zur Bearbeitung
          </button>
        </div>
      )}

      {editable ? (
        <NextSunday weeks={weeks} />
      ) : (
        <OnDuty weeks={weeks} today={today} onGroup={showGroup} />
      )}

      {asGuest && <CleaningInstallCard />}

      <div className="mb-4 space-y-3">
        <input
          type="search"
          className="input"
          placeholder="Gruppe oder Namen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'Kommend', count: counts.upcoming },
            { value: 'past', label: 'Vergangen', count: counts.past },
            { value: 'all', label: 'Alle', count: counts.all },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Brush}
            title={
              error && weeks.length === 0
                ? 'Der Putzplan lässt sich gerade nicht laden'
                : weeks.length === 0
                  ? 'Noch kein Putzplan'
                  : 'Nichts gefunden'
            }
            description={
              error && weeks.length === 0
                ? 'Bitte versuche es später noch einmal.'
                : weeks.length > 0
                  ? 'Passe Suche oder Auswahl an.'
                  : editable
                    ? 'Unter «Generieren» entsteht der Plan aus der Gruppeneinteilung. Einzelne Wochen lassen sich auch von Hand erfassen.'
                    : 'Sobald der Plan eingetragen ist, steht er hier.'
            }
            action={
              editable &&
              !error &&
              weeks.length === 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditWeek(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Woche erfassen
                </button>
              )
            }
          />
        </div>
      ) : (
        <WeekRows weeks={visible} currentId={currentId} onOpen={onRow} editable={editable} />
      )}

      {/* Was ausserhalb des gewählten Zeitraums zur Suche passt – meist die
          Wochen, in denen dieselbe Gruppe schon einmal dran war. */}
      {!loading && searching && (
        <OtherResults
          items={otherHits}
          listKey={`${scope}|${search.trim()}`}
          pageSize={30}
          hint={
            scope === 'upcoming'
              ? 'Diese Wochen passen zur Suche, liegen aber in der Vergangenheit.'
              : scope === 'past'
                ? 'Diese Wochen passen zur Suche, liegen aber noch vor uns.'
                : 'Diese Wochen passen zur Suche, werden aber durch die Auswahl ausgeblendet.'
          }
        >
          {(page) => (
            <WeekRows weeks={page} currentId={currentId} onOpen={onRow} editable={editable} />
          )}
        </OtherResults>
      )}

      {editable && (
        <WeekForm
          open={formOpen}
          week={editWeek}
          onClose={() => {
            setFormOpen(false)
            setEditWeek(null)
          }}
        />
      )}

      {/* Bei jedem Öffnen neu aufgebaut – mit dem Zeitraum von heute. */}
      {editable && exportOpen && (
        <CleaningExport weeks={weeks} groups={groups} onClose={() => setExportOpen(false)} />
      )}
      {editable && groupsOpen && <CleaningGroupsDialog onClose={() => setGroupsOpen(false)} />}
      {editable && generateOpen && (
        <CleaningGenerateDialog
          weeks={weeks}
          groups={groups}
          onClose={() => setGenerateOpen(false)}
        />
      )}
      {groupShown !== null && (
        <CleaningGroupDialog
          number={groupShown}
          weeks={weeks}
          groups={groups}
          today={today}
          onClose={() => setGroupShown(null)}
          onRemind={
            remindable
              ? (number) => {
                  setGroupShown(null)
                  setReminderFor({ group: number })
                }
              : undefined
          }
          onCalendar={(number) => {
            setGroupShown(null)
            setCalendarFor({ group: number })
          }}
        />
      )}
      {reminderFor && (
        <CleaningReminderDialog
          groups={groups}
          weeks={weeks}
          initialGroup={reminderFor.group}
          onClose={() => setReminderFor(null)}
        />
      )}
      {calendarFor && (
        <CleaningCalendarDialog
          groups={groups}
          weeks={weeks}
          initialGroup={calendarFor.group}
          onClose={() => setCalendarFor(null)}
        />
      )}
    </>
  )
}

/**
 * Ohne Konto wird der Putzplan als eigene App installiert.
 *
 * Das Manifest der App beginnt bei «/» – ohne Konto hiesse das: bei der
 * Anmeldung. Solange jemand ohne Konto den Putzplan liest, zeigt der Link
 * im Kopf der Seite deshalb auf `public/putzplan.webmanifest`: eigener
 * Name, eigenes Symbol auf dem Startbildschirm, Start auf dieser Seite.
 * Beim Verlassen kommt das Manifest der App zurück. Dazu der Name, den
 * Safari dem Symbol auf dem Home-Bildschirm gibt.
 */
function usePutzplanManifest(active: boolean) {
  useEffect(() => {
    if (!active) return
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    const before = { href: link?.getAttribute('href') ?? null, title: title?.content ?? null }

    link?.setAttribute('href', '/putzplan.webmanifest')
    if (title) title.content = 'Putzplan'

    return () => {
      if (link && before.href !== null) link.setAttribute('href', before.href)
      if (title && before.title !== null) title.content = before.title
    }
  }, [active])
}

/* ------------------------------------------------------------------ */

/**
 * Den Putzplan als PDF herunterladen – oder die Gruppeneinteilung.
 *
 * Gefragt wird nur der Zeitraum. Zwei Knöpfe nehmen die üblichen Antworten
 * vorweg: ab der laufenden Woche bis zum Ende des Plans – das Blatt fürs
 * Anschlagbrett – und der ganze Plan. Was auf dem Blatt steht, sagt die
 * Beschreibung: Woche, Datum, wer an der Reihe ist und die Gruppe (siehe
 * `services/cleaningPdf`).
 *
 * Dazu ein Haken für die Adresse des Plans samt QR-Code: Wer vor dem
 * Anschlagbrett steht, hat den Plan damit auch auf dem Telefon – und dort
 * immer den neusten Stand. Und einer für «auf 1 Seite»: Alles kommt auf ein
 * Blatt, die Schrift so klein wie nötig. Ohne ihn bleibt das Blatt, wie es
 * war; wie viele Seiten es dann werden, steht unter dem Zeitraum. Das Gerät
 * merkt sich beide Haken.
 *
 * Die Sonntage braucht der Grund hinter einer doppelten Woche: Steht dort
 * eine Pfahlkonferenz, steht sie auch auf dem Blatt.
 *
 * Oben lässt sich statt des Plans die **Gruppeneinteilung** wählen: alle
 * Gruppen auf einem Blatt, der zuständige Haushalt fett zuoberst – wie die
 * Liste der Gemeinde, aus der sie einmal importiert wurde (siehe
 * `cleaningGroupsPdf`). Ein Zeitraum spielt dafür keine Rolle; der Haken für
 * Adresse und QR-Code gilt für beide.
 */
function CleaningExport({
  weeks,
  groups,
  onClose,
}: {
  weeks: CleaningWeek[]
  groups: readonly CleaningGroup[]
  onClose: () => void
}) {
  const { settings } = useData()
  const toast = useToast()
  const { data: sundays } = useAllSacramentMeetings()
  const [withLink, setWithLink] = useLocalStorage('bss:putzplan:pdf-link', false)
  const [onePage, setOnePage] = useLocalStorage('bss:putzplan:pdf-eine-seite', false)
  // Ohne Plan, aber mit Einteilung gibt es nur die Einteilung zu exportieren.
  const [what, setWhat] = useState<'plan' | 'groups'>(weeks.length > 0 ? 'plan' : 'groups')
  const today = toDateInput(new Date())
  const entryCount = groups.reduce((sum, group) => sum + group.entries.length, 0)

  const sorted = useMemo(
    () => [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [weeks],
  )
  const planStart = sorted[0]?.startDate ?? today
  const planEnd = sorted.reduce(
    (latest, week) => (week.endDate > latest ? week.endDate : latest),
    planStart,
  )
  /** Die laufende Woche – oder, wenn heute keine läuft, die nächste. */
  const thisWeek = sorted.find((week) => week.endDate >= today)?.startDate ?? planStart

  const [from, setFrom] = useState(thisWeek)
  const [to, setTo] = useState(planEnd)

  const valid = Boolean(from && to && from <= to)
  const count = valid ? weeksInRange(weeks, from, to).length : 0
  /** Wie das Blatt ausfällt – Seiten und Schrift, bevor es entsteht. */
  const layout = useMemo(
    () =>
      what === 'plan' && valid
        ? cleaningPdfLayout({
            weeks,
            from,
            to,
            wardName: settings.wardName,
            today,
            sundays,
            withLink,
            onePage,
          })
        : null,
    [what, valid, weeks, from, to, settings.wardName, today, sundays, withLink, onePage],
  )

  const download = () => {
    if (what === 'groups') {
      const bytes = cleaningGroupsPdf({
        groups,
        wardName: settings.wardName,
        today,
        withLink,
      })
      if (!bytes) {
        toast.error('Es gibt noch keine Gruppen.')
        return
      }
      saveFile(bytes, cleaningGroupsPdfFilename(today))
      toast.success('Gruppeneinteilung als PDF heruntergeladen.')
      onClose()
      return
    }

    const bytes = cleaningPdf({
      weeks,
      from,
      to,
      wardName: settings.wardName,
      today,
      sundays,
      withLink,
      onePage,
    })
    if (!bytes) {
      toast.error('In diesem Zeitraum steht keine Woche im Plan.')
      return
    }
    saveFile(bytes, cleaningPdfFilename(from, to))
    toast.success('Putzplan als PDF heruntergeladen.')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Exportieren"
      description={
        what === 'groups'
          ? 'Als PDF zum Ausdrucken: alle Gruppen, der zuständige Haushalt fett zuoberst.'
          : 'Als PDF zum Ausdrucken: Woche, Datum, wer an der Reihe ist und die Gruppe.'
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={download}
            disabled={what === 'groups' ? groups.length === 0 : !valid || count === 0}
          >
            <FileDown className="size-4" aria-hidden />
            PDF herunterladen
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl<'plan' | 'groups'>
          value={what}
          onChange={setWhat}
          options={[
            { value: 'plan', label: 'Putzplan', count: weeks.length },
            { value: 'groups', label: 'Gruppeneinteilung', count: groups.length },
          ]}
        />

        {what === 'groups' ? (
          <p className="hint mt-0">
            {groups.length === 0
              ? 'Es gibt noch keine Gruppen – sie entstehen unter «Gruppeneinteilung».'
              : `${groups.length} ${groups.length === 1 ? 'Gruppe' : 'Gruppen'} mit ${entryCount} ${entryCount === 1 ? 'Eintrag' : 'Einträgen'} kommen aufs Blatt, mit dem Stand von heute.`}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="export-from">
                  Von
                </label>
                <input
                  id="export-from"
                  type="date"
                  className="input"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="export-to">
                  Bis
                </label>
                <input
                  id="export-to"
                  type="date"
                  className="input"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setFrom(thisWeek)
                  setTo(planEnd)
                }}
              >
                Ab dieser Woche
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setFrom(planStart)
                  setTo(planEnd)
                }}
              >
                Ganzer Plan
              </button>
            </div>

            <p className="hint mt-0">
              {!valid
                ? 'Das Ende liegt vor dem Anfang.'
                : count === 0 || !layout
                  ? 'In diesem Zeitraum steht keine Woche im Plan.'
                  : `${count} ${count === 1 ? 'Woche' : 'Wochen'} kommen aufs Blatt – ${
                      layout.pages === 1 ? '1 Seite' : `${layout.pages} Seiten`
                    }.`}
            </p>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded"
                checked={onePage}
                onChange={(event) => setOnePage(event.target.checked)}
              />
              <span>
                <span className="text-sm font-medium">Auf 1 Seite darstellen</span>
                <span className="hint mt-0.5 block">
                  {onePage && layout
                    ? onePageHint(layout)
                    : 'Alles auf ein Blatt – je mehr Wochen, desto kleiner die Schrift.'}
                </span>
              </span>
            </label>
          </>
        )}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded"
            checked={withLink}
            onChange={(event) => setWithLink(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium">Link und QR-Code integrieren</span>
            <span className="hint mt-0.5 block">
              Ganz unten auf dem Blatt steht {CLEANING_PLAN_LABEL} – mit einem QR-Code, der dorthin
              führt.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

/** Was «auf 1 Seite» aus der Auswahl macht – Schrift und Anordnung. */
function onePageHint(layout: { pages: number; bodySize: number; sideBySide: boolean }): string {
  const size = layout.bodySize.toLocaleString('de-CH')
  if (layout.pages > 1) {
    return `So viele Wochen passen nicht einmal mit ${size} Punkt auf eine Seite – es werden ${layout.pages}.`
  }
  if (layout.bodySize >= 10.5 && !layout.sideBySide) {
    return 'Passt in der gewohnten Schriftgrösse auf eine Seite.'
  }
  return `Schrift ${size} statt 10.5 Punkt${layout.sideBySide ? ', in zwei Hälften nebeneinander' : ''}.`
}

/** Die Datei im Browser speichern – wie die Sicherung unter «Einstellungen». */
function saveFile(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Erst später freigeben: Im selben Zug verworfen, bricht der Download je
  // nach Browser ab, bevor er begonnen hat.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/* ------------------------------------------------------------------ */

/** «Mo, 29.06. – Sa, 04.07.2026» kurz gehalten: «29.06.2026 – 04.07.2026» */
function period(week: Pick<CleaningWeek, 'startDate' | 'endDate'>): string {
  const [, startMonth, startDay] = week.startDate.split('-')
  const [endYear, endMonth, endDay] = week.endDate.split('-')
  return `${startDay}.${startMonth}. – ${endDay}.${endMonth}.${endYear}`
}

/* ------------------------------------------------------------------ */

/**
 * Was am nächsten Sonntag zu sagen wäre.
 *
 * Genau diese zwei Zeilen füllt die wiederkehrende Bekanntmachung. Sie
 * hier zu zeigen macht den Zusammenhang sichtbar – und eine Lücke im Plan
 * fällt auf, bevor sie am Sonntag auffällt.
 */
function NextSunday({ weeks }: { weeks: CleaningWeek[] }) {
  const sundayKey = useMemo(() => {
    const today = new Date()
    const next = new Date(today)
    // 0 = Sonntag. Ist heute Sonntag, gilt heute.
    next.setDate(today.getDate() + ((7 - today.getDay()) % 7))
    return toDateInput(next)
  }, [])

  const { previous, next } = cleaningAround(weeks, sundayKey)
  if (weeks.length === 0) return null

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <CalendarRange className="size-4 text-slate-400" aria-hidden />
        {formatDateLong(fromIsoDate(sundayKey))}
      </h2>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Dank an die vergangene Woche
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {previous ? `${previous.team}${previous.group ? ` (${previous.group})` : ''}` : '—'}
          </dd>
          {previous && <dd className="hint mt-0">{period(previous)}</dd>}
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Kommende Woche</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {next ? `${next.team}${next.group ? ` (${next.group})` : ''}` : '—'}
          </dd>
          {next && <dd className="hint mt-0">{period(next)}</dd>}
        </div>
      </dl>

      {(!previous || !next) && (
        <p className="hint mt-2">
          Wo nichts steht, reicht der Plan nicht so weit. Die wiederkehrende Bekanntmachung bleibt
          an solchen Sonntagen weg, statt eine Lücke vorzulesen.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** «Gruppe 10 · 15.11. – 21.11.2026» – oder nur die Tage, wenn die Gruppe fehlt. */
function weekMeta(week: CleaningWeek): string {
  return week.group ? `${week.group} · ${period(week)}` : period(week)
}

/**
 * Wer dran ist – gross, für den Blick vor dem Anschlagbrett.
 *
 * Die Ansicht ohne Konto beginnt mit der einen Frage, wegen der jemand den
 * QR-Code scannt: Sind wir diese Woche dran? Die Antwort steht gross oben,
 * darunter kleiner die nächste Woche. Gezählt wird ab heute, nicht ab dem
 * Sonntag (siehe `cleaningNow`).
 *
 * Läuft heute keine Woche – am Sonntag zwischen zwei Wochen von Montag bis
 * Samstag –, rückt die nächste nach oben und die übernächste darunter.
 */
function OnDuty({
  weeks,
  today,
  onGroup,
}: {
  weeks: CleaningWeek[]
  today: string
  /** Die Übersicht der Gruppe öffnen */
  onGroup: (week: CleaningWeek) => void
}) {
  if (weeks.length === 0) return null
  const { current, next, after } = cleaningNow(weeks, today)
  const first = current ?? next
  const second = current ? next : after

  if (!first) {
    return (
      <div className="card mb-4 p-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Der Plan reicht nicht bis heute – sobald der nächste eingetragen ist, steht hier, wer dran
          ist.
        </p>
      </div>
    )
  }

  return (
    <section className="card relative mb-4 overflow-hidden p-5 sm:p-6">
      <span className="bg-brand-600 absolute inset-x-0 top-0 h-1" aria-hidden />

      {/* Ein Antippen öffnet die Übersicht der Gruppe – wer dazugehört und
          wann sie wieder dran ist. */}
      <button type="button" className="group block w-full text-left" onClick={() => onGroup(first)}>
        <p className="text-brand-700 dark:text-brand-300 text-sm font-semibold">
          {current ? 'Diese Woche dran' : 'Als Nächstes dran'}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance group-hover:underline sm:text-3xl">
          {first.team}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{weekMeta(first)}</p>
      </button>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {current ? 'Nächste Woche dran' : 'Danach dran'}
        </p>
        {second ? (
          <button
            type="button"
            className="group block w-full text-left"
            onClick={() => onGroup(second)}
          >
            <span className="mt-0.5 block text-lg font-semibold text-balance group-hover:underline">
              {second.team}
            </span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">
              {weekMeta(second)}
            </span>
          </button>
        ) : (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Weiter reicht der Plan noch nicht.
          </p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

interface FormState {
  startDate: string
  endDate: string
  group: string
  team: string
  note: string
}

const EMPTY: FormState = { startDate: '', endDate: '', group: '', team: '', note: '' }

/**
 * Die Zeilen des Plans – ohne Rahmen darum.
 *
 * Sie stehen für sich, weil sie zweimal gebraucht werden: für den gewählten
 * Zeitraum und für die Treffer, die daneben liegen. Die laufende Woche bleibt
 * dabei in beiden Listen hervorgehoben.
 *
 * Mit Vollzugriff öffnet eine Zeile das Formular der Woche (mit Stift), ohne
 * die Übersicht ihrer Gruppe – wer dazugehört und wann sie wieder dran ist.
 */
function WeekRows({
  weeks,
  currentId,
  onOpen,
  editable,
}: {
  weeks: CleaningWeek[]
  currentId: string | null
  onOpen: (week: CleaningWeek) => void
  editable: boolean
}) {
  return (
    <ul className="card divide-list overflow-hidden">
      {weeks.map((week) => {
        const current = week.id === currentId
        return (
          <li key={week.id}>
            <button
              type="button"
              onClick={() => onOpen(week)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
                current && 'bg-brand-50/60 dark:bg-brand-950/40',
              )}
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                  current
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {week.group.replace(/[^\d]/g, '') || '–'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{week.team}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {week.group && `${week.group} · `}
                  {period(week)}
                  {week.note?.trim() && ` · ${week.note.trim()}`}
                  {current && ' · diese Woche'}
                </p>
              </div>

              {editable ? (
                <Pencil className="size-4 shrink-0 text-slate-300" aria-hidden />
              ) : (
                <Users className="size-4 shrink-0 text-slate-300" aria-hidden />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function WeekForm({
  open,
  week,
  onClose,
}: {
  open: boolean
  week: CleaningWeek | null
  onClose: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      week
        ? {
            startDate: week.startDate,
            endDate: week.endDate,
            group: week.group,
            team: week.team,
            note: week.note ?? '',
          }
        : EMPTY,
    )
  }, [open, week])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.startDate || !form.endDate) {
      toast.error('Bitte gib Anfang und Ende der Woche an.')
      return
    }
    if (form.endDate < form.startDate) {
      toast.error('Das Ende der Woche liegt vor ihrem Anfang.')
      return
    }
    if (!form.team.trim()) {
      toast.error('Bitte gib das Putzteam an.')
      return
    }

    setSaving(true)
    try {
      /*
       * Die Dokument-ID ist der erste Tag der Woche. Wird er verschoben,
       * entstünde beim blossen Speichern ein zweiter Eintrag – deshalb
       * fällt der alte weg.
       */
      if (week && week.startDate !== form.startDate) await deleteCleaningWeek(week.id)

      const outcome = await saveCleaningWeek({
        startDate: form.startDate,
        endDate: form.endDate,
        group: form.group.trim(),
        team: form.team.trim(),
        note: form.note.trim(),
      })
      toast.saved('Putzwoche gespeichert.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={week ? 'Putzwoche bearbeiten' : 'Putzwoche erfassen'}
        footer={
          <>
            {week && (
              <button
                type="button"
                className="btn-ghost mr-auto text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Löschen
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" form="week-form" className="btn-primary" disabled={saving}>
              Speichern
            </button>
          </>
        }
      >
        <form id="week-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="w-start">
                Von
              </label>
              <input
                id="w-start"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="w-end">
                Bis
              </label>
              <input
                id="w-end"
                type="date"
                className="input"
                value={form.endDate}
                onChange={(event) => update('endDate', event.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="w-team">
              Putzteam
            </label>
            <input
              id="w-team"
              className="input"
              value={form.team}
              onChange={(event) => update('team', event.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="w-group">
                Gruppe
              </label>
              <input
                id="w-group"
                className="input"
                value={form.group}
                onChange={(event) => update('group', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="w-note">
                Bemerkung
              </label>
              <input
                id="w-note"
                className="input"
                value={form.note}
                onChange={(event) => update('note', event.target.value)}
              />
            </div>
          </div>

          <p className="hint">
            Die Woche läuft von Sonntag bis Samstag – so legt «Generieren» sie an. Am Sonntag wird
            der Woche davor gedankt und diese angekündigt.
          </p>
        </form>
      </Modal>

      {week && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteCleaningWeek(week.id).then(() => {
              toast.success('Putzwoche entfernt.')
              onClose()
            })
          }}
          title="Putzwoche löschen?"
          message={`Die Woche ${period(week)} mit ${week.team} wird entfernt.`}
          confirmLabel="Löschen"
          danger
        />
      )}
    </>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { MentionField } from '@/components/ui/MentionField'
import { AssigneePicker } from '@/components/ui/Pickers'
import { UserAvatar } from '@/components/ui/Avatar'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { CallingChangesTables } from '@/components/agenda/CallingChanges'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useMonthLeaders } from '@/hooks/useFirestore'
import { useCurrentMonth } from '@/hooks/useMonthlyDuties'
import { createAgendaItem, type AgendaItemInput } from '@/services/agenda'
import { createMonthlyDuty } from '@/services/monthlyDuties'
import { emptyLayout, serializeLayout } from '@/lib/layout'
import { emptyCallingChanges, serializeCallingChanges } from '@/lib/callingChanges'
import { formatMonthKey } from '@/lib/monthlyDuties'
import { cn } from '@/lib/utils'
import {
  ITEM_KIND_LABELS,
  type CallingChanges,
  type ItemKind,
  type ItemLayout,
  type ItemStatus,
} from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Direkt einer Sitzung zuordnen – ohne Angabe landet es im Sammelkorb */
  meetingId?: string | null
  /**
   * «Neu» vor dem Start der Sitzung, «Pendent», sobald sie läuft. Ein Punkt,
   * der mitten in der Sitzung dazukommt, war nie «neu» – er wird sofort
   * besprochen.
   */
  defaultStatus?: ItemStatus
  /**
   * Zur Wahl stellen, ob ein Traktandum oder eine Pendenz entsteht.
   *
   * Nur dort gesetzt, wo beides gemeint sein kann – unter «Pendenzen». In
   * einer Sitzung erfasst man Traktanden; die Frage stellte sich dort nicht.
   */
  kindChoice?: boolean
  defaultKind?: ItemKind
  onSaved?: (id: string) => void
}

interface FormState {
  title: string
  description: string
  assignees: string[]
  memberRefs: string[]
  /** Gesetzt heisst: variables Layout statt Beschreibung */
  layout: ItemLayout | null
  /** Gesetzt heisst: die beiden Berufungstabellen statt Beschreibung */
  callingChanges: CallingChanges | null
}

const EMPTY: FormState = {
  title: '',
  description: '',
  assignees: [],
  memberRefs: [],
  layout: null,
  callingChanges: null,
}

/**
 * Welche Gestalt der Eintrag hat – Text, Raster oder Berufungsrunde.
 *
 * Genau eine davon: Alle drei füllen dieselbe Stelle unter dem Titel, und
 * zwei nebeneinander liessen offen, wo etwas hingehört. Gespeichert bleibt
 * trotzdem, was schon geschrieben wurde – ein Wechsel wirft nichts weg.
 */
type ItemShape = 'text' | 'layout' | 'callings'

/**
 * Ein neues Traktandum erfassen.
 *
 * Nur zum Anlegen: Geändert wird ein Eintrag dort, wo er steht – in der
 * Sitzung oder in der Pendenzenliste, unmittelbar im Text. Ein Fenster, das
 * sich über die Sitzung legt, um ein Wort zu ändern, gibt es nicht mehr.
 *
 * Gefragt wird nur nach dem, was am Sitzungstisch zählt: Titel, Beschreibung,
 * Zuständige. Alles Weitere lässt sich nachtragen, und Bereich, betroffene
 * Mitglieder, Priorität, Termin und «vertraulich» sind ganz weggefallen.
 *
 * Hier – und nur hier – stehen auch die beiden Haken für die Gestalt des
 * Eintrags: **Variables Layout** für ein selbst gestelltes Raster,
 * **Berufungsänderung** für die beiden Tabellen der Berufungsrunde. Ob ein
 * Punkt ein Absatz Text ist, eine kleine Tabelle oder eine Runde, entscheidet
 * sich beim Erfassen. Später stünden die Haken über zwanzig Traktanden, die
 * sie nie brauchen.
 *
 * Unter «Pendenzen» steht zuoberst zusätzlich die Wahl zwischen **Traktandum**
 * und **Pendenz**. Beides gehört in dieselbe nächste Sitzung – nur eben unter
 * verschiedene Überschriften: das eine ein Thema, über das gesprochen wird,
 * das andere eine Aufgabe, die jemand mitnimmt.
 *
 * Und bei der Pendenz ein dritter Haken: **Monatsverantwortung**. Er macht aus
 * dem Eintrag etwas anderes – keine einmalige Aufgabe, sondern eine, die jeden
 * Monat wiederkehrt und immer dem gehört, der den Monat führt. Gespeichert
 * wird dann nicht die Pendenz selbst, sondern die Vorlage dazu; die Pendenz
 * entsteht daraus Monat für Monat (siehe `lib/monthlyDuties`). Deshalb fallen
 * mit dem Haken auch die übrigen Felder weg: Ein Raster, eine Berufungsrunde
 * und eine Liste von Zuständigen beantworten Fragen, die hier niemand stellt.
 */
export function AgendaItemForm({
  open,
  onClose,
  meetingId = null,
  defaultStatus = 'new',
  kindChoice = false,
  defaultKind = 'traktandum',
  onSaved,
}: Props) {
  const { profile } = useAuth()
  const { userName } = useData()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [kind, setKind] = useState<ItemKind>(defaultKind)
  const [saving, setSaving] = useState(false)

  /*
   * «Gehört der Monatsverantwortung» – der Haken, der alles Übrige umstellt.
   *
   * Er steht nur bei der Pendenz zur Wahl: Ein Traktandum ist ein Thema für
   * eine bestimmte Sitzung, und eine Sitzung gehört keinem Monat.
   */
  const [monthly, setMonthly] = useState(false)
  const isMonthly = monthly && kind === 'pendenz'

  const month = useCurrentMonth()
  const { leaders } = useMonthLeaders()
  const leader = leaders.get(month) ?? null

  /*
   * Das zuletzt Gebaute überlebt den Haken.
   *
   * Wer «Variables Layout» ausschaltet, um kurz die Beschreibung zu lesen,
   * und wieder einschaltet, hätte sonst seine Tabelle noch einmal zu bauen.
   */
  const lastLayout = useRef<ItemLayout | null>(null)
  const lastCallingChanges = useRef<CallingChanges | null>(null)

  // Beim Öffnen zurücksetzen, damit nichts vom letzten Mal stehen bleibt.
  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setKind(defaultKind)
    setMonthly(false)
    lastLayout.current = null
    lastCallingChanges.current = null
  }, [open, defaultKind])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const shape: ItemShape = form.callingChanges ? 'callings' : form.layout ? 'layout' : 'text'

  const setShape = (next: ItemShape) =>
    setForm((current) => {
      if (current.layout) lastLayout.current = current.layout
      if (current.callingChanges) lastCallingChanges.current = current.callingChanges
      return {
        ...current,
        layout: next === 'layout' ? (lastLayout.current ?? emptyLayout()) : null,
        callingChanges:
          next === 'callings' ? (lastCallingChanges.current ?? emptyCallingChanges()) : null,
      }
    })

  /*
   * Der Haken räumt die Gestalt weg.
   *
   * Eine Monatspendenz ist ein Titel und ein paar Zeilen dazu – ein Raster
   * oder eine Berufungsrunde, die jeden Monat neu und leer dastünde, wäre
   * keine Aufgabe, sondern ein Missverständnis.
   */
  const chooseMonthly = (next: boolean) => {
    setMonthly(next)
    if (next) setShape('text')
  }

  /*
   * Ein mit «@» eingesetzter Name ist zugleich ein Verweis: Wer im Text steht,
   * wird daneben vermerkt – sonst führte der Name später nirgendwohin.
   */
  const linkMember = (memberId: string) =>
    setForm((current) =>
      current.memberRefs.includes(memberId)
        ? current
        : { ...current, memberRefs: [...current.memberRefs, memberId] },
    )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return

    const title = form.title.trim()
    if (!title) {
      toast.error('Bitte gib einen Titel ein.')
      return
    }

    setSaving(true)
    try {
      /*
       * Mit dem Haken entsteht kein Eintrag, sondern eine Vorlage.
       *
       * Die Pendenz dazu legt die App an – für diesen Monat und für jeden
       * weiteren, sobald ihn jemand öffnet (siehe `hooks/useMonthlyDuties`).
       * Ab wann sie gilt, ist der laufende Monat: Was heute erfasst wird,
       * ist heute zu tun.
       */
      if (isMonthly) {
        await createMonthlyDuty(
          { title, description: form.description, startMonth: month },
          { id: profile.id, name: profile.displayName },
        )
        toast.success(`Monatspendenz erfasst – ab ${formatMonthKey(month)}.`)
        // Kein `onSaved`: Es entstand kein Eintrag, auf den sich verweisen
        // liesse – die Pendenz dazu legt die App gleich darauf selbst an.
        onClose()
        return
      }

      const payload: AgendaItemInput = {
        title,
        description: form.description,
        assignees: form.assignees,
        memberRefs: form.memberRefs,
        // Eine Pendenz ist von Anfang an pendent – «Neu» meint das Traktandum,
        // das vor dem Start der Sitzung erfasst wurde.
        status: kind === 'pendenz' ? 'pending' : defaultStatus,
        kind,
        meetingId,
        layout: form.layout ? serializeLayout(form.layout) : null,
        callingChanges: form.callingChanges ? serializeCallingChanges(form.callingChanges) : null,
      }
      const id = await createAgendaItem(payload, { id: profile.id, name: profile.displayName })
      toast.success(
        meetingId
          ? `${ITEM_KIND_LABELS[kind]} zur nächsten Sitzung hinzugefügt.`
          : `${ITEM_KIND_LABELS[kind]} erfasst.`,
      )
      onSaved?.(id)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen. Bist du online?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isMonthly ? 'Neue Monatspendenz' : kind === 'pendenz' ? 'Neue Pendenz' : 'Neues Traktandum'
      }
      description={
        isMonthly
          ? 'Fällt jeden Monat an – bei dem, der den Monat führt.'
          : meetingId
            ? kind === 'pendenz'
              ? 'Steht in der nächsten Sitzung unter den Pendenzen.'
              : 'Steht in der nächsten Sitzung unter den Traktanden.'
            : 'Landet im Sammelkorb und kann später einer Sitzung zugeordnet werden.'
      }
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="agenda-form" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Erfassen'}
          </button>
        </>
      }
    >
      <form id="agenda-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Was entsteht hier? Die Frage steht zuoberst, weil sie über die
            Überschrift entscheidet, unter der der Eintrag später steht. */}
        {kindChoice && (
          <div>
            <span className="label">Was soll entstehen?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['traktandum', 'Ein Thema, über das in der nächsten Sitzung gesprochen wird.'],
                  ['pendenz', 'Eine Aufgabe, die offen ist und in der Sitzung mitläuft.'],
                ] as [ItemKind, string][]
              ).map(([value, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    kind === value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                      : 'border-slate-300 hover:border-slate-400 dark:border-slate-700',
                  )}
                >
                  <span className="block text-sm font-medium">{ITEM_KIND_LABELS[value]}</span>
                  <span className="hint mt-0.5 block">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wem die Aufgabe gehört – die Frage steht vor allen anderen: Mit
            dem Haken fallen die Gestalt und die Zuständigen weg, und aus dem
            Eintrag wird eine Aufgabe, die jeden Monat wiederkehrt. */}
        {kind === 'pendenz' && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={monthly}
              onChange={(event) => chooseMonthly(event.target.checked)}
            />
            <span>
              Gehört zur Monatsverantwortung
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Fällt jeden Monat neu an – bei dem, der den Monat führt. Sie steht in keiner Sitzung
                und in keinem Protokoll, sondern unter «Pendenzen → Meine».
              </span>
              {monthly && (
                <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {formatMonthKey(month)} führt
                  {leader ? (
                    <>
                      <UserAvatar userId={leader} name={userName(leader)} size="xs" />
                      {userName(leader)}
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      noch niemand – die Pendenz wartet ohne Zuständigen, bis unter «Abendmahl →
                      Leitung → Zuständig» jemand eingetragen ist.
                    </span>
                  )}
                </span>
              )}
            </span>
          </label>
        )}

        {/* Die Haken stehen oben rechts, weil sie über die Gestalt des ganzen
            Fensters entscheiden und nicht über ein einzelnes Feld. Sie
            schliessen einander aus: Beide füllen die Stelle, an der sonst die
            Beschreibung steht. */}
        {!isMonthly && (
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded"
                checked={shape === 'layout'}
                onChange={(event) => setShape(event.target.checked ? 'layout' : 'text')}
              />
              Variables Layout
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded"
                checked={shape === 'callings'}
                onChange={(event) => setShape(event.target.checked ? 'callings' : 'text')}
              />
              Berufungsänderung
            </label>
          </div>
        )}

        <div>
          <label className="label" htmlFor="item-title">
            Titel
          </label>
          <MentionField
            id="item-title"
            value={form.title}
            onChange={(next) => update('title', next)}
            onMention={(member) => linkMember(member.id)}
            required
            maxLength={200}
          />
        </div>

        {/* Entweder – oder: Ein Raster ist die Beschreibung, nur eben
            gegliedert. Beide nebeneinander liessen offen, wo etwas
            hingehört. Gespeichert bleiben ohnehin beide Stände. */}
        {form.callingChanges ? (
          <div>
            <span className="label">Berufungsänderung</span>
            <p className="hint mb-3">
              Eine Ideenliste für die Runde – sie ändert keine Berufung und keinen
              Mitgliederdatensatz. Wer welche Berufung hat, sagt weiterhin allein das LCR.
            </p>
            <CallingChangesTables
              value={form.callingChanges}
              onChange={(next) => update('callingChanges', next)}
              onMention={(member) => linkMember(member.id)}
              memberRefs={form.memberRefs}
            />
          </div>
        ) : form.layout ? (
          <div>
            <span className="label">Layout</span>
            <LayoutGrid
              layout={form.layout}
              onChange={(next) => update('layout', next)}
              onMention={(member) => linkMember(member.id)}
              memberRefs={form.memberRefs}
            />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="item-description">
              Beschreibung
            </label>
            <MentionField
              id="item-description"
              multiline
              className="min-h-24 resize-y"
              value={form.description}
              onChange={(next) => update('description', next)}
              onMention={(member) => linkMember(member.id)}
              rows={3}
            />
          </div>
        )}

        {/* Wer zuständig ist, sagt bei der Monatspendenz der Monat – und
            zwar jeden Monat neu. Eine Wahl daneben wäre eine Angabe, die
            beim nächsten Monatswechsel nicht mehr stimmt. */}
        {!isMonthly && (
          <AssigneePicker value={form.assignees} onChange={(next) => update('assignees', next)} />
        )}
      </form>
    </Modal>
  )
}

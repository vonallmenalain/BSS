import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { setStanding } from '@/services/agenda'
import { formatDate } from '@/lib/dates'
import {
  DEFAULT_STANDING,
  formatDayKey,
  normalizeStanding,
  standingLabel,
  standingTitle,
} from '@/lib/standing'
import {
  STANDING_PERIOD_UNITS,
  STANDING_UNIT_PLURAL,
  type AgendaItem,
  type StandingRule,
  type StandingUnit,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Den Takt wählen                                                     */
/* ------------------------------------------------------------------ */

/**
 * Die drei Antworten auf «wie oft?».
 *
 * Zwei davon sind die Antworten, die tatsächlich gegeben werden – jede
 * Sitzung und einmal im Monat –, und die dritte ist für alles andere da. Eine
 * Liste aller denkbaren Takte wäre eine Liste, in der man suchen muss, um das
 * Naheliegende zu finden.
 */
type StandingChoice = 'meeting' | 'month' | 'custom'

const CHOICE_LABELS: Record<StandingChoice, string> = {
  meeting: 'Jede Sitzung',
  month: '1× pro Monat',
  custom: 'Benutzerdefiniert',
}

/** Welche der drei Wahlmöglichkeiten dieser Takt ist. */
function choiceOf(rule: StandingRule): StandingChoice {
  if (rule.unit === 'meeting') return 'meeting'
  if (rule.unit === 'month' && rule.every === 1) return 'month'
  return 'custom'
}

/** Der Takt, der zu einer Wahl gehört – der bisherige bleibt, soweit er passt. */
function ruleOf(choice: StandingChoice, current: StandingRule): StandingRule {
  if (choice === 'meeting') return { ...current, every: 1, unit: 'meeting' }
  if (choice === 'month') return { ...current, every: 1, unit: 'month' }
  // Aus «jede Sitzung» heraus gibt es keinen Zeitraum, an den man anknüpfen
  // könnte – zwei Wochen sind der Takt, den eine Bischofschaft am ehesten
  // meint, wenn sie «nicht jede Sitzung» sagt.
  return current.unit === 'meeting' ? { ...current, every: 2, unit: 'week' } : current
}

/**
 * Wie oft eine ständige Pendenz wiederkehrt – drei Knöpfe und, wenn nötig,
 * zwei Felder.
 *
 * Dieselben Felder beim Erfassen und beim Ändern: Der Takt ist dieselbe
 * Frage, gleich ob die Pendenz eben entsteht oder seit einem Jahr läuft.
 */
export function StandingFields({
  value,
  onChange,
  idPrefix,
}: {
  value: StandingRule
  onChange: (next: StandingRule) => void
  /** Damit zwei dieser Blöcke auf einer Seite nicht dieselben IDs tragen */
  idPrefix: string
}) {
  const choice = choiceOf(value)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CHOICE_LABELS) as StandingChoice[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(ruleOf(option, value))}
            aria-pressed={choice === option}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition',
              choice === option
                ? 'border-brand-500 bg-brand-50 font-medium dark:bg-brand-950'
                : 'border-slate-300 hover:border-slate-400 dark:border-slate-700',
            )}
          >
            {CHOICE_LABELS[option]}
          </button>
        ))}
      </div>

      {choice === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${idPrefix}-every`}>Alle</label>
          <input
            id={`${idPrefix}-every`}
            type="number"
            className="input w-20"
            min={1}
            max={99}
            value={value.every}
            onChange={(event) => {
              // Beim Leeren des Feldes bleibt der Takt bei 1 stehen, statt
              // kurz zu «alle NaN Wochen» zu werden.
              const next = Number.parseInt(event.target.value, 10)
              onChange({
                ...value,
                every: Number.isFinite(next) ? Math.min(99, Math.max(1, next)) : 1,
              })
            }}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-unit`}>
            Einheit
          </label>
          <select
            id={`${idPrefix}-unit`}
            className="input w-auto"
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value as StandingUnit })}
          >
            {STANDING_PERIOD_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {STANDING_UNIT_PLURAL[unit]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Was der Takt bedeutet, steht ausgeschrieben da: «alle 3 Wochen» ist
          aus zwei Feldern nebeneinander nicht auf einen Blick zu lesen. */}
      <p className="hint">
        Kehrt {standingLabel(value)} wieder.
        {value.unit === 'meeting'
          ? ' «Erledigt» setzt sie auf die nächste geplante Sitzung.'
          : ' «Erledigt» setzt sie auf die erste Sitzung nach diesem Zeitraum.'}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Aus einer Pendenz eine ständige machen – und zurück                 */
/* ------------------------------------------------------------------ */

/**
 * Der Takt eines bestehenden Eintrags.
 *
 * Beim Erfassen steht die Wahl im Formular; danach ist sie ein Fenster, das
 * über den Eintrag tritt. Der Grund ist derselbe wie beim variablen Layout:
 * Über zwanzig gewöhnlichen Pendenzen stünde sonst dauerhaft eine Frage, die
 * bei keiner von ihnen gestellt wird.
 *
 * Beide Richtungen stehen darin. **Speichern** setzt den Takt (und macht aus
 * einer gewöhnlichen Pendenz eine ständige), **Aufheben** nimmt ihn weg – aus
 * der ständigen wird wieder eine gewöhnliche, die sich abschliessen lässt.
 * Gelöscht wird dabei nichts: Titel, Beschreibung, Zuständige und der ganze
 * Verlauf bleiben, wie sie sind.
 */
export function StandingDialog({
  item,
  open,
  onClose,
}: {
  item: AgendaItem
  open: boolean
  onClose: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()

  const current = normalizeStanding(item.standing)
  const [rule, setRule] = useState<StandingRule>(current ?? DEFAULT_STANDING)
  const [saving, setSaving] = useState(false)

  const save = async (next: StandingRule | null) => {
    if (!profile) return
    setSaving(true)
    try {
      await setStanding(item.id, next, { id: profile.id, name: profile.displayName })
      toast.success(
        next
          ? `Ständige Pendenz – ${standingLabel(next)}.`
          : 'Wieder eine gewöhnliche Pendenz – sie lässt sich jetzt abschliessen.',
      )
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
      title="Ständige Pendenz"
      description="Sie wird nicht abgeschlossen, sondern kehrt wieder."
      footer={
        <>
          {/* Der Weg zurück steht links und in Ruhe: Er ist kein Löschen –
              der Eintrag bleibt, er hört bloss auf zu wiederkehren. */}
          {current && (
            <button
              type="button"
              className="btn-ghost mr-auto"
              onClick={() => void save(null)}
              disabled={saving}
            >
              Aufheben
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save(rule)}
            disabled={saving}
          >
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manches steht in jeder Sitzung. Eine ständige Pendenz wird beim Abhaken nicht erledigt,
          sondern auf ihre nächste Runde gesetzt – derselbe Eintrag, mit allem, was darin steht.
        </p>

        <StandingFields value={rule} onChange={setRule} idPrefix={`standing-${item.id}`} />

        {current && <StandingHistory rule={current} />}
      </div>
    </Modal>
  )
}

/**
 * Was der Takt bisher gebracht hat.
 *
 * Eine ständige Pendenz landet nie im Archiv – sie wird ja nie erledigt.
 * Ohne diese beiden Zeilen wäre an ihr deshalb nicht abzulesen, ob sie seit
 * einem Jahr läuft oder gestern erfasst wurde.
 */
function StandingHistory({ rule }: { rule: StandingRule }) {
  const rounds = rule.doneCount ?? 0
  if (rounds === 0 && !rule.dueFrom) return null

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      {rounds > 0 && (
        <div className="flex items-center gap-1.5">
          <dt>Bisher erledigt</dt>
          <dd className="tabular font-medium text-slate-600 dark:text-slate-300">{rounds}×</dd>
        </div>
      )}
      {rule.lastDoneAt && (
        <div className="flex items-center gap-1.5">
          <dt>Zuletzt</dt>
          <dd className="tabular font-medium text-slate-600 dark:text-slate-300">
            {formatDate(rule.lastDoneAt)}
          </dd>
        </div>
      )}
      {rule.dueFrom && (
        <div className="flex items-center gap-1.5">
          <dt>Wieder fällig ab</dt>
          <dd className="tabular font-medium text-slate-600 dark:text-slate-300">
            {formatDayKey(rule.dueFrom)}
          </dd>
        </div>
      )}
    </dl>
  )
}

/* ------------------------------------------------------------------ */
/* Der Knopf dazu                                                      */
/* ------------------------------------------------------------------ */

/**
 * «Ständige Pendenz» – der Knopf, der das Fenster öffnet.
 *
 * Er steht bei jedem Eintrag, der eine Pendenz werden kann, und trägt sein
 * Zeichen auch dann, wenn noch kein Takt eingestellt ist: Die Möglichkeit
 * soll dort zu finden sein, wo man an sie denkt – am Eintrag, der sich zum
 * dritten Mal wiederholt.
 */
export function StandingButton({
  item,
  className,
  /** Nur das Zeichen, ohne Beschriftung – für schmale Leisten */
  compact = false,
}: {
  item: AgendaItem
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rule = normalizeStanding(item.standing)

  return (
    <>
      <button
        type="button"
        className={cn('btn-secondary shrink-0', className)}
        onClick={() => setOpen(true)}
        /*
         * Kein `aria-label`: Steht der Takt am Knopf, ist «Jede Sitzung» das,
         * was dort geschrieben steht – und ein Bildschirmleser, der etwas
         * anderes vorliest, macht den Knopf per Spracheingabe unerreichbar.
         * Wo die Beschriftung weggeblendet ist (schmale Leiste am Telefon),
         * tritt der Titel an ihre Stelle.
         */
        title={rule ? `Ständige Pendenz – ${standingLabel(rule)}` : 'Zur ständigen Pendenz machen'}
      >
        <Repeat className="size-4" aria-hidden />
        <span className={compact ? 'hidden sm:inline' : undefined}>
          {rule ? standingTitle(rule) : 'Ständige Pendenz'}
        </span>
      </button>

      {/* Erst gezeichnet, wenn jemand hinsieht – so beginnt das Fenster mit
          dem Takt, der jetzt am Eintrag steht, und nicht mit dem von vorhin. */}
      {open && <StandingDialog item={item} open onClose={() => setOpen(false)} />}
    </>
  )
}

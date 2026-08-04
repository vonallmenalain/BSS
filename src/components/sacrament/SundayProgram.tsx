import { useEffect, useState } from 'react'
import { CalendarOff, Mic, MicOff, Wand2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { formatDateLong } from '@/lib/dates'
import { automaticSacramentKind, sundayProgram, type SundayProgram } from '@/lib/sunday'
import { saveSundayProgram } from '@/services/sacrament'
import {
  SACRAMENT_KINDS,
  SACRAMENT_KIND_INFO,
  type SacramentKind,
  type SacramentMeeting,
} from '@/lib/types'

/**
 * Das Programm eines Sonntags festlegen.
 *
 * Derselbe Dialog steht unter «Leitung» und unter «Ansprachen»: Es ist
 * dieselbe Angabe am selben Sonntag, und wer sie an einem Ort ändert, hat
 * sie am anderen geändert. Zwei Wege, ein Ergebnis – alles andere wäre eine
 * Einladung, dass beide Seiten Verschiedenes behaupten.
 *
 * Zur Wahl steht zuerst «Automatisch»: Solange nichts festgelegt ist, gilt
 * die Regel (erster Sonntag im Monat Zeugnisversammlung, im April und
 * Oktober Generalkonferenz). Damit ist das Festlegen jederzeit rückgängig
 * zu machen – man wählt wieder «Automatisch», statt den ursprünglichen Wert
 * erraten zu müssen.
 *
 * Die beiden Haken darunter sind die Ausnahme zur Ausnahme: eine
 * Pfahlkonferenz, die einmal doch in der Gemeinde stattfindet, oder eine
 * besondere Versammlung ohne Ansprachen. Sie stehen auf dem, was die Art
 * vorgibt, und werden nur gespeichert, wenn sie davon abweichen.
 */

/* ------------------------------------------------------------------ */
/* Etikett                                                             */
/* ------------------------------------------------------------------ */

/**
 * Was an diesem Sonntag ist – als Etikett.
 *
 * Eine gewöhnliche Abendmahlsversammlung bekommt keines: Sie ist der
 * Normalfall, und ein Etikett an jedem Sonntag sagt nichts mehr.
 */
export function SundayProgramBadge({
  program,
  className,
}: {
  program: SundayProgram
  className?: string
}) {
  if (program.kind === 'regular' && !program.adjusted) return null

  const info = SACRAMENT_KIND_INFO[program.kind]
  const tone = !program.meets
    ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
    : !program.plansTalks
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

  /* Weicht ein Haken von der Art ab, sagt das Etikett es dazu – sonst
     stünde «Abendmahlsversammlung» an einem Sonntag ohne Versammlung. */
  const aside = !program.meets
    ? info.meets
      ? 'keine Versammlung'
      : ''
    : !program.plansTalks && info.plansTalks
      ? 'keine Ansprachen'
      : ''

  return (
    <span className={cn('badge', tone, className)}>
      {!program.meets ? (
        <CalendarOff className="size-3" aria-hidden />
      ) : !program.plansTalks ? (
        <MicOff className="size-3" aria-hidden />
      ) : (
        <Mic className="size-3" aria-hidden />
      )}
      {program.label}
      {aside && <span className="font-normal">· {aside}</span>}
    </span>
  )
}

/** Was aus dem Programm folgt, in einem Satz – für Hinweise unter dem Etikett. */
export function sundayProgramNote(program: SundayProgram): string {
  if (!program.meets) return 'Keine Versammlung in der Gemeinde – es braucht keine Leitung.'
  if (!program.plansTalks) return 'Es braucht eine Leitung, aber keine Ansprachen.'
  return 'Leitung und Ansprachen wie gewohnt.'
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function SundayProgramDialog({
  open,
  date,
  meeting,
  onClose,
}: {
  open: boolean
  date: Date
  /** Der erfasste Sonntag – `null`, solange nichts erfasst ist */
  meeting: SacramentMeeting | null
  onClose: () => void
}) {
  const toast = useToast()

  /** `null` heisst «automatisch» – die Regel entscheidet. */
  const [kind, setKind] = useState<SacramentKind | null>(null)
  const [meets, setMeets] = useState(true)
  const [plansTalks, setPlansTalks] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const program = sundayProgram(date, meeting)
    setKind(meeting?.kind ?? null)
    setMeets(program.meets)
    setPlansTalks(program.plansTalks)
  }, [open, date, meeting])

  const effectiveKind = kind ?? automaticSacramentKind(date)
  const info = SACRAMENT_KIND_INFO[effectiveKind]

  /* Die Art umstellen setzt die Haken auf das, was sie vorgibt: Wer von
     «Pfahlkonferenz» auf «Abendmahlsversammlung» wechselt, meint den
     Normalfall und nicht die Haken von vorhin. */
  const chooseKind = (next: SacramentKind | null) => {
    setKind(next)
    const target = SACRAMENT_KIND_INFO[next ?? automaticSacramentKind(date)]
    setMeets(target.meets)
    setPlansTalks(target.plansTalks)
  }

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveSundayProgram(date, {
        kind,
        // Nur festhalten, was von der Art abweicht – sonst bliebe ein Haken
        // stehen, wenn die Art später eine andere Antwort gäbe.
        meets: meets === info.meets ? null : meets,
        plansTalks: plansTalks === info.plansTalks ? null : plansTalks,
      })
      toast.saved('Programm gespeichert.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const withMeeting = SACRAMENT_KINDS.filter((entry) => entry.meets)
  const withoutMeeting = SACRAMENT_KINDS.filter((entry) => !entry.meets)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Programm des Sonntags"
      description={formatDateLong(date)}
      footer={
        <>
          {kind !== null && (
            <button
              type="button"
              className="btn-ghost mr-auto"
              onClick={() => chooseKind(null)}
              disabled={saving}
            >
              <Wand2 className="size-4" aria-hidden />
              Wieder automatisch
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            Speichern
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="sunday-kind">
            Was findet statt?
          </label>
          <select
            id="sunday-kind"
            className="input"
            value={kind ?? 'auto'}
            onChange={(event) =>
              chooseKind(
                event.target.value === 'auto' ? null : (event.target.value as SacramentKind),
              )
            }
          >
            <option value="auto">
              Automatisch – {SACRAMENT_KIND_INFO[automaticSacramentKind(date)].label}
            </option>
            <optgroup label="Versammlung in der Gemeinde">
              {withMeeting.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Keine Versammlung in der Gemeinde">
              {withoutMeeting.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="hint">
            {kind === null
              ? 'Ohne eigene Angabe entscheidet die Regel: erster Sonntag im Monat Fast- und Zeugnisversammlung, im April und Oktober an diesem Tag Generalkonferenz.'
              : info.hint}
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Folgt aus der Art – für einen Einzelfall hier änderbar.
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 dark:border-slate-600"
              checked={meets}
              onChange={(event) => {
                setMeets(event.target.checked)
                // Ohne Versammlung keine Ansprachen – das ist keine Meinung,
                // sondern eine Folge.
                if (!event.target.checked) setPlansTalks(false)
              }}
            />
            <span>
              Es findet eine Versammlung statt
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Ohne Haken braucht es an diesem Sonntag keine Leitung.
              </span>
            </span>
          </label>

          <label
            className={cn(
              'flex items-start gap-2 text-sm',
              meets ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 dark:border-slate-600"
              checked={plansTalks}
              disabled={!meets}
              onChange={(event) => setPlansTalks(event.target.checked)}
            />
            <span>
              Es werden Ansprachen eingeplant
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Ohne Haken bleibt der Sonntag unter «Ansprachen» leer – ohne offene Plätze.
              </span>
            </span>
          </label>
        </div>
      </div>
    </Modal>
  )
}

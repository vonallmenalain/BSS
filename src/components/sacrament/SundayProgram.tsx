import { useEffect, useState } from 'react'
import { CalendarOff, Mic, MicOff, Trash2, Wand2 } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { cn, uid } from '@/lib/utils'
import { formatDateLong } from '@/lib/dates'
import { automaticSacramentKind, sundayProgram, type SundayProgram } from '@/lib/sunday'
import { saveSundayProgram } from '@/services/sacrament'
import { saveSettings } from '@/services/settings'
import {
  SACRAMENT_KINDS,
  SACRAMENT_KIND_INFO,
  type CustomSundayKind,
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
 *
 * Wem die sieben eingebauten Arten nicht reichen, trägt einen **eigenen
 * Grund** ein – eine Taufversammlung, ein Gemeindetag. Er landet in den
 * Einstellungen und steht danach an jedem Sonntag zur Wahl, genau wie die
 * eingebauten.
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

  const tone = !program.meets
    ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
    : !program.plansTalks
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

  /* Weicht ein Haken von der Art ab, sagt das Etikett es dazu – sonst
     stünde «Abendmahlsversammlung» an einem Sonntag ohne Versammlung. */
  const aside = !program.meets
    ? program.defaults.meets
      ? 'keine Versammlung'
      : ''
    : !program.plansTalks && program.defaults.plansTalks
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
  const { settings } = useData()
  const eigene = settings.customSundayKinds ?? []

  /** `null` heisst «automatisch» – die Regel entscheidet. */
  const [kind, setKind] = useState<string | null>(null)
  const [meets, setMeets] = useState(true)
  const [plansTalks, setPlansTalks] = useState(true)
  /** Gesetzt, solange ein neuer Grund erfasst wird – sonst `null`. */
  const [neuerGrund, setNeuerGrund] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const program = sundayProgram(date, meeting)
    setKind(meeting?.kind ?? null)
    setMeets(program.meets)
    setPlansTalks(program.plansTalks)
    setNeuerGrund(null)
  }, [open, date, meeting])

  const effectiveKind = kind ?? automaticSacramentKind(date)
  const gewaehlterGrund = eigene.find((entry) => entry.id === effectiveKind) ?? null
  const info = SACRAMENT_KIND_INFO[effectiveKind as keyof typeof SACRAMENT_KIND_INFO] ?? {
    label: gewaehlterGrund?.label ?? meeting?.kindLabel ?? 'Besonderer Anlass',
    meets,
    plansTalks,
    hint: 'Ein selbst erfasster Grund – was daraus folgt, sagen die beiden Haken.',
  }

  /* Die Art umstellen setzt die Haken auf das, was sie vorgibt: Wer von
     «Pfahlkonferenz» auf «Abendmahlsversammlung» wechselt, meint den
     Normalfall und nicht die Haken von vorhin. */
  const chooseKind = (next: string | null) => {
    setNeuerGrund(null)
    setKind(next)
    const ziel =
      SACRAMENT_KIND_INFO[
        (next ?? automaticSacramentKind(date)) as keyof typeof SACRAMENT_KIND_INFO
      ] ?? eigene.find((entry) => entry.id === next)
    if (ziel) {
      setMeets(ziel.meets)
      setPlansTalks(ziel.plansTalks)
    }
  }

  /*
   * Ein neuer Grund entsteht erst beim Speichern – wer den Dialog abbricht,
   * hinterlässt keinen halben Eintrag in den Einstellungen. Die beiden Haken
   * beschreiben ihn: Sie sind bereits da und beantworten genau die zwei
   * Fragen, die ein Grund mitbringen muss.
   */
  const beginNew = () => {
    setNeuerGrund('')
    setKind(null)
    setMeets(true)
    setPlansTalks(false)
  }

  const save = async () => {
    const bezeichnung = neuerGrund?.trim() ?? ''
    if (neuerGrund !== null && bezeichnung === '') {
      toast.error('Bitte gib dem Grund eine Bezeichnung.')
      return
    }

    setSaving(true)
    try {
      if (neuerGrund !== null) {
        // Wer denselben Grund ein zweites Mal einträgt, meint denselben –
        // zwei gleichnamige Einträge in der Auswahl helfen niemandem.
        const vorhanden = eigene.find(
          (entry) => entry.label.toLowerCase() === bezeichnung.toLowerCase(),
        )
        const grund: CustomSundayKind = vorhanden ?? {
          id: uid(),
          label: bezeichnung,
          meets,
          plansTalks,
        }
        if (!vorhanden) await saveSettings({ customSundayKinds: [...eigene, grund] })
        // Ein eigener Grund bringt keine eingebauten Vorgaben mit; seine
        // beiden Antworten stehen deshalb am Sonntag selbst.
        const outcome = await saveSundayProgram(date, {
          kind: grund.id,
          kindLabel: grund.label,
          meets,
          plansTalks,
        })
        toast.saved(
          vorhanden ? 'Programm gespeichert.' : `«${grund.label}» steht ab jetzt zur Wahl.`,
          outcome,
        )
      } else {
        const outcome = await saveSundayProgram(date, {
          kind,
          kindLabel: gewaehlterGrund?.label ?? null,
          // Nur festhalten, was von der Art abweicht – sonst bliebe ein Haken
          // stehen, wenn die Art später eine andere Antwort gäbe. Bei einem
          // eigenen Grund stehen beide fest: Er hat keine Regel hinter sich.
          meets: gewaehlterGrund ? meets : meets === info.meets ? null : meets,
          plansTalks: gewaehlterGrund
            ? plansTalks
            : plansTalks === info.plansTalks
              ? null
              : plansTalks,
        })
        toast.saved('Programm gespeichert.', outcome)
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  /*
   * Einen Grund aus der Wahl nehmen. Die Sonntage, an denen er steht,
   * behalten ihre Bezeichnung – sie ist dort mitgeschrieben.
   */
  const removeGrund = async (grund: CustomSundayKind) => {
    try {
      await saveSettings({ customSundayKinds: eigene.filter((entry) => entry.id !== grund.id) })
      toast.success(`«${grund.label}» steht nicht mehr zur Wahl.`)
      chooseKind(null)
    } catch (error) {
      console.error(error)
      toast.error('Entfernen fehlgeschlagen.')
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
          {(kind !== null || neuerGrund !== null) && (
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
            value={neuerGrund !== null ? 'neu' : (kind ?? 'auto')}
            onChange={(event) => {
              if (event.target.value === 'neu') beginNew()
              else chooseKind(event.target.value === 'auto' ? null : event.target.value)
            }}
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
            {eigene.length > 0 && (
              <optgroup label="Eigene Gründe">
                {eigene.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="neu">＋ Neuer Grund …</option>
          </select>

          {neuerGrund !== null ? (
            <div className="mt-2">
              <label className="label" htmlFor="sunday-kind-new">
                Bezeichnung
              </label>
              <input
                id="sunday-kind-new"
                className="input"
                value={neuerGrund}
                onChange={(event) => setNeuerGrund(event.target.value)}
                maxLength={60}
                autoFocus
              />
              <p className="hint">
                Der Grund wird gespeichert und steht danach an jedem Sonntag zur Wahl. Was daraus
                folgt, sagen die beiden Haken unten.
              </p>
            </div>
          ) : (
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="hint">
                {kind === null
                  ? 'Ohne eigene Angabe entscheidet die Regel: erster Sonntag im Monat Fast- und Zeugnisversammlung, im April und Oktober an diesem Tag Generalkonferenz.'
                  : info.hint}
              </p>
              {gewaehlterGrund && (
                <button
                  type="button"
                  className="btn-ghost btn-sm shrink-0 text-rose-600 dark:text-rose-400"
                  onClick={() => void removeGrund(gewaehlterGrund)}
                  disabled={saving}
                  title="Diesen Grund nicht mehr zur Wahl stellen"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Grund entfernen
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {neuerGrund !== null
              ? 'Gilt für diesen Grund – überall, wo er gewählt wird.'
              : 'Folgt aus der Art – für einen Einzelfall hier änderbar.'}
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

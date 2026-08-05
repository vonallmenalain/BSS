import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { BusinessFields } from '@/components/sacrament/BusinessFields'
import { formatDateLong, toDateInput, upcomingWeekdays } from '@/lib/dates'
import {
  appendAnnouncement,
  appendBusinessEntry,
  isBusinessEmpty,
  newAnnouncement,
  newBusinessEntry,
} from '@/services/sacrament'
import type { BusinessEntry } from '@/lib/types'

/*
 * Eine Bekanntmachung oder eine Angelegenheit erfassen, ohne die Sitzung zu
 * verlassen.
 *
 * In der Bischofschaftssitzung fällt beides laufend an: «Das sagen wir am
 * Sonntag an», «Den bestätigen wir». Bis anhin hiess das, die Sitzung zu
 * verlassen, den Sonntag zu suchen und danach zurückzufinden – drei
 * Handgriffe für einen Satz. Diese beiden Fenster erledigen es an Ort und
 * Stelle.
 *
 * Gefragt wird zuerst nach dem Sonntag, denn er ist die einzige Angabe, die
 * hier nicht von selbst feststeht; vorgeschlagen wird der nächste.
 * Geschrieben wird **angehängt** und nicht als ganze Liste (siehe
 * `appendAnnouncement`): Was auf dem Programm sonst noch steht, liegt hier
 * gar nicht vor und dürfte dabei nicht verloren gehen.
 *
 * Beide Fenster werden vom Aufrufer nur dann gezeichnet, wenn sie offen sind
 * – so beginnt jedes Erfassen mit leeren Feldern, ohne dass sie ein Effekt
 * zurücksetzen müsste.
 */

/* ------------------------------------------------------------------ */

export function QuickAnnouncementDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [date, setDate] = useNextSunday()
  const [text, setText] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) {
      toast.error('Bitte gib den Wortlaut ein.')
      return
    }

    setSaving(true)
    try {
      const outcome = await appendAnnouncement(asSunday(date), {
        ...newAnnouncement(text.trim()),
        details: details.trim(),
      })
      toast.saved('Bekanntmachung erfasst.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Neue Bekanntmachung"
      description="Wird beim gewählten Sonntag angehängt – die Sitzung bleibt offen."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="quick-announcement" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Erfassen'}
          </button>
        </>
      }
    >
      <form id="quick-announcement" onSubmit={handleSubmit} className="space-y-4">
        <SundayPicker value={date} onChange={setDate} />

        <div>
          <label className="label" htmlFor="quick-announcement-text">
            Bekanntmachung
          </label>
          <input
            id="quick-announcement-text"
            className="input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="quick-announcement-details">
            Einzelheiten für die Person am Pult
          </label>
          <textarea
            id="quick-announcement-details"
            className="input min-h-20 resize-y text-sm"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </div>

        <SundayLink date={date} to="/abendmahl/bekanntmachungen" label="Zu den Bekanntmachungen" />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

export function QuickBusinessDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [date, setDate] = useNextSunday()
  const [entry, setEntry] = useState<BusinessEntry>(newBusinessEntry)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isBusinessEmpty(entry)) {
      toast.error('Bitte wähle ein Mitglied aus oder gib eine Aufgabe an.')
      return
    }

    setSaving(true)
    try {
      const outcome = await appendBusinessEntry(asSunday(date), entry)
      toast.saved('Angelegenheit erfasst.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Neue Angelegenheit"
      description="Wird beim gewählten Sonntag angehängt – die Sitzung bleibt offen."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="quick-business" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Erfassen'}
          </button>
        </>
      }
    >
      <form id="quick-business" onSubmit={handleSubmit} className="space-y-4">
        <SundayPicker value={date} onChange={setDate} />

        <div>
          <span className="label">Art, Mitglied und Aufgabe</span>
          <BusinessFields entry={entry} index={0} onChange={setEntry} />
          <p className="hint">
            Der Eintrag hält fest, was am Sonntag vorgelesen wird. An der Berufung selbst ändert er
            nichts – die kommt aus dem LCR.
          </p>
        </div>

        <SundayLink date={date} to="/abendmahl/angelegenheiten" label="Zu den Angelegenheiten" />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

/** Der vorgeschlagene Sonntag – der nächste. */
function useNextSunday() {
  const { settings } = useData()
  return useState(() => toDateInput(upcomingWeekdays(settings.sacramentWeekday, 1)[0]))
}

/** Ein Datum aus dem Feld zurück in einen Tag – mittags, wie überall sonst. */
function asSunday(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`)
}

function SundayPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { settings } = useData()
  const sundays = useMemo(
    () => upcomingWeekdays(settings.sacramentWeekday, 8),
    [settings.sacramentWeekday],
  )

  return (
    <div>
      <label className="label" htmlFor="quick-sunday">
        Für welchen Sonntag?
      </label>
      <select
        id="quick-sunday"
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {sundays.map((sunday) => (
          <option key={toDateInput(sunday)} value={toDateInput(sunday)}>
            {formatDateLong(sunday)}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Der Weg zum ganzen Sonntag – für alles, was dieses Fenster nicht kann. */
function SundayLink({ date, to, label }: { date: string; to: string; label: string }) {
  return (
    <Link
      to={`${to}?sonntag=${date}`}
      className="text-brand-600 dark:text-brand-300 inline-flex items-center gap-1 text-sm hover:underline"
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

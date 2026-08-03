import { ChevronDown, ChevronUp, Megaphone, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { EmptyState } from '@/components/ui/Feedback'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import {
  moveInList,
  newAnnouncement,
  replaceInList,
  saveSacramentMeeting,
} from '@/services/sacrament'
import type { AnnouncementEntry } from '@/lib/types'

/**
 * Bekanntmachungen für einen Sonntag.
 *
 * Das Handbuch verlangt, sie auf ein Minimum zu beschränken – deshalb steht
 * die Zahl der Einträge gut sichtbar oben. Die Reihenfolge ist die, in der sie
 * am Pult vorgelesen werden, und erscheint genauso unter «Leitung».
 *
 * Gespeichert wird laufend: kurz nach dem letzten Tastendruck und spätestens
 * beim Verlassen der Seite. «Speichern» schreibt sofort und räumt leere Zeilen
 * weg – die Seite bleibt dabei stehen, wo sie ist.
 */
export function Announcements() {
  const { date, meeting } = useSacrament()
  const toast = useToast()

  const draft = useAutoDraft<AnnouncementEntry[]>(
    meeting?.announcements ?? [],
    (value) => saveSacramentMeeting(date, { announcements: value }),
    { onError: () => toast.error('Speichern fehlgeschlagen.') },
  )

  const entries = draft.value
  const change = draft.set

  /*
   * Speichern und stehen bleiben. Früher führte der Knopf zurück, wo man
   * hergekommen war – wer vorher bei den Ansprachen gewesen war, landete nach
   * dem Speichern dort und damit mitten aus der Arbeit gerissen.
   */
  const save = async () => {
    // Leere Einträge fallen zum Schluss weg – so bleibt die Liste sauber.
    const cleaned = entries.filter((entry) => entry.text.trim())
    try {
      const outcome = await saveSacramentMeeting(date, { announcements: cleaned })
      draft.reset()
      toast.saved('Bekanntmachungen gespeichert.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <>
      <SectionHeader
        title="Bekanntmachungen"
        description={
          entries.length === 0
            ? 'Was am Sonntag von der Kanzel gesagt wird.'
            : `${entries.length} Eintrag${entries.length === 1 ? '' : 'e'} · laut Handbuch auf ein Minimum beschränken`
        }
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => change([...entries, newAnnouncement()])}
            >
              <Plus className="size-4" aria-hidden />
              Bekanntmachung
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()}>
              Speichern
            </button>
          </>
        }
      />

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      {entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Megaphone}
            title="Keine Bekanntmachungen"
            description="Vieles lässt sich auch schriftlich oder in anderen Versammlungen mitteilen."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => change([newAnnouncement()])}
              >
                <Plus className="size-4" aria-hidden />
                Erste Bekanntmachung
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.id} className="card p-3">
              <div className="flex items-start gap-2">
                <span className="tabular mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="input"
                    value={entry.text}
                    onChange={(event) =>
                      change(replaceInList(entries, { ...entry, text: event.target.value }))
                    }
                    placeholder="Worum geht es? z. B. «Gemeindeausflug am 30. August»"
                    aria-label={`Bekanntmachung ${index + 1}`}
                  />
                  <textarea
                    className="input min-h-16 resize-y text-sm"
                    value={entry.details ?? ''}
                    onChange={(event) =>
                      change(replaceInList(entries, { ...entry, details: event.target.value }))
                    }
                    placeholder="Einzelheiten für die Person am Pult: Zeit, Ort, wer angesprochen ist …"
                    aria-label={`Einzelheiten zu Bekanntmachung ${index + 1}`}
                  />
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn-ghost p-1.5"
                    onClick={() => change(moveInList(entries, index, -1))}
                    disabled={index === 0}
                    aria-label="Nach oben"
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-1.5"
                    onClick={() => change(moveInList(entries, index, 1))}
                    disabled={index === entries.length - 1}
                    aria-label="Nach unten"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
                    onClick={() => change(entries.filter((e) => e.id !== entry.id))}
                    aria-label="Entfernen"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
        {draft.saving ? 'Wird gespeichert …' : 'Änderungen werden automatisch gespeichert.'}
      </p>
    </>
  )
}

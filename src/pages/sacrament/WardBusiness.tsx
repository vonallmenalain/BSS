import { useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { EmptyState } from '@/components/ui/Feedback'
import { BusinessFields } from '@/components/sacrament/BusinessFields'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useDraft } from '@/components/sacrament/useDraft'
import {
  isBusinessEmpty,
  moveInList,
  newBusinessEntry,
  replaceInList,
  saveSacramentMeeting,
} from '@/services/sacrament'
import type { BusinessEntry } from '@/lib/types'

/**
 * Angelegenheiten der Gemeinde oder des Pfahles.
 *
 * Drei Spalten, mehr braucht ein Eintrag nicht: **was** geschieht
 * (Bestätigung, Entlassung, Segnung …), **wer** es betrifft und **welche
 * Aufgabe** gemeint ist. Die Person kommt aus dem Mitgliederverzeichnis –
 * getippt wird der Anfang des Namens, gewählt wird aus den Treffern.
 *
 * Was hier steht, **ändert an keiner Berufung etwas**. Wer welche Berufung
 * hat, sagt allein das LCR und der Import von dort; diese Liste ist der
 * Wortlaut für den Sonntag und sonst nichts. Früher liessen sich Einträge
 * aus den Berufungen übernehmen und blieben mit ihnen verknüpft – das ist
 * weggefallen.
 */
export function WardBusiness() {
  const { date, meeting } = useSacrament()
  const toast = useToast()

  const draft = useDraft<BusinessEntry[]>(meeting?.business ?? [])
  const [saving, setSaving] = useState(false)

  const entries = draft.value
  const change = draft.set

  const save = async () => {
    setSaving(true)
    try {
      const cleaned = entries.filter((entry) => !isBusinessEmpty(entry))
      const outcome = await saveSacramentMeeting(date, { business: cleaned })
      draft.reset()
      toast.saved('Angelegenheiten gespeichert.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader
        title="Angelegenheiten der Gemeinde"
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => change([...entries, newBusinessEntry()])}
            >
              <Plus className="size-4" aria-hidden />
              Eintrag
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void save()}
              disabled={!draft.dirty || saving}
            >
              {saving ? 'Wird gespeichert …' : draft.conflict ? 'Trotzdem speichern' : 'Speichern'}
            </button>
          </>
        }
      />

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      {entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Keine Angelegenheiten"
            description="An diesem Sonntag stehen keine Bestätigungen, Entlassungen oder Segnungen an."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => change([newBusinessEntry()])}
              >
                <Plus className="size-4" aria-hidden />
                Ersten Eintrag anlegen
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.id} className="card p-3">
              <div className="flex items-start gap-2">
                <BusinessFields
                  entry={entry}
                  index={index}
                  onChange={(next) => change(replaceInList(entries, next))}
                />

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

      {draft.dirty && (
        <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-400">
          Ungespeicherte Änderungen
        </p>
      )}
    </>
  )
}

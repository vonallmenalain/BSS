import { ChevronDown, ChevronUp, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { EmptyState } from '@/components/ui/Feedback'
import { BusinessFields } from '@/components/sacrament/BusinessFields'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import {
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
 * Gespeichert wird laufend: kurz nach der letzten Eingabe und spätestens beim
 * Verlassen der Seite. Einen Speichern-Knopf gibt es nicht – er war die
 * einzige Stelle, an der sich Eingetragenes verlieren liess, und am Telefon
 * die wahrscheinlichste.
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

  /*
   * Geschrieben wird die Liste, wie sie dasteht – auch die eben angelegte,
   * noch leere Zeile. Sie beim Speichern wegzulassen hiesse, sie eine Sekunde
   * nach dem Anlegen unter den Fingern verschwinden zu lassen. Gelesen wird
   * ohnehin gefiltert (siehe «Leitung»), und weg ist eine Zeile mit einem
   * Griff auf den Papierkorb.
   */
  const draft = useAutoDraft<BusinessEntry[]>(
    meeting?.business ?? [],
    (value) => saveSacramentMeeting(date, { business: value }),
    { onError: () => toast.error('Speichern fehlgeschlagen.') },
  )

  const entries = draft.value
  const change = draft.set

  return (
    <>
      <SectionHeader
        title="Angelegenheiten der Gemeinde"
        actions={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => change([...entries, newBusinessEntry()])}
          >
            <Plus className="size-4" aria-hidden />
            Eintrag
          </button>
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

      {draft.saving && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          Wird gespeichert …
        </p>
      )}
    </>
  )
}

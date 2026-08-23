import { Music2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { MemberPicker } from '@/components/ui/Pickers'
import { HymnField } from '@/components/sacrament/HymnField'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import { newMusicalNumber, replaceInList, saveSacramentMeeting } from '@/services/sacrament'
import { HYMN_SLOT_LABELS, type HymnChoice, type HymnSlot, type MusicalNumber } from '@/lib/types'

interface MusicDraft {
  hymns: Partial<Record<HymnSlot, HymnChoice>>
  numbers: MusicalNumber[]
}

/**
 * Musik einer Abendmahlsversammlung.
 *
 * Drei Lieder gehören immer dazu (Anfang, Abendmahl, Schluss), das
 * Zwischenlied ist freiwillig. Zusätzlich lassen sich Musikeinlagen erfassen –
 * mit den Mitgliedern, die vortragen. Die Reihenfolge von Zwischenlied und
 * Musikeinlagen zwischen den Ansprachen wird unter «Leitung» festgelegt.
 *
 * Gespeichert wird laufend, wie überall in diesem Bereich: kurz nach der
 * letzten Eingabe und spätestens beim Verlassen der Seite.
 */
export function Music() {
  const { date, meeting } = useSacrament()
  const { canEditSacramentArea } = useAuth()
  const toast = useToast()

  /*
   * Eine Assistenz kann diesen Bereich auch bloss zum Nachschauen haben
   * (siehe `AuthContext`). Dann steht alles da, was dasteht – nur ohne die
   * Knöpfe, die etwas daran ändern. Die Zugriffsregeln sagen ohnehin nein;
   * hier geht es darum, gar nicht erst dagegen zu laufen.
   */
  const readOnly = !canEditSacramentArea('music')

  /*
   * Geschrieben wird, was dasteht – auch die eben angelegte, noch leere
   * Musikeinlage. Sie beim Speichern wegzulassen hiesse, sie eine Sekunde
   * nach dem Anlegen wieder verschwinden zu lassen.
   */
  const draft = useAutoDraft<MusicDraft>(
    {
      hymns: meeting?.hymns ?? {},
      numbers: meeting?.musicalNumbers ?? [],
    },
    (value) => saveSacramentMeeting(date, { hymns: value.hymns, musicalNumbers: value.numbers }),
    { onError: () => toast.error('Speichern fehlgeschlagen.') },
  )

  const current = draft.value

  const setHymn = (slot: HymnSlot, choice: HymnChoice | undefined) => {
    const hymnChoices = { ...current.hymns }
    // Firestore lehnt `undefined` ab – ein geleertes Lied wird deshalb
    // aus dem Objekt entfernt statt auf `undefined` gesetzt.
    if (choice) hymnChoices[slot] = choice
    else delete hymnChoices[slot]
    draft.set({ ...current, hymns: hymnChoices })
  }

  const changeNumbers = (next: MusicalNumber[]) => draft.set({ ...current, numbers: next })

  /*
   * Löschen ohne Rückfrage, aber mit Reue: «Rückgängig» in der Meldung stellt
   * den Stand von unmittelbar vor dem Löschen wieder her.
   */
  const removeNumber = (entry: MusicalNumber) => {
    const before = current
    changeNumbers(current.numbers.filter((n) => n.id !== entry.id))
    toast.undo('Musikeinlage entfernt.', () => draft.set(before))
  }

  return (
    <>
      <SectionHeader title="Musik" readOnly={readOnly} />

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      <section className="card mb-4 space-y-3 p-4">
        <h3 className="text-sm font-semibold">Gemeindelieder</h3>
        {(['opening', 'sacrament', 'intermediate', 'closing'] as HymnSlot[]).map((slot) => (
          <HymnField
            key={slot}
            label={HYMN_SLOT_LABELS[slot]}
            value={current.hymns[slot]}
            onChange={(next) => setHymn(slot, next)}
            optional={slot === 'intermediate'}
            readOnly={readOnly}
            hint={
              slot === 'sacrament'
                ? 'Das Abendmahlslied handelt vom Erlöser und seinem Opfer.'
                : slot === 'intermediate'
                  ? 'Freiwillig – wird zwischen den Ansprachen gesungen.'
                  : undefined
            }
          />
        ))}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Musikeinlagen</h3>
            <p className="hint">Chor, Solo oder Instrumentalstück statt eines Gemeindeliedes.</p>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => changeNumbers([...current.numbers, newMusicalNumber()])}
            >
              <Plus className="size-3.5" aria-hidden />
              Musikeinlage
            </button>
          )}
        </div>

        {current.numbers.length === 0 ? (
          <p className="flex items-center gap-2 py-3 text-sm text-slate-500 dark:text-slate-400">
            <Music2 className="size-4" aria-hidden />
            Keine Musikeinlage vorgesehen.
          </p>
        ) : (
          <ul className="divide-list">
            {current.numbers.map((entry, index) => (
              <li key={entry.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex items-start gap-2">
                  {readOnly ? (
                    <p className="flex-1 text-sm font-medium">
                      {entry.title || <span className="text-slate-400">Ohne Titel</span>}
                    </p>
                  ) : (
                    <>
                      <input
                        className="input"
                        value={entry.title}
                        onChange={(event) =>
                          changeNumbers(
                            replaceInList(current.numbers, { ...entry, title: event.target.value }),
                          )
                        }
                        placeholder="Titel des Stücks"
                        aria-label={`Titel der Musikeinlage ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="btn-ghost shrink-0 p-2 text-rose-600 dark:text-rose-400"
                        onClick={() => removeNumber(entry)}
                        aria-label="Musikeinlage entfernen"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>

                <MemberPicker
                  value={entry.memberIds}
                  onChange={(next) =>
                    changeNumbers(replaceInList(current.numbers, { ...entry, memberIds: next }))
                  }
                  label="Wer trägt vor?"
                  placeholder="Mitglied suchen …"
                  readOnly={readOnly}
                />

                {readOnly ? (
                  entry.performers && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{entry.performers}</p>
                  )
                ) : (
                  <input
                    className="input text-sm"
                    value={entry.performers ?? ''}
                    onChange={(event) =>
                      changeNumbers(
                        replaceInList(current.numbers, {
                          ...entry,
                          performers: event.target.value,
                        }),
                      )
                    }
                    placeholder="Weitere Mitwirkende"
                    aria-label={`Weitere Mitwirkende der Musikeinlage ${index + 1}`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft.saving && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          Wird gespeichert …
        </p>
      )}
    </>
  )
}

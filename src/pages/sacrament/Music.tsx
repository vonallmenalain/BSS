import { useState } from 'react'
import { Music2, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { MemberPicker } from '@/components/ui/Pickers'
import { HymnField } from '@/components/sacrament/HymnField'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useDraft } from '@/components/sacrament/useDraft'
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
 */
export function Music() {
  const { date, meeting } = useSacrament()
  const toast = useToast()

  const draft = useDraft<MusicDraft>({
    hymns: meeting?.hymns ?? {},
    numbers: meeting?.musicalNumbers ?? [],
  })
  const [saving, setSaving] = useState(false)

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

  const save = async () => {
    setSaving(true)
    try {
      const cleanedNumbers = current.numbers.filter(
        (entry) => entry.title.trim() || entry.memberIds.length > 0 || entry.performers?.trim(),
      )
      const outcome = await saveSacramentMeeting(date, {
        hymns: current.hymns,
        musicalNumbers: cleanedNumbers,
      })
      draft.reset()
      toast.saved('Musik gespeichert.', outcome)
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
        title="Musik"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!draft.dirty || saving}
          >
            {saving ? 'Wird gespeichert …' : draft.conflict ? 'Trotzdem speichern' : 'Speichern'}
          </button>
        }
      />

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
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => changeNumbers([...current.numbers, newMusicalNumber()])}
          >
            <Plus className="size-3.5" aria-hidden />
            Musikeinlage
          </button>
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
                    onClick={() => changeNumbers(current.numbers.filter((n) => n.id !== entry.id))}
                    aria-label="Musikeinlage entfernen"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                <MemberPicker
                  value={entry.memberIds}
                  onChange={(next) =>
                    changeNumbers(replaceInList(current.numbers, { ...entry, memberIds: next }))
                  }
                  label="Wer trägt vor?"
                  placeholder="Mitglied suchen …"
                />

                <input
                  className="input text-sm"
                  value={entry.performers ?? ''}
                  onChange={(event) =>
                    changeNumbers(
                      replaceInList(current.numbers, { ...entry, performers: event.target.value }),
                    )
                  }
                  placeholder="Weitere Mitwirkende"
                  aria-label={`Weitere Mitwirkende der Musikeinlage ${index + 1}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft.dirty && (
        <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-400">
          Ungespeicherte Änderungen
        </p>
      )}
    </>
  )
}

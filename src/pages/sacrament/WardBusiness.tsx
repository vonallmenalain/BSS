import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Plus, Trash2, Wand2 } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCallingsInPreparation } from '@/hooks/useFirestore'
import { EmptyState } from '@/components/ui/Feedback'
import { MemberPicker } from '@/components/ui/Pickers'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useDraft } from '@/components/sacrament/useDraft'
import {
  moveInList,
  newBusinessEntry,
  replaceInList,
  saveSacramentMeeting,
} from '@/services/sacrament'
import {
  BUSINESS_TYPE_LABELS,
  ORGANIZATION_LABELS,
  type BusinessEntry,
  type BusinessType,
} from '@/lib/types'

/**
 * Angelegenheiten der Gemeinde oder des Pfahles.
 *
 * Bestätigungen und Entlassungen stehen in aller Regel schon im Bereich
 * «Berufungen». Deshalb lassen sie sich von dort übernehmen, statt den
 * Namen ein zweites Mal zu tippen – die Berufung bleibt dabei verknüpft.
 */
export function WardBusiness() {
  const { date, meeting } = useSacrament()
  const { memberName } = useData()
  const { data: callings } = useCallingsInPreparation()
  const toast = useToast()

  const draft = useDraft<BusinessEntry[]>(meeting?.business ?? [])
  const [saving, setSaving] = useState(false)

  const entries = draft.value
  const change = draft.set

  /* Berufungen, die noch bestätigt bzw. entlassen werden müssen. */
  const openCallings = useMemo(() => {
    const used = new Set(entries.map((entry) => entry.callingId).filter(Boolean))
    return callings
      .filter((calling) => !used.has(calling.id))
      .filter(
        (calling) =>
          (calling.status === 'approved' || calling.status === 'extended') &&
          !calling.sustainedDate,
      )
      .slice(0, 8)
  }, [callings, entries])

  const save = async () => {
    setSaving(true)
    try {
      const cleaned = entries.filter((entry) => entry.text.trim() || entry.memberIds.length > 0)
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

      {openCallings.length > 0 && (
        <section className="card mb-3 p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="size-4 text-slate-400" aria-hidden />
            Aus den Berufungen übernehmen
          </h3>
          <p className="hint mb-3">
            Diese Berufungen sind ausgesprochen, aber noch nicht bestätigt.
          </p>
          <ul className="flex flex-wrap gap-2">
            {openCallings.map((calling) => (
              <li key={calling.id}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    change([
                      ...entries,
                      newBusinessEntry({
                        type: 'sustaining',
                        text: `${calling.memberName} – ${calling.position} (${ORGANIZATION_LABELS[calling.organization]})`,
                        memberIds: [calling.memberId],
                        callingId: calling.id,
                      }),
                    ])
                  }
                >
                  <Plus className="size-3" aria-hidden />
                  {calling.memberName} · {calling.position}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="input w-auto py-1.5 text-sm"
                      value={entry.type}
                      onChange={(event) =>
                        change(
                          replaceInList(entries, {
                            ...entry,
                            type: event.target.value as BusinessType,
                          }),
                        )
                      }
                      aria-label={`Art des Eintrags ${index + 1}`}
                    >
                      {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
                        <option key={type} value={type}>
                          {BUSINESS_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>

                    <input
                      className="input min-w-48 flex-1"
                      value={entry.text}
                      onChange={(event) =>
                        change(replaceInList(entries, { ...entry, text: event.target.value }))
                      }
                      placeholder="Name und Aufgabe"
                      aria-label={`Text des Eintrags ${index + 1}`}
                    />
                  </div>

                  <MemberPicker
                    value={entry.memberIds}
                    onChange={(next) =>
                      change(replaceInList(entries, { ...entry, memberIds: next }))
                    }
                    label="Betroffene Mitglieder (optional)"
                    placeholder="Name eingeben …"
                  />

                  {entry.callingId && (
                    <p className="hint">
                      Verknüpft mit einer Berufung von{' '}
                      {entry.memberIds[0] ? memberName(entry.memberIds[0]) : 'einem Mitglied'}.
                    </p>
                  )}
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

      {draft.dirty && (
        <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-400">
          Ungespeicherte Änderungen
        </p>
      )}
    </>
  )
}

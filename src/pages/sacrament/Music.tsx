import { useCallback, useId, useMemo, useState } from 'react'
import { CalendarRange, FileDown, Music2, Piano, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAllSacramentMeetings } from '@/hooks/useFirestore'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberPicker } from '@/components/ui/Pickers'
import { HymnField } from '@/components/sacrament/HymnField'
import { MusicExportDialog } from '@/components/sacrament/MusicExport'
import { OrganistField } from '@/components/sacrament/OrganistField'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { SundayProgramBadge } from '@/components/sacrament/SundayProgram'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import { formatDateLong } from '@/lib/dates'
import { scheduledOrganists, sundaysOf, type MusicRow } from '@/lib/organist'
import { cn } from '@/lib/utils'
import { sundayProgram } from '@/lib/sunday'
import { newMusicalNumber, replaceInList, saveSacramentMeeting } from '@/services/sacrament'
import {
  HYMN_SLOTS,
  HYMN_SLOT_LABELS,
  type HymnChoice,
  type HymnSlot,
  type MusicalNumber,
} from '@/lib/types'

interface MusicDraft {
  hymns: Partial<Record<HymnSlot, HymnChoice>>
  numbers: MusicalNumber[]
}

/**
 * Musik einer Abendmahlsversammlung.
 *
 * Zuoberst steht, wer spielt: **ein** Organist je Sonntag, und er spielt
 * alle Lieder. Darunter die drei Lieder, die immer dazugehören (Anfang,
 * Abendmahl, Schluss), das freiwillige Zwischenlied und die Musikeinlagen –
 * mit den Mitgliedern, die vortragen. Die Reihenfolge von Zwischenlied und
 * Musikeinlagen zwischen den Ansprachen wird unter «Leitung» festgelegt.
 *
 * Über allem liegt ein Filter: Wer einen Organisten wählt, sieht statt des
 * einen Sonntags dessen sämtliche Sonntage mit ihren Liedern – die Antwort
 * auf «wann bin ich eingeteilt?». Denselben Ausschnitt gibt der Knopf
 * **Exportieren** aufs Papier, zum Weiterreichen an die Organisten.
 *
 * Gespeichert wird laufend, wie überall in diesem Bereich: kurz nach der
 * letzten Eingabe und spätestens beim Verlassen der Seite.
 */
export function Music() {
  const { date, setDate, meeting } = useSacrament()
  const { canEditSacramentArea } = useAuth()
  const { membersById } = useData()
  const { data: meetings } = useAllSacramentMeetings()
  const toast = useToast()
  const filterId = useId()

  /* Der gewählte Organist steht in der Adresse – so führt «Zurück»
     dorthin zurück, wo man war (siehe `hooks/useUrlState`). */
  const [filter, setFilter] = useUrlState<string>('organist', '')
  const [exportOpen, setExportOpen] = useState(false)

  /*
   * Eine Assistenz kann diesen Bereich auch bloss zum Nachschauen haben
   * (siehe `AuthContext`). Dann steht alles da, was dasteht – der Organist
   * und alle Lieder –, nur ohne die Knöpfe, die etwas daran ändern. Die
   * Zugriffsregeln sagen ohnehin nein; hier geht es darum, gar nicht erst
   * dagegen zu laufen.
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

  /** Der heutige Name eines Mitglieds – er gewinnt über den am Sonntag. */
  const resolveName = useCallback(
    (id: string) => {
      const member = membersById.get(id)
      return member ? `${member.firstName} ${member.lastName}` : undefined
    },
    [membersById],
  )

  /** Zur Wahl steht, wer irgendwann einmal eingeteilt ist – sonst niemand. */
  const organists = useMemo(
    () => scheduledOrganists(meetings, resolveName),
    [meetings, resolveName],
  )

  const chosen = organists.find((entry) => entry.key === filter) ?? null
  const filtered = useMemo(
    () => (chosen ? sundaysOf(meetings, [chosen.key], resolveName) : []),
    [chosen, meetings, resolveName],
  )

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

  /**
   * Einen Sonntag aus der gefilterten Liste öffnen – und den Filter lösen.
   *
   * Beides in einem Schritt: Sonntag und Filter stehen in derselben
   * Adresse, und zwei getrennte Aufrufe gingen vom selben Stand aus – der
   * zweite überschriebe den ersten (siehe `setDate` in `SacramentLayout`).
   */
  const open = (next: Date) => setDate(next, (params) => params.delete('organist'))

  return (
    <>
      <SectionHeader
        title="Musik"
        actions={
          <button type="button" className="btn-secondary" onClick={() => setExportOpen(true)}>
            <FileDown className="size-4" aria-hidden />
            Exportieren
          </button>
        }
      />

      {/* Der Filter steht unter dem Datum und über allem Übrigen: Er
          entscheidet, ob hier ein Sonntag steht oder die Sonntage einer
          Person. */}
      <div className="no-print card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor={filterId}>
            Organist
          </label>
          <select
            id={filterId}
            className="input"
            /* Nicht `filter` selbst: Steht in der Adresse noch der
               Schlüssel von jemandem, der inzwischen nirgends mehr
               eingeteilt ist, gäbe es dazu keinen Eintrag – und das Feld
               stünde leer statt auf «Alle». */
            value={chosen?.key ?? ''}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">Alle – dieser Sonntag</option>
            {organists.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <p className="hint mt-0 max-w-xs flex-1 basis-48">
          {chosen
            ? `Alle Sonntage von ${chosen.name} mit ihren Liedern.`
            : 'Eine Person wählen, um ihre Sonntage und Lieder zu sehen.'}
        </p>
      </div>

      {chosen ? (
        <OrganistSundays rows={filtered} name={chosen.name} onOpen={open} />
      ) : (
        <>
          {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

          <section className="card mb-4 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Piano className="size-4 text-slate-400" aria-hidden />
              Organist
            </h3>
            <p className="hint mb-3">
              Eine Person je Sonntag – sie spielt alle Lieder der Versammlung.
            </p>
            <OrganistField date={date} meeting={meeting} readOnly={readOnly} />
          </section>

          <section className="card mb-4 space-y-3 p-4">
            <h3 className="text-sm font-semibold">Gemeindelieder</h3>
            {HYMN_SLOTS.map((slot) => (
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
                <p className="hint">
                  Chor, Solo oder Instrumentalstück statt eines Gemeindeliedes.
                </p>
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
                                replaceInList(current.numbers, {
                                  ...entry,
                                  title: event.target.value,
                                }),
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
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {entry.performers}
                        </p>
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
      )}

      {/* Bleibt eingehängt, auch wenn der Dialog zu ist: Beim Drucken
          schliesst er sich, das Blatt dahinter muss stehen bleiben. */}
      <MusicExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        date={date}
        meetings={meetings}
        preselect={chosen?.key ?? ''}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Die Sonntage eines Organisten                                       */
/* ------------------------------------------------------------------ */

/**
 * Was der Filter zeigt: jeder Sonntag dieser Person mit seinen Liedern.
 *
 * Vergangene Sonntage bleiben stehen, nur zurückgenommen – die Frage
 * lautet «wann bin ich eingeteilt?», und die Antwort beginnt nicht bei
 * null, bloss weil ein Monat vorbei ist.
 */
function OrganistSundays({
  rows,
  name,
  onOpen,
}: {
  rows: MusicRow[]
  name: string
  onOpen: (date: Date) => void
}) {
  const { hymnLabel } = useData()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Für {name} ist zurzeit kein Sonntag eingeteilt.
      </div>
    )
  }

  return (
    <section className="card">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <CalendarRange className="size-4 text-slate-400" aria-hidden />
        <h3 className="text-sm font-semibold">{name}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rows.length} {rows.length === 1 ? 'Sonntag' : 'Sonntage'}
        </span>
      </header>

      <ul className="divide-list">
        {rows.map((row) => {
          const past = row.date < today
          const program = sundayProgram(row.date, row.meeting)
          return (
            <li key={row.dateKey} className={cn('px-4 py-3', past && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  onClick={() => onOpen(row.date)}
                  title="Diesen Sonntag öffnen"
                >
                  {formatDateLong(row.date)}
                </button>
                <SundayProgramBadge program={program} />
              </div>

              <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {HYMN_SLOTS.map((slot) => {
                  const choice = row.hymns[slot]
                  if (!choice) return null
                  const code = choice.code ?? (choice.number != null ? String(choice.number) : '')
                  return (
                    <div key={slot} className="flex gap-2 text-sm">
                      <dt className="w-32 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {HYMN_SLOT_LABELS[slot]}
                      </dt>
                      <dd className="min-w-0">
                        <span className="tabular font-medium">{code}</span>
                        {code && hymnLabel(choice) && ' · '}
                        {hymnLabel(choice)}
                      </dd>
                    </div>
                  )
                })}
              </dl>

              {HYMN_SLOTS.every((slot) => !row.hymns[slot]) && (
                <p className="mt-1 text-sm text-slate-400">Noch keine Lieder erfasst.</p>
              )}

              {row.numbers.length > 0 && (
                <p className="mt-1.5 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Music2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {row.numbers
                    .map((entry) =>
                      [entry.title.trim() || 'Musikeinlage', entry.performers?.trim()]
                        .filter(Boolean)
                        .join(' – '),
                    )
                    .join(' · ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

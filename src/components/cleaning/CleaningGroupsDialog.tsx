import { useMemo, useState } from 'react'
import { ArrowUp, Check, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningGroups } from '@/hooks/useFirestore'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import {
  entriesKey,
  entryLabelFromMembers,
  groupOfMember,
  normalizedEntries,
  sortedGroups,
  unassignedMembers,
  withoutConfirmed,
  withPendingGroups,
} from '@/lib/cleaningGroups'
import { cn, matchesSearch, uid } from '@/lib/utils'
import { toDate } from '@/lib/dates'
import { deleteCleaningGroup, saveCleaningGroup } from '@/services/cleaning'
import type { CleaningGroup, CleaningGroupEntry, Member } from '@/lib/types'

/** Was gerade bearbeitet wird – ein Eintrag oder ein neuer in einer Gruppe. */
type Editing = { group: number; entryId: string | null } | null

function memberName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`
}

function birthYear(member: Pick<Member, 'birthDate'>): string {
  const date = toDate(member.birthDate)
  return date ? `Jg. ${date.getFullYear()}` : ''
}

/**
 * Die Gruppeneinteilung fürs Putzen – ansehen und anpassen.
 *
 * Links die Gruppen mit ihren Einträgen, der zuständige zuoberst; rechts, wer
 * unter den aktiven Mitgliedern noch in keiner Gruppe steht. Ein Eintrag ist
 * ein Haushalt oder eine Person («Bader Roger & Sylvie») und mit den
 * Mitgliedern verknüpft, die dazugehören – so lässt sich ablesen, wer fehlt,
 * und der Name stimmt auch nach einer Heirat noch mit dem Verzeichnis
 * überein, wenn man ihn neu bilden lässt («Aus den Mitgliedern»).
 *
 * Jede Person steht höchstens einmal in der Einteilung: Wer einem Eintrag
 * zugeordnet wird, verschwindet aus einem früheren. Gespeichert wird je
 * Handgriff, wie in den übrigen Einstellungen – und jeder Handgriff baut auf
 * dem vorigen auf, auch bevor der zurückgemeldet ist (`pending`).
 *
 * Nur mit Vollzugriff; die Zugriffsregeln lassen ohnehin niemand anderen
 * schreiben.
 */
export function CleaningGroupsDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const { members } = useData()
  const { data: stored } = useCleaningGroups()

  /*
   * Was dieser Dialog geschrieben hat und der Listener noch nicht
   * zurückgemeldet hat – je Gruppe die Einträge. Jeder Handgriff schreibt
   * eine ganze Gruppe; zwei kurz hintereinander, etwa zwei Mitglieder in
   * dieselbe Gruppe, rechneten sonst beide mit dem Stand von vorher, und der
   * zweite überschriebe den ersten. Kommt eine Gruppe so zurück, wie sie
   * geschrieben wurde, fällt ihre Vormerkung weg – gleich beim Zeichnen,
   * ohne Umweg über einen Effekt.
   */
  const [pending, setPending] = useState<ReadonlyMap<number, CleaningGroupEntry[]>>(() => new Map())
  const [seen, setSeen] = useState(stored)
  if (seen !== stored) {
    setSeen(stored)
    setPending((current) => withoutConfirmed(current, stored))
  }
  const groups = useMemo(() => withPendingGroups(stored, pending), [stored, pending])

  /** Die Vormerkung zurücknehmen – nur, wenn seither nichts Neueres darübergeschrieben wurde. */
  const forget = (written: ReadonlyMap<number, CleaningGroupEntry[]>) =>
    setPending((current) => {
      const next = new Map(current)
      for (const [number, entries] of written) {
        if (next.get(number) === entries) next.delete(number)
      }
      return next
    })

  const [editing, setEditing] = useState<Editing>(null)
  const [withMinors, setWithMinors] = useState(false)
  const [search, setSearch] = useState('')
  const [removing, setRemoving] = useState<{ group: number; entry: CleaningGroupEntry } | null>(
    null,
  )

  const today = useMemo(() => new Date(), [])
  const active = useMemo(
    () =>
      members
        .filter((member) => member.status === 'active')
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName, 'de-CH') ||
            a.firstName.localeCompare(b.firstName, 'de-CH'),
        ),
    [members],
  )
  const unassigned = useMemo(
    () => unassignedMembers(members, groups, today, withMinors),
    [members, groups, today, withMinors],
  )
  const shown = unassigned.filter((member) =>
    matchesSearch(`${member.lastName} ${member.firstName}`, search),
  )
  const ordered = sortedGroups(groups)
  const entryCount = groups.reduce((sum, group) => sum + group.entries.length, 0)
  const unlinked = groups.reduce(
    (sum, group) => sum + group.entries.filter((entry) => entry.memberIds.length === 0).length,
    0,
  )

  /**
   * Schreibt die geänderten Gruppen – unveränderte bleiben unberührt. Vorgemerkt
   * wird, bevor geschrieben wird: Der nächste Handgriff sieht den neuen Stand
   * schon, auch wenn dieser noch unterwegs ist.
   */
  const write = async (next: Map<number, CleaningGroupEntry[]>, message: string) => {
    const changed = new Map(
      [...next.entries()]
        .map(([number, entries]) => [number, normalizedEntries(entries)] as const)
        .filter(([number, entries]) => {
          const before = groups.find((group) => group.number === number)?.entries
          return !before || entriesKey(before) !== entriesKey(entries)
        }),
    )
    if (changed.size > 0) setPending((current) => new Map([...current, ...changed]))
    try {
      let outcome: Awaited<ReturnType<typeof saveCleaningGroup>> = 'synced'
      for (const [number, entries] of changed) outcome = await saveCleaningGroup(number, entries)
      toast.saved(message, outcome)
    } catch (error) {
      // Nicht angekommen: zurück auf den Stand, den der Listener meldet.
      forget(changed)
      console.error(error)
      toast.error('Die Gruppeneinteilung konnte nicht gespeichert werden.')
    }
  }

  /** Die Einteilung als veränderbare Kopie – je Gruppe ihre Einträge. */
  const draft = () =>
    new Map(
      groups.map((group) => [
        group.number,
        group.entries.map((entry) => ({ ...entry, memberIds: [...entry.memberIds] })),
      ]),
    )

  /**
   * Einen Eintrag speichern – an seinem Platz, in einer anderen Gruppe oder
   * neu. Wer ihm zugeordnet ist, verschwindet aus jedem anderen Eintrag.
   */
  const saveEntry = (from: number, entry: CleaningGroupEntry, to: number) => {
    const next = draft()
    for (const entries of next.values()) {
      for (const other of entries) {
        if (other.id !== entry.id) {
          other.memberIds = other.memberIds.filter((id) => !entry.memberIds.includes(id))
        }
      }
    }
    const source = next.get(from) ?? []
    const at = source.findIndex((item) => item.id === entry.id)
    if (to === from && at >= 0) {
      source[at] = entry
    } else {
      if (at >= 0) source.splice(at, 1)
      next.set(from, source)
      next.set(to, [...(next.get(to) ?? []), entry])
    }
    setEditing(null)
    void write(
      next,
      to === from ? `«${entry.label}» gespeichert.` : `«${entry.label}» ist jetzt in Gruppe ${to}.`,
    )
  }

  const makeResponsible = (number: number, entry: CleaningGroupEntry) => {
    const next = draft()
    const entries = (next.get(number) ?? []).filter((item) => item.id !== entry.id)
    next.set(number, [entry, ...entries])
    void write(next, `«${entry.label}» ist jetzt zuständig für Gruppe ${number}.`)
  }

  const removeEntry = (number: number, entry: CleaningGroupEntry) => {
    const next = draft()
    next.set(
      number,
      (next.get(number) ?? []).filter((item) => item.id !== entry.id),
    )
    setEditing(null)
    void write(next, `«${entry.label}» aus Gruppe ${number} entfernt.`)
  }

  /** Ein Mitglied ohne Gruppe als eigenen Eintrag einteilen. */
  const assign = (member: Member, number: number) => {
    const next = draft()
    next.set(number, [
      ...(next.get(number) ?? []),
      { id: uid(), label: entryLabelFromMembers([member]), memberIds: [member.id] },
    ])
    void write(next, `${memberName(member)} ist jetzt in Gruppe ${number}.`)
  }

  const addGroup = async () => {
    const number = Math.max(0, ...groups.map((group) => group.number)) + 1
    // Vorgemerkt wie jeder andere Handgriff – ein zweiter Klick legt die
    // nächste Gruppe an, nicht dieselbe noch einmal.
    const written = new Map([[number, [] as CleaningGroupEntry[]]])
    setPending((current) => new Map([...current, ...written]))
    try {
      toast.saved(`Gruppe ${number} angelegt.`, await saveCleaningGroup(number, []))
    } catch (error) {
      forget(written)
      console.error(error)
      toast.error('Die Gruppe konnte nicht angelegt werden.')
    }
  }

  const removeGroup = async (number: number) => {
    // Eine vorgemerkte Gruppe stünde sonst weiter da, auch wenn sie weg ist.
    setPending((current) => {
      if (!current.has(number)) return current
      const next = new Map(current)
      next.delete(number)
      return next
    })
    try {
      toast.saved(`Gruppe ${number} entfernt.`, await deleteCleaningGroup(number))
    } catch (error) {
      console.error(error)
      toast.error('Die Gruppe konnte nicht entfernt werden.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Gruppeneinteilung"
      description={`${groups.length} Gruppen · ${entryCount} Einträge${
        unlinked > 0 ? ` · ${unlinked} ohne verknüpftes Mitglied` : ''
      }`}
      size="page"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {ordered.length === 0 && (
            <p className="hint mt-0 mb-3">
              Noch keine Gruppen. Die Liste der Gemeinde lässt sich unter «Einstellungen › Importe ›
              Putzgruppen» einlesen – oder Gruppe für Gruppe hier anlegen.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {ordered.map((group) => (
              <GroupCard
                key={group.number}
                group={group}
                groups={ordered}
                active={active}
                editing={editing?.group === group.number ? editing.entryId : undefined}
                onEdit={(entryId) => setEditing({ group: group.number, entryId })}
                onCancel={() => setEditing(null)}
                onSave={(entry, to) => saveEntry(group.number, entry, to)}
                onResponsible={(entry) => makeResponsible(group.number, entry)}
                onRemove={(entry) => setRemoving({ group: group.number, entry })}
                onRemoveGroup={() => void removeGroup(group.number)}
              />
            ))}
          </div>
          <button type="button" className="btn-secondary mt-3" onClick={() => void addGroup()}>
            <Plus className="size-4" aria-hidden />
            Gruppe hinzufügen
          </button>
        </div>

        {/* Wer noch fehlt – die Liste, an der sich die Einteilung messen lässt. */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-200 p-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold">
                Nicht eingeteilt <span className="text-slate-400">({unassigned.length})</span>
              </h3>
              <p className="hint mt-0.5">
                Aktive Mitglieder ohne Gruppe{withMinors ? '' : ', ab 18 Jahren'}. Für Ehepaare beim
                Eintrag «Mitglied hinzufügen» wählen.
              </p>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  className="input pl-8"
                  placeholder="Suchen …"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="size-3.5 rounded"
                  checked={withMinors}
                  onChange={(event) => setWithMinors(event.target.checked)}
                />
                Auch Kinder und Jugendliche
              </label>
            </div>
            <ul className="divide-list max-h-[28rem] overflow-y-auto">
              {shown.length === 0 && (
                <li className="hint px-3 py-3">
                  {unassigned.length === 0 ? 'Alle sind eingeteilt.' : 'Niemand gefunden.'}
                </li>
              )}
              {shown.map((member) => (
                <li key={member.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{memberName(member)}</p>
                    {birthYear(member) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {birthYear(member)}
                      </p>
                    )}
                  </div>
                  <select
                    className="input w-auto py-1 text-xs"
                    value=""
                    aria-label={`${memberName(member)} einer Gruppe zuteilen`}
                    onChange={(event) => {
                      if (event.target.value) assign(member, Number(event.target.value))
                    }}
                    disabled={ordered.length === 0}
                  >
                    <option value="">Zu Gruppe …</option>
                    {ordered.map((group) => (
                      <option key={group.number} value={group.number}>
                        Gruppe {group.number}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {removing && (
        <ConfirmDialog
          open
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeEntry(removing.group, removing.entry)
            setRemoving(null)
          }}
          title="Eintrag entfernen?"
          message={`«${removing.entry.label}» wird aus Gruppe ${removing.group} entfernt. Die verknüpften Mitglieder stehen danach unter «Nicht eingeteilt».`}
          confirmLabel="Entfernen"
          danger
        />
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function GroupCard({
  group,
  groups,
  active,
  editing,
  onEdit,
  onCancel,
  onSave,
  onResponsible,
  onRemove,
  onRemoveGroup,
}: {
  group: CleaningGroup
  groups: CleaningGroup[]
  active: Member[]
  /** Die ID des Eintrags in Bearbeitung, `null` für einen neuen – sonst nichts */
  editing: string | null | undefined
  onEdit: (entryId: string | null) => void
  onCancel: () => void
  onSave: (entry: CleaningGroupEntry, to: number) => void
  onResponsible: (entry: CleaningGroupEntry) => void
  onRemove: (entry: CleaningGroupEntry) => void
  onRemoveGroup: () => void
}) {
  const { membersById } = useData()
  // Ein neuer Eintrag behält seine Kennung, solange er bearbeitet wird.
  const newId = useMemo(() => (editing === null ? uid() : ''), [editing])

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
        <h3 className="flex-1 text-sm font-semibold">Gruppe {group.number}</h3>
        {group.entries.length === 0 && (
          <button
            type="button"
            className="btn-ghost p-1 text-rose-600 dark:text-rose-400"
            onClick={onRemoveGroup}
            title="Leere Gruppe entfernen"
            aria-label={`Gruppe ${group.number} entfernen`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </header>

      <ul className="divide-list">
        {group.entries.map((entry, position) =>
          editing === entry.id ? (
            <li key={entry.id} className="p-3">
              <EntryEditor
                entry={entry}
                group={group}
                groups={groups}
                active={active}
                responsible={position === 0}
                onCancel={onCancel}
                onSave={onSave}
                onResponsible={() => onResponsible(entry)}
                onRemove={() => onRemove(entry)}
              />
            </li>
          ) : (
            <li key={entry.id} className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {entry.label || <span className="text-slate-400 italic">Ohne Bezeichnung</span>}
                  {position === 0 && (
                    <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                      Zuständig
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                  {entry.memberIds.length === 0 ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      Kein Mitglied verknüpft
                    </span>
                  ) : (
                    entry.memberIds.map((id) => {
                      const member = membersById.get(id)
                      return (
                        <span
                          key={id}
                          className={cn(
                            'inline-flex items-center gap-0.5',
                            member && member.status === 'active'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400',
                          )}
                        >
                          <Check className="size-3" aria-hidden />
                          {member
                            ? `${memberName(member)}${member.status === 'active' ? '' : ' (inaktiv)'}`
                            : 'nicht mehr im Verzeichnis'}
                        </span>
                      )
                    })
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => onEdit(entry.id)}
                aria-label={`«${entry.label}» bearbeiten`}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            </li>
          ),
        )}
        {editing === null && (
          <li className="p-3">
            <EntryEditor
              entry={{ id: newId, label: '', memberIds: [] }}
              group={group}
              groups={groups}
              active={active}
              responsible={group.entries.length === 0}
              isNew
              onCancel={onCancel}
              onSave={onSave}
            />
          </li>
        )}
      </ul>

      {editing !== null && (
        <button
          type="button"
          className="btn-ghost w-full justify-center rounded-none border-t border-slate-200 py-2 text-sm dark:border-slate-800"
          onClick={() => onEdit(null)}
        >
          <Plus className="size-4" aria-hidden />
          Eintrag
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

function EntryEditor({
  entry,
  group,
  groups,
  active,
  responsible,
  isNew = false,
  onCancel,
  onSave,
  onResponsible,
  onRemove,
}: {
  entry: CleaningGroupEntry
  group: CleaningGroup
  groups: CleaningGroup[]
  active: Member[]
  responsible: boolean
  isNew?: boolean
  onCancel: () => void
  onSave: (entry: CleaningGroupEntry, to: number) => void
  onResponsible?: () => void
  onRemove?: () => void
}) {
  const { membersById } = useData()
  const [label, setLabel] = useState(entry.label)
  const [memberIds, setMemberIds] = useState(entry.memberIds)
  const [target, setTarget] = useState(group.number)
  const [query, setQuery] = useState('')

  const linked = memberIds
    .map((id) => membersById.get(id))
    .filter((member): member is Member => Boolean(member))
  const suggestions = query.trim()
    ? active
        .filter(
          (member) =>
            !memberIds.includes(member.id) &&
            matchesSearch(`${member.lastName} ${member.firstName}`, query),
        )
        .slice(0, 8)
    : []

  const add = (member: Member) => {
    const next = [...memberIds, member.id]
    setMemberIds(next)
    setQuery('')
    // Ein neuer Eintrag ohne Bezeichnung heisst wie seine Mitglieder.
    if (!label.trim()) {
      setLabel(
        entryLabelFromMembers(
          next.map((id) => membersById.get(id)).filter((item): item is Member => Boolean(item)),
        ),
      )
    }
  }

  const canSave = label.trim() !== '' || linked.length > 0

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`label-${entry.id}`}>
          Bezeichnung
        </label>
        <div className="flex gap-2">
          <input
            id={`label-${entry.id}`}
            className="input"
            value={label}
            placeholder="z. B. Muster Hans & Anna"
            onChange={(event) => setLabel(event.target.value)}
          />
          {linked.length > 0 && (
            <button
              type="button"
              className="btn-secondary shrink-0 px-2 text-xs"
              onClick={() => setLabel(entryLabelFromMembers(linked))}
              title="Die Bezeichnung aus den verknüpften Mitgliedern bilden"
            >
              Aus den Mitgliedern
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="label">Mitglieder</p>
        <div className="flex flex-wrap gap-1.5">
          {memberIds.length === 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Noch niemand verknüpft.
            </span>
          )}
          {memberIds.map((id) => {
            const member = membersById.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-1 pl-2.5 text-xs dark:bg-slate-800"
              >
                {member ? memberName(member) : 'Unbekannt'}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                  onClick={() => setMemberIds(memberIds.filter((item) => item !== id))}
                  aria-label={`${member ? memberName(member) : 'Mitglied'} entfernen`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            )
          })}
        </div>
        <div className="relative mt-2">
          <UserPlus
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input pl-8"
            placeholder="Mitglied hinzufügen …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Mitglied hinzufügen"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {suggestions.map((member) => {
                const place = groupOfMember(groups, member.id)
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => add(member)}
                    >
                      <span>{memberName(member)}</span>
                      {place && (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          in Gruppe {place.group.number}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {!isNew && (
        <div>
          <label className="label" htmlFor={`group-${entry.id}`}>
            Gruppe
          </label>
          <select
            id={`group-${entry.id}`}
            className="input"
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
          >
            {groups.map((item) => (
              <option key={item.number} value={item.number}>
                Gruppe {item.number}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!isNew && !responsible && onResponsible && (
          <button type="button" className="btn-secondary btn-sm" onClick={onResponsible}>
            <ArrowUp className="size-3.5" aria-hidden />
            Zuständig machen
          </button>
        )}
        {!isNew && onRemove && (
          <button
            type="button"
            className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Entfernen
          </button>
        )}
        <div className="flex-1" />
        <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!canSave}
          onClick={() =>
            onSave(
              {
                id: entry.id,
                label: label.trim() || entryLabelFromMembers(linked),
                memberIds,
              },
              target,
            )
          }
        >
          Speichern
        </button>
      </div>
    </div>
  )
}

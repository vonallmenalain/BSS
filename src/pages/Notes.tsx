import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useNotes } from '@/hooks/useFirestore'
import { useAutosave, saveStateLabel } from '@/hooks/useAutosave'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { formatDateTime, toDate } from '@/lib/dates'
import { splitLinks } from '@/lib/links'
import { cn, matchesSearch } from '@/lib/utils'
import { createNote, deleteNote, saveNoteOrder, updateNote } from '@/services/notes'
import type { Note } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Ansicht                                                             */
/* ------------------------------------------------------------------ */

type Ansicht = 'liste' | 'kacheln'

/**
 * Wie viel eine Notiz in der Übersicht von sich zeigt.
 *
 * `klein` gibt jeder Notiz dieselbe feste Höhe – die Übersicht bleibt ein
 * Verzeichnis, durch das man blättert, nicht der Text selbst. `alles`
 * schneidet nichts ab; wer seine Notizen lesen und nicht suchen will, sieht
 * sie ganz.
 *
 * `komprimiert` liegt dazwischen: Wer mehr geschrieben hat, bekommt mehr Platz
 * – aber nur bis zu einer Grenze. Ohne die verdrängt eine einzige lange Notiz
 * alle anderen vom Bildschirm, und genau das soll eine Übersicht nicht.
 */
type Groesse = 'klein' | 'komprimiert' | 'alles'

const GROESSE_REGELN: Record<
  Groesse,
  {
    /** Feste Höhe (klein) oder Obergrenze (komprimiert) je Ansicht. */
    hoehe: Record<Ansicht, string>
    /**
     * Wie viele Zeilen Text stehen bleiben. `line-clamp` bringt seine eigene
     * Anzeigeart mit – daneben darf kein `block` stehen, sonst gewinnt je nach
     * Reihenfolge das eine oder das andere und der Text bricht mitten in der
     * Zeile ab statt sauber mit «…».
     */
    textZeilen: string
  }
> = {
  klein: { hoehe: { liste: 'h-24', kacheln: 'h-28' }, textZeilen: 'line-clamp-2' },
  komprimiert: { hoehe: { liste: 'max-h-60', kacheln: 'max-h-72' }, textZeilen: 'line-clamp-6' },
  alles: { hoehe: { liste: '', kacheln: '' }, textZeilen: 'block' },
}

/**
 * Wonach die Übersicht ordnet.
 *
 * `zuletzt` ist der Normalfall und braucht keine Pflege: Woran gerade
 * gearbeitet wird, steht zuoberst. `eigene` gibt die Reihenfolge in die Hand –
 * für Notizen, die als Liste gelesen werden und deren Abfolge etwas bedeutet.
 */
type Sortierung = 'zuletzt' | 'eigene'

/**
 * Wie breit eine geöffnete Notiz werden darf.
 *
 * Nur am grossen Bildschirm eine Frage: Auf dem Handy ist die volle Breite die
 * einzig sinnvolle Antwort, und die gibt es ohnehin. Am Monitor ist die
 * schmale Spalte gut für einen Merkzettel und zu eng für eine lange Liste.
 */
type Breite = 'md' | 'lg' | 'xl'

/* ------------------------------------------------------------------ */
/* Übersicht                                                           */
/* ------------------------------------------------------------------ */

/**
 * Notizen der Bischofschaft.
 *
 * Alles, was nicht an einer Sitzung, einem Mitglied oder einem Sonntag hängt:
 * Gedanken zum Gemeindeprogramm, Notizen aus einem Telefonat, eine Liste zum
 * Mitdenken. Jede Notiz gehört allen – geteilt wird nichts, weil nichts privat
 * ist.
 *
 * Gespeichert wird laufend; einen Speichern-Knopf gibt es nicht.
 */
export function Notes() {
  const { data: notes, loading } = useNotes()
  const { userName } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [ansicht, setAnsicht] = useLocalStorage<Ansicht>('bss:notizen:ansicht', 'liste')
  const [groesse, setGroesse] = useLocalStorage<Groesse>('bss:notizen:groesse', 'komprimiert')
  const [sortierung, setSortierung] = useLocalStorage<Sortierung>(
    'bss:notizen:sortierung',
    'zuletzt',
  )
  const [showView, setShowView] = useState(false)
  /** Die offene Notiz – oder `neu` für eine, die es noch nicht gibt. */
  const [open, setOpen] = useState<Note | 'neu' | null>(null)

  const visible = useMemo(() => {
    const gefunden = search.trim()
      ? notes.filter((note) => matchesSearch(`${note.title} ${note.body}`, search))
      : notes

    /*
     * Zuletzt bearbeitete zuoberst. Eine eben angelegte Notiz wartet noch auf
     * den Zeitstempel des Servers; sie gilt hier als die jüngste und bleibt
     * damit oben, statt für einen Moment ans Ende zu rutschen.
     */
    const zeit = (note: Note) => toDate(note.updatedAt)?.getTime() ?? Number.POSITIVE_INFINITY
    if (sortierung === 'zuletzt') return [...gefunden].sort((a, b) => zeit(b) - zeit(a))

    /*
     * Eigene Reihenfolge. Eine Notiz ohne Position wurde noch nie einsortiert –
     * sie steht zuoberst, dort, wo sie auch nach «zuletzt bearbeitet» stünde.
     * So beginnt die Ansicht mit genau der Liste, die man vorher gesehen hat,
     * und eine neue Notiz verschwindet nicht am Ende.
     */
    const platz = (note: Note) => (typeof note.order === 'number' ? note.order : null)
    return [...gefunden].sort((a, b) => {
      const links = platz(a)
      const rechts = platz(b)
      if (links === null && rechts === null) return zeit(b) - zeit(a)
      if (links === null) return -1
      if (rechts === null) return 1
      return links - rechts || zeit(b) - zeit(a)
    })
  }, [notes, search, sortierung])

  /*
   * Verschoben wird immer die ganze Liste – die neue Reihenfolge steht danach
   * bei jeder Notiz. Beim Suchen ist die Liste unvollständig; die Knöpfe fehlen
   * dann, sonst schriebe eine Verschiebung Positionen für einen Ausschnitt.
   */
  const sortierbar = sortierung === 'eigene' && !search.trim()

  const move = async (id: string, delta: number) => {
    const index = visible.findIndex((note) => note.id === id)
    const ziel = index + delta
    if (index < 0 || ziel < 0 || ziel >= visible.length) return

    const next = [...visible]
    const [note] = next.splice(index, 1)
    next.splice(ziel, 0, note)
    try {
      await saveNoteOrder(next)
    } catch (error) {
      console.error(error)
      toast.error('Reihenfolge konnte nicht gespeichert werden.')
    }
  }

  return (
    <>
      <PageHeader
        title="Notizen"
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen('neu')}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Neu</span>
          </button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="Titel und Text durchsuchen …"
            aria-label="Notizen durchsuchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowView((value) => !value)}
            aria-expanded={showView}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Ansicht
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {notes.length === 1 ? '1 Notiz' : `${notes.length} Notizen`}
          </span>
        </div>

        {showView && (
          <div className="card animate-slide-up flex flex-wrap items-end gap-4 p-3">
            <div>
              <span className="label">Darstellung</span>
              <SegmentedControl<Ansicht>
                value={ansicht}
                onChange={setAnsicht}
                size="sm"
                options={[
                  { value: 'liste', label: 'Liste' },
                  { value: 'kacheln', label: 'Kacheln' },
                ]}
              />
            </div>
            <div>
              <span className="label">Anzeigegrösse</span>
              <SegmentedControl<Groesse>
                value={groesse}
                onChange={setGroesse}
                size="sm"
                options={[
                  { value: 'klein', label: 'Klein' },
                  { value: 'komprimiert', label: 'Komprimiert' },
                  { value: 'alles', label: 'Alles' },
                ]}
              />
            </div>
            <div>
              <span className="label">Reihenfolge</span>
              <SegmentedControl<Sortierung>
                value={sortierung}
                onChange={setSortierung}
                size="sm"
                options={[
                  { value: 'zuletzt', label: 'Zuletzt bearbeitet' },
                  { value: 'eigene', label: 'Eigene' },
                ]}
              />
            </div>
            {sortierung === 'eigene' && (
              <p className="hint w-full">
                Mit den Pfeilen an jeder Notiz umsortieren. Die Reihenfolge gilt für alle.
              </p>
            )}
          </div>
        )}

        {sortierung === 'eigene' && search.trim() && (
          <p className="hint">Zum Umsortieren die Suche leeren – sie zeigt nur einen Ausschnitt.</p>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={search ? 'Nichts gefunden' : 'Noch keine Notizen'}
          description={
            search
              ? 'Kein Titel und kein Text passt zur Suche.'
              : 'Halte hier fest, was sonst auf einem Zettel landet.'
          }
          action={
            !search && (
              <button type="button" className="btn-primary" onClick={() => setOpen('neu')}>
                <Plus className="size-4" aria-hidden />
                Erste Notiz
              </button>
            )
          }
        />
      ) : (
        <ul
          className={cn(
            ansicht === 'kacheln'
              ? // items-start: Jede Kachel ist so hoch wie ihr Inhalt. Ohne das
                // zöge die längste Notiz ihre ganze Zeile mit in die Höhe.
                'grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'
              : 'space-y-2',
          )}
        >
          {visible.map((note, index) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                ansicht={ansicht}
                groesse={groesse}
                author={note.updatedById ? userName(note.updatedById) : ''}
                onOpen={() => setOpen(note)}
                onMove={sortierbar ? (delta) => void move(note.id, delta) : undefined}
                first={index === 0}
                last={index === visible.length - 1}
              />
            </li>
          ))}
        </ul>
      )}

      {open && <NoteEditor note={open === 'neu' ? null : open} onClose={() => setOpen(null)} />}
    </>
  )
}

/**
 * Eine Notiz in der Übersicht.
 *
 * Titel links, rechts daneben, wann und von wem zuletzt geschrieben wurde. Wie
 * viel darunter steht, entscheidet die gewählte Grösse – der Aufbau bleibt in
 * Liste und Kacheln derselbe, damit man nicht zweimal lesen lernen muss.
 */
function NoteCard({
  note,
  ansicht,
  groesse,
  author,
  onOpen,
  onMove,
  first,
  last,
}: {
  note: Note
  ansicht: Ansicht
  groesse: Groesse
  author: string
  onOpen: () => void
  /** Nur gesetzt, solange von Hand sortiert wird. */
  onMove?: (delta: number) => void
  first: boolean
  last: boolean
}) {
  const regel = GROESSE_REGELN[groesse]
  const name = note.title || 'ohne Titel'

  return (
    // Die Fläche zum Öffnen liegt als Knopf unter dem Inhalt: So bleibt die
    // ganze Karte ein Griff, und ein Verweis im Text behält trotzdem sein
    // eigenes Ziel. Ein <a> in einem <button> wäre nicht erlaubt.
    <div
      className={cn(
        'card card-hover relative flex w-full flex-col overflow-hidden p-4 text-left',
        regel.hoehe[ansicht],
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Notiz ${name} öffnen`}
        className="absolute inset-0"
      />

      {/* Der Inhalt lässt Griffe zum Knopf durch – nur Verweise und die
          Pfeile zum Umsortieren fangen sie ab. */}
      <span className="pointer-events-none relative flex w-full items-start gap-2">
        <span className="min-w-0 flex-1 font-medium">
          {note.title || <span className="text-slate-400">Ohne Titel</span>}
        </span>
        <span
          className={cn(
            'tabular shrink-0 text-right text-[11px] leading-tight text-slate-400',
            // In der Liste ist Platz für eine Zeile; in einer Kachel bricht die
            // Angabe um, statt den Titel wegzudrücken.
            ansicht === 'liste' ? 'whitespace-nowrap' : 'max-w-28',
          )}
        >
          {formatDateTime(note.updatedAt)}
          {author && <span className="block">{author}</span>}
        </span>

        {onMove && (
          <span className="pointer-events-auto relative z-10 -my-1 flex shrink-0 flex-col">
            <button
              type="button"
              className="btn-ghost p-1"
              onClick={() => onMove(-1)}
              disabled={first}
              aria-label={`${name} nach oben`}
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-ghost p-1"
              onClick={() => onMove(1)}
              disabled={last}
              aria-label={`${name} nach unten`}
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </span>
        )}
      </span>

      {note.body && (
        <span
          className={cn(
            'pointer-events-none relative mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300',
            regel.textZeilen,
          )}
        >
          <LinkedText text={note.body} />
        </span>
      )}
    </div>
  )
}

/**
 * Text, in dem Verweise anklickbar sind.
 *
 * `pointer-events-auto` und `z-10`, weil in der Übersicht die ganze Karte eine
 * Fläche zum Öffnen ist: Der Text lässt Griffe durch, der Verweis fängt seinen
 * eigenen ab. `stopPropagation` hält ausserdem die darunterliegende Fläche
 * davon ab, gleich noch die Notiz zu öffnen.
 */
function LinkedText({ text }: { text: string }): ReactNode {
  return splitLinks(text).map((teil, index) =>
    teil.href ? (
      <a
        key={index}
        href={teil.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="text-brand-700 dark:text-brand-300 pointer-events-auto relative z-10 break-words underline underline-offset-2"
      >
        {teil.text}
      </a>
    ) : (
      <span key={index}>{teil.text}</span>
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Fenster                                                             */
/* ------------------------------------------------------------------ */

/**
 * Der Notizeditor – ein Fenster über der Liste, kein eigener Bildschirm.
 *
 * Gespeichert wird von selbst: kurz nach dem letzten Tastendruck und noch
 * einmal beim Schliessen. Ein Speichern-Knopf hätte hier nichts gewonnen – er
 * wäre die einzige Möglichkeit, Geschriebenes zu verlieren.
 *
 * Eine neue Notiz entsteht erst beim ersten Speichern. Wer das Fenster ohne
 * Eingabe wieder schliesst, hinterlässt keine leere Notiz in der Liste.
 */
function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const { profile } = useAuth()
  const toast = useToast()

  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  /*
   * Ob gleich geschrieben wird, entscheidet sich beim Öffnen – nicht mitten im
   * Tippen. Aus dem laufenden Text abgeleitet, kippte der Wert mit dem ersten
   * Zeichen und schob den Cursor ans Ende.
   */
  const [startInEditing] = useState(() => !note || (note.body ?? '') === '')
  /** Sobald eine neue Notiz einmal gespeichert ist, lässt sie sich löschen. */
  const [savedId, setSavedId] = useState<string | null>(note?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Die Breite gehört zum Gerät, nicht zur Notiz: dieselbe Notiz will am
  // Monitor breit und am Handy schmal gelesen werden.
  const [breite, setBreite] = useLocalStorage<Breite>('bss:notizen:breite', 'lg')

  // Ab dem ersten Speichern wird dieselbe Notiz weitergeschrieben, statt eine
  // zweite anzulegen.
  const idRef = useRef<string | null>(note?.id ?? null)

  const leer = title.trim() === '' && body.trim() === ''

  const autosave = useAutosave(
    { title, body },
    async (entwurf) => {
      if (idRef.current) {
        await updateNote(idRef.current, entwurf, profile?.id ?? null)
        return
      }
      const { id } = await createNote(entwurf, profile?.id ?? null)
      idRef.current = id
      setSavedId(id)
    },
    // Eine leere Notiz wird nicht angelegt, eine geleerte behält ihren
    // letzten Stand.
    { savable: (entwurf) => entwurf.title.trim() !== '' || entwurf.body.trim() !== '' },
  )

  const remove = async () => {
    if (!savedId) return
    // Verhindert, dass das Speichern beim Schliessen die eben gelöschte Notiz
    // wieder anlegt.
    autosave.stop()
    try {
      await deleteNote(savedId)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Notiz konnte nicht gelöscht werden.')
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={note ? 'Notiz' : 'Neue Notiz'}
        description={saveStateLabel(autosave.state, leer ? 'Titel oder Text ausfüllen' : undefined)}
        size={breite}
        footer={
          <>
            <div className="mr-auto hidden sm:block">
              <SegmentedControl<Breite>
                value={breite}
                onChange={setBreite}
                size="sm"
                options={[
                  { value: 'md', label: 'Schmal' },
                  { value: 'lg', label: 'Mittel' },
                  { value: 'xl', label: 'Breit' },
                ]}
              />
            </div>
            {savedId && (
              <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Löschen
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Schliessen
            </button>
          </>
        }
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titel"
          aria-label="Titel"
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />

        <NoteText value={body} onChange={setBody} startInEditing={startInEditing} />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title="Notiz löschen?"
        message="Die Notiz verschwindet für alle. Rückgängig machen lässt sich das nicht."
        confirmLabel="Löschen"
        danger
      />
    </>
  )
}

/**
 * Der Text einer Notiz – zum Lesen mit anklickbaren Verweisen, zum Schreiben
 * ein Textfeld.
 *
 * In einem Textfeld ist ein Verweis nur Text; anklickbar wird er erst, wenn er
 * als Verweis gezeichnet ist. Deshalb zeigt die geöffnete Notiz zunächst den
 * gelesenen Text, und ein Griff hinein macht daraus das Eingabefeld – ausser
 * auf einem Verweis, der führt dorthin, wohin er führt. Beim Verlassen des
 * Feldes steht wieder der lesbare Text da.
 *
 * Eine frische oder leere Notiz beginnt gleich im Schreibmodus: Dort gibt es
 * nichts zu lesen und nichts anzutippen.
 */
function NoteText({
  value,
  onChange,
  startInEditing,
}: {
  value: string
  onChange: (value: string) => void
  startInEditing: boolean
}) {
  const [schreibt, setSchreibt] = useState(startInEditing)

  if (schreibt) {
    return (
      <GrowingTextarea
        value={value}
        onChange={onChange}
        moveCursorToEnd={!startInEditing}
        onBlur={() => setSchreibt(false)}
      />
    )
  }

  return (
    <div
      onClick={() => setSchreibt(true)}
      className="mt-3 min-h-40 w-full cursor-text break-words whitespace-pre-wrap"
    >
      {value ? <LinkedText text={value} /> : <span className="text-slate-400">Text …</span>}
    </div>
  )
}

/**
 * Das Textfeld wächst mit dem Text.
 *
 * Ein Feld mit fester Zeilenzahl scrollt in sich selbst, während das Fenster
 * darüber noch Platz hätte – man schriebe durch ein Guckloch. So wächst
 * stattdessen das Feld, und erst wenn das Fenster an den Bildschirmrand
 * stösst, bekommt der Inhalt eine Bildlaufleiste.
 */
function GrowingTextarea({
  value,
  onChange,
  moveCursorToEnd,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  moveCursorToEnd?: boolean
  onBlur?: () => void
}) {
  const field = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    // Erst zurücksetzen: Sonst misst scrollHeight die bisherige Höhe mit, und
    // das Feld wächst zwar, schrumpft beim Löschen aber nie wieder.
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  // Wer aus dem Lesen ins Schreiben wechselt, will weiterschreiben und nicht
  // vorne beginnen – der Cursor gehört ans Ende.
  useLayoutEffect(() => {
    if (!moveCursorToEnd) return
    const element = field.current
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [moveCursorToEnd])

  return (
    <textarea
      ref={field}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder="Text …"
      aria-label="Text"
      // Eine Mindesthöhe, damit auch die leere Notiz eine Fläche hat, die man
      // mit dem Daumen trifft.
      className="mt-3 min-h-40 w-full resize-none overflow-hidden bg-transparent outline-none"
    />
  )
}

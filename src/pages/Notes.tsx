import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, NotebookPen, Pencil, Plus, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useNotes } from '@/hooks/useFirestore'
import { useAutosave, saveStateLabel } from '@/hooks/useAutosave'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { AddButton, MenuChoice, ViewMenu } from '@/components/ui/ViewMenu'
import { RichText } from '@/components/ui/RichText'
import { RichTextField } from '@/components/ui/RichTextField'
import { formatDateTime, toDate } from '@/lib/dates'
import { richValueOf, trimRichValue, type RichValue } from '@/lib/richtext'
import { cn, matchesSearch } from '@/lib/utils'
import { createNote, deleteNote, saveNoteOrder, updateNote } from '@/services/notes'
import { lastEditedAt, type Note } from '@/lib/types'

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
    const zeit = (note: Note) => toDate(lastEditedAt(note))?.getTime() ?? Number.POSITIVE_INFINITY
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
          <>
            <ViewMenu width="sm:w-72">
              <MenuChoice<Ansicht>
                label="Darstellung"
                value={ansicht}
                onChange={setAnsicht}
                options={[
                  { value: 'liste', label: 'Liste' },
                  { value: 'kacheln', label: 'Kacheln' },
                ]}
              />
              <MenuChoice<Groesse>
                label="Anzeigegrösse"
                value={groesse}
                onChange={setGroesse}
                options={[
                  { value: 'klein', label: 'Klein' },
                  { value: 'komprimiert', label: 'Komprimiert' },
                  { value: 'alles', label: 'Alles' },
                ]}
              />
              <MenuChoice<Sortierung>
                label="Reihenfolge"
                value={sortierung}
                onChange={setSortierung}
                options={[
                  { value: 'zuletzt', label: 'Zuletzt' },
                  { value: 'eigene', label: 'Eigene' },
                ]}
                hint={
                  sortierung === 'eigene'
                    ? 'Mit den Pfeilen an jeder Notiz umsortieren. Die Reihenfolge gilt für alle.'
                    : undefined
                }
              />
            </ViewMenu>
            <AddButton label="Notiz" onClick={() => setOpen('neu')} />
          </>
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

      {/* Die geöffnete Notiz kommt live aus der Sammlung, nicht aus dem
          Schnappschuss vom Anklicken – nur so kann der Editor erkennen, ob
          jemand anders sie inzwischen geändert hat. */}
      {open && (
        <NoteEditor
          note={open === 'neu' ? null : (notes.find((n) => n.id === open.id) ?? open)}
          onClose={() => setOpen(null)}
        />
      )}
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
          <RichText text={note.title} rich={note.titleRich} placeholder="Ohne Titel" />
        </span>
        <span
          className={cn(
            'tabular shrink-0 text-right text-[11px] leading-tight text-slate-400',
            // In der Liste ist Platz für eine Zeile; in einer Kachel bricht die
            // Angabe um, statt den Titel wegzudrücken.
            ansicht === 'liste' ? 'whitespace-nowrap' : 'max-w-28',
          )}
        >
          {formatDateTime(lastEditedAt(note))}
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
        // Die Karte lässt Griffe zum Öffnen-Knopf durch (`pointer-events-none`);
        // ein Verweis im Text fängt seinen eigenen ab – das regelt die
        // Verweis-Darstellung in `RichText` selbst.
        <div
          className={cn(
            'pointer-events-none relative mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300',
            regel.textZeilen,
          )}
        >
          <RichText text={note.body} rich={note.bodyRich} linkify />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenster                                                             */
/* ------------------------------------------------------------------ */

/**
 * Der Notizeditor – ein Fenster über der Liste, kein eigener Bildschirm.
 *
 * Eine bestehende Notiz öffnet sich zum **Lesen**: Der Text steht da, wie er
 * geschrieben wurde, Verweise sind anklickbar, und nichts verrutscht unter dem
 * Finger. Erst der Stift oben rechts macht daraus das Schreiben. Das ist der
 * häufigere Fall – Notizen werden öfter nachgeschlagen als geändert –, und ein
 * versehentlicher Griff in den Text kostet so nichts.
 *
 * Eine neue oder noch leere Notiz beginnt gleich im Schreibmodus: Dort gibt es
 * nichts zu lesen.
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

  // Text samt Formatierung daneben – siehe `lib/richtext`.
  const [title, setTitle] = useState<RichValue>(() => richValueOf(note?.title, note?.titleRich))
  const [body, setBody] = useState<RichValue>(() => richValueOf(note?.body, note?.bodyRich))
  /*
   * Ob gleich geschrieben wird, entscheidet sich beim Öffnen – nicht mitten im
   * Tippen. Aus dem laufenden Text abgeleitet, kippte der Wert mit dem ersten
   * Zeichen und schob den Cursor ans Ende.
   */
  const [startInEditing] = useState(
    () => !note || ((note.body ?? '') === '' && (note.title ?? '') === ''),
  )
  const [bearbeitet, setBearbeitet] = useState(startInEditing)
  /** Sobald eine neue Notiz einmal gespeichert ist, lässt sie sich löschen. */
  const [savedId, setSavedId] = useState<string | null>(note?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Die Breite gehört zum Gerät, nicht zur Notiz: dieselbe Notiz will am
  // Monitor breit und am Handy schmal gelesen werden.
  const [breite, setBreite] = useLocalStorage<Breite>('bss:notizen:breite', 'lg')

  // Ab dem ersten Speichern wird dieselbe Notiz weitergeschrieben, statt eine
  // zweite anzulegen.
  const idRef = useRef<string | null>(note?.id ?? null)

  /*
   * Konflikte nicht verschweigen: Der Stand, auf dem dieser Editor aufsetzt
   * (beim Öffnen die Notiz, danach das zuletzt Geschriebene), und daneben der
   * jeweils aktuelle Stand aus Firestore. Hat dort jemand anders geschrieben,
   * während hier getippt wurde, würde das Speichern dessen Fassung
   * kommentarlos überschreiben – stattdessen bleibt sie als eigene Notiz
   * «(Konfliktkopie)» erhalten, und ein Hinweis sagt das.
   */
  const baseline = useRef({
    title: note?.title ?? '',
    titleRich: note?.titleRich ?? null,
    body: note?.body ?? '',
    bodyRich: note?.bodyRich ?? null,
  })
  const live = useRef(note)
  useEffect(() => {
    live.current = note
  })

  const leer = title.text.trim() === '' && body.text.trim() === ''

  const autosave = useAutosave(
    { title, body },
    async (entwurf) => {
      // Beschnitten wird das Paar aus Text und Formatfeld gemeinsam – wie es
      // auch der Dienst speichert.
      const titel = trimRichValue(entwurf.title)
      const geschrieben = {
        title: titel.text,
        titleRich: titel.rich,
        body: entwurf.body.text,
        bodyRich: entwurf.body.rich,
      }

      if (idRef.current) {
        const fremd = live.current
        const fremdStand = fremd
          ? {
              title: fremd.title ?? '',
              titleRich: fremd.titleRich ?? null,
              body: fremd.body ?? '',
              bodyRich: fremd.bodyRich ?? null,
            }
          : null
        const konflikt =
          fremdStand !== null &&
          JSON.stringify(fremdStand) !== JSON.stringify(baseline.current) &&
          JSON.stringify(fremdStand) !== JSON.stringify(geschrieben)
        if (konflikt) {
          await createNote(
            {
              title: `${fremdStand.title || 'Ohne Titel'} (Konfliktkopie)`,
              // Der Zusatz macht den Titel zu einem anderen Text – die alte
              // Titelformatierung passte nicht mehr dazu.
              titleRich: null,
              body: fremdStand.body,
              bodyRich: fremdStand.bodyRich,
            },
            fremd?.updatedById ?? null,
          )
          toast.warning(
            'Diese Notiz wurde gleichzeitig von jemand anderem geändert. Die andere Fassung liegt jetzt als «Konfliktkopie» in der Liste.',
          )
        }
        await updateNote(idRef.current, geschrieben, profile?.id ?? null)
        baseline.current = geschrieben
        return
      }
      const { id } = await createNote(geschrieben, profile?.id ?? null)
      idRef.current = id
      setSavedId(id)
      baseline.current = geschrieben
    },
    // Eine leere Notiz wird nicht angelegt, eine geleerte behält ihren
    // letzten Stand.
    {
      savable: (entwurf) => entwurf.title.text.trim() !== '' || entwurf.body.text.trim() !== '',
    },
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
        description={
          bearbeitet
            ? saveStateLabel(autosave.state, leer ? 'Titel oder Text ausfüllen' : undefined)
            : 'Zum Bearbeiten auf den Stift'
        }
        size={breite}
        headerActions={
          !bearbeitet && (
            <button
              type="button"
              onClick={() => setBearbeitet(true)}
              className="-m-1.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Notiz bearbeiten"
              title="Bearbeiten"
            >
              <Pencil className="size-5" aria-hidden />
            </button>
          )
        }
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
            {savedId && bearbeitet && (
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
        {bearbeitet ? (
          <RichTextField
            id="note-title"
            value={title}
            onChange={setTitle}
            placeholder="Titel"
            aria-label="Titel"
            singleLine
            bare
            className="w-full text-lg font-semibold outline-none"
          />
        ) : (
          <h3 className="text-lg font-semibold">
            <RichText text={title.text} rich={title.rich} placeholder="Ohne Titel" />
          </h3>
        )}

        <NoteText
          value={body}
          onChange={setBody}
          bearbeitet={bearbeitet}
          // Wer eben erst auf den Stift gedrückt hat, will weiterschreiben und
          // nicht am Anfang beginnen.
          moveCursorToEnd={!startInEditing}
        />
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
 * das formatierbare Feld.
 *
 * In einem Textfeld ist ein Verweis nur Text; anklickbar wird er erst, wenn er
 * als Verweis gezeichnet ist. Deshalb steht im Ansichtsmodus der gelesene Text
 * – und erst der Stift im Kopf des Fensters macht daraus das Eingabefeld.
 *
 * Früher genügte ein Griff in den Text. Das war ein Griff zu wenig: Wer eine
 * Notiz bloss nachschlagen wollte, landete beim ersten Antippen im
 * Schreibmodus und verschob mit dem Daumen, was er lesen wollte.
 *
 * Das Feld wächst mit dem Text von selbst (es ist keine `textarea` mit fester
 * Zeilenzahl mehr); erst wenn das Fenster an den Bildschirmrand stösst,
 * bekommt der Inhalt eine Bildlaufleiste.
 */
function NoteText({
  value,
  onChange,
  bearbeitet,
  moveCursorToEnd,
}: {
  value: RichValue
  onChange: (value: RichValue) => void
  bearbeitet: boolean
  moveCursorToEnd?: boolean
}) {
  if (bearbeitet) {
    return (
      <RichTextField
        id="note-body"
        value={value}
        onChange={onChange}
        placeholder="Text …"
        aria-label="Text"
        bare
        // Wer aus dem Lesen ins Schreiben wechselt, will weiterschreiben und
        // nicht vorne beginnen – der Cursor gehört ans Ende.
        autoFocus={moveCursorToEnd}
        // Eine Mindesthöhe, damit auch die leere Notiz eine Fläche hat, die
        // man mit dem Daumen trifft.
        className="mt-3 min-h-40 w-full outline-none"
      />
    )
  }

  return (
    <div className="mt-3 min-h-40 w-full break-words whitespace-pre-wrap">
      <RichText text={value.text} rich={value.rich} linkify placeholder="Ohne Text" />
    </div>
  )
}

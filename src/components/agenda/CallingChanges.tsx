import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useCallingRowConcern } from '@/hooks/useOwnItem'
import { Avatar, UserAvatar } from '@/components/ui/Avatar'
import { MemberLink } from '@/components/ui/MemberLink'
import { MentionEditable, MentionText } from '@/components/ui/MentionText'
import { MemberPicker, PersonButton } from '@/components/ui/Pickers'
import {
  CALLING_TABLE_TITLES,
  callingRowText,
  isCallingMemberRowEmpty,
  isCallingOpenRowEmpty,
  moveCallingRow,
  newCallingMemberRow,
  newCallingOpenRow,
  type CallingRowMatch,
} from '@/lib/callingChanges'
import { cn, matchesSearch } from '@/lib/utils'
import {
  CALLING_URGENCY_LABELS,
  CALLING_URGENCY_ORDER,
  FULL_ACCESS_ROLES,
  type AppUser,
  type CallingChanges,
  type CallingMemberRow,
  type CallingOpenRow,
  type CallingRowBase,
  type CallingUrgency,
  type Member,
} from '@/lib/types'

/**
 * Die Berufungsrunde: zwei Tabellen untereinander.
 *
 * **Neue Berufungen** – wer eine neue Aufgabe bekommen soll: der Name, was
 * heute ist, was in Frage käme. **Offene Berufungen** – die Gegenrichtung:
 * welche Aufgabe niemanden hat, wer dafür in Frage käme, wie es weitergeht.
 *
 * Es ist eine Ideenliste. Nichts davon ändert eine Berufung oder einen
 * Mitgliederdatensatz – das tut allein das LCR und der Import von dort.
 *
 * Vier Dinge tragen die Ansicht:
 *
 *  - **Die Reihenfolge ist die der Zeilen.** Neue Zeilen kommen unten dazu,
 *    und so bleibt es, bis jemand sie umstellt: «Reihenfolge» oben rechts
 *    stellt Pfeile an jede Zeile und einen Griff zum Ziehen daneben. Die
 *    neue Anordnung steht im Eintrag selbst und gilt damit für alle, die ihn
 *    öffnen – ein eigenes Feld je Zeile braucht es dafür nicht.
 *
 *  - **Farbe, Zuständigkeit und Papierkorb stehen in einer vierten, schmalen
 *    Spalte** – hinter einem Knopf, der zugleich anschreibt, was gesetzt ist
 *    (Farbpunkt und die Kreise der Zuständigen). Beides gehört der Zeile:
 *    Rot, Orange, Grün sagen, wie dringend es ist – oben rechts blenden
 *    dieselben drei Kreise aus, was gerade nicht interessiert –, und wer
 *    eine Zeile trägt, hat den ganzen Eintrag unter «Pendenzen → Meine».
 *    Ausgeschrieben brauchte das je Zeile eine eigene Zeile; bei zwanzig
 *    Einträgen war das die halbe Ansicht für etwas, das man ein-, zweimal
 *    anfasst.
 *  - **Oben steht ein Suchfeld.** Wer «PV» tippt, sieht die Zeilen, in denen
 *    «PV» vorkommt – in welcher Spalte auch immer. Daneben steht «Nur meine»,
 *    sobald eine Zeile der Runde die angemeldete Person angeht; von
 *    «Pendenzen → Meine» aus öffnet die Runde bereits so.
 *  - **Ein Name je Zeile.** In der Spalte «Name» steht genau eine Person;
 *    geht es um zwei, sind es zwei Zeilen. Mehrere Namen in einer Zeile
 *    machten aus der Tabelle eine Liste von Listen, und dann sagt keine
 *    Spalte mehr, wovon sie handelt.
 *  - **Am Telefon steht alles untereinander.** Drei Spalten mit
 *    mehrzeiligem Text passen dort nicht nebeneinander; die
 *    Spaltenüberschriften erscheinen deshalb ab Tabletbreite, darunter
 *    trägt jedes Feld seine eigene.
 */
export function CallingChangesTables({
  value,
  onChange,
  onMention,
  memberRefs,
  readOnly = false,
  ownRowsOnly = false,
}: {
  value: CallingChanges
  /** Fehlt sie, sind die Tabellen nur zu lesen. */
  onChange?: (next: CallingChanges) => void
  /** Ein mit «@» eingesetztes Mitglied – der Aufrufer merkt es sich */
  onMention?: (member: Member) => void
  /** Verweise des Eintrags, damit Namen im Text anklickbar bleiben */
  memberRefs?: string[]
  readOnly?: boolean
  /**
   * Mit «Nur meine» öffnen – so, wie die Runde unter «Pendenzen → Meine»
   * aufgeht. Es ist der Anfangszustand und keine Vorschrift: Der Knopf oben
   * schaltet die übrigen Zeilen jederzeit wieder dazu.
   */
  ownRowsOnly?: boolean
}) {
  const editable = Boolean(onChange) && !readOnly
  const { membersById, userName } = useData()

  /** Namen zu einer ID – Mitglied oder Konto, für die Suche in der Zeile. */
  const nameOf = (id: string) => {
    const member = membersById.get(id)
    if (member) return `${member.firstName} ${member.lastName}`
    const user = userName(id)
    return user === 'Unbekannt' ? '' : user
  }

  /*
   * Welche Farben gerade zu sehen sind.
   *
   * Eine Frage des Bildschirms, vor dem man sitzt, und keine der Daten:
   * Wer die grünen Zeilen wegklickt, um die dringenden durchzugehen, hat
   * damit nichts geändert. Deshalb steht die Wahl hier und nicht in
   * Firestore – und sie beginnt jedes Mal bei «alle».
   */
  const [shown, setShown] = useState<CallingUrgency[]>(CALLING_URGENCY_ORDER)

  /*
   * Die Suche in der Runde.
   *
   * Eine Runde zählt zwanzig Zeilen, und die Frage am Tisch heisst oft «was
   * haben wir zur PV?». Gesucht wird deshalb in der ganzen Zeile – Name,
   * Berufung, Vorschläge, Zuständige – und übrig bleibt, was passt. Wie der
   * Farbfilter gehört auch das dem Bildschirm und nicht den Daten: Es ändert
   * nichts und beginnt bei jedem Öffnen wieder leer.
   */
  const [search, setSearch] = useState('')

  /*
   * «Nur meine» – die Zeilen, die mich angehen.
   *
   * Eine Runde wird zeilenweise verteilt: zwanzig Namen, und jeder in der
   * Bischofschaft nimmt ein paar davon mit. Wer sie unter «Pendenzen → Meine»
   * öffnet, sucht genau diese paar und nicht die ganze Runde – deshalb kommt
   * die Ansicht von dort aus bereits eingeschaltet herein (`ownRowsOnly`).
   *
   * Es bleibt trotzdem ein Filter wie die beiden anderen: Er gehört dem
   * Bildschirm und nicht den Daten, ändert nichts und lässt sich mit einem
   * Griff wieder aufmachen – auf die ganze Runde zu schauen, ist am
   * Sitzungstisch der Normalfall.
   *
   * Gefragt ist dabei, **wessen** Zeile es ist, und nicht, ob sie noch
   * aussteht: Eine abgehakte Zeile bleibt meine. Sonst fiele sie in dem
   * Augenblick, in dem ich sie erledige, aus «Nur meine» heraus – und käme
   * auch mit «Erledigte anzeigen» nicht zurück, obwohl sie mir zugewiesen
   * ist. Was erledigt dasteht, sagt der Schalter ganz unten und sonst
   * niemand.
   */
  const [mineOnly, setMineOnly] = useState(ownRowsOnly)
  const ownRow = useCallingRowConcern()

  /*
   * Wie viele Zeilen mich überhaupt angehen.
   *
   * Ohne eine einzige steht der Knopf nicht da und der Filter greift nicht:
   * Eine Runde kann auch deshalb unter «Meine» stehen, weil der **Eintrag**
   * mir zugewiesen ist – dann sind alle Zeilen meine Sache, und eine leere
   * Tabelle wäre die falsche Auskunft.
   *
   * Die erledigten zählen mit: Wer seine letzte Zeile abhakt, soll nicht
   * plötzlich vor der ganzen Runde stehen, weil der Knopf unter ihm
   * verschwunden ist.
   */
  const ownRows = value.members.filter(ownRow).length + value.open.filter(ownRow).length

  /*
   * «Reihenfolge anpassen» – die Griffe und die Pfeile.
   *
   * Sie sind zu Beginn ausgeschaltet: Die Runde wird gelesen und
   * ausgefüllt, umgestellt wird sie selten – und wo an jeder Zeile zwei
   * Pfeile stehen, greift man beim Schreiben daneben. Ausgeschaltet
   * verschwinden bloss die Griffe; die gelegte Reihenfolge bleibt, sie ist
   * die Reihenfolge der Zeilen selbst.
   *
   * Ein Zustand des Bildschirms und keiner der Daten: Er sagt, was man
   * **gerade** tut.
   */
  const [ordering, setOrdering] = useState(false)
  const reordering = editable && ordering

  /*
   * Die erledigten Zeilen – weggeräumt, aber nicht weg.
   *
   * Eine Runde wird zeilenweise abgearbeitet: Die eine Berufung steht,
   * während die nächste noch offen ist. Wer eine Zeile abhakt, will sie nicht
   * mehr vor sich haben – die Tabelle soll zeigen, was noch aussteht. Ganz
   * unten holt sie ein Knopf zurück; gelöscht wird dabei nichts, und was
   * einmal besprochen wurde, steht weiterhin im Protokoll.
   */
  const [showDone, setShowDone] = useState(false)
  const doneRows =
    value.members.filter((row) => row.done).length + value.open.filter((row) => row.done).length

  /*
   * Umgestellt wird an der **ganzen** Tabelle: Ein Ausschnitt sagt nichts
   * darüber, wo das Ausgeblendete steht. Solange umsortiert wird, gelten
   * Farbfilter und Suche deshalb nicht – und stehen auch nicht da.
   */
  const filtering = !reordering && shown.length < CALLING_URGENCY_ORDER.length
  const query = reordering ? '' : search.trim()
  const mine = mineOnly && ownRows > 0 && !reordering

  /*
   * Alle drei Farben an heisst: kein Filter – dann stehen auch die Zeilen da,
   * die noch keine Farbe haben. Sobald eine Farbe weggeklickt ist, gilt die
   * Auswahl streng: Zu sehen ist genau, was gewählt wurde. Suche und «Nur
   * meine» kommen als weitere Bedingungen dazu; was dabei wegfällt, steht als
   * Zahl unter der Tabelle – still verschwinden soll nichts.
   */
  const visible = (row: CallingMemberRow | CallingOpenRow) => {
    // Das Erledigte steht für sich: Es zählt nicht als «ausgeblendet», weil
    // es einen eigenen Knopf hat, der es zurückholt.
    if (row.done && !showDone) return false
    if (mine && !ownRow(row)) return false
    if (filtering && (row.urgency === undefined || !shown.includes(row.urgency))) return false
    if (!query) return true
    return matchesSearch(callingRowText(row, nameOf), query)
  }

  /**
   * Zeilen, die zur **Suche** passen, aber ein anderer Filter wegnimmt.
   *
   * Eine Suche endet nicht am Rand des Ausschnitts: Wer in einer Runde nach
   * «Sonnenstrahlen» sucht und dabei die Farbe «später» weggeklickt hat, soll
   * die Zeile trotzdem finden – sie steht dann unter der Tabelle, getrennt
   * und benannt, statt stillschweigend zu fehlen.
   *
   * Das Erledigte bleibt aussen vor: Es hat seinen eigenen Knopf, der es
   * zurückholt, und zählt hier so wenig als ausgeblendet wie oben.
   */
  const otherHit = (row: CallingMemberRow | CallingOpenRow) => {
    if (!query || row.done) return false
    if (visible(row)) return false
    return matchesSearch(callingRowText(row, nameOf), query)
  }

  /** Wie viele Zeilen Farbfilter, Suche und «Nur meine» wegnehmen. */
  const hiddenIn = (rows: (CallingMemberRow | CallingOpenRow)[]) =>
    rows.filter((row) => !row.done && !visible(row) && !otherHit(row)).length

  /**
   * Alles zeigen – Farben, Suche und «Nur meine».
   *
   * Nötig, wo eine neue Zeile entsteht: Sie ist leer, gehört noch niemandem
   * und passt damit zu keinem der drei Filter. Ohne das legte man eine Zeile
   * an, die man nicht sieht.
   */
  const showAll = () => {
    setShown(CALLING_URGENCY_ORDER)
    setSearch('')
    setMineOnly(false)
  }

  const patch = (next: Partial<CallingChanges>) => onChange?.({ ...value, ...next })

  const changeMember = (id: string, fields: Partial<CallingMemberRow>) =>
    patch({ members: value.members.map((row) => (row.id === id ? { ...row, ...fields } : row)) })

  const changeOpen = (id: string, fields: Partial<CallingOpenRow>) =>
    patch({ open: value.open.map((row) => (row.id === id ? { ...row, ...fields } : row)) })

  /*
   * Was gerade gezogen wird – und worüber es schwebt.
   *
   * Die Tabelle gehört dazu: Eine Zeile aus «Neue Berufungen» in die
   * «Offenen Berufungen» zu ziehen hiesse, aus einer Person eine Aufgabe zu
   * machen. Gezogen wird deshalb nur innerhalb einer Tabelle.
   */
  const [dragged, setDragged] = useState<{ table: CallingTableKey; id: string } | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const move = (table: CallingTableKey, id: string, to: number) =>
    patch(
      table === 'members'
        ? { members: moveCallingRow(value.members, id, to) }
        : { open: moveCallingRow(value.open, id, to) },
    )

  const dropDone = () => {
    setDragged(null)
    setOver(null)
  }

  /**
   * Was eine Zeile zum Umsortieren braucht – für beide Tabellen dasselbe.
   *
   * Ohne eingeschaltetes Umsortieren bleibt alles weg: keine Pfeile, kein
   * Griff, kein Ziehen.
   */
  const handles = (table: CallingTableKey, id: string, index: number, count: number) => {
    if (!reordering) return {}
    // Was gezogen wird, sofern es aus dieser Tabelle stammt.
    const carried = dragged?.table === table ? dragged : null
    return {
      onMove: (delta: number) => move(table, id, index + delta),
      first: index === 0,
      last: index === count - 1,
      dragging: carried?.id === id,
      dropTarget: carried !== null && carried.id !== id && over === id,
      onDragStart: () => setDragged({ table, id }),
      onDragOver: (event: DragEvent) => {
        if (!carried) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(id)
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        if (carried && carried.id !== id) move(table, carried.id, index)
        dropDone()
      },
      onDragEnd: dropDone,
    }
  }

  /**
   * Eine Zeile der Tabelle «Neue Berufungen».
   *
   * Als eigene Funktion, weil sie zweimal gezeichnet wird: in der Tabelle
   * selbst und – bei einer Suche – unter den Treffern, die ein anderer Filter
   * wegnimmt. Zwei Fassungen derselben Zeile liessen sich verschieden
   * bearbeiten.
   */
  const memberRow = (row: CallingMemberRow, index: number) => (
    <RowFrame
      key={row.id}
      row={row}
      editable={editable}
      position={index + 1}
      onUrgency={(urgency) => changeMember(row.id, { urgency })}
      onAssignees={(assignees) => changeMember(row.id, { assignees })}
      onDone={
        isCallingMemberRowEmpty(row) ? undefined : () => changeMember(row.id, { done: !row.done })
      }
      onRemove={
        value.members.length > 1 || !isCallingMemberRowEmpty(row)
          ? () => patch({ members: withoutRow(value.members, row.id, newCallingMemberRow) })
          : undefined
      }
      {...handles('members', row.id, index, value.members.length)}
    >
      <Cell label="Name">
        {/*
              Steht ein Name da, steht er auch beim Schreiben als Verweis da
              – ein Griff darauf führt zum Profil, wo die bisherigen
              Berufungen stehen. Genau die schaut man in einer Runde nach.
              Gesucht wird nur, solange die Zeile keinen Namen hat: Es ist
              **eine** Person je Zeile. Geht es um ein Ehepaar, sind es zwei
              Zeilen; was früher zu zweit erfasst wurde, bleibt stehen und
              lässt sich einzeln entfernen.
            */}
        {!editable || row.memberIds.length > 0 ? (
          <MemberNames
            ids={row.memberIds}
            onRemove={
              editable
                ? (id) =>
                    changeMember(row.id, {
                      memberIds: row.memberIds.filter((entry) => entry !== id),
                    })
                : undefined
            }
          />
        ) : (
          <MemberPicker
            single
            stacked
            label=""
            value={row.memberIds}
            onChange={(next) => changeMember(row.id, { memberIds: next })}
            placeholder="Name suchen …"
          />
        )}
      </Cell>
      <Cell label="Berufung">
        <TextCell
          id={fieldId(row.id, 'calling')}
          label={`Berufung, Zeile ${index + 1}`}
          value={row.calling}
          onChange={(next) => changeMember(row.id, { calling: next })}
          onMention={onMention}
          memberRefs={memberRefs}
          readOnly={!editable}
          // Der Feldname und kein Beispielsatz – wie beim Titel eines
          // Traktandums. Was in die Spalte gehört, sagt ihre
          // Überschrift; ein Satz darunter wiederholte sie bloss
          // umständlicher.
          placeholder="Berufung"
        />
      </Cell>
      <Cell label="Ideen und weiteres Vorgehen">
        <TextCell
          id={fieldId(row.id, 'ideas')}
          label={`Ideen und weiteres Vorgehen, Zeile ${index + 1}`}
          value={row.ideas}
          onChange={(next) => changeMember(row.id, { ideas: next })}
          onMention={onMention}
          memberRefs={memberRefs}
          readOnly={!editable}
          placeholder="Was in Frage käme"
        />
      </Cell>
    </RowFrame>
  )

  /** Dasselbe für die Tabelle «Offene Berufungen». */
  const openRow = (row: CallingOpenRow, index: number) => (
    <RowFrame
      key={row.id}
      row={row}
      editable={editable}
      position={index + 1}
      onUrgency={(urgency) => changeOpen(row.id, { urgency })}
      onAssignees={(assignees) => changeOpen(row.id, { assignees })}
      onDone={
        isCallingOpenRowEmpty(row) ? undefined : () => changeOpen(row.id, { done: !row.done })
      }
      onRemove={
        value.open.length > 1 || !isCallingOpenRowEmpty(row)
          ? () => patch({ open: withoutRow(value.open, row.id, newCallingOpenRow) })
          : undefined
      }
      {...handles('open', row.id, index, value.open.length)}
    >
      <Cell label="Berufung">
        <TextCell
          id={fieldId(row.id, 'calling')}
          label={`Offene Berufung, Zeile ${index + 1}`}
          value={row.calling}
          onChange={(next) => changeOpen(row.id, { calling: next })}
          onMention={onMention}
          memberRefs={memberRefs}
          readOnly={!editable}
          placeholder="Welche Aufgabe offen ist"
        />
      </Cell>
      <Cell label="Name (Vorschläge)">
        <TextCell
          id={fieldId(row.id, 'candidates')}
          label={`Vorschläge, Zeile ${index + 1}`}
          value={row.candidates}
          onChange={(next) => changeOpen(row.id, { candidates: next })}
          onMention={onMention}
          memberRefs={memberRefs}
          readOnly={!editable}
          placeholder="«@» setzt einen Namen ein"
        />
      </Cell>
      <Cell label="Weiteres Vorgehen">
        <TextCell
          id={fieldId(row.id, 'next')}
          label={`Weiteres Vorgehen, Zeile ${index + 1}`}
          value={row.next}
          onChange={(next) => changeOpen(row.id, { next })}
          onMention={onMention}
          memberRefs={memberRefs}
          readOnly={!editable}
          placeholder="Wer fragt an, bis wann"
        />
      </Cell>
    </RowFrame>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Die Suche steht vorn und nimmt den Platz, der übrig bleibt: Sie
            wird am Sitzungstisch gebraucht, die beiden Knöpfe daneben selten. */}
        {!reordering && (
          <div className="relative min-w-40 flex-1 sm:max-w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              className="input py-1 pl-8 text-sm"
              aria-label="In der Berufungsrunde suchen"
              placeholder="Suchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Steht nur da, wo es etwas auszuwählen gibt: Wen die Runde nicht
              betrifft, dem sagt ein Knopf, der die Tabelle leerte, nichts. */}
          {!reordering && ownRows > 0 && (
            <button
              type="button"
              aria-pressed={mineOnly}
              onClick={() => setMineOnly(!mineOnly)}
              title={
                mineOnly
                  ? 'Wieder die ganze Runde zeigen'
                  : ownRows === 1
                    ? 'Nur die eine Zeile zeigen, die mich betrifft'
                    : `Nur die ${ownRows} Zeilen zeigen, die mich betreffen`
              }
              className={cn(
                'btn-ghost btn-sm',
                mineOnly && 'text-brand-700 dark:text-brand-300 font-medium',
              )}
            >
              <UserCheck className="size-3.5" aria-hidden />
              Nur meine
            </button>
          )}

          {editable && (
            <button
              type="button"
              aria-pressed={ordering}
              onClick={() => {
                // Umgestellt wird an der ganzen Tabelle – also erst einmal
                // alles zeigen.
                if (!ordering) showAll()
                setOrdering(!ordering)
              }}
              className={cn(
                'btn-ghost btn-sm',
                ordering && 'text-brand-700 dark:text-brand-300 font-medium',
              )}
            >
              <ArrowUpDown className="size-3.5" aria-hidden />
              Reihenfolge
            </button>
          )}

          {/* Beim Umsortieren steht die Wahl der Farben nicht zur Verfügung:
              Ein Ausschnitt sagt nichts darüber, wo das Ausgeblendete steht. */}
          {!reordering && <UrgencyFilter value={shown} onChange={setShown} />}
        </div>
      </div>

      {reordering && (
        <p className="hint">
          Zeilen mit den Pfeilen verschieben – am Zeigergerät auch, indem man sie am Griff zieht.
          Die Reihenfolge gehört zum Eintrag und gilt damit für alle.
        </p>
      )}

      <CallingTable
        title={CALLING_TABLE_TITLES.members}
        columns={['Name', 'Berufung', 'Ideen und weiteres Vorgehen']}
        editable={editable}
        hidden={hiddenIn(value.members)}
        /* Die Nummern laufen weiter: Eine zweite Zeile «1» unter der Tabelle
           wäre eine Zeile, die es zweimal gibt. */
        others={value.members
          .filter(otherHit)
          .map((row, index) => memberRow(row, value.members.filter(visible).length + index))}
        onAdd={() => {
          showAll()
          patch({ members: [...value.members, newCallingMemberRow()] })
        }}
      >
        {value.members.filter(visible).map(memberRow)}
      </CallingTable>

      <CallingTable
        title={CALLING_TABLE_TITLES.open}
        columns={['Berufung', 'Name (Vorschläge)', 'Weiteres Vorgehen']}
        editable={editable}
        hidden={hiddenIn(value.open)}
        others={value.open
          .filter(otherHit)
          .map((row, index) => openRow(row, value.open.filter(visible).length + index))}
        onAdd={() => {
          showAll()
          patch({ open: [...value.open, newCallingOpenRow()] })
        }}
      >
        {value.open.filter(visible).map(openRow)}
      </CallingTable>

      {/* Das Erledigte ganz unten – wo es nicht im Weg steht und trotzdem
          greifbar bleibt. Ohne eine einzige abgehakte Zeile steht der Knopf
          gar nicht erst da. */}
      {doneRows > 0 && (
        <button
          type="button"
          aria-pressed={showDone}
          onClick={() => setShowDone(!showDone)}
          className="btn-ghost btn-sm w-full justify-center"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          {showDone
            ? 'Erledigte ausblenden'
            : `Erledigte anzeigen · ${doneRows} ${doneRows === 1 ? 'Zeile' : 'Zeilen'}`}
        </button>
      )}
    </div>
  )
}

/** Welche der beiden Tabellen gemeint ist – ihre Schlüssel in `CallingChanges`. */
type CallingTableKey = keyof CallingChanges

/**
 * Die `id` eines Feldes – aus der Zeile und nicht aus der Stelle im Baum.
 *
 * Sie muss einen Neuaufbau der Ansicht überstehen: An ihr erkennt das Feld,
 * dass darin eben geschrieben wurde, und schreibt weiter, statt in den
 * Lesezustand zurückzufallen (siehe `lib/writing`). Eine aus der Baumstelle
 * abgeleitete `id` (`useId`) täte das nicht – sie ist eine andere, sobald der
 * Eintrag in der Liste den Abschnitt wechselt. Die Zeilen-ID ist ohnehin
 * eindeutig, auch über beide Tabellen hinweg.
 */
function fieldId(rowId: string, column: string): string {
  return `berufung-${rowId}-${column}`
}

/**
 * Eine Zeile entfernen – und dafür sorgen, dass eine übrig bleibt.
 *
 * Eine Tabelle ohne Zeile liesse sich nicht ausfüllen. Wer die letzte
 * löscht, bekommt deshalb eine leere zurück, statt vor einer Tabelle ohne
 * Eingang zu stehen.
 */
function withoutRow<T extends CallingRowBase>(rows: T[], id: string, fresh: () => T): T[] {
  const rest = rows.filter((row) => row.id !== id)
  return rest.length > 0 ? rest : [fresh()]
}

/* ------------------------------------------------------------------ */
/* Eine Tabelle                                                        */
/* ------------------------------------------------------------------ */

/**
 * Die vier Spalten einer Zeile: drei Felder und, schmal rechts daneben, die
 * Bedienung.
 *
 * Als eigene Spalte statt als Fusszeile – das spart je Zeile eine ganze
 * Zeile Höhe, und eine Runde mit zwanzig Einträgen passt damit auf einen
 * Bildschirm statt auf zwei.
 */
const ROW_COLUMNS = 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] sm:items-start'

function CallingTable({
  title,
  columns,
  editable,
  hidden,
  others,
  onAdd,
  children,
}: {
  title: string
  columns: [string, string, string]
  editable: boolean
  /** Wie viele Zeilen Farbfilter und Suche gerade wegnehmen */
  hidden: number
  /**
   * Zeilen, die zur Suche passen, aber ein anderer Filter wegnimmt.
   *
   * Sie stehen abgesetzt unter der Tabelle: Der Farbfilter sagt, welchen
   * Ausschnitt man bearbeitet – die Suche fragt, wo etwas steht, und das
   * hört am Rand des Ausschnitts nicht auf.
   */
  others?: ReactNode[]
  onAdd: () => void
  children: ReactNode
}) {
  const otherCount = others?.length ?? 0
  return (
    <section>
      {/* Nur der Titel – ein Satz darunter, der ihn mit anderen Worten
          wiederholt, kostet in jeder Runde zwei Zeilen und sagt beim zweiten
          Mal nichts mehr. */}
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>

      {/* Ab Tabletbreite stehen die Überschriften einmal über der Tabelle;
          darunter trägt jedes Feld seine eigene (siehe `Cell`). Die vierte
          Spalte bleibt leer: Was darin steht, erklärt sich am Knopf. */}
      <div className={cn('hidden gap-1.5 px-2 pb-1 sm:grid', ROW_COLUMNS)}>
        {columns.map((column) => (
          <span key={column} className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {column}
          </span>
        ))}
        <span aria-hidden />
      </div>

      <ul className="space-y-1.5">{children}</ul>

      {hidden > 0 && (
        <p className="hint">
          {hidden} {hidden === 1 ? 'Zeile ist' : 'Zeilen sind'} ausgeblendet.
        </p>
      )}

      {otherCount > 0 && (
        <div className="mt-3 border-t border-dashed border-slate-300 pt-2 dark:border-slate-700">
          <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Weitere Treffer ausserhalb der Filter
            </span>{' '}
            <span className="tabular">{otherCount}</span> · Diese Zeilen passen zur Suche, werden
            aber durch die Farbwahl oder «Nur meine» ausgeblendet.
          </p>
          <ul className="space-y-1.5">{others}</ul>
        </div>
      )}

      {editable && (
        <button type="button" className="btn-secondary btn-sm mt-2" onClick={onAdd}>
          <Plus className="size-3.5" aria-hidden />
          Zeile
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile                                                          */
/* ------------------------------------------------------------------ */

/**
 * Die Farbe der Zeile.
 *
 * Gefärbt wird der Hintergrund nur schwach und der linke Rand kräftig. So
 * lassen sich die Stufen auch nebeneinander auseinanderhalten, ohne dass
 * der Text an Kontrast verliert – und wer Farben schlecht unterscheidet,
 * hat den Namen der Stufe an den Knöpfen und im Ausdruck.
 */
const URGENCY_ROW: Record<CallingUrgency, string> = {
  high: 'border-l-rose-400 bg-rose-50/70 dark:border-l-rose-500 dark:bg-rose-950/30',
  medium: 'border-l-amber-400 bg-amber-50/70 dark:border-l-amber-500 dark:bg-amber-950/30',
  low: 'border-l-emerald-400 bg-emerald-50/70 dark:border-l-emerald-500 dark:bg-emerald-950/30',
}

const URGENCY_DOT: Record<CallingUrgency, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
}

const URGENCY_BADGE: Record<CallingUrgency, string> = {
  high: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  low: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
}

/**
 * Wie eine Zeile aussieht: die drei Felder, darunter Farbe und
 * Zuständigkeit – **unten rechts** und in einer einzigen schmalen Reihe.
 *
 * Beides ist Bedienung und nicht Inhalt. Links unter den Feldern stand es
 * mitten im Lesefluss, und die Beschriftung «Zuständig» sagte dabei nichts,
 * was die Namen daneben nicht schon sagen. Rechts aussen bleibt es in
 * Reichweite, ohne die Tabelle zu zerschneiden – und der Papierkorb steht als
 * einziges am anderen Ende, weit weg von den Knöpfen, die man dauernd trifft.
 */
function RowFrame({
  row,
  editable,
  position,
  onUrgency,
  onAssignees,
  onDone,
  onRemove,
  onMove,
  first = false,
  last = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragging = false,
  dropTarget = false,
  children,
}: {
  row: CallingRowBase
  editable: boolean
  position: number
  onUrgency: (next: CallingUrgency | undefined) => void
  onAssignees: (next: string[]) => void
  /** Abhaken und wieder öffnen. Fehlt er, steht in der Zeile noch nichts. */
  onDone?: () => void
  /** Fehlt er, ist es die letzte und noch leere Zeile der Tabelle. */
  onRemove?: () => void
  /** Um eine Stelle nach oben (-1) oder unten (+1) – nur beim Umsortieren */
  onMove?: (delta: number) => void
  first?: boolean
  last?: boolean
  onDragStart?: () => void
  onDragOver?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
  onDragEnd?: () => void
  dragging?: boolean
  dropTarget?: boolean
  children: ReactNode
}) {
  const { users } = useData()

  /*
   * Gezogen wird nur am Griff.
   *
   * In der Zeile stehen drei Textfelder; wäre sie durchgehend zum Ziehen
   * freigegeben, liesse sich darin kein Wort mehr markieren. `draggable`
   * gilt deshalb erst ab dem Griff der Maus auf den Griff – und danach
   * wieder nicht.
   */
  const [grabbed, setGrabbed] = useState(false)
  const release = () => setGrabbed(false)

  /*
   * Ist das Menü der Zeile offen? Das muss die **Zeile** wissen.
   *
   * Erledigt steht sie blass da, und `opacity` gilt für alles, was in ihr
   * steht – auch für ein Menü, das darüber aufgeht. Zurückholen lässt sich
   * die Deckkraft von innen nicht: Ein Kind wird nie kräftiger als sein
   * Elternteil. Das Menü stand deshalb halb durchsichtig über der halb
   * durchsichtigen Zeile und war kaum zu lesen.
   *
   * Solange es offen ist, steht die Zeile darum voll da. Blass heisst
   * «weggeräumt» – wer das Menü aufmacht, räumt sie gerade wieder hervor.
   */
  const [menuOpen, setMenuOpen] = useState(false)

  // Nur Konten mit Vollzugriff: Wer allein den AP-Kalender sieht, bekommt
  // eine Berufungsrunde gar nicht zu Gesicht.
  const bishopric = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))

  return (
    <li
      draggable={grabbed}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => {
        release()
        onDragEnd?.()
      }}
      onMouseUp={release}
      className={cn(
        'rounded-lg border border-l-4 border-slate-200 p-1.5 transition dark:border-slate-800',
        row.urgency ? URGENCY_ROW[row.urgency] : 'border-l-slate-200 dark:border-l-slate-700',
        /* Erledigt steht sie blass da – zu sehen ist sie nur, wenn jemand das
           Erledigte ausdrücklich hervorgeholt hat, und dann soll sie sich vom
           Offenen unterscheiden. Nicht aber, solange ihr Menü offen ist: Es
           stünde sonst selbst blass da (siehe `menuOpen`). */
        row.done && !menuOpen && 'opacity-60',
        dragging && 'opacity-40',
        dropTarget && 'border-brand-500 border-dashed',
      )}
    >
      <div className="flex gap-1.5">
        {/* Der Griff und die beiden Pfeile – nur, solange umsortiert wird.
            Sie stehen als schmale Spalte links neben der Zeile: Dort sind sie
            beisammen und liegen nicht zwischen den Feldern. */}
        {onMove && (
          <div className="flex shrink-0 flex-col items-center">
            <span
              className="hidden cursor-grab py-0.5 text-slate-300 active:cursor-grabbing sm:block dark:text-slate-600"
              onMouseDown={() => setGrabbed(true)}
              aria-hidden
            >
              <GripVertical className="size-4" />
            </span>
            <button
              type="button"
              className="btn-ghost p-0.5"
              onClick={() => onMove(-1)}
              disabled={first}
              aria-label={`Zeile ${position} nach oben`}
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-ghost p-0.5"
              onClick={() => onMove(1)}
              disabled={last}
              aria-label={`Zeile ${position} nach unten`}
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        )}

        <div className={cn('grid min-w-0 flex-1 gap-1.5', ROW_COLUMNS)}>
          {children}

          {/* Die vierte Spalte: Farbe, Zuständigkeit und der Papierkorb –
              alles hinter einem Knopf, der schon anschreibt, was gesetzt
              ist. Am Telefon steht er rechts unter den Feldern. */}
          <div className="flex justify-end sm:justify-start">
            {editable ? (
              <RowMenu
                row={row}
                position={position}
                bishopric={bishopric}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                onUrgency={onUrgency}
                onAssignees={onAssignees}
                onDone={onDone}
                onRemove={onRemove}
              />
            ) : (
              (row.done || row.urgency || row.assignees.length > 0) && (
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {row.done && <DoneBadge />}
                  {row.urgency && (
                    <span className={cn('badge', URGENCY_BADGE[row.urgency])}>
                      {CALLING_URGENCY_LABELS[row.urgency]}
                    </span>
                  )}
                  {row.assignees.map((id) => (
                    <AssigneeChip key={id} id={id} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Farbe, Zuständigkeit, Papierkorb – hinter einem Knopf                */
/* ------------------------------------------------------------------ */

/**
 * Die drei Griffe einer Zeile, zusammengefasst in ein kleines Menü.
 *
 * Nebeneinander ausgeschrieben brauchten sie eine eigene Zeile unter jedem
 * Eintrag – drei Kreise, fünf Namen, ein Papierkorb. Bei zwanzig Zeilen ist
 * das die halbe Ansicht für etwas, das man je Zeile ein-, zweimal anfasst.
 *
 * Der Knopf selbst bleibt trotzdem eine Auskunft: Er trägt den Farbpunkt der
 * Zeile und die Kreise der Zuständigen. Man sieht also weiterhin auf einen
 * Blick, was gesetzt ist – nur die Wahl selbst liegt einen Griff tiefer.
 */
function RowMenu({
  row,
  position,
  bishopric,
  open,
  onOpenChange,
  onUrgency,
  onAssignees,
  onDone,
  onRemove,
}: {
  row: CallingRowBase
  position: number
  bishopric: AppUser[]
  /**
   * Offen oder zu – geführt von der Zeile.
   *
   * Sie richtet sich danach: Erledigt steht sie blass da, und blass wäre
   * sonst auch das Menü darin (siehe `RowFrame`).
   */
  open: boolean
  onOpenChange: (next: boolean) => void
  onUrgency: (next: CallingUrgency | undefined) => void
  onAssignees: (next: string[]) => void
  onDone?: () => void
  onRemove?: () => void
}) {
  const { userName } = useData()

  /* Die Escape-Taste schliesst, egal wo der Fokus gerade steht. */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const label = row.done
    ? 'Erledigt'
    : row.urgency
      ? CALLING_URGENCY_LABELS[row.urgency]
      : 'ohne Farbe'
  const assignees = row.assignees.map(userName).join(', ')

  return (
    /*
     * Das Menü hängt an der **Spalte**, nicht am Knopf.
     *
     * Der Knopf wächst, sobald jemand zuständig wird – ein Kreis mehr, ein
     * paar Pixel breiter. Hing das Menü an seinem rechten Rand, sprang es in
     * dem Augenblick zur Seite, in dem man darin einen Namen anklickte. Die
     * vierte Spalte hat dagegen ein festes Mass (`ROW_COLUMNS`), am Telefon
     * die Breite der Zeile: Daran bleibt das Menü stehen, wo es aufgegangen
     * ist. Ausgerichtet wird der Knopf darin wie zuvor – rechts am Telefon,
     * links ab Tabletbreite.
     */
    <div className="relative flex w-full justify-end sm:justify-start">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={assignees ? `${label} · ${assignees}` : label}
        aria-label={`Zeile ${position}: Farbe und Zuständigkeit – ${label}${
          assignees ? `, ${assignees}` : ', niemand zuständig'
        }`}
        /* Feste Höhe: Der erste Kreis eines Zuständigen ist höher als Punkt
           und Pfeil zusammen. Ohne das Mass wüchse der Knopf in dem
           Augenblick, in dem man im offenen Menü jemanden anklickt – und das
           Menü darunter rutschte mit. */
        className="btn-ghost flex min-h-7 items-center gap-1 px-1.5 py-1"
      >
        {/* Was gesetzt ist, steht am Knopf. Bei einer abgehakten Zeile ist das
            der Haken statt der Farbe: Wie dringend sie einmal war, ist dann
            keine Auskunft mehr. */}
        {row.done ? (
          <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <span
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              row.urgency ? URGENCY_DOT[row.urgency] : 'bg-slate-300 dark:bg-slate-600',
            )}
            aria-hidden
          />
        )}
        {row.assignees.slice(0, 2).map((id) => (
          /* `flex` und nicht bloss ein `span`: Als Zeilenkasten brächte der
             Kreis den Unterlängen-Abstand seiner Schriftzeile mit und machte
             den Knopf zwei Pixel höher als das feste Mass. */
          <span key={id} className="flex" aria-hidden>
            <UserAvatar userId={id} size="xs" />
          </span>
        ))}
        <ChevronDown
          className={cn('size-3 shrink-0 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {/* Fängt den Klick daneben ab – so schliesst das Menü wie überall
              in der App, ohne dass man den Knopf wieder treffen muss. */}
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} aria-hidden />
          {/* `top-full` statt der Stelle im Fluss: In einer Flex-Reihe stünde
              das Menü sonst **neben** dem Knopf statt darunter. */}
          <div
            role="menu"
            className="animate-scale-in absolute top-full right-0 z-50 mt-1 w-56 origin-top-right space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Dringlichkeit
              </span>
              <UrgencyPicker
                value={row.urgency}
                onChange={onUrgency}
                label={`Dringlichkeit, Zeile ${position}`}
              />
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Zuständig
              </span>
              <div className="flex flex-wrap gap-1">
                {bishopric.map((user) => (
                  <PersonButton
                    key={user.id}
                    id={user.id}
                    name={user.displayName}
                    selected={row.assignees.includes(user.id)}
                    onClick={() =>
                      onAssignees(
                        row.assignees.includes(user.id)
                          ? row.assignees.filter((id) => id !== user.id)
                          : [...row.assignees, user.id],
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* Abgehakt wird zeilenweise: Die eine Berufung steht, während
                die nächste noch offen ist. Die Zeile verschwindet danach aus
                der Tabelle und steht unter «Erledigte anzeigen». */}
            {onDone && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onDone()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                {row.done ? (
                  <>
                    <RotateCcw className="size-3.5" aria-hidden />
                    Wieder offen
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" aria-hidden />
                    Erledigt
                  </>
                )}
              </button>
            )}

            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onRemove()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Zeile löschen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile anderswo                                                 */
/* ------------------------------------------------------------------ */

/**
 * Eine einzelne Zeile, wie sie gelesen wird – für das Mitgliederprofil.
 *
 * Dort steht die Runde nicht als Tabelle, sondern als das, was sie über
 * **eine** Person sagt: aus welcher der beiden Tabellen die Zeile stammt,
 * was in ihren Feldern steht, wie dringend es ist und wer sich darum
 * kümmert. Farbe und Zuständigkeit sehen dabei genauso aus wie in der Runde
 * selbst – es ist dieselbe Zeile, bloss an einem anderen Ort.
 *
 * Leere Felder bleiben weg: Eine Beschriftung mit nichts dahinter sagt
 * nichts, was die leere Stelle nicht auch sagt.
 */
export function CallingRowSummary({
  match,
  memberRefs,
}: {
  match: CallingRowMatch
  /** Verweise des Eintrags, damit «@»-Namen im Text anklickbar bleiben */
  memberRefs?: string[]
}) {
  const { row } = match
  const fields =
    match.table === 'members'
      ? [
          { label: 'Berufung', text: match.row.calling },
          { label: 'Ideen und weiteres Vorgehen', text: match.row.ideas },
        ]
      : [
          { label: 'Berufung', text: match.row.calling },
          { label: 'Name (Vorschläge)', text: match.row.candidates },
          { label: 'Weiteres Vorgehen', text: match.row.next },
        ]
  const filled = fields.filter((field) => field.text.trim() !== '')

  return (
    <li
      className={cn(
        'rounded-lg border border-l-4 border-slate-200 p-2 dark:border-slate-800',
        row.urgency ? URGENCY_ROW[row.urgency] : 'border-l-slate-200 dark:border-l-slate-700',
      )}
    >
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {CALLING_TABLE_TITLES[match.table]}
      </span>

      {filled.length === 0 ? (
        <p className="text-sm text-slate-400">Noch nichts notiert.</p>
      ) : (
        <dl className="mt-0.5 space-y-1">
          {filled.map((field) => (
            <div key={field.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {field.label}
              </dt>
              <dd className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">
                <MentionText text={field.text} memberRefs={memberRefs} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(row.done || row.urgency || row.assignees.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
          {/* Was abgeschlossen ist, steht auch im Profil als abgeschlossen da –
              sonst läse sich eine erledigte Zeile dort wie eine offene Idee. */}
          {row.done && <DoneBadge />}
          {row.urgency && (
            <span className={cn('badge', URGENCY_BADGE[row.urgency])}>
              {CALLING_URGENCY_LABELS[row.urgency]}
            </span>
          )}
          {row.assignees.map((id) => (
            <AssigneeChip key={id} id={id} />
          ))}
        </div>
      )}
    </li>
  )
}

function DoneBadge() {
  return (
    <span className="badge bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      <Check className="size-3" aria-hidden />
      Erledigt
    </span>
  )
}

/** Wer zuständig ist, steht als Kreis mit dem Kürzel da – wie überall sonst. */
function AssigneeChip({ id }: { id: string }) {
  return <UserAvatar userId={id} size="xs" />
}

/**
 * Ein Feld samt Beschriftung.
 *
 * Die Beschriftung steht nur am Telefon da: Ab Tabletbreite steht sie
 * einmal über der Tabelle, und zweimal dasselbe zu lesen bringt niemandem
 * etwas.
 */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  )
}

/** Ein mehrzeiliges Freitextfeld, in dem «@» die Mitgliederliste öffnet. */
function TextCell({
  id,
  label,
  value,
  onChange,
  onMention,
  memberRefs,
  readOnly,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  onMention?: (member: Member) => void
  memberRefs?: string[]
  readOnly: boolean
  placeholder: string
}) {
  return (
    <MentionEditable
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      onMention={onMention}
      memberRefs={memberRefs}
      multiline
      /* Eine Zeile hoch – und von da an so hoch wie ihr Text.
         Zwei Zeilen als Grundmass hiessen: Die halbe Runde steht leer da,
         weil in den meisten Zeilen ein Halbsatz steht. */
      rows={1}
      readOnly={readOnly}
      placeholder={readOnly ? undefined : placeholder}
      className="rounded-lg text-sm"
      fieldClassName="resize-y text-sm"
    />
  )
}

/**
 * Der gewählte Name – er führt zur Person, gelesen wie geschrieben.
 *
 * Auch beim Ausfüllen bleibt er ein Verweis: In einer Berufungsrunde ist die
 * nächste Frage fast immer «was hat die Person bisher getan?», und die
 * Antwort steht in ihrem Profil. Steht ein `onRemove` bereit, lässt sich der
 * Name daneben wieder wegnehmen – dann steht wieder das Suchfeld da.
 */
function MemberNames({ ids, onRemove }: { ids: string[]; onRemove?: (id: string) => void }) {
  const { membersById } = useData()

  if (ids.length === 0) return <span className="px-3 text-sm text-slate-400">Niemand</span>

  return (
    <div className="space-y-1">
      {ids.map((id) => {
        const member = membersById.get(id)
        const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekanntes Mitglied'
        return (
          <div
            key={id}
            className={cn(
              'flex items-center gap-2',
              onRemove &&
                'rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900',
            )}
          >
            <Avatar name={name} id={id} size="xs" />
            {member ? (
              <MemberLink
                memberId={id}
                label="Traktandum"
                className="text-brand-700 dark:text-brand-300 min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {name}
              </MemberLink>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="btn-ghost shrink-0 p-1"
                aria-label={`${name} entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Die Farben                                                          */
/* ------------------------------------------------------------------ */

/**
 * Die drei Kreise an der Zeile: Wie dringend ist das?
 *
 * Der Kreis ist klein, die Fläche darum nicht: Der Knopf trägt einen
 * Innenabstand und bleibt damit auch am Telefon zu treffen, während die
 * Zeile schmal bleibt.
 */
function UrgencyPicker({
  value,
  onChange,
  label,
}: {
  value: CallingUrgency | undefined
  onChange: (next: CallingUrgency | undefined) => void
  label: string
}) {
  return (
    <div className="flex items-center" role="group" aria-label={label}>
      {CALLING_URGENCY_ORDER.map((level) => {
        const selected = value === level
        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            // Ein zweiter Griff nimmt die Einschätzung wieder weg – sonst
            // liesse sich eine einmal gesetzte Farbe nie mehr loswerden.
            onClick={() => onChange(selected ? undefined : level)}
            title={CALLING_URGENCY_LABELS[level]}
            aria-label={CALLING_URGENCY_LABELS[level]}
            className={cn(
              'grid place-items-center rounded-full p-1 transition',
              selected
                ? 'ring-2 ring-slate-500 dark:ring-slate-300'
                : 'opacity-30 hover:opacity-70',
            )}
          >
            <span className={cn('size-3.5 rounded-full', URGENCY_DOT[level])} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Dieselben drei Kreise oben rechts – hier blenden sie aus.
 *
 * Wer die dringenden Zeilen durchgehen will, klickt Grün und Orange weg.
 * Die letzte Farbe lässt sich nicht auch noch abwählen: Eine Tabelle, die
 * nichts zeigt, ist keine Ansicht, sondern ein Versehen.
 */
function UrgencyFilter({
  value,
  onChange,
}: {
  value: CallingUrgency[]
  onChange: (next: CallingUrgency[]) => void
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Priorität">
      <span className="text-xs text-slate-500 dark:text-slate-400">Priorität</span>
      {CALLING_URGENCY_ORDER.map((level) => {
        const on = value.includes(level)
        const last = on && value.length === 1
        return (
          <button
            key={level}
            type="button"
            aria-pressed={on}
            disabled={last}
            onClick={() =>
              onChange(
                on
                  ? value.filter((entry) => entry !== level)
                  : CALLING_URGENCY_ORDER.filter(
                      (entry) => entry === level || value.includes(entry),
                    ),
              )
            }
            title={`${CALLING_URGENCY_LABELS[level]} ${on ? 'ausblenden' : 'einblenden'}`}
            aria-label={`${CALLING_URGENCY_LABELS[level]} ${on ? 'ausblenden' : 'einblenden'}`}
            className={cn(
              'size-5 rounded-full transition',
              URGENCY_DOT[level],
              on ? 'ring-1 ring-slate-400/60' : 'opacity-25 hover:opacity-60',
              last && 'cursor-default',
            )}
          />
        )
      })}
    </div>
  )
}

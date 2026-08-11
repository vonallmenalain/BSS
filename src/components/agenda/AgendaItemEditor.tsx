import { useEffect, useRef, useState } from 'react'
import { useAutosave } from '@/hooks/useAutosave'
import { RichEditable } from '@/components/ui/RichText'
import { AssigneePicker } from '@/components/ui/Pickers'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { CallingChangesTables } from '@/components/agenda/CallingChanges'
import { updateAgendaItem } from '@/services/agenda'
import { normalizeLayout, serializeLayout } from '@/lib/layout'
import {
  mergeCallingChanges,
  normalizeCallingChanges,
  serializeCallingChanges,
} from '@/lib/callingChanges'
import { richValueOf, trimRichValue, type RichValue } from '@/lib/richtext'
import type { AgendaItem, CallingChanges, ItemLayout } from '@/lib/types'

/**
 * Ein Traktandum bearbeiten – ohne Formular, ohne Speichern-Knopf.
 *
 * Früher stand hier ein Fenster, das sich über die Sitzung legte: Stift
 * antippen, Felder ausfüllen, speichern, schliessen. Das ist genau ein
 * Handgriff zu viel für eine Sitzung, in der geschrieben wird, während
 * gesprochen wird. Jetzt ist der Eintrag selbst das Formular – Titel und
 * Beschreibung sind Text, in den man hineingreift, und gespeichert wird kurz
 * nach dem letzten Tastendruck.
 *
 * Zu sehen ist nur, was am Sitzungstisch gebraucht wird: Titel, Beschreibung
 * und die Zuständigen. Bereich, betroffene Mitglieder, Priorität, Termin, das
 * Kennzeichen «vertraulich» und die eigene Notizliste sind weggefallen – sie
 * wurden gepflegt, aber nie gelesen. Was besprochen wurde, gehört in die
 * Beschreibung.
 *
 * Auch die Haken «Variables Layout» und «Berufungsänderung» stehen nicht
 * hier, sondern nur beim Erfassen: Ob ein Punkt ein Absatz Text ist, eine
 * kleine Tabelle oder eine Berufungsrunde, entscheidet sich einmal. Was
 * bereits gebaut wurde, lässt sich hier weiterhin ausfüllen – es tritt an die
 * Stelle der Beschreibung.
 *
 * Der Aufrufer muss die Komponente je Eintrag frisch aufbauen
 * (`key={item.id}`): Der Stand im Feld gehört dem Eintrag, nicht der Stelle
 * auf dem Bildschirm.
 */
export function AgendaItemEditor({
  item,
  readOnly = false,
  ownRowsOnly = false,
  onCallingChanges,
}: {
  item: AgendaItem
  readOnly?: boolean
  /**
   * Eine Berufungsrunde mit «Nur meine» öffnen – so kommt sie unter
   * «Pendenzen → Meine» herein (siehe `CallingChangesTables`).
   */
  ownRowsOnly?: boolean
  /**
   * Meldet jede Änderung an der Runde nach oben – noch bevor sie gespeichert
   * ist.
   *
   * Nötig für den Knopf «Erledigt» am ganzen Eintrag: Er hängt daran, ob noch
   * eine Zeile offen ist, steht aber ausserhalb dieses Editors. Ohne die
   * Meldung stünde dort «noch eine Zeile offen», nachdem man eben die letzte
   * abgehakt hat – bis das automatische Speichern den Eintrag zurückmeldet.
   */
  onCallingChanges?: (next: CallingChanges) => void
}) {
  /*
   * Titel und Beschreibung sind ein Paar aus Text und Formatfeld
   * (`RichValue`, siehe `lib/richtext`): Der Text bleibt das führende Feld,
   * die Formatierung steht daneben und wird zusammen mit ihm gespeichert.
   */
  const [title, setTitle] = useState<RichValue>(() => richValueOf(item.title, item.titleRich))
  const [description, setDescription] = useState<RichValue>(() =>
    richValueOf(item.description, item.descriptionRich),
  )
  const [assignees, setAssignees] = useState<string[]>(item.assignees ?? [])
  const [memberRefs, setMemberRefs] = useState<string[]>(item.memberRefs ?? [])

  /*
   * Das Raster wird genau einmal geradegezogen – beim Aufbauen.
   *
   * `normalizeLayout()` vergibt für Lücken neue IDs. Liefe es bei jedem
   * Zeichnen, wäre der Stand nach jedem Zeichnen ein anderer, und das
   * automatische Speichern schriebe endlos.
   */
  const [layout, setLayout] = useState<ItemLayout | null>(() =>
    item.layout ? normalizeLayout(item.layout) : null,
  )

  // Aus demselben Grund einmalig geradegezogen wie das Raster darüber.
  const [callingChanges, setCallingChanges] = useState<CallingChanges | null>(() =>
    item.callingChanges ? normalizeCallingChanges(item.callingChanges) : null,
  )

  /*
   * Der Bezugspunkt für das Speichern: der Stand, auf dem dieser Editor
   * aufsetzt – beim Öffnen der Eintrag selbst, danach das jeweils zuletzt
   * Geschriebene. Geschrieben wird nur, was davon abweicht: Wer bloss eine
   * Zeile der Berufungsrunde abhakt, überschreibt damit nicht den Titel, den
   * gerade jemand anders umformuliert.
   */
  const baseline = useRef({
    title: richValueOf(item.title, item.titleRich),
    description: richValueOf(item.description, item.descriptionRich),
    assignees: item.assignees ?? [],
    memberRefs: item.memberRefs ?? [],
    layout: item.layout ? normalizeLayout(item.layout) : null,
    callingChanges: item.callingChanges ? normalizeCallingChanges(item.callingChanges) : null,
  })

  // Der jeweils aktuelle Stand aus Firestore – gegen ihn wird beim Speichern
  // zusammengeführt, damit fremde Zeilen der Runde nicht verloren gehen.
  const live = useRef(item)
  useEffect(() => {
    live.current = item
  })

  const autosave = useAutosave(
    { title, description, assignees, memberRefs, layout, callingChanges },
    async (draft) => {
      const base = baseline.current
      const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

      const patch: Partial<Omit<AgendaItem, 'id'>> = {}
      // Beschnitten wird das Paar, nicht der Text allein – sonst passte das
      // Formatfeld nicht mehr zum gespeicherten Titel.
      const titleDraft = trimRichValue(draft.title)
      if (differs(titleDraft, base.title)) {
        patch.title = titleDraft.text
        patch.titleRich = titleDraft.rich
      }
      if (differs(draft.description, base.description)) {
        patch.description = draft.description.text
        patch.descriptionRich = draft.description.rich
      }
      if (differs(draft.assignees, base.assignees)) patch.assignees = draft.assignees
      if (differs(draft.memberRefs, base.memberRefs)) patch.memberRefs = draft.memberRefs
      if (differs(draft.layout, base.layout)) {
        patch.layout = draft.layout ? serializeLayout(draft.layout) : null
      }

      /*
       * Die Runde wird nicht überschrieben, sondern zusammengeführt: Jede
       * Zeile gehört dem, der sie seit dem Öffnen angefasst hat; die übrigen
       * folgen dem Serverstand. So können mehrere Personen gleichzeitig
       * Zeilen abhaken und ausfüllen, ohne einander die Arbeit zu löschen.
       */
      let merged: CallingChanges | null = null
      if (draft.callingChanges && differs(draft.callingChanges, base.callingChanges)) {
        merged = mergeCallingChanges(
          base.callingChanges,
          draft.callingChanges,
          live.current.callingChanges ?? null,
        )
        patch.callingChanges = serializeCallingChanges(merged)
      }

      if (Object.keys(patch).length === 0) return

      await updateAgendaItem(item.id, patch)

      baseline.current = {
        title: titleDraft,
        description: draft.description,
        assignees: draft.assignees,
        memberRefs: draft.memberRefs,
        layout: draft.layout,
        callingChanges: merged ?? draft.callingChanges,
      }

      // Bringt die Zusammenführung fremde Zeilen mit, sollen sie auch auf dem
      // Bildschirm stehen – sonst sähe man hier weniger, als eben gespeichert
      // wurde. Der nächste Speicherlauf erkennt daran nichts Neues.
      if (merged && differs(merged, draft.callingChanges)) {
        setCallingChanges(merged)
        onCallingChanges?.(merged)
      }
    },
    {
      // Ein Eintrag ohne Titel wäre in jeder Liste eine leere Zeile. Wer den
      // Titel löscht, um ihn neu zu schreiben, behält so lange den alten.
      savable: (draft) => draft.title.text.trim() !== '',
      /*
       * Nicht mitten im Schreiben speichern.
       *
       * Jeder Schreibvorgang kommt als Änderung zurück und zeichnet die Seite
       * neu. Beim Ausfüllen einer Berufungsrunde geschah das nach jedem Wort:
       * Die Kachel baute sich auf, die Liste sprang, der Cursor war weg.
       *
       * Gespeichert wird deshalb, wenn der Eintrag **verlassen** wird –
       * beim Wechsel in ein anderes Traktandum, beim Zuklappen, beim
       * Seitenwechsel, beim Weglegen des Geräts (siehe `useAutosave`). Der
       * Zeitgeber ist nur noch das Netz darunter: Wer eine halbe Minute
       * innehält, hat den Stand ebenfalls sicher.
       */
      delayMs: 30_000,
    },
  )

  /*
   * Ein mit «@» eingesetzter Name ist zugleich ein Verweis: Wer im Text steht,
   * steht auch in `memberRefs` – sonst bliebe der Name blosser Text und führte
   * nirgendwohin.
   */
  const linkMember = (memberId: string) =>
    setMemberRefs((current) => (current.includes(memberId) ? current : [...current, memberId]))

  const hinweis =
    title.text.trim() === ''
      ? 'Titel ausfüllen'
      : autosave.state === 'fehler'
        ? 'Nicht gespeichert – die Änderung wird erneut versucht.'
        : null

  return (
    <div
      className="space-y-3"
      /*
       * Verlassen heisst speichern.
       *
       * Der Fokus wandert innerhalb des Eintrags von Feld zu Feld – das ist
       * kein Verlassen und schreibt nichts. Erst wenn er den Eintrag ganz
       * verlässt (ein anderes Traktandum, ein Knopf daneben, eine andere
       * Seite), geht der Stand zu Firestore. So kommt der Rückweg aus der
       * Datenbank nie mitten im Satz an.
       */
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        autosave.flush()
      }}
    >
      <RichEditable
        id={`item-title-${item.id}`}
        label="Titel"
        value={title}
        onChange={setTitle}
        onMention={(member) => linkMember(member.id)}
        memberRefs={memberRefs}
        readOnly={readOnly}
        // Steht nur da, solange nichts geschrieben ist – sonst wäre die Fläche,
        // in die man greift, unsichtbar. Bewusst der Feldname, kein Beispiel.
        placeholder="Titel"
        // Gelesen und geschrieben sitzt der Text im selben Kasten – sonst
        // ruckte er beim ersten Antippen um die Breite eines Rahmens zur Seite.
        className="text-lg font-semibold text-balance sm:text-xl"
        fieldClassName="text-lg font-semibold sm:text-xl"
      />

      {callingChanges ? (
        <CallingChangesTables
          value={callingChanges}
          onChange={(next) => {
            setCallingChanges(next)
            onCallingChanges?.(next)
          }}
          onMention={(member) => linkMember(member.id)}
          memberRefs={memberRefs}
          readOnly={readOnly}
          ownRowsOnly={ownRowsOnly}
        />
      ) : layout ? (
        <LayoutGrid
          layout={layout}
          onChange={setLayout}
          onMention={(member) => linkMember(member.id)}
          memberRefs={memberRefs}
          readOnly={readOnly}
        />
      ) : (
        <RichEditable
          id={`item-description-${item.id}`}
          label="Beschreibung"
          value={description}
          onChange={setDescription}
          onMention={(member) => linkMember(member.id)}
          memberRefs={memberRefs}
          multiline
          readOnly={readOnly}
          placeholder="Beschreibung"
          className="min-h-16 text-sm text-slate-600 dark:text-slate-300"
          fieldClassName="min-h-20 text-sm"
        />
      )}

      {!readOnly && (
        <>
          {/*
            Eine Berufungsrunde trägt ihre Zuständigkeiten in den Zeilen.
            Darunter noch einmal eine für den ganzen Eintrag zu setzen, hiesse
            zweierlei zugleich sagen – «Alain macht das» und «Alain macht
            Zeile 7» –, und beim Verteilen einer Runde ist immer das Zweite
            gemeint. Was früher am Eintrag stand, bleibt gespeichert und wirkt
            weiter; hier steht bloss keine zweite Stelle mehr, an der es sich
            setzen liesse.
          */}
          {!callingChanges && <AssigneePicker value={assignees} onChange={setAssignees} />}

          {/* Nur melden, was zu tun ist. «Wird laufend gespeichert» stand sonst
              unter jedem Traktandum und sagte bei keinem etwas. */}
          {hinweis && (
            <p className="hint" aria-live="polite">
              {hinweis}
            </p>
          )}
        </>
      )}
    </div>
  )
}

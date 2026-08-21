import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Bold,
  Check,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  RemoveFormatting,
  Type,
  Underline,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { Avatar, UserAvatar } from '@/components/ui/Avatar'
import { cn, getInitials, matchesSearch } from '@/lib/utils'
import { findMentionTrigger, type MentionTrigger } from '@/lib/mention'
import {
  BG_COLORS,
  TEXT_COLORS,
  applyMark,
  autoListBlock,
  changeIndent,
  clearMarks,
  docOfValue,
  editTextOf,
  listStateAt,
  marksAt,
  normalizeDoc,
  replaceRange,
  toRichValue,
  toggleList,
  wordRangeAt,
  type MarkKey,
  type RichDoc,
  type RichMarks,
  type RichValue,
} from '@/lib/richtext'
import {
  docFromDom,
  needsNormalize,
  renderDocInto,
  selectionOffsets,
  setSelectionOffsets,
  type WhoBadgeFor,
} from '@/lib/richdom'
import { FULL_ACCESS_ROLES, type Member } from '@/lib/types'

/**
 * Das Textfeld mit Formatierung – Tippen wie in jedem Feld, dazu ein kleines
 * Menü für Fett, Farben, Aufzählungen und die Zuordnung an eine Person.
 *
 * Es ist ein `contentEditable`, aber eines an kurzer Leine: Der Browser darf
 * tippen, löschen und Zeilen umbauen, wie er es gewohnt ist – nach jeder
 * Eingabe liest die Komponente den Stand zurück ins Modell (`lib/richdom`).
 * Eigene Handgriffe (eine Marke, ein Einzug, eine Erwähnung) rechnen auf dem
 * Modell und bauen das Feld neu auf, den Cursor an derselben Stelle. Im Feld
 * steht dadurch nie ein Steuerzeichen und nie ein `{Rot}` – man sieht genau,
 * was nachher dasteht.
 *
 * Gemeldet wird nach aussen das Paar aus Text und Formatfeld (`RichValue`):
 * Der Text bleibt das führende Feld und unverändert lesbar; wer keine
 * Formatierung setzt, speichert exakt dasselbe wie vor dieser Funktion.
 *
 * Das `@` öffnet die Mitgliederliste wie im `MentionField` – gleiche Tasten,
 * gleiches Bild. Ohne Auswahl wirkt eine Marke auf das Wort unter dem Cursor;
 * `Tab`/`Shift+Tab` rücken Listenpunkte ein und aus, `Ctrl+B` macht fett.
 */

/** Wie die Auswahl gerade aussieht – der Stand für das Menü. */
interface MenuState {
  marks: RichMarks
  list: { active: boolean; level: number }
  hasSelection: boolean
}

const EMPTY_MENU: MenuState = { marks: {}, list: { active: false, level: 0 }, hasSelection: false }

export function RichTextField({
  id,
  value,
  onChange,
  onMention,
  onBlur,
  onCaret,
  caret,
  singleLine = false,
  autoFocus = false,
  bare = false,
  minHeight,
  placeholder,
  className,
  wrapperClassName,
  'aria-label': ariaLabel,
}: {
  id: string
  value: RichValue
  onChange: (next: RichValue) => void
  /** Ein mit «@» gewähltes Mitglied – wird zusätzlich zum Text gemeldet */
  onMention?: (member: Member) => void
  /** Läuft nach dem Verlassen des Feldes – nie beim Griff ins Menü */
  onBlur?: () => void
  /** Wo der Cursor steht – Zeichenstellen im Bearbeitungstext */
  onCaret?: (start: number, end: number) => void
  /** Wohin der Cursor beim Erscheinen gehört; ohne Angabe ans Ende */
  caret?: { start: number; end: number } | null
  /** Eine Zeile, kein Enter, keine Listen – für Titel */
  singleLine?: boolean
  autoFocus?: boolean
  /** Ohne den `input`-Rahmen – für Felder, die nackt im Fenster stehen */
  bare?: boolean
  /** Mindesthöhe in Pixeln – so gross wie der Text, der vorher dastand */
  minHeight?: number
  placeholder?: string
  className?: string
  wrapperClassName?: string
  'aria-label'?: string
}) {
  const { members, users, usersById, membersById, personHue } = useData()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<RichDoc>(docOfValue(value))
  /** Der zuletzt selbst gemeldete Stand – nur Fremdes baut das Feld neu auf. */
  const emitted = useRef<string | null>(null)

  /*
   * Kürzel und Farbton einer zugeordneten Person – dieselbe Ableitung wie
   * beim Kreis mit den Initialen (`useUserAvatar`): vom verknüpften
   * Mitglied, sobald unter «Rollen» eines eingetragen ist. So trägt Alain
   * auch hier sein «AA» in Rot und Aaron sein «AR» in Violett.
   */
  const whoBadge = useCallback<WhoBadgeFor>(
    (uid) => {
      const user = usersById.get(uid)
      const member = user?.memberId ? membersById.get(user.memberId) : undefined
      const name = member
        ? `${member.firstName} ${member.lastName}`
        : (user?.displayName ?? 'Unbekannt')
      return { initials: getInitials(name), hue: personHue(uid) }
    },
    [usersById, membersById, personHue],
  )

  const [trigger, setTrigger] = useState<MentionTrigger | null>(null)
  const [active, setActive] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuOpenRef = useRef(false)
  const [menu, setMenu] = useState<MenuState>(EMPTY_MENU)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** Wo das Menü am Bildschirm steht – am Knopf ausgerichtet (siehe unten). */
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; maxHeight: number } | null>(
    null,
  )
  /*
   * Der Format-Knopf steht nur am Feld, in dem geschrieben wird: Im
   * Notizfenster sind Titel und Text zugleich bearbeitbar, und zwei Knöpfe
   * nebeneinander sagten zweimal dasselbe.
   */
  const [focused, setFocused] = useState(false)

  const signature = (next: RichValue) => `${next.rich ?? ''}\u0000${next.text}`

  /** Der Platzhalter braucht ein Zeichen am Feld, solange nichts drinsteht. */
  const updateEmpty = (root: HTMLElement, doc: RichDoc) => {
    if (editTextOf(doc) === '') root.setAttribute('data-rt-empty', 'true')
    else root.removeAttribute('data-rt-empty')
  }

  /*
   * Das Feld folgt dem Wert nur, wenn der Wert nicht vom Feld selbst stammt:
   * Während getippt wird, gehört das DOM dem Browser – es bei jeder eigenen
   * Meldung neu aufzubauen, risse den Cursor mitten aus dem Wort. Erst ein
   * fremder Stand (der Editor wurde mit anderem Inhalt neu bestückt) wird
   * gezeichnet.
   */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const sig = signature(value)
    if (emitted.current === sig) return
    emitted.current = sig
    const doc = docOfValue(value)
    docRef.current = doc
    renderDocInto(root, doc, { singleLine, whoBadge })
    updateEmpty(root, doc)
  })

  /*
   * Anwählen und den Cursor setzen – wie im `MentionField`: Es zählt der
   * Stand beim Erscheinen, danach gehört der Cursor dem Feld.
   */
  const startCaret = useRef(caret)
  useLayoutEffect(() => {
    if (!autoFocus) return
    const root = rootRef.current
    if (!root) return
    const length = editTextOf(docRef.current).length
    const from = Math.min(startCaret.current?.start ?? length, length)
    const to = Math.min(startCaret.current?.end ?? length, length)
    root.focus()
    setSelectionOffsets(root, from, to)
  }, [autoFocus])

  const emit = useCallback(
    (doc: RichDoc) => {
      docRef.current = doc
      const next = toRichValue(doc)
      emitted.current = signature(next)
      onChange(next)
    },
    [onChange],
  )

  /** Die Auswahl im Feld – ohne Auswahl das Feldende. */
  const currentSelection = (): { start: number; end: number } => {
    const root = rootRef.current
    const sel = root ? selectionOffsets(root) : null
    if (sel) return sel
    const length = editTextOf(docRef.current).length
    return { start: length, end: length }
  }

  const menuStateNow = (): MenuState => {
    const { start, end } = currentSelection()
    const doc = docRef.current
    return {
      marks: marksAt(doc, start, end),
      list: listStateAt(doc, start, end),
      hasSelection: start !== end,
    }
  }

  /** Cursor melden, Erwähnungs-Auslöser prüfen, Menüstand nachführen. */
  const report = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const sel = selectionOffsets(root)
    if (!sel) return
    onCaret?.(sel.start, sel.end)
    const editText = editTextOf(docRef.current)
    const nextTrigger = sel.start === sel.end ? findMentionTrigger(editText, sel.start) : null
    setTrigger((current) => {
      if (current?.start !== nextTrigger?.start || current?.query !== nextTrigger?.query) {
        setActive(0)
        return nextTrigger
      }
      return current
    })
    if (menuOpenRef.current) setMenu(menuStateNow())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCaret])

  // `selectionchange` ist das einzige Ereignis, das auch Pfeiltasten und
  // Griffe mit dem Finger meldet – es läuft am Dokument, nicht am Feld.
  useEffect(() => {
    const handler = () => {
      const root = rootRef.current
      const selection = window.getSelection()
      if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return
      report()
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [report])

  /**
   * Ein eigener Handgriff: Modell rechnen, Feld neu aufbauen, Cursor zurück.
   */
  const applyDoc = (doc: RichDoc, start: number, end: number) => {
    const root = rootRef.current
    if (!root) return
    const normal = normalizeDoc(doc)
    renderDocInto(root, normal, { singleLine, whoBadge })
    setSelectionOffsets(root, start, end)
    emit(normal)
    updateEmpty(root, normal)
    if (menuOpenRef.current) setMenu(menuStateNow())
    report()
  }

  /*
   * Läuft gerade eine Zeicheneingabe über mehrere Tasten (IME, Diktat,
   * Autokorrektur), darf das Feld nicht unter der Eingabe neu gezeichnet
   * werden – das risse die Komposition ab. Aufgeräumt wird dann, sobald
   * sie abgeschlossen ist.
   */
  const composing = useRef(false)

  const handleInput = () => {
    const root = rootRef.current
    if (!root) return
    const doc = docFromDom(root)

    // «- » am Zeilenanfang wird zur Aufzählung – die zwei Zeichen waren
    // Befehl, nicht Text (siehe `autoListBlock`).
    if (!singleLine && !composing.current) {
      const sel = selectionOffsets(root)
      if (sel && sel.start === sel.end) {
        const auto = autoListBlock(doc, sel.start)
        if (auto) {
          applyDoc(auto.doc, auto.caret, auto.caret)
          return
        }
      }
    }

    /*
     * Hat der Browser fremdes Markup eingesetzt – Chromes «wiederbelebter»
     * Tippstil nach dem Löschen formatierten Texts, das B/I/U einer
     * Auswahlleiste –, wird das Feld sofort aus dem Modell neu gezeichnet,
     * den Cursor an derselben Stelle. Der Parser hat solches Markup nicht
     * gelesen (siehe `lib/richdom`); neu Getipptes ist damit schlicht
     * unformatiert, statt eine geratene Farbe zu tragen.
     */
    if (!composing.current && needsNormalize(root)) {
      const sel = selectionOffsets(root)
      const caretNow = sel ?? { start: editTextOf(doc).length, end: editTextOf(doc).length }
      applyDoc(doc, caretNow.start, caretNow.end)
      return
    }

    emit(doc)
    updateEmpty(root, doc)
    report()
  }

  /**
   * Eine Marke setzen oder nehmen. Ohne Auswahl wirkt sie auf das Wort unter
   * dem Cursor – auf Weissraum bewirkt sie nichts.
   */
  const applyInline = (key: MarkKey, pick: (marks: RichMarks) => true | string | null) => {
    const doc = docRef.current
    let { start, end } = currentSelection()
    if (start === end) {
      const word = wordRangeAt(editTextOf(doc), start)
      if (!word) return
      start = word.start
      end = word.end
    }
    applyDoc(applyMark(doc, start, end, key, pick(marksAt(doc, start, end))), start, end)
  }

  const toggleBold = () => applyInline('b', (marks) => (marks.b ? null : true))
  const toggleItalic = () => applyInline('i', (marks) => (marks.i ? null : true))
  const toggleUnderline = () => applyInline('u', (marks) => (marks.u ? null : true))
  const setSize = (key: string | null) => applyInline('size', () => key)
  const setColor = (key: string | null) => applyInline('color', () => key)
  const setBg = (key: string | null) => applyInline('bg', () => key)
  const setWho = (uid: string | null) => applyInline('who', () => uid)

  const doToggleList = () => {
    const { start, end } = currentSelection()
    applyDoc(toggleList(docRef.current, start, end), start, end)
  }

  const doIndent = (delta: 1 | -1) => {
    const { start, end } = currentSelection()
    applyDoc(changeIndent(docRef.current, start, end, delta), start, end)
  }

  const doClear = () => {
    const doc = docRef.current
    let { start, end } = currentSelection()
    if (start === end) {
      const word = wordRangeAt(editTextOf(doc), start)
      if (!word) return
      start = word.start
      end = word.end
    }
    applyDoc(clearMarks(doc, start, end), start, end)
  }

  /* ---------------- Erwähnungen ---------------- */

  /*
   * Vorgeschlagen wird, wer aktiv ist – gefunden werden soll trotzdem jeder.
   *
   * Ohne Suchbegriff stehen die Aktiven da: Das ist die Liste, aus der man
   * gewöhnlich jemanden erwähnt. Sobald aber ein Name getippt wird, ist die
   * Frage eine andere – man meint diese eine Person, und ob sie als aktiv
   * geführt wird, ändert daran nichts. Wer nicht in der Vorauswahl steht,
   * kommt deshalb darunter, abgesetzt und als «inaktiv» gekennzeichnet.
   */
  const { results, firstOther } = useMemo(() => {
    if (!trigger) return { results: [] as Member[], firstOther: -1 }
    const query = trigger.query.trim()
    const active = members.filter((member) => member.status === 'active')
    if (!query) return { results: active.slice(0, 6), firstOther: -1 }

    const hit = (member: Member) => matchesSearch(`${member.firstName} ${member.lastName}`, query)
    const found = active.filter(hit).slice(0, 6)
    const others = members.filter((member) => member.status !== 'active' && hit(member)).slice(0, 4)

    return {
      results: [...found, ...others],
      firstOther: others.length > 0 ? found.length : -1,
    }
  }, [members, trigger])

  /** Den angefangenen `@Namen` durch den vollen Namen ersetzen. */
  const choose = (member: Member) => {
    if (!trigger) return
    const name = `${member.firstName} ${member.lastName}`
    const caretNow = currentSelection().start
    const { doc, caret: nextCaret } = replaceRange(docRef.current, trigger.start, caretNow, name)
    applyDoc(doc, nextCaret, nextCaret)
    onMention?.(member)
    setTrigger(null)
  }

  /* ---------------- Tasten ---------------- */

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (trigger && results.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((current) => (current + 1) % results.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((current) => (current - 1 + results.length) % results.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        choose(results[active])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setTrigger(null)
        return
      }
    }

    if (event.key === 'Escape' && menuOpenRef.current) {
      event.preventDefault()
      closeMenu()
      return
    }

    // Die drei Klassiker selbst übernehmen – der Browser soll kein eigenes
    // Markup einsetzen, das am Modell vorbeiginge.
    const meta = event.metaKey || event.ctrlKey
    if (meta && (event.key === 'b' || event.key === 'B')) {
      event.preventDefault()
      toggleBold()
      return
    }
    if (meta && (event.key === 'i' || event.key === 'I')) {
      event.preventDefault()
      toggleItalic()
      return
    }
    if (meta && (event.key === 'u' || event.key === 'U')) {
      event.preventDefault()
      toggleUnderline()
      return
    }

    if (event.key === 'Tab' && !singleLine) {
      const { start, end } = currentSelection()
      if (listStateAt(docRef.current, start, end).active) {
        event.preventDefault()
        doIndent(event.shiftKey ? -1 : 1)
        return
      }
    }

    if (event.key === 'Enter' && singleLine) event.preventDefault()
  }

  /*
   * Eingefügt wird als Text, nicht als fremdes HTML: Was aus Word oder einer
   * Webseite kommt, brächte Schriften, Farben und Tabellen mit, die das Feld
   * nicht kennt und das Modell wegwerfen müsste. Der Text erbt stattdessen
   * die Marken der Einfügestelle – wie weitergetippt.
   */
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    let text = event.clipboardData.getData('text/plain')
    if (!text) return
    text = text.replace(/\r\n?/g, '\n')
    if (singleLine) text = text.replace(/\n+/g, ' ')
    const { start, end } = currentSelection()
    const { doc, caret: nextCaret } = replaceRange(docRef.current, start, end, text)
    applyDoc(doc, nextCaret, nextCaret)
  }

  /* ---------------- Menü ---------------- */

  const closeMenu = () => {
    setMenuOpen(false)
    menuOpenRef.current = false
  }

  /**
   * Das Menü am Knopf ausrichten – als festes Element am Bildschirm.
   *
   * Es hängt bewusst **nicht** im Feld: Dort läge es innerhalb des
   * Rollbereichs eines Fensters, würde von dessen Fusszeile verdeckt und
   * machte den Inhalt höher – das Notizfeld bekäme eine Bildlaufleiste,
   * bloss weil ein Menü offen ist. Deshalb wird es wie das «Ansicht»-Menü
   * ans Ende des Dokuments gehängt (`createPortal`) und hier am Knopf
   * ausgerichtet; die Höhe endet am unteren Bildschirmrand, darüber hinaus
   * rollt es in sich.
   */
  const placeMenu = useCallback(() => {
    const button = buttonRef.current
    if (!button || !button.isConnected) {
      setMenuOpen(false)
      menuOpenRef.current = false
      return
    }
    const rect = button.getBoundingClientRect()
    const top = rect.bottom + 6
    setMenuPos({
      top,
      right: Math.max(8, window.innerWidth - rect.right),
      maxHeight: Math.max(160, Math.min(340, window.innerHeight - top - 12)),
    })
  }, [])

  const toggleMenu = () => {
    const next = !menuOpenRef.current
    menuOpenRef.current = next
    if (next) {
      setMenu(menuStateNow())
      placeMenu()
    }
    setMenuOpen(next)
  }

  // Rollt oder verändert sich die Seite hinter dem offenen Menü, folgt es
  // seinem Knopf – nur das Rollen im Menü selbst ist keine Bewegung der Seite.
  useEffect(() => {
    if (!menuOpen) return
    const follow = (event: Event) => {
      if (
        event.target instanceof Node &&
        panelRef.current &&
        panelRef.current.contains(event.target)
      ) {
        return
      }
      placeMenu()
    }
    window.addEventListener('resize', follow)
    document.addEventListener('scroll', follow, true)
    return () => {
      window.removeEventListener('resize', follow)
      document.removeEventListener('scroll', follow, true)
    }
  }, [menuOpen, placeMenu])

  // Wer im Menü etwas anklickt, soll die Auswahl im Feld behalten – deshalb
  // nimmt das ganze Menü den Fokus gar nicht erst an.
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault()

  const assignable = useMemo(
    () => users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role)),
    [users],
  )

  return (
    <div className={cn('relative', wrapperClassName)}>
      <div
        id={id}
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={trigger ? listId : undefined}
        data-placeholder={placeholder}
        spellCheck
        className={cn('rt-editor break-words whitespace-pre-wrap', !bare && 'input', className)}
        style={minHeight ? { minHeight } : undefined}
        onInput={handleInput}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
          handleInput()
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        // Hineingezogenes käme als fremdes HTML – dafür gilt dasselbe wie
        // beim Einfügen, nur dass sich der Weg nicht abfangen lässt.
        onDrop={(event) => event.preventDefault()}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false)
          window.setTimeout(() => {
            setTrigger(null)
            closeMenu()
          }, 150)
          if (!event.currentTarget.isConnected) return
          onBlur?.()
        }}
      />

      {/*
        Der Griff zum Formatieren – klein in der oberen Ecke des Feldes, und
        nur in dem Feld, in dem gerade geschrieben wird: Stehen Titel und
        Text zugleich im Schreibmodus (Notizfenster), zeigte sonst jedes
        Feld seinen eigenen Knopf. Der Griff auf den Knopf nimmt dem Feld
        den Fokus nicht weg (`onMouseDown`), deshalb bleibt er beim Klicken
        stehen.
      */}
      {(focused || menuOpen) && (
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={keepFocus}
          onClick={toggleMenu}
          aria-label="Text formatieren"
          aria-expanded={menuOpen}
          title="Formatieren"
          className={cn(
            'absolute top-1.5 right-1.5 z-10 rounded-full border p-1.5 shadow-sm transition',
            menuOpen
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-200'
              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <Type className="size-3.5" aria-hidden />
        </button>
      )}

      {menuOpen &&
        menuPos &&
        /*
         * Das Menü hängt am Dokument, nicht im Feld (siehe `placeMenu`), und
         * rollt für sich (`overscroll-contain`) – ein Blättern darin bewegt
         * weder das Feld noch das Fenster dahinter. Breit genug (`w-72`),
         * dass alle Farbpunkte innerhalb des Randes stehen; über dem
         * Fenster (`z-[60]`), damit keine Fusszeile es verdeckt.
         */
        createPortal(
          <div
            ref={panelRef}
            onMouseDown={keepFocus}
            style={{ top: menuPos.top, right: menuPos.right, maxHeight: menuPos.maxHeight }}
            className="fixed z-[60] w-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Die drei Klassiker nebeneinander – eine Zeile statt drei. Die
                Tastenkürzel (Ctrl+B/I/U) gelten weiterhin, nur unbeschriftet. */}
            <div className="flex gap-1 pb-1">
              <IconToggle
                icon={Bold}
                label="Fett"
                active={menu.marks.b === true}
                onClick={toggleBold}
              />
              <IconToggle
                icon={Italic}
                label="Kursiv"
                active={menu.marks.i === true}
                onClick={toggleItalic}
              />
              <IconToggle
                icon={Underline}
                label="Unterstrichen"
                active={menu.marks.u === true}
                onClick={toggleUnderline}
              />
            </div>

            <MenuLabel>Textgrösse</MenuLabel>
            {/* Vier feste Stufen, kein freies Mass – siehe `TEXT_SIZES`. Das
                «A» zeigt die Stufe; nochmaliges Antippen stellt auf Normal. */}
            <div className="flex items-end gap-1 pb-1">
              <SizeButton
                label="Klein"
                sample="text-xs"
                active={menu.marks.size === 's'}
                onClick={() => setSize(menu.marks.size === 's' ? null : 's')}
              />
              <SizeButton
                label="Normal"
                sample="text-sm"
                active={!menu.marks.size}
                onClick={() => setSize(null)}
              />
              <SizeButton
                label="Gross"
                sample="text-base"
                active={menu.marks.size === 'l'}
                onClick={() => setSize(menu.marks.size === 'l' ? null : 'l')}
              />
              <SizeButton
                label="Sehr gross"
                sample="text-lg"
                active={menu.marks.size === 'xl'}
                onClick={() => setSize(menu.marks.size === 'xl' ? null : 'xl')}
              />
            </div>

            <MenuLabel>Textfarbe</MenuLabel>
            <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1.5">
              {TEXT_COLORS.map((color) => (
                <ColorDot
                  key={color.key}
                  label={color.label}
                  dotClass={color.dot}
                  active={menu.marks.color === color.key}
                  onClick={() => setColor(menu.marks.color === color.key ? null : color.key)}
                />
              ))}
              <ClearDot label="Keine Textfarbe" onClick={() => setColor(null)} />
            </div>

            <MenuLabel>Hintergrund</MenuLabel>
            <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1.5">
              {BG_COLORS.map((color) => (
                <ColorDot
                  key={color.key}
                  label={color.label}
                  dotClass={color.dot}
                  active={menu.marks.bg === color.key}
                  onClick={() => setBg(menu.marks.bg === color.key ? null : color.key)}
                />
              ))}
              <ClearDot label="Kein Hintergrund" onClick={() => setBg(null)} />
            </div>

            {!singleLine && (
              <>
                <Divider />
                <MenuRow
                  icon={<List className="size-4" aria-hidden />}
                  label="Aufzählung"
                  active={menu.list.active}
                  onClick={doToggleList}
                />
                <div className="flex gap-1 px-1 pb-1">
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => doIndent(1)}
                    disabled={!menu.list.active}
                    className="btn-ghost flex-1 justify-center gap-1.5 px-2 py-1.5 text-xs disabled:opacity-40"
                  >
                    <IndentIncrease className="size-4" aria-hidden />
                    Einrücken
                  </button>
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => doIndent(-1)}
                    disabled={!menu.list.active}
                    className="btn-ghost flex-1 justify-center gap-1.5 px-2 py-1.5 text-xs disabled:opacity-40"
                  >
                    <IndentDecrease className="size-4" aria-hidden />
                    Ausrücken
                  </button>
                </div>
              </>
            )}

            {assignable.length > 0 && (
              <>
                <Divider />
                <MenuLabel>Person zuordnen</MenuLabel>
                {assignable.map((user) => (
                  <MenuRow
                    key={user.id}
                    // Der Kreis des Kontos – Kürzel und Farbe vom verknüpften
                    // Mitglied, wie überall sonst in der App.
                    icon={<UserAvatar userId={user.id} size="xs" />}
                    label={user.displayName}
                    active={menu.marks.who === user.id}
                    onClick={() => setWho(menu.marks.who === user.id ? null : user.id)}
                  />
                ))}
                {menu.marks.who && (
                  <MenuRow
                    icon={<Ban className="size-4" aria-hidden />}
                    label="Zuordnung entfernen"
                    onClick={() => setWho(null)}
                  />
                )}
              </>
            )}

            <Divider />
            <MenuRow
              icon={<RemoveFormatting className="size-4" aria-hidden />}
              label="Formatierung entfernen"
              onClick={doClear}
            />

            {!menu.hasSelection && (
              <p className="px-2 pt-1 pb-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                Ohne Auswahl wirkt alles auf das Wort unter dem Cursor.
              </p>
            )}
          </div>,
          document.body,
        )}

      {trigger && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {results.map((member, index) => (
            <Fragment key={member.id}>
              {index === firstOther && (
                <li
                  role="presentation"
                  className="mt-1 border-t border-dashed border-slate-300 px-3 pt-1.5 pb-0.5 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400"
                >
                  Weitere Treffer ausserhalb der Vorauswahl
                </li>
              )}
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(member)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                    index === active
                      ? 'bg-slate-100 dark:bg-slate-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/60',
                  )}
                >
                  <Avatar
                    name={`${member.firstName} ${member.lastName}`}
                    id={member.id}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {member.firstName} {member.lastName}
                  </span>
                  {member.status !== 'active' && (
                    <span className="shrink-0 text-xs text-slate-400">inaktiv</span>
                  )}
                </button>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Menü-Bausteine                                                      */
/* ------------------------------------------------------------------ */

function MenuRow({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700/60"
    >
      <span className="flex w-5 justify-center text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <Check className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />}
    </button>
  )
}

/**
 * Eine Grössenstufe – ein «A» in ebendieser Grösse, der Name als Beschriftung.
 * Die Schlüssel dahinter stehen in `TEXT_SIZES` (`lib/richtext`).
 */
function SizeButton({
  label,
  sample,
  active,
  onClick,
}: {
  label: string
  /** Klasse für die Grösse des «A» im Knopf */
  sample: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={`Textgrösse ${label}`}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex flex-1 items-end justify-center rounded-lg px-1 pt-0.5 pb-1 leading-none transition',
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60',
      )}
    >
      <span className={cn('font-medium', sample)} aria-hidden>
        A
      </span>
    </button>
  )
}

/** Ein Knopf der B/I/U-Zeile – nur das Zeichen, der Name als Beschriftung. */
function IconToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex flex-1 items-center justify-center rounded-lg py-1.5 transition',
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="my-1.5 border-t border-slate-200 dark:border-slate-700" />
}

function ColorDot({
  label,
  dotClass,
  active,
  onClick,
}: {
  label: string
  dotClass: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-700/60',
        active && 'ring-brand-500 ring-2 ring-offset-1 dark:ring-offset-slate-800',
      )}
    >
      <span className={cn('size-3.5 rounded-full', dotClass)} aria-hidden />
    </button>
  )
}

function ClearDot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700/60 dark:hover:text-slate-300"
    >
      <Ban className="size-3.5" aria-hidden />
    </button>
  )
}

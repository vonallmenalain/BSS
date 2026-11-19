import {
  HYMN_SLOT_LABELS,
  isTalkPlaceholder,
  TALK_KIND_LABELS,
  type HymnChoice,
  type Talk,
  type TalkKind,
} from './types.ts'

/**
 * Der Teil zwischen Abendmahl und Schlusslied: Ansprachen, Zeugnisse,
 * Zwischenlied und Musikeinlagen.
 *
 * Hier steht nur das Ordnen – ohne Firestore, damit es sich prüfen lässt.
 * Geschrieben wird in `services/sacrament`.
 */

/** Nur die Felder des Programms, die für die Reihenfolge zählen. */
export interface ProgramSource {
  hymns?: { intermediate?: HymnChoice }
  musicalNumbers?: { id: string; title: string }[]
  programOrder?: string[]
}

export type ProgramEntryKind = 'talk' | 'testimony' | 'hymn' | 'music'

export interface ProgramEntry {
  /** Stabiler Schlüssel, z. B. «talk:abc123», «slot:2» oder «hymn:intermediate» */
  key: string
  kind: ProgramEntryKind
  /** Art des Punktes: «Ansprache», «Schlussansprache», «Zwischenlied» … */
  label: string
  /** Wer bzw. was – Name der Person oder Titel des Liedes; leer heisst «offen» */
  title: string
  detail?: string
  /** Noch unvollständig (offener Platz, Lied ohne Nummer) */
  incomplete?: boolean
  /** Ansprache oder Zeugnis: das Dokument in `talks`, falls der Platz vergeben ist */
  talkId?: string
  /** Ansprache oder Zeugnis: Position im Programm – dieselbe wie unter «Ansprachen» */
  slot?: number
}

export function programKey(kind: 'talk' | 'music' | 'hymn', id: string): string {
  return `${kind}:${id}`
}

/** Schlüssel eines noch nicht vergebenen Programmplatzes. */
export function openSlotKey(slot: number): string {
  return `slot:${slot}`
}

function isOpenSlotKey(key: string): boolean {
  return key.startsWith('slot:')
}

/**
 * Steht an diesem Schlüssel eine Ansprache – vergeben oder noch offen?
 *
 * Beide zählen gleich viel: Ein offener Platz ist im Ablauf eine Zeile wie
 * jede andere, und ein Zwischenlied lässt sich davor oder dahinter schieben.
 */
function isTalkPosition(key: string): boolean {
  return key.startsWith('talk:') || isOpenSlotKey(key)
}

/** Der nächste freie Programmplatz – Lücken werden zuerst gefüllt. */
export function nextTalkSlot(talks: Talk[]): number {
  const taken = new Set(talks.map((talk) => talk.slot))
  let slot = 1
  while (taken.has(slot)) slot++
  return slot
}

/* ------------------------------------------------------------------ */
/* Die Plätze eines Sonntags                                           */
/* ------------------------------------------------------------------ */

/** Eine Zeile im Ansprachenteil eines Sonntags – vergeben oder noch offen. */
export interface TalkPosition {
  /** Die Nummer, unter der die Zeile steht – unter «Ansprachen» wie unter «Leitung». */
  position: number
  /** `null` heisst: Der Platz ist vorgesehen, aber noch nicht vergeben. */
  talk: Talk | null
  /** Über die vorgesehene Anzahl hinaus – ein Zusatzpunkt */
  extra: boolean
}

/** Wann ein Eintrag erfasst wurde – ein noch unterwegs befindlicher gilt als jüngster. */
function createdMillis(talk: Talk): number {
  const value = talk.createdAt as unknown
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'seconds' in value) {
    const { seconds, nanoseconds } = value as { seconds: number; nanoseconds?: number }
    return seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1e6)
  }
  return Number.MAX_SAFE_INTEGER
}

function storedSlot(talk: Talk): number {
  return Number.isFinite(talk.slot) && talk.slot >= 1 ? talk.slot : Number.MAX_SAFE_INTEGER
}

/** Gespeicherte Position, dann wer zuerst da war – auf jedem Gerät dieselbe Folge. */
function compareTalks(a: Talk, b: Talk): number {
  return (
    storedSlot(a) - storedSlot(b) ||
    createdMillis(a) - createdMillis(b) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/**
 * Die Plätze eines Sonntags, wie sie **beide** Seiten zeigen.
 *
 * Grundlage ist die gespeicherte Position (`slot`). Auf sie allein ist aber
 * kein Verlass: Wurde beim Zuteilen das Datum gewechselt, ohne die Position
 * nachzuführen, oder haben zwei Geräte gleichzeitig eingetragen, stehen zwei
 * Ansprachen auf derselben Nummer. «Ansprachen» zeigte pro Nummer bisher nur
 * die erste, «Leitung» dagegen alle – der Sonntag hatte dort vier Personen
 * und hier zwei, während der Kopf «4 ohne Zusage» meldete.
 *
 * Deshalb geht keine Ansprache verloren: Wer auf einer schon belegten Nummer
 * steht, rückt hinter die vorige. Bei gleicher Nummer entscheidet, wer
 * zuerst erfasst war.
 *
 * Offene Plätze gibt es nur innerhalb der vorgesehenen Anzahl – eine Lücke
 * dort ist ein Platz, für den noch jemand gesucht wird. Dahinter rücken die
 * Zusatzpunkte lückenlos zusammen: Eine Lücke jenseits der vorgesehenen
 * Anzahl wäre ein Platz, den niemand vorgesehen hat.
 */
export function talkPositions(talks: Talk[], planned: number): TalkPosition[] {
  const placed = new Map<number, Talk>()
  let previous = 0

  for (const talk of [...talks].sort(compareTalks)) {
    const wanted = talk.slot >= 1 && talk.slot <= planned ? talk.slot : planned + 1
    const position = Math.max(previous + 1, wanted)
    placed.set(position, talk)
    previous = position
  }

  return Array.from({ length: Math.max(planned, previous) }, (_, index) => ({
    position: index + 1,
    talk: placed.get(index + 1) ?? null,
    extra: index + 1 > planned,
  }))
}

/**
 * Wie viele der vorgesehenen Plätze sind noch offen?
 *
 * Ein Platzhalter – ein eingetragener Punkt, zu dem noch niemand feststeht –
 * zählt weiterhin als offen. Zusatzpunkte zählen nicht: Sie sind freiwillig.
 */
export function countOpenPositions(rows: TalkPosition[]): number {
  return rows.filter((row) => !row.extra && (!row.talk || isTalkPlaceholder(row.talk))).length
}

/** Der Platz, den eine neue Ansprache bekommt: der erste offene, sonst hinten angehängt. */
export function nextOpenPosition(talks: Talk[], planned: number): number {
  const rows = talkPositions(talks, planned)
  return rows.find((row) => !row.talk)?.position ?? rows.length + 1
}

/**
 * Schreibt eine Folge von Plätzen als Positionen 1, 2, 3 … zurück.
 *
 * Geliefert wird nur, was sich ändert. Weil dabei immer die ganze Folge
 * durchnummeriert wird, verschwinden doppelt belegte Nummern beim ersten
 * Handgriff am betroffenen Sonntag von selbst.
 */
function renumber(sequence: (Talk | null)[]): { id: string; slot: number }[] {
  const updates: { id: string; slot: number }[] = []
  sequence.forEach((talk, index) => {
    if (talk && talk.slot !== index + 1) updates.push({ id: talk.id, slot: index + 1 })
  })
  return updates
}

/**
 * Eine neue Ansprache an einer bestimmten Position.
 *
 * Ist die Position frei, kommt sie genau dorthin. Ist sie belegt, rücken die
 * Folgenden eine Position nach hinten – bis zum nächsten offenen Platz, der
 * dabei aufgefüllt wird. Zwei Ansprachen auf derselben Nummer entstehen so
 * nicht mehr.
 */
export function planTalkInsert(
  talks: Talk[],
  planned: number,
  position: number,
): { slot: number; slots: { id: string; slot: number }[] } {
  const sequence: (Talk | null | 'new')[] = talkPositions(talks, planned).map((row) => row.talk)
  const index = Math.min(Math.max(Math.round(position) - 1, 0), sequence.length)
  sequence.splice(index, 0, 'new')

  // Der nächste offene Platz dahinter nimmt auf, was nachrückt.
  const free = sequence.findIndex((entry, at) => at > index && entry === null)
  if (free !== -1) sequence.splice(free, 1)

  return {
    slot: index + 1,
    slots: renumber(sequence.map((entry) => (entry === 'new' ? null : entry))),
  }
}

/** Ein Platz eine Position weiter vor oder zurück – offene Plätze ziehen mit. */
export function planTalkMove(
  talks: Talk[],
  planned: number,
  position: number,
  delta: number,
): { id: string; slot: number }[] {
  const sequence = talkPositions(talks, planned).map((row) => row.talk)
  const index = position - 1
  const target = index + delta
  if (index < 0 || index >= sequence.length || target < 0 || target >= sequence.length) return []
  ;[sequence[index], sequence[target]] = [sequence[target], sequence[index]]
  return renumber(sequence)
}

/**
 * Einen offenen Platz streichen – die dahinterliegenden rücken auf.
 *
 * Ein offener Platz liegt immer innerhalb der vorgesehenen Anzahl; sie wird
 * deshalb um eins kleiner. Ein vergebener Platz lässt sich so nicht
 * streichen – das ist «Entfernen» an der Ansprache selbst.
 */
export function planRemoveOpenPosition(
  talks: Talk[],
  planned: number,
  position: number,
): { planned: number; slots: { id: string; slot: number }[] } | null {
  const sequence = talkPositions(talks, planned).map((row) => row.talk)
  const index = position - 1
  if (index < 0 || index >= sequence.length || sequence[index] !== null) return null
  sequence.splice(index, 1)
  return { planned: Math.max(0, planned - 1), slots: renumber(sequence) }
}

/**
 * Wie viele Plätze vorgesehen sind, wenn ein leerer dazukommt.
 *
 * Gezählt wird ab dem letzten belegten Platz: Bei drei vergebenen Ansprachen
 * und zwei vorgesehenen Plätzen käme sonst kein freier Platz dazu – die Zahl
 * stiege auf drei, und zu sehen wäre nichts.
 */
export function plannedAfterAdding(talks: Talk[], planned: number): number {
  return talkPositions(talks, planned).length + 1
}

/**
 * Setzt den Programmteil zusammen.
 *
 * **Reihenfolge der Ansprachen** ergibt sich immer aus `talkPositions` –
 * genau daraus baut auch die Seite «Ansprachen» ihre Liste; damit können die
 * beiden Ansichten gar nicht auseinanderlaufen. Noch nicht vergebene Plätze
 * stehen als offene Punkte an ihrer Position mit drin.
 *
 * **Reihenfolge von Zwischenlied und Musikeinlagen** steht in `programOrder`;
 * daraus wird gelesen, nach wie vielen Ansprachenplätzen ein Punkt folgt –
 * offene Plätze zählen wie vergebene. Ist dazu nichts hinterlegt, steht er vor
 * der Schlussansprache – das ist der Normalfall: eine Ansprache, das
 * Zwischenlied, die Schlussansprache.
 */
export function buildProgram(
  meeting: ProgramSource | null,
  talks: Talk[],
  hymnTitle: (choice: HymnChoice | undefined) => string,
  plannedTalks = 0,
): ProgramEntry[] {
  /* --- Ansprachen und Zeugnisse, vergeben wie offen ------------------ */
  // Dieselben Plätze wie unter «Ansprachen» – siehe `talkPositions`.
  const sequence: ProgramEntry[] = talkPositions(talks, plannedTalks).map(({ position, talk }) => {
    if (!talk) {
      return {
        key: openSlotKey(position),
        kind: 'talk',
        label: TALK_KIND_LABELS.talk,
        title: '',
        incomplete: true,
        slot: position,
      }
    }
    const kind: TalkKind = talk.kind ?? 'talk'
    return {
      key: programKey('talk', talk.id),
      kind,
      label: TALK_KIND_LABELS[kind],
      // Ein Platzhalter steht mit seiner Art im Ablauf, aber ohne Namen –
      // wie ein offener Platz, nur dass er schon ein Zeugnis sein kann.
      title: talk.memberName?.trim() ?? '',
      detail: talk.topic,
      incomplete: isTalkPlaceholder(talk),
      talkId: talk.id,
      slot: position,
    }
  })

  // Die letzte Ansprache ist die Schlussansprache. Ein Zeugnis behält seine
  // Bezeichnung – es wird nicht als Ansprache angekündigt.
  const last = sequence[sequence.length - 1]
  if (sequence.length > 1 && last.kind === 'talk') last.label = 'Schlussansprache'

  /* --- Zwischenlied und Musikeinlagen -------------------------------- */
  const extras: ProgramEntry[] = []

  const intermediate = meeting?.hymns?.intermediate
  if (intermediate) {
    // Ein eben erst angelegtes Zwischenlied hat noch keine Nummer. Es gehört
    // trotzdem in den Ablauf – sonst wäre nicht zu sehen, dass es fehlt.
    const blank = !intermediate.number && !intermediate.title
    extras.push({
      key: programKey('hymn', 'intermediate'),
      kind: 'hymn',
      label: HYMN_SLOT_LABELS.intermediate,
      title: blank ? '' : hymnTitle(intermediate),
      incomplete: !intermediate.number,
    })
  }

  ;(meeting?.musicalNumbers ?? []).forEach((number) => {
    extras.push({
      key: programKey('music', number.id),
      kind: 'music',
      label: 'Musikeinlage',
      title: number.title,
      incomplete: !number.title,
    })
  })

  if (extras.length === 0) return sequence

  /* --- Einfügen ------------------------------------------------------ */
  const order = meeting?.programOrder ?? []
  const rank = new Map<string, number>()
  order.forEach((key, index) => {
    if (!rank.has(key)) rank.set(key, index)
  })

  /**
   * Nach wie vielen Ansprachenplätzen steht dieser Punkt?
   *
   * Gezählt werden **alle** Plätze, vergebene wie offene. Zählte man nur die
   * vergebenen, liesse sich ein Punkt an einem offenen Platz nicht
   * vorbeischieben: Sind an einem Sonntag noch alle Plätze offen, ergäbe jede
   * Reihenfolge dieselbe Null – das Zwischenlied bliebe vorne kleben, ganz
   * gleich, wohin es geschoben wurde.
   *
   * Weil `sequence` genau aus diesen Plätzen besteht, ist die Zahl zugleich
   * die Stelle, an der der Punkt einzufügen ist.
   */
  const talksBefore = (key: string): number | null => {
    const index = rank.get(key)
    if (index === undefined) return null
    let count = 0
    for (let i = 0; i < index; i++) if (isTalkPosition(order[i])) count++
    return Math.min(count, sequence.length)
  }

  const fallback = sequence.length > 1 ? sequence.length - 1 : sequence.length

  const placed = extras
    .map((entry, natural) => {
      const before = talksBefore(entry.key)
      return {
        entry,
        at: before ?? fallback,
        rank: rank.get(entry.key) ?? Number.MAX_SAFE_INTEGER,
        natural,
      }
    })
    .sort((a, b) => a.at - b.at || a.rank - b.rank || a.natural - b.natural)

  const result: ProgramEntry[] = []
  let next = 0
  for (let i = 0; i <= sequence.length; i++) {
    while (next < placed.length && placed[next].at === i) result.push(placed[next++].entry)
    if (i < sequence.length) result.push(sequence[i])
  }
  while (next < placed.length) result.push(placed[next++].entry)

  return result
}

/**
 * Was eine neue Reihenfolge nach sich zieht.
 *
 * Die Reihenfolge steht zweimal: im Ablauf als `programOrder` und bei den
 * Ansprachen als Position (`slot`). Beide müssen zusammen nachgeführt werden,
 * sonst zeigte «Ansprachen» eine andere Folge als «Leitung».
 *
 * Offene Programmplätze zählen als Position mit und bleiben im gespeicherten
 * Schlüsselband stehen – auf ihre neue Nummer umgeschrieben. Sie wegzulassen
 * wäre naheliegend, ihre Nummer ergibt sich ja aus den vergebenen Plätzen;
 * dann fehlte aber genau die Angabe, ob ein Zwischenlied vor oder nach einem
 * offenen Platz steht. Ein noch unbesetzter Sonntag liesse sich gar nicht
 * ordnen.
 */
export function planProgramOrder(
  keys: string[],
  talks: Talk[],
): { order: string[]; slots: { id: string; slot: number }[] } {
  const byKey = new Map(talks.map((talk) => [programKey('talk', talk.id), talk]))
  const order: string[] = []
  const slots: { id: string; slot: number }[] = []
  let position = 0

  for (const key of keys) {
    if (isOpenSlotKey(key)) {
      position++
      order.push(openSlotKey(position))
      continue
    }
    order.push(key)
    const talk = byKey.get(key)
    if (!talk) continue
    position++
    if (talk.slot !== position) slots.push({ id: talk.id, slot: position })
  }

  return { order, slots }
}

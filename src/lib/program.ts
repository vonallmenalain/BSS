import {
  HYMN_SLOT_LABELS,
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

/**
 * Setzt den Programmteil zusammen.
 *
 * **Reihenfolge der Ansprachen** ergibt sich immer aus ihrer Position
 * (`slot`). Genau danach ordnet auch die Seite «Ansprachen»; damit können die
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
  const sequence: ProgramEntry[] = []
  const taken = new Set<number>()

  talks.forEach((talk) => {
    taken.add(talk.slot)
    const kind: TalkKind = talk.kind ?? 'talk'
    sequence.push({
      key: programKey('talk', talk.id),
      kind,
      label: TALK_KIND_LABELS[kind],
      title: talk.memberName,
      detail: talk.topic,
      talkId: talk.id,
      slot: talk.slot,
    })
  })

  for (let slot = 1; slot <= plannedTalks; slot++) {
    if (taken.has(slot)) continue
    sequence.push({
      key: openSlotKey(slot),
      kind: 'talk',
      label: TALK_KIND_LABELS.talk,
      title: '',
      incomplete: true,
      slot,
    })
  }

  sequence.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))

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

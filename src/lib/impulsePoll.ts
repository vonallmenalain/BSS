import type { ImpulsePoll } from './types.ts'

/*
 * Die eigene Antwort in der Umfrage – alles, was sich ohne Datenbank
 * rechnen lässt: wie ein Freitext aufgeräumt und verglichen wird und wie
 * die Stimmen samt den hinzugefügten Antworten ausgezählt werden.
 *
 * Neben den vorgegebenen Möglichkeiten darf bei einer Auswahl jede und
 * jeder eine eigene Antwort hinzufügen; sie ist zugleich die eigene
 * Stimme, und die anderen können sie danach ebenfalls wählen. Gespeichert
 * wird dafür nichts Neues: Die Stimme liegt wie jede andere in
 * `impulseAnswers` (eine je Person, die ID erzwingt es), nur steht statt
 * `choiceIndex` der Text in `text`. **Wer für eine hinzugefügte Antwort
 * stimmt, schreibt denselben Text** – die Antwort ist also keine eigene
 * Zeile mit Urheberin, sondern die Summe aller Stimmen mit diesem Text.
 * So braucht es weder eine neue Sammlung noch eine neue Zugriffsregel, und
 * die Antwort lebt weiter, auch wenn die erste Stimme dafür wegfällt (etwa
 * beim Zurücksetzen einer einzelnen Person).
 *
 * Gleiches zählt als eines: Verglichen wird über `pollTextKey` – ohne
 * Gross/klein, Leerzeichen und Satzzeichen. «Nein, danke!» und «nein
 * danke» sind dieselbe Antwort, und wer genau eine vorgegebene
 * Möglichkeit eintippt, stimmt für sie.
 *
 * Geprüft in `tests/impulse-poll.test.ts`.
 */

/**
 * So lang darf eine eigene Antwort sein – etwa doppelt so lang wie die
 * längsten vorgegebenen («Kurz erklären, warum ich das nicht mache»).
 * Länger wäre keine Möglichkeit mehr, sondern ein Beitrag.
 */
export const POLL_CUSTOM_MAX = 80

/**
 * So viele hinzugefügte Antworten zeigt die Karte, bevor «weitere» sie
 * einklappt – mit den vorgegebenen bleibt sie so am Telefon überschaubar.
 */
export const POLL_CUSTOM_SHOWN = 3

/**
 * Darf bei dieser Umfrage eine eigene Antwort dazukommen? Nur bei der
 * Auswahl – eine Skala hat keine Möglichkeiten, zu denen etwas passte.
 * Fehlt der Schalter (alle Umfragen von vor der Einführung), gilt «ja».
 */
export function pollAllowsCustom(poll: Pick<ImpulsePoll, 'form' | 'allowCustom'>): boolean {
  return poll.form === 'choice' && poll.allowCustom !== false
}

/**
 * Eine eigene Antwort, wie sie gespeichert und gezeigt wird: eine Zeile,
 * ohne doppelte Leerzeichen, höchstens `POLL_CUSTOM_MAX` Zeichen.
 *
 * Auch beim Lesen angewandt: Die Zugriffsregeln prüfen die Länge nicht
 * (siehe docs/KONZEPT-IMPULS.md, 13.9) – wer an der App vorbei einen
 * Roman schreibt, bekommt trotzdem nur eine Zeile auf die Karte.
 */
export function cleanPollText(raw: string): string {
  const flat = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  // Nach Zeichen statt nach UTF-16-Einheiten gekürzt – ein Emoji am Ende
  // zerfällt sonst in ein halbes.
  const chars = Array.from(flat)
  return chars.length > POLL_CUSTOM_MAX ? chars.slice(0, POLL_CUSTOM_MAX).join('').trim() : flat
}

/**
 * Der Vergleichsschlüssel einer Antwort: klein geschrieben, ohne
 * Leerzeichen, Satzzeichen und unsichtbare Zeichen, «ß» als «ss».
 *
 * Bewusst grosszügig: «Nein, danke!», «nein danke» und «Neindanke» sind
 * eins – zwei verschiedene Antworten, die sich nur darin unterscheiden,
 * gibt es nicht. Umlaute bleiben dagegen stehen («schön» ist nicht
 * «schon»), Emoji auch. Ist der Schlüssel leer (nur «???»), taugt der
 * Text nicht als Antwort.
 */
export function pollTextKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-CH')
    .replace(/ß/g, 'ss')
    .replace(/[\p{P}\p{Z}\s\p{Cf}︀-️]/gu, '')
}

/** Taugt der Text als eigene Antwort – steht nach dem Aufräumen noch etwas da? */
export function pollTextUsable(raw: string): boolean {
  return pollTextKey(cleanPollText(raw)) !== ''
}

/**
 * Was eine Stimme festhält: bei einer vorgegebenen Möglichkeit deren
 * Index, bei einer hinzugefügten Antwort ihr Text.
 */
export type ImpulsePollReply = { choiceIndex: number } | { text: string }

/** Eine Stimme, wie sie die Auszählung braucht – ein Ausschnitt von `ImpulseAnswer`. */
export interface PollVote {
  choiceIndex?: number | null
  text?: string | null
  answeredAt?: { toMillis(): number } | null
}

/** Wofür eine Stimme zählt: eine vorgegebene Möglichkeit oder eine hinzugefügte Antwort. */
export type PollChoice = { kind: 'option'; index: number } | { kind: 'custom'; key: string }

/** Die Schlüssel der vorgegebenen Möglichkeiten – bei Gleichen gilt die erste. */
function optionKeys(poll: Pick<ImpulsePoll, 'options'>): Map<string, number> {
  const keys = new Map<string, number>()
  poll.options.forEach((option, index) => {
    const key = pollTextKey(option)
    if (key && !keys.has(key)) keys.set(key, index)
  })
  return keys
}

function choiceOf(
  poll: Pick<ImpulsePoll, 'form' | 'options'>,
  vote: PollVote,
  keys: Map<string, number>,
): PollChoice | null {
  if (poll.form !== 'choice') return null
  const index = vote.choiceIndex
  if (typeof index === 'number') {
    return Number.isInteger(index) && index >= 0 && index < poll.options.length
      ? { kind: 'option', index }
      : null
  }
  const key = pollTextKey(cleanPollText(vote.text ?? ''))
  if (!key) return null
  const option = keys.get(key)
  return option === undefined ? { kind: 'custom', key } : { kind: 'option', index: option }
}

/**
 * Wofür eine Stimme zählt – oder `null`, wenn sie in keinen Rahmen passt
 * (ein Index jenseits der Möglichkeiten, ein leerer Text). Ein Text, der
 * einer vorgegebenen Möglichkeit gleicht, zählt für diese.
 */
export function pollVoteChoice(
  poll: Pick<ImpulsePoll, 'form' | 'options'>,
  vote: PollVote,
): PollChoice | null {
  return choiceOf(poll, vote, optionKeys(poll))
}

/** Eine feste Kennung je Möglichkeit – «o:2» bzw. «c:neindanke». */
export function pollChoiceId(choice: PollChoice): string {
  return choice.kind === 'option' ? `o:${choice.index}` : `c:${choice.key}`
}

/** Eine Zeile des Ergebnisses. */
export interface PollRow {
  /** `pollChoiceId` – bei hinzugefügten Antworten «c:» und der Schlüssel. */
  id: string
  /** Von jemandem hinzugefügt, nicht von der Redaktion vorgegeben. */
  custom: boolean
  /** Bei vorgegebenen Möglichkeiten der Index, sonst `null`. */
  index: number | null
  label: string
  count: number
  /** Anteil an allen gezählten Stimmen, 0 bis 1 – bei nicht gezählten 0. */
  share: number
  /** Von der Redaktion ausgeblendet (`hiddenPollAnswers`). */
  hidden: boolean
  /** Zählt mit – alles ausser Ausgeblendetem, die eigene Wahl immer. */
  counted: boolean
}

export interface PollTally {
  /** Die vorgegebenen Möglichkeiten, in ihrer Reihenfolge. */
  options: PollRow[]
  /** Die hinzugefügten Antworten, geordnet nach `order`. */
  custom: PollRow[]
  /** Alle gezählten Stimmen. */
  total: number
  /** Stimmen für Ausgeblendetes, die nicht mitzählen. */
  hiddenVotes: number
}

/**
 * Die Auszählung einer Auswahl – vorgegebene Möglichkeiten und
 * hinzugefügte Antworten zusammen, nur Zahlen, keine Namen.
 *
 * - **Gleiches zählt als eines** (`pollTextKey`). Gezeigt wird der Text
 *   der ersten Stimme dafür: So steht die Antwort so da, wie sie
 *   hinzugefügt wurde, und springt nicht, wenn jemand sie anders tippt.
 * - **Ausgeblendetes zählt nicht** (`hidden`, die Texte aus
 *   `hiddenPollAnswers`): Es fällt aus Zeilen und Gesamtzahl. Nur die
 *   eigene Wahl (`reveal`) bleibt für die Person selbst stehen – still,
 *   wie bei der Rangliste: Die anderen sehen sie nicht mehr, sie selbst
 *   wird nicht vorgeführt. Die Redaktion sieht Ausgeblendetes als solches
 *   (`showHidden`), sonst könnte sie es nicht wieder zeigen.
 * - **Reihenfolge** der hinzugefügten Antworten: `votes` nach Stimmen
 *   (fürs Ergebnis), `added` in der Reihenfolge des Hinzufügens (vor der
 *   eigenen Stimme – dort verriete eine Rangfolge schon das Ergebnis, und
 *   die Liste spränge unter dem Finger, sobald jemand abstimmt).
 *
 * Wie bei `pollResults` fällt eine Stimme ausserhalb des Rahmens still
 * heraus. Für die Skala gibt es nichts hinzuzufügen – dort bleibt es bei
 * `pollResults`.
 */
export function tallyPollChoices(
  poll: Pick<ImpulsePoll, 'form' | 'options'>,
  votes: readonly PollVote[],
  settings: {
    hidden?: readonly string[] | null
    reveal?: string | null
    showHidden?: boolean
    order?: 'votes' | 'added'
  } = {},
): PollTally {
  const keys = optionKeys(poll)
  const hiddenKeys = new Set(
    (settings.hidden ?? []).map((text) => pollTextKey(cleanPollText(text))).filter(Boolean),
  )
  const optionCounts = poll.options.map(() => 0)
  const groups = new Map<string, { count: number; label: string; at: number }>()

  for (const vote of votes) {
    const choice = choiceOf(poll, vote, keys)
    if (!choice) continue
    if (choice.kind === 'option') {
      optionCounts[choice.index] += 1
      continue
    }
    const at = vote.answeredAt?.toMillis() ?? Number.MAX_SAFE_INTEGER
    const label = cleanPollText(vote.text ?? '')
    const group = groups.get(choice.key)
    if (!group) {
      groups.set(choice.key, { count: 1, label, at })
      continue
    }
    group.count += 1
    if (at < group.at || (at === group.at && label.localeCompare(group.label, 'de') < 0)) {
      group.at = at
      group.label = label
    }
  }

  const addedAt = new Map<string, number>()
  const customAll: PollRow[] = [...groups].map(([key, group]) => {
    const id = `c:${key}`
    const hidden = hiddenKeys.has(key)
    addedAt.set(id, group.at)
    return {
      id,
      custom: true,
      index: null,
      label: group.label,
      count: group.count,
      share: 0,
      hidden,
      counted: !hidden || id === settings.reveal,
    }
  })

  const sum = (counts: number[]) => counts.reduce((all, count) => all + count, 0)
  const total =
    sum(optionCounts) + sum(customAll.filter((row) => row.counted).map((row) => row.count))
  const hiddenVotes = sum(customAll.filter((row) => !row.counted).map((row) => row.count))
  const share = (count: number) => (total > 0 ? count / total : 0)

  const byAdded = (a: PollRow, b: PollRow) =>
    (addedAt.get(a.id) ?? 0) - (addedAt.get(b.id) ?? 0) || a.label.localeCompare(b.label, 'de')
  const custom = customAll
    .filter((row) => row.counted || settings.showHidden === true)
    .sort((a, b) =>
      settings.order === 'added'
        ? byAdded(a, b)
        : Number(b.counted) - Number(a.counted) || b.count - a.count || byAdded(a, b),
    )
    .map((row) => ({ ...row, share: row.counted ? share(row.count) : 0 }))

  return {
    options: poll.options.map((label, index) => ({
      id: `o:${index}`,
      custom: false,
      index,
      label,
      count: optionCounts[index],
      share: share(optionCounts[index]),
      hidden: false,
      counted: true,
    })),
    custom,
    total,
    hiddenVotes,
  }
}

/** Was ein eingetippter Text trifft: eine vorgegebene Möglichkeit oder eine schon hinzugefügte Antwort. */
export type PollTextMatch =
  { kind: 'option'; index: number; label: string } | { kind: 'custom'; row: PollRow }

/**
 * Gibt es den Text schon? Für den Hinweis unter dem Eingabefeld («Gibt es
 * schon – deine Stimme zählt dort»). `custom` sind die hinzugefügten
 * Antworten, die die Person sieht.
 */
export function matchPollText(
  poll: Pick<ImpulsePoll, 'form' | 'options'>,
  raw: string,
  custom: readonly PollRow[],
): PollTextMatch | null {
  const key = pollTextKey(cleanPollText(raw))
  if (!key) return null
  const index = optionKeys(poll).get(key)
  if (index !== undefined) return { kind: 'option', index, label: poll.options[index] }
  const row = custom.find((entry) => entry.id === `c:${key}`)
  return row ? { kind: 'custom', row } : null
}

/**
 * Die Stimme zu einer eingetippten Antwort – `null`, wenn der Text nicht
 * taugt. Trifft er eine vorgegebene Möglichkeit, ist es eine Stimme für
 * sie; trifft er eine sichtbare hinzugefügte Antwort, wird deren Text
 * übernommen (gezählt würde sie ohnehin dort – so steht sie nur einmal
 * und in einer Schreibweise da).
 */
export function resolvePollReply(
  poll: Pick<ImpulsePoll, 'form' | 'options'>,
  raw: string,
  custom: readonly PollRow[],
): ImpulsePollReply | null {
  const text = cleanPollText(raw)
  if (!pollTextKey(text)) return null
  const match = matchPollText(poll, text, custom)
  if (match?.kind === 'option') return { choiceIndex: match.index }
  if (match?.kind === 'custom' && !match.row.hidden) return { text: match.row.label }
  return { text }
}

/**
 * Welche Zeilen eine eingeklappte Liste zeigt: die ersten `max` – und die
 * eigene Wahl immer, auch wenn sie weiter hinten liegt. Bliebe genau eine
 * übrig, steht sie gleich mit da: Ein Knopf «1 weitere» wäre grösser als
 * die Zeile selbst.
 */
export function pollRowsShown<T extends { id: string }>(
  rows: readonly T[],
  max: number,
  keepId?: string | null,
): { shown: T[]; more: number } {
  if (rows.length <= max + 1) return { shown: [...rows], more: 0 }
  const shown = rows.slice(0, Math.max(0, max))
  const keep = keepId ? rows.find((row) => row.id === keepId) : undefined
  if (keep && !shown.includes(keep)) shown.push(keep)
  return { shown, more: rows.length - shown.length }
}

/**
 * Die Einträge in `hiddenPollAnswers`, die zum Text gehören – beim
 * Wiederzeigen fallen alle Schreibweisen weg, nicht nur die eine.
 */
export function pollHiddenEntries(hidden: readonly string[], text: string): string[] {
  const key = pollTextKey(cleanPollText(text))
  return key ? hidden.filter((entry) => pollTextKey(cleanPollText(entry)) === key) : []
}

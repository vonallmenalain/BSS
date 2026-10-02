// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`) – und damit es der Versand (`netlify/functions`) so
// bündeln kann, wie es hier steht.
import type { ApActivity, AppUser } from './types.ts'

/**
 * Wer an einem Termin des Aktivitätenplans beteiligt ist.
 *
 * Der Plan führt die Leute als Freitext – «Carden», «JM», «Br. Meier &
 * Br. Huber» –, so wie die Excel-Tabelle der Bischofschaft sie seit Jahren
 * führt und wie sie eingelesen wird. Ein Konto kennt der Plan nicht. Die
 * Brücke schlägt das Konto selbst: Es trägt die Namen, unter denen die
 * Person im Plan steht (`AppUser.apNames`). Steht einer davon in einem der
 * drei Personenfelder, ist sie beteiligt.
 *
 * Verglichen wird **wortweise und ohne Gross-/Kleinschreibung**: «Josh»
 * trifft «Josh M.» und «Carden & Josh», nicht aber «Joshua». Ein ganzes
 * Wort und nicht bloss ein Stück davon – sonst fände «Jo» die halbe
 * Gemeinde.
 *
 * Ohne Firestore und ohne Browser: Dieselben Funktionen beschriften in der
 * App die Einstellungen und entscheiden im Versand, wer erinnert wird.
 */

/** Die Felder, in denen jemand an einem Termin eingetragen ist. */
export const AP_PERSON_FIELDS = ['leader', 'bishopric', 'advisor'] as const

export type ApPersonField = (typeof AP_PERSON_FIELDS)[number]

export const AP_PERSON_FIELD_LABELS: Record<ApPersonField, string> = {
  leader: 'Zuständig',
  bishopric: 'Bischofschaft',
  advisor: 'Berater',
}

/** Mehr Namen trägt niemand – die Grenze hält bloss Versehen klein. */
export const AP_NAMES_MAX = 8

/** Ein Name, wie er verglichen wird – klein geschrieben, ohne doppelte Leerzeichen. */
export function normalizePlanName(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('de-CH').replace(/\s+/g, ' ').trim()
}

/**
 * Die Namen aus einem Eingabefeld – getrennt durch Komma oder Strichpunkt.
 *
 * Doppelte fallen weg (ohne Rücksicht auf Gross-/Kleinschreibung), die
 * Schreibweise des ersten bleibt.
 */
export function parsePlanNames(input: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const part of input.split(/[,;\n]/)) {
    const name = part.replace(/\s+/g, ' ').trim()
    const key = normalizePlanName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names.slice(0, AP_NAMES_MAX)
}

/** Die Namen fürs Eingabefeld – «Carden, JM». */
export function formatPlanNames(names: readonly string[] | null | undefined): string {
  return (names ?? []).join(', ')
}

const WORD_CHAR = /[\p{L}\p{N}]/u

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char)
}

/**
 * Steht dieser Name in diesem Feld – als ganzes Wort oder als ganze
 * Wortfolge?
 */
export function mentionsName(field: string | null | undefined, name: string): boolean {
  const haystack = normalizePlanName(field ?? '')
  const needle = normalizePlanName(name)
  if (!needle || !haystack) return false

  for (
    let index = haystack.indexOf(needle);
    index >= 0;
    index = haystack.indexOf(needle, index + 1)
  ) {
    const before = haystack[index - 1]
    const after = haystack[index + needle.length]
    if (!isWordChar(before) && !isWordChar(after)) return true
  }
  return false
}

type PersonFields = Partial<Pick<ApActivity, ApPersonField>>

/** In welchen Feldern dieses Termins einer der Namen steht. */
export function involvedFields(activity: PersonFields, names: readonly string[]): ApPersonField[] {
  return AP_PERSON_FIELDS.filter((field) =>
    names.some((name) => mentionsName(activity[field], name)),
  )
}

/** Ist jemand mit diesen Namen an diesem Termin beteiligt? */
export function apInvolves(activity: PersonFields, names: readonly string[]): boolean {
  return involvedFields(activity, names).length > 0
}

/**
 * Die Konten, die an diesem Termin beteiligt sind – je mit den Feldern, in
 * denen sie stehen.
 *
 * Für den Hinweis im Formular: Wer «Carden» als zuständig einträgt, sieht
 * gleich, ob dahinter ein Konto steht, das erinnert werden kann.
 */
export function linkedAccounts<T extends Pick<AppUser, 'id' | 'displayName' | 'apNames'>>(
  activity: PersonFields,
  users: readonly T[],
): { user: T; fields: ApPersonField[] }[] {
  return users.flatMap((user) => {
    const fields = involvedFields(activity, user.apNames ?? [])
    return fields.length > 0 ? [{ user, fields }] : []
  })
}

/**
 * Die einzelnen Namen, die im Plan vorkommen – die häufigsten zuerst.
 *
 * Als Vorschläge fürs Eingabefeld. Ein Feld wie «Carden & Josh» ergibt
 * zwei Vorschläge: Gemeint ist ja je eine Person.
 */
export function planNameSuggestions(activities: readonly PersonFields[]): string[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const activity of activities) {
    for (const field of AP_PERSON_FIELDS) {
      for (const part of (activity[field] ?? '').split(/\s*(?:[,;&/+]|\bund\b)\s*/i)) {
        const name = part.replace(/\s+/g, ' ').trim()
        const key = normalizePlanName(name)
        if (!key) continue
        const known = counts.get(key)
        if (known) known.count++
        else counts.set(key, { name, count: 1 })
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de-CH'))
    .map((entry) => entry.name)
}

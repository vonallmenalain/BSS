/** Klassennamen zusammensetzen und Falsy-Werte verwerfen. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Kurze, eindeutige ID für Array-Elemente (Notizen, Verlaufseinträge). */
export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** «Alain von Allmen» → «AV» */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Normalisiert Text für Suche: Kleinbuchstaben, Umlaute und Akzente aufgelöst. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .trim()
}

/** Prüft, ob alle Suchbegriffe irgendwo im Text vorkommen (Reihenfolge egal). */
export function matchesSearch(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true
  const text = normalize(haystack)
  return normalize(needle)
    .split(/\s+/)
    .every((term) => text.includes(term))
}

/** Stabile Farbe aus einem String ableiten – gleicher Name, gleiche Farbe. */
const AVATAR_COLORS = [
  'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
]

export function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Text auf eine Maximallänge kürzen, ohne Wörter zu zerschneiden. */
export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`
}

/** Elemente nach einem Schlüssel gruppieren. */
export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

/** `undefined`-Felder entfernen – Firestore lehnt sie ab. */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Wartet, bis der Nutzer aufgehört hat zu tippen. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Schweizer Telefonnummern lesbar formatieren: «079 123 45 67» */
export function formatPhone(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/[^\d+]/g, '')
  const local = digits.startsWith('+41') ? `0${digits.slice(3)}` : digits
  if (/^0\d{9}$/.test(local)) {
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
  }
  return phone
}

/** Wandelt eine Telefonnummer in ein `tel:`-Ziel um. */
export function telHref(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

/** Sortiervergleich für deutsche Namen (Umlaute korrekt einsortiert). */
const collator = new Intl.Collator('de-CH', { sensitivity: 'base', numeric: true })
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

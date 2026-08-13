import {
  Bookmark,
  CheckCircle2,
  Flame,
  History,
  LayoutList,
  Lightbulb,
  MessagesSquare,
  Repeat,
  Search,
  Send,
  type LucideIcon,
} from 'lucide-react'
import type { ImpulseItem } from './types.ts'

/*
 * Die Bereiche des Impuls – das Inhaltsverzeichnis der «App in der App».
 *
 * Der Einstieg ist ein Dashboard aus Kacheln; jede Kachel öffnet ihren
 * Bereich im Vollbild (`/impuls/:bereich`). Damit Kachel, Vollbild und
 * Wechsler dieselbe Sprache sprechen, steht hier alles an einem Ort:
 * Slug, Name, Icon – und die Farbe, die dem Bereich sein eigenes Thema
 * gibt. Die Klassen sind ausgeschriebene Zeichenketten, keine gebauten:
 * Tailwind sammelt Klassennamen aus dem Quelltext ein und würde
 * zusammengesetzte nie finden.
 */

export type ImpulseSectionKey =
  | 'woche'
  | 'quiz'
  | 'ziel'
  | 'challenge'
  | 'frage'
  | 'feed'
  | 'fortschritt'
  | 'gemerkt'
  | 'wochen'
  | 'mitmachen'

export interface ImpulseSection {
  key: ImpulseSectionKey
  label: string
  /** Für die Chip-Leiste am unteren Rand – ein Wort, mehr passt nicht. */
  short: string
  icon: LucideIcon
  /** Icon-Kachel: satte Fläche, weisses Zeichen – die Farbe des Bereichs. */
  iconBox: string
  /** Akzent für Text und Zeichen im Thema des Bereichs. */
  text: string
  /** Der Farbschleier hinter dem Vollbild – oben getönt, unten still. */
  wash: string
  /** Der aktive Chip im Bereichswechsler. */
  chipActive: string
  /** Balken und Ringe – `currentColor` holt sich diesen Ton. */
  ring: string
  /** Gefüllte Fortschrittsfläche (Balken, Punkte). */
  bar: string
}

/*
 * Zehn Bereiche, zehn Farbtöne – bewusst weit auseinander, damit die
 * Farbe allein schon sagt, wo man ist. Die Vollbild-Töne sind Schleier
 * (klein dosiert, oben im Bild), keine Vollflächen: farbig, ohne zu
 * schreien – und im Dunkelmodus gedimmt statt grell.
 */
export const IMPULSE_SECTIONS: Record<ImpulseSectionKey, ImpulseSection> = {
  woche: {
    key: 'woche',
    label: 'Wochenimpuls',
    short: 'Impuls',
    icon: Lightbulb,
    iconBox: 'bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
    wash: 'from-amber-200/70 dark:from-amber-500/15',
    chipActive: 'bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-950',
    ring: 'text-amber-500 dark:text-amber-400',
    bar: 'bg-amber-500 dark:bg-amber-400',
  },
  quiz: {
    key: 'quiz',
    label: 'Quizfrage',
    short: 'Quiz',
    icon: Search,
    iconBox: 'bg-violet-500 text-white',
    text: 'text-violet-700 dark:text-violet-300',
    wash: 'from-violet-200/70 dark:from-violet-500/15',
    chipActive: 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950',
    ring: 'text-violet-500 dark:text-violet-400',
    bar: 'bg-violet-500 dark:bg-violet-400',
  },
  ziel: {
    key: 'ziel',
    label: 'Wochenziel',
    short: 'Ziel',
    icon: CheckCircle2,
    iconBox: 'bg-emerald-500 text-white',
    text: 'text-emerald-700 dark:text-emerald-300',
    wash: 'from-emerald-200/70 dark:from-emerald-500/15',
    chipActive: 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950',
    ring: 'text-emerald-500 dark:text-emerald-400',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
  },
  challenge: {
    key: 'challenge',
    label: 'Tages-Challenge',
    short: 'Challenge',
    icon: Repeat,
    iconBox: 'bg-sky-500 text-white',
    text: 'text-sky-700 dark:text-sky-300',
    wash: 'from-sky-200/70 dark:from-sky-500/15',
    chipActive: 'bg-sky-600 text-white dark:bg-sky-400 dark:text-sky-950',
    ring: 'text-sky-500 dark:text-sky-400',
    bar: 'bg-sky-500 dark:bg-sky-400',
  },
  frage: {
    key: 'frage',
    label: 'Frage der Woche',
    short: 'Frage',
    icon: MessagesSquare,
    iconBox: 'bg-rose-500 text-white',
    text: 'text-rose-700 dark:text-rose-300',
    wash: 'from-rose-200/70 dark:from-rose-500/15',
    chipActive: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
    ring: 'text-rose-500 dark:text-rose-400',
    bar: 'bg-rose-500 dark:bg-rose-400',
  },
  feed: {
    key: 'feed',
    label: 'Impuls-Feed',
    short: 'Feed',
    icon: LayoutList,
    iconBox: 'bg-indigo-500 text-white',
    text: 'text-indigo-700 dark:text-indigo-300',
    wash: 'from-indigo-200/70 dark:from-indigo-500/15',
    chipActive: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950',
    ring: 'text-indigo-500 dark:text-indigo-400',
    bar: 'bg-indigo-500 dark:bg-indigo-400',
  },
  fortschritt: {
    key: 'fortschritt',
    label: 'Mein Fortschritt',
    short: 'Fortschritt',
    icon: Flame,
    iconBox: 'bg-orange-500 text-white',
    text: 'text-orange-700 dark:text-orange-300',
    wash: 'from-orange-200/70 dark:from-orange-500/15',
    chipActive: 'bg-orange-600 text-white dark:bg-orange-400 dark:text-orange-950',
    ring: 'text-orange-500 dark:text-orange-400',
    bar: 'bg-orange-500 dark:bg-orange-400',
  },
  gemerkt: {
    key: 'gemerkt',
    label: 'Gemerkt',
    short: 'Gemerkt',
    icon: Bookmark,
    iconBox: 'bg-teal-500 text-white',
    text: 'text-teal-700 dark:text-teal-300',
    wash: 'from-teal-200/70 dark:from-teal-500/15',
    chipActive: 'bg-teal-600 text-white dark:bg-teal-400 dark:text-teal-950',
    ring: 'text-teal-500 dark:text-teal-400',
    bar: 'bg-teal-500 dark:bg-teal-400',
  },
  wochen: {
    key: 'wochen',
    label: 'Frühere Wochen',
    short: 'Rückblick',
    icon: History,
    iconBox: 'bg-slate-500 text-white',
    text: 'text-slate-600 dark:text-slate-300',
    wash: 'from-slate-300/60 dark:from-slate-500/15',
    chipActive: 'bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-950',
    ring: 'text-slate-500 dark:text-slate-400',
    bar: 'bg-slate-500 dark:bg-slate-400',
  },
  mitmachen: {
    key: 'mitmachen',
    label: 'Mitmach-Ecke',
    short: 'Mitmachen',
    icon: Send,
    iconBox: 'bg-fuchsia-500 text-white',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    wash: 'from-fuchsia-200/70 dark:from-fuchsia-500/15',
    chipActive: 'bg-fuchsia-600 text-white dark:bg-fuchsia-400 dark:text-fuchsia-950',
    ring: 'text-fuchsia-500 dark:text-fuchsia-400',
    bar: 'bg-fuchsia-500 dark:bg-fuchsia-400',
  },
}

/** Die Reihenfolge im Dashboard und im Bereichswechsler – Lesereihenfolge. */
export const IMPULSE_SECTION_ORDER: ImpulseSectionKey[] = [
  'woche',
  'quiz',
  'ziel',
  'challenge',
  'frage',
  'feed',
  'fortschritt',
  'gemerkt',
  'wochen',
  'mitmachen',
]

/*
 * Seit dem Stapel-Umbau zerfallen die Bereiche in zwei Sorten:
 *
 * **Stapel-Bereiche** sind die Inhalte der Woche – sie liegen als Karten
 * im Wischstapel auf der Hauptseite, eine Karte pro Inhalt, und die
 * Adresse `/impuls/<bereich>` springt im Stapel dorthin. **Raum-Bereiche**
 * öffnen weiterhin ihren eigenen Vollbild-Raum (Fortschritt, Gemerkt,
 * Rückblick, Mitmach-Ecke) – sie sind Werkzeuge, keine Wochenkarten.
 */
export const IMPULSE_DECK_SECTIONS = [
  'woche',
  'quiz',
  'ziel',
  'challenge',
  'frage',
  'feed',
] as const
export type ImpulseDeckSectionKey = (typeof IMPULSE_DECK_SECTIONS)[number]

export const IMPULSE_ROOM_SECTIONS = ['fortschritt', 'gemerkt', 'wochen', 'mitmachen'] as const
export type ImpulseRoomSectionKey = (typeof IMPULSE_ROOM_SECTIONS)[number]

/** Liegt der Bereich als Karte im Wischstapel? */
export function isDeckSection(key: ImpulseSectionKey): key is ImpulseDeckSectionKey {
  return (IMPULSE_DECK_SECTIONS as readonly string[]).includes(key)
}

/** Öffnet der Bereich einen Vollbild-Raum? */
export function isRoomSection(key: ImpulseSectionKey): key is ImpulseRoomSectionKey {
  return (IMPULSE_ROOM_SECTIONS as readonly string[]).includes(key)
}

/** Welcher Stapel-Bereich einen Inhalt dieser Art zeigt. */
export const IMPULSE_KIND_SECTION: Record<ImpulseItem['kind'], ImpulseDeckSectionKey> = {
  impuls: 'woche',
  quiz: 'quiz',
  wochenziel: 'ziel',
  tageschallenge: 'challenge',
  frage: 'frage',
  feed: 'feed',
}

/** Ist der Routenteil ein Bereich? – `/impuls/quatsch` soll sauber zurückführen. */
export function isImpulseSection(slug: string | undefined): slug is ImpulseSectionKey {
  return typeof slug === 'string' && slug in IMPULSE_SECTIONS
}

/**
 * Wohin eine gemerkte Karte zurückführt: in den Bereich, in dem sie
 * gemerkt wurde. Heute kommt Gemerktes nur aus dem Feed; die übrigen
 * Arten stehen trotzdem da, damit ein künftiges «Merken» anderswo nicht
 * ins Leere greift – Inhalte vergangener Wochen führen in den Rückblick.
 */
export function sectionForItem(item: ImpulseItem, todayKey: string): ImpulseSectionKey {
  if (item.kind === 'feed') return 'feed'
  if (item.week !== todayKey) return 'wochen'
  switch (item.kind) {
    case 'impuls':
      return 'woche'
    case 'quiz':
      return 'quiz'
    case 'wochenziel':
      return 'ziel'
    case 'tageschallenge':
      return 'challenge'
    case 'frage':
      return 'frage'
    default:
      return 'woche'
  }
}

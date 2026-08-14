import {
  Bookmark,
  CheckCircle2,
  Flame,
  HeartHandshake,
  History,
  LayoutList,
  Lightbulb,
  MessagesSquare,
  PlayCircle,
  Puzzle,
  Repeat,
  Search,
  Send,
  type LucideIcon,
} from 'lucide-react'
import type { ImpulseItem, ImpulseKind } from './types.ts'

/*
 * Die Bereiche von «Anti Doom» – das Inhaltsverzeichnis der «App in der App».
 *
 * Der Einstieg ist das Dashboard: das Wochenthema gross im Zentrum, die
 * Werkzeuge als Kacheln darunter. Ein Tipp auf das Wochenthema öffnet
 * den Vollbild-Feed (`/anti-doom/:bereich`), die Kacheln öffnen ihre Räume.
 * Damit Dashboard, Vollbild und Menü dieselbe Sprache sprechen, steht
 * hier alles an einem Ort: Slug, Name, Icon – und die Farbe, die dem
 * Bereich sein eigenes Thema gibt. Die Klassen sind ausgeschriebene
 * Zeichenketten, keine gebauten: Tailwind sammelt Klassennamen aus dem
 * Quelltext ein und würde zusammengesetzte nie finden.
 */

export type ImpulseSectionKey =
  | 'woche'
  | 'quiz'
  | 'bilderraetsel'
  | 'video'
  | 'frage'
  | 'feed'
  | 'teilen'
  | 'ziel'
  | 'challenge'
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
 * Dreizehn Bereiche, dreizehn Farbtöne – bewusst weit auseinander, damit
 * die Farbe allein schon sagt, wo man ist.
 *
 * Die Vollbild-Töne sind Schleier, keine Vollflächen: Sie steigen oben
 * satt ein, laufen über eine Zwischenstufe aus und enden im Grund der
 * App – im Hellen also Farbe ins Weiss, im Dunkeln Farbe ins Schwarz.
 * Seit die Karten ohne Kachel dastehen, trägt dieser Verlauf das Bild
 * allein; darum ist er kräftiger als früher.
 */
export const IMPULSE_SECTIONS: Record<ImpulseSectionKey, ImpulseSection> = {
  woche: {
    key: 'woche',
    label: 'Wochenthema',
    short: 'Thema',
    icon: Lightbulb,
    iconBox: 'bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
    wash: 'from-amber-300/90 via-amber-200/40 dark:from-amber-500/40 dark:via-amber-500/12',
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
    wash: 'from-violet-300/90 via-violet-200/40 dark:from-violet-500/40 dark:via-violet-500/12',
    chipActive: 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950',
    ring: 'text-violet-500 dark:text-violet-400',
    bar: 'bg-violet-500 dark:bg-violet-400',
  },
  bilderraetsel: {
    key: 'bilderraetsel',
    label: 'Bilderrätsel',
    short: 'Rätsel',
    icon: Puzzle,
    iconBox: 'bg-lime-600 text-white',
    text: 'text-lime-700 dark:text-lime-300',
    wash: 'from-lime-300/90 via-lime-200/40 dark:from-lime-500/40 dark:via-lime-500/12',
    chipActive: 'bg-lime-600 text-white dark:bg-lime-400 dark:text-lime-950',
    ring: 'text-lime-600 dark:text-lime-400',
    bar: 'bg-lime-600 dark:bg-lime-400',
  },
  video: {
    key: 'video',
    label: 'Video',
    short: 'Video',
    icon: PlayCircle,
    iconBox: 'bg-red-500 text-white',
    text: 'text-red-700 dark:text-red-300',
    wash: 'from-red-300/90 via-red-200/40 dark:from-red-500/40 dark:via-red-500/12',
    chipActive: 'bg-red-600 text-white dark:bg-red-400 dark:text-red-950',
    ring: 'text-red-500 dark:text-red-400',
    bar: 'bg-red-500 dark:bg-red-400',
  },
  frage: {
    key: 'frage',
    label: 'Frage der Woche',
    short: 'Frage',
    icon: MessagesSquare,
    iconBox: 'bg-rose-500 text-white',
    text: 'text-rose-700 dark:text-rose-300',
    wash: 'from-rose-300/90 via-rose-200/40 dark:from-rose-500/40 dark:via-rose-500/12',
    chipActive: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
    ring: 'text-rose-500 dark:text-rose-400',
    bar: 'bg-rose-500 dark:bg-rose-400',
  },
  feed: {
    key: 'feed',
    label: 'Feed',
    short: 'Feed',
    icon: LayoutList,
    iconBox: 'bg-indigo-500 text-white',
    text: 'text-indigo-700 dark:text-indigo-300',
    wash: 'from-indigo-300/90 via-indigo-200/40 dark:from-indigo-500/40 dark:via-indigo-500/12',
    chipActive: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950',
    ring: 'text-indigo-500 dark:text-indigo-400',
    bar: 'bg-indigo-500 dark:bg-indigo-400',
  },
  teilen: {
    key: 'teilen',
    label: 'Teilen',
    short: 'Teilen',
    icon: HeartHandshake,
    iconBox: 'bg-cyan-600 text-white',
    text: 'text-cyan-700 dark:text-cyan-300',
    wash: 'from-cyan-300/90 via-cyan-200/40 dark:from-cyan-500/40 dark:via-cyan-500/12',
    chipActive: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950',
    ring: 'text-cyan-600 dark:text-cyan-400',
    bar: 'bg-cyan-600 dark:bg-cyan-400',
  },
  ziel: {
    key: 'ziel',
    label: 'Wochenziel',
    short: 'Ziel',
    icon: CheckCircle2,
    iconBox: 'bg-emerald-500 text-white',
    text: 'text-emerald-700 dark:text-emerald-300',
    wash: 'from-emerald-300/90 via-emerald-200/40 dark:from-emerald-500/40 dark:via-emerald-500/12',
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
    wash: 'from-sky-300/90 via-sky-200/40 dark:from-sky-500/40 dark:via-sky-500/12',
    chipActive: 'bg-sky-600 text-white dark:bg-sky-400 dark:text-sky-950',
    ring: 'text-sky-500 dark:text-sky-400',
    bar: 'bg-sky-500 dark:bg-sky-400',
  },
  fortschritt: {
    key: 'fortschritt',
    label: 'Mein Fortschritt',
    short: 'Fortschritt',
    icon: Flame,
    iconBox: 'bg-orange-500 text-white',
    text: 'text-orange-700 dark:text-orange-300',
    wash: 'from-orange-300/90 via-orange-200/40 dark:from-orange-500/40 dark:via-orange-500/12',
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
    wash: 'from-teal-300/90 via-teal-200/40 dark:from-teal-500/40 dark:via-teal-500/12',
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
    wash: 'from-slate-300/80 via-slate-200/40 dark:from-slate-500/35 dark:via-slate-500/10',
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
    wash: 'from-fuchsia-300/90 via-fuchsia-200/40 dark:from-fuchsia-500/40 dark:via-fuchsia-500/12',
    chipActive: 'bg-fuchsia-600 text-white dark:bg-fuchsia-400 dark:text-fuchsia-950',
    ring: 'text-fuchsia-500 dark:text-fuchsia-400',
    bar: 'bg-fuchsia-500 dark:bg-fuchsia-400',
  },
}

/** Die Reihenfolge im Menü und im Bereichswechsler – Lesereihenfolge. */
export const IMPULSE_SECTION_ORDER: ImpulseSectionKey[] = [
  'woche',
  'quiz',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
  'ziel',
  'challenge',
  'fortschritt',
  'gemerkt',
  'wochen',
  'mitmachen',
]

/*
 * Die Bereiche zerfallen in zwei Sorten:
 *
 * **Feed-Bereiche** sind die Karten des Vollbild-Feeds – eine Karte pro
 * Inhalt, das Wochenthema immer zuoberst, und die Adresse
 * `/anti-doom/<bereich>` schlägt den Feed genau dort auf. **Raum-Bereiche**
 * öffnen ihren eigenen Vollbild-Raum: die beiden Aufgaben neben dem Feed
 * (Wochenziel, Tages-Challenge) und die Werkzeuge (Fortschritt, Gemerkt,
 * Rückblick, Mitmach-Ecke) – sie sind Kacheln des Dashboards, keine
 * Feed-Karten.
 */
export const IMPULSE_DECK_SECTIONS = [
  'woche',
  'quiz',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
] as const
export type ImpulseDeckSectionKey = (typeof IMPULSE_DECK_SECTIONS)[number]

export const IMPULSE_ROOM_SECTIONS = [
  'ziel',
  'challenge',
  'fortschritt',
  'gemerkt',
  'wochen',
  'mitmachen',
] as const
export type ImpulseRoomSectionKey = (typeof IMPULSE_ROOM_SECTIONS)[number]

/** Liegt der Bereich als Karte im Vollbild-Feed? */
export function isDeckSection(key: ImpulseSectionKey): key is ImpulseDeckSectionKey {
  return (IMPULSE_DECK_SECTIONS as readonly string[]).includes(key)
}

/** Öffnet der Bereich einen Vollbild-Raum? */
export function isRoomSection(key: ImpulseSectionKey): key is ImpulseRoomSectionKey {
  return (IMPULSE_ROOM_SECTIONS as readonly string[]).includes(key)
}

/**
 * Die Inhaltsarten, die als Karten im Vollbild-Feed liegen – in der
 * Lesereihenfolge des Feeds: das Wochenthema zuerst, die Rätsel gleich
 * nach dem Quiz, dann das Video als Wechsel des Takts, und die
 * Teilen-Aufgabe als Einladung zum Schluss.
 */
export const IMPULSE_DECK_KINDS = [
  'impuls',
  'quiz',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
] as const
export type ImpulseDeckKind = (typeof IMPULSE_DECK_KINDS)[number]

/** Liegt ein Inhalt dieser Art als Karte im Vollbild-Feed? */
export function isDeckKind(kind: ImpulseKind): kind is ImpulseDeckKind {
  return (IMPULSE_DECK_KINDS as readonly string[]).includes(kind)
}

/** Welcher Feed-Bereich einen Inhalt dieser Art zeigt. */
export const IMPULSE_KIND_SECTION: Record<ImpulseDeckKind, ImpulseDeckSectionKey> = {
  impuls: 'woche',
  quiz: 'quiz',
  bilderraetsel: 'bilderraetsel',
  video: 'video',
  frage: 'frage',
  feed: 'feed',
  teilen: 'teilen',
}

/**
 * Die Farb- und Zeichenwelt **jeder** Kartenart – auch der beiden, die
 * sonst Kacheln sind (Wochenziel, Tages-Challenge). Redaktion und
 * Vorschau beschriften damit ihre Gruppen und Karten.
 */
export const IMPULSE_KIND_THEME: Record<ImpulseKind, ImpulseSectionKey> = {
  ...IMPULSE_KIND_SECTION,
  wochenziel: 'ziel',
  tageschallenge: 'challenge',
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
    case 'bilderraetsel':
      return 'bilderraetsel'
    case 'video':
      return 'video'
    case 'wochenziel':
      return 'ziel'
    case 'tageschallenge':
      return 'challenge'
    case 'frage':
      return 'frage'
    case 'teilen':
      return 'teilen'
    default:
      return 'woche'
  }
}

import {
  Anchor,
  BookOpen,
  Compass,
  Crown,
  Flag,
  Flame,
  Footprints,
  Heart,
  KeyRound,
  Landmark,
  Mountain,
  ShieldCheck,
  Star,
  Sun,
  Sword,
  TreePine,
  type LucideIcon,
} from 'lucide-react'
import type { ImpulseCrest, ImpulseCrestPalette, ImpulseCrestSymbol } from './types.ts'

/*
 * Farben, Zeichen und Rechnung des Wochen-Wappens (`ImpulseCrest`).
 *
 * Hier statt in der Komponente, weil mehrere Orte sie brauchen – das
 * Dashboard nimmt die Farben der Woche für seinen Schein, die Seite
 * leitet das Wappen einer Woche ohne eigene Angaben ab – und weil sich
 * so prüfen lässt, wann ein Wappen ganz dasteht.
 */

interface CrestColors {
  deep: string
  mid: string
  light: string
  glow: string
}

/* Echte Farbwerte statt Klassen: SVG-Verläufe brauchen sie, und die
   Töne sollen im Hellen wie im Dunkeln dieselben Glasfenster ergeben. */
export const CREST_PALETTES: Record<ImpulseCrestPalette, CrestColors> = {
  smaragd: { deep: '#065f46', mid: '#059669', light: '#34d399', glow: '#a7f3d0' },
  saphir: { deep: '#1e3a8a', mid: '#2563eb', light: '#60a5fa', glow: '#bfdbfe' },
  feuer: { deep: '#9a3412', mid: '#ea580c', light: '#fb923c', glow: '#fed7aa' },
  amethyst: { deep: '#5b21b6', mid: '#7c3aed', light: '#a78bfa', glow: '#ddd6fe' },
  gold: { deep: '#92400e', mid: '#d97706', light: '#fbbf24', glow: '#fde68a' },
  ozean: { deep: '#155e75', mid: '#0891b2', light: '#22d3ee', glow: '#a5f3fc' },
  rubin: { deep: '#9f1239', mid: '#e11d48', light: '#fb7185', glow: '#fecdd3' },
  wald: { deep: '#14532d', mid: '#15803d', light: '#4ade80', glow: '#bbf7d0' },
}

export const CREST_SYMBOLS: Record<ImpulseCrestSymbol, LucideIcon> = {
  laeufer: Footprints,
  schild: ShieldCheck,
  schwert: Sword,
  schluessel: KeyRound,
  buch: BookOpen,
  kompass: Compass,
  banner: Flag,
  flamme: Flame,
  berg: Mountain,
  herz: Heart,
  krone: Crown,
  anker: Anchor,
  stern: Star,
  sonne: Sun,
  baum: TreePine,
  tempel: Landmark,
}

const PALETTE_KEYS = Object.keys(CREST_PALETTES) as ImpulseCrestPalette[]
const SYMBOL_KEYS = Object.keys(CREST_SYMBOLS) as ImpulseCrestSymbol[]

/**
 * Das Wappen einer Woche ohne eigene Angaben – aus der Woche selbst
 * abgeleitet, damit jede Woche ein anderes bekommt und dieselbe Woche
 * immer dasselbe.
 */
export function defaultCrest(week: string): ImpulseCrest {
  let hash = 0
  for (let i = 0; i < week.length; i += 1) hash = (hash * 31 + week.charCodeAt(i)) >>> 0
  return {
    symbol: SYMBOL_KEYS[hash % SYMBOL_KEYS.length],
    palette: PALETTE_KEYS[(hash >>> 4) % PALETTE_KEYS.length],
    motto: '',
  }
}

/**
 * Wie viele der `cells` Felder bei diesem Stand gefärbt sind.
 *
 * Gezählt wird der Anteil, nicht die Zahl der Karten – eine Woche mit
 * zehn Karten baut dasselbe Schild wie eine mit sechzehn. Ganz steht es
 * erst da, wenn **alles** geschafft ist: Bis dahin bleibt mindestens ein
 * Feld offen, und schon die erste Karte färbt mindestens eines.
 */
export function revealedCells(done: number, total: number, cells: number): number {
  if (total <= 0 || done <= 0 || cells <= 0) return 0
  if (done >= total) return cells
  return Math.min(cells - 1, Math.max(1, Math.floor((cells * done) / total)))
}

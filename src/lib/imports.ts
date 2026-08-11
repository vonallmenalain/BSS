import type { ComponentType } from 'react'
import {
  Award,
  Brush,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  History,
  Music,
  NotebookPen,
  Users,
} from 'lucide-react'

export interface ImportEntry {
  /** Adresse der Ansicht */
  to: string
  label: string
  /** Wozu der Import da ist – steht in den Einstellungen unter dem Namen. */
  description: string
  icon: ComponentType<{ className?: string }>
  /** Gehört zu den «Admin-Importen» – siehe unten. */
  adminOnly?: boolean
}

/** Der Name der Gruppe – in der Registerleiste wie in den Einstellungen. */
export const ADMIN_IMPORT_LABEL = 'Admin-Importe'

/**
 * Was sich von aussen übernehmen lässt – die eine Liste für beide Orte, an
 * denen sie erscheint: die Registerleiste über den Importseiten
 * (`components/ImportNav`) und die Einstellungen (`pages/Settings`).
 *
 * Die Reihenfolge ist die des Einrichtens: Zuerst die Mitglieder, denn
 * Berufungen, Betreuung und die Listen der Alleinstehenden ordnen ihre
 * Einträge den erfassten Personen zu. Danach, was jeweils zu seiner Zeit
 * anfällt – die Alleinstehenden alle paar Monate, der Putzplan zweimal im
 * Jahr, die Themen der AP-Klasse jeden Monat neu.
 *
 * Hinten stehen die **Admin-Importe** (`adminOnly`). Sie haben den Bestand
 * beim Umstieg ein einziges Mal gefüllt: die bisherigen Protokolle, den
 * Verlauf der Ansprachen und Gebete, den alten Jahresplan der Aktivitäten
 * und die Liederbücher. Seither wird keiner von ihnen mehr gebraucht.
 * Löschen liesse sich sagen – aber dann wären sie beim nächsten Einrichten
 * neu zu schreiben; deshalb bleiben sie und zeigen sich nur noch dem
 * Administrator-Konto (`ADMIN_EMAIL`). Für alle Übrigen wäre es eine
 * Handvoll Handgriffe, die nie wieder jemand tut – und vier Gelegenheiten,
 * versehentlich einen Bestand zu ersetzen, der längst gepflegt wird.
 *
 * Die Trennung gilt für die Anzeige und die Adressen (`RequireAdmin` in
 * `App.tsx`), nicht für die Zugriffsregeln: Wer Vollzugriff hat, darf diese
 * Sammlungen weiterhin schreiben – das ist auch nötig, denn dieselben Daten
 * entstehen im Alltag von Hand. Es ist ein Aufgeräumtsein, keine Sperre.
 */
export const IMPORTS: ImportEntry[] = [
  {
    to: '/import',
    label: 'Mitglieder',
    description: 'Mitgliederverzeichnis aus dem LCR – Grundlage für alles Übrige',
    icon: ClipboardList,
  },
  {
    to: '/import/berufungen',
    label: 'Berufungen',
    description: 'Organisationen, Berufungen ausserhalb der Einheit und die Berufungshistorie',
    icon: Award,
  },
  {
    to: '/import/betreuung',
    label: 'Betreuung',
    description: 'Betreuungspartner und Betreuungsaufträge',
    icon: HeartHandshake,
  },
  {
    to: '/import/alleinstehende',
    label: 'Alleinstehende',
    description: 'Die Listen JAE und AE – Grundlage für den Filter nach Organisation',
    icon: Users,
  },
  {
    to: '/import/putzplan',
    label: 'Putzplan',
    description: 'Die Excel-Tabelle der Gemeinde als Wochenplan',
    icon: Brush,
  },
  {
    to: '/import/ap-themen',
    label: 'Themen AP-Klasse',
    description: 'Die Lektionen eines Monats aus «Für eine starke Jugend» – jeden Monat neu',
    icon: GraduationCap,
  },

  /* ---------- Admin-Importe: einmalig beim Einrichten ---------- */
  {
    to: '/import/aktivitaeten',
    label: 'Aktivitäten AP',
    description: 'Der bisherige Jahresplan der Priestertumskollegien als Kalender',
    icon: CalendarDays,
    adminOnly: true,
  },
  {
    to: '/import/sitzungen',
    label: 'Sitzungen',
    description: 'Die bisherigen Protokolle als Sitzungsgeschichte und offene Pendenzen',
    icon: NotebookPen,
    adminOnly: true,
  },
  {
    to: '/import/verlauf',
    label: 'Verlauf',
    description: 'Frühere Ansprachen und Gebete – einmalig beim Einrichten',
    icon: History,
    adminOnly: true,
  },
  {
    to: '/import/lieder',
    label: 'Liederlisten',
    description: 'Damit beim Erfassen der Musik die Liednummer genügt',
    icon: Music,
    adminOnly: true,
  },
]

/** Die Importe des Betriebs – sichtbar für jedes freigeschaltete Konto. */
export const EVERYDAY_IMPORTS = IMPORTS.filter((entry) => !entry.adminOnly)

/** Die Importe des Einrichtens – sichtbar allein für das Administrator-Konto. */
export const ADMIN_IMPORTS = IMPORTS.filter((entry) => entry.adminOnly)

/** Die Adressen der Admin-Importe – die Routen in `App.tsx` sind dieselben. */
export const ADMIN_IMPORT_PATHS = ADMIN_IMPORTS.map((entry) => entry.to)

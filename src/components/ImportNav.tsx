import { NavLink } from 'react-router-dom'
import {
  ClipboardList,
  Award,
  Brush,
  CalendarDays,
  HeartHandshake,
  History,
  Music,
  NotebookPen,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Was sich von aussen übernehmen lässt.
 *
 * Die ersten vier stammen aus dem LCR und gehören zusammen: Nach einem
 * Wechsel in der Gemeinde ist meist alles fällig, und die Reihenfolge ist
 * nicht beliebig – Berufungen, Betreuung und die Listen der Alleinstehenden
 * ordnen ihre Einträge den erfassten Personen zu, deshalb kommen die
 * Mitglieder zuerst. Die Alleinstehenden stehen dabei etwas anders da: Sie
 * werden nicht einmal eingerichtet, sondern alle paar Monate aufgefrischt.
 *
 * Verlauf und Liederliste braucht man je nur einmal. Sie stehen trotzdem
 * hier, weil man sie hier sucht – und stehen hinten, weil sie nach der
 * Einrichtung niemanden mehr beschäftigen. Der Putzplan kommt zweimal im
 * Jahr und steht dazwischen.
 */
const TABS = [
  { to: '/import', label: 'Mitglieder', icon: ClipboardList },
  { to: '/import/berufungen', label: 'Berufungen', icon: Award },
  { to: '/import/betreuung', label: 'Betreuung', icon: HeartHandshake },
  { to: '/import/alleinstehende', label: 'Alleinstehende', icon: Users },
  { to: '/import/putzplan', label: 'Putzplan', icon: Brush },
  { to: '/import/aktivitaeten', label: 'Aktivitäten AP', icon: CalendarDays },
  { to: '/import/sitzungen', label: 'Sitzungen', icon: NotebookPen },
  { to: '/import/verlauf', label: 'Verlauf', icon: History },
  { to: '/import/lieder', label: 'Lieder', icon: Music },
]

export function ImportNav() {
  return (
    <nav className="no-scrollbar mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
              isActive
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

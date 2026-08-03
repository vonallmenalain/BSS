import { NavLink } from 'react-router-dom'
import { ClipboardList, Award, HeartHandshake } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Die drei Listen, die sich aus dem LCR übernehmen lassen.
 *
 * Sie stehen nebeneinander, weil sie zusammengehören: Nach einem Wechsel
 * in der Gemeinde ist meist alles drei fällig, und die Reihenfolge ist
 * nicht beliebig – Berufungen und Betreuung ordnen ihre Einträge den
 * erfassten Personen zu, deshalb kommen die Mitglieder zuerst.
 */
const TABS = [
  { to: '/import', label: 'Mitglieder', icon: ClipboardList },
  { to: '/import/berufungen', label: 'Berufungen', icon: Award },
  { to: '/import/betreuung', label: 'Betreuung', icon: HeartHandshake },
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

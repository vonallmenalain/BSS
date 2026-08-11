import { NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  ADMIN_IMPORTS,
  ADMIN_IMPORT_LABEL,
  EVERYDAY_IMPORTS,
  type ImportEntry,
} from '@/lib/imports'
import { cn } from '@/lib/utils'

/**
 * Die Registerleiste über den Importseiten.
 *
 * Welche Importe es gibt und in welcher Reihenfolge sie stehen, steht in
 * `lib/imports` – dieselbe Liste trägt die Einstellungen. Hinten hängen die
 * Admin-Importe: Sie erscheinen allein im Administrator-Konto und sind
 * durch einen Strich und ihren Namen von allem Übrigen abgesetzt, damit
 * niemand sie für Handgriffe des Alltags hält.
 */
export function ImportNav() {
  const { isAdmin } = useAuth()

  return (
    <nav className="no-scrollbar mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {EVERYDAY_IMPORTS.map((entry) => (
        <ImportTab key={entry.to} entry={entry} />
      ))}

      {isAdmin && (
        <>
          <span className="mx-1 my-1 w-px shrink-0 bg-slate-300 dark:bg-slate-600" aria-hidden />
          <span className="inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-400 dark:text-slate-500">
            <ShieldCheck className="size-3.5" aria-hidden />
            {ADMIN_IMPORT_LABEL}
          </span>
          {ADMIN_IMPORTS.map((entry) => (
            <ImportTab key={entry.to} entry={entry} />
          ))}
        </>
      )}
    </nav>
  )
}

function ImportTab({ entry: { to, label, icon: Icon } }: { entry: ImportEntry }) {
  return (
    <NavLink
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
  )
}

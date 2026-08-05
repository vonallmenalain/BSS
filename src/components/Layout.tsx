import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  NotebookPen,
  Brush,
  Church,
  CloudUpload,
  Users,
  Award,
  Settings,
  LogOut,
  Menu,
  X,
  WifiOff,
  Moon,
  Sun,
  MonitorSmartphone,
  ChevronDown,
  Tent,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useOnlineStatus, useTheme } from '@/hooks/useLocalStorage'
import { useOpenItems } from '@/hooks/useFirestore'
import { usePendingWrites } from '@/hooks/useSync'
import { Avatar } from '@/components/ui/Avatar'
import { ROLE_LABELS, toItemKind } from '@/lib/types'
import { UpdatePrompt } from '@/components/UpdatePrompt'

interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: typeof LayoutDashboard
  /** Auf dem Handy in der unteren Leiste sichtbar */
  primary?: boolean
  badge?: number
  /** Unterpunkte eines ausklappbaren Bereichs */
  children?: { to: string; label: string }[]
}

/**
 * Die Abendmahlsversammlung ist der einzige Bereich mit Unterpunkten.
 * «Leitung» steht bewusst zuoberst: Dort läuft alles zusammen, die übrigen
 * Punkte sind die Zulieferer.
 */
const SACRAMENT_CHILDREN = [
  { to: '/abendmahl/leitung', label: 'Leitung' },
  { to: '/abendmahl/bekanntmachungen', label: 'Bekanntmachungen' },
  { to: '/abendmahl/angelegenheiten', label: 'Angelegenheiten' },
  { to: '/abendmahl/ansprachen', label: 'Ansprachen' },
  { to: '/abendmahl/musik', label: 'Musik' },
  { to: '/abendmahl/gebet', label: 'Gebet' },
]

export function Layout() {
  const { settings } = useData()
  const { isApproved } = useAuth()
  const { data: openItems } = useOpenItems()
  const online = useOnlineStatus()
  const unsent = usePendingWrites()
  const [theme, setTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Beim Seitenwechsel das mobile Menü schliessen.
  useEffect(() => setMenuOpen(false), [location.pathname])

  /*
   * Die Zahl neben «Pendenzen»: was liegengeblieben ist.
   *
   * Neue Traktanden zählen nicht mit – sie stehen in ihrer Sitzung und
   * werden erst zur Pendenz, wenn diese abgeschlossen wird, ohne dass der
   * Haken gesetzt ist. Sonst zeigte die Zahl bloss, wie gut die nächste
   * Sitzung vorbereitet ist.
   */
  const pendenzCount = useMemo(
    () => openItems.filter((item) => toItemKind(item) === 'pendenz').length,
    [openItems],
  )

  /**
   * Der AP-Kalender steht in beiden Listen.
   *
   * Wer nur ihn sehen darf, bekommt eine Navigation aus einem einzigen
   * Punkt – das wirkt zunächst überflüssig, hält aber Kopfzeile,
   * Benutzermenü und Aussehen der App gleich, statt für diese Konten eine
   * zweite Oberfläche zu bauen.
   */
  const apItem: NavItem = {
    to: '/ap',
    label: 'Aktivitäten AP’s',
    shortLabel: 'AP',
    icon: Tent,
  }

  const navItems: NavItem[] = isApproved
    ? [
        { to: '/', label: 'Übersicht', shortLabel: 'Start', icon: LayoutDashboard, primary: true },
        {
          to: '/sitzungen',
          label: 'Sitzungen',
          shortLabel: 'Sitzung',
          icon: CalendarDays,
          primary: true,
        },
        {
          to: '/pendenzen',
          label: 'Pendenzen',
          shortLabel: 'Pendenz',
          icon: ListTodo,
          primary: true,
          badge: pendenzCount || undefined,
        },
        { to: '/notizen', label: 'Notizen', shortLabel: 'Notiz', icon: NotebookPen },
        { to: '/putzplan', label: 'Putzplan', shortLabel: 'Putzen', icon: Brush },
        {
          to: '/abendmahl/leitung',
          label: 'Abendmahlsversammlung',
          shortLabel: 'Sonntag',
          icon: Church,
          primary: true,
          children: SACRAMENT_CHILDREN,
        },
        apItem,
        { to: '/mitglieder', label: 'Mitglieder', shortLabel: 'Mitglieder', icon: Users },
        { to: '/berufungen', label: 'Berufungen', shortLabel: 'Berufung', icon: Award },
        { to: '/einstellungen', label: 'Einstellungen', shortLabel: 'Mehr', icon: Settings },
      ]
    : // Ohne Vollzugriff ist der Kalender der ganze Inhalt – dann gehört er
      // auch in die untere Leiste.
      [{ ...apItem, primary: true }]

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorSmartphone

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      {/* ---------- Kopfzeile ---------- */}
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 pt-safe">
          {navItems.length > 1 && (
            <button
              type="button"
              className="btn-ghost -ml-2 p-2 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Menü schliessen' : 'Menü öffnen'}
              aria-expanded={menuOpen}
            >
              <Menu className="size-5" />
            </button>
          )}

          <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="bg-brand-600 grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">
              BS
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-semibold">
                Bischofschaft
              </span>
              <span className="block truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                {settings.wardName}
              </span>
            </span>
          </NavLink>

          <div className="flex-1" />

          {!online && (
            <span
              className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              title="Änderungen werden gespeichert und später übertragen."
            >
              <WifiOff className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          {/* Zeigt, dass noch etwas unterwegs ist – auch wenn die Verbindung
              inzwischen wieder steht. Erst wenn das weg ist, ist alles beim Server. */}
          {unsent > 0 && (
            <span
              className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
              title={`${unsent} Änderung${unsent === 1 ? '' : 'en'} lokal gespeichert, Übertragung läuft.`}
            >
              <CloudUpload className="size-3.5 animate-pulse" aria-hidden />
              <span className="tabular hidden sm:inline">{unsent} unterwegs</span>
              <span className="tabular sm:hidden">{unsent}</span>
            </span>
          )}

          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() =>
              setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
            }
            aria-label={`Darstellung: ${theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell'}`}
            title={`Darstellung: ${theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell'}`}
          >
            <ThemeIcon className="size-5" aria-hidden />
          </button>

          <UserMenu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* ---------- Seitennavigation (Desktop) ---------- */}
        <nav className="no-print sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 px-3 py-4 lg:flex dark:border-slate-800">
          {/* Name, Rolle und Abmelden stehen nur noch im Benutzermenü oben
              rechts – einmal genügt, und die Navigation bleibt ruhig. */}
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        {/* ---------- Mobiles Menü ---------- */}
        {menuOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <div
              className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <nav className="animate-slide-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-0.5 overflow-y-auto bg-white px-3 py-4 pt-safe shadow-2xl dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-sm font-semibold">Navigation</span>
                <button
                  type="button"
                  className="btn-ghost p-1.5"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Menü schliessen"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              {navItems.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </nav>
          </div>
        )}

        {/* ---------- Inhalt ---------- */}
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ---------- Untere Leiste (Handy) ---------- */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-stretch">
          {navItems
            .filter((item) => item.primary)
            .map((item) => (
              <BottomLink key={item.to} item={item} />
            ))}
          {/* «Mehr» nur, wenn es tatsächlich mehr gibt – wer allein den
              AP-Kalender sieht, findet dahinter nichts. */}
          {navItems.some((item) => !item.primary) && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-slate-500 transition dark:text-slate-400"
            >
              <ChevronDown className="size-5 rotate-180" aria-hidden />
              <span className="text-[10px] font-medium">Mehr</span>
            </button>
          )}
        </div>
      </nav>

      <UpdatePrompt />
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  const location = useLocation()

  /**
   * Ein Bereich mit Unterpunkten klappt auf, sobald man darin arbeitet, und
   * lässt sich danach von Hand zu- und wieder aufklappen.
   *
   * Der offene Zustand ist deshalb **eigener** Zustand und keine Ableitung
   * aus dem Pfad: Solange `inSection || manuallyOpen` galt, war der Pfeil
   * im Bereich selbst wirkungslos – zugeklappt wurde sofort wieder
   * aufgeklappt, weil man ja darin stand. Jetzt öffnet der Wechsel in den
   * Bereich den Zweig einmal, und danach entscheidet der Pfeil.
   */
  const section = item.children ? item.to.split('/')[1] : ''
  const inSection = Boolean(section) && location.pathname.startsWith(`/${section}`)

  const [expanded, setExpanded] = useState(inSection)
  const [wasInSection, setWasInSection] = useState(inSection)

  // Beim Betreten des Bereichs einmal aufklappen. Während des Renderns
  // statt in einem Effekt: Das ist ein Wechsel, kein Nebeneffekt, und die
  // Navigation soll nicht erst zugeklappt erscheinen und dann aufspringen.
  if (wasInSection !== inSection) {
    setWasInSection(inSection)
    if (inSection) setExpanded(true)
  }

  return (
    <div>
      <div className="flex items-center">
        <NavLink
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              (item.children ? inSection : isActive)
                ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )
          }
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="tabular rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {item.badge}
            </span>
          ) : null}
        </NavLink>

        {item.children && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn-ghost shrink-0 p-1.5"
            aria-expanded={expanded}
            aria-label={`${item.label} ${expanded ? 'zuklappen' : 'aufklappen'}`}
          >
            <ChevronDown
              className={cn('size-4 transition-transform', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>
        )}
      </div>

      {item.children && expanded && (
        <ul className="mt-0.5 ml-5 border-l border-slate-200 pl-2 dark:border-slate-800">
          {item.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    'block truncate rounded-lg px-3 py-1.5 text-sm transition',
                    isActive
                      ? 'text-brand-700 dark:text-brand-200 font-medium'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                  )
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  const location = useLocation()
  // Bei einem Bereich mit Unterseiten zählt der ganze Zweig als aktiv –
  // sonst wirkt die Leiste beim Wechsel auf «Musik» plötzlich leer.
  const section = item.children ? item.to.split('/')[1] : ''
  const inSection = Boolean(section) && location.pathname.startsWith(`/${section}`)

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center gap-0.5 py-2 transition',
          isActive || inSection
            ? 'text-brand-600 dark:text-brand-300'
            : 'text-slate-500 dark:text-slate-400',
        )
      }
    >
      <span className="relative">
        <Icon className="size-5" aria-hidden />
        {item.badge ? (
          <span className="tabular absolute -top-1.5 -right-2 rounded-full bg-rose-600 px-1 text-[10px] leading-4 font-semibold text-white">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-medium">{item.shortLabel}</span>
    </NavLink>
  )
}

function UserMenu() {
  const { profile, signOut, isApproved } = useAuth()
  const [open, setOpen] = useState(false)

  if (!profile) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full transition hover:opacity-80"
        aria-label="Benutzermenü"
        aria-expanded={open}
      >
        <Avatar name={profile.displayName} id={profile.id} size="md" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-scale-in absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <p className="truncate text-sm font-medium">{profile.displayName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
              <p className="text-brand-600 dark:text-brand-300 mt-1 text-xs font-medium">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
            {isApproved && (
              <NavLink
                to="/einstellungen"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Settings className="size-4" aria-hidden />
                Einstellungen
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
            >
              <LogOut className="size-4" aria-hidden />
              Abmelden
            </button>
          </div>
        </>
      )}
    </div>
  )
}

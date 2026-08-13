import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppMenuContext } from '@/contexts/AppMenuContext'
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
  Bell,
  Menu,
  X,
  WifiOff,
  Moon,
  Sun,
  MonitorSmartphone,
  ChevronDown,
  Tent,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTrackLocation } from '@/hooks/useBack'
import { useOnlineStatus, useTheme } from '@/hooks/useLocalStorage'
import { usePendingWrites } from '@/hooks/useSync'
import { useEnsureMonthlyDuties } from '@/hooks/useMonthlyDuties'
import { useNow } from '@/hooks/useNow'
import { useImpulseItems, useImpulseProgress } from '@/hooks/useFirestore'
import { impulseWeekKey, visibleImpulseItems } from '@/lib/impulse'
import { UserAvatar } from '@/components/ui/Avatar'
import { ROLE_LABELS } from '@/lib/types'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { NotificationsModal } from '@/components/NotificationsModal'

interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: typeof LayoutDashboard
  /** Auf dem Handy in der unteren Leiste sichtbar */
  primary?: boolean
  /**
   * Ein stiller Punkt am Eintrag – «hier wartet Neues».
   *
   * Kein Zähler und keine Mahnung (die Pendenzen-Zahl ist aus gutem Grund
   * weggefallen): Der Punkt steht, solange etwas noch nie angeschaut
   * wurde, und verschwindet mit dem ersten Blick – die Sprache des
   * Update-Hinweises.
   */
  dot?: boolean
  /*
   * Eine Zahl neben «Pendenzen» stand hier einmal – wie viele offen sind.
   * Sie ist weggefallen: Ein rotes Abzeichen behauptet, es sei etwas
   * versäumt worden, und tut das dauerhaft. Offene Pendenzen sind aber der
   * Normalzustand einer Bischofschaft; die Zahl mahnte jeden Tag, ohne je
   * etwas anderes zu sagen. Wie viele es sind, steht auf der Seite selbst.
   */
  /** Unterpunkte eines ausklappbaren Bereichs */
  children?: { to: string; label: string }[]
}

/**
 * Die Unterpunkte der Abendmahlsversammlung.
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

/**
 * «Anti Doom» klappt im Menü auf wie die Abendmahlsversammlung.
 *
 * Die ersten Punkte sind die Karten des Vollbild-Feeds – ein Tipp öffnet
 * den Feed genau bei dieser Karte. Danach die Räume (Wochenziel,
 * Tages-Challenge, Fortschritt, Gemerkt, Mitmach-Ecke) und zuunterst die
 * Anti-Doom-Einstellungen (Reihenfolge der Karten, Rückblick in frühere
 * Wochen). Die Liste steht fest, auch wenn eine Woche einmal keine
 * Quizfrage hat – ein Menü, das je nach Woche anders aussieht, wäre
 * keines.
 */
const IMPULSE_CHILDREN = [
  { to: '/anti-doom/woche', label: 'Wochenthema' },
  { to: '/anti-doom/quiz', label: 'Quizfrage' },
  { to: '/anti-doom/bilderraetsel', label: 'Bilderrätsel' },
  { to: '/anti-doom/frage', label: 'Frage der Woche' },
  { to: '/anti-doom/feed', label: 'Feed' },
  { to: '/anti-doom/teilen', label: 'Teilen' },
  { to: '/anti-doom/ziel', label: 'Wochenziel' },
  { to: '/anti-doom/challenge', label: 'Tages-Challenge' },
  { to: '/anti-doom/fortschritt', label: 'Mein Fortschritt' },
  { to: '/anti-doom/gemerkt', label: 'Gemerkt' },
  { to: '/anti-doom/mitmachen', label: 'Mitmach-Ecke' },
  { to: '/anti-doom/einstellungen', label: 'Anti-Doom-Einstellungen' },
]

export function Layout() {
  const { settings } = useData()
  const { isApproved, canViewAp, canViewImpulse, profile, signOut } = useAuth()

  /*
   * Der Punkt am Eintrag «Anti Doom»: Die laufende Woche hat Inhalt, und
   * dieses Konto hat sie noch nicht angeschaut. Ohne Anti-Doom-Zugang sind
   * die Abonnements abgeschaltet und alles bleibt still.
   */
  const impulseItems = useImpulseItems()
  const impulseProgress = useImpulseProgress()
  const nowForImpulse = useNow()
  const impulseWeek = impulseWeekKey(nowForImpulse)
  const impulseDot =
    canViewImpulse &&
    !impulseItems.loading &&
    visibleImpulseItems(impulseItems.data, impulseWeek).some((item) => item.week === impulseWeek) &&
    impulseProgress.byUid.get(profile?.id ?? '')?.lastSeenWeek !== impulseWeek
  const online = useOnlineStatus()
  const unsent = usePendingWrites()
  const [theme, setTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const location = useLocation()

  /*
   * «Anti Doom» ist eine App in der App – und fühlt sich nur so an, wenn die
   * Hülle schweigt. Sobald jemand den Bereich betritt, verschwinden
   * Kopfzeile, Seitennavigation und untere Leiste; der Inhalt hat den
   * Bildschirm für sich. Die Navigation wartet hinter dem dezenten
   * Menüknopf, den die Anti-Doom-Seiten oben links tragen (`AppMenuButton` →
   * `AppMenuContext`): Er öffnet die Schublade, die sonst nur das Handy
   * kennt – hier auf allen Bildschirmgrössen, und um das ergänzt, was
   * sonst in der Kopfzeile wohnt (Benachrichtigungen, Darstellung,
   * Abmelden).
   */
  const immersive = location.pathname === '/anti-doom' || location.pathname.startsWith('/anti-doom/')
  const openMenu = useCallback(() => setMenuOpen(true), [])

  /*
   * Wo man gerade ist, für den Weg zurück festhalten.
   *
   * Damit weiss der Zurück-Knopf einer Detailseite, wohin er führt – und
   * kann es auch anschreiben (siehe `hooks/useBack`).
   */
  useTrackLocation(location)

  /*
   * Die Pendenzen des laufenden Monats anlegen, falls sie noch fehlen.
   *
   * Hier und nicht auf der Pendenzenseite: Sie sollen dastehen, sobald
   * jemand die App öffnet – auch für den, der bloss die Übersicht aufruft
   * und dort seine Kachel «Meine Pendenzen» liest. Ohne Vollzugriff und
   * ohne Verbindung geschieht nichts (siehe `hooks/useMonthlyDuties`).
   */
  useEnsureMonthlyDuties()

  // Beim Seitenwechsel das mobile Menü schliessen.
  useEffect(() => setMenuOpen(false), [location.pathname])

  /**
   * Der AP-Kalender und «Anti Doom» stehen in beiden Listen.
   *
   * Wer nur sie sehen darf, bekommt eine Navigation aus einem oder zwei
   * Punkten – das wirkt zunächst überflüssig, hält aber Kopfzeile,
   * Benutzermenü und Aussehen der App gleich, statt für diese Konten eine
   * zweite Oberfläche zu bauen.
   */
  const apItem: NavItem = {
    to: '/ap',
    label: 'Aktivitäten AP’s',
    shortLabel: 'AP',
    icon: Tent,
  }

  /* «Anti Doom» erscheint nur mit dem Schalter am Konto – auch beim
     Vollzugriff. Der Bereich gehört den AP's; wer ihn begleitet, wird
     einzeln freigeschaltet (und das Administrator-Konto sieht ihn immer). */
  const impulsItem: NavItem = {
    to: '/anti-doom',
    label: 'Anti Doom',
    shortLabel: 'Anti Doom',
    icon: Sparkles,
    dot: impulseDot,
    children: IMPULSE_CHILDREN,
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
        ...(canViewImpulse ? [impulsItem] : []),
        { to: '/mitglieder', label: 'Mitglieder', shortLabel: 'Mitglieder', icon: Users },
        { to: '/berufungen', label: 'Berufungen', shortLabel: 'Berufung', icon: Award },
        { to: '/einstellungen', label: 'Einstellungen', shortLabel: 'Mehr', icon: Settings },
      ]
    : // Ohne Vollzugriff sind der Kalender und – mit Schalter – «Anti Doom»
      // der ganze Inhalt; dann gehören sie auch in die untere Leiste.
      [
        ...(canViewAp ? [{ ...apItem, primary: true }] : []),
        ...(canViewImpulse ? [{ ...impulsItem, primary: true }] : []),
      ]

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorSmartphone
  const themeLabel = theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell'
  const cycleTheme = () =>
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      {/* ---------- Kopfzeile (im Anti-Doom-Vollbild ausgeblendet) ---------- */}
      {!immersive && (
        <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/85 px-safe backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
          {/* Quer auf dem Telefon ist der Bildschirm niedrig – dort wird die
            Kopfzeile flacher, damit vom Inhalt mehr übrig bleibt. */}
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 pt-safe landscape-short:h-12">
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
              onClick={cycleTheme}
              aria-label={`Darstellung: ${themeLabel}`}
              title={`Darstellung: ${themeLabel}`}
            >
              <ThemeIcon className="size-5" aria-hidden />
            </button>

            <UserMenu />
          </div>
        </header>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 px-safe">
        {/* ---------- Seitennavigation (Desktop) ---------- */}
        {!immersive && (
          <nav className="no-print sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 px-3 py-4 lg:flex dark:border-slate-800">
            {/* Name, Rolle und Abmelden stehen nur noch im Benutzermenü oben
                rechts – einmal genügt, und die Navigation bleibt ruhig. */}
            {navItems.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>
        )}

        {/* ---------- Die Navigations-Schublade ----------
            Am Handy das Menü hinter dem Hamburger; im Anti-Doom-Vollbild der
            einzige Weg durch die App – dann auch auf dem grossen Bildschirm
            und unten ergänzt um die Handgriffe der Kopfzeile. */}
        {menuOpen && (
          <div className={cn('no-print fixed inset-0 z-50', !immersive && 'lg:hidden')}>
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
              {immersive && (
                <div className="mt-auto border-t border-slate-200 pt-2 pb-safe dark:border-slate-800">
                  {(isApproved || canViewAp || canViewImpulse) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setNotificationsOpen(true)
                      }}
                      className={DRAWER_ACTION}
                    >
                      <Bell className="size-5 shrink-0" aria-hidden />
                      Benachrichtigungen
                    </button>
                  )}
                  <button type="button" onClick={cycleTheme} className={DRAWER_ACTION}>
                    <ThemeIcon className="size-5 shrink-0" aria-hidden />
                    Darstellung: {themeLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                  >
                    <LogOut className="size-5 shrink-0" aria-hidden />
                    Abmelden
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}

        {/* ---------- Inhalt ---------- */}
        <main
          className={cn(
            'min-w-0 flex-1 px-4 sm:px-6',
            immersive
              ? 'pt-safe-5 pb-10'
              : 'py-5 pb-24 lg:pb-8 landscape-short:py-3 landscape-short:pb-16',
          )}
        >
          {/* Bricht eine Seite beim Zeichnen, bleibt die Navigation stehen –
              und der Seitenwechsel gibt der Ansicht einen neuen Versuch. */}
          <AppMenuContext.Provider value={openMenu}>
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </AppMenuContext.Provider>
        </main>
      </div>

      {/* ---------- Untere Leiste (Handy) ---------- */}
      {!immersive && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-safe backdrop-blur-md pb-safe lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
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
                className={cn(BOTTOM_LINK, 'text-slate-500 dark:text-slate-400')}
              >
                <ChevronDown className="size-5 shrink-0 rotate-180" aria-hidden />
                <span className="text-[10px] font-medium">Mehr</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Der Benachrichtigungs-Dialog der Schublade – ausserhalb von ihr,
          denn die Schublade schliesst sich beim Öffnen des Dialogs. */}
      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      <UpdatePrompt />
    </div>
  )
}

/** Ein Handgriff der Kopfzeile, in die Schublade verlegt (Anti-Doom-Vollbild). */
const DRAWER_ACTION =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ' +
  'transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

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
          {item.dot && (
            <>
              <span className="bg-brand-500 size-2 shrink-0 rounded-full" aria-hidden />
              <span className="sr-only">Neuer Inhalt</span>
            </>
          )}
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

/**
 * Ein Platz in der unteren Leiste.
 *
 * Quer auf dem Telefon stehen Symbol und Wort nebeneinander statt
 * übereinander: Das spart eine Zeile Höhe, und quer ist Höhe das, was fehlt.
 */
const BOTTOM_LINK =
  'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition ' +
  'landscape-short:flex-row landscape-short:gap-1.5 landscape-short:py-1.5'

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
          BOTTOM_LINK,
          isActive || inSection
            ? 'text-brand-600 dark:text-brand-300'
            : 'text-slate-500 dark:text-slate-400',
        )
      }
    >
      <span className="relative">
        <Icon className="size-5 shrink-0" aria-hidden />
        {item.dot && (
          <span
            className="bg-brand-500 absolute -top-0.5 -right-0.5 size-2 rounded-full"
            aria-hidden
          />
        )}
      </span>
      <span className="text-[10px] font-medium">
        {item.shortLabel}
        {item.dot && <span className="sr-only"> – neuer Inhalt</span>}
      </span>
    </NavLink>
  )
}

/**
 * Name, Rolle, Einstellungen, Abmelden – hinter dem Kürzel oben rechts.
 *
 * Ein Griff irgendwohin in die App schliesst das Menü wieder, und zwar über
 * einen Lauscher am Dokument statt über eine unsichtbare Fläche darunter.
 * Die Fläche gab es, sie half hier aber nicht: Die Kopfzeile ist mit
 * `backdrop-blur` hinterlegt, und das macht sie zum Bezugsrahmen für alles
 * Festpositionierte darin. Das «über den ganzen Bildschirm» der Fläche
 * endete deshalb am unteren Rand der Kopfzeile – wer in die Seite klickte,
 * traf sie gar nicht, und das Menü blieb offen stehen.
 *
 * `pointerdown` statt `click`: Das Menü ist weg, sobald der Finger aufsetzt,
 * und nicht erst, wenn er wieder loslässt.
 */
function UserMenu() {
  const { profile, signOut, isApproved, canViewAp, canViewImpulse } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!profile) return null

  // Wer die App überhaupt benutzt, darf sich benachrichtigen lassen –
  // wer noch auf Freigabe wartet, sieht ohnehin nichts, was sich melden
  // könnte.
  const mayNotify = isApproved || canViewAp || canViewImpulse

  return (
    <div className="relative" ref={menu}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full transition hover:opacity-80"
        aria-label="Benutzermenü"
        aria-expanded={open}
      >
        <UserAvatar userId={profile.id} name={profile.displayName} size="md" />
      </button>

      {open && (
        <div className="animate-scale-in absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <p className="truncate text-sm font-medium">{profile.displayName}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
            <p className="text-brand-600 dark:text-brand-300 mt-1 text-xs font-medium">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
          {mayNotify && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setNotifications(true)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Bell className="size-4" aria-hidden />
              Benachrichtigungen
            </button>
          )}
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
      )}

      {/*
       * Der Dialog steht ausserhalb des aufgeklappten Menüs: Er soll
       * offen bleiben, wenn das Menü sich schliesst – und das tut es
       * beim ersten Griff irgendwohin.
       */}
      <NotificationsModal open={notifications} onClose={() => setNotifications(false)} />
    </div>
  )
}

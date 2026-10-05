import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { useAccessLog } from '@/hooks/useAccessLog'
import { usePushNavigation } from '@/hooks/usePushNavigation'
import { isStandalone, rememberBoard, rememberedBoard } from '@/lib/install'
import { appIdentityFor, applyAppIdentity } from '@/lib/appIdentity'
import { usePutzplanPreview } from '@/hooks/usePutzplanPreview'
import { Layout } from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingScreen } from '@/components/ui/Feedback'
import { Login } from '@/pages/Login'
import { PendingApproval } from '@/pages/PendingApproval'
import { Dashboard } from '@/pages/Dashboard'
import { Meetings } from '@/pages/Meetings'
import { MeetingDetail } from '@/pages/MeetingDetail'
import { Pendenzen } from '@/pages/Pendenzen'
import { ASSISTANT_AREA_PATHS, type AssistantArea } from '@/lib/types'

// Selten genutzte Bereiche erst bei Bedarf laden – das hält den ersten
// Aufruf im Sitzungszimmer schnell.
const Members = lazy(() => import('@/pages/Members').then((m) => ({ default: m.Members })))
const MemberDetail = lazy(() =>
  import('@/pages/MemberDetail').then((m) => ({ default: m.MemberDetail })),
)
const Notes = lazy(() => import('@/pages/Notes').then((m) => ({ default: m.Notes })))
const Cleaning = lazy(() => import('@/pages/Cleaning').then((m) => ({ default: m.Cleaning })))
const Talks = lazy(() => import('@/pages/Talks').then((m) => ({ default: m.Talks })))
const Callings = lazy(() => import('@/pages/Callings').then((m) => ({ default: m.Callings })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
const AccessLog = lazy(() => import('@/pages/AccessLog').then((m) => ({ default: m.AccessLog })))
const ImportMembers = lazy(() =>
  import('@/pages/ImportMembers').then((m) => ({ default: m.ImportMembers })),
)
const ImportCallings = lazy(() =>
  import('@/pages/ImportLcr').then((m) => ({ default: m.ImportCallings })),
)
const ImportMinistering = lazy(() =>
  import('@/pages/ImportLcr').then((m) => ({ default: m.ImportMinistering })),
)
const ImportHistory = lazy(() =>
  import('@/pages/ImportHistory').then((m) => ({ default: m.ImportHistory })),
)
const ImportHymns = lazy(() =>
  import('@/pages/ImportHymns').then((m) => ({ default: m.ImportHymns })),
)
const ImportCleaningGroups = lazy(() =>
  import('@/pages/ImportCleaningGroups').then((m) => ({ default: m.ImportCleaningGroups })),
)
const ImportApActivities = lazy(() =>
  import('@/pages/ImportApActivities').then((m) => ({ default: m.ImportApActivities })),
)
const ImportApTopics = lazy(() =>
  import('@/pages/ImportApTopics').then((m) => ({ default: m.ImportApTopics })),
)
const ImportMinutes = lazy(() =>
  import('@/pages/ImportMinutes').then((m) => ({ default: m.ImportMinutes })),
)
const ImportSingles = lazy(() =>
  import('@/pages/ImportSingles').then((m) => ({ default: m.ImportSingles })),
)

/* Aktivitäten AP – neben dem Putzplan der Bereich, der ohne Anmeldung offensteht. */
const ApActivities = lazy(() =>
  import('@/pages/ApActivities').then((m) => ({ default: m.ApActivities })),
)

/**
 * Die Adressen, die ohne Anmeldung offenstehen.
 *
 * Genau zwei Anschlagbretter:
 *
 *  - der **Aktivitätenplan** unter `/ap`. Er wird den Jugendlichen, ihren
 *    Eltern und den Beratern als Link geschickt, und ein Anschlagbrett, für
 *    das man sich anmelden muss, wird nicht gelesen.
 *  - der **Putzplan** unter `/putzplan`. Dorthin führt der QR-Code auf dem
 *    ausgedruckten Plan – wer vor dem Brett im Gemeindehaus steht, soll ihn
 *    auf dem Telefon öffnen können, ohne Konto.
 *
 * Dass die Pläne wirklich offenstehen, entscheidet nicht diese Liste,
 * sondern `firestore.rules`; hier steht bloss, dass die App nicht vorher zur
 * Anmeldung umleitet.
 *
 * Der Link ist derselbe, ob angemeldet oder nicht: Wer ihn weitergibt, muss
 * nicht überlegen, an wen. Was jemand darf, entscheidet sich auf der Seite –
 * ohne Schreibrecht gibt es dort nichts zu ändern.
 */
const PUBLIC_PATHS = ['/ap', '/putzplan']

/** Das Anschlagbrett, zu dem eine Adresse gehört – oder `null`. */
function publicBoard(pathname: string): string | null {
  return PUBLIC_PATHS.find((path) => pathname === path || pathname.startsWith(`${path}/`)) ?? null
}

function isPublicPath(pathname: string): boolean {
  return publicBoard(pathname) !== null
}

/**
 * Wohin es ohne Konto geht, wenn die Adresse eine Anmeldung verlangt.
 *
 * Meist zur Anmeldung. Nur die installierte App, gestartet mit ihrer
 * Startadresse «/», beginnt auf dem Anschlagbrett, das auf diesem Gerät
 * zuletzt ohne Konto offen war: Wer den Putzplan als App aufs Telefon
 * gelegt hat, will den Putzplan sehen und nicht eine Anmeldung, für die er
 * kein Konto hat. Meist sorgt dafür schon das eigene Manifest des
 * Anschlagbretts (siehe `lib/appIdentity`) – das hier fängt die Browser
 * auf, die beim Installieren beim Manifest der App bleiben.
 */
function guestTarget(pathname: string): string {
  if (pathname === '/' && isStandalone()) return rememberedBoard() ?? '/anmelden'
  return '/anmelden'
}

/* «Anti Doom» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md).
   Sichtbar nur mit dem Schalter am Konto – und immer für das
   Administrator-Konto. */
const Impuls = lazy(() => import('@/pages/Impuls').then((m) => ({ default: m.Impuls })))
const ImpulsRedaktion = lazy(() =>
  import('@/pages/ImpulsRedaktion').then((m) => ({ default: m.ImpulsRedaktion })),
)

/* Abendmahlsversammlung – der Rahmen hält den gewählten Sonntag,
   die Unterseiten werden bei Bedarf nachgeladen. */
const SacramentLayout = lazy(() =>
  import('@/components/sacrament/SacramentLayout').then((m) => ({ default: m.SacramentLayout })),
)
const Conducting = lazy(() =>
  import('@/pages/sacrament/Conducting').then((m) => ({ default: m.Conducting })),
)
const Announcements = lazy(() =>
  import('@/pages/sacrament/Announcements').then((m) => ({ default: m.Announcements })),
)
const WardBusiness = lazy(() =>
  import('@/pages/sacrament/WardBusiness').then((m) => ({ default: m.WardBusiness })),
)
const Music = lazy(() => import('@/pages/sacrament/Music').then((m) => ({ default: m.Music })))
const Prayers = lazy(() =>
  import('@/pages/sacrament/Prayers').then((m) => ({ default: m.Prayers })),
)

/** Alte Adressen: «/impuls/…» heisst heute «/anti-doom/…». */
function LegacyImpulsRedirect() {
  const { bereich } = useParams()
  return <Navigate to={bereich ? `/anti-doom/${bereich}` : '/anti-doom'} replace />
}

/**
 * Lässt nur angemeldete und freigeschaltete Personen durch.
 *
 * «Freigeschaltet» heisst hier nicht mehr zwingend «Vollzugriff»: Wer nur
 * den AP-Kalender sehen darf, kommt ebenfalls in die App – aber nur bis
 * dorthin, dafür sorgt `RequireFullAccess`.
 *
 * Und zwei Adressen kommen ganz ohne Konto durch: der Aktivitätenplan und
 * der Putzplan (siehe `PUBLIC_PATHS`). Die Weiche steht hier und nicht in
 * einem zweiten Routenbaum neben diesem, damit es jede Seite nur einmal
 * gibt – dieselbe Adresse, dieselbe Hülle, angemeldet wie nicht. Wer dabei
 * was sieht, entscheidet weiter unten das Schreibrecht und in letzter
 * Instanz `firestore.rules`.
 *
 * Auch ein Konto, das noch auf die Freigabe wartet, sieht dort den Plan
 * statt des Wartezimmers. Die Pläne stehen der ganzen Welt offen –
 * ausgerechnet dem Wartenden die Tür zu weisen, wäre eine Schikane ohne
 * Gewinn.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, isApproved, canViewAp, canViewImpulse, isAssistant } = useAuth()
  const { pathname } = useLocation()
  const publicPage = isPublicPath(pathname)

  // Welches Anschlagbrett ohne Konto zuletzt offen war – für den Start der
  // installierten App (siehe `guestTarget`).
  const guestBoard = !loading && !firebaseUser ? publicBoard(pathname) : null
  useEffect(() => {
    if (guestBoard) rememberBoard(guestBoard)
  }, [guestBoard])

  /*
   * Hier und nicht tiefer: Diese Stelle sieht jedes angemeldete Konto, auch
   * eines, das noch auf die Freigabe wartet. Dass jemand sich anmeldet und
   * wieder geht, ohne je etwas zu sehen, gehört ins Protokoll – es ist die
   * Zeile, wegen der man es aufschlägt.
   *
   * Ein Besuch ohne Konto schreibt nichts: Das Protokoll führt Konten, und
   * ein Anschlagbrett zählt seine Leser nicht (siehe `hooks/useAccessLog`).
   */
  useAccessLog()

  if (loading) return <LoadingScreen label="Anmeldung wird geprüft …" />
  if (!firebaseUser) {
    return publicPage ? <>{children}</> : <Navigate to={guestTarget(pathname)} replace />
  }
  if (!isApproved && !canViewAp && !canViewImpulse && !isAssistant && !publicPage)
    return <PendingApproval />

  return <>{children}</>
}

/**
 * Alles ausser dem AP-Kalender und «Anti Doom».
 *
 * Die Sicherheitsregeln lehnen für diese Konten ohnehin jede Abfrage ab –
 * das hier erspart ihnen leere Seiten und Fehlermeldungen und führt sie
 * dorthin, wofür sie freigeschaltet wurden: zum Kalender, und wer nur den
 * Anti-Doom-Schalter trägt, zu «Anti Doom».
 */
function RequireFullAccess() {
  const { isApproved, homePath } = useAuth()
  if (!isApproved) return <Navigate to={homePath} replace />
  return <Outlet />
}

/**
 * Ein einzelner Bereich der Abendmahlsversammlung.
 *
 * Der Vollzugriff kommt überall durch; die Assistenz genau dort, wo ein
 * Haken steht. Wie bei `RequireFullAccess` ist das keine Sperre, sondern der
 * kurze Weg: Die Zugriffsregeln geben einem Konto ohne den Bereich ohnehin
 * nichts heraus – die Weiche erspart die leere Seite hinter einem
 * Lesezeichen und führt dorthin, wo das Konto zu Hause ist.
 */
function RequireSacramentArea({ area }: { area: AssistantArea }) {
  const { canSeeSacramentArea, homePath } = useAuth()
  if (!canSeeSacramentArea(area)) return <Navigate to={homePath} replace />
  return <Outlet />
}

/**
 * Der Einstieg in die Abendmahlsversammlung – für jedes Konto ein anderer.
 *
 * Der Vollzugriff beginnt unter «Leitung», wo alles zusammenläuft. Die
 * Assistenz beginnt in ihrem ersten Bereich; «Leitung» wäre für sie eine
 * Seite, die sie gar nicht öffnen darf.
 */
function SacramentIndex() {
  const { isApproved, assistantAreas } = useAuth()
  if (isApproved) return <Navigate to="/abendmahl/leitung" replace />
  const first = assistantAreas[0]
  return <Navigate to={first ? ASSISTANT_AREA_PATHS[first] : '/'} replace />
}

/**
 * Nur wer den Bereich «Anti Doom» sehen darf.
 *
 * Wie bei `RequireFullAccess`: Die Zugriffsregeln geben den
 * Anti-Doom-Sammlungen ohnehin nichts heraus – die Weiche erspart bloss die
 * leere Seite hinter einem Lesezeichen und führt zurück an den Ort, der
 * dem Konto gehört.
 */
function RequireImpulse() {
  const { canViewImpulse, homePath } = useAuth()
  if (!canViewImpulse) return <Navigate to={homePath} replace />
  return <Outlet />
}

/**
 * Die Redaktion des Bereichs «Anti Doom» – Inhalte pflegen und moderieren.
 *
 * Das Administrator-Konto und, wer in der Benutzerverwaltung die Stufe
 * «Anti Doom + Redaktion» hat (`impulseEditor`). Wer nur liest – auch mit
 * Vollzugriff –, landet wieder im Bereich; die Zugriffsregeln liessen ihn
 * ohnehin nichts schreiben.
 */
function RequireImpulseEditor() {
  const { canEditImpulse } = useAuth()
  if (!canEditImpulse) return <Navigate to="/anti-doom" replace />
  return <Outlet />
}

/**
 * Was allein dem Administrator-Konto gehört.
 *
 * Zwei Dinge, und sie sind verschieden streng.
 *
 * Die **Admin-Importe** – die Handgriffe, die es nur beim Einrichten
 * brauchte. Welche das sind, steht in `lib/imports` (`adminOnly`); die Routen
 * weiter unten sind dieselben, `tests/imports.test.ts` hält beides zusammen.
 * Ohne diese Weiche wären sie zwar nirgends mehr verlinkt, aber über ein
 * Lesezeichen weiterhin zu erreichen – und ein Import ist der eine Handgriff,
 * der einen ganzen Bestand ersetzen kann. Eine Sperre ist es nicht: Schreiben
 * dürfte jedes Konto mit Vollzugriff (siehe `firestore.rules`), denn dieselben
 * Daten entstehen im Alltag von Hand. Es hält bloss die Vergangenheit aus dem
 * Weg.
 *
 * Das **Zugriffsprotokoll** dagegen ist wirklich gesperrt, und zwar in den
 * Zugriffsregeln: Wer die Adresse aufriefe, bekäme auch ohne diese Weiche
 * keine Zeile zu sehen. Sie erspart bloss die leere Seite mit der
 * Fehlermeldung.
 *
 * `to` sagt, wohin es stattdessen geht – bei den Importen zum gewöhnlichen
 * Import, beim Protokoll zur Übersicht.
 */
function RequireAdmin({ to }: { to: string }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to={to} replace />
  return <Outlet />
}

function LoginRoute() {
  const { firebaseUser, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (firebaseUser) return <Navigate to="/" replace />
  return <Login />
}

/** Hört auf angetippte Benachrichtigungen – innerhalb des Routers, damit sie navigieren kann. */
function PushNavigation() {
  usePushNavigation()
  return null
}

/**
 * Welche App sich installieren würde – Symbol und Name je nach Zugang
 * (`lib/appIdentity`): die Bischofschaft, die AP's oder, ohne Konto, das
 * Anschlagbrett. Solange die Anmeldung geprüft wird, bleibt der Stand der
 * Seite stehen.
 */
function AppIdentitySwitch() {
  const { loading, isApproved, isAssistant, canViewAp, canViewImpulse } = useAuth()
  const { pathname } = useLocation()
  const preview = usePutzplanPreview()
  const identity = loading
    ? null
    : appIdentityFor({
        isApproved,
        isAssistant,
        canViewAp,
        canViewImpulse,
        pathname,
        putzplanPreview: preview.active,
      })
  useEffect(() => {
    if (identity) applyAppIdentity(identity)
  }, [identity])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <PushNavigation />
        <ToastProvider>
          <AuthProvider>
            <AppIdentitySwitch />
            <DataProvider>
              <Routes>
                <Route path="/anmelden" element={<LoginRoute />} />

                <Route
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  {/* ---------- Aktivitäten AP ----------
                    Steht ausserhalb von `RequireFullAccess`: Berater und
                    Jugendführung erreichen genau diesen Bereich – und sonst
                    nichts.

                    Und ausserhalb der Anmeldung: `/ap` steht in
                    `PUBLIC_PATHS`, `RequireAuth` lässt die Adresse deshalb
                    auch ohne Konto durch. Derselbe Link, dieselbe Seite –
                    ohne Schreibrecht bloss ohne die Knöpfe. */}
                  <Route
                    path="ap"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <ApActivities />
                      </Suspense>
                    }
                  />

                  {/* ---------- Putzplan ----------
                    Aus demselben Grund ausserhalb von `RequireFullAccess`
                    und in `PUBLIC_PATHS`: Der QR-Code auf dem ausgedruckten
                    Plan führt hierher. Ohne Vollzugriff zeigt die Seite nur,
                    wer dran ist – ändern lässt sich dort nichts. */}
                  <Route
                    path="putzplan"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <Cleaning />
                      </Suspense>
                    }
                  />

                  {/* ---------- Anti Doom ----------
                    Ebenfalls ausserhalb von `RequireFullAccess`: Der Bereich
                    wird pro Konto freigeschaltet und steht damit auch Konten
                    offen, die sonst nur den AP-Kalender sehen. */}
                  <Route element={<RequireImpulse />}>
                    {/* Eine Route mit wahlfreiem Teil statt zweier
                        Geschwister: `/anti-doom` und `/anti-doom/quiz` sind
                        so dieselbe Route, und die Seite bleibt beim Springen
                        zwischen Karten, Räumen und Einstellungen montiert –
                        samt Stapel-Position und gewählter Rückblick-Woche.
                        Die statische Route «redaktion» geht vor. */}
                    <Route
                      path="anti-doom/:bereich?"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Impuls />
                        </Suspense>
                      }
                    />
                    <Route element={<RequireImpulseEditor />}>
                      <Route
                        path="anti-doom/redaktion"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImpulsRedaktion />
                          </Suspense>
                        }
                      />
                    </Route>
                    {/* Der Bereich hiess einmal «Impuls» – alte Lesezeichen
                        und verschickte Links führen weiterhin ans Ziel. */}
                    <Route
                      path="impuls/redaktion"
                      element={<Navigate to="/anti-doom/redaktion" replace />}
                    />
                    <Route path="impuls/:bereich?" element={<LegacyImpulsRedirect />} />
                  </Route>

                  {/* ---------- Abendmahlsversammlung ----------
                    Ebenfalls ausserhalb von `RequireFullAccess`: Die Rolle
                    «Assistent» erreicht genau die Bereiche, die an ihrem
                    Konto angehakt sind – und sonst nichts. Jede Unterseite
                    trägt deshalb ihre eigene Weiche; «Leitung»,
                    «Bekanntmachungen» und «Angelegenheiten» bleiben beim
                    Vollzugriff. */}
                  <Route
                    path="abendmahl"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <SacramentLayout />
                      </Suspense>
                    }
                  >
                    <Route index element={<SacramentIndex />} />
                    <Route element={<RequireFullAccess />}>
                      <Route
                        path="leitung"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Conducting />
                          </Suspense>
                        }
                      />
                      <Route
                        path="bekanntmachungen"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Announcements />
                          </Suspense>
                        }
                      />
                      <Route
                        path="angelegenheiten"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <WardBusiness />
                          </Suspense>
                        }
                      />
                    </Route>
                    <Route element={<RequireSacramentArea area="talks" />}>
                      <Route
                        path="ansprachen"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Talks />
                          </Suspense>
                        }
                      />
                    </Route>
                    <Route element={<RequireSacramentArea area="music" />}>
                      <Route
                        path="musik"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Music />
                          </Suspense>
                        }
                      />
                    </Route>
                    <Route element={<RequireSacramentArea area="prayers" />}>
                      <Route
                        path="gebet"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Prayers />
                          </Suspense>
                        }
                      />
                    </Route>
                  </Route>

                  {/* Alte Adresse aus früheren Versionen – Lesezeichen sollen weiter funktionieren. */}
                  <Route
                    path="ansprachen"
                    element={<Navigate to="/abendmahl/ansprachen" replace />}
                  />

                  <Route element={<RequireFullAccess />}>
                    <Route index element={<Dashboard />} />
                    <Route path="sitzungen" element={<Meetings />} />
                    <Route path="sitzungen/:meetingId" element={<MeetingDetail />} />
                    <Route path="pendenzen" element={<Pendenzen />} />
                    <Route
                      path="notizen"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Notes />
                        </Suspense>
                      }
                    />
                    <Route
                      path="mitglieder"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Members />
                        </Suspense>
                      }
                    />
                    <Route
                      path="mitglieder/:memberId"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <MemberDetail />
                        </Suspense>
                      }
                    />
                    <Route
                      path="berufungen"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Callings />
                        </Suspense>
                      }
                    />
                    <Route
                      path="einstellungen"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Settings />
                        </Suspense>
                      }
                    />
                    <Route
                      path="import"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportMembers />
                        </Suspense>
                      }
                    />
                    <Route
                      path="import/berufungen"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportCallings />
                        </Suspense>
                      }
                    />
                    <Route
                      path="import/betreuung"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportMinistering />
                        </Suspense>
                      }
                    />
                    <Route
                      path="import/ap-themen"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportApTopics />
                        </Suspense>
                      }
                    />
                    <Route
                      path="import/alleinstehende"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportSingles />
                        </Suspense>
                      }
                    />

                    {/* ---------- Zugriffsprotokoll ----------
                        Wer wann da war und was sich geändert hat – allein für
                        das Administrator-Konto, erreichbar zuunterst in den
                        Einstellungen. */}
                    <Route element={<RequireAdmin to="/" />}>
                      <Route
                        path="zugriffe"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <AccessLog />
                          </Suspense>
                        }
                      />
                    </Route>

                    {/* ---------- Admin-Importe ----------
                        Einmalig beim Einrichten gebraucht; sichtbar und
                        erreichbar allein für das Administrator-Konto. */}
                    <Route element={<RequireAdmin to="/import" />}>
                      <Route
                        path="import/aktivitaeten"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImportApActivities />
                          </Suspense>
                        }
                      />
                      <Route
                        path="import/sitzungen"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImportMinutes />
                          </Suspense>
                        }
                      />
                      <Route
                        path="import/verlauf"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImportHistory />
                          </Suspense>
                        }
                      />
                      <Route
                        path="import/lieder"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImportHymns />
                          </Suspense>
                        }
                      />
                      <Route
                        path="import/putzgruppen"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <ImportCleaningGroups />
                          </Suspense>
                        }
                      />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </DataProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

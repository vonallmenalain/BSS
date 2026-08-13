import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { useAccessLog } from '@/hooks/useAccessLog'
import { Layout } from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingScreen } from '@/components/ui/Feedback'
import { Login } from '@/pages/Login'
import { PendingApproval } from '@/pages/PendingApproval'
import { Dashboard } from '@/pages/Dashboard'
import { Meetings } from '@/pages/Meetings'
import { MeetingDetail } from '@/pages/MeetingDetail'
import { Pendenzen } from '@/pages/Pendenzen'

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
const ImportCleaning = lazy(() =>
  import('@/pages/ImportCleaning').then((m) => ({ default: m.ImportCleaning })),
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

/* Aktivitäten AP – der einzige Bereich, den auch Konten ohne Vollzugriff sehen. */
const ApActivities = lazy(() =>
  import('@/pages/ApActivities').then((m) => ({ default: m.ApActivities })),
)

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
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, isApproved, canViewAp, canViewImpulse } = useAuth()

  /*
   * Hier und nicht tiefer: Diese Stelle sieht jedes angemeldete Konto, auch
   * eines, das noch auf die Freigabe wartet. Dass jemand sich anmeldet und
   * wieder geht, ohne je etwas zu sehen, gehört ins Protokoll – es ist die
   * Zeile, wegen der man es aufschlägt.
   */
  useAccessLog()

  if (loading) return <LoadingScreen label="Anmeldung wird geprüft …" />
  if (!firebaseUser) return <Navigate to="/anmelden" replace />
  if (!isApproved && !canViewAp && !canViewImpulse) return <PendingApproval />

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
  const { isApproved, canViewAp } = useAuth()
  if (!isApproved) return <Navigate to={canViewAp ? '/ap' : '/anti-doom'} replace />
  return <Outlet />
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
  const { canViewImpulse, isApproved } = useAuth()
  if (!canViewImpulse) return <Navigate to={isApproved ? '/' : '/ap'} replace />
  return <Outlet />
}

/**
 * Die Redaktion des Bereichs «Anti Doom» – Inhalte pflegen und moderieren.
 *
 * Vorerst allein das Administrator-Konto; der Schalter `impulseEditor`
 * steht bereit. Wer nur liest, landet wieder im Bereich – die
 * Zugriffsregeln liessen ihn ohnehin nichts schreiben.
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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
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
                    nichts. */}
                  <Route
                    path="ap"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <ApActivities />
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
                    <Route path="impuls/redaktion" element={<Navigate to="/anti-doom/redaktion" replace />} />
                    <Route path="impuls/:bereich?" element={<LegacyImpulsRedirect />} />
                  </Route>

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
                      path="putzplan"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <Cleaning />
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
                    {/* ---------- Abendmahlsversammlung ---------- */}
                    <Route
                      path="abendmahl"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <SacramentLayout />
                        </Suspense>
                      }
                    >
                      <Route index element={<Navigate to="leitung" replace />} />
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
                      <Route
                        path="ansprachen"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Talks />
                          </Suspense>
                        }
                      />
                      <Route
                        path="musik"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Music />
                          </Suspense>
                        }
                      />
                      <Route
                        path="gebet"
                        element={
                          <Suspense fallback={<LoadingScreen />}>
                            <Prayers />
                          </Suspense>
                        }
                      />
                    </Route>

                    {/* Alte Adresse aus früheren Versionen – Lesezeichen sollen weiter funktionieren. */}
                    <Route
                      path="ansprachen"
                      element={<Navigate to="/abendmahl/ansprachen" replace />}
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
                      path="import/putzplan"
                      element={
                        <Suspense fallback={<LoadingScreen />}>
                          <ImportCleaning />
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

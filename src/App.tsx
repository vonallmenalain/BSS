import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { Layout } from '@/components/Layout'
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
const Talks = lazy(() => import('@/pages/Talks').then((m) => ({ default: m.Talks })))
const Callings = lazy(() => import('@/pages/Callings').then((m) => ({ default: m.Callings })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
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

/** Lässt nur angemeldete und freigeschaltete Personen durch. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, isApproved } = useAuth()

  if (loading) return <LoadingScreen label="Anmeldung wird geprüft …" />
  if (!firebaseUser) return <Navigate to="/anmelden" replace />
  if (!isApproved) return <PendingApproval />

  return <>{children}</>
}

function LoginRoute() {
  const { firebaseUser, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (firebaseUser) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
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
                <Route index element={<Dashboard />} />
                <Route path="sitzungen" element={<Meetings />} />
                <Route path="sitzungen/:meetingId" element={<MeetingDetail />} />
                <Route path="pendenzen" element={<Pendenzen />} />

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

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

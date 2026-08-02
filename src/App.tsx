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

/** Lässt nur angemeldete und freigeschaltete Personen durch. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, isApproved } = useAuth()

  if (loading) return <LoadingScreen label="Anmeldung wird geprüft …" />
  if (!firebaseUser) return <Navigate to="/anmelden" replace />
  if (!isApproved) return <PendingApproval />

  return <>{children}</>
}

/** Bereiche, die nur Bischof und Ratgeber offenstehen. */
function RequireLeadership({ children }: { children: ReactNode }) {
  const { isLeadership } = useAuth()
  if (!isLeadership) return <Navigate to="/" replace />
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
                <Route
                  path="ansprachen"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <Talks />
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
                    <RequireLeadership>
                      <Suspense fallback={<LoadingScreen />}>
                        <ImportMembers />
                      </Suspense>
                    </RequireLeadership>
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

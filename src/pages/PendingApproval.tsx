import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Wartebereich für Konten, die noch keine Rolle haben.
 * Ohne Freigabe kommt niemand an Personendaten – das ist bewusst so.
 */
export function PendingApproval() {
  const { profile, firebaseUser, signOut } = useAuth()
  const name = profile?.displayName ?? firebaseUser?.displayName ?? ''
  const inactive = profile && !profile.active

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-100 dark:bg-amber-950">
          <Clock className="size-6 text-amber-600 dark:text-amber-300" aria-hidden />
        </div>

        <h1 className="text-lg font-semibold">
          {inactive ? 'Zugang deaktiviert' : 'Freigabe ausstehend'}
        </h1>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {inactive ? (
            <>Dein Zugang wurde deaktiviert. Bitte wende dich an den Bischof.</>
          ) : (
            <>
              Hallo {name}, dein Konto wurde erstellt. Ein Mitglied der Bischofschaft muss dir noch
              eine Rolle zuweisen, bevor du die Daten sehen kannst.
            </>
          )}
        </p>

        {!inactive && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
              Für die Bischofschaft: So schaltest du frei
            </p>
            <p>
              Einstellungen → Benutzer und Rollen → das Konto <strong>{profile?.email}</strong>{' '}
              steht unter «Neue Registrierungen». Dort lässt sich wählen zwischen Vollzugriff und
              einem Zugang, der ausschliesslich «Aktivitäten AP’s» zeigt – mit oder ohne
              Schreibrecht.
            </p>
            <p className="mt-1">
              Beim allerersten Konto geht das noch nicht — setze das Feld <code>role</code> einmalig
              in der Firebase-Konsole auf <code>bishop</code>.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden />
            Neu prüfen
          </button>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden />
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}

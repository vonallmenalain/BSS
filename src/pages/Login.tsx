import { useState, type FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { isFirebaseConfigured, missingConfigKeys } from '@/lib/firebase'

type Mode = 'signin' | 'signup' | 'reset'

export function Login() {
  const { signIn, signUp, resetPassword, error, clearError } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => {
    clearError()
    setMode(next)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          toast.error('Bitte gib deinen Namen an.')
          return
        }
        await signUp(email, password, displayName)
        toast.success('Konto erstellt. Ein Leiter muss dich noch freischalten.')
      } else {
        await resetPassword(email)
        toast.success('E-Mail zum Zurücksetzen wurde versendet.')
        switchMode('signin')
      }
    } catch {
      // Fehlermeldung kommt aus dem AuthContext und wird unten angezeigt.
    } finally {
      setBusy(false)
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="card max-w-lg p-6">
          <div className="mb-3 flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-5" aria-hidden />
            <h1 className="text-base font-semibold">Firebase ist noch nicht konfiguriert</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Diese Umgebungsvariablen fehlen:
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {missingConfigKeys.map((key) => (
              <li key={key} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
                {key}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Lege lokal eine <code className="font-mono text-xs">.env</code> nach dem Muster von{' '}
            <code className="font-mono text-xs">.env.example</code> an. Für die Produktion trägst du
            die Werte in Netlify unter <em>Site configuration → Environment variables</em> ein.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="bg-brand-600 mx-auto mb-3 grid size-14 place-items-center rounded-2xl text-xl font-bold text-white shadow-lg">
            BS
          </span>
          <h1 className="text-xl font-semibold">Bischofschaft</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Organisation Bischofschaft und AP’s
          </p>
        </div>

        <div className="card p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="label" htmlFor="password">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {mode === 'signup' && <p className="hint">Mindestens 6 Zeichen.</p>}
              </div>
            )}

            {error && (
              <div
                className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                role="alert"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {mode === 'signin'
                ? 'Anmelden'
                : mode === 'signup'
                  ? 'Konto erstellen'
                  : 'Link senden'}
            </button>
          </form>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-center text-sm dark:border-slate-800">
            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-brand-600 dark:text-brand-300 hover:underline"
                >
                  Passwort vergessen?
                </button>
                <p className="text-slate-500 dark:text-slate-400">
                  Noch kein Konto?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
                  >
                    Registrieren
                  </button>
                </p>
              </>
            )}
            {mode !== 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-brand-600 dark:text-brand-300 hover:underline"
              >
                Zurück zur Anmeldung
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Neue Konten werden erst nach Freigabe durch die Bischofschaft aktiv.
        </p>
      </div>
    </div>
  )
}

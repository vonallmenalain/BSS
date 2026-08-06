import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { setSyncFailureReporter, type SaveOutcome } from '@/lib/sync'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  kind: ToastKind
  message: string
  /** Ein Knopf in der Meldung – etwa «Rückgängig» nach dem Löschen. */
  action?: { label: string; onClick: () => void | Promise<void> }
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
  /**
   * Rückmeldung nach dem Speichern. Ohne Verbindung wird die Änderung
   * zwischengespeichert – das sagt die Meldung dann auch, statt einen
   * Erfolg zu behaupten, der noch aussteht.
   */
  saved: (message: string, outcome?: SaveOutcome) => void
  /**
   * Meldung nach dem Löschen, mit ein paar Sekunden Reue: Ein Griff auf
   * «Rückgängig» stellt den Eintrag wieder her. Das ersetzt die Rückfrage
   * vor dem Löschen dort, wo eine Rückfrage bei jedem Handgriff stören
   * würde – gelöscht ist erst, wer die Meldung verstreichen lässt.
   */
  undo: (message: string, onUndo: () => void | Promise<void>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES: Record<ToastKind, string> = {
  success:
    'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
  error:
    'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-800',
  warning:
    'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  info: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info', action?: Toast['action']) => {
      const id = uid()
      setToasts((current) => [...current, { id, kind, message, action }])
      // Fehler bleiben länger stehen, damit man sie sicher liest – und eine
      // Meldung mit «Rückgängig» ebenfalls, denn sie ist die einzige
      // Gelegenheit dazu.
      setTimeout(() => dismiss(id), kind === 'error' || action ? 8000 : 4000)
    },
    [dismiss],
  )

  // Fehler, die erst beim Übertragen einer zwischengespeicherten Änderung
  // auftreten, haben keinen Aufrufer mehr, der sie anzeigen könnte.
  useEffect(() => {
    setSyncFailureReporter((error) => {
      console.error('[sync] Änderung konnte nicht übertragen werden:', error)
      toast(
        'Eine zwischengespeicherte Änderung konnte nicht übertragen werden. Bitte prüfe den Eintrag.',
        'error',
      )
    })
    return () => setSyncFailureReporter(null)
  }, [toast])

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m: string) => toast(m, 'success'),
      error: (m: string) => toast(m, 'error'),
      info: (m: string) => toast(m, 'info'),
      warning: (m: string) => toast(m, 'warning'),
      saved: (m: string, outcome?: SaveOutcome) =>
        outcome === 'queued'
          ? toast(`${m} Wird übertragen, sobald wieder Verbindung besteht.`, 'info')
          : toast(m, 'success'),
      undo: (m: string, onUndo: () => void | Promise<void>) =>
        toast(m, 'info', {
          label: 'Rückgängig',
          onClick: async () => {
            try {
              await onUndo()
            } catch (error) {
              console.error(error)
              toast('Konnte nicht wiederhergestellt werden.', 'error')
            }
          },
        }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              className={cn(
                'animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur',
                STYLES[t.kind],
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(t.id)
                    void t.action?.onClick()
                  }}
                  className="-my-1 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold underline underline-offset-2 transition hover:opacity-80"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-lg p-1 opacity-60 transition hover:opacity-100"
                aria-label="Meldung schliessen"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast muss innerhalb von <ToastProvider> verwendet werden.')
  return context
}

import { Component, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * Fängt Renderfehler ab, bevor sie die ganze App in einen weissen Bildschirm
 * verwandeln.
 *
 * Zwei Einsatzorte: einmal ganz aussen um die App (falls der Rahmen selbst
 * bricht) und einmal um den Seiteninhalt im Layout – dort bleibt bei einem
 * Fehler die Navigation stehen, und man kann einfach woandershin ausweichen.
 *
 * `resetKey` setzt den Fehlerzustand beim Seitenwechsel zurück: Wer über die
 * Navigation eine andere Seite öffnet, bekommt wieder einen normalen Versuch.
 */

interface Props {
  children: ReactNode
  /** Ändert sich dieser Wert, wird ein gefangener Fehler verworfen. */
  resetKey?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Für die Fehlersuche: Der Nutzer sieht nur die freundliche Meldung.
    console.error(error)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center"
        role="alert"
      >
        <div className="mb-3 rounded-full bg-amber-100 p-3 dark:bg-amber-500/15">
          <TriangleAlert className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Da ist etwas schiefgelaufen
        </h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Die Ansicht konnte nicht angezeigt werden. Deine Daten sind davon nicht betroffen – ein
          Neuladen behebt das Problem in aller Regel.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </div>
    )
  }
}

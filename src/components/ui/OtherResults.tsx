import { useState, type ReactNode } from 'react'
import { SearchX } from 'lucide-react'

/**
 * Treffer, die der eingestellte Filter wegnimmt – unter dem eigentlichen
 * Ergebnis und deutlich davon getrennt.
 *
 * Eine Suche und ein Filter beantworten zwei verschiedene Fragen. Der Filter
 * sagt, welchen Ausschnitt man **gerade liest** – die offenen Pendenzen, die
 * aktiven Mitglieder, die kommenden Wochen. Die Suche fragt dagegen, **wo
 * etwas steht**, und die Antwort darauf endet nicht am Rand des Ausschnitts:
 * Wer unter «Pendent» nach «Taufe» sucht, will wissen, ob dazu etwas da ist –
 * auch wenn es letztes Jahr abgehakt wurde.
 *
 * Bisher fiel das stillschweigend weg, und man musste den Filter erst
 * zurückstellen, um überhaupt zu erfahren, dass es etwas gibt. Jetzt steht es
 * hier: getrennt, benannt und nachgeordnet. Der Ausschnitt bleibt damit der
 * Ausschnitt – was nicht dazugehört, steht sichtbar ausserhalb und wird nicht
 * unter das Ergebnis gemischt.
 *
 * **Nur bei einer Suche.** Ohne Suchbegriff ist ein Filter genau das, worum
 * gebeten wurde; alles Weggefilterte darunter aufzuführen hiesse, ihn wieder
 * aufzuheben. Die Seiten rufen diesen Abschnitt deshalb nur auf, solange
 * etwas im Suchfeld steht.
 *
 * Gezeigt wird ein Ausschnitt, wie in der Hauptliste auch: Ein Suchbegriff
 * wie «Berufung» trifft im Archiv leicht hundert Einträge, und die stünden
 * sonst alle auf einmal da. Der Rest kommt auf Knopfdruck nach.
 */
export function OtherResults<T>({
  items,
  listKey,
  hint,
  pageSize = 20,
  children,
}: {
  /** Was zur Suche passt, aber ausserhalb des Filters liegt. */
  items: T[]
  /**
   * Woraus diese Zusammenstellung entstand – Suchbegriff und Filter.
   *
   * Ändert er sich, beginnt der Ausschnitt wieder oben. Die blosse Anzahl
   * genügte dafür nicht: Ein anderer Suchbegriff kann gleich viele Treffer
   * haben, und man stünde mitten in einer Liste, die man nie geöffnet hat.
   */
  listKey: string
  /**
   * Welcher Filter es wegnimmt – ein Satz, der den Grund benennt.
   *
   * Ohne Angabe steht der allgemeine Satz; wo die Seite es genauer sagen
   * kann («ausserhalb von ‹Pendent›», «nicht aktive Mitglieder»), ist das
   * besser als ein Hinweis, der für jede Liste derselbe ist.
   */
  hint?: string
  /** Wie viele auf einmal – der Rest kommt auf Knopfdruck nach. */
  pageSize?: number
  /** Die Liste selbst – gezeichnet wie in der Hauptliste, damit sie gleich aussieht. */
  children: (page: T[]) => ReactNode
}) {
  /*
   * Der Ausschnitt beginnt bei jeder neuen Zusammenstellung wieder oben.
   *
   * Zurückgesetzt wird beim Zeichnen und nicht in einem Effekt: Sonst stünde
   * für einen Durchgang die alte Anzahl an der neuen Liste – wie in der
   * Hauptliste auch.
   */
  const [shown, setShown] = useState(pageSize)
  const [shownFor, setShownFor] = useState(listKey)
  if (shownFor !== listKey) {
    setShownFor(listKey)
    setShown(pageSize)
  }

  if (items.length === 0) return null

  const rest = Math.max(0, items.length - shown)

  return (
    <section className="mt-6 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700">
      <div className="mb-1 flex flex-wrap items-center gap-x-2">
        <SearchX className="size-4 shrink-0 text-slate-400" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Weitere Treffer ausserhalb der Filter
        </h2>
        <span className="tabular text-xs text-slate-400">{items.length}</span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {hint ?? 'Diese Einträge passen zur Suche, werden aber durch die Filter ausgeblendet.'}
      </p>

      {/* Die Zeilen selbst bleiben, wie sie oben aussehen – und lassen sich
          genauso öffnen und bearbeiten. Abgesetzt sind sie durch die Linie
          und die Überschrift darüber; sie blasser zu zeichnen machte sie
          bloss schlechter lesbar, ohne mehr zu sagen. */}
      {children(items.slice(0, shown))}

      {rest > 0 && (
        <button
          type="button"
          className="btn-secondary btn-sm mt-3 w-full"
          onClick={() => setShown((current) => current + pageSize)}
        >
          Weitere anzeigen · noch {rest}
        </button>
      )}
    </section>
  )
}

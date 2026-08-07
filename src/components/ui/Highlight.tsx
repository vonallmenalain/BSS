import { Fragment } from 'react'
import { searchHits } from '@/lib/search'

/**
 * Text mit hervorgehobenen Fundstellen.
 *
 * Gelb unterlegt wie mit dem Leuchtstift – dieselbe Geste wie auf Papier,
 * und sie braucht keine Erklärung. Ohne Suchbegriff oder ohne Fundstelle
 * steht schlicht der Text da; die Komponente lässt sich deshalb überall
 * einsetzen, wo sonst der Text selbst stünde.
 *
 * Hervorgehoben wird die Stelle im ursprünglichen Text mit ihren Umlauten,
 * nicht eine vereinfachte Fassung davon (siehe `lib/search`).
 */
export function Highlight({ text, term }: { text: string; term: string }) {
  const hits = searchHits(text, term)
  if (hits.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let at = 0

  hits.forEach((hit, index) => {
    if (hit.start > at)
      parts.push(<Fragment key={`t${index}`}>{text.slice(at, hit.start)}</Fragment>)
    parts.push(
      <mark
        key={`h${index}`}
        className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/40"
      >
        {text.slice(hit.start, hit.end)}
      </mark>,
    )
    at = hit.end
  })

  if (at < text.length) parts.push(<Fragment key="rest">{text.slice(at)}</Fragment>)

  return <>{parts}</>
}

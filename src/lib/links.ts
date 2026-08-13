/**
 * Verweise in einem Text finden, damit die Oberfläche sie anklickbar machen
 * kann.
 *
 * Bewusst ohne Abhängigkeiten und ohne Browser, damit sich die Regeln mit
 * `node --test` prüfen lassen.
 */

/**
 * Ein Stück Text: entweder gewöhnlicher Text oder ein Verweis.
 *
 * Der Text bleibt so, wie er dasteht – auch beim Verweis. Angezeigt wird, was
 * jemand geschrieben hat («www.sbb.ch»), aufgerufen wird die Adresse mit
 * Schema («https://www.sbb.ch»). Beides auseinanderzuhalten erspart es, den
 * Text beim Speichern zu verändern.
 */
export interface TextPart {
  text: string
  /** Gesetzt, wenn dieses Stück ein Verweis ist. */
  href?: string
}

/**
 * Findet `https://…`, `http://…`, `www.…` und E-Mail-Adressen.
 *
 * Bewusst diese vier und nicht «alles, was nach einer Domain aussieht»: Ein
 * Satz wie «Das kostet 12.50 pro Person» enthält keinen Verweis, und ein
 * Muster, das ihn dafür hält, macht aus jeder Notiz ein Minenfeld.
 */
const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"]+|[^\s<>"@]+@[^\s<>"@]+\.[a-zA-Z]{2,})/g

/**
 * Zeichen, die am Ende eines Verweises fast nie dazugehören.
 *
 * «Siehe https://sbb.ch.» endet mit einem Punkt, der zum Satz gehört und nicht
 * zur Adresse. Eine schliessende Klammer bleibt nur stehen, wenn im Verweis
 * auch eine öffnende steht – Wikipedia-Adressen leben davon.
 */
function trimTrailing(raw: string): { link: string; rest: string } {
  let link = raw

  while (link.length > 0) {
    const last = link[link.length - 1] as string
    if ('.,;:!?«»"\''.includes(last)) {
      link = link.slice(0, -1)
      continue
    }
    if (last === ')' && !link.includes('(')) {
      link = link.slice(0, -1)
      continue
    }
    break
  }

  return { link, rest: raw.slice(link.length) }
}

/** Die Adresse, die hinter einem gefundenen Stück steckt. */
function hrefFor(link: string): string {
  if (/^https?:\/\//i.test(link)) return link
  if (link.includes('@')) return `mailto:${link}`
  return `https://${link}`
}

/**
 * Eine Zeile «Alma 32:27 – https://…» – Beschriftung, Gedankenstrich,
 * Adresse.
 *
 * So schreiben die Vertiefungen ihre Quellen an, und die Oberfläche macht
 * daraus einen anklickbaren Verweis mit Beschriftung statt der rohen
 * Adresse – dieselbe Gestalt wie die Quellenangabe einer Karte. `null`,
 * wenn die Zeile keine solche ist; dann greift weiterhin `splitLinks`.
 * Die Beschriftung darf selbst Gedankenstriche tragen («Alma 32:41–43»):
 * Als Trenner zählt der letzte vor der Adresse.
 */
export function labeledLink(line: string): { label: string; href: string } | null {
  const match = /^(.+?)\s*[–—-]\s*((?:https?:\/\/|www\.)[^\s<>"]+)$/.exec(line.trim())
  if (!match) return null
  const label = match[1].trim()
  const { link } = trimTrailing(match[2])
  if (!label || !link) return null
  return { label, href: hrefFor(link) }
}

/** Zerlegt einen Text in Stücke – Text, Verweis, Text … */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let position = 0

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0
    const { link, rest } = trimTrailing(match[0])
    if (link === '') continue

    if (start > position) parts.push({ text: text.slice(position, start) })

    parts.push({ text: link, href: hrefFor(link) })
    if (rest) parts.push({ text: rest })

    position = start + match[0].length
  }

  if (position < text.length) parts.push({ text: text.slice(position) })
  return parts
}

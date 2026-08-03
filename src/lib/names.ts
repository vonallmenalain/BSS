/**
 * Namen vergleichen, wie Menschen sie schreiben.
 *
 * Dieselbe Person heisst in zwei Listen selten gleich. Die Unterschiede
 * sind aber nicht beliebig, sondern folgen wenigen Mustern:
 *
 *  - **Umlaute.** «Bürge» und «Buerge», «Hansjörg» und «Hansjoerg»,
 *    «Gräppi» und «Graeppi». Wer auf einer fremden Tastatur tippt oder aus
 *    einem alten System exportiert, schreibt sie aus.
 *  - **Akzente.** «Céline» und «Celine».
 *  - **Zweitnamen.** Im Verzeichnis steht «Anne Christiane», in der Liste
 *    nur «Christiane».
 *  - **Abkürzungen.** «Joshua B.» statt «Joshua Brandon».
 *
 * Deshalb bekommt jeder Name **zwei** Vergleichsformen: einmal mit
 * ausgeschriebenen Umlauten («buerge»), einmal mit aufgelösten («burge»).
 * Wer eine der beiden trifft, meint dieselbe Person. Ein einzelner
 * Schlüssel ginge nicht: Nach «u» zusammenzuziehen würde aus «Manuel»
 * «manul» machen, nach «ue» auszuschreiben trifft «Burri» nicht.
 *
 * Bewusst ohne Abhängigkeiten, damit sich die Regeln mit `node --test`
 * prüfen lassen.
 */

const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
}

function clean(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** «Bürge» → «buerge» – so, wie man den Namen ohne Umlauttaste tippt. */
function spelledOut(text: string): string {
  return stripAccents(clean(text).replace(/[äöüß]/g, (char) => UMLAUTS[char]))
}

/** «Bürge» → «burge» – der Umlaut auf seinen Grundbuchstaben zurückgeführt. */
function withoutAccents(text: string): string {
  return stripAccents(clean(text).replace(/ß/g, 'ss'))
}

/**
 * Die Vergleichsformen eines Namens – eine oder zwei.
 *
 * Zwei Namen meinen dieselbe Person, sobald sich ihre Listen berühren.
 */
export function nameKeys(text: string): string[] {
  const spelled = spelledOut(text)
  const plain = withoutAccents(text)
  return spelled === plain ? [spelled] : [spelled, plain]
}

/** Ein einzelner Schlüssel – für Fälle, in denen nur einer gebraucht wird. */
export function nameKey(text: string): string {
  return spelledOut(text)
}

/** «Anne Christiane» → [«anne», «christiane»]; Doppelnamen zählen einzeln. */
function givenNameTokens(text: string): string[] {
  return spelledOut(text.replace(/\./g, ' '))
    .split(/[\s-]+/)
    .filter(Boolean)
}

/**
 * Passt der Vorname aus der Quelle zu dem des Mitglieds?
 *
 * Jeder Bestandteil der Quelle muss sich beim Mitglied wiederfinden – als
 * ganzer Vorname oder, bei einem einzelnen Buchstaben, als dessen Anfang.
 * «Christiane» passt damit zu «Anne Christiane» und «Joshua B.» zu
 * «Joshua Brandon», «Celine Müller» aber zu keiner der beiden Célines:
 * Ein halber Treffer ist kein Treffer, und der Rest gehört von Hand
 * zugeordnet statt geraten.
 */
export function matchesGivenNames(source: string, target: string): boolean {
  const wanted = givenNameTokens(source)
  if (wanted.length === 0) return true

  const have = givenNameTokens(target)
  return wanted.every((token) =>
    have.some((candidate) =>
      token.length === 1 ? candidate.startsWith(token) : candidate === token,
    ),
  )
}

/** Stimmen die Vornamen vollständig überein? */
export function sameGivenNames(a: string, b: string): boolean {
  return spelledOut(a) === spelledOut(b)
}

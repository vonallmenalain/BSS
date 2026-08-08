import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  BULLET_MARKS,
  formatClass,
  groupPieces,
  type RichGroup,
  type RichLine,
  type RichPiece,
} from '@/lib/textFormat'

/**
 * Die Darstellung ausgezeichneter Texte – Aufzählung und Farben.
 *
 * Zerlegt wird in `lib/textFormat`, gezeichnet hier. Was ausser der Farbe
 * noch an einem Stück Text hängt, weiss diese Datei nicht: Ob daraus ein
 * Verweis auf ein Mitglied wird (`MentionText`) oder auf eine Adresse
 * (`Notizen`), sagt der Aufrufer mit `render`.
 */

/** Farbe und Hintergrund um ein Stück Text – oder gar nichts. */
export function Pieces({ pieces }: { pieces: RichPiece[] }): ReactNode {
  return (
    <>
      {pieces.map((piece, index) => {
        const className = formatClass(piece)
        return className ? (
          <span key={index} className={className}>
            {piece.text}
          </span>
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        )
      })}
    </>
  )
}

/**
 * Die Zeilen eines Textes.
 *
 * **Ohne Aufzählung bleibt alles, wie es war**: ein durchlaufender Text, in
 * dem die Zeilenumbrüche selbst als Zeichen stehen. Das Umbrechen besorgt
 * `whitespace-pre-wrap` beim Aufrufer, so wie bisher – ein Text ohne
 * Aufzählung wird also von nichts angefasst, was er nicht schon kannte.
 *
 * **Mit Aufzählung wird jede Zeile ein eigener Block.** Anders ginge es
 * nicht: Ein Aufzählungszeichen mit hängendem Einzug braucht eine Zeile, die
 * eine Breite hat – und dann darf zwischen den Zeilen kein Umbruchzeichen
 * mehr stehen, sonst klaffte überall eine Leerzeile.
 */
export function RichLines({
  lines,
  render,
}: {
  lines: RichLine[]
  /** Ein Stück Zeile zeichnen – mit allem, was der Aufrufer daraus macht. */
  render: (group: RichGroup, key: number) => ReactNode
}): ReactNode {
  const bullets = lines.some((line) => line.level !== null)

  if (!bullets) {
    return (
      <>
        {lines.map((line, index) => (
          <Fragment key={index}>
            {index > 0 && '\n'}
            {groupPieces(line.pieces).map(render)}
          </Fragment>
        ))}
      </>
    )
  }

  return (
    <>
      {lines.map((line, index) => {
        const groups = groupPieces(line.pieces)

        if (line.level === null) {
          return (
            <span key={index} className="block whitespace-pre-wrap">
              {/* Eine leere Zeile ist auch eine Zeile – ohne etwas darin
                  fiele sie in sich zusammen, und der Absatz davor klebte am
                  Absatz danach. */}
              {groups.length > 0 ? groups.map(render) : ' '}
            </span>
          )
        }

        return (
          <span
            key={index}
            className="flex gap-1.5"
            style={{ paddingLeft: `${line.level * 1.1}rem` }}
          >
            {/* Das Zeichen nimmt die Schriftfarbe des ersten Stücks an: Eine
                ganz rote Zeile mit schwarzem Punkt davor sähe aus wie ein
                Fehler. Den Leuchtstift bekommt es nicht – der gehört auf den
                Text und nicht auf das Zeichen davor. Für Bildschirmleser
                steht es gar nicht da; dort ist die Zeile eine Zeile. */}
            <span
              aria-hidden
              className={cn('shrink-0 select-none', formatClass({ color: line.pieces[0]?.color }))}
            >
              {BULLET_MARKS[line.level]}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{groups.map(render)}</span>
          </span>
        )
      })}
    </>
  )
}

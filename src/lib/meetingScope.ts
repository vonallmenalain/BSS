// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { toDate } from './dates.ts'
import type { Meeting } from './types.ts'

/**
 * Gehört eine Sitzung unter «Anstehend»?
 *
 *  - **Läuft sie, immer** – auch wenn ihr Termin schon vorbei ist: Wer
 *    mitten in der Sitzung die Liste öffnet, sucht genau diese.
 *  - **Ist sie abgeschlossen, nie.** Mit «Abschliessen» ist sie erledigt,
 *    und unter «Anstehend» steht, was noch kommt. Sie wechselt im selben
 *    Augenblick unter «Vergangen».
 *  - **Sonst bis zum Ende ihres Tages.** Eine Sitzung von heute Abend steht
 *    den ganzen Tag da, auch nachdem sie begonnen hätte; eine, die gestern
 *    niemand abgeschlossen hat, rückt heute unter «Vergangen».
 *
 * Bisher galten 24 Stunden ab Beginn – und abgeschlossen oder nicht spielte
 * keine Rolle. Eine Sitzung vom Donnerstagabend stand so bis Freitagabend
 * unter «Anstehend», obwohl sie längst abgeschlossen war.
 */
export function isUpcomingMeeting(meeting: Pick<Meeting, 'status' | 'date'>, now: number): boolean {
  if (meeting.status === 'running') return true
  if (meeting.status === 'closed') return false

  const date = toDate(meeting.date)
  if (!date) return false

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return date.getTime() >= today.getTime()
}

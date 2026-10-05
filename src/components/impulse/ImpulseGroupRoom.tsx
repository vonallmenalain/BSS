import { useState } from 'react'
import { Star } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ImpulseCrestEmblem } from '@/components/impulse/ImpulseCrest'
import { cn } from '@/lib/utils'
import { formatWeekRange, type ImpulsePersonCrest } from '@/lib/impulse'
import type { ImpulseCrest } from '@/lib/types'

/**
 * «Diese Woche dabei» – der Raum hinter der Gruppenleiste.
 *
 * Wer diese Woche dabei ist, steht hier mit dem eigenen Wochen-Wappen:
 * so weit gefüllt, wie die Person gekommen ist, samt ihren Sternen. Ein
 * Tipp zeigt es gross. Eine Galerie, keine Rangliste – das eigene Wappen
 * zuerst, dann nach Vornamen, und kein Wort darüber, wer fehlt.
 *
 * Gezeigt wird das Wappen, nicht der Weg dorthin: welche Karten jemandem
 * noch fehlen, sieht nur die Person selbst (im Fenster ihres Wappens).
 */
export function ImpulseGroupRoom({
  week,
  crest,
  people,
  uid,
}: {
  week: string
  /** Wie das Wappen der Woche aussieht – für alle dasselbe. */
  crest: ImpulseCrest
  /** Wer dabei ist, mit Wappen (`weekCrests`) – nach Vornamen. */
  people: ImpulsePersonCrest[]
  /** Das eigene Konto – sein Wappen steht vorn und heisst «Du». */
  uid: string
}) {
  /* Offen bleibt die Kennung: So zeigt das Fenster immer den frischen
     Stand, auch wenn nebenher eine Karte dazukommt. */
  const [openUid, setOpenUid] = useState<string | null>(null)
  const shown = people.find((person) => person.uid === openUid) ?? null
  const ordered = [
    ...people.filter((person) => person.uid === uid),
    ...people.filter((person) => person.uid !== uid),
  ]
  const completed = people.filter((person) => person.complete).length
  const nameOf = (person: ImpulsePersonCrest) =>
    person.uid === uid ? 'Du' : person.firstName || 'Ohne Namen'

  if (people.length === 0) {
    return (
      <div className="card grid place-items-center border-dashed px-4 py-10 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Diese Woche war noch niemand dabei – mach den Anfang.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="hint">
        {people.length} {people.length === 1 ? 'ist' : 'sind'} diese Woche dabei – jede und jeder
        mit dem eigenen Wappen. Ein Tipp zeigt es gross.
        {completed > 0 &&
          ` ${completed} ${completed === 1 ? 'Wappen ist' : 'Wappen sind'} schon vollendet.`}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {ordered.map((person) => (
          <li key={person.uid}>
            <button
              type="button"
              onClick={() => setOpenUid(person.uid)}
              aria-haspopup="dialog"
              aria-label={`${nameOf(person)}: ${
                person.complete
                  ? 'Wappen vollendet'
                  : `Wappen, ${person.done} von ${person.total} Karten`
              }`}
              className="card flex h-full w-full flex-col items-center gap-1.5 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <ImpulseCrestEmblem
                crest={crest}
                week={week}
                done={person.done}
                total={person.total}
                size={56}
                showMotto={false}
              />
              <span className="w-full truncate text-xs font-medium">{nameOf(person)}</span>
              <span
                className={cn(
                  'text-[10px]',
                  person.complete
                    ? 'font-medium text-amber-600 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {person.complete ? 'vollendet' : `${person.done}/${person.total}`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={shown !== null}
        onClose={() => setOpenUid(null)}
        title={shown ? (shown.uid === uid ? 'Dein Wappen' : `Das Wappen von ${nameOf(shown)}`) : ''}
        description={formatWeekRange(week)}
        size="sm"
      >
        {shown && <CrestDetail person={shown} crest={crest} week={week} />}
      </Modal>
    </div>
  )
}

/** Das Wappen gross, wie weit es ist – und welche Sterne leuchten. */
function CrestDetail({
  person,
  crest,
  week,
}: {
  person: ImpulsePersonCrest
  crest: ImpulseCrest
  week: string
}) {
  const starRows = [
    { label: 'Vor Sonntag vollendet', earned: person.stars.sunday },
    ...(person.stars.goal !== null
      ? [{ label: 'Wochenziel geschafft', earned: person.stars.goal }]
      : []),
    ...(person.stars.challenge !== null
      ? [{ label: 'Tages-Challenge an allen 7 Tagen', earned: person.stars.challenge }]
      : []),
  ]
  return (
    <div className="flex flex-col items-center text-center">
      <ImpulseCrestEmblem
        crest={crest}
        week={week}
        done={person.done}
        total={person.total}
        stars={person.stars}
        size={180}
      />
      <p className="mt-3 text-base font-semibold">
        {person.complete
          ? 'Wappen vollendet'
          : `${person.done} von ${person.total} ${person.total === 1 ? 'Karte' : 'Karten'} geschafft`}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-left text-sm">
        {starRows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <Star
              className={cn(
                'size-4 shrink-0',
                row.earned ? 'fill-amber-400 text-amber-500' : 'text-slate-400',
              )}
              aria-hidden
            />
            <span className={row.earned ? undefined : 'text-slate-500 dark:text-slate-400'}>
              {row.label}
            </span>
            <span className="sr-only">{row.earned ? '– geschafft' : '– noch offen'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

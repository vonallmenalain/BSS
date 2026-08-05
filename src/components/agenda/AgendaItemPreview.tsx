import { useMemo } from 'react'
import { Repeat } from 'lucide-react'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { MentionText } from '@/components/ui/MentionText'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { normalizeLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'
import type { AgendaItem } from '@/lib/types'

/**
 * Ein Traktandum, wie es dasteht – ohne jedes Eingabefeld.
 *
 * Gebraucht wird das dort, wo gelesen und nicht gearbeitet wird: in der
 * kompakten Sitzungsliste, die den Inhalt einer Sitzung zeigt, ohne dass man
 * sie öffnen muss. Der aufgeklappte Eintrag in der Sitzung selbst ist etwas
 * anderes – dort ist der Text zugleich das Formular (`AgendaItemEditor`).
 *
 * Namen, die mit «@» eingesetzt wurden, bleiben auch hier anklickbar; ein
 * selbst gebautes Raster wird als Raster gezeichnet und nicht als Fliesstext.
 */
export function AgendaItemPreview({
  item,
  position,
  className,
}: {
  item: AgendaItem
  /** Die Nummer in der Liste – dieselbe wie im Protokoll */
  position?: number
  className?: string
}) {
  /* Einmal geradeziehen und dabei belassen: Lücken bekommen IDs, und ein bei
     jedem Zeichnen neu gebautes Raster liesse die Zeile flackern. */
  const layout = useMemo(() => (item.layout ? normalizeLayout(item.layout) : null), [item.layout])

  const isDone = item.status === 'done'

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-start gap-2">
        {position !== undefined && (
          <span className="tabular mt-0.5 shrink-0 text-xs text-slate-400">{position}.</span>
        )}
        <h4
          className={cn(
            'min-w-0 flex-1 text-sm leading-snug font-medium',
            isDone && 'text-slate-500 line-through dark:text-slate-500',
          )}
        >
          <MentionText text={item.title} memberRefs={item.memberRefs} placeholder="Ohne Titel" />
        </h4>
        <span className="flex shrink-0 items-center gap-1.5">
          {item.status !== 'pending' && <StatusBadge status={item.status} />}
          {item.deferCount > 0 && !isDone && (
            <span
              className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              title={`Wurde ${item.deferCount}× verschoben`}
            >
              <Repeat className="size-3" aria-hidden />
              {item.deferCount}×
            </span>
          )}
          <AssigneeAvatars userIds={item.assignees ?? []} />
        </span>
      </div>

      {layout ? (
        <div className={cn('mt-2', position !== undefined && 'pl-6')}>
          <LayoutGrid layout={layout} memberRefs={item.memberRefs} readOnly />
        </div>
      ) : (
        item.description?.trim() && (
          <p
            className={cn(
              'mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300',
              position !== undefined && 'pl-6',
            )}
          >
            <MentionText text={item.description} memberRefs={item.memberRefs} />
          </p>
        )
      )}
    </div>
  )
}

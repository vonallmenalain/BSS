import { cn, colorForId, getInitials } from '@/lib/utils'
import { useData } from '@/contexts/DataContext'

const SIZES = {
  xs: 'size-5 text-[10px]',
  sm: 'size-6 text-[11px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const

export function Avatar({
  name,
  id,
  size = 'md',
  className,
  title,
}: {
  name: string
  id?: string
  size?: keyof typeof SIZES
  className?: string
  title?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        colorForId(id ?? name),
        className,
      )}
      title={title ?? name}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  )
}

/** Zugewiesene Personen als überlappende Kreise, ab `max` als «+n». */
export function AssigneeAvatars({
  userIds,
  size = 'sm',
  max = 4,
  showNames = false,
}: {
  userIds: string[]
  size?: keyof typeof SIZES
  max?: number
  showNames?: boolean
}) {
  const { userName } = useData()
  if (!userIds?.length) return null

  const visible = userIds.slice(0, max)
  const overflow = userIds.length - visible.length

  if (showNames) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {userIds.map((id) => (
          <span key={id} className={cn('chip', colorForId(id))}>
            <Avatar name={userName(id)} id={id} size="xs" className="-ml-1" />
            {userName(id)}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center -space-x-1.5" title={userIds.map(userName).join(', ')}>
      {visible.map((id) => (
        <Avatar
          key={id}
          name={userName(id)}
          id={id}
          size={size}
          className="ring-2 ring-white dark:ring-slate-900"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

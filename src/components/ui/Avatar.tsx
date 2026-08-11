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
  initials,
}: {
  name: string
  id?: string
  size?: keyof typeof SIZES
  className?: string
  title?: string
  /**
   * Die Buchstaben im Kreis, falls sie nicht aus `name` kommen sollen.
   *
   * Braucht `UserAvatar`: Dort steht der Anmeldename daneben, das Kürzel
   * stammt aber vom verknüpften Mitglied.
   */
  initials?: string
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
      {initials || getInitials(name)}
    </span>
  )
}

/**
 * Woher Kürzel und Farbe eines Kontos stammen: vom verknüpften Mitglied,
 * sobald eines eingetragen ist.
 *
 * Ein Konto ist eine Anmeldung, ein Mitglied ein Eintrag der Gemeinde – erst
 * die Verknüpfung sagt der App, dass beides dieselbe Person ist. Von da an
 * soll diese Person überall dasselbe Zeichen tragen, in der Benutzerliste
 * wie im Mitgliederverzeichnis. Bei der Registrierung schreibt man oft bloss
 * den Vornamen hin; daraus entstünde ein zweiter Kreis für dieselbe Person –
 * ein «AA» neben dem «AR», das sie sonst überall trägt.
 *
 * Ohne Verknüpfung – und für die AP-Zugänge, die das Verzeichnis gar nicht
 * lesen dürfen – bleibt der Anmeldename die einzige Quelle.
 *
 * Exportiert, weil dieselbe Ableitung auch ausserhalb eines Kreises gilt:
 * Die Zuordnung eines Textstücks (`lib/richtext`) trägt Kürzel und Farbton
 * der Person – und zwar dieselben wie ihr Kreis überall sonst.
 */
export function useUserAvatar(userId: string, fallbackName?: string) {
  const { usersById, membersById } = useData()
  const user = usersById.get(userId)
  const member = user?.memberId ? membersById.get(user.memberId) : undefined

  return {
    /** Der Anmeldename – er steht neben dem Kreis und bleibt, wie er ist. */
    name: user?.displayName || fallbackName || 'Unbekannt',
    initials: member ? getInitials(`${member.firstName} ${member.lastName}`) : undefined,
    /** Die Farbe folgt dem Mitglied mit: Ein «AR» in Bernstein neben
        demselben «AR» in Violett wären wieder zwei Zeichen für eine Person. */
    colorId: member?.id ?? userId,
  }
}

/** Der Kreis vor dem Namen eines Kontos – siehe `useUserAvatar`. */
export function UserAvatar({
  userId,
  name,
  size = 'md',
  className,
  title,
}: {
  userId: string
  /** Rückfallname, solange das Konto nicht im geladenen Bestand steht. */
  name?: string
  size?: keyof typeof SIZES
  className?: string
  title?: string
}) {
  const avatar = useUserAvatar(userId, name)

  return (
    <Avatar
      name={avatar.name}
      id={avatar.colorId}
      initials={avatar.initials}
      size={size}
      className={className}
      title={title}
    />
  )
}

/** Zugewiesene Personen als überlappende Kreise, ab `max` als «+n». */
export function AssigneeAvatars({
  userIds,
  size = 'sm',
  max = 4,
}: {
  userIds: string[]
  size?: keyof typeof SIZES
  max?: number
}) {
  const { userName } = useData()
  if (!userIds?.length) return null

  const visible = userIds.slice(0, max)
  const overflow = userIds.length - visible.length

  return (
    <div className="flex items-center -space-x-1.5" title={userIds.map(userName).join(', ')}>
      {visible.map((id) => (
        <UserAvatar
          key={id}
          userId={id}
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

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  CATEGORY_LABELS,
  ITEM_STATUS_LABELS,
  MEETING_STATUS_LABELS,
  MEMBER_STATUS_LABELS,
  PRIORITY_LABELS,
  TALK_STATUS_LABELS,
  CALLING_STATUS_LABELS,
  type CallingStatus,
  type ItemCategory,
  type ItemStatus,
  type MeetingStatus,
  type MemberStatus,
  type Priority,
  type TalkStatus,
} from '@/lib/types'

export function Badge({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span className={cn('badge', className)} title={title}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Traktanden-Status                                                   */
/* ------------------------------------------------------------------ */

const ITEM_STATUS_STYLES: Record<ItemStatus, string> = {
  open: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  deferred: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  cancelled: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-500',
}

export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <Badge className={cn(ITEM_STATUS_STYLES[status], className)}>
      {ITEM_STATUS_LABELS[status]}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Priorität                                                           */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  low: 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  // «Normal» ist der Regelfall und braucht kein visuelles Gewicht.
  if (priority === 'normal') return null
  return <Badge className={PRIORITY_STYLES[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Kategorie                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_STYLES: Record<ItemCategory, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  member_care: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  calling: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  talk: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  youth: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  welfare: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  temple: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  finance: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  admin: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  events: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
}

export function CategoryBadge({ category }: { category: ItemCategory }) {
  return <Badge className={CATEGORY_STYLES[category]}>{CATEGORY_LABELS[category]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Sitzungsstatus                                                      */
/* ------------------------------------------------------------------ */

const MEETING_STATUS_STYLES: Record<MeetingStatus, string> = {
  planned: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  running: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <Badge className={MEETING_STATUS_STYLES[status]}>
      {status === 'running' && (
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
      )}
      {MEETING_STATUS_LABELS[status]}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Mitgliederstatus                                                    */
/* ------------------------------------------------------------------ */

const MEMBER_STATUS_STYLES: Record<MemberStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <Badge className={MEMBER_STATUS_STYLES[status]}>{MEMBER_STATUS_LABELS[status]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Ansprachen-Status                                                   */
/* ------------------------------------------------------------------ */

const TALK_STATUS_STYLES: Record<TalkStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  asked: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  declined: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  held: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-500',
}

export function TalkStatusBadge({ status }: { status: TalkStatus }) {
  return <Badge className={TALK_STATUS_STYLES[status]}>{TALK_STATUS_LABELS[status]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Berufungsstatus                                                     */
/* ------------------------------------------------------------------ */

const CALLING_STATUS_STYLES: Record<CallingStatus, string> = {
  proposed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  extended: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  sustained: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  set_apart: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  released: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  declined: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
}

export function CallingStatusBadge({ status }: { status: CallingStatus }) {
  return <Badge className={CALLING_STATUS_STYLES[status]}>{CALLING_STATUS_LABELS[status]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Fälligkeit                                                          */
/* ------------------------------------------------------------------ */

export function DueBadge({
  label,
  overdue,
  soon,
}: {
  label: string
  overdue: boolean
  soon: boolean
}) {
  return (
    <Badge
      className={cn(
        overdue
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
          : soon
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      )}
    >
      {label}
    </Badge>
  )
}

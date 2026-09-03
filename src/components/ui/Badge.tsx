import type { ReactNode } from 'react'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDayKey, standingTitle } from '@/lib/standing'
import {
  ITEM_KIND_LABELS,
  ITEM_STATUS_LABELS,
  MEETING_STATUS_LABELS,
  MEMBER_STATUS_LABELS,
  TALK_STATUS_LABELS,
  CALLING_STATUS_LABELS,
  type CallingStatus,
  type ItemKind,
  type ItemStatus,
  type MeetingStatus,
  type MemberStatus,
  type StandingRule,
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
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <Badge className={cn(ITEM_STATUS_STYLES[status], className)}>
      {ITEM_STATUS_LABELS[status]}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Traktandum oder Pendenz                                             */
/* ------------------------------------------------------------------ */

const ITEM_KIND_STYLES: Record<ItemKind, string> = {
  traktandum: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pendenz: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
}

/**
 * Nur die Pendenz trägt ein Etikett.
 *
 * Ein neues Traktandum ist der Regelfall und braucht keines – auffallen soll,
 * was aus einer früheren Sitzung übrig geblieben ist.
 */
export function KindBadge({ kind }: { kind: ItemKind }) {
  if (kind === 'traktandum') return null
  return <Badge className={ITEM_KIND_STYLES[kind]}>{ITEM_KIND_LABELS[kind]}</Badge>
}

/* ------------------------------------------------------------------ */
/* Ständige Pendenz                                                    */
/* ------------------------------------------------------------------ */

/**
 * Der Takt einer ständigen Pendenz – «↻ Jede Sitzung».
 *
 * Er tritt an die Stelle des Etiketts «Pendenz»: Beide sagen, worunter der
 * Eintrag steht, und dieses sagt es genauer. Wartet die Pendenz gerade auf
 * ihre nächste Runde, steht der Tag dahinter – sonst stünde in einer Liste
 * eine Aufgabe, von der niemand wüsste, warum sie heute nicht in der Sitzung
 * steht.
 *
 * Dieselbe Farbe wie die Pendenz, aus demselben Grund: Auffallen soll, was
 * nicht neu ist.
 */
export function StandingBadge({ rule, waiting }: { rule: StandingRule; waiting?: boolean }) {
  const due = waiting && rule.dueFrom ? formatDayKey(rule.dueFrom) : null
  return (
    <Badge
      className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      title={
        due
          ? `Ständige Pendenz – ${standingTitle(rule).toLowerCase()}, wieder fällig ab ${due}`
          : `Ständige Pendenz – sie wird nicht abgeschlossen, sondern kehrt ${standingTitle(rule).toLowerCase()} wieder`
      }
    >
      <Repeat className="size-3" aria-hidden />
      {standingTitle(rule)}
      {due && <span className="tabular font-normal opacity-80">ab {due}</span>}
    </Badge>
  )
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
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
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

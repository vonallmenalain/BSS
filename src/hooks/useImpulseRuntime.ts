import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useNavigate, type NavigateFunction, type NavigateOptions, type To } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import { impulseAnswerId, impulseFirstName, quizAnswerCorrect } from '@/lib/impulse'
import {
  PREVIEW_UID,
  changePreviewProgress,
  previewMoment,
  patchPreviewDoc,
  removePreviewDoc,
  upsertPreviewDoc,
  type ImpulsePreviewData,
  type PreviewProgressChange,
} from '@/lib/impulsePreview'
import type { SaveOutcome } from '@/lib/sync'
import type { ImpulseSubmissionKind } from '@/lib/types'
import {
  answerImpulsePoll,
  answerImpulsePuzzle,
  answerImpulseQuiz,
  createImpulseSubmission,
  deleteImpulseSubmission,
  markImpulseCardSeen,
  markImpulseCrest,
  markImpulseDeepeningSeen,
  markImpulseFeedDone,
  saveImpulseComment,
  setImpulseAmen,
  setImpulseChallengeDay,
  setImpulseCommentHidden,
  setImpulseFavorite,
  setImpulseLastSeenWeek,
  setImpulseReport,
  setImpulseWeekGoal,
  setImpulseWeekShare,
  submissionCard,
  updateImpulseSubmission,
} from '@/services/impulse'

/**
 * Was der Bereich «Anti Doom» von seiner Umgebung braucht – wer schaut,
 * welcher Tag ist, wohin geschrieben wird – an einer Stelle.
 *
 * Im Bereich ist das die echte Umgebung: das eigene Konto, die Uhr, die
 * Dienste aus `services/impulse`. In der **Vorschau der Redaktion**
 * (`ImpulsePreviewProvider`) ist es eine gespielte: die Person
 * `PREVIEW_UID`, ein Tag der gewählten Woche, Schreibvorgänge in den
 * Arbeitsspeicher (siehe `lib/impulsePreview`). Seite und Karten fragen
 * darum nicht `useAuth`, `useNow` und die Dienste direkt, sondern die
 * Hooks hier – und sehen in beiden Fällen dasselbe Gesicht.
 */

/** Die Schreibwege, die die Seite der Jugendlichen braucht. */
export const REAL_IMPULSE_WRITES = {
  answerImpulseQuiz,
  answerImpulsePoll,
  answerImpulsePuzzle,
  saveImpulseComment,
  setImpulseCommentHidden,
  setImpulseReport,
  setImpulseWeekGoal,
  setImpulseChallengeDay,
  setImpulseWeekShare,
  markImpulseFeedDone,
  setImpulseAmen,
  setImpulseFavorite,
  createImpulseSubmission,
  updateImpulseSubmission,
  deleteImpulseSubmission,
  markImpulseCardSeen,
  markImpulseDeepeningSeen,
  setImpulseLastSeenWeek,
  markImpulseCrest,
}

export type ImpulseWrites = typeof REAL_IMPULSE_WRITES

export interface ImpulsePreviewState {
  /** Die Woche der Vorschau – sie spielt die laufende. */
  week: string
  /** Der gespielte Wochentag, 0 = Montag … 6 = Sonntag. */
  day: number
  setDay: (day: number) => void
  /** Der gespielte Zeitpunkt (siehe `previewMoment`). */
  now: number
  data: ImpulsePreviewData
  writes: ImpulseWrites
  setCelebrated: (tag: string) => void
  /** Entwürfe der Woche – die Jugendlichen sehen sie nicht, die Vorschau auch nicht. */
  hiddenDrafts: number
  exit: () => void
}

export const ImpulsePreviewContext = createContext<ImpulsePreviewState | null>(null)

/** Die laufende Vorschau – `null` im Bereich selbst. */
export function useImpulsePreview(): ImpulsePreviewState | null {
  return useContext(ImpulsePreviewContext)
}

/** Die Schreibwege: die Dienste – oder in der Vorschau der Arbeitsspeicher. */
export function useImpulseWrites(): ImpulseWrites {
  return useContext(ImpulsePreviewContext)?.writes ?? REAL_IMPULSE_WRITES
}

/** Die Uhr – in der Vorschau der gespielte Tag zur echten Uhrzeit. */
export function useImpulseNow(intervalMs?: number): number {
  const real = useNow(intervalMs)
  const preview = useContext(ImpulsePreviewContext)
  return preview ? preview.now : real
}

/**
 * Das Konto, wie der Bereich es sieht. In der Vorschau schaut die
 * gespielte Person: dieselben Rechte wie ein Jugendlicher (keine
 * Redaktion, keine Moderation), der Vorname der Redaktion, die UID
 * `PREVIEW_UID`.
 */
export function useImpulseAuth(): ReturnType<typeof useAuth> {
  const auth = useAuth()
  const previewing = useContext(ImpulsePreviewContext) !== null
  return useMemo(() => {
    if (!previewing) return auth
    return {
      ...auth,
      profile: auth.profile ? { ...auth.profile, id: PREVIEW_UID } : auth.profile,
      canEditImpulse: false,
    }
  }, [auth, previewing])
}

/**
 * Navigieren im Bereich. In der Vorschau trägt jeder Schritt die Woche
 * mit (`state.vorschau`): So bleibt jeder Eintrag im Verlauf eine
 * Vorschau – auch beim Zurück- und wieder Vorblättern – und führt nie
 * unbemerkt in die echte Ansicht, wo das Anschauen gespeichert würde.
 */
export function useImpulseNavigate(): NavigateFunction {
  const navigate = useNavigate()
  const week = useContext(ImpulsePreviewContext)?.week ?? null
  const go = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') return navigate(to)
      if (!week) return navigate(to, options)
      const state = (options?.state ?? {}) as Record<string, unknown>
      return navigate(to, { ...options, state: { ...state, vorschau: week } })
    },
    [navigate, week],
  )
  return go as NavigateFunction
}

/**
 * Die Schreibwege der Vorschau: dieselben Namen und Aufrufe wie die
 * Dienste, nur dass sie den Stand im Arbeitsspeicher nachführen – mit
 * denselben Feldern, die die Dienste schreiben würden. Jeder meldet
 * sofort «gespeichert»; es gibt ja nichts zu übertragen.
 */
export function previewImpulseWrites(
  update: Dispatch<SetStateAction<ImpulsePreviewData>>,
  week: string,
  day: number,
): ImpulseWrites {
  const done = (): Promise<SaveOutcome> => Promise.resolve('synced')
  const stamp = () => Timestamp.fromMillis(previewMoment(week, day, Date.now()))
  const progress = (user: { uid: string; displayName: string }, change: PreviewProgressChange) => {
    update((data) => ({
      ...data,
      progress: changePreviewProgress(
        data.progress,
        { uid: user.uid, firstName: impulseFirstName(user.displayName) },
        change,
        stamp(),
      ),
    }))
    return done()
  }
  const answer = (
    itemId: string,
    user: { uid: string; displayName: string },
    reply: { choiceIndex: number | null; text: string; correct: boolean | null },
    /** Wie im Dienst: Umfragen werden ohne Namen abgegeben. */
    anonymous = false,
  ) => {
    const at = stamp()
    update((data) => ({
      ...data,
      answers: upsertPreviewDoc(data.answers, {
        id: impulseAnswerId(itemId, user.uid),
        itemId,
        uid: user.uid,
        firstName: anonymous ? '' : impulseFirstName(user.displayName),
        ...reply,
        answeredAt: at,
        updatedAt: at,
      }),
    }))
    return done()
  }
  return {
    answerImpulseQuiz: async (item, user, reply) =>
      answer(item.id, user, {
        choiceIndex: typeof reply.choiceIndex === 'number' ? reply.choiceIndex : null,
        text: reply.text?.trim() ?? '',
        correct: quizAnswerCorrect(item, reply),
      }),
    answerImpulsePoll: async (item, user, value) =>
      answer(item.id, user, { choiceIndex: value, text: '', correct: null }, true),
    answerImpulsePuzzle: async (item, user, attempt, correct) =>
      answer(item.id, user, { choiceIndex: null, text: attempt.trim(), correct }),

    saveImpulseComment: async (item, user, text, isNew, anonymous = false) => {
      const id = impulseAnswerId(item.id, user.uid)
      const at = stamp()
      const author = {
        firstName: anonymous ? '' : impulseFirstName(user.displayName),
        anonymous,
      }
      update((data) => ({
        ...data,
        comments: isNew
          ? upsertPreviewDoc(data.comments, {
              id,
              itemId: item.id,
              uid: user.uid,
              ...author,
              text: text.trim(),
              hidden: false,
              createdAt: at,
              updatedAt: at,
            })
          : patchPreviewDoc(data.comments, id, { text: text.trim(), ...author, updatedAt: at }),
      }))
      return done()
    },
    setImpulseCommentHidden: async (commentId, hidden) => {
      update((data) => ({
        ...data,
        comments: patchPreviewDoc(data.comments, commentId, { hidden, updatedAt: stamp() }),
      }))
      return done()
    },
    setImpulseReport: async (user, commentId, on) =>
      progress(user, { kind: 'list', field: 'reports', value: commentId, add: on }),

    setImpulseWeekGoal: async (user, week, isDone) =>
      progress(user, { kind: 'week', week, patch: { goal: isDone } }),
    setImpulseChallengeDay: async (user, week, day, checked) =>
      progress(user, { kind: 'week-list', week, field: 'days', value: day, add: checked }),
    setImpulseWeekShare: async (user, week, isDone) =>
      progress(user, { kind: 'week', week, patch: { share: isDone } }),
    markImpulseFeedDone: async (user, week) =>
      progress(user, { kind: 'week', week, patch: { feed: true } }),
    setImpulseAmen: async (user, itemId, on) =>
      progress(user, { kind: 'list', field: 'amens', value: itemId, add: on }),
    setImpulseFavorite: async (user, itemId, on) =>
      progress(user, { kind: 'list', field: 'favorites', value: itemId, add: on }),
    markImpulseCardSeen: async (user, week, itemId) =>
      progress(user, { kind: 'week-list', week, field: 'cards', value: itemId, add: true }),
    markImpulseDeepeningSeen: async (user, week, itemId) =>
      progress(user, { kind: 'week-list', week, field: 'deepened', value: itemId, add: true }),
    setImpulseLastSeenWeek: async (user, week, firstSeenWeek) =>
      progress(user, { kind: 'last-seen', week, firstSeenWeek }),
    markImpulseCrest: async (user, week, day) =>
      progress(user, { kind: 'week', week, patch: { crest: day } }),

    createImpulseSubmission: async (user, input, anonymous = false) => {
      const at = stamp()
      const id = `${PREVIEW_UID}-${at.toMillis().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      update((data) => ({
        ...data,
        submissions: upsertPreviewDoc(data.submissions, {
          id,
          uid: user.uid,
          firstName: impulseFirstName(user.displayName),
          anonymous,
          kind: input.kind as ImpulseSubmissionKind,
          text: input.title.trim(),
          sourceLabel: input.sourceLabel.trim(),
          sourceUrl: input.sourceUrl.trim(),
          card: submissionCard(input),
          status: 'open',
          createdAt: at,
          updatedAt: at,
        }),
      }))
      return done()
    },
    updateImpulseSubmission: async (id, input, anonymous = false) => {
      update((data) => ({
        ...data,
        submissions: patchPreviewDoc(data.submissions, id, {
          anonymous,
          kind: input.kind as ImpulseSubmissionKind,
          text: input.title.trim(),
          sourceLabel: input.sourceLabel.trim(),
          sourceUrl: input.sourceUrl.trim(),
          card: submissionCard(input),
          updatedAt: stamp(),
        }),
      }))
      return done()
    },
    deleteImpulseSubmission: async (id) => {
      update((data) => ({ ...data, submissions: removePreviewDoc(data.submissions, id) }))
      return done()
    },
  }
}

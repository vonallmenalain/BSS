import { useState } from 'react'
import { Check, Eye, EyeOff, Flag, HandHeart, MessagesSquare, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import {
  saveImpulseComment,
  setImpulseAmen,
  setImpulseCommentHidden,
  setImpulseReport,
} from '@/services/impulse'
import type { ImpulseComment, ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * Die Frage der Woche – die soziale Fläche des Bereichs, klein gehalten,
 * damit sie trägt statt kippt: eine Frage, kurze Antworten mit Vornamen,
 * und **die Antworten der anderen erscheinen erst nach der eigenen**
 * (Entscheid Nr. 3) – das nimmt den Druck, das «Richtige» zu schreiben.
 *
 * Kein Chat, keine Kommentare unter Kommentaren. Ein «Amen» je Beitrag,
 * ein «Melden» für den Fall der Fälle, und die Redaktion kann ausblenden –
 * sie sieht die Beiträge auch ohne eigene Antwort, sonst könnte sie nicht
 * moderieren. Die eigene Antwort darf nachgebessert werden: Sie ist ein
 * persönliches Wort, kein Quizversuch.
 *
 * Im Vorschau-Modus wird nichts gespeichert; die eigene Antwort lebt nur
 * im Fenster.
 */
export function ImpulseQuestionCard({
  item,
  comments,
  progressDocs,
  preview = false,
  plain = false,
}: {
  item: ImpulseItem
  /** Alle Beiträge zu dieser Frage, älteste zuerst. */
  comments: ImpulseComment[]
  progressDocs: ImpulseProgress[]
  preview?: boolean
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
}) {
  const { profile, canEditImpulse } = useAuth()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewComment, setPreviewComment] = useState<ImpulseComment | null>(null)

  const uid = profile?.id ?? ''
  const stored = comments.find((comment) => comment.uid === uid) ?? null
  const mine = preview ? previewComment : stored

  /* Ausgeblendete Beiträge sieht nur die Redaktion – dort bleiben sie
     als solche angeschrieben, statt stillschweigend zu fehlen. */
  const visible = (preview ? (previewComment ? [previewComment] : []) : comments).filter(
    (comment) => !comment.hidden || canEditImpulse,
  )
  const reveal = Boolean(mine) || (canEditImpulse && !preview)

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    if (preview) {
      setPreviewComment({
        id: 'vorschau',
        itemId: item.id,
        uid: 'vorschau',
        firstName: 'Vorschau',
        text,
        hidden: false,
      })
      setDraft('')
      setEditing(false)
      return
    }
    if (!profile) return
    setBusy(true)
    try {
      const outcome = await saveImpulseComment(
        item,
        { uid: profile.id, displayName: profile.displayName },
        text,
        !stored,
      )
      toast.saved(stored ? 'Antwort angepasst.' : 'Antwort festgehalten.', outcome)
      setDraft('')
      setEditing(false)
    } catch (error) {
      console.error(error)
      toast.error('Die Antwort konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const composerOpen = !mine || editing

  return (
    <section className={plain ? undefined : 'card p-5'}>
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <MessagesSquare className="size-4" aria-hidden />
          Frage der Woche
        </p>
      )}
      <h2 className={plain ? 'text-lg font-semibold text-balance' : 'mt-2 text-lg font-semibold text-balance'}>{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      {item.source?.label && (
        <div className="mt-3">
          <SourceLink item={item} />
        </div>
      )}

      {reveal && visible.length > 0 && (
        <div className="mt-4 space-y-2">
          {/* Die Antworten der anderen sind die Belohnung fürs eigene
              Wort – sie entfalten sich kurz gestaffelt, statt als Block
              dazustehen. Ab der siebten kommt alles zusammen. */}
          {visible.map((comment, index) => (
            <div
              key={comment.id}
              className="animate-imp-rise"
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <CommentRow
                comment={comment}
                mine={comment === mine || comment.uid === uid}
                progressDocs={progressDocs}
                preview={preview}
                onEdit={() => {
                  setDraft(mine?.text ?? '')
                  setEditing(true)
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!reveal && (
        <p className="hint mt-4">
          {comments.filter((comment) => !comment.hidden).length === 0
            ? 'Noch keine Antwort – mach den Anfang.'
            : `Schon ${comments.filter((comment) => !comment.hidden).length} ${
                comments.filter((comment) => !comment.hidden).length === 1
                  ? 'Antwort'
                  : 'Antworten'
              } – deine fehlt noch.`}
        </p>
      )}

      {composerOpen && (
        <div className="mt-4 space-y-2">
          <label className="sr-only" htmlFor={`frage-${item.id}`}>
            Deine Antwort
          </label>
          <textarea
            id={`frage-${item.id}`}
            className="input min-h-20"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Zwei, drei Sätze genügen …"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="hint min-w-0 flex-1">
              Erscheint mit deinem Vornamen. Die Antworten der anderen siehst du, sobald deine
              dasteht.
            </p>
            {editing && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditing(false)
                  setDraft('')
                }}
                disabled={busy}
              >
                Abbrechen
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void submit()}
              disabled={busy || !draft.trim()}
            >
              <Check className="size-4" aria-hidden />
              {mine ? 'Speichern' : 'Antworten'}
            </button>
          </div>
        </div>
      )}

      <ImpulseCardActions
        item={item}
        progressDocs={progressDocs}
        preview={preview}
        centered={false}
      />
    </section>
  )
}

/** Ein Beitrag: Vorname, Text – und die stillen Knöpfe darunter. */
function CommentRow({
  comment,
  mine,
  progressDocs,
  preview,
  onEdit,
}: {
  comment: ImpulseComment
  mine: boolean
  progressDocs: ImpulseProgress[]
  preview: boolean
  onEdit: () => void
}) {
  const { profile, canEditImpulse } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const uid = profile?.id ?? ''
  const myProgress = progressDocs.find((progress) => progress.uid === uid)
  const amen = myProgress?.amens?.includes(comment.id) ?? false
  const reported = myProgress?.reports?.includes(comment.id) ?? false

  const amenNames = progressDocs
    .filter((progress) => progress.amens?.includes(comment.id))
    .map((progress) => progress.firstName || '–')
    .sort((a, b) => a.localeCompare(b, 'de'))
  const reportedBy = progressDocs
    .filter((progress) => progress.reports?.includes(comment.id))
    .map((progress) => progress.firstName || '–')

  const run = async (action: () => Promise<unknown>, failure: string) => {
    if (busy || preview || !profile) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast.error(failure)
    } finally {
      setBusy(false)
    }
  }

  const user = profile ? { uid: profile.id, displayName: profile.displayName } : null

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 p-3 dark:border-slate-700',
        comment.hidden && 'border-dashed opacity-70',
      )}
    >
      <p className="text-sm font-medium">
        {comment.firstName}
        {mine && <span className="font-normal text-slate-400"> (du)</span>}
      </p>
      <p className="mt-1 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
        {comment.text}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          className={cn('btn-ghost btn-sm', amen && 'text-brand-700 dark:text-brand-300')}
          aria-pressed={amen}
          disabled={preview}
          onClick={() =>
            void run(() => setImpulseAmen(user!, comment.id, !amen), 'Das konnte nicht gespeichert werden.')
          }
        >
          <HandHeart className={cn('size-4', amen && 'fill-current')} aria-hidden />
          Amen
        </button>
        {amenNames.length > 0 && <span className="hint">{amenNames.join(', ')}</span>}

        <span className="ms-auto flex items-center gap-1">
          {mine && !preview && (
            <button type="button" className="btn-ghost btn-sm" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
              Bearbeiten
            </button>
          )}
          {!mine && !preview && (
            <button
              type="button"
              className={cn('btn-ghost btn-sm', reported && 'text-amber-700 dark:text-amber-300')}
              aria-pressed={reported}
              title="Der Bischofschaft zeigen – sie schaut sich den Beitrag an"
              onClick={() =>
                void run(
                  () => setImpulseReport(user!, comment.id, !reported),
                  'Das konnte nicht gespeichert werden.',
                )
              }
            >
              <Flag className={cn('size-4', reported && 'fill-current')} aria-hidden />
              {reported ? 'Gemeldet' : 'Melden'}
            </button>
          )}
          {canEditImpulse && !preview && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() =>
                void run(
                  () => setImpulseCommentHidden(comment.id, !comment.hidden),
                  'Das konnte nicht gespeichert werden.',
                )
              }
            >
              {comment.hidden ? (
                <>
                  <Eye className="size-4" aria-hidden />
                  Zeigen
                </>
              ) : (
                <>
                  <EyeOff className="size-4" aria-hidden />
                  Ausblenden
                </>
              )}
            </button>
          )}
        </span>
      </div>

      {canEditImpulse && !preview && (reportedBy.length > 0 || comment.hidden) && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
          {comment.hidden && 'Ausgeblendet – nur die Bischofschaft sieht den Beitrag.'}
          {comment.hidden && reportedBy.length > 0 && ' '}
          {reportedBy.length > 0 && `Gemeldet von ${reportedBy.join(', ')}.`}
        </p>
      )}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Check, Lightbulb, Link2, Maximize2, Puzzle, RotateCcw, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { formatWeekRange } from '@/lib/impulse'
import { labeledLink, splitLinks } from '@/lib/links'
import { scriptureLink } from '@/lib/scriptures'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import { ImpulseImageLightbox } from '@/components/impulse/ImpulseImageLightbox'
import { answerImpulseQuiz } from '@/services/impulse'
import type { ImpulseAnswer, ImpulseItem, ImpulseProgress } from '@/lib/types'

/*
 * Die Karten des Bereichs «Anti Doom» – Wochenthema, Quizfrage und
 * Bilderrätsel (dieselbe Mechanik wie das Quiz, nur mit Bild).
 *
 * Sie stehen hier und nicht in der Seite, weil zwei Orte sie zeichnen:
 * der Bereich selbst und die Wochen-Vorschau der Redaktion. Beide sollen
 * pixelgleich aussehen – eine Vorschau, die anders aussieht als das
 * Original, wäre keine.
 */

/** «Eingereicht von Luca» – die Ehre der Mitmach-Ecke, still und klein. */
export function ContributorLine({ item }: { item: ImpulseItem }) {
  if (!item.contributor) return null
  return <p className="hint mt-1">Eingereicht von {item.contributor}</p>
}

/** Die Quellenangabe – kurzer Auszug in der App, der Rest hinter dem Link. */
export function SourceLink({ item }: { item: ImpulseItem }) {
  const source = item.source
  if (!source?.label) return null
  if (!source.url) {
    return <p className="hint">Quelle: {source.label}</p>
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
    >
      <Link2 className="size-4" aria-hidden />
      {source.label}
    </a>
  )
}

/**
 * Die Vertiefung einer Karte – der Inhalt der zweiten Seite im
 * Vollbild-Feed (Wisch nach links).
 *
 * Freitext der Redaktion mit weiterführenden Gedanken, Quellen und Links.
 * Eine Zeile «Alma 32:27 – https://…» wird zum anklickbaren Verweis mit
 * Beschriftung – dieselbe Gestalt wie die Quellenangabe einer Karte
 * (`labeledLink`); freistehende Adressen im Fliesstext bleiben wie bisher
 * anklickbar (`splitLinks`). Der Titel der Karte steht klein darüber,
 * damit klar bleibt, was hier vertieft wird.
 */
export function ImpulseDeepeningCard({ item }: { item: ImpulseItem }) {
  if (!item.deepening) return null
  return (
    <article className="card p-6">
      <h3 className="text-base font-semibold text-balance">{item.title}</h3>
      <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
        {item.deepening.split('\n').map((line, index) => {
          /* Eine Zeile «Alma 32:27 – https://…» trägt ihren Link selbst;
             eine Zeile, auf der nur «Alma 32:27» steht, bekommt ihn von
             `scriptureLink` hergeleitet – die Redaktion und die
             Mitmach-Ecke müssen keine Adressen abtippen. */
          const labeled =
            labeledLink(line) ??
            (() => {
              const derived = scriptureLink(line.trim())
              return derived ? { label: line.trim(), href: derived } : null
            })()
          if (labeled) {
            return (
              <a
                key={index}
                href={labeled.href}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 dark:text-brand-300 flex w-fit items-center gap-1.5 py-0.5 font-medium hover:underline"
              >
                <Link2 className="size-4 shrink-0" aria-hidden />
                {labeled.label}
              </a>
            )
          }
          if (!line.trim()) {
            // Eine Leerzeile im Freitext bleibt eine Atempause im Satzbild.
            return <div key={index} className="h-2" aria-hidden />
          }
          return (
            <p key={index}>
              {splitLinks(line).map((part, partIndex) =>
                part.href ? (
                  <a
                    key={partIndex}
                    href={part.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 dark:text-brand-300 font-medium break-words hover:underline"
                  >
                    {part.text}
                  </a>
                ) : (
                  <span key={partIndex}>{part.text}</span>
                ),
              )}
            </p>
          )
        })}
      </div>
      <div className="mt-4">
        <SourceLink item={item} />
      </div>
    </article>
  )
}

/**
 * Das Bild eines Bilderrätsels – aus der offiziellen Mediathek der Kirche
 * geladen (die App speichert nur die Adresse). Ohne Bild bleibt die Karte
 * einfach ohne; ein kaputter Link zeigt den Alt-Text statt eines Lochs.
 *
 * Gezeigt wird immer das **ganze** Bild (kein Zuschnitt – beim Rätseln
 * zählt jedes Detail), und ein Tipp darauf öffnet es im Vollbild mit
 * Zoom (`ImpulseImageLightbox`); die kleine Lupe unten rechts sagt es an.
 */
export function ImpulseItemImage({ item, className }: { item: ImpulseItem; className?: string }) {
  const [open, setOpen] = useState(false)
  const image = item.image
  if (!image?.url) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative mx-auto mt-3 block w-fit max-w-full cursor-zoom-in"
        title="Bild vergrössern"
      >
        <img
          src={image.url}
          alt={image.alt || 'Bild zum Rätsel'}
          loading="lazy"
          draggable={false}
          className={cn(
            'w-auto max-w-full rounded-xl border border-slate-200 bg-slate-100 object-contain dark:border-slate-800 dark:bg-slate-800',
            className ?? 'max-h-64',
          )}
        />
        <span
          className="absolute end-2 bottom-2 grid size-7 place-items-center rounded-full bg-slate-900/55 text-white transition group-hover:bg-slate-900/75"
          aria-hidden
        >
          <Maximize2 className="size-3.5" />
        </span>
        <span className="sr-only">Bild vergrössern</span>
      </button>
      {open && (
        <ImpulseImageLightbox url={image.url} alt={image.alt} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

/**
 * Das Wochenthema als Feed-Karte – gross und ruhig, wie eh und je.
 *
 * Hier statt in der Seite, weil zwei Orte sie zeichnen: der
 * Vollbild-Feed der AP's und die Vorschau der Redaktion. Mit
 * `progressDocs` trägt auch das Wochenthema «Amen» und «Merken».
 */
export function WocheDeckCard({
  item,
  progressDocs,
  preview = false,
}: {
  item: ImpulseItem
  progressDocs?: ImpulseProgress[]
  preview?: boolean
}) {
  return (
    <article className="card p-6 text-center sm:p-8">
      {item.week && <p className="hint">{formatWeekRange(item.week)}</p>}
      <h2 className="mt-2 text-2xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-3 whitespace-pre-line text-slate-600 dark:text-slate-300">{item.body}</p>
      )}
      <div className="mt-5 flex flex-col items-center gap-1">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>
      {progressDocs && (
        <ImpulseCardActions item={item} progressDocs={progressDocs} preview={preview} />
      )}
    </article>
  )
}

/** Das Wochenthema: eine Schriftstelle oder ein Gedanke, mit Quelle. */
export function ImpulseCard({ item }: { item: ImpulseItem }) {
  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Lightbulb className="size-4" aria-hidden />
        Wochenthema
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <div className="mt-3">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>
    </section>
  )
}

/**
 * Die Quizfrage der Woche – und das Bilderrätsel, das dieselbe Mechanik
 * mit einem Bild aus der Mediathek der Kirche verbindet (die Karte
 * erkennt es an `item.kind`).
 *
 * Erst wählen bzw. tippen, dann «Antworten» – ein Versuch, darum kein
 * Antworten mit einem einzigen Tippen. Nach der Antwort kommt sofort die
 * Auflösung: Sie ist der Lernmoment, mit Erklärung und Quelle. Gewertet
 * wird die Teilnahme, nicht die Richtigkeit.
 *
 * Im Vorschau-Modus (`preview`) wird nichts gespeichert: Die Antwort lebt
 * nur im Fenster, die Auflösung rechnet lokal, und ein Knopf setzt alles
 * zurück – so lässt sich eine Frage durchspielen, ohne eine echte Antwort
 * zu hinterlassen.
 */
export function QuizCard({
  item,
  answer,
  preview = false,
  plain = false,
  progressDocs,
}: {
  item: ImpulseItem
  answer: ImpulseAnswer | null
  preview?: boolean
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
  /** Mit Fortschrittsbestand trägt auch das Quiz «Amen» und «Merken». */
  progressDocs?: ImpulseProgress[]
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [choice, setChoice] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewAnswer, setPreviewAnswer] = useState<ImpulseAnswer | null>(null)
  /*
   * Eben erst geantwortet? Nur dann tritt die Auflösung an – wer eine
   * schon beantwortete Frage wieder öffnet, sieht sie einfach dastehen.
   * Bewegung gehört dem Moment des Wechsels.
   */
  const [justAnswered, setJustAnswered] = useState(false)

  const quiz = item.quiz
  if (!quiz) return null

  const shown = preview ? previewAnswer : answer

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (quiz.form === 'choice' && choice === null) return
    if (quiz.form === 'text' && !text.trim()) return
    setJustAnswered(true)

    if (preview) {
      setPreviewAnswer({
        id: 'vorschau',
        itemId: item.id,
        uid: 'vorschau',
        firstName: 'Vorschau',
        choiceIndex: quiz.form === 'choice' ? choice : null,
        text: text.trim(),
        correct: quiz.form === 'choice' ? choice === quiz.answerIndex : null,
      })
      return
    }

    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await answerImpulseQuiz(
        item,
        { uid: profile.id, displayName: profile.displayName },
        quiz.form === 'choice' ? { choiceIndex: choice ?? 0 } : { text },
      )
      toast.saved('Antwort festgehalten.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Die Antwort konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPreviewAnswer(null)
    setChoice(null)
    setText('')
  }

  const riddle = item.kind === 'bilderraetsel'
  const KindIcon = riddle ? Puzzle : Search

  return (
    <section className="card p-5">
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <KindIcon className="size-4" aria-hidden />
          {riddle ? 'Bilderrätsel' : 'Quizfrage der Woche'}
        </p>
      )}
      <ImpulseItemImage item={item} />
      <h2
        className={cn(
          'text-lg font-semibold text-balance',
          item.image?.url ? 'mt-3' : !plain && 'mt-2',
        )}
      >
        {item.title}
      </h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <ContributorLine item={item} />

      {shown ? (
        <>
          <QuizResolution item={item} answer={shown} animated={justAnswered} />
          {preview && (
            <button type="button" className="btn-ghost btn-sm mt-3" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden />
              Vorschau zurücksetzen
            </button>
          )}
        </>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
          {quiz.form === 'choice' ? (
            <div className="space-y-1.5" role="radiogroup" aria-label="Antworten">
              {quiz.options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={choice === index}
                  onClick={() => setChoice(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition',
                    choice === index
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full border',
                      choice === index
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                    aria-hidden
                  >
                    {choice === index && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor={`quiz-${item.id}${preview ? '-vorschau' : ''}`}>
                Deine Antwort
              </label>
              <input
                id={`quiz-${item.id}${preview ? '-vorschau' : ''}`}
                className="input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Die Antwort steht in der Quelle …"
                autoComplete="off"
              />
            </div>
          )}

          {/* Nur die Suchfrage zeigt ihre Quelle schon vor dem Antworten –
              der Weg dorthin ist dort die eigentliche Aufgabe. Bei
              Auswahlfragen (auch im Bilderrätsel) wäre die Fundstelle ein
              Spoiler («Joseph Smith – Lebensgeschichte» verrät Joseph
              Smith); sie erscheint erst mit der Auflösung. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {quiz.form === 'text' && <SourceLink item={item} />}
            <button
              type="submit"
              className="btn-primary ms-auto"
              disabled={
                busy || (quiz.form === 'choice' ? choice === null : text.trim().length === 0)
              }
            >
              <Check className="size-4" aria-hidden />
              Antworten
            </button>
          </div>
        </form>
      )}

      {progressDocs && (
        <ImpulseCardActions
          item={item}
          progressDocs={progressDocs}
          preview={preview}
          centered={false}
        />
      )}
    </section>
  )
}

/** Die Auflösung – der Lernmoment nach der Antwort. */
export function QuizResolution({
  item,
  answer,
  animated = false,
}: {
  item: ImpulseItem
  answer: ImpulseAnswer
  /** Tritt nur an, wenn eben geantwortet wurde – nicht beim Wiedersehen. */
  animated?: boolean
}) {
  const quiz = item.quiz
  if (!quiz) return null

  return (
    /* Die Auflösung tritt an statt zu erscheinen – sie ersetzt das
       Formular im selben Moment, und ohne Brücke wäre der Wechsel ein
       Schnitt mitten im Lernmoment. */
    <div className={cn('mt-4 space-y-3', animated && 'animate-imp-rise')}>
      {quiz.form === 'choice' ? (
        <>
          <p
            className={cn(
              'text-sm font-medium',
              answer.correct
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-600 dark:text-slate-300',
            )}
          >
            {answer.correct
              ? 'Richtig beantwortet – stark!'
              : 'Gut versucht – die richtige Antwort ist markiert.'}
          </p>
          <div className="space-y-1.5">
            {quiz.options.map((option, index) => {
              const isSolution = index === quiz.answerIndex
              const isChosen = index === (answer.choiceIndex ?? -1)
              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-3 text-sm',
                    isSolution
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                      : isChosen
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                        : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                  )}
                >
                  {isSolution ? (
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                      aria-hidden
                    />
                  ) : isChosen ? (
                    <X className="size-4 shrink-0 text-rose-500" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                  {option}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Deine Antwort: <span className="font-medium">{answer.text || '–'}</span>
          </p>
          <p>
            Lösung:{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              {quiz.answerText}
            </span>
          </p>
        </div>
      )}

      {quiz.explanation && (
        <p className="text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {quiz.explanation}
        </p>
      )}
      <SourceLink item={item} />
    </div>
  )
}

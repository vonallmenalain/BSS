import { useState, type FormEvent } from 'react'
import { Check, Lightbulb, Link2, Maximize2, Puzzle, RotateCcw, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { formatWeekRange } from '@/lib/impulse'
import { cropFrameStyle, cropImageStyle, impulseCrop } from '@/lib/impulseCrop'
import { labeledLink, splitLinks } from '@/lib/links'
import { scriptureLink } from '@/lib/scriptures'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import { ImpulseImageLightbox } from '@/components/impulse/ImpulseImageLightbox'
import { answerImpulseQuiz } from '@/services/impulse'
import type { ImpulseAnswer, ImpulseImage, ImpulseItem, ImpulseProgress } from '@/lib/types'

/*
 * Die Karten des Bereichs «Anti Doom» – Wochenthema, Quizfrage,
 * Bilderrätsel (dieselbe Mechanik wie das Quiz, nur mit Bild) und Video.
 *
 * Sie stehen hier und nicht in der Seite, weil zwei Orte sie zeichnen:
 * der Bereich selbst und die Wochen-Vorschau der Redaktion. Beide sollen
 * pixelgleich aussehen – eine Vorschau, die anders aussieht als das
 * Original, wäre keine.
 *
 * **Ohne Kachel.** Im Vollbild (`plain`) tragen die Karten keinen Rahmen
 * und keine eigene Fläche mehr: Der Text steht frei auf dem Farbverlauf
 * des Bereichs – oder auf dem Bild, das im Feed die ganze Fläche füllt
 * (`ImpulseImageBackdrop`, gelegt vom `ImpulseFeedScreen`). Ausserhalb
 * des Vollbilds – in den Räumen und in der Redaktion – bleibt die Kachel,
 * dort ordnet sie Listen.
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
  /* Eigener Titel und eigene Quelle, wenn die Redaktion sie gesetzt
     hat – sonst erbt die Seite beides von der Hauptkarte. */
  const title = item.deepeningTitle?.trim() || item.title
  const source = item.deepeningSource ?? item.source
  return (
    <article className="px-1">
      <h3 className="text-base font-semibold text-balance">{title}</h3>
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
        <SourceLink item={{ ...item, source }} />
      </div>
    </article>
  )
}

/**
 * Das Bild eines Bilderrätsels – aus der offiziellen Mediathek der Kirche
 * geladen (die App speichert nur die Adresse). Ohne Bild bleibt die Karte
 * einfach ohne; ein kaputter Link zeigt den Alt-Text statt eines Lochs.
 *
 * Gezeigt wird das ganze Bild – oder der Ausschnitt, den die Redaktion
 * gewählt hat (`lib/impulseCrop`). Abgeschnitten wird also nur, was
 * jemand ausdrücklich weggelassen hat; von sich aus nimmt die Karte
 * nichts weg, denn beim Rätseln zählt jedes Detail. Ein Tipp darauf
 * öffnet das Bild im Vollbild mit Zoom (`ImpulseImageLightbox`) – im
 * selben Ausschnitt, sonst stünde dort plötzlich die halbe Lösung; die
 * kleine Lupe unten rechts sagt es an.
 */
export function ImpulseItemImage({
  item,
  maxHeight = '16rem',
}: {
  item: ImpulseItem
  /** Wie hoch das Bild in der Karte höchstens steht. */
  maxHeight?: string
}) {
  const [open, setOpen] = useState(false)
  const image = item.image
  if (!image?.url) return null
  const crop = impulseCrop(image)
  const frame =
    'relative mx-auto block overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800'
  const zoomBadge = (
    <span
      className="absolute end-2 bottom-2 grid size-7 place-items-center rounded-full bg-slate-900/55 text-white transition group-hover:bg-slate-900/75"
      aria-hidden
    >
      <Maximize2 className="size-3.5" />
    </span>
  )
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-3 block w-full cursor-zoom-in"
        title="Bild vergrössern"
      >
        {crop ? (
          <span className={frame} style={cropFrameStyle(crop, maxHeight)}>
            <img
              src={image.url}
              alt={image.alt || 'Bild zum Rätsel'}
              loading="lazy"
              draggable={false}
              className="max-w-none"
              style={cropImageStyle(crop)}
            />
            {zoomBadge}
          </span>
        ) : (
          <span className={cn(frame, 'w-fit max-w-full')}>
            <img
              src={image.url}
              alt={image.alt || 'Bild zum Rätsel'}
              loading="lazy"
              draggable={false}
              style={{ maxHeight }}
              className="block w-auto max-w-full object-contain"
            />
            {zoomBadge}
          </span>
        )}
        <span className="sr-only">Bild vergrössern</span>
      </button>
      {open && (
        <ImpulseImageLightbox
          url={image.url}
          alt={image.alt}
          crop={crop}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/**
 * Das Bild einer Karte als ganze Fläche – so liegt es im Vollbild-Feed.
 *
 * Gezeigt wird, was die Redaktion zeigen will: das ganze Bild oder ihr
 * Ausschnitt – und beides ungeschnitten (`object-contain` bzw. der
 * Rahmen des Ausschnitts). Von sich aus schneidet die Karte einem Bild
 * nicht die Hälfte ab. Was dem Format zur Bildschirmfüllung fehlt, füllt
 * eine unscharf vergrösserte Kopie desselben Bildes – kein schwarzer
 * Balken, sondern der Ton des Bildes selbst.
 *
 * Der Ausschnitt misst sich an der Fläche, nicht an der Seite: Der Grund
 * ist ein Grössen-Container (`container-type: size`), darum kann der
 * Rahmen mit `cqw`/`cqh` so gross werden, wie es die Höhe **und** die
 * Breite hergeben.
 */
export function ImpulseImageBackdrop({ image }: { image: ImpulseImage }) {
  const crop = impulseCrop(image)
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100 [container-type:size] dark:bg-slate-900">
      <img
        src={image.url}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover blur-2xl saturate-150"
      />
      {crop ? (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
          style={{
            aspectRatio: `${crop.ratio}`,
            width: `min(100cqw, calc(100cqh * ${crop.ratio}))`,
          }}
        >
          <img
            src={image.url}
            alt={image.alt || 'Bild zur Karte'}
            className="max-w-none"
            style={cropImageStyle(crop)}
          />
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.alt || 'Bild zur Karte'}
          className="relative size-full object-contain"
        />
      )}
    </div>
  )
}

/**
 * Die Video-Karte: Das Video füllt den Bildschirm (siehe
 * `ImpulseVideoPlayer`), hier steht nur, was darüber gehört – Titel,
 * Ergänzung, Quelle. Kurz gehalten: Wer ein Video schaut, will lesen,
 * worum es geht, und nicht einen zweiten Text daneben.
 */
export function VideoDeckCard({
  item,
  progressDocs,
  preview = false,
}: {
  item: ImpulseItem
  progressDocs?: ImpulseProgress[]
  preview?: boolean
}) {
  return (
    <section className="px-1">
      <h2 className="text-2xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 whitespace-pre-line text-slate-600 dark:text-slate-300">{item.body}</p>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>
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
    <article className="px-1 text-center">
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
 * **Ein Tipp ist die Antwort.** Der Knopf «Antworten» stand einmal unter
 * den Möglichkeiten und sollte vor dem versehentlichen Tippen schützen –
 * er kostete jede Antwort einen zweiten Griff und liess die Karte wie ein
 * Formular wirken. Jetzt gilt der Tipp auf eine Möglichkeit sofort: Die
 * Auflösung steht im selben Augenblick da, ohne auf den Server zu warten
 * (`chosen`); scheitert das Speichern, tritt die Frage wieder an. Es
 * bleibt bei **einem** Versuch – gewertet wird ohnehin die Teilnahme,
 * nicht die Richtigkeit. Die Suchfrage behält ihren Knopf: Eine getippte
 * Antwort weiss nicht von selbst, wann sie fertig ist.
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
  /** Die eben getippte Möglichkeit – die Auflösung, bevor der Server antwortet. */
  const [chosen, setChosen] = useState<number | null>(null)
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

  /* Die gespeicherte Antwort schlägt die eben getippte – sie ist
     dieselbe, nur mit Namen und Zeitstempel. */
  const local: ImpulseAnswer | null =
    chosen === null
      ? null
      : {
          id: 'lokal',
          itemId: item.id,
          uid: profile?.id ?? '',
          firstName: '',
          choiceIndex: chosen,
          text: '',
          correct: chosen === quiz.answerIndex,
        }
  const shown = preview ? previewAnswer : (answer ?? local)

  /** Der Tipp auf eine Möglichkeit – Antwort und Auflösung in einem. */
  const choose = async (index: number) => {
    if (busy || shown) return

    if (preview) {
      setJustAnswered(true)
      setPreviewAnswer({
        id: 'vorschau',
        itemId: item.id,
        uid: 'vorschau',
        firstName: 'Vorschau',
        choiceIndex: index,
        text: '',
        correct: index === quiz.answerIndex,
      })
      return
    }

    if (!profile) return
    setJustAnswered(true)
    setBusy(true)
    setChosen(index)
    try {
      const outcome = await answerImpulseQuiz(
        item,
        { uid: profile.id, displayName: profile.displayName },
        { choiceIndex: index },
      )
      toast.saved('Antwort festgehalten.', outcome)
    } catch (error) {
      console.error(error)
      /* Nicht angekommen: Die Frage tritt wieder an, statt eine Antwort
         vorzugaukeln, die niemand hat. */
      setChosen(null)
      setJustAnswered(false)
      toast.error('Die Antwort konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  /** Die Suchfrage: getippt, darum mit Knopf. */
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    setJustAnswered(true)

    if (preview) {
      setPreviewAnswer({
        id: 'vorschau',
        itemId: item.id,
        uid: 'vorschau',
        firstName: 'Vorschau',
        choiceIndex: null,
        text: text.trim(),
        correct: null,
      })
      return
    }

    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await answerImpulseQuiz(
        item,
        { uid: profile.id, displayName: profile.displayName },
        { text },
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
    setChosen(null)
    setText('')
    setJustAnswered(false)
  }

  const riddle = item.kind === 'bilderraetsel'
  const KindIcon = riddle ? Puzzle : Search

  return (
    <section className={plain ? undefined : 'card p-5'}>
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
      ) : quiz.form === 'choice' ? (
        /* Kein Formular mehr: Es gibt nichts abzuschicken, der Tipp auf
           eine Möglichkeit ist die Antwort. Auch kein «radiogroup» –
           gewählt wird hier nicht, es wird gehandelt. Die Fundstelle
           bleibt bis zur Auflösung weg: «Joseph Smith –
           Lebensgeschichte» verriete Joseph Smith. */
        <div className="mt-4 space-y-2" role="group" aria-label="Antworten">
          {quiz.options.map((option, index) => (
            <QuizOption
              key={index}
              option={option}
              state="offen"
              disabled={busy}
              onClick={() => void choose(index)}
            />
          ))}
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
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

          {/* Die Suchfrage zeigt ihre Quelle schon vor dem Antworten – der
              Weg dorthin ist dort die eigentliche Aufgabe. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SourceLink item={item} />
            <button
              type="submit"
              className="btn-primary ms-auto"
              disabled={busy || text.trim().length === 0}
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

/**
 * Eine Antwortmöglichkeit – ohne Rahmen, ohne Buchstaben, nur die
 * Möglichkeit selbst.
 *
 * Vier Zustände in einer Gestalt: `offen` ist der Knopf vor der Antwort,
 * die übrigen drei zeichnen die Auflösung – die Lösung (`richtig`), der
 * eigene Fehlgriff (`daneben`) und alles Übrige, das zurücktritt
 * (`still`). Getragen wird die Zeile von einer ruhigen Fläche statt von
 * einem Strich: im Hellen ein Grau, im Dunkeln ein heller Hauch. Ein
 * Zeichen bekommt erst die Auflösung – Haken oder Kreuz –, und die
 * eigene Antwort ist angeschrieben.
 */
type QuizOptionState = 'offen' | 'richtig' | 'daneben' | 'still'

const OPTION_ROW: Record<QuizOptionState, string> = {
  offen:
    'bg-slate-100 hover:bg-slate-200/70 active:scale-[0.99] dark:bg-white/5 dark:hover:bg-white/10',
  richtig: 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-50',
  daneben: 'bg-rose-500/15 text-rose-950 dark:text-rose-50',
  still: 'bg-slate-100/60 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400',
}

/* Nur die Auflösung trägt ein Zeichen. Die stillen Zeilen behalten das
   leere Feld, damit die Möglichkeiten untereinander stehen bleiben. */
const OPTION_BADGE: Record<Exclude<QuizOptionState, 'offen'>, string> = {
  richtig: 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950',
  daneben: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
  still: '',
}

function QuizOption({
  option,
  state,
  chosen = false,
  disabled = false,
  onClick,
}: {
  option: string
  state: QuizOptionState
  /** Die eigene Antwort – angeschrieben, damit sie unverwechselbar ist. */
  chosen?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const shape = 'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition'
  const content = (
    <>
      {state !== 'offen' && (
        <span
          className={cn('grid size-6 shrink-0 place-items-center rounded-lg', OPTION_BADGE[state])}
          aria-hidden
        >
          {state === 'richtig' ? (
            <Check className="size-4" />
          ) : state === 'daneben' ? (
            <X className="size-4" />
          ) : null}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {/* Was die Farbe zeigt, muss auch vorgelesen werden. */}
        {state === 'richtig' && <span className="sr-only">Richtige Antwort: </span>}
        {state === 'daneben' && <span className="sr-only">Falsch: </span>}
        {option}
      </span>
      {chosen && <span className="shrink-0 text-[11px] font-medium opacity-70">Deine Antwort</span>}
    </>
  )

  if (state !== 'offen') {
    return <div className={cn(shape, OPTION_ROW[state])}>{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(shape, 'disabled:opacity-60', OPTION_ROW.offen)}
    >
      {content}
    </button>
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
    /* Die Auflösung tritt an statt zu erscheinen – sie ersetzt die
       Möglichkeiten im selben Moment, und ohne Brücke wäre der Wechsel
       ein Schnitt mitten im Lernmoment. */
    <div className={cn('mt-4 space-y-3', animated && 'animate-imp-rise')}>
      {quiz.form === 'choice' ? (
        <>
          <p
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              answer.correct
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-900/[0.06] text-slate-600 dark:bg-white/10 dark:text-slate-300',
            )}
          >
            {answer.correct ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            {answer.correct ? 'Richtig – stark!' : 'Gut versucht'}
          </p>
          <div className="space-y-2">
            {quiz.options.map((option, index) => {
              const isSolution = index === quiz.answerIndex
              const isChosen = index === (answer.choiceIndex ?? -1)
              return (
                <QuizOption
                  key={index}
                  option={option}
                  state={isSolution ? 'richtig' : isChosen ? 'daneben' : 'still'}
                  chosen={isChosen}
                />
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

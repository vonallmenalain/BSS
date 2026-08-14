import { Link2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scriptureLink } from '@/lib/scriptures'
import type { ImpulseItemInput } from '@/services/impulse'
import {
  IMPULSE_KIND_LABELS,
  IMPULSE_QUIZ_FORM_LABELS,
  type ImpulseKind,
  type ImpulseQuiz,
  type ImpulseQuizForm,
} from '@/lib/types'

/**
 * Die Felder einer Karte – der gemeinsame Kern zweier Formulare.
 *
 * Dieselben Felder füllen die Redaktion (`ImpulseItemForm`, mit Woche,
 * Platz und «bereit» darum herum) und die Mitmach-Ecke
 * (`ImpulseSubmitCard`): Wer einreicht, baut die fixfertige Karte im
 * selben Formular, das auch die Redaktion benutzt – wechselt die Art im
 * Auswahlfeld, wechseln die Felder mit (das Bilderrätsel bringt sein
 * Bild, das Quiz seine Antworten). Nur so bleibt «identisch» wahr,
 * ohne dass zwei Formulare gepflegt werden müssen.
 *
 * `idPrefix` hält die Element-IDs auseinander, falls beide Formulare je
 * einmal gleichzeitig offen sind.
 */
export function ImpulseItemFields({
  input,
  setInput,
  idPrefix = 'impulse',
  kindSibling,
}: {
  input: ImpulseItemInput
  setInput: React.Dispatch<React.SetStateAction<ImpulseItemInput>>
  idPrefix?: string
  /** Ein Feld neben der Art – die Redaktion stellt dort die Woche hin. */
  kindSibling?: React.ReactNode
}) {
  const quiz = input.quiz
  const setQuiz = (patch: Partial<ImpulseQuiz>) =>
    setInput((value) => ({ ...value, quiz: { ...value.quiz, ...patch } }))

  const setOption = (index: number, text: string) => {
    const options = [...quiz.options]
    options[index] = text
    setQuiz({ options })
  }

  const addOption = () => {
    if (quiz.options.length >= 6) return
    setQuiz({ options: [...quiz.options, ''] })
  }

  const removeOption = (index: number) => {
    if (quiz.options.length <= 2) return
    const options = quiz.options.filter((_, i) => i !== index)
    // Die Markierung wandert mit ihrer Antwort – oder auf die nächste, wenn
    // genau die markierte wegfällt.
    const answerIndex =
      index < quiz.answerIndex
        ? quiz.answerIndex - 1
        : Math.min(quiz.answerIndex, options.length - 1)
    setQuiz({ options, answerIndex })
  }

  /* Nur die Feed-Karten kennen den Wisch nach links – also auch nur sie
     das Feld «Vertiefung». Wochenziel und Tages-Challenge sind Kacheln. */
  const hasDeepening = input.kind !== 'wochenziel' && input.kind !== 'tageschallenge'

  /* Sieht die Quelle wie eine Schriftstelle aus, steht ihr Link in der
     Evangeliumsbibliothek einen Tipp entfernt (`lib/scriptures`) – kein
     Adressen-Abtippen, und nichts wird ungefragt eingesetzt. */
  const suggestedUrl = scriptureLink(input.sourceLabel)
  const showSuggestion = suggestedUrl !== null && input.sourceUrl.trim() !== suggestedUrl

  return (
    <>
      <div className={cn('grid gap-3', kindSibling ? 'sm:grid-cols-2' : undefined)}>
        <div>
          <label className="label" htmlFor={`${idPrefix}-kind`}>
            Art
          </label>
          <select
            id={`${idPrefix}-kind`}
            className="input"
            value={input.kind}
            onChange={(event) =>
              setInput((value) => ({ ...value, kind: event.target.value as ImpulseKind }))
            }
          >
            {(Object.keys(IMPULSE_KIND_LABELS) as ImpulseKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {IMPULSE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        {kindSibling}
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-title`}>
          {input.kind === 'quiz' || input.kind === 'frage'
            ? 'Frage'
            : input.kind === 'bilderraetsel'
              ? 'Frage zum Bild'
              : input.kind === 'impuls'
                ? 'Titel'
                : input.kind === 'feed'
                  ? 'Text der Karte'
                  : 'Aufgabe'}
        </label>
        <input
          id={`${idPrefix}-title`}
          className="input"
          value={input.title}
          onChange={(event) => setInput((value) => ({ ...value, title: event.target.value }))}
          placeholder={
            input.kind === 'quiz'
              ? 'Wie heisst der Hund, von dem in der Ansprache erzählt wird?'
              : input.kind === 'bilderraetsel'
                ? 'In welcher Stadt steht dieser Tempel?'
                : input.kind === 'frage'
                  ? 'Welche Schriftstelle hat dir diese Woche geholfen – und warum?'
                  : input.kind === 'wochenziel'
                    ? 'Lies diese Woche ein Kapitel im Buch Mormon'
                    : input.kind === 'tageschallenge'
                      ? 'Lies jeden Tag einen Vers'
                      : input.kind === 'teilen'
                        ? 'Frag ein Familienmitglied, wann es Nephis Beispiel gefolgt ist …'
                        : input.kind === 'feed'
                          ? '«Blickt in jedem Gedanken auf mich …»'
                          : 'Kraft aus den Schriften'
          }
        />
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-body`}>
          {input.kind === 'impuls' ? 'Hinführung' : 'Ergänzung (optional)'}
        </label>
        <textarea
          id={`${idPrefix}-body`}
          className="input min-h-20"
          value={input.body}
          onChange={(event) => setInput((value) => ({ ...value, body: event.target.value }))}
          placeholder={
            input.kind === 'quiz' || input.kind === 'bilderraetsel'
              ? 'Ein Hinweis, wo sich das Suchen lohnt …'
              : input.kind === 'impuls'
                ? 'Zwei, drei Sätze, die zur Schriftstelle hinführen …'
                : input.kind === 'teilen'
                  ? 'Ein Satz, warum sich dieses Gespräch lohnt …'
                  : 'Ein Satz, der Lust macht, dranzubleiben …'
          }
        />
      </div>

      {/* Die Vertiefung – die zweite Seite der Karte im Vollbild-Feed:
          Der Wisch nach links zeigt sie, und der Pfeil «Vertiefen»
          erscheint nur, wenn hier etwas steht. */}
      {hasDeepening && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-deepening`}>
            Vertiefung (optional)
          </label>
          <textarea
            id={`${idPrefix}-deepening`}
            className="input min-h-24"
            value={input.deepening}
            onChange={(event) =>
              setInput((value) => ({ ...value, deepening: event.target.value }))
            }
            placeholder={
              'Weiterführende Gedanken, Quellen und Links …\n' +
              'Alma 32:27 – https://www.churchofjesuschrist.org/…'
            }
          />
          <p className="hint mt-1">
            Erscheint im Feed beim Wisch nach links; nur Karten mit Vertiefung zeigen den
            pulsierenden Pfeil «Vertiefen». Eine Zeile «Alma 32:27 – https://…» wird zum
            anklickbaren Verweis mit Beschriftung, wie bei der Quelle.
          </p>
        </div>
      )}

      {/* Das Bild des Bilderrätsels – aus der offiziellen Mediathek der
          Kirche verlinkt, nicht hochgeladen. */}
      {input.kind === 'bilderraetsel' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Bild</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-image-url`}>
              Bild-Link
            </label>
            <input
              id={`${idPrefix}-image-url`}
              className="input"
              type="url"
              value={input.imageUrl}
              onChange={(event) =>
                setInput((value) => ({ ...value, imageUrl: event.target.value }))
              }
              placeholder="https://www.churchofjesuschrist.org/media/…"
            />
            <p className="hint mt-1">
              Aus der offiziellen Mediathek der Kirche (churchofjesuschrist.org/media): Bild
              öffnen, Bildadresse kopieren, hier einsetzen.
            </p>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-image-alt`}>
              Bildbeschreibung (optional)
            </label>
            <input
              id={`${idPrefix}-image-alt`}
              className="input"
              value={input.imageAlt}
              onChange={(event) =>
                setInput((value) => ({ ...value, imageAlt: event.target.value }))
              }
              placeholder="Ein Tempel bei Sonnenuntergang – ohne die Lösung zu verraten"
            />
          </div>
          {input.imageUrl.trim() && (
            <img
              src={input.imageUrl.trim()}
              alt={input.imageAlt || 'Vorschau des Bildes'}
              className="max-h-48 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
            />
          )}
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-source`}>
            {/* Aufgaben brauchen keine Fundstelle – Material schon
                (siehe `readyProblems`). */}
            {input.kind === 'impuls' || input.kind === 'quiz' ? 'Quelle' : 'Quelle (optional)'}
          </label>
          <input
            id={`${idPrefix}-source`}
            className="input"
            value={input.sourceLabel}
            onChange={(event) =>
              setInput((value) => ({ ...value, sourceLabel: event.target.value }))
            }
            placeholder="Alma 32:21 · Generalkonferenz Okt. 2025 …"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-source-url`}>
            Link zur Quelle
          </label>
          <input
            id={`${idPrefix}-source-url`}
            className="input"
            type="url"
            value={input.sourceUrl}
            onChange={(event) =>
              setInput((value) => ({ ...value, sourceUrl: event.target.value }))
            }
            placeholder="https://www.churchofjesuschrist.org/…"
          />
        </div>
      </div>

      {showSuggestion && (
        <button
          type="button"
          className="btn-secondary btn-sm -mt-1"
          onClick={() => setInput((value) => ({ ...value, sourceUrl: suggestedUrl }))}
        >
          <Link2 className="size-4" aria-hidden />
          Link zu «{input.sourceLabel.trim()}» einsetzen
        </button>
      )}

      {(input.kind === 'quiz' || input.kind === 'bilderraetsel') && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">
            {input.kind === 'bilderraetsel' ? 'Rätsel und Auflösung' : 'Quiz'}
          </legend>

          <div>
            <label className="label" htmlFor={`${idPrefix}-quiz-form`}>
              Form
            </label>
            <select
              id={`${idPrefix}-quiz-form`}
              className="input"
              value={quiz.form}
              onChange={(event) => setQuiz({ form: event.target.value as ImpulseQuizForm })}
            >
              {(Object.keys(IMPULSE_QUIZ_FORM_LABELS) as ImpulseQuizForm[]).map((form) => (
                <option key={form} value={form}>
                  {IMPULSE_QUIZ_FORM_LABELS[form]}
                </option>
              ))}
            </select>
          </div>

          {quiz.form === 'choice' ? (
            <div className="space-y-1.5">
              <p className="label">Antworten – die richtige markieren</p>
              {quiz.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${idPrefix}-correct`}
                    className="size-4 shrink-0"
                    checked={quiz.answerIndex === index}
                    onChange={() => setQuiz({ answerIndex: index })}
                    aria-label={`Antwort ${index + 1} ist richtig`}
                  />
                  <input
                    className="input"
                    value={option}
                    onChange={(event) => setOption(index, event.target.value)}
                    placeholder={`Antwort ${index + 1}`}
                  />
                  <button
                    type="button"
                    className={cn('btn-ghost p-1.5', quiz.options.length <= 2 && 'invisible')}
                    onClick={() => removeOption(index)}
                    aria-label={`Antwort ${index + 1} entfernen`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {quiz.options.length < 6 && (
                <button type="button" className="btn-ghost btn-sm" onClick={addOption}>
                  <Plus className="size-4" aria-hidden />
                  Antwort
                </button>
              )}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor={`${idPrefix}-solution`}>
                Lösung
              </label>
              <input
                id={`${idPrefix}-solution`}
                className="input"
                value={quiz.answerText}
                onChange={(event) => setQuiz({ answerText: event.target.value })}
                placeholder="So steht sie nachher in der Auflösung"
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor={`${idPrefix}-explanation`}>
              Erklärung für die Auflösung
            </label>
            <textarea
              id={`${idPrefix}-explanation`}
              className="input min-h-16"
              value={quiz.explanation}
              onChange={(event) => setQuiz({ explanation: event.target.value })}
              placeholder="Zwei, drei Sätze, warum die Antwort stimmt – der Lernmoment."
            />
          </div>
        </fieldset>
      )}
    </>
  )
}

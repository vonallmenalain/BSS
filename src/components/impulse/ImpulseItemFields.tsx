import { Link2, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addScriptureLinks,
  churchSearchLink,
  countScriptureLinkCandidates,
  scriptureLink,
} from '@/lib/scriptures'
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

  /* Reine Schriftstellen-Zeilen in der Vertiefung («Alma 32:27») lassen
     sich mit einem Tipp verlinken – zur Form «Alma 32:27 – https://…»,
     die die Anzeige als beschrifteten Verweis zeigt. */
  const deepeningCandidates = hasDeepening ? countScriptureLinkCandidates(input.deepening) : 0

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

      <SourceFields
        heading={
          /* Aufgaben brauchen keine Fundstelle – Material schon
             (siehe `readyProblems`). */
          input.kind === 'impuls' || input.kind === 'quiz' ? 'Quelle' : 'Quelle (optional)'
        }
        idLabel={`${idPrefix}-source`}
        idUrl={`${idPrefix}-source-url`}
        labelValue={input.sourceLabel}
        urlValue={input.sourceUrl}
        onLabel={(next) => setInput((value) => ({ ...value, sourceLabel: next }))}
        onUrl={(next) => setInput((value) => ({ ...value, sourceUrl: next }))}
      />

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

      {/* Die Vertiefung – die zweite Seite der Karte im Vollbild-Feed,
          sauber von der Hauptkarte getrennt: eigener Titel (leer heisst:
          der der Hauptkarte), eigener Text, eigene Quelle. Bewusst das
          letzte Stück des Formulars: Zuerst entsteht die Karte selbst
          (samt Quiz und Bild), die Vertiefung kommt bei Bedarf zuunterst
          dazu. Der Wisch nach links zeigt sie, und der Pfeil «Vertiefen»
          erscheint nur, wenn Text dasteht. */}
      {hasDeepening && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Vertiefung (optional)</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-deepening-title`}>
              Titel der Vertiefung
            </label>
            <input
              id={`${idPrefix}-deepening-title`}
              className="input"
              value={input.deepeningTitle}
              onChange={(event) =>
                setInput((value) => ({ ...value, deepeningTitle: event.target.value }))
              }
              placeholder={
                input.title.trim()
                  ? `Wie die Hauptkarte: «${input.title.trim()}»`
                  : 'Leer = Titel der Hauptkarte'
              }
            />
            <p className="hint mt-1">
              Leer gelassen steht der Titel der Hauptkarte auch über der Vertiefung – hier darf
              er abweichen.
            </p>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-deepening`}>
              Text
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
              Erscheint im Feed beim Wisch nach links; nur Karten mit Vertiefungstext zeigen den
              pulsierenden Pfeil «Vertiefen». Eine Zeile, auf der nur eine Schriftstelle steht
              («Alma 32:27»), wird von allein zum anklickbaren Verweis – mit dem Knopf unten
              bekommt sie ihren Link auch fest in den Text.
            </p>
            {deepeningCandidates > 0 && (
              <button
                type="button"
                className="btn-secondary btn-sm mt-1.5"
                onClick={() =>
                  setInput((value) => ({
                    ...value,
                    deepening: addScriptureLinks(value.deepening).text,
                  }))
                }
              >
                <Link2 className="size-4" aria-hidden />
                {deepeningCandidates === 1
                  ? 'Schriftstelle in der Vertiefung verlinken'
                  : `${deepeningCandidates} Schriftstellen in der Vertiefung verlinken`}
              </button>
            )}
          </div>
          <SourceFields
            heading="Quelle der Vertiefung (optional)"
            hint="Leer gelassen zeigt die Vertiefung die Quelle der Hauptkarte."
            idLabel={`${idPrefix}-deepening-source`}
            idUrl={`${idPrefix}-deepening-source-url`}
            labelValue={input.deepeningSourceLabel}
            urlValue={input.deepeningSourceUrl}
            onLabel={(next) =>
              setInput((value) => ({ ...value, deepeningSourceLabel: next }))
            }
            onUrl={(next) => setInput((value) => ({ ...value, deepeningSourceUrl: next }))}
          />
        </fieldset>
      )}
    </>
  )
}

/**
 * Eine Quellenangabe mit Link – samt der beiden Helfer: Sieht die
 * Angabe wie eine Schriftstelle aus, steht ihr Link einen Tipp entfernt
 * (`scriptureLink`); alles andere führt zur Suche der Kirche, aus der
 * sich die Adresse kopieren lässt. Zweimal im Formular im Einsatz –
 * für die Hauptkarte und für die Vertiefung, die seit der Trennung ihre
 * eigene Quelle tragen darf.
 */
function SourceFields({
  heading,
  hint,
  idLabel,
  idUrl,
  labelValue,
  urlValue,
  onLabel,
  onUrl,
}: {
  heading: string
  /** Eine Zeile unter den Feldern – etwa, was «leer» bedeutet. */
  hint?: string
  idLabel: string
  idUrl: string
  labelValue: string
  urlValue: string
  onLabel: (value: string) => void
  onUrl: (value: string) => void
}) {
  const suggestedUrl = scriptureLink(labelValue)
  const showSuggestion = suggestedUrl !== null && urlValue.trim() !== suggestedUrl
  const showSearch = suggestedUrl === null && labelValue.trim() !== '' && urlValue.trim() === ''

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={idLabel}>
            {heading}
          </label>
          <input
            id={idLabel}
            className="input"
            value={labelValue}
            onChange={(event) => onLabel(event.target.value)}
            placeholder="Alma 32:21 · Generalkonferenz Okt. 2025 …"
          />
        </div>
        <div>
          <label className="label" htmlFor={idUrl}>
            Link zur Quelle
          </label>
          <input
            id={idUrl}
            className="input"
            type="url"
            value={urlValue}
            onChange={(event) => onUrl(event.target.value)}
            placeholder="https://www.churchofjesuschrist.org/…"
          />
        </div>
      </div>

      {showSuggestion && (
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onUrl(suggestedUrl)}
        >
          <Link2 className="size-4" aria-hidden />
          Link zu «{labelValue.trim()}» einsetzen
        </button>
      )}
      {showSearch && (
        <div>
          <a
            className="btn-secondary btn-sm"
            href={churchSearchLink(labelValue)}
            target="_blank"
            rel="noreferrer"
          >
            <Search className="size-4" aria-hidden />
            «{labelValue.trim()}» auf churchofjesuschrist.org suchen
          </a>
          <p className="hint mt-1">
            Öffnet die Suche der Kirche in einem neuen Tab – Treffer öffnen, Adresse kopieren
            und hier als Link zur Quelle einsetzen.
          </p>
        </div>
      )}
      {hint && <p className="hint mt-0">{hint}</p>}
    </div>
  )
}

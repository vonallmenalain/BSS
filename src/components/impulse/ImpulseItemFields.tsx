import { useState } from 'react'
import { Crop, Link2, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addScriptureLinks,
  churchSearchLink,
  countScriptureLinkCandidates,
  scriptureLink,
} from '@/lib/scriptures'
import { impulseVideoHost, impulseVideoSource } from '@/lib/impulseVideo'
import { POLL_SCALE_MAX_STEPS, puzzlePieces } from '@/lib/impulse'
import { ImpulseCropPreview, ImpulseImageCropper } from '@/components/impulse/ImpulseImageCropper'
import type { ImpulseItemInput } from '@/services/impulse'
import {
  IMPULSE_CREST_PALETTE_LABELS,
  IMPULSE_CREST_SYMBOL_LABELS,
  IMPULSE_GAME_LABELS,
  IMPULSE_KIND_LABELS,
  IMPULSE_POLL_FORM_LABELS,
  IMPULSE_QUIZ_FORM_LABELS,
  type ImpulseCrestPalette,
  type ImpulseCrestSymbol,
  type ImpulseGameId,
  type ImpulseKind,
  type ImpulsePoll,
  type ImpulsePollForm,
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
 * einmal gleichzeitig offen sind. `kinds` schränkt die Arten ein – die
 * Mitmach-Ecke bietet das Minispiel nicht an: Ein Spiel ist Code, keine
 * Karte zum Ausfüllen.
 */
export function ImpulseItemFields({
  input,
  setInput,
  idPrefix = 'impulse',
  kindSibling,
  kinds = Object.keys(IMPULSE_KIND_LABELS) as ImpulseKind[],
}: {
  input: ImpulseItemInput
  setInput: React.Dispatch<React.SetStateAction<ImpulseItemInput>>
  idPrefix?: string
  /** Ein Feld neben der Art – die Redaktion stellt dort die Woche hin. */
  kindSibling?: React.ReactNode
  /** Die Arten zur Auswahl – sonst alle. */
  kinds?: readonly ImpulseKind[]
}) {
  /* Das Zuschneidefenster hängt am Bild-Link – es kommt und geht mit dem
     Knopf daneben (siehe `ImpulseImageCropper`). */
  const [cropping, setCropping] = useState(false)
  const imageUrl = input.imageUrl.trim()

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

  /* Die Umfrage: dieselben Handgriffe wie beim Quiz, nur ohne Markierung –
     richtig oder falsch gibt es hier nicht. */
  const poll = input.poll
  const setPoll = (patch: Partial<ImpulsePoll>) =>
    setInput((value) => ({ ...value, poll: { ...value.poll, ...patch } }))
  const setPollOption = (index: number, text: string) => {
    const options = [...poll.options]
    options[index] = text
    setPoll({ options })
  }

  /* Das Puzzle: die Teile, wie die Karte sie mischen wird. */
  const pieces = puzzlePieces(input.puzzleText)

  /* Nur die Feed-Karten kennen den Wisch nach links – also auch nur sie
     das Feld «Vertiefung». Wochenziel und Tages-Challenge sind Kacheln,
     und das Minispiel gehört dem Spiel. */
  const isGame = input.kind === 'spiel'
  const hasDeepening = input.kind !== 'wochenziel' && input.kind !== 'tageschallenge' && !isGame

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
            {kinds.map((kind) => (
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
          {input.kind === 'quiz' || input.kind === 'frage' || input.kind === 'umfrage'
            ? 'Frage'
            : input.kind === 'bilderraetsel'
              ? 'Frage zum Bild'
              : input.kind === 'impuls' ||
                  input.kind === 'video' ||
                  input.kind === 'puzzle' ||
                  isGame
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
            input.kind === 'umfrage'
              ? 'Was würdest du tun? …'
              : input.kind === 'puzzle'
                ? 'Vers-Puzzle: Bau die Verheissung zusammen'
                : input.kind === 'quiz'
                  ? 'Wie heisst der Hund, von dem in der Ansprache erzählt wird?'
                  : input.kind === 'bilderraetsel'
                    ? 'In welcher Stadt steht dieser Tempel?'
                    : input.kind === 'frage'
                      ? 'Welche Schriftstelle hat dir diese Woche geholfen – und warum?'
                      : input.kind === 'wochenziel'
                        ? 'Lies diese Woche ein Kapitel im Buch Mormon'
                        : input.kind === 'tageschallenge'
                          ? 'Lies jeden Tag einen Vers'
                          : input.kind === 'video'
                            ? '«Der Erlöser lebt» – zwei Minuten, die bleiben'
                            : input.kind === 'teilen'
                              ? 'Frag ein Familienmitglied, wann es Nephis Beispiel gefolgt ist …'
                              : input.kind === 'feed'
                                ? '«Blickt in jedem Gedanken auf mich …»'
                                : isGame
                                  ? 'Gut für dich?'
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
                  : input.kind === 'video'
                    ? 'Ein Satz, worauf beim Schauen zu achten ist …'
                    : isGame
                      ? 'Ein Satz, worum es geht – die Regeln erklärt das Spiel selbst …'
                      : 'Ein Satz, der Lust macht, dranzubleiben …'
          }
        />
      </div>

      {/* Ein grosses Emoji über dem Titel – der Blickfang der Karte im
          Vollbild, auch ohne Bild aus der Mediathek. */}
      <div>
        <label className="label" htmlFor={`${idPrefix}-emoji`}>
          Emoji (optional)
        </label>
        <input
          id={`${idPrefix}-emoji`}
          className="input w-24 text-center text-xl"
          value={input.emoji}
          onChange={(event) => setInput((value) => ({ ...value, emoji: event.target.value }))}
          placeholder="🔥"
          maxLength={8}
        />
      </div>

      {/* Das Wochenthema trägt die Woche: das Monatsthema über dem Titel,
          die Lektion am Sonntag, auf die alles hinläuft – und das Wappen,
          das sich mit jeder geschafften Karte aufbaut. */}
      {input.kind === 'impuls' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Woche, Sonntag und Wappen</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-kicker`}>
              Zeile über dem Titel (optional)
            </label>
            <input
              id={`${idPrefix}-kicker`}
              className="input"
              value={input.kicker}
              onChange={(event) => setInput((value) => ({ ...value, kicker: event.target.value }))}
              placeholder="Dein Körper ist heilig · Wort der Weisheit"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${idPrefix}-lesson`}>
                Lektion am Sonntag (optional)
              </label>
              <input
                id={`${idPrefix}-lesson`}
                className="input"
                value={input.lessonLabel}
                onChange={(event) =>
                  setInput((value) => ({ ...value, lessonLabel: event.target.value }))
                }
                placeholder="Erfahre mehr über das Wort der Weisheit"
              />
            </div>
            <div>
              <label className="label" htmlFor={`${idPrefix}-lesson-url`}>
                Link zur Lektion
              </label>
              <input
                id={`${idPrefix}-lesson-url`}
                className="input"
                type="url"
                value={input.lessonUrl}
                onChange={(event) =>
                  setInput((value) => ({ ...value, lessonUrl: event.target.value }))
                }
                placeholder="https://www.churchofjesuschrist.org/study/ftsoy/…"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor={`${idPrefix}-crest-symbol`}>
                Zeichen im Wappen
              </label>
              <select
                id={`${idPrefix}-crest-symbol`}
                className="input"
                value={input.crestSymbol}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    crestSymbol: event.target.value as ImpulseCrestSymbol | '',
                  }))
                }
              >
                <option value="">Automatisch</option>
                {(Object.keys(IMPULSE_CREST_SYMBOL_LABELS) as ImpulseCrestSymbol[]).map((key) => (
                  <option key={key} value={key}>
                    {IMPULSE_CREST_SYMBOL_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`${idPrefix}-crest-palette`}>
                Farbe
              </label>
              <select
                id={`${idPrefix}-crest-palette`}
                className="input"
                value={input.crestPalette}
                disabled={!input.crestSymbol}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    crestPalette: event.target.value as ImpulseCrestPalette,
                  }))
                }
              >
                {(Object.keys(IMPULSE_CREST_PALETTE_LABELS) as ImpulseCrestPalette[]).map((key) => (
                  <option key={key} value={key}>
                    {IMPULSE_CREST_PALETTE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`${idPrefix}-crest-motto`}>
                Spruch auf dem Band
              </label>
              <input
                id={`${idPrefix}-crest-motto`}
                className="input"
                value={input.crestMotto}
                disabled={!input.crestSymbol}
                onChange={(event) =>
                  setInput((value) => ({ ...value, crestMotto: event.target.value }))
                }
                placeholder="Treu zu allen Zeiten"
                maxLength={32}
              />
            </div>
          </div>
          <p className="hint mt-0">
            Das Wappen baut sich mit jeder geschafften Karte auf; Zeichen und Spruch erscheinen
            erst, wenn alles geschafft ist. «Automatisch» wählt Zeichen und Farbe nach der Woche.
          </p>
        </fieldset>
      )}

      {/* Die Umfrage: Auswahl oder Skala – das Ergebnis des Kollegiums
          sehen alle erst nach der eigenen Stimme, und nur als Zahl. */}
      {input.kind === 'umfrage' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Umfrage</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-poll-form`}>
              Form
            </label>
            <select
              id={`${idPrefix}-poll-form`}
              className="input"
              value={poll.form}
              onChange={(event) => setPoll({ form: event.target.value as ImpulsePollForm })}
            >
              {(Object.keys(IMPULSE_POLL_FORM_LABELS) as ImpulsePollForm[]).map((form) => (
                <option key={form} value={form}>
                  {IMPULSE_POLL_FORM_LABELS[form]}
                </option>
              ))}
            </select>
          </div>

          {poll.form === 'choice' ? (
            <div className="space-y-1.5">
              <p className="label">Möglichkeiten</p>
              {poll.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    className="input"
                    value={option}
                    onChange={(event) => setPollOption(index, event.target.value)}
                    placeholder={`Möglichkeit ${index + 1}`}
                  />
                  <button
                    type="button"
                    className={cn('btn-ghost p-1.5', poll.options.length <= 2 && 'invisible')}
                    onClick={() =>
                      poll.options.length > 2 &&
                      setPoll({ options: poll.options.filter((_, i) => i !== index) })
                    }
                    aria-label={`Möglichkeit ${index + 1} entfernen`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {poll.options.length < 6 && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setPoll({ options: [...poll.options, ''] })}
                >
                  <Plus className="size-4" aria-hidden />
                  Möglichkeit
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor={`${idPrefix}-poll-min`}>
                    Von
                  </label>
                  <input
                    id={`${idPrefix}-poll-min`}
                    className="input"
                    type="number"
                    value={poll.min}
                    onChange={(event) => setPoll({ min: Number(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${idPrefix}-poll-max`}>
                    Bis
                  </label>
                  <input
                    id={`${idPrefix}-poll-max`}
                    className="input"
                    type="number"
                    value={poll.max}
                    onChange={(event) => setPoll({ max: Number(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${idPrefix}-poll-unit`}>
                    Einheit
                  </label>
                  <input
                    id={`${idPrefix}-poll-unit`}
                    className="input"
                    value={poll.unit}
                    onChange={(event) => setPoll({ unit: event.target.value })}
                    placeholder="Std."
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`${idPrefix}-poll-min-label`}>
                    Linkes Ende heisst
                  </label>
                  <input
                    id={`${idPrefix}-poll-min-label`}
                    className="input"
                    value={poll.minLabel}
                    onChange={(event) => setPoll({ minLabel: event.target.value })}
                    placeholder="sehr schwer"
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${idPrefix}-poll-max-label`}>
                    Rechtes Ende heisst
                  </label>
                  <input
                    id={`${idPrefix}-poll-max-label`}
                    className="input"
                    value={poll.maxLabel}
                    onChange={(event) => setPoll({ maxLabel: event.target.value })}
                    placeholder="ganz leicht"
                  />
                </div>
              </div>
              <p className="hint mt-0">
                Ganze Zahlen, höchstens {POLL_SCALE_MAX_STEPS} Schritte – nach der Stimme zeigt die
                Karte die Verteilung und den Schnitt im Kollegium.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor={`${idPrefix}-poll-explanation`}>
              Nach der Stimme (optional)
            </label>
            <textarea
              id={`${idPrefix}-poll-explanation`}
              className="input min-h-16"
              value={poll.explanation}
              onChange={(event) => setPoll({ explanation: event.target.value })}
              placeholder="Ein Gedanke aus den Schriften oder dem Wegweiser dazu …"
            />
          </div>
        </fieldset>
      )}

      {/* Das Vers-Puzzle: der Vers in der richtigen Reihenfolge – die Karte
          mischt die Teile selbst. */}
      {input.kind === 'puzzle' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Vers-Puzzle</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-puzzle-text`}>
              Vers in der richtigen Reihenfolge
            </label>
            <textarea
              id={`${idPrefix}-puzzle-text`}
              className="input min-h-16"
              value={input.puzzleText}
              onChange={(event) =>
                setInput((value) => ({ ...value, puzzleText: event.target.value }))
              }
              placeholder="die Worte / von Christus / werden euch / alles sagen, / was ihr / tun sollt"
            />
            <p className="hint mt-1">
              Teile mit « / » trennen – ohne Schrägstrich zählt jedes Wort als Teil.
              {pieces.length > 0 && ` ${pieces.length} Teile.`}
            </p>
            {pieces.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pieces.map((piece, index) => (
                  <span
                    key={index}
                    className="rounded-lg bg-yellow-400/25 px-2 py-1 text-xs font-medium"
                  >
                    {piece}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-puzzle-explanation`}>
              Nach dem Versuch (optional)
            </label>
            <textarea
              id={`${idPrefix}-puzzle-explanation`}
              className="input min-h-16"
              value={input.puzzleExplanation}
              onChange={(event) =>
                setInput((value) => ({ ...value, puzzleExplanation: event.target.value }))
              }
              placeholder="Was dieser Vers bedeutet – zwei Sätze genügen."
            />
          </div>
        </fieldset>
      )}

      {/* Das Minispiel: Welches Spiel die Karte spielt. Jedes Spiel ist
          fertiger Code – hier wird gewählt, nicht gebaut. */}
      {isGame && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-game`}>
            Spiel
          </label>
          <select
            id={`${idPrefix}-game`}
            className="input"
            value={input.game}
            onChange={(event) =>
              setInput((value) => ({ ...value, game: event.target.value as ImpulseGameId }))
            }
          >
            {(Object.keys(IMPULSE_GAME_LABELS) as ImpulseGameId[]).map((game) => (
              <option key={game} value={game}>
                {IMPULSE_GAME_LABELS[game]}
              </option>
            ))}
          </select>
          <p className="hint mt-1">
            Das Minispiel steht im Feed immer ganz zuletzt. Je Person zählt der beste Lauf; die
            Rangliste zeigt nur Namen, die die Spielenden selbst eintragen.
          </p>
        </div>
      )}

      {/* Das Video der Video-Karte – ein Link, kein Upload. Was daraus
          wird, liest `lib/impulseVideo` an der Adresse ab; die Zeile
          darunter sagt es sofort, damit niemand erst in der Vorschau
          merkt, dass sein Link hinausführt statt zu spielen. */}
      {input.kind === 'video' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">Video</legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-video-url`}>
              Videolink
            </label>
            <input
              id={`${idPrefix}-video-url`}
              className="input"
              type="url"
              value={input.videoUrl}
              onChange={(event) =>
                setInput((value) => ({ ...value, videoUrl: event.target.value }))
              }
              placeholder="https://www.youtube.com/watch?v=… oder https://…/video.mp4"
            />
            <p className="hint mt-1">{videoHint(input.videoUrl)}</p>
          </div>
          {/* Ein Wisch oder zwei: Standard ist einer – das Video hat den
              Bildschirm für sich, danach kommt die nächste Karte. Der
              Haken holt den Text zurück, der sonst bei jeder Bildkarte
              beim zweiten Wisch darüberfährt. */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={input.videoTextPage}
              onChange={(event) =>
                setInput((value) => ({ ...value, videoTextPage: event.target.checked }))
              }
            />
            Text über dem Video – zweiter Wisch
          </label>
        </fieldset>
      )}

      {/* Das Bild – aus der offiziellen Mediathek der Kirche verlinkt,
          nicht hochgeladen. Jede Kartenart darf eines tragen: Beim
          Bilderrätsel ist es das Rätsel selbst, beim Video das
          Vorschaubild, sonst das Bild zum Thema. Im Vollbild-Feed füllt
          es die erste Seite der Karte; der Text kommt beim zweiten Wisch
          darüber. */}
      {!isGame && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="label px-1">
            {input.kind === 'bilderraetsel'
              ? 'Bild'
              : input.kind === 'video'
                ? 'Vorschaubild (optional)'
                : 'Bild (optional)'}
          </legend>
          <div>
            <label className="label" htmlFor={`${idPrefix}-image-url`}>
              Bild-Link
            </label>
            <div className="flex gap-2">
              <input
                id={`${idPrefix}-image-url`}
                className="input min-w-0 flex-1"
                type="url"
                value={input.imageUrl}
                onChange={(event) =>
                  /* Ein anderes Bild, ein anderer Ausschnitt: Die alten Masse
                   gälten für ein Bild, das nicht mehr dasteht. */
                  setInput((value) => ({ ...value, imageUrl: event.target.value, imageCrop: null }))
                }
                placeholder="https://www.churchofjesuschrist.org/media/…"
              />
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setCropping(true)}
                disabled={!imageUrl}
              >
                <Crop className="size-4" aria-hidden />
                Ausschnitt
              </button>
            </div>
            <p className="hint mt-1">
              Aus der Mediathek der Kirche: Bildadresse kopieren und hier einsetzen.
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
              placeholder={
                input.kind === 'bilderraetsel'
                  ? 'Ein Tempel bei Sonnenuntergang – ohne die Lösung zu verraten'
                  : 'Was auf dem Bild zu sehen ist'
              }
            />
          </div>
          {/* Die Vorschau zeigt, was die Karte zeigt – mit Ausschnitt, wenn
            einer gewählt ist. */}
          {imageUrl && (
            <ImpulseCropPreview url={imageUrl} alt={input.imageAlt} crop={input.imageCrop} />
          )}
        </fieldset>
      )}

      {cropping && imageUrl && (
        <ImpulseImageCropper
          url={imageUrl}
          alt={input.imageAlt}
          crop={input.imageCrop}
          onApply={(crop) => setInput((value) => ({ ...value, imageCrop: crop }))}
          onClose={() => setCropping(false)}
        />
      )}

      {!isGame && (
        <SourceFields
          heading={
            /* Aufgaben brauchen keine Fundstelle – Material schon
             (siehe `readyProblems`). */
            input.kind === 'impuls' || input.kind === 'quiz' || input.kind === 'puzzle'
              ? 'Quelle'
              : 'Quelle (optional)'
          }
          idLabel={`${idPrefix}-source`}
          idUrl={`${idPrefix}-source-url`}
          labelValue={input.sourceLabel}
          urlValue={input.sourceUrl}
          onLabel={(next) => setInput((value) => ({ ...value, sourceLabel: next }))}
          onUrl={(next) => setInput((value) => ({ ...value, sourceUrl: next }))}
        />
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
                placeholder="Die richtige Antwort"
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
              placeholder="Zwei, drei Sätze, warum die Antwort stimmt."
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
            <p className="hint mt-1">Die Vertiefung erscheint beim Wisch nach links.</p>
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
            hint="Leer = Quelle der Hauptkarte."
            idLabel={`${idPrefix}-deepening-source`}
            idUrl={`${idPrefix}-deepening-source-url`}
            labelValue={input.deepeningSourceLabel}
            urlValue={input.deepeningSourceUrl}
            onLabel={(next) => setInput((value) => ({ ...value, deepeningSourceLabel: next }))}
            onUrl={(next) => setInput((value) => ({ ...value, deepeningSourceUrl: next }))}
          />
        </fieldset>
      )}
    </>
  )
}

/** Was aus dem eingesetzten Videolink wird – im Klartext unter dem Feld. */
function videoHint(raw: string): string {
  const source = impulseVideoSource(raw)
  if (!raw.trim()) {
    return 'YouTube, Vimeo – oder der direkte Link auf die Videodatei (…mp4), etwa aus der Mediathek der Kirche.'
  }
  if (!source) return 'Das ist noch keine gültige Adresse.'
  switch (source.art) {
    case 'datei':
      return 'Videodatei – läuft in der App, im Vollbild und startet beim Wischen von selbst.'
    case 'youtube':
      return 'YouTube – wird in der Karte eingebettet und startet stumm beim Wischen.'
    case 'vimeo':
      return 'Vimeo – wird in der Karte eingebettet und startet stumm beim Wischen.'
    default:
      return `${impulseVideoHost(source)} lässt sich nicht einbetten: Die Karte zeigt einen Knopf, der das Video draussen öffnet. Besser läuft ein YouTube-Link oder der direkte Videolink (…mp4).`
  }
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
        <button type="button" className="btn-secondary btn-sm" onClick={() => onUrl(suggestedUrl)}>
          <Link2 className="size-4" aria-hidden />
          Link zu «{labelValue.trim()}» einsetzen
        </button>
      )}
      {showSearch && (
        <a
          className="btn-secondary btn-sm"
          href={churchSearchLink(labelValue)}
          target="_blank"
          rel="noreferrer"
        >
          <Search className="size-4" aria-hidden />«{labelValue.trim()}» auf churchofjesuschrist.org
          suchen
        </a>
      )}
      {hint && <p className="hint mt-0">{hint}</p>}
    </div>
  )
}

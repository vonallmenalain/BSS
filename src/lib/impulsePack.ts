import { scriptureLink } from './scriptures.ts'
import type {
  ImpulseCrest,
  ImpulseItem,
  ImpulseKind,
  ImpulsePoll,
  ImpulsePuzzle,
  ImpulseQuiz,
  ImpulseSource,
  ImpulseStatus,
} from './types.ts'

/*
 * Das Themenpaket des Bereichs «Anti Doom»: sieben Wochen nach dem
 * Leitfaden «Für eine starke Jugend» (Heft Oktober 2026 mit den
 * Lektionen für Oktober und November). Es ersetzt das frühere
 * Startpaket – die Redaktion hat im Herbst 2026 neu gestartet.
 *
 * **Jede Woche bereitet auf die Lektion am Sonntag vor.** Die Woche
 * läuft von Montag bis Sonntag, und am Sonntag steht im Kollegium genau
 * das Thema an, um das sich die Woche dreht:
 *
 * | Woche           | Sonntag | Lektion                                          |
 * | --------------- | ------- | ------------------------------------------------ |
 * | 5.–11. Okt.     | 11. Okt | Erfahre mehr über das Wort der Weisheit          |
 * | 12.–18. Okt.    | 18. Okt | Erfahre mehr über das Gesetz der Keuschheit      |
 * | 19.–25. Okt.    | 25. Okt | Ein Sohn Gottes werden, der seine Bündnisse hält |
 * | 26. Okt.–1. Nov | 1. Nov  | Kapitel «Die Wahrheit befreit dich» (Fastsonntag)|
 * | 2.–8. Nov.      | 8. Nov  | Erfahre mehr über das Schriftstudium             |
 * | 9.–15. Nov.     | 15. Nov | Erfahre mehr über die Suche nach Wahrheit        |
 * | 16.–22. Nov.    | 22. Nov | Ein Sohn Gottes werden … (Hauptmann Moroni)      |
 *
 * **Der Feed wechselt den Takt.** Statt zehn gleicher Karten am Stück
 * folgen Umfrage, Fakt, Quiz, Selbsteinschätzung, «Fakt oder Mythos?»,
 * «Was würdest du tun?», Vers-Puzzle, offene Fragen und Geschichten
 * aufeinander – die Reihenfolge des Pakets ist die Reihenfolge des Feeds
 * (`order`, über alle Arten hinweg). Jede Woche trägt ihr eigenes
 * Wappen, das sich mit jeder geschafften Karte aufbaut.
 *
 * **Alles aus offiziellem Material der Kirche.** Die Grundlage sind die
 * Lektionen im Heft «Für eine starke Jugend», der Wegweiser «Für eine
 * starke Jugend», die heiligen Schriften und die Evangeliumsthemen. Was
 * behauptet wird, steht an der verlinkten Stelle; wörtliche Zitate gibt
 * es nur dort, wo der Wortlaut gesichert ist – sonst steht der Gedanke
 * in eigenen Worten mit Fundstelle. Schriftstellen-Links leitet
 * `scriptureLink` her, dieselbe Funktion, die auch das Formular benutzt.
 *
 * `tests/impulse-pack.test.ts` hält fest, dass jeder Inhalt die Prüfung
 * des Redaktionsformulars besteht, dass jede Woche ihre Lektion und ihr
 * Wappen trägt und dass die IDs fest und eindeutig sind.
 */

const CHURCH = 'https://www.churchofjesuschrist.org'

/** Das Heft Oktober 2026 – mit den Lektionen für Oktober und November. */
const FSY_ISSUE = `${CHURCH}/study/ftsoy/2026/10?lang=deu`
const fsyLesson = (slug: string) => `${CHURCH}/study/ftsoy/2026/10/fsy-lessons/${slug}?lang=deu`

/** Der Wegweiser «Für eine starke Jugend» – die Kapitel des Monats. */
const GUIDE_BODY = `${CHURCH}/study/manual/for-the-strength-of-youth/10-your-body-is-sacred?lang=deu`
const GUIDE_TRUTH = `${CHURCH}/study/manual/for-the-strength-of-youth/11-truth-will-make-you-free?lang=deu`

const TOPIC_WORD_OF_WISDOM = `${CHURCH}/study/manual/gospel-topics/word-of-wisdom?lang=deu`
const TOPIC_CHASTITY = `${CHURCH}/study/manual/gospel-topics/chastity?lang=deu`
const TOPIC_FASTING = `${CHURCH}/study/manual/gospel-topics/fasting-and-fast-offerings?lang=deu`
const HISTORY_WORD_OF_WISDOM = `${CHURCH}/study/history/topics/word-of-wisdom-dc-89?lang=deu`
const CONTEXT_WORD_OF_WISDOM = `${CHURCH}/study/manual/revelations-in-context/the-word-of-wisdom?lang=deu`
const LIAHONA_WORD_OF_WISDOM = `${CHURCH}/study/liahona/2019/08/youth/the-word-of-wisdom-what-it-is-what-it-isnt?lang=deu`
const CONFERENCE = `${CHURCH}/study/general-conference?lang=deu`

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/**
 * Eine Schriftstelle als Quelle – der Link wird hergeleitet. Erkennt
 * `scriptureLink` die Angabe nicht, bleibt der Link leer; der Test des
 * Pakets schlägt dann Alarm, statt dass die App beim Laden scheitert.
 */
function verse(label: string): ImpulseSource {
  return { label, url: scriptureLink(label) ?? '' }
}

/** Eine Quelle ausserhalb der Schriften – Heft, Wegweiser, Evangeliumsthemen. */
function source(label: string, url: string): ImpulseSource {
  return { label, url }
}

const FSY_OCTOBER = (label: string) =>
  source(`Für eine starke Jugend, Oktober 2026 – ${label}`, FSY_ISSUE)

/** Eine Auswahlfrage – `answer` ist der Index der richtigen Möglichkeit. */
function choice(options: string[], answer: number, explanation: string): ImpulseQuiz {
  return { form: 'choice', options, answerIndex: answer, answerText: '', explanation }
}

/** «Fakt oder Mythos?» – die Auswahl mit zwei Möglichkeiten. */
function factOrMyth(fact: boolean, explanation: string): ImpulseQuiz {
  return choice(['Fakt', 'Mythos'], fact ? 0 : 1, explanation)
}

/** Die Suchfrage: Die Antwort steht in der Quelle. */
function search(answer: string, explanation: string): ImpulseQuiz {
  return { form: 'text', options: [], answerIndex: 0, answerText: answer, explanation }
}

/** Eine Umfrage mit Möglichkeiten – auch «Was würdest du tun?». */
function vote(options: string[], explanation: string): ImpulsePoll {
  return {
    form: 'choice',
    options,
    min: 1,
    max: 10,
    minLabel: '',
    maxLabel: '',
    unit: '',
    explanation,
  }
}

/** Eine Skala – ein Wert zwischen zwei Enden. */
function scale(
  range: [number, number],
  labels: [string, string],
  explanation: string,
  unit = '',
): ImpulsePoll {
  return {
    form: 'scale',
    options: [],
    min: range[0],
    max: range[1],
    minLabel: labels[0],
    maxLabel: labels[1],
    unit,
    explanation,
  }
}

/** Ein Vers-Puzzle – die Teile durch « / » getrennt. */
function puzzle(text: string, explanation: string): ImpulsePuzzle {
  return { text, explanation }
}

/* ------------------------------------------------------------------ */
/* Die Wochen                                                          */
/* ------------------------------------------------------------------ */

export interface PackCard {
  /** Der hintere Teil der festen ID – «umfrage-1», «quiz-2» … */
  key: string
  kind: ImpulseKind
  title: string
  body?: string
  emoji?: string
  /** Die Vertiefung – die zweite Seite der Karte im Vollbild-Feed. */
  deepening?: string
  source?: ImpulseSource
  quiz?: ImpulseQuiz
  poll?: ImpulsePoll
  puzzle?: ImpulsePuzzle
}

export interface PackTheme extends Omit<PackCard, 'key' | 'kind'> {
  /** Die Zeile über dem Titel – das Monatsthema. */
  kicker: string
  /** Die Lektion am Sonntag. */
  lesson: ImpulseSource
  crest: ImpulseCrest
}

export interface PackWeek {
  /** Die ISO-Woche – Montag bis Sonntag, am Sonntag ist die Lektion. */
  week: string
  theme: PackTheme
  goal: Omit<PackCard, 'key' | 'kind'>
  challenge: Omit<PackCard, 'key' | 'kind'>
  /** Die Karten nach dem Wochenthema, in Feed-Reihenfolge – die Teilen-Aufgabe zuletzt. */
  deck: PackCard[]
}

export const PACK_WEEKS: PackWeek[] = [
  /* ================================================================ */
  /* 5.–11. Oktober: Wort der Weisheit                                 */
  /* ================================================================ */
  {
    week: '2026-W41',
    theme: {
      kicker: 'Dein Körper ist heilig',
      emoji: '🏃',
      title: 'Wort der Weisheit: Gottes Gameplan für deinen Körper',
      body:
        'Diese Woche geht es ums Wort der Weisheit – die Offenbarung, die der Herr 1833 Joseph ' +
        'Smith gab (Lehre und Bündnisse 89). Eine Richtschnur für Körper und Geist: was dir ' +
        'guttut, was du meidest – und welche Verheissungen dranhängen. Swipe dich durch die ' +
        'Woche und bau dein Wappen.',
      deepening:
        'Der Herr nennt das Wort der Weisheit einen «Grundsatz mit einer Verheissung» ' +
        '(Lehre und Bündnisse 89:3). Achte beim Lesen auf drei Teile: was nicht gut ist ' +
        '(Verse 5–9), was gut ist (Verse 10–17) – und die Verheissungen am Schluss ' +
        '(Verse 18–21).\n\n' +
        'Zum Weiterlesen:\n' +
        'Lehre und Bündnisse 89\n' +
        `Wegweiser «Für eine starke Jugend»: Dein Körper ist heilig – ${GUIDE_BODY}\n` +
        `Evangeliumsthemen: Wort der Weisheit – ${TOPIC_WORD_OF_WISDOM}`,
      source: source(
        'Für eine starke Jugend, Oktober 2026 – Zweiter Sonntag',
        fsyLesson('02-second-sunday'),
      ),
      lesson: source('Erfahre mehr über das Wort der Weisheit', fsyLesson('02-second-sunday')),
      crest: { symbol: 'laeufer', palette: 'smaragd', motto: 'Laufen und nicht ermüden' },
    },
    goal: {
      emoji: '📖',
      title: 'Lies Lehre und Bündnisse 89 ganz – und markiere jede Verheissung',
      body:
        'Es sind nur 21 Verse. Schreib die Verheissungen heraus – welche spricht dich am ' +
        'meisten an?',
      source: verse('Lehre und Bündnisse 89'),
    },
    challenge: {
      emoji: '🚴',
      title: 'Jeden Tag 20 Minuten Bewegung',
      body:
        'Velo, Fussball, Joggen, mit dem Hund raus – Hauptsache bewegt. Dein Körper ist ein ' +
        'Geschenk; zeig ihm, dass du ihn ernst nimmst.',
      source: verse('1 Korinther 6:19–20'),
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '🤔',
        title: 'Ehrlich: Woran denkst du zuerst beim Wort der Weisheit?',
        poll: vote(
          [
            'An eine Liste mit Verboten',
            'An Gesundheit und Sport',
            'An Freiheit – von nichts abhängig sein',
            'An Gottes Verheissungen',
          ],
          'Alles davon steckt drin. Der Herr nennt es einen «Grundsatz mit einer Verheissung» ' +
            '(LuB 89:3): Es geht nicht nur ums Weglassen, sondern um einen Körper, der dir ' +
            'gehorcht, einen klaren Kopf – und darum, dem Geist nahe zu bleiben.',
        ),
        source: verse('Lehre und Bündnisse 89:3'),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '💨',
        title: 'Wusstest du? Alles begann mit einem verrauchten Raum.',
        body:
          'Kirtland, 1833: Die Brüder trafen sich in der Schule der Propheten, einem Raum ' +
          'über dem Laden von Newel K. Whitney – und viele rauchten oder kauten dabei Tabak. ' +
          'Emma Smith, die mit Joseph im Haus wohnte, musste danach den Boden schrubben. ' +
          'Joseph fragte den Herrn und erhielt am 27. Februar 1833 die Offenbarung, die heute ' +
          'in Lehre und Bündnisse 89 steht.',
        deepening:
          'Mehr zur Entstehung – und wie die ersten Heiligen mit dem neuen Rat umgingen – ' +
          'erzählt der Artikel «Das Wort der Weisheit» aus der Reihe «Offenbarungen im ' +
          'Kontext».\n\n' +
          'Zum Weiterlesen:\n' +
          `Offenbarungen im Kontext: Das Wort der Weisheit – ${CONTEXT_WORD_OF_WISDOM}`,
        source: source('Kirchengeschichte: Wort der Weisheit (LuB 89)', HISTORY_WORD_OF_WISDOM),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '⏳',
        title: 'In welchem Jahr gab der Herr das Wort der Weisheit?',
        quiz: choice(
          ['1820', '1830', '1833', '1844'],
          2,
          'Am 27. Februar 1833 in Kirtland, Ohio. 1820 war die erste Vision, 1830 wurde die ' +
            'Kirche gegründet, und 1844 starb Joseph Smith in Carthage.',
        ),
        source: source('Evangeliumsthemen: Wort der Weisheit', TOPIC_WORD_OF_WISDOM),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '😴',
        title: 'Wie viele Stunden hast du letzte Nacht geschlafen?',
        body: 'Schätzen genügt – niemand sieht, wer was angibt.',
        poll: scale(
          [4, 11],
          ['4 oder weniger', '11 oder mehr'],
          'Auf den Körper achtgeben heisst auch: genug schlafen. Der Herr rät in Lehre und ' +
            'Bündnisse 88:124, früh zu Bett zu gehen, damit man nicht müde ist, und früh ' +
            'aufzustehen, damit Körper und Sinn gestärkt werden.',
          'Std.',
        ),
        source: verse('Lehre und Bündnisse 88:124'),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '🔥',
        title: '«… ein Grundsatz mit einer Verheissung.»',
        body:
          'So nennt der Herr das Wort der Weisheit. Der Grundsatz sagt dir, was gut ist – die ' +
          'Verheissung, was daraus wird: Gesundheit, Kraft, Weisheit, verborgene Schätze der ' +
          'Erkenntnis und Schutz (LuB 89:18–21).',
        deepening:
          'Spannend: Viele der Verheissungen sind geistig – Weisheit und Erkenntnis ' +
          '(Vers 19). Wer seinen Körper rein hält, hat einen klaren Kopf und nimmt die ' +
          'Eingebungen des Heiligen Geistes leichter wahr. Vers 21 erinnert an das erste ' +
          'Pessach in Ägypten: Der zerstörende Engel ging an den Häusern der Israeliten ' +
          'vorüber.\n\n' +
          'Zum Weiterlesen:\n' +
          'Lehre und Bündnisse 89:18–21\n' +
          'Exodus 12:23',
        source: verse('Lehre und Bündnisse 89:3'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title: 'Fakt oder Mythos? «Wer das Wort der Weisheit hält, wird nie krank.»',
        quiz: factOrMyth(
          false,
          'Mythos. Der Herr verspricht Gesundheit, Kraft, Weisheit und Schutz (LuB 89:18–21) – ' +
            'aber keinen Körper, der nie krank wird. Auch Menschen, die treu danach leben, ' +
            'werden krank oder verletzen sich. Die Verheissungen gelten trotzdem: Gehorsam ' +
            'bringt Segen für Körper und Geist.',
        ),
        source: verse('Lehre und Bündnisse 89:18–21'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '🎉',
        title:
          'Was würdest du tun? Party am Samstag – jemand hält dir eine Vape hin. Alle schauen.',
        poll: vote(
          [
            'Locker «Nein danke» sagen',
            'Mit einem Witz ablenken',
            'Kurz erklären, warum ich das nicht mache',
            'Einen Grund finden, um zu gehen',
          ],
          'Alles kann richtig sein – Hauptsache, du hast dir die Antwort vorher überlegt. ' +
            'Im Oktoberheft steht: «Wenn ich vorausplane, fühle ich mich besser und treffe ' +
            'sinnvollere Entscheidungen.» Übrigens: Vapes und E-Zigaretten fallen klar unter ' +
            'das Wort der Weisheit – die meisten enthalten Nikotin, das stark abhängig macht.',
        ),
        source: source(
          'Liahona, August 2019 (Jugend): Das Wort der Weisheit',
          LIAHONA_WORD_OF_WISDOM,
        ),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Bau die Verheissung aus LuB 89:20 zusammen.',
        body: 'Tipp: Es geht ums Laufen und ums Gehen.',
        puzzle: puzzle(
          'werden / laufen / und / nicht / ermüden / und / werden / gehen / und / nicht / ermatten',
          'Eine der Verheissungen des Wortes der Weisheit (LuB 89:20) – ganz ähnlich wie in ' +
            'Jesaja 40:31. Kraft, die bleibt: im Körper und im Geist.',
        ),
        source: verse('Lehre und Bündnisse 89:20'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '💪',
        title: 'Daniel & Co.: die 10-Tage-Challenge',
        body:
          'Daniel und seine Freunde lebten als junge Männer am Hof des Königs von Babel. Statt ' +
          'der königlichen Speisen und des Weins baten sie um Gemüse und Wasser – zehn Tage ' +
          'lang als Test. Danach sahen sie gesünder aus als alle anderen, und Gott schenkte ' +
          'ihnen Wissen und Verstand.',
        deepening:
          'Daniel bleibt respektvoll: Er droht nicht und streitet nicht, sondern schlägt dem ' +
          'Aufseher einen fairen Test vor (Vers 12–13). Mutig sein heisst nicht, laut zu ' +
          'sein. Am Ende fand der König die vier «zehnmal» klüger als alle Gelehrten seines ' +
          'Reiches (Vers 20).\n\n' +
          'Zum Weiterlesen:\n' +
          'Daniel 1:8–20',
        source: verse('Daniel 1:8–17'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '☕',
        title: 'Was meinen die «heissen Getränke» in LuB 89:9?',
        quiz: choice(
          ['Kaffee und Tee', 'Alles über 60 Grad', 'Heisse Schokolade', 'Suppe'],
          0,
          'Kaffee und Tee (aus der Teepflanze) – so haben es die Propheten erklärt. Gemeint ' +
            'ist also nicht die Temperatur: Auch Eistee oder Eiskaffee gehören dazu, ' +
            'Kräutertee oder heisse Schokolade dagegen nicht.',
        ),
        source: source('Evangeliumsthemen: Wort der Weisheit', TOPIC_WORD_OF_WISDOM),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title:
          'Wie hilft dir das Wort der Weisheit im Alltag – beim Sport, in der Schule, im Kopf?',
        body: 'Ein konkretes Beispiel genügt. Die Antworten der anderen siehst du, sobald deine dasteht.',
      },
      {
        key: 'feed-4',
        kind: 'feed',
        emoji: '🔓',
        title: 'Freiheit statt Sucht',
        body:
          'Das Wort der Weisheit schützt dich vor Abhängigkeit. Wer süchtig wird, verliert ein ' +
          'Stück seiner Freiheit, selbst zu entscheiden – und Gott will, dass du frei ' +
          'bleibst. Darum gilt der Grundsatz auch für Dinge, die nicht in LuB 89 stehen: Meide ' +
          'alles, was deinem Körper oder Geist schadet oder abhängig macht.',
        deepening:
          'Auch Gewohnheiten können einen festhalten – endloses Scrollen oder Gamen bis tief in ' +
          'die Nacht. Im Oktoberheft steht ein Merksatz dazu: «Ich kann digitale Geräte ' +
          'zielgerichtet einsetzen. Sie haben keine Kontrolle über mich.» Wer hat bei dir das ' +
          'Steuer – du oder dein Handy?\n\n' +
          'Zum Weiterlesen:\n' +
          `Wegweiser «Für eine starke Jugend»: Dein Körper ist heilig – ${GUIDE_BODY}`,
        source: source('Evangeliumsthemen: Wort der Weisheit', TOPIC_WORD_OF_WISDOM),
      },
      {
        key: 'skala-2',
        kind: 'umfrage',
        emoji: '🛡️',
        title: 'Wie leicht fällt es dir, Nein zu sagen, wenn alle anderen Ja sagen?',
        poll: scale(
          [1, 10],
          ['sehr schwer', 'ganz leicht'],
          'Gruppendruck kennt jeder. Daniel hatte sich vorher entschieden (Daniel 1:8) – ' +
            'darum war er stark, als es drauf ankam. Ein Satz, den du dir jetzt zurechtlegst, ' +
            'hilft dir später: «Nein danke, ich lass das.»',
        ),
        source: verse('Daniel 1:8'),
      },
      {
        key: 'quiz-4',
        kind: 'quiz',
        emoji: '🌾',
        title: 'Welche Nahrung nennt der Herr in LuB 89 den «Stab des Lebens»?',
        quiz: choice(
          ['Getreide', 'Fleisch', 'Früchte', 'Milch'],
          0,
          'Getreide wie Weizen, Reis oder Hafer (LuB 89:14). Fleisch soll man sparsam essen ' +
            '(Vers 12), Kräuter und Früchte mit Dankbarkeit und Mass (Vers 10–11).',
        ),
        source: verse('Lehre und Bündnisse 89:14'),
      },
      {
        key: 'frage-2',
        kind: 'frage',
        emoji: '🎙️',
        title:
          'Konferenz-Echo: Welcher Satz von der Generalkonferenz ist bei dir hängen geblieben?',
        body:
          'Am letzten Wochenende war Generalkonferenz. Schreib den Satz auf, der dir geblieben ' +
          'ist – mit dem Namen des Sprechers, wenn du ihn weisst.',
        source: source('Generalkonferenz', CONFERENCE),
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🗣️',
        title:
          'Frag deine Eltern oder Grosseltern: Wann hat ihnen das Wort der Weisheit schon geholfen?',
        body:
          'Oder bereite für deine Familie einen gesunden Snack zu – wie beim Kochwettbewerb im ' +
          'Oktoberheft – und erzählt euch beim Essen von LuB 89:18–21. Danach hier abhaken.',
        source: verse('Lehre und Bündnisse 89:18–21'),
      },
    ],
  },

  /* ================================================================ */
  /* 12.–18. Oktober: Gesetz der Keuschheit                            */
  /* ================================================================ */
  {
    week: '2026-W42',
    theme: {
      kicker: 'Dein Körper ist heilig',
      emoji: '🛡️',
      title: 'Keuschheit: Stärke, die man nicht sieht',
      body:
        'Diese Woche geht es ums Gesetz der Keuschheit. Gott heisst eine sexuelle Beziehung nur ' +
        'zwischen einem Mann und einer Frau gut, die miteinander verheiratet sind. Dabei geht ' +
        'es um Vertrauen, Treue, Schöpfungskraft und Familie – und darum, in Gedanken, Worten, ' +
        'Taten und bei der Medienwahl rein zu bleiben.',
      deepening:
        'Keusch sein heisst auch, Pornografie zu meiden und Sex und sexuelle Gefühle als ' +
        'heilige Gabe Gottes zu behandeln. Und wer Fehler gemacht hat: Es gibt immer einen Weg ' +
        'zurück – durch Jesus Christus.\n\n' +
        'Zum Weiterlesen:\n' +
        `Wegweiser «Für eine starke Jugend»: Dein Körper ist heilig – ${GUIDE_BODY}\n` +
        `Evangeliumsthemen: Keuschheit – ${TOPIC_CHASTITY}`,
      source: source(
        'Für eine starke Jugend, Oktober 2026 – Dritter Sonntag',
        fsyLesson('03-third-sunday'),
      ),
      lesson: source('Erfahre mehr über das Gesetz der Keuschheit', fsyLesson('03-third-sunday')),
      crest: { symbol: 'schild', palette: 'saphir', motto: 'Rein und stark' },
    },
    goal: {
      emoji: '✍️',
      title: 'Schreib drei Wege auf, wie du deine Gedanken diese Woche schützt',
      body:
        'Zum Beispiel: weniger Zeit vor dem Bildschirm, erbauliche Musik auswählen, eine ' +
        'bestimmte Serie meiden. Und dann: durchziehen.',
      source: FSY_OCTOBER('Dritter Sonntag'),
    },
    challenge: {
      emoji: '🌙',
      title: 'Das Handy schläft draussen',
      body:
        'Jede Nacht bleibt das Handy ausserhalb deines Zimmers. Besser schlafen, weniger ' +
        'Versuchung, mehr Freiheit.',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '📱',
        title: 'Was macht es heute am schwierigsten, rein zu bleiben?',
        body: 'Anonym – gezeigt werden nur Zahlen.',
        poll: vote(
          [
            'Was auf Social Media aufpoppt',
            'Was Freunde lustig finden',
            'Langeweile und das Handy im Bett',
            'Musik, Filme und Games',
          ],
          'Du bist nicht allein – fast alle kämpfen mit etwas davon. Das Oktoberheft rät: ' +
            'Plane voraus. Wer vorher weiss, was er tut, wenn es heikel wird, ist stärker als ' +
            'jede Versuchung.',
        ),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🏃',
        title: 'Josef: Er lief einfach weg.',
        body:
          'Josef war ein junger Mann, als Sklave nach Ägypten verkauft – und die Frau seines ' +
          'Herrn bedrängte ihn Tag für Tag. Josef sagte Nein: Er wollte Gott und seinem Herrn ' +
          'treu sein. Als sie ihn packte, liess er sein Gewand zurück und floh.',
        deepening:
          'Josef hat nicht diskutiert und nicht ausgetestet, wie weit er gehen kann – er ist ' +
          'gegangen. Manchmal ist Weglaufen die mutigste Entscheidung. Josef kam dafür sogar ins ' +
          'Gefängnis; der Herr war trotzdem mit ihm (Genesis 39:21).\n\n' +
          'Zum Weiterlesen:\n' +
          'Genesis 39:7–12\n' +
          'Genesis 39:21',
        source: verse('Genesis 39:7–12'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '🧥',
        title: 'Was liess Josef zurück, als er floh?',
        quiz: choice(
          ['Sein Gewand', 'Seinen Ring', 'Seine Sandalen', 'Seinen Stab'],
          0,
          'Sein Gewand (Genesis 39:12). Die Frau benutzte es danach, um Josef zu verleumden – ' +
            'doch Josef hatte behalten, worauf es ankam: seine Treue.',
        ),
        source: verse('Genesis 39:12'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '🎮',
        title: 'Wer hat das Steuer – du oder dein Handy?',
        poll: scale(
          [1, 10],
          ['das Handy', 'ganz klar ich'],
          'Das Oktoberheft gibt drei Merksätze für digitale Medien. Ein Ziel: «Ich kann ' +
            'digitale Geräte zielgerichtet einsetzen. Sie haben keine Kontrolle über mich.» Ein ' +
            'Plan: «Wenn ich vorausplane, fühle ich mich besser und treffe sinnvollere ' +
            'Entscheidungen.» Eine Pause: «Es ist in Ordnung, innezuhalten und eine Pause ' +
            'einzulegen.»',
        ),
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '🌄',
        title: '«Wenn es etwas Tugendhaftes oder Liebenswertes gibt … so trachten wir danach.»',
        body:
          'Keusch sein beginnt im Kopf: Wer Gutes sucht, hat weniger Platz für Schlechtes. Was ' +
          'ist für dich tugendhaft und liebenswert – Musik, Sport, Freunde, Natur?',
        source: verse('13. Glaubensartikel'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title:
          'Fakt oder Mythos? «Wer das Gesetz der Keuschheit gebrochen hat, kann keine Vergebung mehr bekommen.»',
        quiz: factOrMyth(
          false,
          'Mythos – und eine Lüge des Satans. Es gibt immer einen Weg zurück: Dank dem ' +
            'Sühnopfer Jesu Christi können wir umkehren und Vergebung erlangen. Alma hat genau ' +
            'darüber mit seinem Sohn Korianton gesprochen (Alma 39–42).',
        ),
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '💬',
        title:
          'Was würdest du tun? Im Klassenchat postet jemand ein Video, das du nicht sehen willst.',
        poll: vote(
          [
            'Gar nicht öffnen und weiterscrollen',
            'Den Chat stummschalten oder verlassen',
            'Schreiben: «Hey, das muss nicht sein»',
            'Mit Eltern oder einem Leiter darüber reden',
          ],
          'Alles davon ist stark. Josef ist weggelaufen – wegklicken ist die digitale Version ' +
            'davon. Und es ist nie peinlich, mit jemandem zu reden, dem du vertraust. Das ' +
            'Oktoberheft fragt: Was könnt ihr tun, um euch und andere vor schädlichen Medien zu ' +
            'schützen?',
        ),
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Was ist dein Körper laut Paulus?',
        body: '1 Korinther 6:19 – bring die Wörter in die richtige Reihenfolge.',
        puzzle: puzzle(
          'euer / Leib / ist / ein / Tempel / des / Heiligen / Geistes',
          'Ein Tempel ist ein heiliger Ort, in dem Gottes Geist wohnen kann. Genau so dürfen ' +
            'wir unseren Körper sehen – und so mit ihm umgehen.',
        ),
        source: verse('1 Korinther 6:19'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🤝',
        title: 'Keusch sein heisst: Man kann dir vertrauen.',
        body:
          'Wer nach dem Gesetz der Keuschheit lebt, wird jemand, dem man vertrauen kann, der ' +
          'Selbstbeherrschung hat, Grenzen respektiert – und später eine Bündnisbeziehung ' +
          'aufbauen und pflegen kann.',
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '📜',
        title: 'Mit wem sprach Alma über das Gesetz der Keuschheit – und über den Weg zurück?',
        quiz: choice(
          [
            'Mit seinem Sohn Korianton',
            'Mit seinem Sohn Helaman',
            'Mit König Lamoni',
            'Mit Amulek',
          ],
          0,
          'Mit seinem Sohn Korianton, der auf seiner Mission schwere Fehler gemacht hatte. Alma ' +
            'war deutlich – und voller Hoffnung: Er lehrte ihn über Umkehr und das Sühnopfer ' +
            'Jesu Christi (Alma 39–42).',
        ),
        source: verse('Alma 39:1–15'),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💡',
        title: 'Was hilft dir – oder würde dir helfen –, deine Gedanken rein zu halten?',
        body: 'Tipps sind Gold wert; vielleicht hilft deiner einem anderen. Bitte keine Geschichten über andere.',
      },
      {
        key: 'feed-4',
        kind: 'feed',
        emoji: '❤️',
        title:
          '«Die Liebe Christi und sein Sühnopfer sind grösser als alle Fehler, die wir begehen könnten.»',
        body:
          'Der Satan will dir einreden, du seist nicht mehr gut genug. Das stimmt nicht. Es ' +
          'gibt immer einen Weg zurück – und Menschen, die dir dabei helfen: deine Eltern, dein ' +
          'Bischof.',
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🏠',
        title: 'Macht zu Hause einen Medien-Plan',
        body:
          'Ein Ziel, ein Plan, eine Pause: Redet darüber, wann bei euch Handys Pause haben – ' +
          'zum Beispiel beim Essen oder nachts ausserhalb der Zimmer. Danach hier abhaken.',
        source: FSY_OCTOBER('Dritter Sonntag'),
      },
    ],
  },

  /* ================================================================ */
  /* 19.–25. Oktober: Ein Sohn Gottes werden – Helamans junge Krieger  */
  /* ================================================================ */
  {
    week: '2026-W43',
    theme: {
      kicker: 'Dein Körper ist heilig · Kollegium',
      emoji: '⚔️',
      title: 'Treu zu allen Zeiten',
      body:
        'Diese Woche geht es um Helamans junge Krieger. Sie waren mutig, ' +
        'stark und regsam – aber das war nicht alles: Sie waren treu, «zu allen Zeiten und in ' +
        'allem, was ihnen anvertraut war» (Alma 53:20). Was hat sie so gemacht? Swipe dich ' +
        'durch ihre Geschichte.',
      deepening:
        'Das Kollegium beginnt mit einem Satz, den du dir merken kannst: «Ich bin ein ' +
        'geliebter Sohn Gottes und er hat eine Arbeit für mich.»\n\n' +
        'Zum Weiterlesen:\n' +
        'Alma 53:14–22\n' +
        'Alma 56:44–57',
      source: verse('Alma 53:20'),
      lesson: source('Ein Sohn Gottes werden, der seine Bündnisse hält', FSY_ISSUE),
      crest: { symbol: 'schwert', palette: 'feuer', motto: 'Treu zu allen Zeiten' },
    },
    goal: {
      emoji: '📖',
      title: 'Lies Alma 56:44–57 – die Schlacht der jungen Krieger',
      body: 'Vierzehn Verse voller Action. Achte darauf, was ihnen half, treu zu bleiben.',
      source: verse('Alma 56:44–57'),
    },
    challenge: {
      emoji: '✅',
      title: 'Jeden Tag eine Aufgabe erledigen, ohne dass dich jemand erinnert',
      body:
        'Zu Hause, in der Schule oder im Kollegium: «in allem, was ihnen anvertraut war». ' +
        'Abhaken, wenn erledigt.',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '💪',
        title: 'Welche Eigenschaft der jungen Krieger hättest du gern mehr?',
        poll: vote(
          ['Mut', 'Stärke', 'Regsamkeit – anpacken statt warten', 'Treue zu allen Zeiten'],
          'Alma 53:20 nennt alle vier. Mut und Stärke sind stark – aber das Entscheidende war, ' +
            'dass sie «zu allen Zeiten» treu waren. Treue ist eine Entscheidung, die man jeden ' +
            'Tag neu trifft.',
        ),
        source: verse('Alma 53:20'),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🗡️',
        title: 'Wusstest du? Ihre Väter hatten die Schwerter vergraben.',
        body:
          'Die Eltern der jungen Krieger hatten Gott versprochen, nie wieder zu kämpfen, und ' +
          'ihre Waffen tief in der Erde vergraben (Alma 24). Als die Nephiten in Not waren, ' +
          'hielten sie dieses Versprechen. An ihrer Stelle zogen die Söhne los – und schlossen ' +
          'selbst einen Bund: für die Freiheit einzustehen (Alma 53:16–17).',
        deepening:
          'Bündnisse ziehen sich durch die ganze Geschichte: Die Eltern hielten ihren Bund, die ' +
          'Söhne schlossen ihren eigenen. Auch du hast schon einen Bund geschlossen – bei ' +
          'deiner Taufe – und erneuerst ihn jeden Sonntag beim Abendmahl.\n\n' +
          'Zum Weiterlesen:\n' +
          'Alma 24:17–18\n' +
          'Alma 53:13–17\n' +
          'Mosia 18:8–10',
        source: verse('Alma 53:16–17'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '🔢',
        title: 'Wie viele junge Männer zogen anfangs mit Helaman los?',
        quiz: choice(
          ['200', '2000', '20 000', '60'],
          1,
          'Zweitausend (Alma 53:22). Später kamen noch sechzig dazu – 2060 insgesamt ' +
            '(Alma 57:6).',
        ),
        source: verse('Alma 53:22'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '🙏',
        title:
          'An wie vielen Tagen hast du letzte Woche richtig gebetet – nicht nur kurz vor dem Essen?',
        poll: scale(
          [0, 7],
          ['an keinem', 'an jedem'],
          'Die jungen Krieger wurden durch Glauben stark – und Glaube wächst durch Beten. Kein ' +
            'Vergleich, keine Wertung: Das Kollegium sieht nur den Schnitt. Vielleicht wird es ' +
            'diese Woche ein Tag mehr.',
          'Tage',
        ),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '👩‍👦',
        title: 'Von wem hatten die jungen Krieger gelernt, dass Gott sie bewahren würde?',
        quiz: choice(
          ['Von ihren Müttern', 'Von Hauptmann Moroni', 'Aus einem Traum', 'Von ihren Feinden'],
          0,
          'Ihre Mütter hatten sie gelehrt: Wenn sie nicht zweifeln, wird Gott sie befreien – ' +
            'und sie zweifelten nicht daran, dass ihre Mütter es wussten (Alma 56:47–48). ' +
            'Glaube, den man zu Hause lernt, trägt bis aufs Schlachtfeld.',
        ),
        source: verse('Alma 56:47–48'),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '👑',
        title: '«Ich bin ein geliebter Sohn Gottes und er hat eine Arbeit für mich.»',
        body:
          'So beginnt das Kollegium. Und Elder Ulisses Soares schreibt im Oktoberheft: «Gott ' +
          'kennt uns und weiss, wie er uns in jedem Augenblick unseres Lebens am besten helfen ' +
          'kann.»',
        source: FSY_OCTOBER('Letzter Sonntag und Botschaft von Elder Soares'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '🧐',
        title:
          'Fakt oder Mythos? «Die jungen Krieger überstanden ihre Schlachten ohne einen Kratzer.»',
        quiz: factOrMyth(
          false,
          'Mythos. Nach einer harten Schlacht hatte jeder einzelne Wunden – aber keiner war ' +
            'gefallen (Alma 57:25). Gott sucht keine perfekten jungen Männer, sondern treue: ' +
            'dranbleiben, umkehren, wieder aufstehen.',
        ),
        source: verse('Alma 57:25'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '🌙',
        title:
          'Was würdest du tun? Morgen teilst du das Abendmahl aus – deine Freunde wollen bis 2 Uhr raus.',
        poll: vote(
          [
            'Früh nach Hause – der Sonntag geht vor',
            'Mitgehen, aber um Mitternacht heim',
            'Die Freunde zu etwas anderem einladen',
            'Ehrlich sagen, warum ich nicht kann',
          ],
          'Spannend, was die anderen wählen. Die jungen Krieger waren «in allem, was ihnen ' +
            'anvertraut war» treu (Alma 53:20) – und das Abendmahl auszuteilen ist dir ' +
            'anvertraut. Wer den Abend vorher plant, ist am Morgen bereit.',
        ),
        source: verse('Alma 53:20'),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Was zeichnete die jungen Krieger aus?',
        body: 'Alma 53:20 – bring die Wörter in die richtige Reihenfolge.',
        puzzle: puzzle(
          'zu / allen / Zeiten / und / in / allem, / was / ihnen / anvertraut / war, / treu',
          'Treue «zu allen Zeiten» – auch wenn niemand zuschaut. Genau diese Stärke trainiert ' +
            'man im Kollegium.',
        ),
        source: verse('Alma 53:20'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🩹',
        title: 'Alle verwundet – keiner gefallen.',
        body:
          'Nach der Schlacht bei Kumeni zählte Helaman seine jungen Männer: Jeder einzelne ' +
          'hatte Wunden, aber kein einziger war gestorben (Alma 57:25). Sie hatten jeden Befehl ' +
          'genau befolgt, und ihr Glaube hatte sie getragen (Alma 57:21, 26).',
        deepening:
          'Helaman schreibt, dass sie jedes Wort genau ausführten – nicht ungefähr, sondern ' +
          'genau. Wo würde sich diese Genauigkeit in deinem Alltag lohnen?\n\n' +
          'Zum Weiterlesen:\n' +
          'Alma 57:19–27',
        source: verse('Alma 57:25'),
      },
      {
        key: 'quiz-4',
        kind: 'quiz',
        emoji: '🔎',
        title:
          'Schlag Alma 53:20 auf: Welche drei Eigenschaften machten die jungen Krieger «überaus tapfer»?',
        quiz: search(
          'Mut, Stärke und Regsamkeit',
          'Mut, Stärke und Regsamkeit – «aber siehe, dies war nicht alles»: Dazu kam ihre ' +
            'Treue zu allen Zeiten.',
        ),
        source: verse('Alma 53:20'),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title:
          'Was hast du diesen Monat gelernt: Wie hilft dir der Erretter, deinen Körper heiligzuhalten?',
        body:
          'Ein Gedanke, ein Erlebnis oder ein Vers genügt – was dir diesen Monat wichtig ' +
          'geworden ist.',
        source: FSY_OCTOBER('Letzter Sonntag'),
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🗣️',
        title:
          'Frag deinen Vater, Grossvater oder einen Leiter: Was heisst für ihn, «zu allen Zeiten treu» zu sein?',
        body: 'Gute Gespräche beginnen mit guten Fragen. Danach hier abhaken.',
        source: verse('Alma 53:20'),
      },
    ],
  },

  /* ================================================================ */
  /* 26. Oktober – 1. November: Die Wahrheit befreit dich (Fastsonntag) */
  /* ================================================================ */
  {
    week: '2026-W44',
    theme: {
      kicker: 'Neues Monatsthema · Fastsonntag',
      emoji: '🗝️',
      title: 'Die Wahrheit befreit dich',
      body:
        'Im November geht es um Wahrheit: Woher kommt sie, wie erkennst du sie – und warum ' +
        'macht sie frei? Diese Woche geht es um das Kapitel aus dem Wegweiser ' +
        '«Für eine starke Jugend». Der Kern: Der Vater im Himmel ist ein Gott der Wahrheit. ' +
        'Alle Wahrheit kommt von ihm und führt zu ihm.',
      deepening:
        'Jesus sagte: «Die Wahrheit wird euch befreien» (Johannes 8:32). Der Wegweiser nennt ' +
        'Wege, wie du zeigst, dass dir Wahrheit wichtig ist: indem du lernst, ehrlich lebst und ' +
        'mutig für das Richtige einstehst – wenn es sein muss, auch allein.\n\n' +
        'Zum Weiterlesen:\n' +
        `Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich – ${GUIDE_TRUTH}\n` +
        'Johannes 8:31–32',
      source: source('Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich', GUIDE_TRUTH),
      lesson: source('Befasse dich mit dem Kapitel aus dem Wegweiser', GUIDE_TRUTH),
      crest: { symbol: 'schluessel', palette: 'amethyst', motto: 'Die Wahrheit befreit' },
    },
    goal: {
      emoji: '📘',
      title: 'Lies im Wegweiser das Kapitel «Die Wahrheit befreit dich»',
      body:
        'Es sind nur wenige Seiten. Such dir eine ewige Wahrheit aus, die dir besonders ' +
        'wichtig ist.',
      source: source('Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich', GUIDE_TRUTH),
    },
    challenge: {
      emoji: '🤞',
      title: 'Sieben Tage ohne Notlüge',
      body:
        'Auch nicht die kleinen: «Bin gleich da», «Hab’s nicht gesehen». Abhaken, wenn du es ' +
        'geschafft hast.',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '🔎',
        title: 'Wo suchst du zuerst, wenn du eine Frage hast?',
        poll: vote(
          [
            'Google oder KI',
            'Freunde oder Social Media',
            'Eltern oder Leiter',
            'Gebet und heilige Schriften',
          ],
          'Alles kann helfen – aber nicht alles ist gleich verlässlich. Fragen können zu ' +
            'inspirierten Antworten führen, besonders wenn wir in verlässlichen Quellen suchen ' +
            'und Glauben an Jesus Christus ausüben.',
        ),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🕊️',
        title: '«Die Wahrheit wird euch befreien.»',
        body:
          'Jesus sagte das zu Menschen, die an ihn glaubten (Johannes 8:31–32). Wahrheit ist ' +
          'mehr als ein Fakt im Kopf – sie verändert, wie frei du lebst: ohne Lügen, die du dir ' +
          'merken musst, ohne Angst, erwischt zu werden.',
        source: verse('Johannes 8:32'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '📐',
        title: 'Wie beschreibt der Herr Wahrheit in Lehre und Bündnisse 93:24?',
        quiz: choice(
          [
            'Kenntnis von etwas, wie es ist, wie es war und wie es kommen wird',
            'Das, was die meisten Menschen glauben',
            'Was sich gerade gut anfühlt',
            'Was am häufigsten geteilt wird',
          ],
          0,
          'Wahrheit hängt nicht von Meinungen oder Likes ab. Sie ist, wie die Dinge wirklich ' +
            'sind – und Gott kennt sie ganz.',
        ),
        source: verse('Lehre und Bündnisse 93:24'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '⚖️',
        title: 'Wie ehrlich bist du – auch wenn es dich etwas kostet?',
        poll: scale(
          [1, 10],
          ['fällt mir schwer', 'immer, egal was'],
          'Der Wegweiser verspricht: Ehrlichkeit bringt Frieden und Selbstachtung. Wenn deine ' +
            'Worte und Taten zur Wahrheit passen, können dir andere vertrauen – und der Herr ' +
            'auch.',
        ),
        source: source(
          'Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich',
          GUIDE_TRUTH,
        ),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '🚀',
        title: 'Vom Klassenzimmer bis zum Mars-Rover',
        body:
          'Schwester Michelle Amos hat 30 Jahre bei der NASA gearbeitet – unter anderem daran, ' +
          'den Mars-Rover Perseverance auf seinen Flug vorzubereiten. Ihr Rat: Lern so viel wie ' +
          'möglich, gib in der Schule dein Bestes und ergreif die Chancen, die sich dir bieten. ' +
          'Bildung öffnet Türen, von denen du noch nichts ahnst.',
        deepening:
          'Vier Fragen von Schwester Amos, um herauszufinden, was zu dir passt:\n' +
          '• Wofür machen mir andere Komplimente?\n' +
          '• Wobei bitten mich andere um Hilfe?\n' +
          '• Was mache ich gern in meiner Freizeit?\n' +
          '• Welche Probleme löse ich gern?\n\n' +
          'Und Elder Amos erinnert an den Rat des Herrn: «Blickt in jedem Gedanken auf mich; ' +
          'zweifelt nicht, fürchtet euch nicht.»\n' +
          'Lehre und Bündnisse 6:36',
        source: FSY_OCTOBER('«Entdecke, was in dir steckt»'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title: 'Fakt oder Mythos? «Glaube und Lernen schliessen sich aus.»',
        quiz: factOrMyth(
          false,
          'Mythos. Alle Wahrheit kommt von Gott – auch die, die man in der Schule oder im ' +
            'Labor entdeckt. Der Wegweiser ermutigt dich ausdrücklich zu lernen: Bildung hilft ' +
            'dir, anderen zu dienen und Gutes zu bewirken.',
        ),
        source: source(
          'Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich',
          GUIDE_TRUTH,
        ),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '📝',
        title: 'Was würdest du tun? In der Prüfung schiebt dir dein Kollege seine Antworten hin.',
        poll: vote(
          [
            'Nicht hinschauen – meine Leistung zählt',
            'Kurz schauen, ist ja nur einmal',
            'Danach mit ihm reden',
            'Die Lehrperson ehrlich informieren',
          ],
          'Ehrlich sein ist manchmal unbequem. Aber wenn deine Worte und Taten zur Wahrheit ' +
            'passen, hast du Frieden und Selbstachtung – und andere können dir vertrauen. Das ' +
            'ist mehr wert als eine Note.',
        ),
        source: source(
          'Wegweiser «Für eine starke Jugend»: Die Wahrheit befreit dich',
          GUIDE_TRUTH,
        ),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Was ist Wahrheit?',
        body: 'Lehre und Bündnisse 93:24 – setz die Teile richtig zusammen.',
        puzzle: puzzle(
          'Wahrheit / ist Kenntnis / von etwas, / wie es ist / und wie es war / und wie es kommen wird',
          'Wahrheit gilt gestern, heute und morgen. Darum kann man sein Leben darauf bauen.',
        ),
        source: verse('Lehre und Bündnisse 93:24'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🍽️',
        title: 'Fastsonntag: Warum eigentlich fasten?',
        body:
          'Am Fastsonntag verzichten wir – wer gesund ist – zwei Mahlzeiten lang auf Essen und ' +
          'Trinken, beten mit einem Anliegen und spenden das Geld, das wir dabei sparen, als ' +
          'Fastopfer für Menschen in Not. Fasten macht stark: Der Geist übernimmt das Steuer, ' +
          'nicht der Magen.',
        deepening:
          'Jesaja 58 beschreibt das Fasten, das Gott gefällt: Hungrigen Brot geben und ' +
          'Unterdrückte befreien – Fasten mit offenem Herzen. Überleg dir ein konkretes ' +
          'Anliegen, für das du fasten möchtest.\n\n' +
          'Zum Weiterlesen:\n' +
          'Jesaja 58:6–11',
        source: source('Evangeliumsthemen: Fasten und Fastopfer', TOPIC_FASTING),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '🎁',
        title: 'Was macht die Kirche mit dem Fastopfer?',
        quiz: choice(
          [
            'Sie hilft damit Menschen in Not',
            'Sie bezahlt damit die Bischöfe',
            'Sie baut damit Gemeindehäuser',
            'Sie spart es für später',
          ],
          0,
          'Das Fastopfer hilft Bedürftigen – oft ganz in der Nähe, über den Bischof. Bischöfe ' +
            'und andere Führer der Gemeinde bekommen für ihre Berufung übrigens keinen Lohn.',
        ),
        source: source('Evangeliumsthemen: Fasten und Fastopfer', TOPIC_FASTING),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title: 'Welche ewige Wahrheit gibt dir Halt – und warum?',
        body:
          'Eine Wahrheit, an der du dich festhalten kannst – und ein, zwei Sätze dazu, ' + 'warum.',
        source: source('Für eine starke Jugend, Oktober 2026 – Fastsonntag im November', FSY_ISSUE),
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🗣️',
        title:
          'Erzähl jemandem, wann Ehrlichkeit dich etwas gekostet hat – und sich trotzdem gelohnt hat',
        body: 'Oder frag jemanden aus deiner Familie nach so einem Erlebnis. Danach hier abhaken.',
      },
    ],
  },

  /* ================================================================ */
  /* 2.–8. November: Schriftstudium                                    */
  /* ================================================================ */
  {
    week: '2026-W45',
    theme: {
      kicker: 'Die Wahrheit befreit dich',
      emoji: '📖',
      title: 'Die heiligen Schriften: Freunde, die immer da sind',
      body:
        'Diese Woche geht es ums Schriftstudium. Die heiligen Schriften haben geistige Macht: ' +
        'Sie geben Zeugnis für Jesus Christus, schenken Hoffnung und weisen den Weg zum Vater ' +
        'im Himmel. Diese Woche probierst du aus, wie Schriftstudium richtig Spass macht.',
      deepening:
        'Elder Gérald Caussé: «Das Evangelium ist eine Quelle des Wissens, die niemals ' +
        'austrocknet. … In jedem Vers heiliger Schrift gibt es etwas Neues, was wir lernen und ' +
        'spüren können.»\n\n' +
        'Zum Weiterlesen:\n' +
        '1 Nephi 6:4–6\n' +
        '2 Nephi 32:3',
      source: FSY_OCTOBER('Zweiter Sonntag im November'),
      lesson: source('Erfahre mehr über das Schriftstudium', FSY_ISSUE),
      crest: { symbol: 'buch', palette: 'gold', motto: 'Weidet euch am Wort' },
    },
    goal: {
      emoji: '🌳',
      title: 'Lies 1 Nephi 8 – Lehis Traum',
      body:
        'Achte darauf, wie die verschiedenen Menschen mit der eisernen Stange umgehen. Zu ' +
        'welcher Gruppe willst du gehören?',
      source: verse('1 Nephi 8'),
    },
    challenge: {
      emoji: '⏱️',
      title: 'Jeden Tag 5 Minuten Schriften – vor dem ersten Video',
      body: 'Erst das Wort, dann der Feed. Abhaken, wenn erledigt.',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '⏰',
        title: 'Wann liest du am ehesten in den Schriften?',
        poll: vote(
          ['Am Morgen', 'Am Abend im Bett', 'Unterwegs mit der App', 'Ehrlich gesagt: selten'],
          'Kein Richtig oder Falsch – aber eine feste Zeit hilft. Joshua (19) aus Utah ' +
            'beginnt mit einem Gebet; dann macht ihn der Geist oft auf die Antworten ' +
            'aufmerksam, nach denen er sucht.',
        ),
        source: FSY_OCTOBER('Fragen und Antworten'),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🖍️',
        title:
          'Isabella (16), Madrid: «Ich gestalte das Schriftstudium so, dass es mir Spass macht.»',
        body:
          'Sie arbeitet mit Haftnotizen und bunten Stiften – jede Farbe steht für ein ' +
          'Evangeliumsthema – und markiert alles, was ihr auffällt, zum Beispiel Eigenschaften ' +
          'oder Namen Jesu Christi.',
        source: FSY_OCTOBER('Fragen und Antworten'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '🛤️',
        title: 'Was stellt in Lehis Traum die eiserne Stange dar?',
        quiz: choice(
          ['Das Wort Gottes', 'Die Kirche', 'Den Tempel', 'Die Familie'],
          0,
          'Das Wort Gottes (1 Nephi 11:25). Wer sich daran festhielt, kam durch den finsteren ' +
            'Nebel bis zum Baum des Lebens (1 Nephi 8:24, 30).',
        ),
        source: verse('1 Nephi 11:25'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '📊',
        title: 'An wie vielen Tagen hast du letzte Woche in den Schriften gelesen?',
        poll: scale(
          [0, 7],
          ['an keinem', 'an jedem'],
          'Kein Vergleich – nur ein Blick, wo das Kollegium steht. Schon fünf Minuten am Tag ' +
            'machen einen Unterschied; die Tages-Challenge dieser Woche hilft dir dabei.',
          'Tage',
        ),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '🔦',
        title: 'Ein Licht für deinen Weg',
        body:
          'Psalm 119:105 vergleicht Gottes Wort mit einer Leuchte für die Füsse – wie eine ' +
          'Taschenlampe in der Nacht. Sie zeigt nicht die ganze Strecke, aber genug für den ' +
          'nächsten Schritt.',
        source: verse('Psalm 119:105'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title:
          'Fakt oder Mythos? «Die Schriften sind alte Geschichten ohne Bezug zu meinem Leben.»',
        quiz: factOrMyth(
          false,
          'Mythos. Nephi schrieb ausdrücklich für die Menschen nach ihm (1 Nephi 6:4–6) – ' +
            'also auch für dich. Und Elder Caussé sagt: In jedem Vers gibt es etwas Neues zu ' +
            'lernen und zu spüren.',
        ),
        source: verse('1 Nephi 6:4–6'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '📱',
        title: 'Was würdest du tun? Fünf Minuten vor dem Schlafen – Schriften oder noch ein Video?',
        poll: vote(
          [
            'Schriften – dann Licht aus',
            'Erst das Video, dann die Schriften',
            'Ein Kapitel in der App, im Bett',
            'Dafür morgen früher aufstehen',
          ],
          'Ehrlich ist besser als perfekt. Reyl (18) stellt sich beim Lesen vor, selbst dabei ' +
            'zu sein – das macht schon fünf Minuten lebendig. Und wer zuerst ein Video schaut, ' +
            'weiss: Aus einem werden schnell fünf.',
        ),
        source: FSY_OCTOBER('Fragen und Antworten'),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Was versprechen die Worte von Christus?',
        body: '2 Nephi 32:3 – setz die Teile richtig zusammen.',
        puzzle: puzzle(
          'die Worte / von Christus / werden euch / alles sagen, / was ihr / tun sollt',
          'Wer sich an den Worten von Christus «weidet» – sich also richtig satt liest –, ' +
            'findet Antworten fürs eigene Leben.',
        ),
        source: verse('2 Nephi 32:3'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '🔎',
        title: 'Schlag Josua 1:8 auf: Wann soll man über das Buch der Weisung nachsinnen?',
        quiz: search(
          'Tag und Nacht',
          'Tag und Nacht – also immer wieder, nicht nur einmal. Dann, so verspricht der Herr ' +
            'Josua, wird sein Weg gelingen.',
        ),
        source: verse('Josua 1:8'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🧠',
        title: 'Lesen. Nachdenken. Anwenden.',
        body:
          'Liriel (13) aus Brasilien: «Du kannst gebeterfüllt studieren, über das Gelesene ' +
          'nachdenken und überlegen, wie du das Gelernte anwenden kannst. Der Heilige Geist wird ' +
          'dir bezeugen, dass die Worte in den Schriften wahr sind.»',
        source: FSY_OCTOBER('Fragen und Antworten'),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title: 'Welche Schriftstelle hat dir geholfen, Jesus Christus näherzukommen?',
        body: 'Mit Stellenangabe – vielleicht wird sie zur Lieblingsstelle von jemand anderem.',
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '👨‍👩‍👦',
        title: 'Lest zu Hause ein Kapitel – und jeder nennt einen Vers, der ihm auffällt',
        body: 'Zehn Minuten genügen. Danach hier abhaken.',
      },
    ],
  },

  /* ================================================================ */
  /* 9.–15. November: Die Suche nach Wahrheit                          */
  /* ================================================================ */
  {
    week: '2026-W46',
    theme: {
      kicker: 'Die Wahrheit befreit dich',
      emoji: '🧭',
      title: 'Auf der Suche nach Wahrheit',
      body:
        'Diese Woche geht es darum, wie man Wahrheit findet. Die Quelle ewiger Wahrheit ist Gott ' +
        'selbst. Wenn du dich an verlässliche Quellen hältst und auf den Geist vertraust, kannst ' +
        'du erkennen, was wahr ist, was wichtig ist und was dich zu Gott zurückführt.',
      deepening:
        'Fragen sind nichts Schlechtes – sie können zu inspirierten Antworten führen. Joseph ' +
        'Smith war als junger Mann verwirrt, las Jakobus 1:5 und ging beten. Daraus wurde die ' +
        'erste Vision.\n\n' +
        'Zum Weiterlesen:\n' +
        'Joseph Smith – Lebensgeschichte 1:10–13\n' +
        'Jakobus 1:5',
      source: FSY_OCTOBER('Dritter Sonntag im November'),
      lesson: source('Erfahre mehr über die Suche nach Wahrheit', FSY_ISSUE),
      crest: { symbol: 'kompass', palette: 'ozean', motto: 'Zeile um Zeile' },
    },
    goal: {
      emoji: '🌲',
      title: 'Lies Joseph Smith – Lebensgeschichte 1:5–20',
      body: 'Die Geschichte eines Teenagers mit einer Frage – und der Antwort, die alles verändert hat.',
      source: verse('Joseph Smith – Lebensgeschichte 1:5–20'),
    },
    challenge: {
      emoji: '🤫',
      title: 'Jeden Tag beten – und danach eine Minute zuhören',
      body: 'Eine Minute still sein nach dem Amen. Was kommt dir in den Sinn?',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '❓',
        title: 'Woran merkst du am ehesten, dass etwas wahr ist?',
        poll: vote(
          [
            'Es fühlt sich friedlich und richtig an',
            'Es ergibt im Kopf Sinn',
            'Verlässliche Menschen bestätigen es',
            'Es hält, wenn ich es ausprobiere',
          ],
          'Gott spricht zu Verstand und Herz (LuB 8:2). Oft wirkt alles zusammen: nachdenken, ' +
            'ausprobieren, beten – und der Friede, den der Heilige Geist schenkt.',
        ),
        source: verse('Lehre und Bündnisse 8:2'),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🌲',
        title: 'Joseph Smith, 14: Ein Vers, der alles verändert hat',
        body:
          'Joseph war verwirrt: Jede Kirche behauptete etwas anderes. Dann las er Jakobus 1:5 – ' +
          'wem es an Weisheit fehlt, der soll Gott bitten. Nie, schrieb er später, sei eine ' +
          'Schriftstelle mit mehr Macht in sein Herz gedrungen. Also ging er in den Wald, um zu ' +
          'beten.',
        source: verse('Joseph Smith – Lebensgeschichte 1:11–12'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '📖',
        title: 'Welchen Vers las Joseph Smith, bevor er in den Wald ging, um zu beten?',
        quiz: choice(
          ['Jakobus 1:5', 'Johannes 3:16', 'Matthäus 7:7', 'Moroni 10:4'],
          0,
          'Jakobus 1:5 (Joseph Smith – Lebensgeschichte 1:11). Moroni 10:4 klingt ähnlich – ' +
            'aber das Buch Mormon kam erst Jahre später ans Licht.',
        ),
        source: verse('Joseph Smith – Lebensgeschichte 1:11'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '🧱',
        title: 'Wie sicher bist du dir gerade in deinem Glauben?',
        poll: scale(
          [1, 10],
          ['noch auf der Suche', 'felsenfest'],
          'Egal, wo du stehst: Zeugnis wächst «Zeile um Zeile» (2 Nephi 28:30). Niemand ' +
            'bekommt alles auf einmal – auch nicht die, die felsenfest wirken.',
        ),
        source: verse('2 Nephi 28:30'),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '📡',
        title: '7 Tipps, wenn die Leitung zur Offenbarung verstopft scheint',
        body:
          'Einen ruhigen Ort suchen. Bitten, suchen, anklopfen. Ein Gespür für Heiliges ' +
          'entwickeln. Zuhören. Geduld haben. Den Sinn mit Gottes Wort füllen. Handeln.',
        deepening:
          '«Geistiges lässt sich nicht erzwingen» (Elder Gary E. Stevenson). Und Elder Dale G. ' +
          'Renlund erinnert: Weisung von Gott kommt oft stückweise, nicht alles auf einmal.\n\n' +
          'Zum Weiterlesen:\n' +
          'Lehre und Bündnisse 101:16\n' +
          'Matthäus 7:7',
        source: FSY_OCTOBER('«7 Tipps, wie vermehrt Offenbarung fliessen kann»'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title: 'Fakt oder Mythos? «Wer Fragen hat, hat keinen Glauben.»',
        quiz: factOrMyth(
          false,
          'Mythos. Fragen können zu inspirierten Antworten führen – besonders, wenn wir in ' +
            'verlässlichen Quellen suchen und Glauben an Jesus Christus ausüben. Joseph Smiths ' +
            'Frage führte zur ersten Vision.',
        ),
        source: FSY_OCTOBER('Dritter Sonntag im November'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '📺',
        title: 'Was würdest du tun? Ein Video behauptet etwas Krasses über die Kirche.',
        poll: vote(
          [
            'Ignorieren und weiterscrollen',
            'Selbst nachforschen – in verlässlichen Quellen',
            'Eltern oder einen Leiter fragen',
            'Darüber beten',
          ],
          'Nicht alles, was überzeugend klingt, ist wahr. Das Oktoberheft fragt: Wie können wir ' +
            'zwischen Wahrheit und Irrtum unterscheiden, wenn beides überzeugend klingt? ' +
            'Verlässliche Quellen, ehrliche Fragen und der Heilige Geist helfen dabei.',
        ),
        source: FSY_OCTOBER('Anregung für eine Jugendaktivität im November'),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Wie gibt Gott Wahrheit?',
        body: '2 Nephi 28:30 – Wort für Wort.',
        puzzle: puzzle(
          'Zeile / um / Zeile, / Weisung / um / Weisung, / hier / ein / wenig / und / dort / ein / wenig',
          'So wächst Erkenntnis: Stück für Stück. Und wer annimmt, was er bekommt, dem wird ' +
            'mehr gegeben (2 Nephi 28:30).',
        ),
        source: verse('2 Nephi 28:30'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🏊',
        title: 'Eine Eingebung im Schwimmbad',
        body:
          'James (19) arbeitete als Rettungsschwimmer, als ihm zweimal der Gedanke kam, nach ' +
          'einer Frau am Beckenrand zu sehen. Er zögerte – und meldete es dann doch. Die Frau ' +
          'war Diabetikerin und wurde ohnmächtig; am Ende ging es ihr wieder gut. Sein Fazit: ' +
          'Hör auf die sanfte, leise Stimme.',
        deepening:
          'Was James gelernt hat:\n' +
          '• Hör auf, an dir zu zweifeln.\n' +
          '• Hör auf die sanfte, leise Stimme.\n' +
          '• Der Vater im Himmel glaubt an dich, auch wenn du es selbst nicht tust.\n' +
          '• Lerne aus deinen Fehlern.',
        source: FSY_OCTOBER('Stimmen von Jugendlichen'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '✨',
        title: 'Was nennt Gott in Mose 1:39 sein Werk und seine Herrlichkeit?',
        quiz: choice(
          [
            'Die Unsterblichkeit und das ewige Leben des Menschen zustande zu bringen',
            'Die Welt zu erschaffen',
            'Die Sterne zu zählen',
            'Tempel zu bauen',
          ],
          0,
          'Du bist Gottes Werk. Alles, was er tut, dient dazu, dass du ewig bei ihm leben ' +
            'kannst.',
        ),
        source: verse('Mose 1:39'),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title: 'Wie hast du schon einmal eine Antwort von Gott bekommen?',
        body: 'Gross oder klein – manchmal kommt sie Zeile um Zeile. Teile, was du teilen magst.',
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🎲',
        title: 'Spielt zu Hause «Drei Wahrheiten, eine Lüge»',
        body:
          'Jeder sagt vier Dinge über sich – drei stimmen, eins nicht. Danach: Wie erkennt man ' +
          'im echten Leben, was wahr ist? Abhaken, wenn ihr gespielt habt.',
        source: FSY_OCTOBER('Anregung für eine Jugendaktivität im November'),
      },
    ],
  },

  /* ================================================================ */
  /* 16.–22. November: Hauptmann Moroni – das Banner der Freiheit      */
  /* ================================================================ */
  {
    week: '2026-W47',
    theme: {
      kicker: 'Die Wahrheit befreit dich · Kollegium',
      emoji: '🚩',
      title: 'Hauptmann Moroni: Steh auf und heb dein Banner',
      body:
        'Diese Woche geht es um Hauptmann Moroni. Er sah die Probleme um sich ' +
        'herum und beschloss, etwas dagegen zu tun: Er riss seinen Mantel entzwei und schrieb ' +
        'darauf, wofür es sich zu kämpfen lohnt. Was stünde auf deinem Banner?',
      deepening:
        'Der Satz des Kollegiums für November: «Ich bin ein geliebter Sohn Gottes und er hat ' +
        'eine Arbeit für mich. Ich strebe nach Wahrheit … und lerne durch die Macht des Heiligen ' +
        'Geistes. Ich gebe das Gelernte mutig weiter.»\n\n' +
        'Zum Weiterlesen:\n' +
        'Alma 46:11–20\n' +
        'Alma 48:11–17',
      source: verse('Alma 46:12–13'),
      lesson: source('Ein Sohn Gottes werden, der seine Bündnisse hält', FSY_ISSUE),
      crest: { symbol: 'banner', palette: 'rubin', motto: 'Banner der Freiheit' },
    },
    goal: {
      emoji: '📖',
      title: 'Lies Alma 46:11–21',
      body: 'Wie würdest du Moronis Handeln in einem Satz zusammenfassen? Schreib ihn dir auf.',
      source: verse('Alma 46:11–21'),
    },
    challenge: {
      emoji: '🦸',
      title: 'Jeden Tag eine mutige gute Tat',
      body: 'Jemanden einladen, für jemanden einstehen, eine Wahrheit freundlich sagen. Abhaken, wenn erledigt.',
    },
    deck: [
      {
        key: 'umfrage-1',
        kind: 'umfrage',
        emoji: '🚩',
        title: 'Wofür würdest du ein Banner hochhalten?',
        poll: vote(
          [
            'Für meine Familie',
            'Für meinen Glauben',
            'Für Freiheit und Gerechtigkeit',
            'Für meine Freunde',
          ],
          'Moroni schrieb auf sein Banner: zur Erinnerung an Gott, an Religion und Freiheit, an ' +
            'Frieden, Frauen und Kinder (Alma 46:12). Bei ihm gehörte alles zusammen.',
        ),
        source: verse('Alma 46:12'),
      },
      {
        key: 'feed-1',
        kind: 'feed',
        emoji: '🧥',
        title: 'Das Banner der Freiheit',
        body:
          'Moroni riss seinen Mantel entzwei, schrieb darauf, wofür er kämpfte, befestigte ihn ' +
          'an einer Stange und nannte ihn das Banner der Freiheit. Dann betete er – und lief ' +
          'mit dem Banner unter die Leute, damit alle es sahen (Alma 46:12–13, 19).',
        deepening:
          'Das Banner war kein Ruf nach Krieg um des Krieges willen: Moroni hatte keine Freude ' +
          'am Blutvergiessen, aber er verteidigte sein Volk mit ganzer Kraft (Alma 48:11–13).\n\n' +
          'Zum Weiterlesen:\n' +
          'Alma 46:19–21\n' +
          'Alma 48:11–13',
        source: verse('Alma 46:12–13'),
      },
      {
        key: 'quiz-1',
        kind: 'quiz',
        emoji: '🎂',
        title: 'Wie alt war Moroni, als er oberster Hauptmann der Nephiten wurde?',
        quiz: choice(
          ['18', '25', '40', '60'],
          1,
          'Erst 25 (Alma 43:17). Jung sein heisst nicht, unwichtig zu sein.',
        ),
        source: verse('Alma 43:17'),
      },
      {
        key: 'skala-1',
        kind: 'umfrage',
        emoji: '🎤',
        title: 'Wie offen zeigst du deinen Glauben – zum Beispiel in der Schule?',
        poll: scale(
          [1, 10],
          ['eher still', 'ganz offen'],
          'Mut heisst nicht, laut zu sein. Moroni hat sein Banner gezeigt, damit andere sich ' +
            'anschliessen konnten. Manchmal ist dein Banner einfach die Art, wie du andere ' +
            'behandelst.',
        ),
      },
      {
        key: 'feed-2',
        kind: 'feed',
        emoji: '🔥',
        title: 'Wäre jeder wie Moroni …',
        body:
          'Mormon schrieb: Wären alle Menschen wie Moroni gewesen, so wären die Mächte der Hölle ' +
          'für immer erschüttert worden (Alma 48:17). Was machte ihn so stark? Er war dankbar, ' +
          'arbeitete unermüdlich für sein Volk und stand fest im Glauben an Christus ' +
          '(Alma 48:11–13).',
        source: verse('Alma 48:17'),
      },
      {
        key: 'quiz-2',
        kind: 'quiz',
        emoji: '🧐',
        title:
          'Fakt oder Mythos? «Hauptmann Moroni ist derselbe Moroni, der Joseph Smith erschien.»',
        quiz: factOrMyth(
          false,
          'Mythos. Hauptmann Moroni lebte etwa 70 Jahre vor Christus. Der Engel Moroni, der ' +
            'Joseph Smith erschien, war der Sohn Mormons – er lebte rund 400 Jahre nach Christus ' +
            'und hat das Buch Mormon abgeschlossen.',
        ),
        source: verse('Moroni 10:1–2'),
      },
      {
        key: 'dilemma-1',
        kind: 'umfrage',
        emoji: '😶',
        title: 'Was würdest du tun? In der Klasse machen sich alle über einen Mitschüler lustig.',
        poll: vote(
          [
            'Mitlachen, um nicht aufzufallen',
            'Nichts sagen, aber nicht mitmachen',
            'Sagen: «Lasst ihn in Ruhe»',
            'Mich danach zu ihm setzen',
          ],
          '«Ich gebe das Gelernte mutig weiter», sagt das Kollegium. Für andere einzustehen ist ' +
            'ein modernes Banner der Freiheit – und manchmal ist der mutigste Schritt der leise: ' +
            'sich danach zu ihm zu setzen.',
        ),
      },
      {
        key: 'puzzle-1',
        kind: 'puzzle',
        emoji: '🧩',
        title: 'Vers-Puzzle: Lehre und Bündnisse 25:10',
        body: 'Ein Vers darüber, wonach es sich zu trachten lohnt.',
        puzzle: puzzle(
          'Du sollst / die Dinge / dieser Welt / ablegen / und nach / den Dingen / einer besseren / trachten',
          'Mach doch zwei Listen: «Dinge dieser Welt» und «Dinge einer ' +
            'besseren Welt». Was willst du ablegen – und wonach trachten?',
        ),
        source: verse('Lehre und Bündnisse 25:10'),
      },
      {
        key: 'quiz-3',
        kind: 'quiz',
        emoji: '🔎',
        title:
          'Schlag Alma 48:10 auf: Wie nennt Mormon die Sache, für die die Nephiten einstanden?',
        quiz: search(
          'Die Sache der Christen',
          'Die «Sache der Christen»: Freiheit, Familie, Frieden – und das Recht, Gott zu ' +
            'verehren.',
        ),
        source: verse('Alma 48:10'),
      },
      {
        key: 'feed-3',
        kind: 'feed',
        emoji: '🤝',
        title: 'Steh nicht allein',
        body:
          'Als Moroni sein Banner zeigte, kamen die Menschen zusammengelaufen und schlossen einen ' +
          'Bund, für das Recht einzustehen (Alma 46:21). Ein Banner wirkt, weil andere ' +
          'mitmachen. Genau so ist ein Kollegium gemeint.',
        source: verse('Alma 46:21'),
      },
      {
        key: 'frage-1',
        kind: 'frage',
        emoji: '💬',
        title: 'Welche Eigenschaft von Moroni möchtest du weiterentwickeln – und wie?',
        body: 'Ein erster kleiner Schritt genügt.',
        source: verse('Alma 48:11–17'),
      },
      {
        key: 'teilen',
        kind: 'teilen',
        emoji: '🏳️',
        title: 'Gestaltet zu Hause ein Familien-Banner',
        body:
          'Was steht bei euch drauf? Drei Wörter genügen. Mach ein Foto davon. Danach hier ' +
          'abhaken.',
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Einspielen                                                          */
/* ------------------------------------------------------------------ */

/** Alle Inhalte des Pakets tragen diese Vorsilbe – daran erkennt die Redaktion sie. */
export const PACK_ID_PREFIX = 'fsy26-'

/** Gehört ein Inhalt zum Themenpaket? */
export function isPackItem(id: string): boolean {
  return id.startsWith(PACK_ID_PREFIX)
}

/** Was das Paket anlegen will – ein fertiger Inhalt mit fester Dokument-ID. */
export interface PackPlan {
  /** Feste ID («fsy26-w41-umfrage-1») – ein zweiter Lauf erzeugt keine Dubletten. */
  id: string
  week: string
  kind: ImpulseKind
  status: ImpulseStatus
  title: string
  body: string
  deepening: string | null
  deepeningTitle: null
  deepeningSource: null
  /** Der Platz im Feed – über alle Arten hinweg, wie das Paket die Woche legt. */
  order: number | null
  source: ImpulseSource | null
  quiz: ImpulseQuiz | null
  poll: ImpulsePoll | null
  puzzle: ImpulsePuzzle | null
  emoji: string | null
  kicker: string | null
  lesson: ImpulseSource | null
  crest: ImpulseCrest | null
  image: null
  videoUrl: null
  videoTextPage: null
  contributor: null
}

/** Die Woche als kurzes Stück der ID – «2026-W41» wird zu «w41». */
function weekTag(week: string): string {
  return `w${week.slice(-2)}`
}

function plan(
  week: string,
  key: string,
  kind: ImpulseKind,
  card: Omit<PackCard, 'key' | 'kind'> & Partial<Pick<PackTheme, 'kicker' | 'lesson' | 'crest'>>,
  order: number | null,
): PackPlan {
  return {
    id: `${PACK_ID_PREFIX}${weekTag(week)}-${key}`,
    week,
    kind,
    status: 'ready',
    title: card.title,
    body: card.body ?? '',
    deepening: card.deepening ?? null,
    deepeningTitle: null,
    deepeningSource: null,
    order,
    source: card.source ?? null,
    quiz: card.quiz ?? null,
    poll: card.poll ?? null,
    puzzle: card.puzzle ?? null,
    emoji: card.emoji ?? null,
    kicker: card.kicker ?? null,
    lesson: card.lesson ?? null,
    crest: card.crest ?? null,
    image: null,
    videoUrl: null,
    videoTextPage: null,
    contributor: null,
  }
}

/** Alle Inhalte einer Woche, wie das Paket sie anlegt – das Wochenthema zuerst. */
export function packWeekPlans(week: PackWeek): PackPlan[] {
  return [
    plan(week.week, 'impuls', 'impuls', week.theme, 0),
    plan(week.week, 'wochenziel', 'wochenziel', week.goal, null),
    plan(week.week, 'tageschallenge', 'tageschallenge', week.challenge, null),
    ...week.deck.map((card, index) => plan(week.week, card.key, card.kind, card, index + 1)),
  ]
}

/**
 * Was das Paket jetzt einspielen würde.
 *
 * Zwei Rücksichten: Vergangene Wochen bleiben weg – ein Wochenthema, das
 * schon vorbei ist, bereitet auf nichts mehr vor und stünde bloss im
 * Rückblick. Und ein Inhalt, dessen feste ID schon existiert, wird gar
 * nicht erst geplant: So holt ein späterer Lauf nur nach, was fehlt,
 * und überschreibt nichts, was die Redaktion inzwischen bearbeitet hat.
 */
export function planPackItems(existing: Pick<ImpulseItem, 'id'>[], todayKey: string): PackPlan[] {
  const existingIds = new Set(existing.map((item) => item.id))
  return PACK_WEEKS.filter((week) => week.week >= todayKey)
    .flatMap(packWeekPlans)
    .filter((entry) => !existingIds.has(entry.id))
}

import { weekKeyOffset } from './impulse.ts'
import type {
  ImpulseItem,
  ImpulseKind,
  ImpulseQuiz,
  ImpulseSource,
} from './types.ts'

/*
 * Das Startpaket des Bereichs «Impuls»: vier Wochen Inhalt, damit der
 * Bereich nicht leer beginnt und die Redaktion eine Vorlage hat, wie
 * Impuls und Quizfrage gemeint sind.
 *
 * Alles stammt aus den heiligen Schriften – dem offiziellen Material, das
 * das Konzept verlangt – und trägt Quelle samt Link in die
 * Evangeliumsbibliothek (churchofjesuschrist.org, deutsch). Bewusst keine
 * Fakten aus einzelnen Konferenzansprachen: Was hier behauptet wird, muss
 * am verlinkten Vers nachprüfbar sein. Die vier Quizformen zeigen die
 * Bandbreite aus dem Konzept – Auswahl, Emoji-Rätsel, Reihenfolge und die
 * Suchfrage, deren Antwort nur in der Quelle steht.
 *
 * `tests/impulse-starter.test.ts` hält fest, dass jeder dieser Inhalte
 * vollständig ist («bereit» ohne offene Punkte) – das Startpaket kann
 * also nie halbe Inhalte veröffentlichen.
 */

const SCRIPTURES = 'https://www.churchofjesuschrist.org/study/scriptures'

interface StarterContent {
  title: string
  body: string
  source: ImpulseSource
  quiz?: ImpulseQuiz
}

export interface StarterWeek {
  impuls: StarterContent
  quiz: StarterContent
}

export const STARTER_WEEKS: StarterWeek[] = [
  /* ---------------- Woche 1 ---------------- */
  {
    impuls: {
      title: '«Ich will hingehen und das tun»',
      body:
        'Nephi bekommt einen Auftrag, der unmöglich scheint – und sagt trotzdem zu. ' +
        'Sein Satz ist einer der bekanntesten im ganzen Buch Mormon, und er gilt auch ' +
        'für deine Woche: Der Herr gibt keine Gebote, ohne einen Weg zu bereiten. ' +
        'Lies den Vers und achte darauf, was Nephi verspricht, bevor er weiss, wie es ' +
        'gehen soll.',
      source: {
        label: '1 Nephi 3:7',
        url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p7#p7`,
      },
    },
    quiz: {
      title: 'In welchem Buch im Buch Mormon steht die Geschichte der 2000 jungen Krieger?',
      body:
        'Sie waren jung, sie hatten noch nie gekämpft – und sie vertrauten dem, was ' +
        'ihre Mütter ihnen beigebracht hatten.',
      source: {
        label: 'Alma 56:47–48',
        url: `${SCRIPTURES}/bofm/alma/56?lang=deu&id=p47-p48#p47`,
      },
      quiz: {
        form: 'choice',
        options: ['1 Nephi', 'Alma', 'Ether', 'Moroni'],
        answerIndex: 1,
        answerText: '',
        explanation:
          'Helaman führte die 2000 jungen Männer – ihre Geschichte steht in Alma 53 ' +
          'und 56 bis 58. Ihr Geheimnis verrät Alma 56:47–48: Sie zweifelten nicht, ' +
          'denn sie hatten es von ihren Müttern gelernt.',
      },
    },
  },

  /* ---------------- Woche 2 ---------------- */
  {
    impuls: {
      title: 'Auf Fels gebaut',
      body:
        'Jesus erzählt von zwei Bauleuten: Beide bauen ein Haus, beide erleben ' +
        'denselben Sturm. Den Unterschied macht nicht das Wetter, sondern der Grund, ' +
        'auf dem sie stehen. Wer seine Woche mit ihm baut – ein Gebet, ein Vers, ein ' +
        'guter Entschluss –, baut auf Fels.',
      source: {
        label: 'Matthäus 7:24–25',
        url: `${SCRIPTURES}/nt/matt/7?lang=deu&id=p24-p25#p24`,
      },
    },
    quiz: {
      title: '🌊 ⛵ 😴 – welche Begebenheit aus dem Neuen Testament suchen wir?',
      body: 'Drei Emojis, eine Geschichte.',
      source: {
        label: 'Markus 4:35–41',
        url: `${SCRIPTURES}/nt/mark/4?lang=deu&id=p35-p41#p35`,
      },
      quiz: {
        form: 'choice',
        options: [
          'Petrus geht auf dem Wasser',
          'Jona und der grosse Fisch',
          'Jesus stillt den Sturm',
          'Die Speisung der Fünftausend',
        ],
        answerIndex: 2,
        answerText: '',
        explanation:
          'Während der Sturm tobte, schlief Jesus hinten im Boot (Markus 4:38). ' +
          'Geweckt gebot er dem Wind und dem Meer – und es wurde ganz still. Und wer ' +
          'an Jona gedacht hat: Der steht im Alten Testament, das wäre doppelt falsch ' +
          'gewesen.',
      },
    },
  },

  /* ---------------- Woche 3 ---------------- */
  {
    impuls: {
      title: '«Blickt in jedem Gedanken auf mich»',
      body:
        'Ein Satz, der in jede Hosentasche passt: «Blickt in jedem Gedanken auf mich; ' +
        'zweifelt nicht, fürchtet euch nicht.» Der Herr sagt ihn 1829 zu Oliver ' +
        'Cowdery – und heute zu dir. Nimm ihn diese Woche mit: beim Aufstehen, vor ' +
        'der Prüfung, im Bus.',
      source: {
        label: 'Lehre und Bündnisse 6:36',
        url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p36#p36`,
      },
    },
    quiz: {
      title:
        'Bring die ersten Grundsätze und Verordnungen des Evangeliums in die richtige Reihenfolge',
      body: 'Vier Schritte – aber welcher kommt zuerst?',
      source: {
        label: '4. Glaubensartikel',
        url: `${SCRIPTURES}/pgp/a-of-f/1?lang=deu&id=p4#p4`,
      },
      quiz: {
        form: 'choice',
        options: [
          'Glaube – Umkehr – Taufe – Gabe des Heiligen Geistes',
          'Umkehr – Glaube – Taufe – Gabe des Heiligen Geistes',
          'Taufe – Glaube – Umkehr – Gabe des Heiligen Geistes',
          'Glaube – Taufe – Umkehr – Gabe des Heiligen Geistes',
        ],
        answerIndex: 0,
        answerText: '',
        explanation:
          'So steht es im 4. Glaubensartikel: erstens der Glaube an den Herrn Jesus ' +
          'Christus, zweitens die Umkehr, drittens die Taufe durch Untertauchen zur ' +
          'Sündenvergebung, viertens das Händeauflegen zur Gabe des Heiligen Geistes.',
      },
    },
  },

  /* ---------------- Woche 4 ---------------- */
  {
    impuls: {
      title: 'Hoffen auf das, was wahr ist',
      body:
        'Alma erklärt, was Glaube ist: keine vollkommene Erkenntnis, sondern hoffen ' +
        'auf das, was nicht gesehen wird, was aber wahr ist. Das ist keine Schwäche, ' +
        'sondern ein Anfang – wie ein Experiment, das man wagt.',
      source: {
        label: 'Alma 32:21',
        url: `${SCRIPTURES}/bofm/alma/32?lang=deu&id=p21#p21`,
      },
    },
    quiz: {
      title: 'Schlag Alma 32:28 auf: Womit vergleicht Alma das Wort?',
      body: 'Die Antwort steht direkt im Vers – ein Wort genügt.',
      source: {
        label: 'Alma 32:28',
        url: `${SCRIPTURES}/bofm/alma/32?lang=deu&id=p28#p28`,
      },
      quiz: {
        form: 'text',
        options: [],
        answerIndex: 0,
        answerText: 'Mit einem Samenkorn',
        explanation:
          'Alma sagt: Pflanzt das Wort wie ein Samenkorn ins Herz und nährt es. Wenn ' +
          'es echt ist, beginnt es zu schwellen und zu wachsen – und genau das kann ' +
          'man spüren. Der Versuch selbst ist schon Glaube.',
      },
    },
  },
]

/** Was das Startpaket anlegen will – ein Inhalt mit fester Dokument-ID. */
export interface StarterPlan {
  /** Feste ID («starter-w1-impuls») – ein zweiter Lauf erzeugt keine Dubletten. */
  id: string
  week: string | null
  kind: ImpulseKind
  status: 'ready'
  title: string
  body: string
  source: ImpulseSource
  quiz: ImpulseQuiz | null
}

/**
 * Verteilt das Startpaket auf die laufende und die nächsten drei Wochen.
 *
 * Ein Platz, der schon belegt ist (gleiche Woche, gleiche Art), bleibt
 * unangetastet – der betreffende Inhalt geht stattdessen in den
 * Fragenpool (`week: null`) und kann von Hand geplant werden. So
 * überschreibt das Paket nie, was die Redaktion bereits erfasst hat.
 */
export function planStarterItems(
  existing: Pick<ImpulseItem, 'week' | 'kind'>[],
  todayKey: string,
): StarterPlan[] {
  const taken = new Set(
    existing
      .filter((item) => typeof item.week === 'string')
      .map((item) => `${item.week}·${item.kind}`),
  )

  const plans: StarterPlan[] = []
  for (const [index, starter] of STARTER_WEEKS.entries()) {
    const week = weekKeyOffset(todayKey, index)
    for (const kind of ['impuls', 'quiz'] as ImpulseKind[]) {
      const content = kind === 'impuls' ? starter.impuls : starter.quiz
      const free = week !== null && !taken.has(`${week}·${kind}`)
      plans.push({
        id: `starter-w${index + 1}-${kind}`,
        week: free ? week : null,
        kind,
        status: 'ready',
        title: content.title,
        body: content.body,
        source: content.source,
        quiz: kind === 'quiz' ? (content.quiz ?? null) : null,
      })
    }
  }
  return plans
}

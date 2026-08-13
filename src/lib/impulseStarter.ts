import { weekKeyOffset } from './impulse.ts'
import type {
  ImpulseItem,
  ImpulseKind,
  ImpulseQuiz,
  ImpulseSource,
  ImpulseStatus,
} from './types.ts'

/*
 * Das Startpaket des Bereichs «Anti Doom»: vier Wochen Inhalt, damit der
 * Bereich nicht leer beginnt und die Redaktion eine Vorlage hat, wie
 * die Karten gemeint sind. Die ersten drei Wochen sind voll ausgebaut –
 * je drei Quizfragen in steigendem Schwierigkeitsgrad, drei
 * Bilderrätsel, zehn Feed-Karten (etliche mit Vertiefung), dazu Impuls,
 * Wochenziel, Tages-Challenge, Frage der Woche und die Teilen-Aufgabe.
 *
 * Alles stammt aus den heiligen Schriften – dem offiziellen Material,
 * das das Konzept verlangt – und trägt Quelle samt Link in die
 * Evangeliumsbibliothek (churchofjesuschrist.org, deutsch). Bewusst
 * keine Fakten aus einzelnen Konferenzansprachen: Was hier behauptet
 * wird, muss am verlinkten Vers nachprüfbar sein.
 *
 * **Bilderrätsel kommen als Entwurf**: Ihr Bild muss aus der offiziellen
 * Mediathek der Kirche stammen, und einen Bild-Link kann nur ein Mensch
 * am Browser kopieren. Frage, Antworten und Auflösung sind fertig – die
 * Redaktion öffnet den Entwurf, setzt den Bild-Link ein (das Formular
 * sagt, wie) und hakt «bereit» an. Die Auflösung verrät, welches Bild
 * gemeint ist.
 *
 * `tests/impulse-starter.test.ts` hält fest, dass jeder «bereite» Inhalt
 * vollständig ist und den Bilderrätseln allein das Bild fehlt – das
 * Startpaket kann also nie halbe Inhalte veröffentlichen.
 */

const SCRIPTURES = 'https://www.churchofjesuschrist.org/study/scriptures'

/** Die Tempel-Übersicht der Kirche – Quelle der Tempel-Rätsel. */
const TEMPLES = 'https://www.churchofjesuschrist.org/temples/list?lang=deu'

interface StarterContent {
  title: string
  body: string
  /** Die Vertiefung – die zweite Seite der Karte im Vollbild-Feed. */
  deepening?: string
  /** Bei Wochenthema und Quiz Pflicht; Aufgaben dürfen ohne Fundstelle sein. */
  source?: ImpulseSource
  quiz?: ImpulseQuiz
}

export interface StarterWeek {
  impuls: StarterContent
  /** Bis zu drei Quizfragen, in steigendem Schwierigkeitsgrad. */
  quiz: StarterContent[]
  /** Bilderrätsel – als Entwurf geplant, das Bild ergänzt die Redaktion. */
  bilderraetsel: StarterContent[]
  wochenziel: StarterContent
  tageschallenge: StarterContent
  /** Die offene Frage der Woche – Antworten mit Vornamen. */
  frage: StarterContent
  /** Die Teilen-Aufgabe: die Einladung, das Thema weiterzutragen. */
  teilen: StarterContent
  /** Der Feed der Woche, in Lesereihenfolge – endlich, wie das Konzept will. */
  feed: StarterContent[]
}

export const STARTER_WEEKS: StarterWeek[] = [
  /* ---------------- Woche 1: «Ich will hingehen und das tun» ---------------- */
  {
    impuls: {
      title: '«Ich will hingehen und das tun»',
      body:
        'Nephi bekommt einen Auftrag, der unmöglich scheint – und sagt trotzdem zu. ' +
        'Sein Satz ist einer der bekanntesten im ganzen Buch Mormon, und er gilt auch ' +
        'für deine Woche: Der Herr gibt keine Gebote, ohne einen Weg zu bereiten. ' +
        'Lies den Vers und achte darauf, was Nephi verspricht, bevor er weiss, wie es ' +
        'gehen soll.',
      deepening:
        'Dass der Herr einen Weg bereitet, heisst nicht, dass der Weg leicht ist: Nephi ' +
        'brauchte drei Anläufe, bis er die Messingplatten hatte – erst der dritte gelang, ' +
        'und zwar, als er «vom Geist geführt» ging, ohne im Voraus zu wissen, was er tun ' +
        'sollte (1 Nephi 4:6). Jahre später baut Nephi mit derselben Haltung ein Schiff ' +
        'und sagt den Satz gleichsam noch einmal: «Wenn Gott mir geboten hat, alle Dinge ' +
        'zu tun, kann ich sie tun.»\n\n' +
        'Zum Weiterlesen:\n' +
        `1 Nephi 4:6 – ${SCRIPTURES}/bofm/1-ne/4?lang=deu&id=p6#p6\n` +
        `1 Nephi 17:3 – ${SCRIPTURES}/bofm/1-ne/17?lang=deu&id=p3#p3`,
      source: {
        label: '1 Nephi 3:7',
        url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p7#p7`,
      },
    },
    quiz: [
      {
        title: 'In welchem Buch im Buch Mormon steht die Geschichte der 2000 jungen Krieger?',
        body:
          'Zum Aufwärmen: Sie waren jung, sie hatten noch nie gekämpft – und sie ' +
          'vertrauten dem, was ihre Mütter ihnen beigebracht hatten.',
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
      {
        title: 'Weshalb schickte Lehi seine Söhne zurück nach Jerusalem?',
        body:
          'Schon schwieriger: Die Familie war bereits in der Wildnis – und musste ' +
          'trotzdem noch einmal zurück.',
        deepening:
          'Der Auftrag wirkt auf den ersten Blick unnötig riskant – Laban war mächtig ' +
          'und gefährlich. Aber ohne die Messingplatten hätte Lehis Volk seine Schriften ' +
          'und seine Sprache verloren (1 Nephi 4:15–16 und Mosia 1:3–4 erklären das ' +
          'ausdrücklich). Gottes Gebote haben Gründe, auch wenn man sie erst später ' +
          'sieht.\n\n' +
          'Zum Weiterlesen:\n' +
          `Mosia 1:3–4 – ${SCRIPTURES}/bofm/mosiah/1?lang=deu&id=p3-p4#p3`,
        source: {
          label: '1 Nephi 3:2–4',
          url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p2-p4#p2`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Um die Messingplatten mit den Schriften zu holen',
            'Um Vorräte für die Reise zu holen',
            'Um ihr Haus zu verkaufen',
            'Um Freunde zu warnen',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Auf den Messingplatten standen die fünf Bücher Mose, die Geschichte der ' +
            'Juden und der Stammbaum von Lehis Vätern (1 Nephi 3:3). Die Familie Ismaels ' +
            'holten die Brüder erst auf einer zweiten Reise (1 Nephi 7).',
        },
      },
      {
        title: 'Schlag 1 Nephi 3:7 auf: Was wird der Herr bereiten, damit seine Kinder das Gebotene vollbringen können?',
        body: 'Für Profis: Die Antwort ist ein einziges Wort – es steht wörtlich im Vers.',
        source: {
          label: '1 Nephi 3:7',
          url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p7#p7`,
        },
        quiz: {
          form: 'text',
          options: [],
          answerIndex: 0,
          answerText: 'Einen Weg',
          explanation:
            '«… denn ich weiss, dass der Herr keine Gebote an die Menschenkinder gibt, ' +
            'ohne ihnen einen Weg zu bereiten, wie sie das vollbringen können, was er ' +
            'ihnen gebietet.» Der Weg gehört zum Gebot dazu – suchen muss man ihn ' +
            'trotzdem selbst.',
        },
      },
    ],
    bilderraetsel: [
      {
        title: 'In welcher Schweizer Gemeinde steht der älteste Tempel Europas?',
        body: 'Zum Aufwärmen – für viele ist er der Tempel der Heimat.',
        source: { label: 'Tempel der Kirche', url: TEMPLES },
        quiz: {
          form: 'choice',
          options: ['Zollikofen bei Bern', 'Zürich', 'Genf', 'Basel'],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Der Bern-Tempel in Zollikofen wurde 1955 geweiht – als erster Tempel ' +
            'Europas überhaupt. Bild für dieses Rätsel: der Bern-Tempel aus der ' +
            'Mediathek der Kirche.',
        },
      },
      {
        title: 'Welcher Prophet erhält auf diesem Bild die goldenen Platten?',
        body: 'Schon schwieriger: Der Engel auf dem Bild heisst Moroni.',
        source: {
          label: 'Joseph Smith – Lebensgeschichte 1:59',
          url: `${SCRIPTURES}/pgp/js-h/1?lang=deu&id=p59#p59`,
        },
        quiz: {
          form: 'choice',
          options: ['Joseph Smith', 'Brigham Young', 'Mormon', 'Nephi'],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Moroni zeigte Joseph Smith die Platten erstmals 1823 am Hügel Cumorah; ' +
            'erhalten hat er sie vier Jahre später, 1827. Bild für dieses Rätsel: ' +
            '«Joseph Smith erhält die Platten» aus der Mediathek der Kirche.',
        },
      },
      {
        title: 'Welche Begebenheit aus dem Buch Mormon zeigt dieses Bild?',
        body: 'Für Profis: Ein Baum, ein Pfad, ein eisernes Geländer – und viel Nebel.',
        source: {
          label: '1 Nephi 8',
          url: `${SCRIPTURES}/bofm/1-ne/8?lang=deu`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Lehis Traum vom Baum des Lebens',
            'Almas Taufe am Wasser Mormon',
            'Der Titel der Freiheit',
            'Die Brüder auf dem Weg zu Laban',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Lehi sieht im Traum den Baum, dessen Frucht «über alles süss» ist, die ' +
            'eiserne Stange, den Nebel und das grosse, geräumige Gebäude – Nephi erhält ' +
            'später die Deutung (1 Nephi 11–12). Bild für dieses Rätsel: «Lehis Traum» ' +
            'aus der Mediathek der Kirche.',
        },
      },
    ],
    wochenziel: {
      title: 'Lies diese Woche ein Kapitel im Buch Mormon',
      body:
        'Egal welches – eines, das dich gerade anspricht. Der Haken gehört dir, ' +
        'sobald es gelesen ist.',
      source: { label: 'Buch Mormon', url: `${SCRIPTURES}/bofm?lang=deu` },
    },
    tageschallenge: {
      title: 'Lies jeden Tag einen Vers',
      body: 'Einer genügt – morgens im Bus oder abends im Bett.',
      source: { label: 'Buch Mormon', url: `${SCRIPTURES}/bofm?lang=deu` },
    },
    frage: {
      title: 'Was hilft dir, Ja zu sagen, wenn ein Auftrag zu gross wirkt?',
      body: 'Zwei, drei Sätze genügen – dein Beispiel hilft den anderen.',
    },
    teilen: {
      title:
        'Frag ein Familienmitglied oder einen Freund: Wann bist du – wie Nephi – hingegangen ' +
        'und hast getan, was der Herr geboten hat, obwohl es schwer schien?',
      body:
        'Hör gut zu – und erzähl danach von deinem eigenen «Ich will hingehen»-Moment. ' +
        'Danach darfst du hier abhaken.',
      source: { label: '1 Nephi 3:7', url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p7#p7` },
    },
    feed: [
      {
        title: '«Ich will hingehen und das tun, was der Herr geboten hat.»',
        body: 'Nephi sagt zu, bevor er weiss, wie es gehen soll.',
        source: { label: '1 Nephi 3:7', url: `${SCRIPTURES}/bofm/1-ne/3?lang=deu&id=p7#p7` },
      },
      {
        title: 'Wusstest du? Das Buch Mormon enthält 15 Bücher.',
        body: 'Vom ersten Buch Nephi bis zum Buch Moroni.',
        source: { label: 'Buch Mormon', url: `${SCRIPTURES}/bofm?lang=deu` },
      },
      {
        title: '«Mit ganzem Herzen vertrau auf den HERRN!»',
        body: 'Nicht auf die eigene Klugheit bauen – sondern ihn auf allen Wegen erkennen.',
        deepening:
          'Der zweite Vers macht das Versprechen konkret: «… dann ebnet er selbst deine ' +
          'Pfade» (Sprichwörter 3:6). Genau das hat Nephi erlebt – der Weg entstand beim ' +
          'Gehen, nicht vorher. Vertrauen heisst nicht, den Plan zu kennen, sondern den ' +
          'zu kennen, der ihn hat.\n\n' +
          'Zum Weiterlesen:\n' +
          `Sprichwörter 3:5–6 – ${SCRIPTURES}/ot/prov/3?lang=deu&id=p5-p6#p5`,
        source: {
          label: 'Sprichwörter 3:5–6',
          url: `${SCRIPTURES}/ot/prov/3?lang=deu&id=p5-p6#p5`,
        },
      },
      {
        title: 'Wusstest du? Nephi ging «vom Geist geführt» – ohne im Voraus zu wissen, was er tun sollte.',
        body: 'Der dritte Anlauf gelang nicht mit einem besseren Plan, sondern mit Vertrauen.',
        deepening:
          'Zwei Anläufe waren gescheitert: Erst versuchten es die Brüder mit Bitten, ' +
          'dann mit Gold und Silber – beides ging schief, und Laman und Lemuel wollten ' +
          'aufgeben. Nephi ging in der Nacht ein drittes Mal in die Stadt, und diesmal ' +
          'liess er sich führen, Schritt für Schritt (1 Nephi 4:6–7). Manchmal ist der ' +
          'bereitete Weg keiner, den man von Weitem sieht – sondern einer, der unter den ' +
          'Füssen entsteht.\n\n' +
          'Zum Weiterlesen:\n' +
          `1 Nephi 4:6–7 – ${SCRIPTURES}/bofm/1-ne/4?lang=deu&id=p6-p7#p6`,
        source: { label: '1 Nephi 4:6', url: `${SCRIPTURES}/bofm/1-ne/4?lang=deu&id=p6#p6` },
      },
      {
        title: '«Insofern ihr meine Gebote haltet, werdet ihr im Land gedeihen.»',
        body: 'Das Versprechen, das sich durch das ganze Buch Mormon zieht.',
        source: { label: '2 Nephi 1:20', url: `${SCRIPTURES}/bofm/2-ne/1?lang=deu&id=p20#p20` },
      },
      {
        title: 'Wusstest du? Lehis Familie war schon tagelang unterwegs, als die Söhne zurückmussten.',
        body:
          'Drei Tagereisen hinter dem Roten Meer schlug Lehi sein Zelt auf – von dort ' +
          'ging es zurück nach Jerusalem.',
        source: { label: '1 Nephi 2:5–6', url: `${SCRIPTURES}/bofm/1-ne/2?lang=deu&id=p5-p6#p5` },
      },
      {
        title: 'Der kürzeste berühmte Satz im ersten Buch Nephi: «Und mein Vater wohnte in einem Zelt.»',
        body:
          'Lehi liess Haus, Gold und Silber zurück – ein ganzes Leben Verzicht, erzählt ' +
          'in einem Satz.',
        deepening:
          'Der Satz steht nicht zufällig da: Kurz davor zählt Nephi auf, was Lehi alles ' +
          'zurückliess – sein Land, sein Haus, sein Gold, sein Silber und seine ' +
          'Kostbarkeiten (1 Nephi 2:4). Das Zelt ist das Gegenteil davon, und Lehi murrte ' +
          'nicht. Was wäre dein «Zelt» – das Einfache, mit dem du zufrieden sein ' +
          'könntest?\n\n' +
          'Zum Weiterlesen:\n' +
          `1 Nephi 2:4 – ${SCRIPTURES}/bofm/1-ne/2?lang=deu&id=p4#p4`,
        source: { label: '1 Nephi 2:15', url: `${SCRIPTURES}/bofm/1-ne/2?lang=deu&id=p15#p15` },
      },
      {
        title: 'Zum Nachdenken: Was würdest du antworten, wenn der Herr dich heute um etwas Schweres bäte?',
        body: 'Ehrlich bleiben – Nephi hatte auch Brüder, die Nein sagten.',
      },
      {
        title: 'Zum Nachdenken: Was ist dein «Ich will hingehen»-Moment diese Woche?',
        body: 'Die eine Sache, die du anpackst, obwohl sie schwer scheint.',
      },
      {
        title: 'Ein kleiner Schritt zum Schluss: Nimm dir ein Gebot vor, das du diese Woche bewusst hältst.',
        body: 'Klein anfangen zählt – der Weg ist bereitet.',
      },
    ],
  },

  /* ---------------- Woche 2: Auf Fels gebaut ---------------- */
  {
    impuls: {
      title: 'Auf Fels gebaut',
      body:
        'Jesus erzählt von zwei Bauleuten: Beide bauen ein Haus, beide erleben ' +
        'denselben Sturm. Den Unterschied macht nicht das Wetter, sondern der Grund, ' +
        'auf dem sie stehen. Wer seine Woche mit ihm baut – ein Gebet, ein Vers, ein ' +
        'guter Entschluss –, baut auf Fels.',
      deepening:
        'Das Buch Mormon nennt den Fels beim Namen: Helaman sagt seinen Söhnen, dass es ' +
        '«der Fels unseres Erlösers» ist, auf den wir bauen müssen – und verspricht, dass ' +
        'der Teufel mit all seinen Wirbelstürmen dann «keine Macht über euch» hat. Beide ' +
        'Bauleute erleben den Sturm; das Evangelium verspricht keinen sturmfreien Himmel, ' +
        'sondern einen Grund, der hält.\n\n' +
        'Zum Weiterlesen:\n' +
        `Helaman 5:12 – ${SCRIPTURES}/bofm/hel/5?lang=deu&id=p12#p12`,
      source: {
        label: 'Matthäus 7:24–25',
        url: `${SCRIPTURES}/nt/matt/7?lang=deu&id=p24-p25#p24`,
      },
    },
    quiz: [
      {
        title: '🌊 ⛵ 😴 – welche Begebenheit aus dem Neuen Testament suchen wir?',
        body: 'Zum Aufwärmen: Drei Emojis, eine Geschichte.',
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
      {
        title: 'Wer sagte: «Auf dem Fels unseres Erlösers … müsst ihr euer Fundament bauen»?',
        body: 'Schon schwieriger: Ein Vater sagt es zu seinen zwei Söhnen – die nach zwei Propheten benannt sind.',
        deepening:
          'Helaman hatte seine Söhne Nephi und Lehi genannt, «damit ihr euch an sie ' +
          'erinnert» und an ihre Werke (Helaman 5:6). Der Rat mit dem Fels steht mitten ' +
          'in dieser Namens-Erklärung – Fundament und Herkunft gehören zusammen.\n\n' +
          'Zum Weiterlesen:\n' +
          `Helaman 5:6–12 – ${SCRIPTURES}/bofm/hel/5?lang=deu&id=p6-p12#p6`,
        source: {
          label: 'Helaman 5:12',
          url: `${SCRIPTURES}/bofm/hel/5?lang=deu&id=p12#p12`,
        },
        quiz: {
          form: 'choice',
          options: ['Alma', 'Helaman', 'Mormon', 'König Benjamin'],
          answerIndex: 1,
          answerText: '',
          explanation:
            'Helaman sagt es zu seinen Söhnen Nephi und Lehi (Helaman 5:12) – mitsamt ' +
            'dem Versprechen: Wenn der Teufel seine mächtigen Winde aussendet, hat er ' +
            '«keine Macht über euch», weil der Fels ein sicheres Fundament ist.',
        },
      },
      {
        title: 'Schlag Matthäus 7:25 auf: Welche drei Dinge brechen über das Haus herein?',
        body: 'Für Profis: Alle drei stehen im selben Vers – der Reihe nach.',
        source: {
          label: 'Matthäus 7:25',
          url: `${SCRIPTURES}/nt/matt/7?lang=deu&id=p25#p25`,
        },
        quiz: {
          form: 'text',
          options: [],
          answerIndex: 0,
          answerText: 'Wolkenbruch, Wassermassen und Stürme',
          explanation:
            'Ein Wolkenbruch kam, die Wassermassen fluteten heran und die Stürme tobten ' +
            'und rüttelten am Haus – «es stürzte aber nicht ein, denn es war auf Fels ' +
            'gebaut». Das Wetter ist in beiden Versen dasselbe; nur das Fundament nicht.',
        },
      },
    ],
    bilderraetsel: [
      {
        title: 'Welche Begebenheit zeigt dieses Bild?',
        body: 'Zum Aufwärmen: ein Boot, hohe Wellen – und einer, der ruhig bleibt.',
        source: {
          label: 'Markus 4:39',
          url: `${SCRIPTURES}/nt/mark/4?lang=deu&id=p39#p39`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Jesus stillt den Sturm',
            'Der wunderbare Fischzug',
            'Jona wird über Bord geworfen',
            'Paulus erleidet Schiffbruch',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            '«Schweig, sei still!» – und der Wind legte sich, und es trat völlige Stille ' +
            'ein (Markus 4:39). Bild für dieses Rätsel: «Jesus stillt den Sturm» aus der ' +
            'Mediathek der Kirche.',
        },
      },
      {
        title: 'In welchem Land steht dieser Tempel?',
        body: 'Schon schwieriger: Er wurde 2019 geweiht – ganz in der Nähe einer sehr alten Stadt.',
        source: { label: 'Tempel der Kirche', url: TEMPLES },
        quiz: {
          form: 'choice',
          options: ['Italien', 'Spanien', 'Portugal', 'Frankreich'],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Der Rom-Italien-Tempel wurde im März 2019 geweiht. Bild für dieses Rätsel: ' +
            'der Rom-Italien-Tempel aus der Mediathek der Kirche.',
        },
      },
      {
        title: 'Wo hielt Jesus die Predigt, die dieses Bild zeigt – mit den Seligpreisungen am Anfang?',
        body: 'Für Profis: Der Ort gab der Predigt ihren Namen.',
        source: {
          label: 'Matthäus 5:1–2',
          url: `${SCRIPTURES}/nt/matt/5?lang=deu&id=p1-p2#p1`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Auf einem Berg am See Gennesaret',
            'Im Tempel in Jerusalem',
            'Am Ufer des Jordan',
            'In der Synagoge von Nazaret',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            '«Als Jesus die vielen Menschen sah, stieg er auf den Berg» (Matthäus 5:1) – ' +
            'deshalb heisst sie Bergpredigt. Bild für dieses Rätsel: «Die Bergpredigt» ' +
            'aus der Mediathek der Kirche.',
        },
      },
    ],
    wochenziel: {
      title: 'Schau oder hör dir eine Ansprache der letzten Generalkonferenz an',
      body: 'Such dir selbst eine aus – vielleicht steckt darin deine nächste Quizidee.',
      source: {
        label: 'Generalkonferenz',
        url: 'https://www.churchofjesuschrist.org/study/general-conference?lang=deu',
      },
    },
    tageschallenge: {
      title: 'Bete jeden Morgen kurz',
      body: 'Ein Satz zählt. Der Tag beginnt anders, wenn er so beginnt.',
    },
    frage: {
      title: 'Was gehört für dich zu einem Fundament auf Fels – ganz konkret im Alltag?',
      body: '',
    },
    teilen: {
      title:
        'Sprich mit jemandem aus deiner Familie darüber, was eurem Zuhause ein Fundament ' +
        'aus Fels gibt – und was ihr gemeinsam stärken wollt.',
      body: 'Ein Abendessen genügt als Gelegenheit. Danach darfst du hier abhaken.',
      source: {
        label: 'Matthäus 7:24–27',
        url: `${SCRIPTURES}/nt/matt/7?lang=deu&id=p24-p27#p24`,
      },
    },
    feed: [
      {
        title: 'Hören und handeln – das ist der ganze Unterschied zwischen den beiden Bauleuten.',
        body: 'Beide hörten dieselben Worte. Nur einer baute danach.',
        source: {
          label: 'Matthäus 7:24–27',
          url: `${SCRIPTURES}/nt/matt/7?lang=deu&id=p24-p27#p24`,
        },
      },
      {
        title: 'Wusstest du? Die Bergpredigt umfasst drei Kapitel – Matthäus 5 bis 7.',
        body: 'Das Gleichnis vom Hausbau ist ihr Schlusswort.',
        source: { label: 'Matthäus 5–7', url: `${SCRIPTURES}/nt/matt/5?lang=deu` },
      },
      {
        title: '«Auf dem Fels unseres Erlösers … müsst ihr euer Fundament bauen.»',
        body: 'Ein sicheres Fundament – wenn die Winde kommen, hat der Sturm keine Macht.',
        deepening:
          'Helaman verspricht nicht, dass der Hagel und der mächtige Sturm ausbleiben – ' +
          'im Gegenteil: «wenn der Teufel seine mächtigen Winde aussendet, ja, seine ' +
          'Pfeile im Wirbelsturm». Das Fundament ändert nicht das Wetter, sondern den ' +
          'Ausgang: Es «kann nicht fallen».\n\n' +
          'Zum Weiterlesen:\n' +
          `Helaman 5:12 – ${SCRIPTURES}/bofm/hel/5?lang=deu&id=p12#p12`,
        source: { label: 'Helaman 5:12', url: `${SCRIPTURES}/bofm/hel/5?lang=deu&id=p12#p12` },
      },
      {
        title: 'Wusstest du? Bei Lukas gräbt der kluge Baumeister «tief».',
        body:
          'Dasselbe Gleichnis, ein Detail mehr: Das Fundament auf den Felsen legen ' +
          'heisst zuerst graben.',
        deepening:
          'Lukas erzählt das Gleichnis mit einer Baustellen-Einzelheit: Der kluge Mann ' +
          '«hob die Erde tief aus und legte das Fundament auf einen Felsen» (Lukas 6:48). ' +
          'Tief graben ist unsichtbare Arbeit – niemand bewundert ein Fundament. Aber ' +
          'genau dort entscheidet sich, was der Sturm später ausrichten kann.\n\n' +
          'Zum Weiterlesen:\n' +
          `Lukas 6:47–49 – ${SCRIPTURES}/nt/luke/6?lang=deu&id=p47-p49#p47`,
        source: { label: 'Lukas 6:48', url: `${SCRIPTURES}/nt/luke/6?lang=deu&id=p48#p48` },
      },
      {
        title: '«Er allein ist mein Fels und meine Hilfe … ich werde nicht wanken.»',
        body: 'Ein Psalm zum Mitnehmen für stürmische Tage.',
        source: { label: 'Psalm 62:3', url: `${SCRIPTURES}/ot/ps/62?lang=deu&id=p3#p3` },
      },
      {
        title: '«Warum habt ihr solche Angst? Habt ihr noch keinen Glauben?»',
        body: 'Die Frage im Boot gilt auch auf dem Trockenen.',
        source: { label: 'Markus 4:40', url: `${SCRIPTURES}/nt/mark/4?lang=deu&id=p40#p40` },
      },
      {
        title: 'Wusstest du? Jesus hielt dieselbe Predigt auch auf dem amerikanischen Kontinent.',
        body:
          'Nach seiner Auferstehung lehrte er die Nephiten – das Haus auf dem Felsen ' +
          'steht auch in 3 Nephi.',
        deepening:
          'In 3 Nephi 12 bis 14 hält der auferstandene Herr den Nephiten die Predigt, ' +
          'die wir als Bergpredigt kennen – fast Wort für Wort, mit kleinen, bewussten ' +
          'Unterschieden. Das Gleichnis vom Hausbau schliesst sie auch dort ab (3 Nephi ' +
          '14:24–27). Zwei Kontinente, eine Botschaft: Das Buch Mormon ist der zweite ' +
          'Zeuge für Jesus Christus.\n\n' +
          'Zum Weiterlesen:\n' +
          `3 Nephi 14:24–27 – ${SCRIPTURES}/bofm/3-ne/14?lang=deu&id=p24-p27#p24`,
        source: {
          label: '3 Nephi 14:24–25',
          url: `${SCRIPTURES}/bofm/3-ne/14?lang=deu&id=p24-p25#p24`,
        },
      },
      {
        title: 'Gewohnheiten sind Bausteine: ein Gebet am Morgen, ein Vers am Abend.',
        body: 'Kleine Steine, festes Haus – gebaut wird täglich, nicht einmal.',
      },
      {
        title: 'Zum Nachdenken: Welcher «Regen» prasselt gerade auf dein Haus?',
        body: 'Und worauf steht es?',
      },
      {
        title: 'Zum Nachdenken: Welche eine Gewohnheit würde dein Fundament diese Woche am meisten stärken?',
        body: 'Nimm sie dir für morgen vor – nicht für irgendwann.',
      },
    ],
  },

  /* ---------------- Woche 3: «Blickt in jedem Gedanken auf mich» ---------------- */
  {
    impuls: {
      title: '«Blickt in jedem Gedanken auf mich»',
      body:
        'Ein Satz, der in jede Hosentasche passt: «Blickt in jedem Gedanken auf mich; ' +
        'zweifelt nicht, fürchtet euch nicht.» Der Herr sagt ihn 1829 zu Oliver ' +
        'Cowdery – und heute zu dir. Nimm ihn diese Woche mit: beim Aufstehen, vor ' +
        'der Prüfung, im Bus.',
      deepening:
        'Ein paar Verse davor erinnert der Herr Oliver Cowdery an eine Nacht, in der er ' +
        'um Gewissheit gebetet hatte: «Habe ich dir nicht Frieden in deinen Sinn geredet, ' +
        'was die Sache betrifft?» (LuB 6:23). Der Satz «Blickt in jedem Gedanken auf mich» ' +
        'steht also nicht am Anfang, sondern nach einer Antwort, die Oliver schon erhalten ' +
        'hatte – sich erinnern gehört zum Glauben.\n\n' +
        'Zum Weiterlesen:\n' +
        `Lehre und Bündnisse 6:22–23 – ${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p22-p23#p22`,
      source: {
        label: 'Lehre und Bündnisse 6:36',
        url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p36#p36`,
      },
    },
    quiz: [
      {
        title:
          'Bring die ersten Grundsätze und Verordnungen des Evangeliums in die richtige Reihenfolge',
        body: 'Zum Aufwärmen: Vier Schritte – aber welcher kommt zuerst?',
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
      {
        title: 'Wem galt die Offenbarung mit dem Satz «Blickt in jedem Gedanken auf mich»?',
        body: 'Schon schwieriger: Er diente Joseph Smith gerade als Schreiber bei der Übersetzung.',
        deepening:
          'Oliver Cowdery war Schullehrer und wohnte bei Josephs Eltern, als er von den ' +
          'Platten hörte. Im April 1829 reiste er zu Joseph nach Harmony und wurde sein ' +
          'Schreiber – zwei junge Männer, ein Tisch, ein Stapel Papier. Die Offenbarung ' +
          'in Lehre und Bündnisse 6 erging an beide gemeinsam, noch im selben Monat.\n\n' +
          'Zum Weiterlesen:\n' +
          `Joseph Smith – Lebensgeschichte 1:66–67 – ${SCRIPTURES}/pgp/js-h/1?lang=deu&id=p66-p67#p66`,
        source: {
          label: 'Lehre und Bündnisse 6',
          url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu`,
        },
        quiz: {
          form: 'choice',
          options: ['Oliver Cowdery', 'Martin Harris', 'Hyrum Smith', 'Sidney Rigdon'],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Die Offenbarung erging im April 1829 an Joseph Smith und Oliver Cowdery, ' +
            'der Joseph beim Übersetzen des Buches Mormon als Schreiber diente – so ' +
            'steht es in der Einleitung zu Lehre und Bündnisse 6.',
        },
      },
      {
        title: 'Schlag Josua 1:9 auf: Welche zwei Eigenschaften gebietet der Herr Josua?',
        body: 'Für Profis: Beide stehen in einer einzigen Aufforderung – kurz vor dem Einzug ins verheissene Land.',
        source: {
          label: 'Josua 1:9',
          url: `${SCRIPTURES}/ot/josh/1?lang=deu&id=p9#p9`,
        },
        quiz: {
          form: 'text',
          options: [],
          answerIndex: 0,
          answerText: 'Stark und mutig (sein)',
          explanation:
            '«Habe ich dir nicht befohlen: Sei stark und mutig? Fürchte dich also nicht ' +
            'und hab keine Angst; denn der HERR, dein Gott, ist mit dir überall, wo du ' +
            'unterwegs bist.» – Die Begründung ist der beste Teil des Gebots.',
        },
      },
    ],
    bilderraetsel: [
      {
        title: 'Welche Begebenheit zeigt dieses Bild?',
        body: 'Zum Aufwärmen: ein Wäldchen, helles Licht – und ein 14-Jähriger mit einer Frage.',
        source: {
          label: 'Joseph Smith – Lebensgeschichte 1:16–17',
          url: `${SCRIPTURES}/pgp/js-h/1?lang=deu&id=p16-p17#p16`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Die erste Vision',
            'Moronis Besuch im Schlafzimmer',
            'Die Taufe von Joseph Smith',
            'Die Wiederherstellung des Priestertums',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Im Frühjahr 1820 betete Joseph Smith im Wald bei seinem Elternhaus – und sah ' +
            'den Vater und den Sohn. Bild für dieses Rätsel: «Die erste Vision» aus der ' +
            'Mediathek der Kirche.',
        },
      },
      {
        title: 'In welcher Stadt steht dieser Tempel?',
        body: 'Schon schwieriger: An ihm wurde 40 Jahre lang gebaut.',
        source: { label: 'Tempel der Kirche', url: TEMPLES },
        quiz: {
          form: 'choice',
          options: ['Salt Lake City', 'Provo', 'St. George', 'Logan'],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Der Salt-Lake-Tempel wurde 1853 begonnen und 1893 geweiht – vierzig Jahre ' +
            'Bauzeit. Bild für dieses Rätsel: der Salt-Lake-Tempel aus der Mediathek der ' +
            'Kirche.',
        },
      },
      {
        title: 'Was zeigt dieses Bild aus dem Frühjahr 1829?',
        body: 'Für Profis: Ein Tisch, zwei junge Männer, ein Stapel Papier.',
        source: {
          label: 'Lehre und Bündnisse 6',
          url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu`,
        },
        quiz: {
          form: 'choice',
          options: [
            'Joseph Smith und Oliver Cowdery bei der Übersetzung des Buches Mormon',
            'Joseph und Hyrum im Gefängnis von Carthage',
            'Der Druck der ersten Auflage des Buches Mormon',
            'Die Gründung der Kirche 1830',
          ],
          answerIndex: 0,
          answerText: '',
          explanation:
            'Im April 1829 wurde Oliver Cowdery Josephs Schreiber; der grösste Teil des ' +
            'Buches Mormon wurde in den folgenden Wochen übersetzt. Bild für dieses ' +
            'Rätsel: «Joseph Smith und Oliver Cowdery bei der Übersetzung» aus der ' +
            'Mediathek der Kirche.',
        },
      },
    ],
    wochenziel: {
      title: 'Lern Lehre und Bündnisse 6:36 auswendig',
      body: 'Elf Worte für die Hosentasche – am Sonntag kannst du sie aufsagen.',
      source: {
        label: 'Lehre und Bündnisse 6:36',
        url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p36#p36`,
      },
    },
    tageschallenge: {
      title: 'Ein Satz am Abend: Wo hast du heute Gott gespürt?',
      body: 'Ein Notizbuch oder die Notizen-App genügt.',
    },
    frage: {
      title: 'Welcher Gedanke oder Vers hilft dir gegen Angst und Zweifel?',
      body: '',
    },
    teilen: {
      title:
        'Teile den Satz «Blickt in jedem Gedanken auf mich» mit einem Freund oder einer ' +
        'Freundin – und frag, was er für sie oder ihn bedeutet.',
      body: 'Eine Nachricht zählt auch. Danach darfst du hier abhaken.',
      source: {
        label: 'Lehre und Bündnisse 6:36',
        url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p36#p36`,
      },
    },
    feed: [
      {
        title:
          '«Denn Gott hat uns nicht einen Geist der Furchtsamkeit gegeben, sondern der Kraft und der Liebe und der Besonnenheit.»',
        body: 'Paulus an seinen jungen Mitarbeiter Timotheus – und an dich.',
        source: { label: '2 Timotheus 1:7', url: `${SCRIPTURES}/nt/2-tim/1?lang=deu&id=p7#p7` },
      },
      {
        title:
          'Wusstest du? Die 13 Glaubensartikel stammen aus einem Brief von Joseph Smith an einen Zeitungsredaktor.',
        body: 'Dem «Wentworth-Brief» von 1842 – als knappe Antwort auf die Frage, was wir glauben.',
        source: { label: 'Die Glaubensartikel', url: `${SCRIPTURES}/pgp/a-of-f/1?lang=deu` },
      },
      {
        title: '«Sei stark und mutig! … denn der HERR, dein Gott, ist mit dir überall, wo du unterwegs bist.»',
        body: 'Gottes Zuspruch an Josua – am Vorabend der grössten Aufgabe seines Lebens.',
        deepening:
          'Josua übernimmt die Führung von Mose – dem Mann, mit dem Gott «von Angesicht ' +
          'zu Angesicht» geredet hatte. Grössere Fussstapfen gibt es kaum. Dreimal sagt ' +
          'der Herr ihm in diesem Kapitel, er solle stark und mutig sein (Verse 6, 7 und ' +
          '9) – Mut braucht offenbar Wiederholung. Und die Begründung ist jedes Mal ' +
          'dieselbe: nicht «du schaffst das», sondern «ich bin mit dir».\n\n' +
          'Zum Weiterlesen:\n' +
          `Josua 1:5–9 – ${SCRIPTURES}/ot/josh/1?lang=deu&id=p5-p9#p5`,
        source: { label: 'Josua 1:9', url: `${SCRIPTURES}/ot/josh/1?lang=deu&id=p9#p9` },
      },
      {
        title: '«Seid guten Mutes und fürchtet euch nicht, denn ich, der Herr, bin mit euch und werde euch beistehen.»',
        body: 'Dasselbe Versprechen, 3000 Jahre später – in der Wiederherstellung.',
        source: {
          label: 'Lehre und Bündnisse 68:6',
          url: `${SCRIPTURES}/dc-testament/dc/68?lang=deu&id=p6#p6`,
        },
      },
      {
        title: 'Wusstest du? Oliver Cowdery war ungefähr 22, als er Josephs Schreiber wurde.',
        body: 'Die Offenbarung «zweifelt nicht, fürchtet euch nicht» galt einem jungen Erwachsenen.',
        deepening:
          'Oliver war Schullehrer und hatte von den Platten nur gehört. Er betete ' +
          'heimlich um Gewissheit – und bekam sie. Später erinnerte ihn der Herr genau ' +
          'daran: «Habe ich dir nicht Frieden in deinen Sinn geredet?» (LuB 6:23). Die ' +
          'grossen Aufgaben der Wiederherstellung lagen fast alle auf jungen Schultern – ' +
          'Joseph war 23, Oliver 22.\n\n' +
          'Zum Weiterlesen:\n' +
          `Lehre und Bündnisse 6:22–24 – ${SCRIPTURES}/dc-testament/dc/6?lang=deu&id=p22-p24#p22`,
        source: {
          label: 'Lehre und Bündnisse 6',
          url: `${SCRIPTURES}/dc-testament/dc/6?lang=deu`,
        },
      },
      {
        title: '«An dem Tag, da ich mich fürchte, setze ich auf dich mein Vertrauen.»',
        body: 'Der Psalmist rechnet mit Angst – und hat einen Plan für sie.',
        source: { label: 'Psalm 56:4', url: `${SCRIPTURES}/ot/ps/56?lang=deu&id=p4#p4` },
      },
      {
        title: '«Ich glaube; hilf meinem Unglauben!»',
        body: 'Das ehrlichste Gebet des Neuen Testaments – und es wurde erhört.',
        deepening:
          'Ein Vater bittet Jesus, seinen Sohn zu heilen: «Wenn du kannst, hilf uns!» ' +
          'Jesus greift die Worte auf: «Alles kann, wer glaubt.» Da ruft der Vater den ' +
          'Satz, der beides zugleich ist – Bekenntnis und Bitte. Glaube muss nicht ' +
          'fertig sein, um zu zählen; er muss nur ehrlich sein und wachsen wollen.\n\n' +
          'Zum Weiterlesen:\n' +
          `Markus 9:23–24 – ${SCRIPTURES}/nt/mark/9?lang=deu&id=p23-p24#p23`,
        source: { label: 'Markus 9:24', url: `${SCRIPTURES}/nt/mark/9?lang=deu&id=p24#p24` },
      },
      {
        title: 'Wusstest du? «Fürchte dich nicht» gehört zu den häufigsten Zusprüchen der Schriften.',
        body: 'Von Abraham über Josua bis zu den Hirten von Betlehem – Gott beginnt oft genau so.',
        source: { label: 'Lukas 2:10', url: `${SCRIPTURES}/nt/luke/2?lang=deu&id=p10#p10` },
      },
      {
        title: 'Zum Nachdenken: Was hilft dir, tagsüber «in jedem Gedanken» an ihn zu denken?',
        body: 'Ein Zettel am Spiegel? Der Sperrbildschirm? Finde deinen Anker.',
      },
      {
        title: 'Zum Nachdenken: «Zweifelt nicht, fürchtet euch nicht» – welcher der beiden Sätze ist gerade deiner?',
        body: 'Und wem könntest du davon erzählen?',
      },
    ],
  },

  /* ---------------- Woche 4: Almas Samenkorn ---------------- */
  {
    impuls: {
      title: 'Hoffen auf das, was wahr ist',
      body:
        'Alma erklärt, was Glaube ist: keine vollkommene Erkenntnis, sondern hoffen ' +
        'auf das, was nicht gesehen wird, was aber wahr ist. Das ist keine Schwäche, ' +
        'sondern ein Anfang – wie ein Experiment, das man wagt.',
      deepening:
        'Alma nimmt dem Anfang die Schwere: Es genügt, wenn ihr «nichts weiter als den ' +
        'Wunsch habt zu glauben» – lasst diesen Wunsch nur wirken (Alma 32:27). Und das ' +
        'Experiment hat ein Ziel: Wer das Samenkorn geduldig nährt, erntet eine Frucht, ' +
        'die «süss ist über alles, was süss ist» (Alma 32:41–42). Glaube ist bei Alma kein ' +
        'Zustand, sondern eine Pflege.\n\n' +
        'Zum Weiterlesen:\n' +
        `Alma 32:27 – ${SCRIPTURES}/bofm/alma/32?lang=deu&id=p27#p27\n` +
        `Alma 32:41–43 – ${SCRIPTURES}/bofm/alma/32?lang=deu&id=p41-p43#p41`,
      source: {
        label: 'Alma 32:21',
        url: `${SCRIPTURES}/bofm/alma/32?lang=deu&id=p21#p21`,
      },
    },
    quiz: [
      {
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
    ],
    bilderraetsel: [],
    wochenziel: {
      title: 'Erzähl jemandem von Almas Samenkorn',
      body:
        'Familie, Kollege, Mitschülerin – erklär das Experiment aus Alma 32 in ' +
        'deinen eigenen Worten.',
      source: { label: 'Alma 32', url: `${SCRIPTURES}/bofm/alma/32?lang=deu` },
    },
    tageschallenge: {
      title: 'Lies jeden Tag einen Vers in Alma 32',
      body: 'Sieben Tage, sieben Verse – das Kapitel trägt dich durch die Woche.',
      source: { label: 'Alma 32', url: `${SCRIPTURES}/bofm/alma/32?lang=deu` },
    },
    frage: {
      title: 'Wo hast du erlebt, dass aus einem kleinen Samenkorn des Glaubens etwas gewachsen ist?',
      body: 'Ein kleines Erlebnis zählt genauso wie ein grosses.',
    },
    teilen: {
      title:
        'Frag ein Familienmitglied oder einen Freund: Wo hat dein Glaube einmal ganz klein ' +
        'angefangen – und was ist daraus geworden?',
      body: 'Geschichten wie diese vergisst man nicht. Danach darfst du hier abhaken.',
      source: { label: 'Alma 32', url: `${SCRIPTURES}/bofm/alma/32?lang=deu` },
    },
    feed: [
      {
        title: '«Ihr empfangt keinen Zeugen, ehe euer Glaube nicht geprüft ist.»',
        body: 'Erst der Schritt, dann die Gewissheit – nicht umgekehrt.',
        source: { label: 'Ether 12:6', url: `${SCRIPTURES}/bofm/ether/12?lang=deu&id=p6#p6` },
      },
      {
        title: 'Wusstest du? Almas Samenkorn-Rede galt Menschen, die man hinausgeworfen hatte.',
        body:
          'Die Zoramiten durften wegen ihrer Armut nicht in die Synagogen – gerade ihnen ' +
          'traute Alma das Experiment des Glaubens zu.',
        source: { label: 'Alma 32:2–5', url: `${SCRIPTURES}/bofm/alma/32?lang=deu&id=p2-p5#p2` },
      },
      {
        title: 'Zum Nachdenken: Welchem kleinen Samenkorn gibst du diese Woche Platz?',
        body: 'Und wie nährst du es?',
      },
    ],
  },
]

/** Was das Startpaket anlegen will – ein Inhalt mit fester Dokument-ID. */
export interface StarterPlan {
  /** Feste ID («starter-w1-impuls») – ein zweiter Lauf erzeugt keine Dubletten. */
  id: string
  week: string | null
  kind: ImpulseKind
  /** Alles «bereit» – ausser den Bilderrätseln: Ihnen fehlt noch das Bild. */
  status: ImpulseStatus
  title: string
  body: string
  /** Die Vertiefung – die zweite Seite der Karte im Vollbild-Feed. */
  deepening: string | null
  /** Platz innerhalb der Art – an Feed-Karten, Quizfragen und Rätseln. */
  order: number | null
  source: ImpulseSource | null
  quiz: ImpulseQuiz | null
}

/** Die Einzel-Arten, die das Paket je Woche mitbringt – in Lesereihenfolge. */
const SINGLE_KINDS = ['impuls', 'wochenziel', 'tageschallenge', 'frage', 'teilen'] as const

/**
 * Verteilt das Startpaket auf die laufende und die nächsten drei Wochen.
 *
 * Zwei Rücksichten auf das, was schon da ist: Ein Inhalt, dessen feste ID
 * bereits existiert, wird gar nicht erst geplant – so holt ein späterer
 * Lauf nur nach, was fehlt (etwa die neuen Karten, wenn das Paket in
 * einer früheren, kleineren Fassung eingespielt wurde), ohne Bearbeitetes
 * zu überschreiben. Und ein Einzel-Platz, den die Redaktion selbst belegt
 * hat (gleiche Woche, gleiche Art), bleibt unangetastet – der betreffende
 * Inhalt geht stattdessen in den Fragenpool (`week: null`) und kann von
 * Hand geplant werden. Die Arten mit mehreren Karten (Quiz, Bilderrätsel,
 * Feed) kennen keinen belegten Platz: Eigene Karten der Redaktion und die
 * des Pakets vertragen sich nebeneinander – die Reihenfolge sagt `order`.
 *
 * Die Bilderrätsel werden als **Entwurf** geplant: Ihr Bild muss die
 * Redaktion aus der Mediathek der Kirche ergänzen (die Auflösung sagt,
 * welches gemeint ist) – erst dann werden sie von Hand «bereit».
 */
export function planStarterItems(
  existing: Pick<ImpulseItem, 'id' | 'week' | 'kind'>[],
  todayKey: string,
): StarterPlan[] {
  const existingIds = new Set(existing.map((item) => item.id))
  const taken = new Set(
    existing
      .filter((item) => typeof item.week === 'string')
      .map((item) => `${item.week}·${item.kind}`),
  )

  const plans: StarterPlan[] = []
  const push = (
    id: string,
    week: string | null,
    kind: ImpulseKind,
    status: ImpulseStatus,
    content: StarterContent,
    order: number | null,
  ) => {
    if (existingIds.has(id)) return
    plans.push({
      id,
      week,
      kind,
      status,
      title: content.title,
      body: content.body,
      deepening: content.deepening ?? null,
      order,
      source: content.source ?? null,
      quiz: content.quiz ?? null,
    })
  }

  for (const [index, starter] of STARTER_WEEKS.entries()) {
    const week = weekKeyOffset(todayKey, index)

    for (const kind of SINGLE_KINDS) {
      const free = week !== null && !taken.has(`${week}·${kind}`)
      push(`starter-w${index + 1}-${kind}`, free ? week : null, kind, 'ready', starter[kind], null)
    }

    for (const [quizIndex, content] of starter.quiz.entries()) {
      // Die erste Quizfrage behält ihre alte ID – ein früher eingespieltes
      // Paket bekommt so genau die neuen Fragen dazu, ohne Dubletten.
      const id =
        quizIndex === 0
          ? `starter-w${index + 1}-quiz`
          : `starter-w${index + 1}-quiz-${quizIndex + 1}`
      push(id, week, 'quiz', 'ready', content, quizIndex + 1)
    }

    for (const [riddleIndex, content] of starter.bilderraetsel.entries()) {
      push(
        `starter-w${index + 1}-bild-${riddleIndex + 1}`,
        week,
        'bilderraetsel',
        'draft',
        content,
        riddleIndex + 1,
      )
    }

    for (const [cardIndex, card] of starter.feed.entries()) {
      push(`starter-w${index + 1}-feed-${cardIndex + 1}`, week, 'feed', 'ready', card, cardIndex + 1)
    }
  }
  return plans
}

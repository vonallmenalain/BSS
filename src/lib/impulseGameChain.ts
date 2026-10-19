/*
 * «Ketten sprengen» – das Minispiel zur Woche «Die Wahrheit befreit
 * dich», ohne Leinwand: welche Fragen kommen, wie viel Zeit bleibt und
 * was eine Antwort bewirkt.
 *
 * Jemand fragt etwas – Mama, die Lehrerin, der Trainer –, und zur Wahl
 * stehen eine ehrliche Antwort und eine Notlüge («Schon erledigt», «Hatte
 * kein Netz», «Der Hund war’s»); ab der zehnten Frage sind es zwei
 * Notlügen. Um die Figur in der Mitte legt sich dabei eine Schnur, die
 * mit der Zeit zum Strick und zur Kette wird: Wer ehrlich antwortet,
 * solange sie eine Schnur ist, bekommt drei Punkte, als Strick zwei, als
 * Kette noch einen. Eine Notlüge oder zu langes Zögern lässt sie
 * zuschnappen – ein Leben weniger; drei gibt es. Fünf ehrliche Antworten
 * am Stück bringen den Schlüssel: Er sprengt eine Kette und gibt ein
 * Leben zurück (wer keines verloren hat, bekommt Punkte). Eine Runde
 * dauert eine Minute (`CHAIN_ROUND_S`).
 *
 * Warum so und nicht schneller: Das Spiel lebt davon, dass man liest.
 * Die ersten Fragen lassen sieben Sekunden, danach wird es langsam
 * knapper, aber nie unter drei (`chainLife`) – wer die Antworten nur
 * überfliegt, tippt bald die Notlüge. Wildes Tippen lohnt sich nicht:
 * Jede falsche Antwort kostet ein Leben. Und weil die Uhr nach einer
 * Minute abläuft, trennt die Rangliste trotzdem: Wer schneller ehrlich
 * antwortet, schafft mehr Fragen und mehr Punkte je Frage.
 *
 * Das Bild dahinter: Der Widersacher führt mit einer dünnen Schnur, bis
 * er mit starken Stricken bindet (vgl. 2 Nephi 26:22) – kleine Lügen
 * wachsen. Und Jesus: Die Wahrheit wird euch frei machen (Johannes 8:32).
 * Die Tages-Challenge derselben Woche heisst «Sieben Tage ohne Notlüge».
 *
 * Gezeichnet wird in `components/impulse/game/chainGame`; die Regeln
 * stehen hier, damit `tests/impulse-game.test.ts` eine Runde mit einem
 * nachgebildeten Spieler durchspielen kann – mit genau diesem Code.
 */

export interface ChainSituation {
  /** Wer fragt – als Emoji und Wort. */
  emoji: string
  who: string
  question: string
  /** Die ehrliche Antwort – freundlich, nicht brutal. */
  honest: string
  /** Notlügen, die man sich gut vorstellen kann – mindestens zwei. */
  lies: readonly string[]
}

/** Die Situationen – alltäglich, jede mit einer ehrlichen Antwort und zwei Notlügen. */
export const CHAIN_SITUATIONS: readonly ChainSituation[] = [
  {
    emoji: '👩',
    who: 'Mama',
    question: 'Hast du dein Zimmer aufgeräumt?',
    honest: 'Noch nicht – mach ich jetzt',
    lies: ['Schon erledigt', 'Fast fertig'],
  },
  {
    emoji: '💬',
    who: 'Freundin',
    question: 'Wo bleibst du?',
    honest: 'Bin spät dran – noch 15 Minuten',
    lies: ['Bin gleich da', 'Stecke im Stau'],
  },
  {
    emoji: '👩‍🏫',
    who: 'Lehrerin',
    question: 'Wo sind deine Hausaufgaben?',
    honest: 'Hab ich nicht gemacht',
    lies: ['Der Hund war’s', 'Zu Hause vergessen'],
  },
  {
    emoji: '👨',
    who: 'Papa',
    question: 'Warum hast du nicht abgenommen?',
    honest: 'Ich wollte fertig zocken',
    lies: ['Hatte kein Netz', 'Akku war leer'],
  },
  {
    emoji: '👧',
    who: 'Schwester',
    question: 'Wer hat meine Schokolade gegessen?',
    honest: 'Ich – sorry, ich kauf dir neue',
    lies: ['War nicht ich', 'Keine Ahnung'],
  },
  {
    emoji: '🧢',
    who: 'Trainer',
    question: 'Warum warst du nicht im Training?',
    honest: 'Ich hatte keine Lust',
    lies: ['Mir war schlecht', 'Hatte einen Termin'],
  },
  {
    emoji: '👵',
    who: 'Oma',
    question: 'Hast du meine Nachricht gesehen?',
    honest: 'Ja – hab vergessen zu antworten',
    lies: ['Hab’s nicht gesehen', 'Hatte kein WLAN'],
  },
  {
    emoji: '🧑',
    who: 'Kollege',
    question: 'Hast du nicht gehört, dass ich rufe?',
    honest: 'Doch – ich war genervt',
    lies: ['Nicht gehört', 'Hatte Kopfhörer drin'],
  },
  {
    emoji: '👦',
    who: 'Bruder',
    question: 'Hast du meinen Controller kaputt gemacht?',
    honest: 'Ja, er ist mir runtergefallen',
    lies: ['War schon so', 'Weiss nicht'],
  },
  {
    emoji: '👨‍🏫',
    who: 'Lehrer',
    question: 'Hast du bei der Prüfung abgeschrieben?',
    honest: 'Ja. Das war falsch.',
    lies: ['Nein, nie!', 'Wir haben nur verglichen'],
  },
  {
    emoji: '🧾',
    who: 'Kassierin',
    question: 'Stimmt das Rückgeld?',
    honest: 'Nein – Sie gaben mir zu viel',
    lies: ['Ja, stimmt so', 'Passt schon'],
  },
  {
    emoji: '🕚',
    who: 'Mama',
    question: 'Wann bist du gestern heimgekommen?',
    honest: 'Um halb zwölf – eine Stunde zu spät',
    lies: ['Um zehn, wie abgemacht', 'Kurz nach zehn'],
  },
  {
    emoji: '📖',
    who: 'Leiter',
    question: 'Hast du diese Woche in den Schriften gelesen?',
    honest: 'Diese Woche nicht',
    lies: ['Klar, jeden Tag', 'Ja, ganz viel'],
  },
  {
    emoji: '🗑️',
    who: 'Papa',
    question: 'Hast du den Müll rausgebracht?',
    honest: 'Nein, vergessen – mach ich sofort',
    lies: ['Schon erledigt', 'Der war noch nicht voll'],
  },
  {
    emoji: '🎂',
    who: 'Freundin',
    question: 'Hast du meinen Geburtstag vergessen?',
    honest: 'Ja – tut mir echt leid!',
    lies: ['Nein, das Geschenk kommt noch', 'Ich wollte dich überraschen'],
  },
  {
    emoji: '📱',
    who: 'Mama',
    question: 'Wie lange warst du heute am Handy?',
    honest: 'Ehrlich gesagt: drei Stunden',
    lies: ['Höchstens eine halbe Stunde', 'Kaum'],
  },
]

/** Drei Leben – der Schlüssel gibt eines zurück. */
export const CHAIN_LIVES = 3
/** Eine Runde dauert eine Minute. */
export const CHAIN_ROUND_S = 60
/** So viele ehrliche Antworten am Stück bringen den Schlüssel. */
export const CHAIN_STREAK_FOR_KEY = 5
/** Punkte für den Schlüssel, wenn kein Leben fehlt. */
export const CHAIN_KEY_BONUS = 5
/** Ab dieser Frage (von 0 gezählt) stehen zwei Notlügen zur Wahl. */
export const CHAIN_THREE_FROM = 9

export const CHAIN_PACE = {
  /** Bis zur ersten Frage – kurz Luft holen. */
  lead: 0.8,
  /** Zeit je Frage: am Anfang so viel … */
  lifeStart: 7,
  /** … und nie weniger als so viel – lesen muss man immer können. */
  lifeMin: 3,
  /** Wie schnell sie von der einen zur anderen sinkt (in Fragen). */
  lifeDecay: 8,
  /** So lange steht das Ergebnis einer ehrlichen Antwort, bevor die nächste Frage kommt … */
  afterHonest: 0.65,
  /** … und so lange nach einer Notlüge oder zu langem Zögern: Die ehrliche Antwort leuchtet. */
  afterWrong: 1.6,
} as const

/** Sekunden für die Frage Nummer `index` (von 0 gezählt): 7 am Anfang, nie unter 3. */
export function chainLife(index: number): number {
  const p = CHAIN_PACE
  return p.lifeMin + (p.lifeStart - p.lifeMin) * Math.exp(-Math.max(0, index) / p.lifeDecay)
}

/** Schnur, Strick, Kette – je früher ehrlich geantwortet, desto mehr Punkte. */
export type ChainStage = 0 | 1 | 2

export function chainStage(age: number, life: number): ChainStage {
  const k = life > 0 ? age / life : 1
  return k < 1 / 3 ? 0 : k < 2 / 3 ? 1 : 2
}

export function chainPoints(age: number, life: number): number {
  return 3 - chainStage(age, life)
}

export interface ChainOption {
  text: string
  honest: boolean
}

export interface ChainQuestion {
  id: number
  /** Die wievielte Frage der Runde – von 0 gezählt. */
  index: number
  situation: ChainSituation
  /** Die Antworten in der Reihenfolge der Knöpfe – die ehrliche irgendwo dazwischen. */
  options: ChainOption[]
  /** Rundensekunde, in der sie gestellt wurde. */
  spawn: number
  /** So viele Sekunden, bis die Schnur zur Kette wird. */
  life: number
}

/** Was nach einer Antwort kurz stehen bleibt. */
export interface ChainVerdict {
  question: ChainQuestion
  /** Welcher Knopf – `null`, wenn die Zeit ablief. */
  picked: number | null
  honest: boolean
  /** Bis zu dieser Rundensekunde – dann kommt die nächste Frage. */
  until: number
}

export type ChainEvent =
  /** Eine neue Frage. */
  | { kind: 'ask'; question: ChainQuestion }
  /** Ehrlich geantwortet – drei, zwei oder ein Punkt. */
  | { kind: 'honest'; question: ChainQuestion; option: number; points: number; streak: number }
  /** Fünf am Stück: Der Schlüssel sprengt eine Kette – ein Leben zurück oder Punkte. */
  | { kind: 'key'; healed: boolean; bonus: number }
  /** Die Notlüge gewählt – ein Leben weniger. */
  | { kind: 'lie'; question: ChainQuestion; option: number }
  /** Zu lange gezögert – ein Leben weniger. */
  | { kind: 'timeout'; question: ChainQuestion }
  /** Die Runde ist vorbei – ohne Leben oder weil die Minute um ist. */
  | { kind: 'over'; reason: 'lives' | 'time' }

/**
 * Eine Runde «Ketten sprengen». `pick` ist ein Tipp auf einen Knopf,
 * `step` rechnet die Zeit weiter. Beide melden, was geschehen ist –
 * dieselbe Liste bei jedem Aufruf, also gleich lesen.
 */
export class ChainRound {
  time = 0
  points = 0
  lives = CHAIN_LIVES
  over = false
  /** Ehrliche Antworten am Stück, seit dem letzten Fehler. */
  streak = 0
  /** Wie viele Fragen gestellt wurden. */
  asked = 0
  /** Wie viele davon ehrlich beantwortet. */
  honest = 0
  /** Die offene Frage – `null` dazwischen. */
  question: ChainQuestion | null = null
  /** Die zuletzt beantwortete Frage, solange ihr Ergebnis steht. */
  verdict: ChainVerdict | null = null

  private readonly random: () => number
  private nextAsk: number = CHAIN_PACE.lead
  private nextId = 1
  /** Die Situationen, die noch nicht dran waren – erst wenn alle durch sind, beginnt es von vorn. */
  private bag: ChainSituation[] = []
  private lastSituation: ChainSituation | null = null
  private readonly out: ChainEvent[] = []

  constructor(random: () => number) {
    this.random = random
  }

  /** Ein Tipp auf den Knopf `option` der offenen Frage. */
  pick(option: number): readonly ChainEvent[] {
    this.out.length = 0
    const question = this.question
    if (this.over || !question || option < 0 || option >= question.options.length) return this.out
    this.question = null
    if (question.options[option].honest) {
      const points = chainPoints(this.time - question.spawn, question.life)
      this.points += points
      this.streak += 1
      this.honest += 1
      this.out.push({ kind: 'honest', question, option, points, streak: this.streak })
      if (this.streak % CHAIN_STREAK_FOR_KEY === 0) {
        const healed = this.lives < CHAIN_LIVES
        if (healed) this.lives += 1
        else this.points += CHAIN_KEY_BONUS
        this.out.push({ kind: 'key', healed, bonus: healed ? 0 : CHAIN_KEY_BONUS })
      }
      this.settle(question, option, true, CHAIN_PACE.afterHonest)
    } else {
      this.out.push({ kind: 'lie', question, option })
      this.settle(question, option, false, CHAIN_PACE.afterWrong)
      this.lose()
    }
    return this.out
  }

  step(dt: number): readonly ChainEvent[] {
    this.out.length = 0
    if (this.over) return this.out
    this.time += dt
    if (this.time >= CHAIN_ROUND_S) {
      this.time = CHAIN_ROUND_S
      this.end('time')
      return this.out
    }
    const question = this.question
    if (question && this.time - question.spawn >= question.life) {
      this.question = null
      this.out.push({ kind: 'timeout', question })
      this.settle(question, null, false, CHAIN_PACE.afterWrong)
      this.lose()
      if (this.over) return this.out
    }
    if (this.verdict && this.time >= this.verdict.until) this.verdict = null
    if (!this.question && !this.verdict && this.time >= this.nextAsk) this.ask()
    return this.out
  }

  private settle(question: ChainQuestion, picked: number | null, honest: boolean, pause: number) {
    this.verdict = { question, picked, honest, until: this.time + pause }
    this.nextAsk = this.time + pause
  }

  private lose() {
    this.lives -= 1
    this.streak = 0
    if (this.lives <= 0) this.end('lives')
  }

  private end(reason: 'lives' | 'time') {
    this.over = true
    this.question = null
    this.out.push({ kind: 'over', reason })
  }

  /** Die nächste Frage – eine Situation aus dem Beutel, die Antworten gemischt. */
  private ask() {
    if (this.bag.length === 0) {
      this.bag = shuffle([...CHAIN_SITUATIONS], this.random)
      // Nie dieselbe zweimal am Stück, auch nicht über die Runde durch den Beutel hinweg.
      if (this.bag.length > 1 && this.bag[this.bag.length - 1] === this.lastSituation) {
        ;[this.bag[0], this.bag[this.bag.length - 1]] = [this.bag[this.bag.length - 1], this.bag[0]]
      }
    }
    const situation = this.bag.pop()!
    this.lastSituation = situation
    const index = this.asked
    const lies = shuffle([...situation.lies], this.random).slice(0, index >= CHAIN_THREE_FROM ? 2 : 1)
    const options = shuffle(
      [{ text: situation.honest, honest: true }, ...lies.map((text) => ({ text, honest: false }))],
      this.random,
    )
    const question: ChainQuestion = {
      id: this.nextId,
      index,
      situation,
      options,
      spawn: this.time,
      life: chainLife(index),
    }
    this.nextId += 1
    this.asked += 1
    this.question = question
    this.out.push({ kind: 'ask', question })
  }
}

/** Fisher–Yates mit dem Zufall der Runde – in den Prüfungen fest. */
function shuffle<T>(list: T[], random: () => number): T[] {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1)) % (index + 1)
    ;[list[index], list[other]] = [list[other], list[index]]
  }
  return list
}

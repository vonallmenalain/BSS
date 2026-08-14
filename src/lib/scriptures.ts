/*
 * Schriftstellen-Angaben in Links zur Evangeliumsbibliothek übersetzen.
 *
 * «1 Nephi 3:7» soll von allein zu
 * https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=deu&id=p7#p7
 * werden – derselbe Aufbau, nach dem auch das Startpaket seine Links von
 * Hand gebaut hat (`lib/impulseStarter`): Werk, Buch-Kürzel, Kapitel,
 * und die Verse als `id=p7-p9#p7`, Sprache Deutsch. Das Kartenformular
 * bietet den errechneten Link als Ein-Tipp-Vorschlag an, sobald die
 * Quelle wie eine Schriftstelle aussieht – niemand muss Adressen
 * abtippen, und niemandem wird ungefragt etwas ins Feld geschrieben.
 *
 * Verstanden werden die deutschen Buchnamen aller heiligen Schriften
 * (Einheitsübersetzung, wie sie die Kirche verwendet), gängige
 * Schreibweisen («LuB», «Mosia»/«Mosiah», «Sprüche»/«Sprichwörter»),
 * Kapitel («Alma 32»), Kapitelbereiche («Matthäus 5–7», verlinkt wird
 * das erste Kapitel), Verse («Alma 32:21») und Versbereiche
 * («1 Nephi 3:2–4») – dazu die Glaubensartikel («4. Glaubensartikel»).
 * Alles andere gibt still `null`: lieber kein Vorschlag als ein
 * falscher. Geprüft in `tests/scriptures.test.ts` – unter anderem
 * gegen jeden Schriften-Link des Startpakets.
 */

const SCRIPTURES = 'https://www.churchofjesuschrist.org/study/scriptures'

/** Werk und Buch-Kürzel, wie die Adressen der Kirche sie erwarten. */
interface ScriptureBook {
  work: 'ot' | 'nt' | 'bofm' | 'dc-testament' | 'pgp'
  slug: string
}

/*
 * Die Namen, unter denen ein Buch erkannt wird – normalisiert
 * (Kleinschreibung, einfache Leerzeichen, «-» statt Gedankenstrich,
 * ohne Punkte). Je Eintrag: alle Schreibweisen, dann das Ziel.
 */
const BOOKS: [string[], ScriptureBook][] = [
  /* ---------------- Buch Mormon ---------------- */
  [['1 nephi', '1 ne'], { work: 'bofm', slug: '1-ne' }],
  [['2 nephi', '2 ne'], { work: 'bofm', slug: '2-ne' }],
  [['jakob'], { work: 'bofm', slug: 'jacob' }],
  [['enos'], { work: 'bofm', slug: 'enos' }],
  [['jarom'], { work: 'bofm', slug: 'jarom' }],
  [['omni'], { work: 'bofm', slug: 'omni' }],
  [['worte mormons'], { work: 'bofm', slug: 'w-of-m' }],
  [['mosia', 'mosiah'], { work: 'bofm', slug: 'mosiah' }],
  [['alma'], { work: 'bofm', slug: 'alma' }],
  [['helaman'], { work: 'bofm', slug: 'hel' }],
  [['3 nephi', '3 ne'], { work: 'bofm', slug: '3-ne' }],
  [['4 nephi', '4 ne'], { work: 'bofm', slug: '4-ne' }],
  [['mormon'], { work: 'bofm', slug: 'morm' }],
  [['ether'], { work: 'bofm', slug: 'ether' }],
  [['moroni'], { work: 'bofm', slug: 'moro' }],

  /* ---------------- Lehre und Bündnisse ---------------- */
  [['lehre und bündnisse', 'lehre und buendnisse', 'lub'], { work: 'dc-testament', slug: 'dc' }],

  /* ---------------- Köstliche Perle ---------------- */
  [['mose'], { work: 'pgp', slug: 'moses' }],
  [['abraham'], { work: 'pgp', slug: 'abr' }],
  [['joseph smith - matthäus', 'joseph smith - matthaeus'], { work: 'pgp', slug: 'js-m' }],
  [['joseph smith - lebensgeschichte'], { work: 'pgp', slug: 'js-h' }],

  /* ---------------- Neues Testament ---------------- */
  [['matthäus', 'matthaeus'], { work: 'nt', slug: 'matt' }],
  [['markus'], { work: 'nt', slug: 'mark' }],
  [['lukas'], { work: 'nt', slug: 'luke' }],
  [['johannes'], { work: 'nt', slug: 'john' }],
  [['apostelgeschichte'], { work: 'nt', slug: 'acts' }],
  [['römer', 'roemer'], { work: 'nt', slug: 'rom' }],
  [['1 korinther'], { work: 'nt', slug: '1-cor' }],
  [['2 korinther'], { work: 'nt', slug: '2-cor' }],
  [['galater'], { work: 'nt', slug: 'gal' }],
  [['epheser'], { work: 'nt', slug: 'eph' }],
  [['philipper'], { work: 'nt', slug: 'philip' }],
  [['kolosser'], { work: 'nt', slug: 'col' }],
  [['1 thessalonicher'], { work: 'nt', slug: '1-thes' }],
  [['2 thessalonicher'], { work: 'nt', slug: '2-thes' }],
  [['1 timotheus'], { work: 'nt', slug: '1-tim' }],
  [['2 timotheus'], { work: 'nt', slug: '2-tim' }],
  [['titus'], { work: 'nt', slug: 'titus' }],
  [['philemon'], { work: 'nt', slug: 'philem' }],
  [['hebräer', 'hebraeer'], { work: 'nt', slug: 'heb' }],
  [['jakobus'], { work: 'nt', slug: 'james' }],
  [['1 petrus'], { work: 'nt', slug: '1-pet' }],
  [['2 petrus'], { work: 'nt', slug: '2-pet' }],
  [['1 johannes'], { work: 'nt', slug: '1-jn' }],
  [['2 johannes'], { work: 'nt', slug: '2-jn' }],
  [['3 johannes'], { work: 'nt', slug: '3-jn' }],
  [['judas'], { work: 'nt', slug: 'jude' }],
  [['offenbarung'], { work: 'nt', slug: 'rev' }],

  /* ---------------- Altes Testament ---------------- */
  [['genesis', '1 mose'], { work: 'ot', slug: 'gen' }],
  [['exodus', '2 mose'], { work: 'ot', slug: 'ex' }],
  [['levitikus', '3 mose'], { work: 'ot', slug: 'lev' }],
  [['numeri', '4 mose'], { work: 'ot', slug: 'num' }],
  [['deuteronomium', '5 mose'], { work: 'ot', slug: 'deut' }],
  [['josua'], { work: 'ot', slug: 'josh' }],
  [['richter'], { work: 'ot', slug: 'judg' }],
  [['rut'], { work: 'ot', slug: 'ruth' }],
  [['1 samuel'], { work: 'ot', slug: '1-sam' }],
  [['2 samuel'], { work: 'ot', slug: '2-sam' }],
  [['1 könige', '1 koenige'], { work: 'ot', slug: '1-kgs' }],
  [['2 könige', '2 koenige'], { work: 'ot', slug: '2-kgs' }],
  [['1 chronik'], { work: 'ot', slug: '1-chr' }],
  [['2 chronik'], { work: 'ot', slug: '2-chr' }],
  [['esra'], { work: 'ot', slug: 'ezra' }],
  [['nehemia'], { work: 'ot', slug: 'neh' }],
  [['ester'], { work: 'ot', slug: 'esth' }],
  [['ijob', 'hiob'], { work: 'ot', slug: 'job' }],
  [['psalm', 'psalmen'], { work: 'ot', slug: 'ps' }],
  [['sprichwörter', 'sprichwoerter', 'sprüche', 'sprueche'], { work: 'ot', slug: 'prov' }],
  [['kohelet', 'prediger'], { work: 'ot', slug: 'eccl' }],
  [['hoheslied', 'hohelied'], { work: 'ot', slug: 'song' }],
  [['jesaja'], { work: 'ot', slug: 'isa' }],
  [['jeremia'], { work: 'ot', slug: 'jer' }],
  [['klagelieder'], { work: 'ot', slug: 'lam' }],
  [['ezechiel', 'hesekiel'], { work: 'ot', slug: 'ezek' }],
  [['daniel'], { work: 'ot', slug: 'dan' }],
  [['hosea'], { work: 'ot', slug: 'hosea' }],
  [['joel'], { work: 'ot', slug: 'joel' }],
  [['amos'], { work: 'ot', slug: 'amos' }],
  [['obadja'], { work: 'ot', slug: 'obad' }],
  [['jona'], { work: 'ot', slug: 'jonah' }],
  [['micha'], { work: 'ot', slug: 'micah' }],
  [['nahum'], { work: 'ot', slug: 'nahum' }],
  [['habakuk'], { work: 'ot', slug: 'hab' }],
  [['zefanja'], { work: 'ot', slug: 'zeph' }],
  [['haggai'], { work: 'ot', slug: 'hag' }],
  [['sacharja'], { work: 'ot', slug: 'zech' }],
  [['maleachi'], { work: 'ot', slug: 'mal' }],
]

/** «Joseph Smith – Lebensgeschichte» → «joseph smith - lebensgeschichte». */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/*
 * Was nach dem Buchnamen kommen darf: Kapitel, Kapitelbereich,
 * Vers und Versbereich – «3», «5-7», «3:7», «3:2-4».
 */
const REFERENCE = /^(\d+)(?:\s*-\s*\d+)?(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?$/

/**
 * Der Link zur Schriftstelle – oder `null`, wenn die Angabe keine ist.
 *
 * `null` heisst nur: kein Vorschlag. Eine Quelle wie «Generalkonferenz
 * Okt. 2025» ist völlig in Ordnung – sie bekommt bloss keinen
 * errechneten Link.
 */
export function scriptureLink(label: string): string | null {
  const text = normalize(label)
  if (!text) return null

  /* Die Glaubensartikel zählen ihre Artikel als Verse eines Kapitels:
     «4. Glaubensartikel» und «Glaubensartikel 4» führen zu Artikel 4,
     «Die Glaubensartikel» zur ganzen Seite. */
  const article =
    /^(\d+)(?:ter)? glaubensartikel$/.exec(text) ?? /^glaubensartikel (\d+)$/.exec(text)
  if (article) {
    const n = Number(article[1])
    if (n >= 1 && n <= 13) return `${SCRIPTURES}/pgp/a-of-f/1?lang=deu&id=p${n}#p${n}`
    return null
  }
  if (text === 'glaubensartikel' || text === 'die glaubensartikel') {
    return `${SCRIPTURES}/pgp/a-of-f/1?lang=deu`
  }

  /* Das längste passende Buch gewinnt – «Joseph Smith – Matthäus» darf
     nie beim blossen «Matthäus» hängen bleiben. */
  let best: { book: ScriptureBook; rest: string; length: number } | null = null
  for (const [names, book] of BOOKS) {
    for (const name of names) {
      if (!text.startsWith(`${name} `)) continue
      if (best === null || name.length > best.length) {
        best = { book, rest: text.slice(name.length).trim(), length: name.length }
      }
    }
  }
  if (!best || !best.rest) return null

  const parts = REFERENCE.exec(best.rest)
  if (!parts) return null
  const chapter = Number(parts[1])
  if (!Number.isFinite(chapter) || chapter < 1) return null
  const verse = parts[2] ? Number(parts[2]) : null
  const verseEnd = parts[3] ? Number(parts[3]) : null
  if (verse !== null && verseEnd !== null && verseEnd <= verse) return null

  const base = `${SCRIPTURES}/${best.book.work}/${best.book.slug}/${chapter}?lang=deu`
  if (verse === null) return base
  const range = verseEnd !== null ? `p${verse}-p${verseEnd}` : `p${verse}`
  return `${base}&id=${range}#p${verse}`
}

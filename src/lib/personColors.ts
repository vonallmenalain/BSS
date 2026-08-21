import { roleRank, type AppUser, type Role } from './types.ts'

/**
 * Wer welchen Farbton trägt.
 *
 * Bis anhin entschied das allein eine Quersumme über die Kennung: gleiche
 * Kennung, gleicher Ton – und bei acht Tönen und sechs Konten mit ziemlicher
 * Sicherheit irgendwann zweimal derselbe. Zwei Kreise in Bernstein
 * nebeneinander sind aber genau das, was die Farbe verhindern soll: Sie ist
 * dazu da, eine Person auf einen Blick wiederzuerkennen – an einer
 * Zuweisung, unter einem zugeordneten Textstück, in der Traktandenliste.
 *
 * Deshalb wird der Ton für die Konten der Bischofschaft **vergeben** statt
 * gerechnet, und zwar so:
 *
 * 1. **Die Ämter zuerst.** Bischof, 1. und 2. Ratgeber, Finanzsekretär und
 *    Sekretär haben je einen festen Ton. Er gehört dem Amt und nicht der
 *    Person: Wer den Bischof ablöst, trägt dessen Ton – und die Farben der
 *    übrigen bleiben, wo sie waren.
 * 2. **Alle übrigen Konten** bekommen den ersten Ton, den kein Amt für sich
 *    beansprucht und den noch niemand trägt – in der Reihenfolge der Rollen
 *    (siehe `roleRank`), damit die Vergabe nicht davon abhängt, wer zuerst
 *    in der Liste steht.
 * 3. Sind mehr Konten da als Töne, fällt der Rest auf die Rechnung zurück.
 *    Acht verschiedene sind acht verschiedene; ein neunter kann nur noch
 *    einen wiederholen.
 *
 * Firestore-frei und ohne Oberfläche, damit sich die Vergabe prüfen lässt
 * (`tests/person-colors.test.ts`).
 */

/** So viele Töne hat die Reihe – `AVATAR_COLORS` und `WHO_DECORATIONS`. */
export const HUE_COUNT = 8

/**
 * Der feste Ton eines Amtes.
 *
 * Die Zuordnung ist gewählt und nicht gerechnet: Die fünf Ämter sollen sich
 * auch für jemanden unterscheiden, der Farben schlecht auseinanderhält –
 * deshalb liegen sie über die Reihe verteilt und nicht nebeneinander. Der
 * Bischof trägt den ersten Ton (Himmelblau), weil er als Erster genannt wird.
 *
 * Die alte Sammelrolle «Ratgeber» steht bewusst nicht hier: Sie wird nicht
 * mehr vergeben, und ein eigener Ton dafür nähme einen weg, den ein
 * besetztes Amt brauchen könnte.
 */
export const ROLE_HUES: Partial<Record<Role, number>> = {
  bishop: 0, // Himmelblau
  counselor1: 3, // Violett
  counselor2: 1, // Grün
  executive_secretary: 2, // Bernstein
  secretary: 4, // Rosé
}

/** Die Töne, die einem Amt vorbehalten sind – auch wenn es gerade leer ist. */
const RESERVED = new Set(Object.values(ROLE_HUES))

/** Was die Vergabe von einem Konto wissen muss. */
type ColoredUser = Pick<AppUser, 'id' | 'role' | 'active'> & { memberId?: string | null }

/**
 * Die Töne der ganzen Mannschaft – nach Kennung nachschlagbar.
 *
 * Eingetragen wird unter **beiden** Kennungen einer Person: unter der
 * Konto-UID und unter dem verknüpften Mitglied. Der Kreis mit den Initialen
 * rechnet mit dem Mitglied, sobald eines eingetragen ist (siehe
 * `useUserAvatar`), eine Zuweisung dagegen mit dem Konto – und beide sollen
 * denselben Ton ergeben.
 *
 * Wartende Konten bleiben aussen vor: Sie sehen nichts und erscheinen
 * nirgends, ein Ton für sie nähme bloss einen weg.
 */
export function personHues(users: ColoredUser[]): Map<string, number> {
  const team = users
    .filter((user) => user.active && user.role !== 'pending')
    /*
     * Nach Rolle und dann nach Kennung – und nicht nach Namen: Wer sich
     * umbenennt, soll nicht die Farben der halben Bischofschaft verschieben.
     */
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.id.localeCompare(b.id))

  const hues = new Map<string, number>()
  const taken = new Set<number>()

  const claim = (user: ColoredUser, hue: number) => {
    taken.add(hue)
    hues.set(user.id, hue)
    if (user.memberId) hues.set(user.memberId, hue)
  }

  /* 1. Die Ämter. Ist ein Amt doppelt besetzt, wartet das zweite Konto auf
        den zweiten Durchgang – der Ton gehört dem Amt einmal. */
  const rest: ColoredUser[] = []
  for (const user of team) {
    const hue = ROLE_HUES[user.role]
    if (hue === undefined || taken.has(hue)) rest.push(user)
    else claim(user, hue)
  }

  /** Der erste freie Ton – auf Wunsch auch einer, der einem Amt gehört. */
  const free = (includeReserved: boolean): number | null => {
    for (let hue = 0; hue < HUE_COUNT; hue++) {
      if (taken.has(hue)) continue
      if (!includeReserved && RESERVED.has(hue)) continue
      return hue
    }
    return null
  }

  /* 2. Alle übrigen. Zuerst aus dem, was keinem Amt vorbehalten ist – erst
        wenn das aufgebraucht ist, aus den Tönen unbesetzter Ämter. */
  for (const user of rest) {
    const hue = free(false) ?? free(true)
    // Mehr Konten als Töne: Der Rest fällt auf die Rechnung zurück.
    if (hue === null) break
    claim(user, hue)
  }

  return hues
}

/**
 * Der Ferienplan der Schulen Burgdorf.
 *
 * In den Schulferien ist die halbe Klasse weg – im Lager, bei den
 * Grosseltern, im Süden. Eine Aktivität am Mittwochabend findet dann nicht
 * statt, und das war schon immer so; im Plan stand es bisher nur nirgends.
 * Deshalb steht der Ferienplan hier: Wer den Takt erzeugt, bekommt die
 * Ferienabende als erklärte Lücke statt als offenen Termin, den noch jemand
 * füllen müsste (siehe `services/apSchedule`).
 *
 * **Die Daten stehen von Hand da und nicht in den Einstellungen.** Der
 * Ferienplan gilt für die ganze Stadt, ändert sich nie und wird alle paar
 * Jahre um ein Schuljahr verlängert – eine Tabelle in der App wäre ein
 * Formular, das niemand ausfüllt. Nachtragen heisst: eine Zeile hier
 * ergänzen, veröffentlicht unter
 * <https://www.schuleburgdorf.ch/ferienplan>.
 *
 * Angegeben ist immer der **erste und der letzte Ferientag** – so, wie die
 * Schule es tut.
 *
 * Bewusst frei von Firebase, damit sich der Plan mit `node --test` prüfen
 * lässt.
 */

export interface SchoolHoliday {
  /** «Herbstferien», «Sportwoche» */
  name: string
  /** Erster Ferientag, «2026-09-19» */
  from: string
  /** Letzter Ferientag, «2026-10-11» */
  to: string
}

/** Nach Datum geordnet – die Suche verlässt sich darauf nicht, das Lesen schon. */
export const SCHOOL_HOLIDAYS: SchoolHoliday[] = [
  /* Schuljahr 2025/26 */
  { name: 'Herbstferien', from: '2025-09-20', to: '2025-10-12' },
  { name: 'Winterferien', from: '2025-12-20', to: '2026-01-04' },
  { name: 'Sportwoche', from: '2026-02-07', to: '2026-02-15' },
  { name: 'Frühlingsferien', from: '2026-04-03', to: '2026-04-19' },
  { name: 'Sommerferien', from: '2026-07-04', to: '2026-08-09' },

  /* Schuljahr 2026/27 */
  { name: 'Herbstferien', from: '2026-09-19', to: '2026-10-11' },
  { name: 'Winterferien', from: '2026-12-24', to: '2027-01-10' },
  { name: 'Sportwoche', from: '2027-02-13', to: '2027-02-21' },
  { name: 'Frühlingsferien', from: '2027-04-10', to: '2027-04-25' },
  // Sechs Wochen: Das Schuljahr folgt auf ein Jahr mit dreiundfünfzig Wochen.
  { name: 'Sommerferien', from: '2027-07-03', to: '2027-08-15' },

  /* Schuljahr 2027/28 */
  { name: 'Herbstferien', from: '2027-09-25', to: '2027-10-17' },
  { name: 'Winterferien', from: '2027-12-24', to: '2028-01-09' },
  { name: 'Sportwoche', from: '2028-02-12', to: '2028-02-20' },
  { name: 'Frühlingsferien', from: '2028-04-08', to: '2028-04-23' },
  { name: 'Sommerferien', from: '2028-07-08', to: '2028-08-13' },

  /* Schuljahr 2028/29 */
  { name: 'Herbstferien', from: '2028-09-23', to: '2028-10-15' },
  { name: 'Winterferien', from: '2028-12-23', to: '2029-01-07' },
  { name: 'Sportwoche', from: '2029-02-10', to: '2029-02-18' },
  { name: 'Frühlingsferien', from: '2029-04-07', to: '2029-04-22' },
  { name: 'Sommerferien', from: '2029-07-07', to: '2029-08-12' },
]

/** Der erste Tag, über den der Ferienplan etwas weiss. */
export const SCHOOL_HOLIDAYS_FROM = SCHOOL_HOLIDAYS[0].from

/**
 * Der letzte Tag, über den der Ferienplan etwas weiss.
 *
 * Danach schweigt er – und das ist etwas anderes als «keine Ferien». Wer
 * über diesen Tag hinaus plant, wird darauf hingewiesen (siehe
 * `ApScheduleDialog`), statt einen Plan ohne Ferien zu bekommen und es
 * nicht zu merken.
 */
export const SCHOOL_HOLIDAYS_UNTIL = SCHOOL_HOLIDAYS[SCHOOL_HOLIDAYS.length - 1].to

/** Welche Ferien an diesem Tag laufen – «2027-07-14» → Sommerferien. */
export function schoolHolidayOn(date: string): SchoolHoliday | null {
  return SCHOOL_HOLIDAYS.find((holiday) => date >= holiday.from && date <= holiday.to) ?? null
}

/** Ist an diesem Tag schulfrei? */
export function isSchoolHoliday(date: string): boolean {
  return schoolHolidayOn(date) !== null
}

/** Reicht der Ferienplan bis zu diesem Tag? */
export function coversSchoolHolidays(date: string): boolean {
  return date >= SCHOOL_HOLIDAYS_FROM && date <= SCHOOL_HOLIDAYS_UNTIL
}

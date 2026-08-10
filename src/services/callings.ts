// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { formatDate, toDate } from '../lib/dates.ts'
import {
  ACTIVE_CALLING_STATUSES,
  CALLING_ORGANIZATION_SCOPE_LABELS,
  type Calling,
  type CallingOrganizationScope,
} from '../lib/types.ts'

/*
 * Nur Lesen.
 *
 * Berufungen entstehen ausschliesslich beim Import aus dem LCR (siehe
 * `services/importApply`) – von Hand lässt sich hier keine anlegen, ändern
 * oder löschen. Das ist Absicht: Wer welche Berufung hat, steht im LCR, und
 * ein zweiter, von Hand gepflegter Stand daneben wäre über kurz oder lang
 * der falsche. Was in der App entsteht, wäre beim nächsten Import ohnehin
 * wieder weg – entweder überschrieben oder als «fehlt in der Quelle»
 * entlassen.
 */

/** Laufende Berufungen (alles ausser entlassen/abgelehnt). */
export function activeCallings(callings: Calling[]): Calling[] {
  return callings.filter((c) => ACTIVE_CALLING_STATUSES.includes(c.status))
}

/**
 * Gehört die Berufung zur Gemeinde?
 *
 * Alles ohne Vermerk zählt dazu – so bleiben von Hand erfasste und ältere
 * Datensätze dort, wo man sie erwartet.
 */
export function isWardCalling(calling: Calling): boolean {
  return !calling.outOfUnit
}

/**
 * Gehört die Berufung zur gewählten Sparte?
 *
 * «Ausserhalb der Einheit» wird dabei nicht über die Organisation
 * entschieden, sondern über das Kennzeichen: Eine Pfahlberufung trägt zwar
 * auch eine Organisation, gehört aber nicht in den Organisationsplan der
 * Gemeinde. Wer «Sonntagsschule» wählt, meint die eigene.
 */
export function matchesOrganizationScope(
  calling: Calling,
  scope: CallingOrganizationScope,
): boolean {
  if (scope === 'all') return true
  if (scope === 'out_of_unit') return !isWardCalling(calling)
  return isWardCalling(calling) && calling.organization === scope
}

/** Unter welcher Sparte die Berufung in der Auswahl steht. */
export function organizationScopeOf(calling: Calling): CallingOrganizationScope {
  return isWardCalling(calling) ? calling.organization : 'out_of_unit'
}

export interface OrganizationChoice {
  value: CallingOrganizationScope
  label: string
  count: number
}

/**
 * Die Sparten, die zur Wahl stehen – mit der Zahl der Berufungen darin.
 *
 * Nur was es auch gibt: Der Organisationsplan kennt ein Dutzend
 * Organisationen, eine Gemeinde besetzt selten alle. Eine Liste, in der die
 * Hälfte auf «(0)» steht, macht das Suchen mühsamer und nicht leichter.
 *
 * Die gerade gewählte Sparte bleibt in jedem Fall darin. Sonst verschwände
 * sie unter der Hand aus dem Feld, in dem sie steht, sobald der Ausschnitt
 * wechselt und darin nichts von ihr übrig bleibt – und niemand käme mehr
 * weg von einer Wahl, die er nicht mehr sieht.
 *
 * Gezählt wird gegen den Bestand **vor** dieser Einschränkung. Sonst zählte
 * die Auswahl sich selbst: Neben «PV (26)» stünde bei jeder anderen
 * Organisation eine Null.
 */
export function organizationChoices(
  entries: Calling[],
  selected: CallingOrganizationScope,
): OrganizationChoice[] {
  const counts = new Map<CallingOrganizationScope, number>()
  for (const calling of entries) {
    const key = organizationScopeOf(calling)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const keys = Object.keys(CALLING_ORGANIZATION_SCOPE_LABELS) as CallingOrganizationScope[]
  return keys
    .filter((key) => key === 'all' || key === selected || counts.has(key))
    .map((value) => ({
      value,
      label: CALLING_ORGANIZATION_SCOPE_LABELS[value],
      count: value === 'all' ? entries.length : (counts.get(value) ?? 0),
    }))
}

/**
 * Berufungen eines Mitglieds, aktuelle zuerst und darunter die jüngste.
 *
 * Die Reihenfolge zählt, seit die übernommene Berufungshistorie das Feld
 * füllt: Wer seit zehn Jahren in der Gemeinde ist, bringt ein Dutzend
 * Einträge mit, und ungeordnet läse sich daraus keine Geschichte.
 */
export function callingsForMember(callings: Calling[], memberId: string): Calling[] {
  return callings
    .filter((c) => c.memberId === memberId)
    .sort((a, b) => {
      const running = Number(!isRunning(a)) - Number(!isRunning(b))
      return running !== 0 ? running : startedAt(b) - startedAt(a)
    })
}

function isRunning(calling: Calling): boolean {
  return ACTIVE_CALLING_STATUSES.includes(calling.status)
}

/** Wann die Berufung begann – für die Sortierung, notfalls ihr Ende. */
function startedAt(calling: Calling): number {
  const date = toDate(
    calling.setApartDate ?? calling.sustainedDate ?? calling.extendedDate ?? calling.releasedDate,
  )
  return date ? date.getTime() : 0
}

/**
 * Der Zeitraum einer Berufung: «seit 4. Feb. 2024», «2015 – 2017».
 *
 * Bei laufenden Berufungen zählt der Anfang, bei abgeschlossenen der
 * Abschnitt. Fehlt beides – aus der Berufungsliste kommen Einträge, deren
 * Datum niemand mehr weiss –, bleibt die Zeile leer statt falsch.
 */
export function callingPeriod(calling: Calling): string {
  const from = calling.setApartDate ?? calling.sustainedDate ?? calling.extendedDate
  if (isRunning(calling)) return from ? `seit ${formatDate(from)}` : ''
  if (from && calling.releasedDate)
    return `${formatDate(from)} – ${formatDate(calling.releasedDate)}`
  if (calling.releasedDate) return `bis ${formatDate(calling.releasedDate)}`
  return from ? `ab ${formatDate(from)}` : ''
}

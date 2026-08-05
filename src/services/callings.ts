import { formatDate, toDate } from '@/lib/dates'
import { ACTIVE_CALLING_STATUSES, type Calling } from '@/lib/types'

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

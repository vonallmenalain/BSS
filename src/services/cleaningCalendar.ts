import { buildCleaningIcs, type IcsCleaningWeek } from '@/lib/cleaningIcs'

/*
 * Die Putzwochen einer Gruppe im eigenen Kalender – als Abo oder als Datei.
 *
 * Das **Abo** ist der Weg, der aktuell bleibt: Google und Apple holen die
 * Termine unter der Adresse immer wieder selbst ab
 * (`netlify/functions/putzplan-ics.mts`). Wird der Plan neu generiert,
 * rücken die Wochen im Kalender von selbst mit.
 *
 * Die **Datei** ist eine Kopie der Termine, wie sie heute im Plan stehen –
 * für Kalender, die kein Abo können, oder wer die Termine lieber fest
 * eingetragen hat. Ändert sich der Plan, ändern sich diese Termine nicht
 * mit. Die Termine tragen dieselben UIDs wie im Abo – je Woche und Gruppe.
 */

/** Wo der Kalender einer Gruppe abgeholt wird. */
const FEED_PATH = '/.netlify/functions/putzplan-ics'

/** «https://bss.alae.app/.netlify/functions/putzplan-ics?gruppe=5» – für Google und Outlook. */
export function cleaningFeedUrl(group: number, origin: string = window.location.origin): string {
  return `${origin}${FEED_PATH}?gruppe=${group}`
}

/**
 * Dieselbe Adresse als «webcal://» – am iPhone und am Mac öffnet ein
 * Antippen unmittelbar den Kalender, der nach dem Abo fragt. Mit «https»
 * lüde der Browser stattdessen eine Datei herunter, und die wäre eine
 * einmalige Kopie.
 */
export function cleaningFeedWebcalUrl(
  group: number,
  origin: string = window.location.origin,
): string {
  return cleaningFeedUrl(group, origin).replace(/^https?:/, 'webcal:')
}

/**
 * Google Calendar mit der Frage, ob es den Kalender abonnieren soll.
 *
 * Funktioniert im Browser; die Google-App am Telefon kennt keine Abos per
 * Adresse, übernimmt den Kalender aber, sobald er im Konto steht.
 */
export function googleSubscribeUrl(group: number, origin: string = window.location.origin): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    cleaningFeedWebcalUrl(group, origin),
  )}`
}

/**
 * Die bekannten Wochen der Gruppe als Datei herunterladen – ab der
 * laufenden Woche; was vorbei ist, braucht im Kalender niemand mehr.
 * Gibt zurück, wie viele Wochen darin stehen.
 */
export function downloadCleaningIcs(
  weeks: readonly IcsCleaningWeek[],
  group: number,
  today: string,
  origin: string = window.location.origin,
): number {
  const ahead = weeks.filter((week) => week.endDate >= today)
  const ics = buildCleaningIcs(ahead, {
    group,
    name: `Putzplan Gruppe ${group}`,
    domain: new URL(origin).host,
    now: new Date(),
    planUrl: `${origin}/putzplan`,
  })
  const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `putzplan-gruppe-${group}.ics`
  link.click()
  // Erst später freigeben: Im selben Zug verworfen, bricht der Download je
  // nach Browser ab, bevor er begonnen hat.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return count
}

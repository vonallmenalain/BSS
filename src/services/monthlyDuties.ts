import {
  collection,
  deleteDoc,
  doc,
  noteWrite,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, type SaveOutcome } from '@/lib/sync'
import { uid } from '@/lib/utils'
import { dutyAssignees, dutyItemId, formatMonthKey, type DutyAction } from '@/lib/monthlyDuties'
import type { Actor } from '@/services/agenda'
import type { AgendaItem, ItemKind, ItemStatus } from '@/lib/types'

/*
 * Die Aufgaben, die zur Leitung eines Monats gehören.
 *
 * Zwei Sammlungen sind daran beteiligt, und die Aufteilung ist der Kern der
 * Sache: In `monthlyDuties` steht die **Vorlage** – was jeden Monat anfällt.
 * In `agendaItems` steht, was daraus wird: je Monat eine gewöhnliche Pendenz,
 * zugewiesen an den, der den Monat führt.
 *
 * Warum nicht wie bei den wiederkehrenden Bekanntmachungen bloss gerechnet?
 * Weil eine Pendenz mehr ist als ein Satz, der vorgelesen wird: Sie wird
 * abgehakt, ergänzt, umsortiert und trägt einen Verlauf. Das alles braucht
 * einen Datensatz, an dem es stehen kann – eine errechnete Zeile hätte
 * nirgends Platz dafür.
 *
 * Angelegt wird nur der **laufende** Monat, und zwar von der App selbst beim
 * Start (siehe `hooks/useMonthlyDuties`). Die ID der Pendenz wird dabei aus
 * Vorlage und Monat gerechnet: Öffnen zwei Personen am selben Morgen die App,
 * schreiben beide dasselbe Dokument statt zweier gleichlautender Pendenzen.
 */

const dutiesRef = collection(db, COLLECTIONS.monthlyDuties)

export interface MonthlyDutyInput {
  title: string
  description?: string
  /** Ab welchem Monat sie anfällt, «2026-08» */
  startMonth: string
}

/** Eine neue Aufgabe der Monatsverantwortung. Gibt ihre ID zurück. */
export async function createMonthlyDuty(input: MonthlyDutyInput, actor: Actor): Promise<string> {
  const docRef = doc(dutiesRef)
  await commit(
    setDoc(docRef, {
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      startMonth: input.startMonth,
      endMonth: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor.id,
    }),
  )
  return docRef.id
}

/**
 * Wortlaut ändern – für die kommenden Monate.
 *
 * Was schon dasteht, bleibt stehen: In der Pendenz dieses Monats ist
 * womöglich bereits etwas notiert worden, und ein Titel, der sich unter der
 * Hand ändert, wäre in einer Liste, die gemeinsam durchgegangen wird, das
 * Gegenteil von hilfreich.
 */
export function updateMonthlyDuty(id: string, input: MonthlyDutyInput): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.monthlyDuties, id), {
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      startMonth: input.startMonth,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Die Aufgabe läuft aus – dieser Monat noch, danach nicht mehr.
 *
 * Beendet und nicht gelöscht: Die Pendenzen der vergangenen Monate bleiben
 * stehen, samt allem, was in ihnen notiert wurde. Das Gegenstück zum
 * Beenden einer Bekanntmachungsserie (siehe `services/announcementSeries`).
 */
export function endMonthlyDuty(id: string, month: string): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.monthlyDuties, id), {
      endMonth: month,
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Doch weiterführen – die Aufgabe fällt wieder jeden Monat an. */
export function resumeMonthlyDuty(id: string): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.monthlyDuties, id), {
      endMonth: null,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Die Vorlage entfernen.
 *
 * Nur für das, was von Anfang an ein Versehen war. Die Pendenzen, die aus ihr
 * entstanden sind, bleiben – sie gehören den Monaten, in denen sie standen,
 * und wer sie nicht mehr braucht, löscht sie dort einzeln. Soll bloss nichts
 * mehr nachkommen, ist «Beenden» der richtige Weg.
 */
export async function deleteMonthlyDuty(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.monthlyDuties, id)))
  forgetDoc(COLLECTIONS.monthlyDuties, id)
  return outcome
}

/* ------------------------------------------------------------------ */
/* Aus der Vorlage wird eine Pendenz                                   */
/* ------------------------------------------------------------------ */

/**
 * Legt an, was für den laufenden Monat noch fehlt – und schreibt um, was
 * inzwischen jemand anderem gehört.
 *
 * **Beides in einer Transaktion**, und das ist kein Zierrat. Entschieden wird
 * hier auf dem Stand des Servers und nicht auf dem, den das Gerät gerade
 * kennt – der ist womöglich Minuten alt oder stammt aus der lokalen Kopie,
 * mit der die App startet:
 *
 *  - Beim **Anlegen** würde ein gewöhnliches `setDoc()` eine bereits
 *    abgehakte Pendenz stillschweigend wieder öffnen, wenn das Gerät sie noch
 *    nicht kennt.
 *  - Beim **Umschreiben** würde eine Pendenz, die jemand eben erledigt hat,
 *    noch einem neuen Zuständigen zugeschrieben – sie wäre danach von jemand
 *    anderem erledigt worden, als es dasteht.
 *
 * Die Transaktion braucht dafür eine Verbindung; ohne sie geschieht schlicht
 * nichts, und beim nächsten Start ist es nachgeholt.
 *
 * `actor` ist, wer die Aufgabe seinerzeit eingerichtet hat – nicht, wer heute
 * zufällig als Erster die App geöffnet hat. Sonst stünde unter «Erfasst» ein
 * Name, der mit dem Eintrag nichts zu tun hat.
 */
export async function applyDutyActions(
  actions: DutyAction[],
  actor: (userId: string | null | undefined) => Actor,
): Promise<void> {
  if (actions.length === 0) return
  // Ohne Netz kann die Transaktion nicht lesen; sie liefe in einen Fehler,
  // den niemand sehen will. Nachgeholt wird beim nächsten Start.
  if (!navigator.onLine) return

  for (const action of actions) {
    if (action.kind === 'reassign') {
      const ref = doc(db, COLLECTIONS.agendaItems, action.itemId)
      /*
       * Das Zugriffsprotokoll wird hier von Hand bedient (siehe `lib/db`).
       * Eine Transaktion kann ohne Wirkung enden – der Eintrag ist weg oder
       * längst erledigt –, und ihre Rückruffunktion läuft bei einem
       * Zusammenstoss ein zweites Mal. Gemeldet wird deshalb erst danach und
       * nur, wenn wirklich geschrieben wurde.
       */
      let applied: Record<string, unknown> | null = null

      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ref)
        // Weg oder inzwischen erledigt: Dann gehört die Aufgabe dem, der sie
        // erledigt hat, und nicht mehr dem Monat.
        if (!existing.exists()) return
        const current = existing.data() as Pick<AgendaItem, 'status' | 'assignees' | 'dutyLeaderId'>
        if (current.status === 'done') return
        // Gerechnet wird noch einmal, und zwar auf dem Stand des Servers:
        // Wer seither von Hand dazugeschrieben wurde, soll stehen bleiben.
        applied = {
          assignees: dutyAssignees(current.assignees, current.dutyLeaderId, action.leader),
          dutyLeaderId: action.leader,
          // Kein `editedAt`: Ein Wechsel der Monatsleitung ist keine
          // Bearbeitung des Eintrags – sonst spränge er in der nach
          // «Bearbeitungsdatum» sortierten Liste an den Anfang (siehe
          // `services/agenda`).
          updatedAt: serverTimestamp(),
        }
        transaction.update(ref, applied)
      })

      if (applied) noteWrite(ref, 'update', applied)
      continue
    }

    const { duty, month, leader } = action
    const author = actor(duty.createdBy)
    const ref = doc(db, COLLECTIONS.agendaItems, dutyItemId(duty.id, month))

    const pendenz = {
      title: duty.title,
      description: duty.description ?? '',
      /*
       * Keine Sitzung, und zwar dauerhaft.
       *
       * Eine Monatspendenz gehört dem Monat und nicht dem Sitzungstisch:
       * Sie steht nicht auf der Traktandenliste, wird beim Planen der
       * nächsten Sitzung nicht mitgenommen und im Protokoll nicht
       * gedruckt. Wo sie erscheint, ist die Pendenzenliste – unter
       * «Meine» bei dem, der den Monat führt.
       */
      meetingId: null,
      firstMeetingId: null,
      order: Date.now(),
      kind: 'pendenz' satisfies ItemKind,
      status: 'pending' satisfies ItemStatus,
      assignees: leader ? [leader] : [],
      memberRefs: [],
      layout: null,
      callingChanges: null,
      deferCount: 0,
      dutyId: duty.id,
      dutyMonth: month,
      dutyLeaderId: leader,
      history: [
        {
          id: uid(),
          action: `Monatspendenz für ${formatMonthKey(month)}`,
          authorId: author.id,
          authorName: author.name,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
      createdBy: author.id,
      editedBy: author.id,
      completedAt: null,
      completedBy: null,
    }

    let created = false

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref)
      if (existing.exists()) return

      created = true
      transaction.set(ref, pendenz)
    })

    if (created) noteWrite(ref, 'create', pendenz)
  }
}

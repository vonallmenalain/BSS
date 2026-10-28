import { useEffect, useState } from 'react'
import { Clock, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { checkForUpdate } from '@/lib/appUpdate'

/**
 * Wartebereich für Konten, die nichts sehen dürfen.
 * Ohne Freigabe kommt niemand an Personendaten – das ist bewusst so.
 *
 * Ein neues Konto landet nicht mehr hier: Es bringt den AP-Kalender und
 * «Anti Doom» von sich aus mit (`NEW_ACCOUNT_ACCESS`). Auch eines, das eine
 * ältere Fassung der App als «wartet» angelegt hat, holt sich das nach
 * (`isLegacyPendingAccount`). Hier steht, wem die Bischofschaft den Zugang
 * genommen hat oder wer deaktiviert wurde.
 *
 * Hier steht nur, was die wartende Person angeht. Eine Anleitung zum
 * Freischalten stand einmal darunter – sie richtete sich an jemand anderen
 * und stand am falschen Bildschirm. Die Bischofschaft sieht die neue
 * Registrierung von sich aus auf der Übersicht.
 */
export function PendingApproval() {
  const { profile, firebaseUser, signOut, unknownRole } = useAuth()
  const [checking, setChecking] = useState(false)
  const name = profile?.displayName ?? firebaseUser?.displayName ?? ''
  const inactive = profile && !profile.active
  /*
   * Freigeschaltet – aber mit einer Rolle, die diese Fassung der App nicht
   * kennt. Sie wurde mit einer neueren Fassung vergeben, während auf dem
   * Gerät noch die alte läuft. «Wartet auf eine Rolle» wäre falsch; was
   * fehlt, ist die neue Fassung.
   */
  const outdated = unknownRole && profile?.active === true

  /*
   * Hier wird beim Öffnen nach einer neuen Fassung gefragt und sie ohne
   * Umweg geladen: Im Wartebereich geht beim Neuladen nichts verloren – und
   * vielleicht ist es gerade die neue Fassung, die das Konto hereinlässt
   * (etwa, wenn die Rolle neuer ist als die App auf dem Gerät).
   */
  useEffect(() => {
    void checkForUpdate()
  }, [])

  /*
   * «Neu prüfen» fragt zuerst nach einer neuen Fassung und lädt sie. Gibt es
   * keine, genügt ein gewöhnliches Neuladen – das Profil kommt dabei frisch
   * vom Server.
   */
  const recheck = async () => {
    setChecking(true)
    if (!(await checkForUpdate())) window.location.reload()
  }
  /*
   * Eine Assistenz ohne einen einzigen Bereich.
   *
   * Sie ist freigeschaltet und sieht trotzdem nichts – das ist gewollt (so
   * entzieht man den Zugang, ohne die Rolle zu ändern), aber es sähe wie ein
   * Fehler aus, stünde hier «wartet auf eine Rolle». Sie hat eine.
   */
  const withoutArea = profile?.role === 'assistant' && profile.active

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-100 dark:bg-amber-950">
          <Clock className="size-6 text-amber-600 dark:text-amber-300" aria-hidden />
        </div>

        <h1 className="text-lg font-semibold">
          {inactive
            ? 'Zugang deaktiviert'
            : outdated
              ? 'Neue Version nötig'
              : withoutArea
                ? 'Kein Bereich freigeschaltet'
                : 'Freigabe ausstehend'}
        </h1>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {inactive ? (
            <>Dein Zugang wurde deaktiviert. Bitte wende dich an den Bischof.</>
          ) : outdated ? (
            <>
              Hallo {name}, dein Konto ist freigeschaltet – aber die App auf diesem Gerät ist älter
              als dein Zugang. Die neue Version wird gesucht und geladen. Tut sich nichts, schliesse
              die App ganz und öffne sie wieder.
            </>
          ) : withoutArea ? (
            <>
              Hallo {name}, dein Konto ist als Assistenz der Abendmahlsversammlung eingerichtet – es
              steht aber zurzeit kein Bereich offen. Die Bischofschaft schaltet Ansprachen, Musik
              und Gebet einzeln frei.
            </>
          ) : (
            <>
              Hallo {name}, dein Konto wurde erstellt. Ein Mitglied der Bischofschaft muss dir noch
              eine Rolle zuweisen, bevor du die Daten sehen kannst.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void recheck()}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Neu prüfen
          </button>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden />
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}

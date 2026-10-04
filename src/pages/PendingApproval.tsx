import { useEffect, useState } from 'react'
import { Clock, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { useAppUpdate } from '@/contexts/AppUpdateContext'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Wartebereich für Konten, die noch keine Rolle haben.
 * Ohne Freigabe kommt niemand an Personendaten – das ist bewusst so.
 *
 * Hier steht nur, was die wartende Person angeht. Eine Anleitung zum
 * Freischalten stand einmal darunter – sie richtete sich an jemand anderen
 * und stand am falschen Bildschirm. Die Bischofschaft sieht die neue
 * Registrierung von sich aus auf der Übersicht.
 */
export function PendingApproval() {
  const { profile, firebaseUser, signOut, unknownRole } = useAuth()
  const { needRefresh, applyUpdate, checkForUpdate } = useAppUpdate()
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
   * Eine neue Fassung wird hier sofort übernommen, statt wie sonst zu
   * fragen: Im Wartebereich geht beim Neuladen nichts verloren – und
   * vielleicht ist es gerade die neue Fassung, die das Konto hereinlässt.
   */
  useEffect(() => {
    if (needRefresh) applyUpdate()
  }, [needRefresh, applyUpdate])

  // Kennt die App die Rolle nicht, fragt sie von sich aus nach der neuen Fassung.
  useEffect(() => {
    if (outdated) void checkForUpdate()
  }, [outdated, checkForUpdate])

  /*
   * «Neu prüfen» fragt zuerst nach einer neuen Fassung. Kommt eine, lädt die
   * Wirkung oben neu, sobald sie bereitliegt; sonst – oder wenn sie hängen
   * bleibt – genügt ein gewöhnliches Neuladen, und das Profil kommt frisch
   * vom Server.
   */
  const recheck = async () => {
    setChecking(true)
    const coming = await checkForUpdate()
    window.setTimeout(() => window.location.reload(), coming ? 10_000 : 0)
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

/*
 * Aus einem Link wird ein Video.
 *
 * Die Redaktion setzt eine Adresse ein – mehr soll sie nicht tun müssen.
 * Was daraus wird, entscheidet diese Datei: Sie liest an der Adresse ab,
 * wie sich das Video am besten zeigen lässt.
 *
 * **Datei** (`…mp4`, `…webm`, `…m3u8`) ist der beste Fall und darum der
 * erste: Ein `<video>` gehört zur Seite wie ein Bild – es startet mit dem
 * Wisch, spielt stumm weiter, geht ins echte Vollbild und braucht keine
 * fremden Skripte. Genau so liefert die Mediathek der Kirche ihre Videos
 * aus; der Knopf «Herunterladen» auf einer Videoseite gibt diese Adresse
 * her (`media*.ldscdn.org/…mp4`).
 *
 * **YouTube** und **Vimeo** kommen als Einbettung – nicht ganz so nahtlos
 * (ein fremder Rahmen mit eigenen Knöpfen), aber der Alltag: Vieles, was
 * die AP's teilen wollen, liegt dort. YouTube wird über
 * `youtube-nocookie.com` geladen, damit die App nicht mehr über ihre
 * Leute verrät als nötig.
 *
 * **Seite** ist der Rest – etwa eine Videoseite der Kirche selbst. Die
 * lässt sich nicht einbetten (der Server verbietet es), darum wird daraus
 * eine ruhige Karte mit einem Knopf, der das Video draussen öffnet.
 */

export type ImpulseVideoSource =
  /** Eine Videodatei – spielt in der App selbst. */
  | { art: 'datei'; url: string }
  | { art: 'youtube'; id: string; start: number }
  | { art: 'vimeo'; id: string }
  /** Nicht einbettbar – die Karte führt hinaus. */
  | { art: 'seite'; url: string }

const FILE_ENDINGS = ['.mp4', '.m4v', '.webm', '.ogv', '.mov', '.m3u8']

/** Die Sekunde, bei der ein YouTube-Link einsteigt («?t=90», «#t=1m30s»). */
function startSeconds(url: URL): number {
  const raw = url.searchParams.get('t') ?? url.searchParams.get('start') ?? ''
  if (!raw) return 0
  if (/^\d+$/.test(raw)) return Number(raw)
  const match = /^(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw)
  if (!match) return 0
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}

/**
 * Wie sich dieser Link zeigen lässt – oder `null`, wenn gar keine
 * brauchbare Adresse dasteht.
 */
export function impulseVideoSource(raw: string | null | undefined): ImpulseVideoSource | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const path = url.pathname

  /* Eine Datei erkennt man an ihrer Endung – egal, wer sie ausliefert. */
  if (FILE_ENDINGS.some((ending) => path.toLowerCase().endsWith(ending))) {
    return { art: 'datei', url: value }
  }

  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0]
    return id ? { art: 'youtube', id, start: startSeconds(url) } : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      url.searchParams.get('v') ?? /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(path)?.[1] ?? null
    return id ? { art: 'youtube', id, start: startSeconds(url) } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{6,})/.exec(path)?.[1] ?? null
    return id ? { art: 'vimeo', id } : null
  }

  return { art: 'seite', url: value }
}

/**
 * Die Adresse des eingebetteten Videos – mit Ton und startbereit.
 *
 * Ein Video, das man erst lauthörbar machen muss, ist ein halbes Video:
 * Es läuft von Anfang an mit Ton. Wehrt sich der Browser dagegen (er
 * darf – ohne vorherige Berührung lässt er kein lautes Video anlaufen),
 * zeigt die Fremdkarte ihren eigenen Startknopf; den Ton bedient danach
 * die Leiste des Anbieters, die ohnehin in der Einbettung steckt.
 *
 * Untertitel bleiben aus (`cc_load_policy=0`, `texttrack=false`): Sie
 * legen sich sonst über den Text der Karte.
 */
export function impulseEmbedUrl(source: ImpulseVideoSource): string | null {
  if (source.art === 'youtube') {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '0',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      cc_load_policy: '0',
    })
    if (source.start > 0) params.set('start', String(source.start))
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.id)}?${params}`
  }
  if (source.art === 'vimeo') {
    return `https://player.vimeo.com/video/${encodeURIComponent(source.id)}?autoplay=1&muted=0&texttrack=false&playsinline=1&title=0&byline=0&portrait=0`
  }
  return null
}

/** Der Name des Dienstes – für die Zeile unter dem Knopf «Video öffnen». */
export function impulseVideoHost(source: ImpulseVideoSource): string {
  switch (source.art) {
    case 'youtube':
      return 'YouTube'
    case 'vimeo':
      return 'Vimeo'
    default: {
      try {
        return new URL(source.url).hostname.replace(/^www\./, '')
      } catch {
        return 'Video'
      }
    }
  }
}

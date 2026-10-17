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
 * Leute verrät als nötig. Ein **YouTube-Short** (`/shorts/…`) ist schon
 * hochkant und passt genau auf den Bildschirm des Feeds. Am Ende zeigt
 * die Karte ihr Vorschaubild und den Startknopf statt fremder Vorschläge
 * (siehe `ImpulseVideoPlayer`).
 *
 * **Seite** ist der Rest – etwa eine Videoseite der Kirche selbst. Die
 * lässt sich nicht einbetten (der Server verbietet es), darum wird daraus
 * eine ruhige Karte mit einem Knopf, der das Video draussen öffnet.
 */

export type ImpulseVideoSource =
  /** Eine Videodatei – spielt in der App selbst. */
  | { art: 'datei'; url: string }
  /** `short`: ein YouTube-Short – hochkant, kurz, läuft in Schleife. */
  | { art: 'youtube'; id: string; start: number; short: boolean }
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
    return id ? { art: 'youtube', id, start: startSeconds(url), short: false } : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      url.searchParams.get('v') ?? /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(path)?.[1] ?? null
    const short = path.startsWith('/shorts/')
    return id ? { art: 'youtube', id, start: startSeconds(url), short } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{6,})/.exec(path)?.[1] ?? null
    return id ? { art: 'vimeo', id } : null
  }

  return { art: 'seite', url: value }
}

/**
 * Die Adresse des eingebetteten Videos – startbereit, zunächst stumm.
 *
 * Stumm darf ein Video in jedem Browser von selbst anlaufen, laut nicht
 * überall. Darum startet es stumm, und die Karte schaltet den Ton selbst
 * ein, sobald es läuft (`unmute`, siehe `ImpulseVideoPlayer`) – ausser
 * dort, wo der Browser das ohne Berührung nie zulässt
 * (`impulseSoundBlocked`): Dort bietet sie ihn als Knopf an.
 *
 * Bedient wird das Video ganz von der Karte aus, mit ihren eigenen
 * Knöpfen: Über dem Video liegt ihre Fläche, damit ein Tipp die Angaben
 * ein- und ausblendet und ein Wisch zur nächsten Karte führt. Die Knöpfe
 * des Anbieters erreicht der Finger darum nicht – YouTube soll sie gar
 * nicht erst zeigen (`controls=0`, ohne Hinweisfenster
 * `iv_load_policy=3`, ohne Vollbild und Tastatur `fs=0`, `disablekb=1`).
 * Die Befehle gehen per Nachricht hinüber (`impulseEmbedMessage`); dafür
 * schaltet YouTube seine Schnittstelle ein (`enablejsapi`) und antwortet
 * nur der eigenen Seite (`origin`).
 *
 * Untertitel bleiben aus (`cc_load_policy=0`, `texttrack=false`): Sie
 * legen sich sonst über den Text der Karte.
 *
 * Keine Schleife von YouTube (`loop` mit `playlist`): Die ginge nur als
 * Wiedergabeliste und zeigte dafür die Knöpfe «zurück» und «weiter» über
 * dem Bild. Am Ende (`ended`) übernimmt die Karte.
 */
export function impulseEmbedUrl(source: ImpulseVideoSource, origin?: string): string | null {
  if (source.art === 'youtube') {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      playsinline: '1',
      controls: '0',
      fs: '0',
      disablekb: '1',
      iv_load_policy: '3',
      rel: '0',
      modestbranding: '1',
      cc_load_policy: '0',
      enablejsapi: '1',
    })
    if (origin) params.set('origin', origin)
    if (source.start > 0) params.set('start', String(source.start))
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.id)}?${params}`
  }
  if (source.art === 'vimeo') {
    return `https://player.vimeo.com/video/${encodeURIComponent(source.id)}?autoplay=1&muted=1&controls=0&texttrack=false&playsinline=1&title=0&byline=0&portrait=0`
  }
  return null
}

/**
 * Lässt dieser Browser ein eingebettetes Video nie von selbst laut
 * werden? Am iPhone und iPad gilt das immer (in jedem Browser – alle
 * laufen dort auf WebKit); ein iPad meldet sich dabei wie ein Mac, nur
 * mit Berührung. Dort bleibt das Video stumm, bis die Person den Ton
 * selbst einschaltet; anderswo schaltet ihn die Karte ein, sobald das
 * Video läuft.
 */
export function impulseSoundBlocked(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

/** Der Saum über und unter dem Video, in Pixeln – dort zeichnet der Anbieter Titel und Kanal. */
export const EMBED_CHROME_BAND = 160

/** Wo der Rahmen der Fremdkarte liegt – gemessen an der Fläche der Karte. */
export interface ImpulseEmbedBox {
  width: number
  height: number
  left: number
  top: number
}

/**
 * Der Rahmen der Fremdkarte, so gelegt, dass von ihr nur das Video zu
 * sehen ist.
 *
 * YouTube zeichnet Titel, Kanal und – beim Anhalten – weitere Videos an
 * den oberen und unteren Rand seines Rahmens. Darum ragt der Rahmen über
 * und unter der Karte um einen Saum hinaus (`EMBED_CHROME_BAND`), den die
 * Karte abschneidet; das Video selbst steht in der Mitte und bleibt ganz.
 * Titel und Quelle zeigt die Karte ohnehin selbst.
 *
 * Und das Video füllt die Karte, wo das wenig kostet: Ein Short (9:16)
 * ist auf einem schlanken Telefon etwas schmaler als der Bildschirm –
 * dann wird er so weit vergrössert, dass keine schwarzen Balken bleiben,
 * und an den Seiten fehlt ein schmaler Streifen. Ginge mehr als ein
 * Fünftel verloren (ein Querformat hochkant, ein Short am Rechner), steht
 * das Video ganz da, mit Balken.
 *
 * `aspect` ist Breite durch Höhe des Videos – 9/16 für einen Short.
 */
export function impulseEmbedBox(width: number, height: number, aspect: number): ImpulseEmbedBox {
  if (!(width > 0) || !(height > 0) || !(aspect > 0)) {
    return { width, height, left: 0, top: 0 }
  }
  // Ganz im Bild …
  let videoWidth = Math.min(width, height * aspect)
  let videoHeight = videoWidth / aspect
  // … oder die Karte füllend, wenn höchstens ein Fünftel wegfällt.
  const fill = Math.max(width / videoWidth, height / videoHeight)
  if (fill <= 1.25) {
    videoWidth *= fill
    videoHeight *= fill
  }
  const frameHeight = Math.max(videoHeight, height) + 2 * EMBED_CHROME_BAND
  return {
    width: videoWidth,
    height: frameHeight,
    left: (width - videoWidth) / 2,
    top: (height - frameHeight) / 2,
  }
}

/* ------------------------------------------------------------------ */
/* Die Fremdkarte fernsteuern                                          */
/* ------------------------------------------------------------------ */

/** Was die Karte dem eingebetteten Video sagen kann. */
export type ImpulseEmbedCommand = 'play' | 'pause' | 'mute' | 'unmute'

/** Was das eingebettete Video über sich meldet – nur, was die Nachricht hergibt. */
export interface ImpulseEmbedReport {
  /** Soll es laufen – es läuft oder lädt gerade nach. */
  playing?: boolean
  /**
   * Läuft es wirklich – bewegt sich das Bild? Beim Start lädt ein Video
   * erst (`playing`, aber nicht `running`), und solange zeigt YouTube
   * noch sein Vorschaubild mit dem grossen Startknopf.
   */
  running?: boolean
  /** Ist es zu Ende? Nur gesetzt, wenn ja. */
  ended?: boolean
  muted?: boolean
  /** Wo das Video steht, in Sekunden. */
  time?: number
  /** Wie lang es ist, in Sekunden. */
  duration?: number
}

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com'
const VIMEO_ORIGIN = 'https://player.vimeo.com'

const YOUTUBE_COMMANDS: Record<ImpulseEmbedCommand, string> = {
  play: 'playVideo',
  pause: 'pauseVideo',
  mute: 'mute',
  unmute: 'unMute',
}

/** Wohin die Nachrichten gehen – und woher die Antworten kommen müssen. */
export function impulseEmbedOrigin(source: ImpulseVideoSource): string | null {
  if (source.art === 'youtube') return YOUTUBE_ORIGIN
  if (source.art === 'vimeo') return VIMEO_ORIGIN
  return null
}

/**
 * Die Nachricht an die Fremdkarte – dieselbe, die die Schnittstellen der
 * Anbieter selbst verschicken (YouTube: `command`, Vimeo: `method`). So
 * braucht die App deren Skripte nicht zu laden.
 */
export function impulseEmbedMessage(
  source: ImpulseVideoSource,
  command: ImpulseEmbedCommand,
): string | null {
  if (source.art === 'youtube') {
    return JSON.stringify({
      event: 'command',
      func: YOUTUBE_COMMANDS[command],
      args: [],
      id: 1,
      channel: 'widget',
    })
  }
  if (source.art === 'vimeo') {
    if (command === 'play' || command === 'pause') return JSON.stringify({ method: command })
    return JSON.stringify({ method: 'setMuted', value: command === 'mute' })
  }
  return null
}

/**
 * Die Anmeldung, nachdem die Fremdkarte geladen hat: Ab jetzt meldet sie,
 * ob sie läuft und ob sie stumm ist. YouTube braucht dafür ein
 * «listening», Vimeo je Ereignis ein `addEventListener`.
 */
export function impulseEmbedHello(source: ImpulseVideoSource): string[] {
  if (source.art === 'youtube') {
    return [JSON.stringify({ event: 'listening', id: 1, channel: 'widget' })]
  }
  if (source.art === 'vimeo') {
    return ['play', 'pause', 'ended', 'timeupdate'].map((value) =>
      JSON.stringify({ method: 'addEventListener', value }),
    )
  }
  return []
}

/**
 * An eine Stelle springen – beim Spulen mit dem Daumen. Unterwegs
 * (`done: false`) zeigt YouTube nur das Bild an der Stelle, ohne schon
 * nachzuladen; erst beim Loslassen lädt es von dort weiter.
 */
export function impulseEmbedSeekMessage(
  source: ImpulseVideoSource,
  seconds: number,
  done: boolean,
): string | null {
  const at = Math.max(0, seconds)
  if (source.art === 'youtube') {
    return JSON.stringify({
      event: 'command',
      func: 'seekTo',
      args: [at, done],
      id: 1,
      channel: 'widget',
    })
  }
  if (source.art === 'vimeo') return JSON.stringify({ method: 'setCurrentTime', value: at })
  return null
}

/**
 * Wohin der Daumen spult: Die ganze Breite des Videos ist seine ganze
 * Länge – wie bei der Leiste darunter. Gezählt wird vom Stand beim
 * Aufsetzen aus, nicht vom Punkt, an dem der Finger liegt: So spult man
 * von überall auf dem Video, ohne dass es beim Aufsetzen springt.
 */
export function impulseScrubTime(
  startTime: number,
  deltaX: number,
  width: number,
  duration: number,
): number {
  if (!(width > 0) || !(duration > 0)) return Math.max(0, startTime)
  return Math.min(duration, Math.max(0, startTime + (deltaX / width) * duration))
}

/**
 * Das Vorschaubild, das YouTube zu jedem Video bereithält – für den
 * Vorhang, solange das Video verdeckt anläuft, wenn die Redaktion kein
 * eigenes Bild gesetzt hat. `hqdefault` gibt es zu jedem Video; bei einem
 * Short steht das hochkante Bild darin zwischen schwarzen Rändern, die das
 * Zuschneiden auf den Bildschirm (`object-cover`) wegnimmt.
 */
export function impulseVideoThumbnail(source: ImpulseVideoSource): string | null {
  if (source.art !== 'youtube') return null
  return `https://i.ytimg.com/vi/${encodeURIComponent(source.id)}/hqdefault.jpg`
}

/** Eine Zeit im Video, wie man sie liest: «0:07», «1:05», «12:30». */
export function impulseVideoClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Eine Zeit in Sekunden – oder `undefined`, wenn die Meldung keine brauchbare trägt. */
function seconds(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Läuft das YouTube-Video? Spielt (1) oder lädt gerade weiter (3). */
function youtubePlaying(state: unknown): boolean | undefined {
  return typeof state === 'number' ? state === 1 || state === 3 : undefined
}

/** Was ein Zustand des YouTube-Videos sagt: soll es laufen, läuft es, ist es zu Ende (0)? */
function youtubeState(state: unknown): ImpulseEmbedReport | null {
  const playing = youtubePlaying(state)
  if (playing === undefined) return null
  const report: ImpulseEmbedReport = { playing, running: state === 1 }
  if (state === 0) report.ended = true
  return report
}

/**
 * Was eine Nachricht der Fremdkarte über ihren Stand sagt – oder `null`,
 * wenn sie nichts dazu sagt (oder gar nicht von ihr stammt).
 */
export function impulseEmbedReport(
  source: ImpulseVideoSource,
  data: unknown,
): ImpulseEmbedReport | null {
  let message: unknown = data
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data)
    } catch {
      return null
    }
  }
  if (!message || typeof message !== 'object') return null
  const { event, info } = message as { event?: unknown; info?: unknown }

  if (source.art === 'youtube') {
    if (event === 'onStateChange') return youtubeState(info)
    if (
      (event === 'infoDelivery' || event === 'initialDelivery') &&
      info &&
      typeof info === 'object'
    ) {
      const { playerState, muted, currentTime, duration } = info as {
        playerState?: unknown
        muted?: unknown
        currentTime?: unknown
        duration?: unknown
      }
      const report: ImpulseEmbedReport = { ...youtubeState(playerState) }
      if (typeof muted === 'boolean') report.muted = muted
      const time = seconds(currentTime)
      if (time !== undefined) report.time = time
      const length = seconds(duration)
      if (length) report.duration = length
      return Object.keys(report).length > 0 ? report : null
    }
    return null
  }
  if (source.art === 'vimeo') {
    if (event === 'play' || event === 'playing') return { playing: true }
    if (event === 'pause') return { playing: false, running: false }
    if (event === 'ended') return { playing: false, running: false, ended: true }
    if (event === 'timeupdate' || event === 'playProgress') {
      const { data } = message as { data?: { seconds?: unknown; duration?: unknown } }
      const report: ImpulseEmbedReport = {}
      const time = seconds(data?.seconds)
      if (time !== undefined) report.time = time
      // Rückt die Zeit vor, bewegt sich das Bild.
      if (time) report.running = true
      const length = seconds(data?.duration)
      if (length) report.duration = length
      return Object.keys(report).length > 0 ? report : null
    }
    return null
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

# AntiDoom Shorts

Datengetriebene 9:16-Kurzvideos (1080×1920, 30 fps) für die AntiDoom-App.
Eine Episode ist **ein JSON-File**. Daraus entstehen Vertonung (Google TTS, Chirp 3 HD), Timing, Untertitel und das fertige MP4.

```
content/<episode>.json ──► npm run tts ──► public/episodes/<id>/audio/*.wav
        │                      │            public/episodes/<id>/manifest.json  (Dauern, Sprechpausen, Phrasen-Timing)
        │                      ▼
        └──────────────► Remotion (calculateMetadata liest Manifest → exakte Länge, Wort-Timing)
                               │
                               ▼
                        npm run render ──► out/<id>.mp4
```

## Woche für Woche – so läuft das Generieren

Für jedes Video braucht es nur **ein JSON in `content/`** – den Rest erledigen zwei Befehle. In einer
Claude-Sitzung (Cloud) sieht das so aus:

1. **Texte schreiben.** Claude nimmt die Woche aus dem Themenpaket der App (`src/lib/impulsePack.ts`,
   Thema, Karten, Challenge, Frage der Woche) und schreibt daraus je Video ein Episode-JSON: Szenen,
   Sprechtext, Stichwörter fürs Bild. Neue Episode in `src/episodes.ts` eintragen.
2. **Vertonen:** `npm run tts -- content/<episode>.json` – Google spricht jede Szene, das Skript misst
   die Pausen und schreibt das Timing (Untertitel, Musik-Ducking).
3. **Rendern:** `npm run render -- <episode-id>` → `out/<episode-id>.mp4` (1080×1920). Claude schickt
   das MP4 zum Anschauen; Änderungen am Text kosten nur die geänderte Szene neu.
4. **Freigeben:** Gefällt es, kommt es in die App als Video-Karte mit eigener Videodatei
   (`public/shorts/` der App, `ownShort` im Themenpaket) – die spielt ohne YouTube-Knöpfe.

**Damit es packt:**

- **Jede Folge einen anderen Look** (`look`, siehe unten) – mit eigener Musik und eigener Stimme.
- **Die ersten zwei Sekunden entscheiden.** Gleich ein starkes Bild und ein Satz, der neugierig
  macht: «Null Kampferfahrung.», «Eine Nachricht von der Front.», «Zweitausend Teenager. Ihr Auftrag: …».
- **Zur nächsten Karte überleiten.** Die letzte Szene ist ein `teaser`: Sie zeigt die Karte, die im
  Feed direkt danach kommt (Umfrage, Quiz, Dilemma, Aufgabe), und lädt mit einer Wisch-Geste ein.
  Darum steht das Video im Paket direkt vor dieser Karte. Was die Karte fragt, verrät das Video nicht.
- **50 bis 65 Sekunden.** Kurze Szenen, eine Aussage pro Szene, Pausen mit `[pause short]`.

Vollautomatisch kann das eine **geplante Aufgabe** sein (z.B. jeden Donnerstag): Claude legt die Shorts
der nächsten Woche an, rendert sie und schickt sie zur Freigabe – du schaust nur noch und sagst ja.

**In der Claude-Cloud-Umgebung** braucht es zwei Dinge:

- Den Google-Schlüssel als Umgebungsvariable `GOOGLE_TTS_API_KEY` in den Einstellungen der Umgebung
  (Menü der Cloud-Umgebung in der Titelleiste → Edit). Derselbe Schlüssel wie bei der Lernapp
  (Projekt mit Chirp 3 HD, bis 1 Mio. Zeichen im Monat gratis; ein Short sind etwa 600–900 Zeichen).
  Eine **neue Sitzung** sieht die Variable, eine laufende nicht.
- Den vorinstallierten Chromium:
  `REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
  (sonst will Remotion ihn herunterladen, und das blockt das Netz der Umgebung).

**Schrifttexte prüfen:** Die Cloud-Umgebung erreicht die Website der Kirche nicht. Versnummern und
Abläufe lassen sich mit dem englischen Text prüfen (npm-Paket `@bencrowder/scriptures-json`, als Daten
gelesen); wörtliche deutsche Zitate (`quote`-Szenen) vor dem Veröffentlichen mit der deutschen Ausgabe
abgleichen. Die Folgen der Woche 19.–25.10. sagen alles in eigenen Worten, mit Stellenangabe.

**Aussprache:** Namen wie Helaman, Antipus, Antiparah oder Moroni spricht Google selbst aus. Eigene
Aussprachen (`pronunciations`, IPA) lehnt Chirp 3 HD derzeit ab – das Skript vertont dann ohne sie.
Beim Anschauen kurz darauf achten.

## Schnellstart

```bash
npm install
cp .env.example .env              # GOOGLE_TTS_API_KEY eintragen
npm run tts -- content/2026-10-22-mission-lockvogel.json
npm run studio                    # Vorschau im Browser, live editierbar
npm run render -- 2026-10-22-mission-lockvogel
```

Ohne Google-Key läuft alles trotzdem: Remotion schätzt das Timing, oder du vertonst offline mit Piper
(`PIPER_MODEL=…onnx npm run tts -- … --provider piper`). Die mitgelieferte Vorschau-Stimme ist Piper/Thorsten.

## Google TTS einrichten

1. Google-Cloud-Projekt → **Cloud Text-to-Speech API** aktivieren, Billing aktiv.
2. API-Key erstellen und unter *API-Einschränkungen* nur auf die Text-to-Speech API begrenzen.
3. In `.env`: `GOOGLE_TTS_API_KEY=…` (alternativ `gcloud auth login`, dann wird ein Access-Token verwendet).

Stimme pro Episode in `voice.name`, z.B. `de-DE-Chirp3-HD-Charon` (ruhig), `-Puck` (lebhaft), `-Fenrir`, `-Orus`,
weibliche Stimmen `-Kore`, `-Aoede`, `-Leda`. Schnelltest einer anderen Stimme ohne JSON-Änderung:

```bash
npm run tts -- content/<episode>.json --voice de-DE-Chirp3-HD-Puck --rate 1.05
```

Pausen im Text: `[pause short]`, `[pause]`, `[pause long]` (Chirp-Markup). Aussprache-Korrekturen in `pronunciations` (IPA).
Beides sind laut Google Preview-Features – lehnt die API sie ab, vertont das Skript automatisch ohne sie und warnt.

## Eine neue Episode anlegen

1. `content/2026-11-29-moroni.json` anlegen (Vorlage: die Oktober-Episode kopieren).
2. In `src/episodes.ts` importieren und ins Array aufnehmen.
3. `npm run tts -- content/2026-11-29-moroni.json` → `npm run studio` → `npm run render -- 2026-11-29-moroni`.

Das JSON wird mit zod validiert (`src/schema.ts`). Fehler wie doppelte Szenen-IDs oder Zitate, die in der Narration
nicht wörtlich vorkommen, fallen beim TTS-Lauf auf – nicht erst nach dem Rendern.

### Szenentypen

| `type` | Wofür | Wichtige Felder |
|---|---|---|
| `bigNumber` | Hook mit hochzählender Zahl über Punktefeld | `number`, `label`, `captionSkipWords` |
| `illustration` | Bild mit Ken-Burns **oder** generatives Motiv | `image` (Pfad in `/public`) oder `motif`: `swords`, `horizon`; `cue`: Phrase, bei der das Motiv seinen Moment hat |
| `quote` | Schriftstelle, Wörter leuchten synchron zur Stimme | `quote` (muss wörtlich in `narration` stehen), `ref` |
| `dotField` | Zählen bis alle da sind, danach Titel | `count`, `completeAt`, `titleAt`, `title` |
| `kinetic` | Zeilen knallen nacheinander ins Bild | `lines` (je wörtlich in `narration`) |
| `cta` | Frage der Woche + Challenge-Karte | `question`, `challenge`, `footer`, `holdAfterSec` |

Szenen der Looks:

| `type` | Wofür | Wichtige Felder |
|---|---|---|
| `hero` | Videospiel: Charakterkarte mit Pixel-Figur | `title`, `subtitle`, `select`, `chips` (`text`, `at`, `tone`), `stats` (`label`, `value`, `at`), `unlock` (`badge`, `text`, `at`) |
| `chat` | Handy: Sperrbildschirm oder Chatverlauf | `mode` (`lock`/`thread`), `contact`, `lock`, `messages` (`kind`: `text`/`sticker`/`plan`/`divider`, `text`, `at`) – ohne `at` steht eine Nachricht schon im Verlauf |
| `map` | Kartentisch: die Lockvogel-Taktik in Etappen | `stage` (`intro`, `plan`, `bait`, `chase`, `halt`, `battle`, `count`), `cues` (die Takte der Etappe) |
| `relay` | Stadion: Glaube als Staffelstab | `stage` (`sword`, `run`, `mother`, `handoff`, `you`), `cues`, `line`, `chips` |
| `teaser` | Vorschau auf die nächste Karte im Feed | `label`, `question`, `options` oder `scale`, `hint` |

`at`, `cues` und `line` sind Phrasen aus der `narration`: Etwas passiert genau dann, wenn die Stimme
es sagt. Die Validierung prüft, dass jede Phrase wörtlich vorkommt.

Gemeinsam: `narration`, `sky` (0 = Nacht … 1 = goldener Morgen; wird weich interpoliert), `ref`, `captions`, `holdAfterSec`.

### Looks

| `look` | Stil | Musik (Vorschlag) |
|---|---|---|
| `dawn` | Sonnenaufgang über Hügeln (Standard) | `music/pad-dawn.mp3` |
| `arcade` | Videospiel: Neon-Raster, Pixel-Schrift | `music/arcade.mp3` |
| `chat` | Handy mit weichen Lichtern | `music/lofi.mp3` |
| `map` | Pergament auf dunklem Holztisch | `music/chase.mp3` |
| `track` | Stadion in der Abenddämmerung | `music/anthem.mp3` |

Der Look färbt auch Untertitel, Quellenangabe und die `kinetic`-Zeilen (mit eigenem Auftritt und Ton).

## Wie das Timing funktioniert

- Szenenlänge = 0.4 s Vorlauf + gemessene Audiodauer + 0.45 s Nachlauf + `holdAfterSec` (min. 2.2 s).
  Überblendungen (9 Frames) liegen im Vorlauf, damit kein Wort im Crossfade beginnt.
- `scripts/tts.ts` misst im Audio Sprechbeginn, -ende und Pausen (10-ms-Energiefenster, Schwelle relativ zum Peak)
  und rastet die Textphrasen (Satzzeichen, Pausen-Tags) auf echte Pausen ein. Wörter werden innerhalb der Phrase
  nach Länge verteilt. Ergebnis: Wort-Highlighting meist auf ±100 ms genau, ohne Whisper.
- Musik wird während der Sprache automatisch abgesenkt (Ducking mit Rampen), Ein-/Ausblendung am Anfang/Ende.

## Robustheit / Edge Cases

| Fall | Verhalten |
|---|---|
| TTS noch nie gelaufen | Studio/Render schätzen Dauer (~2.5 Wörter/s), Video ohne Stimme |
| Narration geändert, TTS nicht neu gelaufen | Betroffene Szene wird erkannt (Textvergleich) und geschätzt statt asynchron |
| Gleicher Text erneut | Cache-Treffer (Hash über Provider, Stimme, Rate, Text, Aussprache) – keine Kosten |
| Abbruch mitten im Lauf | Audio wird als `.part` geschrieben und atomar umbenannt; Aufräumen erst nach gültigem Manifest |
| 429 / 5xx / Netzfehler | Bis zu 5 Versuche mit exponentiellem Backoff, `Retry-After` wird respektiert |
| 401 / 403 | Sofortiger Abbruch mit Hinweis (API aktiv? Billing? Key-Einschränkung?) |
| Szene > 5000 Bytes | Abbruch vor dem Request mit Hinweis zum Aufteilen |
| Zitat/Cue nicht in Narration | Validierungsfehler; im Render-Fallback gleichmässige Verteilung |
| Fonts | Lokal in `/public/fonts` (SIL OFL) – Render braucht kein Internet |

## Performance

- Ein 55-s-Short = ~1650 Frames. Auf 2 CPU-Kernen ca. 10–15 Min., auf einem aktuellen 8–16-Kern-Desktop wenige Minuten
  (`RENDER_CONCURRENCY` = Anzahl Kerne, Remotion rendert im Chromium auf der CPU).
- Schnelle Vorschau: `npm run render -- <id> --scale 0.5` (540×960). Kontrollbilder: `npm run still -- <id> --frames 40,400,900`.
- Teure Elemente bewusst vermieden: keine SVG-Filter pro Frame (Grain ist eine gekachelte Textur), Punktefeld ohne Blur.
- Eigener Chromium (Docker/NAS): `REMOTION_BROWSER_EXECUTABLE=/pfad/zu/chrome-headless-shell`.

## Rechte

- Schriften: Anton, Inter, Cormorant Garamond – SIL Open Font License.
- Musik in `public/music/`: selbst synthetisiert, frei verwendbar. `npm run pad` macht den Sonnenaufgangs-Pad,
  `npm run music -- --style arcade|lofi|chase|anthem --sec 75 --out x.wav` die übrigen (fürs Repo mit
  `ffmpeg -i x.wav -b:a 128k x.mp3` verkleinert). Für die echte Produktion besser Musik mit klarer Lizenz.
- Soundeffekte in `public/sfx/`: mit `npm run sfx` selbst synthetisiert, frei verwendbar.
- Schriften zusätzlich: Press Start 2P (Pixel) und Caveat (Handschrift) – SIL Open Font License.
- Emoji in Chat-Stickern kommen aus der Emoji-Schrift des Systems (im Cloud-Container: Noto Color Emoji).
- Schrifttexte: Zitate aus der deutschen Ausgabe des Buches Mormon. Kirchliche Bilder/Videos aus der Mediathek nur gemäss
  deren Nutzungsbedingungen verwenden; kein Logo/keine Wortmarke der Kirche.

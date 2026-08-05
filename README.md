# Bischofschaft

Progressive Web App für die administrativen Aufgaben einer Bischofschaft:
Sitzungen mit Traktanden- und Pendenzenliste, Programm der
Abendmahlsversammlung, Berufungsverwaltung und Mitgliederdaten.

- **Produktion:** [bss.alae.app](https://bss.alae.app) (Netlify)
- **Konzept:** [`docs/KONZEPT.md`](docs/KONZEPT.md)

---

## Auf einen Blick

| Bereich                   | Was die App leistet                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Sitzungen**             | Termin festlegen, Traktanden und Pendenzen sammeln, Sitzungsmodus zum Durchgehen, Protokoll drucken |
| **Pendenzen**             | Was eine Sitzung überstanden hat, ohne erledigt zu werden – alles oder nur das eigene               |
| **Notizen**               | Was nicht an eine Sitzung gehört – für alle sichtbar, speichert von selbst                          |
| **Putzplan**              | Die Halbjahrestabelle der Gemeinde als Wochenplan – Grundlage für die Ansage am Sonntag             |
| **Abendmahlsversammlung** | Ganzer Ablauf pro Sonntag: Leitung, Bekanntmachungen, Angelegenheiten, Ansprachen, Musik, Gebet     |
| **Aktivitäten AP's**      | Aktivitätenplan der Priestertumskollegien – teilbar mit Beratern, ohne Einblick in Personendaten    |
| **Berufungen**            | Wer welche Aufgabe hat, gruppiert nach Organisation – und wer keine hat; Stand aus dem LCR          |
| **Mitglieder**            | Stammdaten, Notizen, Suche – gefiltert nach Status, Geschlecht und Alter, sortiert wonach man will  |

**Auf jeder Seite oben rechts «Ansicht».** Was die Darstellung betrifft –
welcher Ausschnitt, welche Filter, welche Reihenfolge –, steht dort und
nirgends sonst. Über der Liste bleibt so Platz für die Liste. Am Telefon zieht
das Menü als Blatt von unten auf, ab dem Tablet klappt es unter dem Knopf auf.

Traktandum und Pendenz sind derselbe Datensatz: Was in einer Sitzung offen
bleibt, erscheint automatisch wieder – ohne Umtragen, und in der nächsten
Sitzung unter den **Pendenzen** statt unter den neuen **Traktanden**.

**Ein `@` im Traktandum öffnet die Mitgliederliste.** In Titel und
Beschreibung genügt das Zeichen und der Anfang eines Namens; die Auswahl
setzt den vollen Namen in den Text. Das `@` verschwindet, der Name bleibt
farbig und anklickbar und führt zur Person – und «Zurück» wieder genau zu
dem Punkt, den man gerade gelesen hat. Passt niemand aus der Liste, bleibt
schlicht stehen, was getippt wurde.

**Importe stehen gesammelt unter «Einstellungen → Importe»** und nirgends
sonst. Ein Import ersetzt ganze Bereiche; ein Knopf dafür neben der Arbeit am
einzelnen Eintrag lädt zu Unfällen ein.

---

## Technik

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Firebase (Firestore +
Authentication) · vite-plugin-pwa

---

## Einrichtung

### 1. Repository und Abhängigkeiten

```bash
git clone <repository-url>
cd BSS
npm install
```

### 2. Firebase-Zugangsdaten hinterlegen

```bash
cp .env.example .env
```

Die Werte stehen in der Firebase-Konsole unter
**Projekteinstellungen → Allgemein → Meine Apps → Web-App → SDK-Konfiguration**.

> Diese Schlüssel sind keine Geheimnisse – sie identifizieren nur das Projekt
> und stehen in jeder ausgelieferten Web-App im Klartext. Geschützt werden die
> Daten durch Authentication und die Regeln in `firestore.rules`.

### 3. Firebase-Projekt vorbereiten

In der Firebase-Konsole:

1. **Authentication → Sign-in method → E-Mail/Passwort** aktivieren.
2. **Firestore Database** anlegen (Region: `europe-west6` für Zürich oder
   `eur3` für Multi-Region Europa).

Dann Regeln und Indizes ausrollen:

```bash
npx firebase login
npm run deploy:rules -- --project DEINE-PROJEKT-ID
```

Danach übernimmt das GitHub Actions automatisch – siehe
[Automatisches Ausrollen](#automatisches-ausrollen).

### 4. Ersten Benutzer freischalten

Damit sich niemand selbst Zugriff auf Personendaten verschaffen kann, starten
**alle** neuen Konten mit der Rolle `pending`. Beim allerersten Konto gibt es
noch niemanden, der freischalten könnte – dieser eine Schritt läuft deshalb
über die Konsole:

1. In der App registrieren (E-Mail, Passwort, Name).
2. Firebase-Konsole → **Firestore Database** → Sammlung `users` → das eigene
   Dokument öffnen.
3. Feld `role` von `pending` auf `bishop` ändern.
4. In der App auf «Neu prüfen» klicken.

Alle weiteren Konten schaltest du danach in der App frei:
**Einstellungen → Benutzer und Rollen**.

### 5. Starten

```bash
npm run dev          # Entwicklungsserver auf http://localhost:5173
npm run test:import  # Parser, Namensabgleich und Reihenfolge des Ablaufs prüfen
npm run test:rules   # Zugriffsregeln gegen den Emulator prüfen
npm run build        # Produktions-Build nach dist/
npm run preview      # Build lokal prüfen
npm run lint         # ESLint
npx tsc -b           # Typprüfung
```

---

## Netlify

Das Repository enthält bereits eine `netlify.toml` mit Build-Befehl,
SPA-Weiterleitung, Sicherheits-Headern und Cache-Regeln.

Zu erledigen ist nur eines: Unter **Site configuration → Environment
variables** dieselben sechs `VITE_FIREBASE_*`-Variablen eintragen wie in der
lokalen `.env`. Ohne sie zeigt die App einen Hinweis statt des Anmeldeformulars.

Zusätzlich in der Firebase-Konsole unter **Authentication → Settings →
Authorized domains** die beiden Domains eintragen:

```
bss.alae.app
bischofschaft.netlify.app
```

Fehlt das, schlägt die Anmeldung in Produktion fehl.

---

## Automatisches Ausrollen

Änderungen an `firestore.rules` oder `firestore.indexes.json` werden von
GitHub Actions selbst ausgerollt, sobald sie auf `main` landen. Der Workflow
liegt in [`.github/workflows/firestore.yml`](.github/workflows/firestore.yml)
und arbeitet in zwei Schritten:

1. **Prüfen** – startet den Firestore-Emulator und lässt die Tests aus
   `tests/` gegen die Regeln laufen. Das passiert bei jedem Pull Request und
   bei jedem Push.
2. **Ausrollen** – nur bei einem Push auf `main` und nur, wenn Schritt 1 grün
   ist. So kann keine Regel produktiv werden, die den Zugriff auf
   Personendaten öffnet.

Der Reiter **Actions** auf GitHub erlaubt zusätzlich das Ausrollen von Hand
(_Firestore-Regeln → Run workflow_), etwa nach einem Wechsel des Projekts.

### Einmalige Einrichtung

Damit die Action im Namen des Projekts handeln darf, braucht sie ein
Dienstkonto. Das ist einmal aufzusetzen, danach läuft es von selbst.

**1. Schlüssel erzeugen.** Firebase-Konsole → Zahnrad → **Projekteinstellungen**
→ Reiter **Dienstkonten** → **Neuen privaten Schlüssel generieren**. Es lädt
eine JSON-Datei herunter. Diese Datei ist ein echtes Geheimnis – sie gehört
nicht ins Repository und nicht in eine Chat-Nachricht.

**2. Berechtigungen vergeben.** Das frisch erzeugte Konto darf standardmässig
noch keine Regeln ausrollen. In der
[Google-Cloud-Konsole](https://console.cloud.google.com/iam-admin/iam) das
richtige Projekt wählen, in der Liste den Eintrag
`firebase-adminsdk-…@dein-projekt.iam.gserviceaccount.com` suchen, auf das
Stift-Symbol klicken und zwei Rollen ergänzen:

| Rolle                           | Wofür                             |
| ------------------------------- | --------------------------------- |
| **Firebase Rules Admin**        | `firestore.rules` veröffentlichen |
| **Cloud Datastore Index Admin** | Indizes anlegen und ändern        |

**3. Zwei Secrets hinterlegen.** GitHub → Repository → **Settings** →
**Secrets and variables** → **Actions** → **New repository secret**:

| Name                       | Inhalt                                                       |
| -------------------------- | ------------------------------------------------------------ |
| `FIREBASE_SERVICE_ACCOUNT` | der **gesamte** Inhalt der JSON-Datei aus Schritt 1          |
| `FIREBASE_PROJECT_ID`      | die Projekt-ID, derselbe Wert wie `VITE_FIREBASE_PROJECT_ID` |

Beim JSON die komplette Datei einfügen, von der ersten geschweiften Klammer
bis zur letzten. Fehlt eines der beiden Secrets, bricht der Workflow mit einer
Meldung ab, die genau darauf hinweist.

**4. Löschen nicht vergessen.** Die heruntergeladene JSON-Datei vom eigenen
Rechner entfernen, sobald sie in GitHub hinterlegt ist.

### Wenn das Ausrollen scheitert

- _«Missing permissions»_ → Schritt 2 wurde übersprungen oder betraf das
  falsche Dienstkonto.
- _Indizes können nicht gelöscht werden_ → Der Workflow entfernt bewusst keine
  Indizes, die aus `firestore.indexes.json` verschwunden sind. Das wäre ein
  Eingriff, der laufende Abfragen brechen kann, und passiert deshalb nur von
  Hand über die Firebase-Konsole.

---

## Lokale Entwicklung mit Emulatoren

Zum Ausprobieren mit Testdaten – ohne echte Personendaten anzufassen:

```bash
npx firebase emulators:start --only auth,firestore
```

Dann in der `.env` ergänzen:

```
VITE_USE_EMULATOR=true
```

Die App verbindet sich anschliessend mit `127.0.0.1:9099` (Auth) und
`127.0.0.1:8080` (Firestore). Die Oberfläche der Emulatoren liegt auf
<http://127.0.0.1:4000>. Die Sicherheitsregeln aus `firestore.rules` gelten
dort ebenfalls – Änderungen daran lassen sich also lokal prüfen.

### Zugriffsregeln testen

```bash
npm run test:rules
```

Startet den Emulator, führt die Tests aus `tests/` aus und fährt ihn wieder
herunter. Die entscheidende Trennlinie verläuft zwischen `pending` und allen
übrigen Rollen. Geprüft wird deshalb vor allem, dass ein wartendes Konto
nichts liest, nichts schreibt und sich nicht selbst freischalten kann – und
dass umgekehrt jede freigeschaltete Rolle auf denselben Bestand kommt,
einschliesslich Programm der Abendmahlsversammlung, Gebete, Liederliste und
Notizen.

Dieselben Tests laufen in der CI, bevor Regeln ausgerollt werden.

---

## Übersicht

Die Startseite besteht aus **Kacheln**: nächste Sitzung, Zahlen, Ansprachen,
Aktivitäten AP's, Geburtstage, eigene Pendenzen. Was jemanden zuerst
interessiert, ist von Person zu Person verschieden – deshalb sagt **Ansicht**
oben rechts, was davon erscheint:

- **Begrüssung und Gemeinde** ein- oder ausblenden. Abgewählt beginnt die Seite
  gleich mit der ersten Kachel – am Telefon zwei gewonnene Zeilen.
- Je Kachel: **Haken** blendet ein, die **Pfeile** ordnen, und **Haupt / Seite /
  Breit** bestimmt den Platz – die breite Hauptspalte, die schmale daneben oder
  die ganze Breite.
- Wo etwas gezählt wird, steht dort auch, **wie viele** es sein sollen.

Die **Reihenfolge gilt immer**, unabhängig vom Platz: Wer «Nächste Sitzung»
nach oben stellt, findet sie oben – auch als breite Kachel. Die Seite geht die
Liste von oben nach unten durch und beginnt bei jedem Wechsel zwischen «breit»
und «zweispaltig» ein neues Band; nebeneinander steht damit nur, was in der
Liste auch nebeneinander eingereiht ist.

Die Wahl liegt im Browser: Sie gehört zum Gerät, an dem man sitzt, und ist
schon da, bevor der erste Schnappschuss aus Firestore eintrifft.

---

## Sitzungen, Traktanden und Pendenzen

**Sitzungen** in der Seitenleiste. Eine Sitzung wird geplant, gestartet,
durchgeführt und abgeschlossen; danach lässt sich das Protokoll drucken.

**Die Liste zeigt auf Wunsch den Inhalt mit** – «Ansicht» oben rechts stellt
je Gruppe ein, ob die Titel genügen oder der ganze Eintrag zu lesen sein soll.
Damit wird die Sitzungsliste zum Programm mehrerer Sitzungen. Ein Griff auf
einen Eintrag öffnet ihn dort in einem Fenster und lässt ihn ändern, ohne dass
die Liste verlassen werden muss; erledigen, verschieben und löschen stehen
darin ebenfalls. Ein «@»-Name im Eintrag führt weiterhin zur Person.

**Zuoberst stehen die vier Angaben, die zu Beginn festgehalten werden**:
Anwesenheit, Anfangsgebet, Schlussgebet und geistiger Gedanke – je eine Zeile
mit den Konten der Bischofschaft und der Sekretäre als Knöpfe. Ein Griff je
Person, gespeichert wird sofort; ein Fenster dafür gibt es nicht. Bei der
Anwesenheit sind mehrere möglich, bei den übrigen dreien genau eine, und ein
zweiter Griff nimmt die Wahl wieder zurück.

### Traktandum oder Pendenz

Beides ist derselbe Datensatz, aber nicht dasselbe Wort:

- **Traktandum** – neu auf die Liste gesetzt, in dieser Sitzung zum ersten Mal
  dran.
- **Pendenz** – hat eine frühere Sitzung überstanden, ohne erledigt zu werden.

Der Weg führt nur in eine Richtung. Wird eine Sitzung abgeschlossen, wandert
alles Unerledigte **auf die nächste geplante Sitzung** und ist von da an eine
Pendenz; dort steht es unter **Pendenzen** und nicht unter den neuen
Traktanden. Steht noch keine nächste Sitzung fest, bleibt es im Sammelkorb und
erscheint so lange unter «Pendenzen»; die nächste Sitzung holt es mit einem
Griff zurück («_n_ Pendenzen» in der Werkzeugleiste). Die beiden Gruppen stehen unter eigenen
Überschriften, **zuerst die neuen Traktanden, danach die Pendenzen** – in
dieser Reihenfolge geht eine Sitzung durch, und der erste Teil ist nicht eine
Wiederholung der letzten. Angeschrieben wird nur die Pendenz: dass sie pendent
ist, sagt schon das Wort.

### Drei Status

| Status       | Wann                                                 |
| ------------ | ---------------------------------------------------- |
| **Neu**      | eingetragen, bevor die Sitzung gestartet wurde       |
| **Pendent**  | die Sitzung läuft, der Punkt ist noch nicht abgehakt |
| **Erledigt** | als erledigt markiert                                |

Der Start der Sitzung macht aus allem, was «Neu» ist, «Pendent». Mehr
Abstufungen gibt es nicht: Am Sitzungstisch zählt einzig, ob ein Punkt
erledigt ist. Frühere Fassungen kannten «Offen», «In Arbeit»,
«Zurückgestellt» und «Verworfen» – was in der Datenbank noch so dasteht, liest
sich heute als «Pendent» bzw. «Erledigt».

### Sitzungsmodus: schreiben, während gesprochen wird

Ein Punkt gross im Bild, darüber die Sprungleiste, darunter die Statusknöpfe.
**Es gibt keinen Bearbeiten-Stift und kein Bearbeiten-Fenster mehr** – der
Eintrag selbst ist das Formular:

- **Titel und Beschreibung** sind Text, in den man hineingreift. Gespeichert
  wird kurz nach dem letzten Tastendruck und noch einmal beim Weiterblättern.
  Gemeldet wird nur, was zu tun ist – ein fehlender Titel oder ein Schreiben,
  das nicht durchkam.
- **Zuständig** (niemand vorausgewählt) steht unmittelbar darunter. Zur Wahl
  stehen der Bischof, beide Ratgeber und die Sekretäre – ein Klick genügt.
- Sonst nichts. Bereich, betroffene Mitglieder, **Priorität**, **Erledigen
  bis**, das Kennzeichen «vertraulich» und die eigene Notizliste je Traktandum
  sind weggefallen: Was besprochen wurde, gehört in die Beschreibung.

**Kein Fälligkeitsdatum und keine Priorität.** Beide sagten dasselbe noch
einmal und meist anders: Eine Pendenz gehört in eine Sitzung, und die hat
bereits ein Datum; was zuerst drankommt, sagt die Reihenfolge der Liste, und
die lässt sich von Hand festlegen. Aus «Verschieben» ist deshalb ein einziger
Knopf geworden – **auf die nächste Sitzung**. Die früheren Ziele «um eine
Woche», «um einen Monat», «eigenes Datum» setzten bloss einen Termin, an dem
nichts geschah.

Oben steht, wo man innerhalb der eigenen Gruppe ist – «2 von 5 Traktanden»,
später «1 von 8 Pendenzen». Auch die Sprungleiste zählt je Gruppe von vorn und
lässt zwischen ihnen eine Lücke. Nach «Erledigt» rückt die App von selbst zum
nächsten Punkt; am Laptop blättern die Pfeiltasten.

### Variables Layout

Nicht jedes Traktandum ist ein Absatz Text. Manches ist eine kleine Tabelle –
Aufgabe, wer, bis wann. Der Haken **Variables Layout** stellt beim Erfassen an
die Stelle der Beschreibung ein Raster, das sich selbst zusammenstellen lässt.

Der Haken steht **nur im Fenster «Neues Traktandum»**. Ob ein Punkt Text ist
oder Tabelle, entscheidet sich einmal; über zwanzig Pendenzen hinweg stand er
sonst überall, wo ihn niemand brauchte. Ein Raster, das einmal gebaut ist,
lässt sich weiterhin überall ausfüllen und ändern – es tritt schlicht an die
Stelle der Beschreibung.

### Liste: Reihenfolge festlegen

Die Listenansicht ist zum Vorbereiten da. Jede Zeile ist zugeklappt schmal und
zeigt Titel und das Nötigste; ein Klick klappt sie auf, und dann steht der
ganze Inhalt da – und lässt sich gleich dort ändern. Anklickbar ist dabei die
**ganze Kopfzeile**, nicht bloss der Titel: zugeklappt die Zeile, aufgeklappt
der Bereich bis zur Trennlinie. Die Knöpfe darin (Pfeile, Haken) behalten
ihren Klick bei sich.

Aufgeklappt stehen unter dem Eintrag die vier Daten, die ihn einordnen:
**nächste Sitzung** (wann er das nächste Mal drankommt), **erfasst**,
**ursprünglich** (die Sitzung, in der er zum ersten Mal stand) und **zuletzt
bearbeitet**. Was fehlt, steht nicht da – ein «–» hinter einer Beschriftung
sagt nichts, das die leere Stelle nicht auch sagt.

Umsortiert wird innerhalb einer Gruppe, auf zwei Wegen: mit den **Pfeilen** an
jeder Zeile (auch am Handy) oder durch **Ziehen und Ablegen** am Zeigergerät.
Die Reihenfolge gilt für alle und bestimmt auch, in welcher Folge der
Sitzungsmodus durchgeht. Zwischen den Gruppen wird nicht verschoben – eine
Pendenz zu den neuen Traktanden zu ziehen hiesse, sie zurückzudatieren.

### Bekanntmachung und Angelegenheit aus der Sitzung heraus

Neben **+ Traktandum** stehen **+ Bekanntmachung** und **+ Angelegenheit**.
Beides fällt in der Sitzung laufend an – «das sagen wir am Sonntag an», «den
bestätigen wir» –, und bis anhin hiess das: die Sitzung verlassen, den Sonntag
suchen, zurückfinden. Drei Handgriffe für einen Satz.

Ein Klick öffnet stattdessen ein Fenster über der Sitzung. Gefragt wird zuerst
nach dem **Sonntag** – vorgeschlagen ist der nächste, zur Wahl stehen die
nächsten acht –, danach folgen die Felder. Der Eintrag wird beim gewählten
Sonntag **angehängt**; alles, was dort schon steht, bleibt unberührt, auch
wenn jemand anders gleichzeitig daran arbeitet. Wer mehr als den einen Satz
braucht, findet unten den Weg zum ganzen Sonntag.

### Namen im Text

Ein `@` mitten im Satz öffnet die Mitgliederliste. Nach der Auswahl steht der
volle Name im Text, das `@` verschwindet – der Name bleibt aber **farbig
unterlegt und anklickbar** und führt zur Person in der Mitgliederliste. Der
Weg zurück führt nicht in die Liste, sondern genau zu dem Punkt, den man
gerade gelesen hat; die Adresse merkt sich dafür den offenen Eintrag
(`…/sitzungen/<id>?traktandum=<id>`).

### Der Weg zurück

Das gilt überall: **Zurück führt einen Schritt zurück, nicht zwei.** Wer unter
«Ansprachen» im Reiter «Vorschläge» steht, ein Mitglied öffnet und zurückgeht,
landet wieder bei den Vorschlägen – nicht beim Programm und nicht in der
Mitgliederliste.

Zwei Dinge zusammen machen das aus (siehe
[`src/hooks/useBack.ts`](src/hooks/useBack.ts) und
[`src/hooks/useUrlState.ts`](src/hooks/useUrlState.ts)):

- Der Zurück-Knopf geht **einen Eintrag im Browserverlauf zurück**, wie die
  Zurück-Geste des Telefons. Damit steht die vorige Adresse wieder da. Er
  schreibt sich auch selbst an, wohin er führt – die App merkt sich beim
  Seitenwechsel, wo man war.
- Was eine Ansicht umschaltet, steht **in der Adresse**: der Reiter
  (`?ansicht=vorschlaege`), die Suche (`?suche=…`), der Ausschnitt der
  Berufungen, der aufgeklappte Eintrag. Nur dann gibt es überhaupt etwas,
  wohin man zurückkehren könnte. Das Umschalten selbst legt keinen neuen
  Verlaufseintrag an – man müsste sich sonst durch jede Zwischeneinstellung
  zurücktippen, bevor man die Seite verlässt.

---

## Abendmahlsversammlung

Ein Bereich, sechs Unterpunkte – oben wird der Sonntag gewählt, und er gilt
für alle Unterpunkte.

| Unterpunkt           | Wofür                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Leitung**          | Der ganze Ablauf auf einer Seite – zum Leiten am Pult, auf Knopfdruck änderbar                      |
| **Bekanntmachungen** | Liste pro Sonntag und wiederkehrende Serien; ein mehrzeiliges Feld je Eintrag, speichert von selbst |
| **Angelegenheiten**  | Bestätigungen, Entlassungen, Segnungen, Konfirmierungen                                             |
| **Ansprachen**       | Programmplätze vergeben, Vorschlagsliste, Verlauf                                                   |
| **Musik**            | Drei bis vier Lieder und Musikeinlagen                                                              |
| **Gebet**            | Anfangs- und Schlussgebet, mit «zuletzt gebetet»                                                    |

### Wer sich um diesen Sonntag kümmert

Neben **Programm** steht **Zuständig** – unter «Leitung» oben rechts, unter
«Ansprachen» bei jedem Sonntag. Zur Wahl stehen der Bischof und seine beiden
Ratgeber. Gemeint ist die Vorbereitung: Ansprachen anfragen, Gebete verteilen,
den Ablauf beisammenhalten. Wer am Pult präsidiert und wer leitet, steht
weiterhin im Ablauf selbst – das ist eine andere Frage und oft eine andere
Person.

Aufgeteilt wird das üblicherweise monatsweise, und genau so fragt der Dialog:
**Für den ganzen August** steht mit Haken da und schreibt die Angabe auf jeden
Sonntag des Monats. Ohne Haken gilt sie nur für diesen einen – für den
Sonntag, an dem jemand in den Ferien ist. Ein zweiter Griff auf denselben
Namen nimmt die Zuständigkeit wieder weg.

Sobald jemand eingetragen ist, steht der Name im Kopf jeder Unterseite der
Abendmahlsversammlung, gleich neben dem Datum.

### Was an diesem Sonntag stattfindet

Nicht jeder Sonntag ist eine gewöhnliche Abendmahlsversammlung, und die
Abweichungen haben Folgen für die Planung. Der Knopf **Programm** – unter
**Leitung** oben rechts, unter **Ansprachen** bei jedem Sonntag – legt fest,
was ansteht. Es ist dieselbe Angabe an beiden Orten: Wer sie unter
«Ansprachen» setzt, hat sie auch unter «Leitung» gesetzt.

| Art                              | Versammlung | Ansprachen |
| -------------------------------- | ----------- | ---------- |
| **Abendmahlsversammlung**        | ja          | ja         |
| **Fast- und Zeugnisversammlung** | ja          | nein       |
| **Darbietung der Kinder (DKA)**  | ja          | nein       |
| **JAE-Sonntag**                  | ja          | nein       |
| **Besondere Versammlung**        | ja          | ja         |
| **Pfahlkonferenz**               | nein        | nein       |
| **Generalkonferenz**             | nein        | nein       |

Ohne Versammlung fällt unter «Leitung» der ganze Ablauf weg und es steht
der Grund da; ohne Ansprachen bleibt der Sonntag unter «Ansprachen» ohne
offene Plätze, und die Übersicht meldet dort nichts als fehlend. Bereits
vergebene Ansprachen bleiben in beiden Fällen stehen – eine Zusage
verschwindet nicht, weil der Sonntag umgewidmet wurde.

Zwei Haken decken den Einzelfall ab, für den es keine eigene Art braucht:
**Es findet eine Versammlung statt** und **Es werden Ansprachen
eingeplant**. Sie stehen auf dem, was die Art vorgibt, und werden nur
festgehalten, wenn sie davon abweichen – eine Pfahlkonferenz, die
ausnahmsweise in der Gemeinde stattfindet, oder eine besondere Versammlung
ohne Ansprachen.

**Eigene Gründe.** Reicht die Liste nicht, steht in der Auswahl zuunterst
**＋ Neuer Grund …**: Bezeichnung eintragen, die beiden Haken setzen,
speichern. Der Grund gilt sofort für diesen Sonntag und steht danach an jedem
weiteren zur Wahl – eine Taufversammlung, ein Gemeindetag, ein Besuch der
Missionspräsidentschaft. Wer ihn nicht mehr braucht, nimmt ihn mit **Grund
entfernen** aus der Auswahl; die Sonntage, an denen er steht, behalten ihre
Bezeichnung, denn sie ist dort mitgeschrieben. Genau wie bei den Personen
unter «Es präsidiert».

**Automatisch** ist der Normalzustand und steht in der Auswahl zuoberst:

- der **erste Sonntag im Monat** ist die Fast- und Zeugnisversammlung,
- im **April und Oktober** ist an diesem Tag Generalkonferenz – dann findet
  in der Gemeinde nichts statt,
- alle übrigen Sonntage sind gewöhnliche Abendmahlsversammlungen.

Die Pfahlkonferenz steht an wechselnden Daten und wird deshalb von Hand
gesetzt. Und weil «Automatisch» eine eigene Wahl ist und kein geratener
Wert, ist jedes Festlegen mit einem Griff wieder rückgängig: **Wieder
automatisch** im selben Dialog.

**Leitung** zeigt den ganzen Ablauf – und alles darin lässt sich hier ändern:
Vorsitz und Begrüssung, Bekanntmachungen, Angelegenheiten, Lieder, Gebete,
Ansprachen und Musikeinlagen. Bei **Es präsidiert** und **Es leitet** stehen
die freigeschalteten Konten zur Wahl – und mit **Person hinzufügen** jede
weitere Person: Ist Besuch aus der Pfahlführung da, präsidiert er, und ein
Konto in der App hat er nicht. Ein einmal erfasster Name ist an jedem Sonntag
wählbar und lässt sich im selben Fenster wieder aus der Auswahl nehmen, ohne
aus schon erfassten Programmen zu verschwinden. Der Knopf **Bearbeiten**
blendet die Eingabefelder ein; gespeichert wird laufend, ohne Speichern-Knopf.

Ohne **Bearbeiten** steht da nur der Ablauf – so, wie er in der Versammlung
gebraucht wird: keine erklärenden Sätze, keine Verweise in andere Bereiche und
kein Punkt, zu dem nichts ansteht. Sind keine Bekanntmachungen oder
Angelegenheiten erfasst, fehlen sie in dieser Ansicht ganz und erscheinen erst
beim Bearbeiten wieder. Was noch offen ist, steht in Orange an seiner Stelle im
Ablauf. Ein Auswahlfeld daneben stellt mit **Kompakt · Mittel · Weit** ein, wie
gross Schrift und Abstände sind – am Pult wird aus Distanz gelesen, am
Schreibtisch zählt die Übersicht.

Oben rechts im Blatt sitzt der **Vollbild**-Knopf. Ein Klick, und alles
andere verschwindet: Kopfzeile, Navigation und Sonntagswahl weichen dem
Ablauf, der allein den Bildschirm füllt. Damit trotzdem klar bleibt, worum
es geht, steht im Vollbild zuoberst die Versammlung selbst –
«Abendmahlsversammlung» oder «Fast- und Zeugnisversammlung» – und darunter
der Sonntag; erst dann folgt der Ablauf, mit Luft zum oberen Bildschirmrand.
Derselbe Knopf – oder die Escape-Taste – holt alles zurück. Wo der Browser es zulässt, wird zusätzlich
sein echtes Vollbild angefordert, sodass auf dem Tablet auch die Adresszeile
verschwindet; wo nicht (auf dem iPhone etwa), genügt die Überlagerung. Die
Grössenwahl steht im Vollbild neben dem Knopf, weil die Kopfzeile dann weg
ist. Wer aus dem Bearbeiten heraus ins Vollbild geht, verlässt es dabei – was
noch offen war, wird vorher geschrieben.

Erfasst wird trotzdem nichts doppelt: Es sind dieselben Daten wie in den
übrigen Bereichen. Eine hier eingefügte Ansprache steht auch unter
**Ansprachen**, ein dort gewähltes Lied auch hier – und beide Seiten ordnen
gleich. Die Reihenfolge der Ansprachen ist ihre Position (`slot`), nach der
auch **Ansprachen** sortiert; wird sie auf der einen Seite verschoben, folgt
die andere. Zwischenlied und Musikeinlagen merken sich, nach wie vielen
Ansprachen sie folgen. Ohne Zutun ergibt das den Normalfall: eine Ansprache,
das Zwischenlied, die Schlussansprache.

Der Ablauf folgt dem Handbuch (Abschnitt 29.2.1), gekürzt auf das, was am Pult
gebraucht wird: Vorspiel, Willkommensgruss und Nachspiel stehen nicht im
Programm, sie ergeben sich von selbst. Die Nummerierung entsteht aus der Liste
– ein zusätzlicher Programmpunkt verschiebt alles Folgende.

**Ansprachen und Zeugnisse.** Wie viele Ansprachen eine Versammlung hat, steht
als Standard in den Einstellungen. Für einen einzelnen Sonntag lässt sich mehr
vorsehen: eine zusätzliche Ansprache, ein Zeugnis oder ein leerer Platz zum
späteren Vergeben. Der Standard bleibt davon unberührt.

**Drei Schritte:** _Vorgesehen → Angefragt → Zugesagt_. Ein vierter Schritt
«gehalten» wäre ein Klick nach der Versammlung, den niemand macht – und ohne
ihn stimmte die Auswertung «wer war lange nicht dran» nicht mehr. Deshalb
**zählt die Zusage**: Wer zugesagt hat und dessen Eintrag im Programm stehen
bleibt, hat gesprochen. Springt jemand kurzfristig ein, wird der Eintrag unter
«Leitung» geändert oder gelöscht, und die Statistik stimmt wieder. Im Verlauf
erscheint eine Zusage, sobald ihr Sonntag vorbei ist.

«Abgesagt» und «Gestrichen» sind aus demselben Grund weggefallen: Eine Absage
heisst, dass der Platz wieder frei ist, und das sagt man am deutlichsten,
indem man den Eintrag entfernt. Wo im Bestand noch einer dieser beiden Werte
steht, wird er nicht mehr angezeigt – der Platz gilt als frei.

**Ein Name von Hand.** Am Pult steht nicht immer jemand aus der eigenen
Gemeinde: ein besuchender Hoher Rat, die Missionare, «Zeugnisse der neuen
Ältesten». In jedes Namensfeld einer Ansprache lässt sich deshalb schreiben,
was dort stehen soll; darunter erscheint **«…» ohne Mitglied eintragen** (die
Eingabetaste tut dasselbe). Der Eintrag belegt seinen Programmplatz wie jeder
andere, ist aber keinem Mitglied zugeordnet und bleibt in der Auswertung «wer
war lange nicht dran» unberücksichtigt. Ein Mitglied wird ausschliesslich dann
zugeordnet, wenn es in der Vorschlagsliste angetippt wird – getippter Text
allein genügt dafür nie.

**Liederliste.** Unter **Einstellungen → Importe → Liederlisten** einlesen, dann genügt beim Erfassen
der Musik die Nummer – der Titel erscheint automatisch. Nur die Zahl, aus dem
PV-Liederbuch mit dem Kürzel davor: **«PV 6»**; es zählt wie das Gesangbuch ab
1, ohne das Kürzel wäre nicht zu sagen, welches gemeint ist. Doppelnummern
behalten ihren Buchstaben: «PV 18a». Eine Nummer, die nicht in der Liste steht,
lässt sich von Hand ergänzen und auf Wunsch in die Liste aufnehmen. Der Titel
wird im Programm mitgespeichert, damit ein bereits verteiltes Programm nach
einem Neuimport gleich bleibt.

**Gebet.** Oben stehen die beiden Plätze – Anfangs- und Schlussgebet –, jeder
mit einem Feld zum Suchen oder Eintippen. Darunter steht **eine**
Vorschlagsliste für beide: zwanzig Namen, geordnet nach Dringlichkeit, bei
jedem, wann die Person zuletzt gebetet hat; zuoberst, wer noch nie an der
Reihe war. Ein Griff auf **Anfang** oder **Schluss** teilt zu.

Zwei Listen standen hier einmal nebeneinander – dieselben Namen in derselben
Reihenfolge, zweimal untereinander. Sie beantworteten dieselbe Frage und
verdoppelten bloss die Höhe der Seite.

**«Heute nicht»** neben jedem Namen nimmt die Person für 30 Tage aus der
Liste – jemand ist krank, verreist, oder das Gespräch steht noch aus. Ohne das
blieben die immer gleichen drei Namen zuoberst stehen. Der Vermerk steht am
Mitglied und gilt damit für die ganze Bischofschaft; wer gerade übersprungen
wird, steht unter der Liste hinter «_n_ übersprungen» und lässt sich mit einem
Griff wieder aufnehmen.

### Vorschläge: wer als Nächstes angefragt wird

Der Reiter **Vorschläge** ordnet die Gemeinde nach Dringlichkeit: Wer noch nie
gesprochen hat, steht zuoberst, danach der längste Abstand. Bereits
eingeplante und zurückgestellte Personen rutschen ans Ende, statt zu
verschwinden – so bleibt sichtbar, warum sie gerade nicht in Frage kommen.

**«Bereits eingeplant» hört mit dem Sonntag auf.** Gemeint ist ein Platz, der
noch bevorsteht, und nicht eine Ansprache, die vor vier Jahren gehalten wurde.
Beides steht in derselben Sammlung – eine Zusage bleibt am Eintrag stehen,
denn sie **ist** der Verlauf –, unterschieden werden sie am Datum. Zählte auch
die Vergangenheit als Einplanung, wäre nach ein paar Jahren die halbe Gemeinde
gesperrt, und zwar ausgerechnet die Hälfte, die schon einmal gesprochen hat.
Gerechnet wird ab Tagesbeginn: Am Sonntag selbst fragt man ohnehin niemanden
mehr an.

**Der Filter.** Neben der Namenssuche steht **Filter**; die Zahl am Knopf sagt,
wie viele Einstellungen von der Voreinstellung abweichen, auch wenn das Menü
zu ist. Darin:

| Filter                      | Was er tut                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| **Nur seit über X Monaten** | Blendet aus, wer erst kürzlich dran war (Schwelle: Einstellungen) |
| **Erst ab X Jahren**        | Hält die Kinder heraus – sie haben ja noch nie gesprochen         |
| **Nur Aktive**              | Ohne diesen Haken stehen auch Inaktive zur Auswahl                |
| **Geschlecht**              | Alle, nur Frauen oder nur Männer                                  |
| **Zuletzt gesprochen**      | Eine oder mehrere Jahrzahlen, dazu «noch nie»                     |
| **Zurückgestellte zeigen**  | Holt zurück, was «Nicht anfragen» ausgeblendet hat                |

Zur Wahl stehen nur Jahre, die im Bestand auch vorkommen – eine Jahrzahl, die
zu niemandem führt, wäre eine Auswahl ohne Antwort. Eine gewählte Jahrzahl
**sticht** dabei «nur seit über X Monaten»: Wer letztes Jahr gesprochen hat,
ist per Definition nicht überfällig, und die Frage «wer sprach 2025?» liesse
sich sonst gar nicht stellen.

**Nicht anfragen.** Neben **+ Anfragen** steht **Nicht anfragen**. Ein Griff
darauf stellt jemanden zurück: Die Person verschwindet aus den Vorschlägen und
kommt mit dem Haken **Zurückgestellte zeigen** wieder zum Vorschein – dort
heisst der Knopf dann **Wieder anfragen**.

Das ist das «im Moment nicht»: eine Krankheit, eine Abwesenheit, ein Gespräch,
das noch aussteht. Es ist bewusst etwas anderes als **Kann für Ansprachen
angefragt werden** am Mitglied selbst; dort steht das grundsätzliche «gar
nicht», und wer so gekennzeichnet ist, erscheint in keiner Vorschlagsliste
mehr. Beides steht auch auf der Seite des Mitglieds und lässt sich dort
ändern – ein Zustand, der nur in einer Liste sichtbar wäre, die ihn selbst
ausblendet, wäre nicht mehr zu finden.

Gesperrt ist damit nichts: Wer im Zuteilungsfenster ausdrücklich nach einer
zurückgestellten Person sucht, findet sie samt Vermerk und kann sie eintragen.
Der Vermerk hält sie aus den **Vorschlägen** heraus, nicht aus dem Programm.

### Angelegenheiten: Art, Person, Aufgabe

Ein Eintrag hat drei Spalten, mehr braucht er nicht:

| Spalte       | Was darin steht                                                    |
| ------------ | ------------------------------------------------------------------ |
| **Art**      | Bestätigung, Entlassung, Ordinierung, Konfirmierung, Segnung, …    |
| **Mitglied** | Aus dem Verzeichnis – tippen genügt, gewählt wird aus den Treffern |
| **Aufgabe**  | Funktion bzw. Berufung: «Lehrer in der Sonntagsschule»             |

Vorgelesen wird daraus «_Name_ – _Aufgabe_»; genauso steht es unter
«Leitung» im Ablauf. Der Name wird beim Eintrag mitgeschrieben, damit ein
Programm von vor zwei Jahren auch dann lesbar bleibt, wenn der Datensatz
später nicht mehr da ist – wie beim Liedtitel und beim Namen der leitenden
Person.

**An der Berufung ändert das nichts.** Wer welche Berufung hat, sagt allein
das LCR und der Import von dort; diese Liste ist der Wortlaut für den Sonntag
und sonst nichts. Früher liessen sich Einträge aus dem Bereich «Berufungen»
übernehmen und blieben mit ihnen verknüpft – das ist weggefallen, zusammen
mit dem Feld «Betroffene Mitglieder».

Einträge aus früheren Fassungen tragen statt Person und Aufgabe einen
Freitext. Er bleibt lesbar stehen und wird darunter angezeigt, bis jemand die
beiden Felder ausfüllt – überschrieben wird nichts von selbst.

---

## Wiederkehrende Bekanntmachungen

**Abendmahlsversammlung → Bekanntmachungen → Wiederkehrend**.

Manches wird nicht einmal gesagt, sondern immer wieder: der Tempeltag jeden
dritten Sonntag, der Dank ans Putzteam jede Woche. Eine **Serie** wird einmal
erfasst und erscheint danach von selbst an jedem Sonntag, an dem sie fällig
ist – auch an einem, den noch nie jemand geöffnet hat.

Sie wird **nicht** in die einzelnen Sonntage geschrieben, sondern bei jedem
Aufruf dazugerechnet. Das hat zwei Folgen, und beide sind gewollt: Wer den
Wortlaut ändert, ändert ihn für jeden künftigen Sonntag; und die Serie steht
auch dort, wo sonst noch nichts erfasst ist.

**Ein Feld, nicht zwei.** Der **Wortlaut** ist alles, was erfasst wird – so
lang und so mehrzeilig, wie er sein muss. Daneben stand einmal ein Zusatz
«Einzelheiten für die Person am Pult»; er verlangte eine Einteilung, die
niemand vornehmen wollte, und ist weggefallen. Wo er noch ausgefüllt ist,
wird er weiterhin angezeigt.

**Wie oft.** Entweder jeden Sonntag oder bestimmte Sonntage im Monat – 1. bis 5. und «letzter», auch mehrere zugleich. Gezählt wird im Kalender: Der 3. Sonntag ist der dritte Sonntag dieses Monats, ganz gleich, auf welchen
Wochentag der Monatsanfang fällt. Dazu ein **Ab**-Datum und wahlweise ein
**Bis**.

**Löschen – die Wahl.** Der Papierkorb an einer wiederkehrenden Bekanntmachung
fragt:

| Wahl                          | Was geschieht                                                              |
| ----------------------------- | -------------------------------------------------------------------------- |
| **Nur diesen Sonntag**        | Der Sonntag wird gestrichen, die Serie läuft weiter                        |
| **Diesen und alle künftigen** | Die Serie endet am Vortag; vergangene Sonntage behalten die Bekanntmachung |
| **Ganz löschen** (im Fenster) | Die Bekanntmachung verschwindet auch aus vergangenen Sonntagen             |

Vergangene Sonntage werden in den ersten beiden Fällen nie angetastet: Was
einmal von der Kanzel gesagt wurde, lässt sich nicht nachträglich streichen.

**Nur für diesen Sonntag anpassen** (das Sternchen) macht aus der Serie an
diesem einen Sonntag einen gewöhnlichen Eintrag: frei änderbar und
verschiebbar, während die Serie an allen anderen Sonntagen bleibt, wie sie
war.

Serien stehen in der Liste hinter den erfassten Einträgen – was diesen Sonntag
besonders macht, gehört nach vorn. Sie erscheinen genauso unter **Leitung**,
dort nur zum Vorlesen.

---

## Putzplan

**Putzplan** in der Seitenleiste, gleich unter den Notizen.

Die Gemeinde erstellt zweimal im Jahr eine Excel-Tabelle: je Woche eine
Gruppe, die Namen und der Zeitraum. Sie wird unter **Einstellungen → Importe →
Putzplan** eingelesen und steht danach als Wochenplan da – mit der laufenden
Woche hervorgehoben und, ganz oben, den zwei Zeilen für den nächsten Sonntag:
wem gedankt wird und wer als Nächstes an der Reihe ist.

**Gelesen wird nach Inhalt, nicht nach Spalte.** Die Tabelle hat keine
Kopfzeile, und wer sie pflegt, verschiebt die Spalten gelegentlich. Erkannt
werden deshalb die Zellen selbst: «Gruppe 7» ist die Gruppe, «13.7. - 18.7.»
der Zeitraum, die längste übrige Zelle sind die Namen, der Rest ist Bemerkung
(«Generalkonf.»). Zeilen ohne Zeitraum – Titel, Legenden, Leerzeilen – fallen
von selbst weg.

Das **Jahr** steht in der Überschrift («Putzplan 2026 Juli – Dezember»); fehlt
es, wird das laufende angenommen und das gemeldet. Wechselt es innerhalb des
Plans («27.12. – 2.1.»), wird das erkannt.

Der erste Tag einer Woche ist ihr Schlüssel: Derselbe Plan lässt sich beliebig
oft einlesen, ohne Dubletten anzulegen, und der Plan fürs zweite Halbjahr
ergänzt den ersten, statt ihn abzuräumen. Einzelne Wochen lassen sich von Hand
ändern – wer kurzfristig tauscht, soll dafür nicht die ganze Tabelle neu
einlesen müssen; ein späterer Import derselben Woche überschreibt die Korrektur
allerdings wieder.

### Die Ansage am Sonntag

Unter **Bekanntmachungen → Wiederkehrend → Aus dem Putzplan** entsteht eine
Serie, deren Text sich jede Woche selbst füllt:

> Herzlichen Dank an **Bader Roger & Sylvie** (Gruppe 2) für das Putzen in der
> vergangenen Woche. In der kommenden Woche ist **Gruppe 3** an der Reihe:
> Nanogjoka Arbi & Melina.

Der Wortlaut lässt sich frei umstellen; gefüllt werden vier Platzhalter:
`{gruppe-vorher}`, `{team-vorher}`, `{gruppe-neu}`, `{team-neu}`.

Welche Woche welche ist, wird nicht gezählt, sondern verglichen: **davor** ist
die zuletzt begonnene Woche, die spätestens am Sonntag endet, **danach** die
erste, die am Sonntag oder später beginnt. Damit stimmt die Ansage auch dort,
wo die Tabelle ihre Zählweise wechselt – der Plan der Gemeinde läuft zuerst von
Montag bis Samstag und ab August von Sonntag bis Samstag.

Findet der Plan zu einem gebrauchten Platzhalter nichts – am Rand des Plans
oder in einer Lücke –, bleibt die Bekanntmachung an diesem Sonntag weg. Ein
Dank an niemanden wäre schlimmer als gar keiner.

---

## Aktivitäten AP's

**Aktivitäten AP's** in der Seitenleiste, unter der Abendmahlsversammlung.

Der Jahresplan der Priestertumskollegien – bisher eine Excel-Tabelle, die
herumgereicht wurde. Die Seite beantwortet zuerst die Frage, die sich jede
Woche neu stellt: **Was kommt als Nächstes?** Deshalb steht die Antwort ganz
oben und gross, über die ganze Breite, mit Treffpunkt, Zuständigkeit und den
Teilnehmenden aus der Bischofschaft. Darunter der ganze Plan, nach Monaten
gruppiert wie in der Tabelle – und untereinander steht überall dasselbe:
Datum, Aktivität, Treffpunkt, Zuständig, Teilnahme. Auf schmalen Geräten
rücken die Angaben unter die Aktivität, statt sich in Spalten zu quetschen.

### Ansicht: Liste oder Kacheln

Oben rechts steht ein Knopf, hinter dem alles zur Darstellung zusammenkommt.
Er zeigt den gewählten Zeitraum an; ein Klick öffnet die drei Einstellungen:

| Einstellung     | Wahl                              | Was sie ändert                                                                  |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| **Zeitraum**    | Kommend · Vergangen · Ganzer Plan | Welcher Ausschnitt gezeigt wird; Vergangenes steht rückwärts, das Letzte zuerst |
| **Darstellung** | Liste · Kacheln                   | Ein Fahrplan von oben nach unten – oder ein Feld aus Kacheln, je Termin eine    |
| **Abstand**     | Kompakt · Normal · Weit           | Polster, Abstände, Schriftgrad – und wie viele Kacheln nebeneinander stehen     |

Die **Liste** ist der Fahrplan: eine Zeile je Termin, ein Blick von oben nach
unten sagt, was der Monat bringt. Die **Kacheln** stellen jeden Termin für
sich hin – mit Datum, Art als angeschriebenem Etikett, Titel, allen Angaben
und der Bemerkung. Es fehlt in keiner der beiden Ansichten etwas.

**Wie viele Kacheln nebeneinander stehen, sagt der Abstand** – und zwar
umgekehrt zum Namen: **Kompakt** stellt auf einem breiten Bildschirm bis zu
drei nebeneinander und lässt viele Wochen auf einmal überblicken, **Normal**
höchstens zwei, **Weit** genau eine über die ganze Breite. Zwei Stufen, die
gleich viele Spalten zeigten, wären zweimal dieselbe Ansicht.

**Der Zeitraum stand früher als breite Knopfleiste über dem Plan.** Er hat
sie nicht verdient: Fast immer bleibt es bei «Kommend», und eine Leiste, die
man einmal im Jahr anfasst, nimmt dem Plan die oberste Zeile weg.

Die getroffene Wahl bleibt – **im Browser und am eigenen Konto**. Im Browser,
damit sie sofort und auch ohne Netz stimmt; am Konto, damit sie auf jedem
Gerät gilt. Wer den Plan am Laptop auf Kacheln gestellt hat, findet ihn am
Telefon genauso vor.

### Der Takt

Der Plan hat einen festen Rhythmus, und die App kennt ihn:

- **jeden Mittwochabend** eine Aktivität,
- **ausser am 3. Mittwoch im Monat** – dann ist FHV, und die AP-Aktivität
  fällt aus,
- **am 2. und 4. Sonntag** die AP-Klasse.

Alles Übrige – Lager, Tempelbesuche, Pfahlanlässe, ein Samstag – ist ein
besonderer Anlass und kann an jedem beliebigen Tag stehen, ein- oder
mehrtägig.

Die vier Arten färben Rand und Symbol der Zeile und sind auf einen Blick
unterscheidbar: Aktivität (blau), AP-Klasse (violett), besonderer Anlass
(gelb), fällt aus (grau, durchgestrichen). Ein ausgefallener Abend bleibt bewusst **im Plan
stehen**: Ein fehlendes Datum sieht aus wie eine Lücke, die noch jemand
füllen muss; steht «FHV – keine Aktivität» da, ist die Frage beantwortet.

Ein Termin ohne Titel heisst «Noch offen» und ist genau das – ein Abend, der
noch zu planen ist. Auch das ist Absicht: Was fehlt, soll man sehen.

### Ansehen und bearbeiten

Der Plan wird hundertmal öfter gelesen als geändert. Deshalb hat die Seite
zwei Zustände, und sie sind sauber getrennt:

- Der **Ansichtsmodus** ist der Normalfall und beim Aufruf immer der
  Ausgangspunkt. Er zeigt den Plan zum Lesen: keine Knöpfe zum Anlegen,
  keine anklickbaren Zeilen, nichts, was sich versehentlich verstellen
  lässt. Bemerkungen stehen hier ganz da, weil kein Klick weiterführt.

  Jeder Termin bekommt dabei so viel Platz, wie er braucht: oben das Datum
  und der **ganze Titel** – er wird nie abgeschnitten und bricht lieber um –,
  darunter **Startzeit, Treffpunkt, Zuständig, Teilnahme BSS, Teilnahme
  Berater** und die Bemerkung, jede Angabe mit ihrer Beschriftung und nur,
  wenn sie ausgefüllt ist. **Zuständig** steht bei jeder Art von Termin –
  wer eine Aktivität organisiert, ist die Auskunft, die im Plan gesucht wird.
  Wer das Kollegium des Monats führt, steht daneben über der Gruppe.

- Der **Bearbeitungsmodus** kommt auf Knopfdruck – **Bearbeitungsmodus**
  oben rechts. Erst dort erscheinen **+ Termin** und **Termine erzeugen**,
  erst dort öffnet ein Klick auf eine Zeile den Termin, und erst dort lässt
  sich die Leitung des Monats ändern. Der Knopf **Ansichtsmodus** führt
  zurück.

Den Umschalter sieht nur, wer Schreibrecht hat. Ein Zugang zum Ansehen
bleibt im Ansichtsmodus – nicht, weil ein Knopf fehlt, sondern weil es für
ihn keinen anderen Zustand gibt.

### Termine erzeugen

Der Knopf **Termine erzeugen** legt den Takt für einen Zeitraum an – etwa das
kommende Jahr –, ohne Titel, als Gerüst. Tage, an denen bereits etwas im Plan
steht, bleiben unangetastet; der Knopf lässt sich deshalb gefahrlos ein
zweites Mal drücken und füllt dann nur die Lücken.

### Einen Termin ändern

Im Bearbeitungsmodus öffnet jede Zeile alle Felder der bisherigen Tabelle:
Datum (auf Wunsch mehrtägig), Uhrzeit, Art, Aktivität bzw. Klasse,
Treffpunkt, Zuständig, Teilnahme Bischofschaft, Teilnahme Berater und die
Bemerkung. Die Personenfelder sind Freitext wie in der Tabelle – die
Vorschlagsliste kommt aus dem, was schon im Plan steht, und hält die
Schreibweise einheitlich.

Welches Kollegium einen Monat führt, steht neben der Monatsüberschrift
(«März 2026 · Leitung Diakone») und lässt sich dort direkt ändern.

### Wer den Plan sieht

Dieser Bereich ist der einzige, der über die Bischofschaft hinaus geteilt
wird. Berater und Jugendführung bekommen einen Zugang, der **nur** den
AP-Kalender zeigt – wahlweise mit Schreibrecht oder nur zum Ansehen. Wie das
eingerichtet wird, steht unter [Rollen](#rollen).

Der Unterschied ist sichtbar und nicht bloss gemeint: Ohne Schreibrecht gibt
es keinen Umschalter, keine Knöpfe zum Anlegen und keine Zeile, die sich
öffnen liesse. Durchgesetzt wird das nicht in der Oberfläche, sondern in den
Zugriffsregeln.

---

## Notizen

**Notizen** in der Seitenleiste, gleich unter den Pendenzen.

Für alles, was nicht an einer Sitzung, einem Mitglied oder einem Sonntag
hängt: der Gedanke aus einem Telefonat, eine Liste zum Mitdenken, der Entwurf
einer Ansage. Eine Notiz hat einen Titel und einen Text – mehr nicht. Keine
Farben, kein Anheften, keine Checklisten: Wer eine Aufgabe festhalten will,
legt eine Pendenz an; sie kann terminiert und zugewiesen werden und taucht in
der nächsten Sitzung wieder auf.

Jede Notiz gehört der ganzen Bischofschaft. Es gibt keine private Notiz und
darum auch keinen Schalter dafür – wie bei allem Übrigen in dieser App sehen
alle freigeschalteten Rollen denselben Bestand.

**Gespeichert wird laufend**, kurz nach dem letzten Tastendruck und noch
einmal beim Schliessen des Fensters; einen Speichern-Knopf gibt es nicht. Eine
neue Notiz entsteht erst beim ersten Speichern – wer das Fenster ohne Eingabe
wieder schliesst, hinterlässt keine leere Zeile in der Liste.

**Verweise** im Text – `https://…`, `www.…` und E-Mail-Adressen – sind
anklickbar, sobald das Feld verlassen wird. Ein Griff in den Text macht daraus
wieder das Eingabefeld.

Über **Ansicht** lässt sich einstellen, ob die Notizen als Liste oder als
Kacheln erscheinen und wie viel jede von sich zeigt (klein, komprimiert,
alles). Am grossen Bildschirm bestimmt zusätzlich ein Schalter im Fenster, wie
breit eine geöffnete Notiz werden darf. Beides gilt pro Gerät, nicht pro
Notiz. Die Suche durchsucht Titel und Text; zuoberst steht, was zuletzt
bearbeitet wurde – mit Datum und Namen dessen, der es getan hat.

**Reihenfolge.** Ebenfalls unter **Ansicht**: _Zuletzt bearbeitet_ (der
Normalfall) oder _Eigene_. In der eigenen Reihenfolge stehen an jeder Notiz
zwei Pfeile zum Verschieben; anders als Darstellung und Grösse gilt sie für
alle, nicht nur für das eigene Gerät. Eine neue Notiz ist noch nicht
einsortiert und steht zuoberst, bis sie verschoben wird. Während einer Suche
fehlen die Pfeile – sie zeigt nur einen Ausschnitt, und danach liesse sich
keine Reihenfolge festhalten.

---

## Berufungen

**Berufungen** in der Seitenleiste. Die Seite zeigt den Organisationsplan der
Gemeinde: je Organisation, wer welche Aufgabe hat – in der Reihenfolge des
LCR, also Präsident, Ratgeber, dann die übrigen. Was ausserhalb der Einheit
liegt (Pfahl, Seminar, Institut, Mission), steht in einer eigenen Sparte am
Ende.

**Gelesen, nicht geschrieben.** Es gibt keinen Knopf für eine neue Berufung,
kein Bearbeiten und kein Löschen. Der ganze Bestand kommt aus dem LCR und wird
dort gepflegt; erfasst wird er unter **Einstellungen → Importe → Berufungen**,
eingefügt aus der Zwischenablage. Von Hand nachzuführen hiesse, zwei Stände
nebeneinander zu führen – und der eine wäre über kurz oder lang der falsche.
Was in der App entstünde, wäre beim nächsten Import ohnehin wieder weg:
überschrieben oder als «fehlt in der Quelle» entlassen.

**Vier Ausschnitte**, unter **Ansicht** oben rechts:

| Ausschnitt        | Was darin steht                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Aktuell**       | Alles, was gerade gilt – bestätigt und eingesetzt                   |
| **Ohne Berufung** | Mitglieder, zu denen keine laufende Berufung erfasst ist            |
| **Entlassen**     | Abgegebene Berufungen, mit Zeitraum                                 |
| **Alle**          | Beides zusammen, einschliesslich der übernommenen Berufungshistorie |

Im selben Menü steht der **Kreis**: _Alle Mitglieder / Nur Aktive_. Er gilt für
alle vier Ausschnitte: Wer inaktiv ist, verschwindet damit samt seinen
Berufungen aus der Liste. Wer im Mitgliederverzeichnis gar nicht (mehr) steht,
bleibt sichtbar – über seinen Status lässt sich nichts sagen, und eine
Berufung stillschweigend verschwinden zu lassen wäre das Schlechtere.

**Geschlecht und Alter** schränken weiter ein: nur Männer, nur Frauen, «ab 18»,
«bis 30» – beide Grenzen freilassbar. Sie beantworten die Frage vor einer
Berufung («wer käme dafür überhaupt in Frage?»), ohne dass man die Liste im
Kopf durchgehen muss. Sobald eine solche Einschränkung gilt, fällt heraus, wer
sich nicht zuordnen lässt: Ohne Datensatz im Verzeichnis ist weder Geschlecht
noch Alter bekannt, und ihn trotzdem zu zeigen hiesse, die Einschränkung
stillschweigend zu übergehen.

**Die Reihenfolge** ist ebenfalls dort wählbar – auf- und absteigend:

| Sortierung       | Wirkung                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| **Organisation** | Die Vorgabe: Sparte für Sparte, darin die Reihenfolge des LCR          |
| **Name**         | Alphabetisch nach der Person                                           |
| **Bezeichnung**  | Alphabetisch nach der Aufgabe                                          |
| **Alter**        | Aufsteigend heisst: die Jüngsten zuerst                                |
| **Bestätigung**  | Nach dem Datum der Bestätigung – wer am längsten dient, steht zuoberst |

Nur **Organisation** hält die Liste in Sparten; jede andere Ordnung macht daraus
eine einzige. Anders ginge es nicht – «alle nach Alter» hat keine Antwort,
solange die Sparten dazwischenstehen. Dafür steht in der flachen Liste die
Organisation bei jedem Eintrag, damit unterwegs nicht verloren geht, wohin eine
Berufung gehört.

**Ohne Berufung** beantwortet die Frage, die vor jeder neuen Berufung steht.
Sie beantwortet sie ehrlich: In der Liste steht die ganze Gemeinde, Kinder
eingeschlossen – deshalb steht das Alter dabei, und deshalb gibt es Kreis,
Geschlecht und Altersgrenze. Eine Berufung ausserhalb der Einheit zählt mit;
auch sie ist eine Aufgabe. Wo eine frühere Berufung erfasst ist, steht sie mit Zeitraum daneben:
War da schon einmal etwas, und wie lange ist es her?

**Ein Griff auf eine Zeile führt zur Person.** Was die Seite sonst noch
beantworten könnte – seit wann, wie oft, was davor –, steht im Profil, und
«Zurück» führt von dort wieder hierher. Die Suche greift auf Name, Position
und Organisation zu, in der Ansicht «Ohne Berufung» auf den Namen.

---

## Mitglieder

**Mitglieder** in der Seitenleiste zeigt das Verzeichnis: Name, Alter, Ort und
wann jemand zuletzt gesprochen hat. Auch hier wird gelesen und nicht
geschrieben – der Bestand kommt aus dem LCR (siehe unten).

Über der Liste steht die **Suche** (Name, E-Mail, Telefon, Ort). Alles andere
steht unter **Ansicht** oben rechts:

- **Status** – Aktiv, Inaktiv, Alle
- **Geschlecht** – nur Männer, nur Frauen
- **Alter** – «ab», «bis», beides freilassbar
- **Sortierung** – Nachname, Vorname, Alter, _Ansprache zuletzt_, _Gebet
  zuletzt_; jeweils auf- und absteigend

«Ansprache zuletzt» und «Gebet zuletzt» sind die beiden Fragen, die vor jedem
Sonntag stehen; wer noch nie an der Reihe war, steht dabei zuoberst. Ist nach
dem Gebet sortiert, steht das Datum auch in der Zeile – eine Liste soll
ausweisen, wonach sie geordnet ist. **Alter aufsteigend** heisst: die Jüngsten
zuerst.

Die Suche steht in der Adresse, die Einstellungen im Browser: Wer ein Profil
öffnet und zurückkommt, findet dieselbe Liste vor, die er verlassen hat.

---

## Mitgliederliste importieren

**Einstellungen → Importe → Mitglieder**.

**Der einzige Weg ins Verzeichnis – und wieder heraus.** In der App lässt
sich kein Mitglied von Hand anlegen und keines von Hand löschen; es gibt
weder einen «Neu»- noch einen «Löschen»-Knopf. Das Verzeichnis kommt aus dem
LCR und wird dort gepflegt: Ein von Hand erfasster Datensatz wäre beim
nächsten Import entweder doppelt oder einer, den niemand wiederfindet, und
ein von Hand gelöschter wäre beim übernächsten wieder da, weil er im LCR nie
verschwand. Was die App darüber hinaus führt und das LCR gar nicht kennt –
Notiz, Schlagworte, «kann für Ansprachen angefragt werden», Betreuung –, wird
weiterhin am einzelnen Mitglied gepflegt (**Bearbeiten** im Profil).

Der Assistent führt durch vier Schritte: Quelle wählen, Spalten zuordnen
(wird geraten), Vorschau prüfen, importieren. Als Quelle dienen wahlweise
eine eingefügte Liste oder eine Datei.

**Liste einfügen (der übliche Weg).** Das Mitgliederverzeichnis im LCR lässt
sich nicht herunterladen – kopieren aber schon. Die Seite markieren
(Strg bzw. Cmd + A), kopieren und ins Textfeld einfügen. Kopf- und Fusszeilen
der Seite dürfen mitkommen, sie werden übersprungen. Gelesen werden Name,
Geschlecht und Geburtsdatum aus der Kopfzeile jeder Person, danach Strasse,
PLZ und Ort sowie Telefonnummer und E-Mail; Nummern mit Vorwahl 076–079
landen unter «Mobile», alle übrigen unter «Telefon». Vermerke wie «nicht
getauft» stehen als Spalte «Hinweis» bereit und lassen sich im
Zuordnungsschritt der Notiz zuweisen. Unter dem Textfeld steht laufend, wie
viele Personen erkannt wurden.

**Datei.** Unterstützt werden `.xlsx` und `.csv`, per Auswahl oder
Drag-and-drop. Die erste Zeile mit Inhalt gilt als Spaltenüberschrift.

Beim wiederholten Import erkennt die App bestehende Personen – zuerst über die
Mitglieds-Nummer, sonst über Name und Geburtsdatum, notfalls über den Namen
allein (dann mit Warnung). Drei Schalter schützen gepflegte Daten:

- **Leere Zellen ignorieren** – ein leeres Feld löscht nichts Bestehendes
- **Notizen behalten** – in der App erfasste Notizen bleiben unangetastet
- **Status behalten** – aktiv/inaktiv wird nicht überschrieben

Damit der Abgleich beim nächsten Mal sicher greift, lohnt es sich, eine Spalte
mit der Mitglieds-Nummer mitzuliefern und als «Mitglieds-Nr.» zuzuordnen.

### Wer in der Quelle fehlt

Die eingefügte LCR-Seite gilt als der **ganze Bestand**: Wer dort nicht mehr
steht, gehört nicht mehr zur Gemeinde und wird beim Import entfernt. Weil
sich in der App niemand von Hand löschen lässt, ist das der einzige Ort, an
dem der Wegzug nachvollzogen wird.

Die Vorschau nennt die Betroffenen deshalb **namentlich** und nicht bloss als
Zahl – ein versehentlich nur halb kopiertes Verzeichnis fällt an den Namen
sofort auf, an einer Zahl erst hinterher. Wer bewusst nur einen Ausschnitt
einliest, schaltet das Entfernen im selben Kasten ab.

Gelöscht wird erst, wenn alles Übrige geschrieben ist: Bricht der Import in
der Mitte ab, ist zu wenig geschrieben – aber nichts zu viel entfernt.
Erfasste Ansprachen und Berufungen bleiben bestehen; sie tragen den Namen
mitgeschrieben und bleiben lesbar, verlieren aber ihren Bezug zur Person.

---

## Berufungen und Betreuung importieren

Reiter im Import-Bereich führen zu allem, was sich von aussen übernehmen lässt:
**Mitglieder**, **Berufungen**, **Betreuung**, **Putzplan**, **Verlauf** und
**Lieder**. Die drei aus dem LCR gehen denselben Weg wie beim
Mitgliederverzeichnis – Seite markieren, kopieren, einfügen; nur die
Spaltenzuordnung entfällt, weil der Aufbau feststeht.

Die Mitglieder kommen zuerst. Berufungen und Betreuungsaufträge ordnen ihre
Einträge erfassten Personen zu und überspringen, was sie nicht findet – so
entstehen aus einem Tippfehler keine stillen Karteileichen.

Beim Abgleich zählt der Nachname in **beiden Schreibweisen**: «Buerge» findet
«Bürge», «Graeppi» findet «Gräppi», und umgekehrt. Ein Vorname greift auch als
zweiter – steht in der Quelle «Christiane», passt das zu «Anne Christiane» –,
und abgekürzte Zweitnamen («Joshua B.») ebenso. Ein halber Treffer gilt
bewusst nicht als Treffer: Was übrig bleibt, wird gemeldet statt geraten.

**Berufungen.** Drei Sparten stehen zur Wahl. Zwei davon kommen aus dem LCR
und werden dort getrennt geführt: _Berufungen der Gemeinde_ (die Seite
«Organisationen») und _Ausserhalb der Einheit_. Welche vorliegt, wird vor dem
Einfügen gewählt – die zweite Seite trägt kein Merkmal, an dem sie sich
erkennen liesse, und die Wahl entscheidet mit, welcher Bereich ersetzt wird.
Die dritte, die _Berufungshistorie_, kommt aus der eigenen Tabelle der
Gemeinde und ersetzt nichts (siehe [unten](#berufungshistorie-übernehmen)).

Die Trennung ist keine Kosmetik: Der Sonntagsschulpräsident des Pfahls ist
nicht der Sonntagsschulpräsident der Gemeinde. Beide tragen dieselbe
Bezeichnung, und ohne die Unterscheidung überschriebe der eine den anderen.
In der Berufungsliste stehen sie deshalb in eigenen Sparten, im Detail einer
Person sind die auswärtigen als solche gekennzeichnet.

Bestehende Berufungen werden über Person, Rolle, Organisation und Bereich
erkannt und aktualisiert. Offene Berufungen («Berufung offen») werden gezählt,
aber nicht geschrieben.

**Betreuung.** Die Seite _Betreuungsaufträge_ mit allen Organisationen und
allen Personen anzeigen lassen, dann kopieren. Pro Person entstehen zwei
Listen: mit wem zusammen betreut wird und wer betreut wird.

### Was dabei wegfällt

Beide Importe **ersetzen** ihren Bereich, statt ihn zu ergänzen: Die LCR-Seite
ist die vollständige Wahrheit über den aktuellen Stand. Wer aus einer
Betreuungspartnerschaft herausfällt, verschwindet auch hier; eine Berufung, die
das LCR nicht mehr führt, wird entlassen.

Entlassen heisst nicht löschen – die Berufung behält ihren Verlauf und steht
weiterhin unter «Entlassen». Wer in der Vorschau prüfen will, was wegfällt,
findet es dort einzeln aufgeführt, bevor etwas geschrieben wird.

Drei Vorkehrungen halten die Ersetzung in Grenzen:

- **Nur so weit wie die Quelle.** Ersetzt wird, was die eingefügte Seite
  abdeckt. Wer bloss die Sonntagsschule kopiert, entlässt niemanden in der FHV,
  und die Seite «ausserhalb der Einheit» rührt die Gemeinde nicht an.
- **Nichts in Vorbereitung.** Vorgeschlagene und ausgesprochene Berufungen
  stehen nicht im LCR und können dort deshalb auch nicht fehlen.
- **Nichts bei leerer Quelle.** Gibt die Kopie nichts her, wird nichts
  entlassen.

Wer bewusst nur einen Ausschnitt einfügt, kann das Entlassen in der Vorschau
zusätzlich abschalten.

### Berufungswechsel

Der Regelfall einer Umberufung: Jemand gibt eine Aufgabe ab und erhält am
selben Sonntag eine neue. Das LCR erzählt davon nichts – dort ist die alte
Berufung schlicht verschwunden, und ohne weiteres Zutun stünde als
Entlassungsdatum der Tag, an dem zufällig importiert wurde.

Fällt bei einer Person eine Berufung weg und kommt zugleich eine neue dazu,
zeigt die Vorschau das deshalb als eigenen Punkt:

> **Cadonau, Rita**
> Neue Berufung: Sonntagsschullehrer · Sonntagsschule · bestätigt 4 Feb 2024
> Wurde entlassen als: JD-Leiterin · Junge Damen
> Entlassung per **04.02.2024**

Das vorgeschlagene Datum ist das Berufungsdatum der neuen Berufung – der Tag,
an dem die bisherige Aufgabe endete. Es lässt sich vor dem Schreiben von Hand
ändern, und wer den Haken entfernt, macht daraus eine gewöhnliche Entlassung
auf den heutigen Tag.

Eine so entlassene Berufung wandert in die **Historie**: Sie ist ein
abgeschlossener Abschnitt und bleibt es. Erhält die Person dieselbe Aufgabe
Jahre später erneut, entsteht ein zweiter Eintrag, und beide Abschnitte stehen
im Profil nebeneinander. Eine gewöhnliche Entlassung ohne neue Berufung lebt
dagegen wieder auf, wenn das LCR die Berufung erneut führt – dort ist meist
eine unvollständige Kopie im Spiel.

Gepaart wird der Reihe nach und höchstens einmal: Wer zwei Berufungen abgibt
und eine neue erhält, hat einen Wechsel und eine gewöhnliche Entlassung –
welche welche ist, weiss die Quelle nicht, und geraten wird nichts. Beides
steht in der Vorschau und lässt sich dort richtigstellen.

---

## Berufungshistorie übernehmen

**Einstellungen → Importe → Berufungen → Berufungshistorie**, einmalig.

Das LCR kennt nur den heutigen Stand. Was jemand vorher schon getan hat –
zwei Jahre PV-Lehrerin, davor Sekretärin der JD –, steht dort nicht, wohl
aber in der Tabelle, welche die Gemeinde seit Jahren führt: eine Zeile je
Vorgang, mit Organisation, Amt, Name und den Daten von Berufung,
Bestätigung und Einsetzung. Dieser Import trägt sie nach. Danach beantwortet
das Profil einer Person die Frage, die vor jeder neuen Berufung kommt: Was
hat sie bisher gemacht?

Die Datei wird als `.xlsx` eingelesen, alle Blätter auf einmal – eine
Entlassung steht oft auf einem anderen Blatt als die Berufung, zu der sie
gehört. Welche Spalte was bedeutet, erkennt der Import an der Überschrift;
die Reihenfolge der Spalten darf sich über die Jahre geändert haben.

**Aus zwei Zeilen wird eine Berufung.** Die Tabelle führt Ereignisse: «B»
beruft, «E» entlässt. Erst beide zusammen ergeben, was die App unter einer
Berufung versteht – eine Aufgabe mit Anfang und Ende. Gesucht wird von der
Entlassung aus, unter den noch offenen Berufungen derselben Person in
derselben Organisation: zuerst beim gleich benannten Amt, dann beim
ähnlichsten, und wenn dort nur eine einzige offen ist, bei dieser. Ämter
werden dafür auf ihren Kern zurückgeführt – «1. Ratgeberin JD» und «Erste
Ratgeberin» meinen dasselbe, «Leherin» ist «Lehrerin».

Drei Eigenheiten der gewachsenen Liste sind berücksichtigt:

- **Das Kennzeichen «B/E» gibt es erst in den neueren Blättern.** Davor
  verrät sich eine Entlassung daran, dass «eingesetzt am» und «eingesetzt
  von» durchgestrichen sind – so hält es die Legende im Kopf der Tabelle
  fest.
- **Datumsangaben stehen in drei Schreibweisen** nebeneinander: als echtes
  Datum, als «24.03.13» und als «3/26/2017» aus der amerikanischen
  Oberfläche des LCR. Der Punkt heisst Tag zuerst, der Schrägstrich Monat
  zuerst. Was sich nicht sicher lesen lässt – «????», «längst» –, bleibt
  leer statt geraten.
- **Die Kürzel der Organisationen wechseln** («SoSch», «Soschu»,
  «Sonntagschule»). Die Hohepriestergruppe zählt zum Ältestenkollegium, das
  Aaronische Priestertum zu den Jungen Männern; was nach Pfahl, Seminar oder
  Institut aussieht, wird als Berufung ausserhalb der Einheit übernommen.
  Unbekannte Kürzel kommen unter «Übrige» mit und werden in der Vorschau
  genannt.

**Namen von Hand zuordnen.** Über zehn Jahre wechselt eine Gemeinde: Die
meisten offenen Namen gehören Weggezogenen. Die Vorschau listet jeden davon
mit seiner Trefferzahl auf und lässt die Person auswählen – oder den Namen
mit **«Kein Mitglied unserer Gemeinde»** weglegen. Weggelegte Namen
verschwinden aus der Liste und werden nirgends geschrieben; zurückholen
lassen sie sich jederzeit. Was offen bleibt, wird übersprungen.

**Der laufende Stand bleibt unangetastet.** Dieser Import schreibt
ausschliesslich abgeschlossene Berufungen. Kein bestehender Datensatz wird
geändert, ergänzt oder entlassen: Wer heute welche Berufung hat, sagt allein
der Import aus dem LCR. Wo ein gelesener Eintrag eine Berufung meint, die im
Bestand noch läuft, wird gar nichts geschrieben – weder ein zweiter Eintrag
noch eine Ergänzung am laufenden. Eine abgeschlossene Berufung ist dagegen
immer ein eigener Abschnitt: Wer eine Aufgabe zweimal innehatte, soll sie
auch zweimal sehen. Übernommene Einträge sind als Vergangenheit
gekennzeichnet; der LCR-Abgleich lässt sie deshalb später in Ruhe, statt
einen alten Abschnitt wiederzubeleben.

**Was nicht erfasst wurde, wird nicht erfunden.** Zu vielen Berufungen steht
keine Entlassung in der Liste. Ob die Person die Aufgabe heute noch hat oder
ob bloss die Entlassung nie eingetragen wurde, weiss die Tabelle nicht –
also wird auch nicht geraten: Solche Einträge kommen als Verlauf mit, ohne
Enddatum und mit dem Vermerk «keine Entlassung erfasst». **Nach dem Import
stehen sie einzeln aufgeführt**, mit dem Weg zur Person, damit sich von Hand
entscheiden lässt, was fehlt: das Datum der Entlassung – oder die Berufung
selbst, die dann ins LCR gehört und von dort importiert wird.

Der Import ist wiederholbar: Die Dokument-IDs entstehen aus Blatt und Zeile
der Quelle. Ein zweiter Durchlauf schreibt deshalb dieselben Berufungen noch
einmal, statt den Verlauf zu verdoppeln – auch dann, wenn beim zweiten Mal
mehr Namen von Hand zugeordnet wurden.

Im Profil einer Person stehen die laufenden Berufungen oben; darunter lässt
sich «Früher» aufklappen, mit Zeitraum je Eintrag.

---

## Bisherige Protokolle übernehmen

**Einstellungen → Importe → Sitzungen**, einmalig beim Umstieg.

Vier Jahre Bischofschaftssitzungen stehen in einem einzigen Word-Dokument:
je Sitzung eine Tabelle, die neuste zuoberst, in der ersten Zeile das Datum
(«Traktanden, 31.07.2025» oder «Protokoll, 05.01.2023»), darunter je Zeile
ein Traktandum und daneben «Wer» und «Bis». Genau so wird es gelesen.

| In der Datei                 | In der App                                   |
| ---------------------------- | -------------------------------------------- |
| eine Tabelle                 | eine Sitzung mit dem Datum aus der Kopfzeile |
| eine Zeile                   | ein Traktandum                               |
| erste Zeile der Zelle        | der Titel                                    |
| alles Weitere in der Zelle   | die Beschreibung                             |
| «Wer» und «Bis»              | eine Zeile in der Beschreibung               |
| Tabelle **Offene Pendenzen** | Pendenzen im Sammelkorb, offen               |

Vergangene Sitzungen gelten als abgeschlossen und ihre Traktanden als
erledigt. Das ist keine Behauptung über die Sache, sondern über den Ort:
Vierhundert Punkte aus vier Jahren als «offen» stünden in der Pendenzenliste
und verdeckten, woran gerade wirklich gearbeitet wird. Offen bleibt, was in
der Tabelle «Offene Pendenzen» steht – die Bischofschaft trägt dort ohnehin
laufend nach, was sie weiterhin beschäftigt.

Drei Eigenheiten der gewachsenen Datei rechnet der Import mit ein:

- **Fehlt das Jahr** in der Kopfzeile («Traktanden 08.06.»), ergibt es sich
  aus der Sitzung darüber – das Dokument ist von der neusten abwärts
  geschrieben.
- **Dasselbe Datum zweimal** – eine Sitzung, einmal als Zwischenstand und
  einmal fertig – wird zu einer Sitzung; gleiche Titel gelten als derselbe
  Punkt, und es bleibt die ausführlichere Fassung.
- **Kein lesbares Datum** («Traktanden, bis Ende November 2025») heisst: Die
  Tabelle wird nicht übernommen. Die Vorschau nennt sie samt Zeilenzahl, und
  diese wenigen Punkte werden von Hand erfasst.

Alles Übernommene ist als Import gekennzeichnet. Deshalb lässt sich der
Vorgang gefahrlos wiederholen: **Einen früheren Import vorher entfernen**
räumt genau das weg, was der Import selbst angelegt hat – von Hand erfasste
Sitzungen und Pendenzen bleiben stehen.

Gelesen wird die `.docx` ohne Zusatzpaket: Eine Word-Datei ist ein
ZIP-Archiv, und der Browser bringt sowohl das Entpacken mit als auch alles,
was zum Lesen des XML nötig ist (`lib/docx.ts`).

---

## Verlauf aus der bisherigen Excel-Tabelle

**Einstellungen → Importe → Verlauf**, einmalig.

Ohne Verlauf beginnt die App bei null: Sie hielte alle für gleich lange nicht
dran und bräuchte Jahre, bis die Vorschlagslisten wieder etwas taugen. Der
Import holt nach, was bisher in der Tabelle _AMV_AnsprGeb_ stand – ein Blatt je
Jahr, eine Zeile je Person, zwei Spalten je Monat: «A» für die Ansprache, «G»
für das Gebet.

Die Datei wird als `.xlsx` eingelesen, alle Jahresblätter auf einmal. Gelesen
wird das Jahr aus dem Blattnamen, der Monat aus der Spaltenüberschrift und der
Termin aus der Zelle. **Die Zählweise hat unterwegs gewechselt:** Bis 2018 stand
dort, der wievielte Sonntag des Monats es war, ab 2019 der Tag selbst. Erkannt
wird das am Inhalt – ein Monat hat höchstens fünf Sonntage, Tagesangaben liegen
zu über vier Fünfteln darüber. Die alte Beschriftung «x-ter Sonntag im entspr.
Monat» steht bis heute im Kopf jedes Blattes und taugt deshalb nicht als
Merkmal.

Was von Hand danebengeschrieben wurde, wird nicht gedeutet: «K» neben dem Tag
kommt als Notiz «Kinderansprache» mit, zwei Termine in einer Zelle («10, 31»)
ergeben zwei Einträge, und Vermerke ohne Datum («v» für vorgesehen, «auf
Mission») erscheinen in der Vorschau als aufklappbare Liste zum Nachschauen.
Zeilen, in denen statt einer Person eine Rolle steht – «Besucher»,
«Pfahlpräsident» –, werden übersprungen.

Zwei Grenzen sind zu kennen:

- **Gebete kennen pro Sonntag nur zwei Plätze**, Anfang und Schluss, und die
  Tabelle sagt nicht, welcher es war. Vergeben wird der Reihe nach; wo an einem
  Sonntag mehr als zwei Personen stehen, meldet die Vorschau die übrigen. Bei
  Ansprachen gibt es diese Grenze nicht.
- **Die Gebets-Auswertung liest die jüngsten 400 Einträge.** Wer länger nicht
  dran war, erscheint dort als «noch nie» – und steht damit ohnehin zuoberst.

**Namen von Hand zuordnen.** Nicht jeder Unterschied lässt sich aus den Namen
ableiten. Nach einer Heirat steht in der alten Tabelle noch der frühere
Nachname, und wo zwei Personen Vor- und Nachname teilen, hilft kein Verfahren.
Die Vorschau listet deshalb jeden offenen Namen mit seiner Trefferzahl auf und
lässt die Person auswählen; die Einträge kommen dann mit. Was offen bleibt,
wird übersprungen – meist zu Recht, denn dahinter stecken Weggezogene und
Besuchende.

Der Import ist wiederholbar: Die Dokument-IDs entstehen aus Datum und Person,
ein zweiter Durchlauf schreibt deshalb dieselben Einträge noch einmal, statt den
Verlauf zu verdoppeln. Was in der App gepflegt wurde, bleibt unangetastet.

---

## Putzplan importieren

**Einstellungen → Importe → Putzplan**, zweimal im Jahr.

Die Halbjahrestabelle der Gemeinde als `.xlsx` oder `.csv` einlesen, per
Auswahl oder Drag-and-drop. Wie sie gelesen wird und was danach damit möglich
ist, steht unter [Putzplan](#putzplan).

Die Vorschau zeigt jede erkannte Woche mit ihrer Zeilennummer aus der Datei,
dazu die Zahl der Teams und die Zeilen, die einen Zeitraum haben, aber keine
Namen – die werden übersprungen und gemeldet. Stimmt eine Zeile nicht, lässt
sie sich nach dem Import auf der Seite **Putzplan** einzeln richtigstellen.

---

## Aktivitäten AP importieren

**Einstellungen → Importe → Aktivitäten AP**, einmalig beim Umstieg.

Den bisherigen Jahresplan als `.xlsx` oder `.csv` einlesen, per Auswahl oder
Drag-and-drop. Gelesen wird das erste Arbeitsblatt: eine Kopfzeile mit
«Datum», «Aktivität / Klasse», «Treffpunkt», «Zuständig AP», den beiden
Teilnahmespalten und «Bemerkung», darunter je Zeile ein Termin. Wo die
Spalten stehen, bestimmt die Kopfzeile; fehlt sie, gilt die gewohnte
Reihenfolge – die Vorschau sagt, welcher Fall eingetreten ist.

Zwei Dinge sind an dieser Tabelle heikel, und beide stecken in der
Datumsspalte. Excel liefert ein echtes Datum als **Zahl** (46029 ist der 7. Januar 2026), und Mehrtägiges wird von Hand hineingeschrieben:
«03. April – 06. April 2026», «Freitag + Samstag, 30.01 -31.01.2026»,
«30. Oktober – 1. November 2026». Die Zelle wird deshalb nicht nach einem
Muster gelesen, sondern durchsucht: Alles, was wie ein Tagesdatum aussieht,
wird eingesammelt; das erste ist der Anfang, das letzte das Ende. Eine Zeile
ohne Datum ist kein Termin – so fallen Titel, Kopfzeile und Leerzeilen von
selbst weg.

Die **Art** ergibt sich aus dem Wochentag: Mittwoch ist Aktivität, Sonntag
ist Klasse, alles Übrige und alles Mehrtägige ist ein besonderer Anlass.
Steht «keine Aktivität» oder «keine Klasse» im Titel, gilt der Termin als
ausgefallen – und bleibt trotzdem im Plan. Die Zwischenüberschriften
(«JANUAR – LEITUNG LEHRER») werden zur Angabe, welches Kollegium den Monat
führt.

Die Vorschau zeigt jeden erkannten Termin mit seiner Zeilennummer aus der
Datei, die Verteilung auf die vier Arten und die Zeilen, die Inhalt haben,
aber kein lesbares Datum – die werden übersprungen und gemeldet.

**Vorhandene Termine im Zeitraum der Datei vorher entfernen** steht
standardmässig an: Die Tabelle **ist** der Plan, und ein zweiter Anlauf nach
einer Korrektur soll nicht jeden Termin doppelt hinterlassen. Ohne den Haken
kommen die Zeilen zum Bestehenden dazu – sinnvoll nur für einen Nachtrag.

---

## Liederlisten importieren

**Einstellungen → Importe → Liederlisten**, einmalig – einmal je Buch.

Zur Auswahl stehen drei Bücher:

| Buch                           | Nummern                  | Kürzel |
| ------------------------------ | ------------------------ | ------ |
| Gesangbuch                     | 1–210                    | –      |
| Liederbuch für Kinder (PV)     | 2–148, mit Doppelnummern | `PV`   |
| Für zuhause und für die Kirche | ab 1001                  | –      |

Jedes wird für sich eingelesen und für sich geleert. Gesangbuch und
PV-Liederbuch zählen beide ab 1 – Nr. 6 ist dort «Israel, der Herr ruft alle»,
hier «Gebet eines Kindes» –, deshalb tragen die PV-Lieder ein Kürzel. Die neue
Sammlung beginnt bei 1001 und braucht keines: Die Kirche zählt dort bewusst
weiter, damit sich ihre Lieder ohne Zusatz ansagen lassen.

Der übliche Weg führt übers **Musikarchiv** der Kirche: dort das gewünschte
Buch öffnen, «Alles einblenden» wählen, die Seite markieren, kopieren und
einfügen. Menü, Filterleiste, Rubriken und das laufende Hörbeispiel dürfen
mitkommen – gelesen wird nur, was wie «Nummer. Titel» aussieht. Der Punkt
hinter der Zahl ist dabei das entscheidende Merkmal: ohne ihn wäre
«210 Ergebnisse» ein Lied.

Zwei Eigenheiten bringen das PV-Liederbuch und die neue Sammlung mit:

- **Doppelnummern.** «18a. Dankkanon» und «18b. Den Kopf geneigt» teilen sich
  die Seite. Der Buchstabe bleibt erhalten.
- **Kopieren als Markdown.** Je nach Browser kommen die Einträge als Liste mit
  Verweisen, und darüber steht ein Brotkrumenpfad – «1. Musikarchiv» –, der
  die Form eines Liedes hat. Er verrät sich am Ziel: Lieder verweisen auf
  `/music/songs/`, der Pfad nicht.

Alternativ lässt sich eine `.xlsx`- oder `.csv`-Datei mit je einer Spalte für
Nummer und Titel einlesen; welche das sind, erkennt der Import selbst.

Beim Gesangbuch meldet die Vorschau Lücken in der Nummernfolge – der übliche
Grund ist, dass «Alles einblenden» vergessen ging und die Seite nur einen Teil
zeigte. Bei den anderen beiden entfällt der Hinweis: Das PV-Liederbuch nennt
Seitenzahlen, und «Für zuhause und für die Kirche» springt zwischen seinen
Abschnitten (1001 ff., dann 1201 ff.) – dort wäre die Warnung nur Lärm.

Der Code ist der Schlüssel: Derselbe Code wird aktualisiert statt doppelt
angelegt.

---

## Rollen

Innerhalb der Bischofschaft beschreibt die Rolle die **Aufgabe**, nicht den
Umfang der Rechte. Bischof, beide Ratgeber und die Sekretäre arbeiten am
selben Datenbestand und sehen alles – auch vertrauliche Traktanden.

Daneben stehen zwei Zugänge, die **ausschliesslich** den AP-Kalender zeigen.
Sie sind für die Berater und die Jugendführung gedacht: Der Aktivitätenplan
wird mit ihnen geteilt, eine Aufgabe, die Einblick in Personendaten
rechtfertigt, haben sie aber nicht.

| Rolle                         | Zugriff                                   |
| ----------------------------- | ----------------------------------------- |
| **Bischof**                   | alles                                     |
| **1. Ratgeber**               | alles                                     |
| **2. Ratgeber**               | alles                                     |
| **Finanzsekretär**            | alles                                     |
| **Sekretär**                  | alles                                     |
| **AP-Kalender · bearbeiten**  | nur «Aktivitäten AP's», mit Schreibrecht  |
| **AP-Kalender · nur ansehen** | nur «Aktivitäten AP's», ohne Schreibrecht |
| _Wartet auf Freigabe_         | nichts                                    |

Wozu dann überhaupt Rollen mit Vollzugriff? Sie halten fest, wer welche
Aufgabe hat – etwa wer die Abendmahlsversammlung leitet oder präsidiert – und
sie steuern die Freigabe neuer Konten.

Durchgesetzt wird die Trennung in `firestore.rules` und nicht erst in der
Oberfläche: Ein AP-Zugang erreicht genau zwei Sammlungen (`apActivities`,
`apMonths`) sowie lesend die Einstellungen – wegen des Gemeindenamens in der
Kopfzeile. Jede andere Abfrage lehnt der Server ab. `npm run test:rules`
prüft das in beide Richtungen.

### Ein neues Konto freischalten

Wer sich registriert, landet mit der Rolle «Wartet auf Freigabe» in der
Datenbank und sieht nichts. In der App der Bischofschaft steht das dann
**zuoberst auf der Übersicht** – ein Klick darauf führt geradewegs zu
**Einstellungen → Benutzer und Rollen**, wo das Konto in einem Kasten
**«Neue Registrierungen»** steht. Ohne diesen Hinweis merkte es nur die
wartende Person selbst. Zur Wahl stehen dort drei Zugriffsstufen –
Vollzugriff, nur AP-Kalender mit Schreibrecht, nur AP-Kalender zum Ansehen –
und bei Vollzugriff zusätzlich die Aufgabe in der Bischofschaft. Ein Klick
auf **Freischalten** wirkt sofort; **Ablehnen** entfernt das Profil wieder.

Freischalten darf jedes Konto mit Vollzugriff, nicht nur der Bischof. Die
Zugriffsstufe lässt sich später jederzeit in der Liste darunter ändern.

Jede und jeder kann die **eigene Rolle** anpassen, unter
**Einstellungen → Mein Profil** oder in der Liste unter **Benutzer und
Rollen**. Wer beim Einrichten versehentlich als Bischof angelegt wurde, trägt
sich also selbst als 1. Ratgeber ein. Nur den eigenen Zugang entziehen kann
man sich nicht – «Wartet auf Freigabe» steht für das eigene Konto nicht zur
Wahl.

Ein Kennzeichen «vertraulich» am einzelnen Traktandum gibt es nicht mehr. Es
schränkte den Zugriff innerhalb der Bischofschaft ohnehin nie ein, und was
niemand sonst sehen soll, gehört nicht in diese Datenbank.

---

## Projektstruktur

```
src/
├── components/
│   ├── agenda/          Traktanden und Pendenzen: Zeile, Karte, Editor,
│   │                    Sitzungsmodus, Erfassen, Verschieben
│   ├── ap/              Aktivitäten AP: Zeile, Formular, Termine erzeugen
│   ├── sacrament/       Abendmahlsversammlung: Rahmen mit Sonntagswahl, Lied- und Personenfelder
│   ├── ui/              Bausteine: Modal, Badges, Avatare, Auswahlfelder,
│   │                    «@»-Feld und «@»-Text
│   ├── Layout.tsx       Navigation (Seitenleiste bzw. untere Leiste)
│   └── UpdatePrompt.tsx Hinweis auf neue Version
├── contexts/            Anmeldung, Stammdaten, Meldungen
├── hooks/               Sammlungen lesen, Weg zurück, Ansicht in der Adresse,
│                        Bekanntmachungen eines Sonntags, lokale Einstellungen
├── lib/                 Firebase-Anbindung, Sammlungsspeicher (Abgleich), Typen, Datums-,
│                        Serien-, Programm-, Sonntags-, Vorschlags-, Word- und Hilfsfunktionen
├── pages/
│   ├── sacrament/       Leitung, Bekanntmachungen, Angelegenheiten, Musik, Gebet
│   └── …                Eine Datei pro übriger Ansicht
└── services/            Schreibzugriffe und Fachlogik pro Sammlung

tests/                   Tests der Zugriffsregeln und der Import-Parser (laufen in der CI)
.github/workflows/       Prüfen und Ausrollen der Firestore-Regeln
firestore.rules          Zugriffsregeln (die eigentliche Absicherung)
firestore.indexes.json   Zusammengesetzte Indizes
netlify.toml             Build, Weiterleitungen, Header
scripts/                 Icon-Generierung
docs/KONZEPT.md          Fachliches Konzept
```

---

## PWA

Die App ist installierbar (Browser-Menü → «Zum Startbildschirm hinzufügen»)
und läuft offline. Firestore hält eine lokale Kopie der Daten vor.

Neue Versionen werden nicht ungefragt geladen – stattdessen erscheint ein
Hinweis mit einer Schaltfläche. So startet die App nicht mitten in der Sitzung
neu und verliert Eingaben.

**Hoch und quer.** Die App war einmal auf das Hochformat festgelegt; das ist
sie nicht mehr. Am Pult zählt das: Wer die **Leitung** ins Vollbild schaltet
und das Telefon dreht, liest doppelt so lange Zeilen, und Kopf- und Fusszeile
werden im Querformat von selbst flacher. Auf dem Tablet gilt dasselbe für
Pendenzen und Notizen.

> Android liest das Manifest beim Einrichten. Eine **bereits installierte** PWA
> übernimmt die Lage erst mit der nächsten Aktualisierung des Startsymbols –
> sofort geht es, indem man sie einmal entfernt und neu zum Startbildschirm
> hinzufügt.

---

## Daten laden: einmal ganz, danach nur noch Änderungen

Firestore rechnet **jede gelesene Zeile** ab, und das kostenlose Kontingent
liegt bei 50 000 Lesevorgängen am Tag. Ein gewöhnlicher `onSnapshot()` auf eine
Sammlung ist dabei teurer, als es aussieht: Wer die Ansicht wechselt, meldet
den alten Horcher ab und den neuen an – und war die Verbindung länger als eine
halbe Stunde unterbrochen (also bei jedem neuen Aufruf der App), liest der
neue Horcher **alles noch einmal**. Bei einem Dutzend Sammlungen und ein paar
tausend Datensätzen kommen so schnell Zehntausende Lesevorgänge am Tag
zusammen – für Daten, die sich seit gestern nicht bewegt haben.

[`src/lib/collectionStore.ts`](src/lib/collectionStore.ts) dreht das um. Jede
Sammlung wird **einmal je Sitzung** angemeldet, und zwar in drei Schritten:

1. **Aus dem Zwischenspeicher füllen.** Firestore legt ohnehin eine
   vollständige Kopie in IndexedDB ab. `getDocsFromCache()` liest daraus –
   kostenlos, ohne Netz und ohne Ladebalken. Die Liste steht sofort da.
2. **Nur das Neue nachladen.** Statt der ganzen Sammlung wird ab dem höchsten
   bekannten `updatedAt` abonniert. Der Server schickt, was sich seither
   geändert hat – meist nichts, sonst eine Handvoll Datensätze. Der Horcher
   bleibt offen: Was ein anderes Gerät **jetzt** ändert, ist ebenfalls «neuer»
   und kommt über denselben Weg herein.
3. **Einmal nachzählen.** Eine Zählabfrage kostet einen einzigen Lesevorgang je
   tausend Datensätze und verrät, ob etwas gelöscht wurde – das sähe die
   Teilabfrage sonst nicht. Stimmt die Zahl nicht, wird die Sammlung einmal
   vollständig gelesen. Dasselbe geschieht, wenn der letzte vollständige
   Abgleich über eine Woche her ist.

**Die App ist dadurch nicht weniger aktuell, sondern schneller.** Der Horcher
läuft weiter wie vorher; fremde Änderungen erscheinen unverändert sofort. Neu
ist nur, dass ein Ansichtswechsel gar nichts mehr kostet: Die Hooks in
[`src/hooks/useFirestore.ts`](src/hooks/useFirestore.ts) filtern und sortieren
im Client, statt für jede Ansicht eine eigene Abfrage zu stellen. Der Wechsel
zwischen «Pendent» und «Erledigt», das Öffnen einer Sitzung, der Sprung ins
Mitgliederprofil – alles aus demselben, bereits geladenen Bestand.

Damit das trägt, muss **jeder** Schreibvorgang `updatedAt` setzen. Daneben
steht `editedAt`: Es hält fest, wann zuletzt am Inhalt _gearbeitet_ wurde.
Umsortieren hebt den Stand des Datensatzes (`updatedAt`), ist aber keine
Bearbeitung – sonst sprängen nach jedem Umsortieren einer Sitzung lauter
unveränderte Punkte an den Anfang der Pendenzenliste.

Drei Dinge sieht die Teilabfrage nicht, und für alle drei gibt es einen Weg:

| Fall                                 | Antwort                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| Im eigenen Fenster gelöscht          | `forgetDoc()` entfernt den Datensatz sofort aus der Liste          |
| Auf einem anderen Gerät gelöscht     | Die Zählabfrage beim Start findet die Abweichung                   |
| Import (löscht, oder datiert zurück) | `resyncCollections()` liest die betroffenen Sammlungen einmal ganz |

Fehlt trotzdem einmal etwas, holt «Einstellungen → Daten neu laden» den ganzen
Bestand frisch. Im Alltag wird der Knopf nicht gebraucht.

---

## Offline speichern

**Speichern funktioniert ohne Netz genauso.** Eine Änderung landet sofort in
der lokalen Datenbank des Geräts und wird von dort übertragen, sobald wieder
Verbindung besteht – auch über einen Neustart der App oder des Telefons
hinweg. Firestore behält die Reihenfolge bei.

Die Rückmeldung sagt, woran man ist:

| Anzeige                                                | Bedeutung                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| «Gespeichert.»                                         | Der Server hat bestätigt.                                                        |
| «… Wird übertragen, sobald wieder Verbindung besteht.» | Lokal gespeichert, Übertragung steht aus.                                        |
| Wolken-Symbol in der Kopfzeile mit Zahl                | So viele Änderungen sind noch unterwegs. Verschwindet es, ist alles beim Server. |

Technisch löst sich das Versprechen eines Firestore-Schreibvorgangs erst auf,
wenn der Server bestätigt hat – ohne Netz also nie. Deshalb geht jeder
Schreibzugriff durch `commit()` in [`src/lib/sync.ts`](src/lib/sync.ts): Es
wartet höchstens zwei Sekunden auf die Bestätigung und meldet sonst
«zwischengespeichert». Scheitert die Übertragung später doch – etwa weil die
Zugriffsregeln sie ablehnen –, erscheint eine Fehlermeldung, statt dass der
Fehler verschwindet.

**Zwei Ausnahmen brauchen eine Verbindung:** der Mitglieder- und der
Liederimport. Beide schreiben Hunderte Dokumente auf einmal; die gehören nicht
in eine Warteschlange, deren Fortschritt sich nicht ehrlich anzeigen lässt.
Ohne Netz sagt die App das und bricht ab, statt halb zu beginnen.

### Wenn zwei Personen dasselbe ändern

Firestore kennt keine Versionskonflikte: Es gewinnt, wer zuletzt schreibt.
Das ist meistens unproblematisch, weil nur die tatsächlich geänderten Felder
übertragen werden.

- **Verschiedene Felder, gleiches Dokument** – beide Änderungen bleiben
  erhalten. Wer die Anwesenden einträgt, überschreibt keine Notiz.
- **Dasselbe Feld** – die zuletzt eintreffende Fassung gilt. Es gibt keine
  Rückfrage und keinen Fehler.
- **Ganze Listen** (Bekanntmachungen, Angelegenheiten, Musik) sind der heikle
  Fall: Sie werden als Ganzes gespeichert. Ohne Schutz verschwänden fremde
  Einträge stillschweigend.

Deshalb merkt sich jede dieser Seiten, auf welchem Stand der Entwurf aufsetzt.
Ändert jemand denselben Sonntag, während hier noch getippt wird, erscheint ein
Hinweis, die Schaltfläche heisst «Trotzdem speichern», und ein Klick verwirft
die eigenen Änderungen zugunsten der fremden Fassung. Der eigene
Schreibvorgang zählt dabei nicht als fremde Änderung – Firestore meldet ihn
sofort wieder als Schnappschuss zurück, und der Hinweis blitzte sonst bei
jeder Eingabe kurz auf. Solange nichts bearbeitet
wird, zeigen die Seiten ohnehin live, was in Firestore steht – fremde
Änderungen erscheinen dort sofort.

Icons ändern:

```bash
# Vorlage in scripts/generate-icons.mjs anpassen
npm install --no-save sharp
node scripts/generate-icons.mjs
```

---

## Sicherung

Die Daten liegen im Firebase-Projekt. Eine regelmässige Sicherung ist trotzdem
sinnvoll:

- **Mitgliederliste:** _Mitglieder → Export_ sichert sie als CSV
- **Vollständig:** [geplante Firestore-Exporte](https://firebase.google.com/docs/firestore/manage-data/export-import)
  in einen Cloud-Storage-Bucket

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
| **Sitzungen**             | Termin festlegen, Traktanden sammeln, Sitzungsmodus zum Durchgehen, Protokoll drucken               |
| **Pendenzen**             | Offenes über alle Sitzungen hinweg, gefiltert nach «meine», «überfällig», «ohne Sitzung»            |
| **Notizen**               | Was nicht an eine Sitzung gehört – für alle sichtbar, speichert von selbst                          |
| **Abendmahlsversammlung** | Ganzer Ablauf pro Sonntag: Leitung, Bekanntmachungen, Angelegenheiten, Ansprachen, Musik, Gebet     |
| **Berufungen**            | Vom Vorschlag bis zur Einsetzung, gruppiert nach Organisation; Verlauf aus der bisherigen Liste     |
| **Mitglieder**            | Stammdaten, Notizen, Suche und Sortierung; Import aus eingefügter Liste, Excel oder CSV, CSV-Export |

Traktandum und Pendenz sind derselbe Datensatz: Was in einer Sitzung offen
bleibt, erscheint automatisch wieder – ohne Umtragen.

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

## Abendmahlsversammlung

Ein Bereich, sechs Unterpunkte – oben wird der Sonntag gewählt, und er gilt
für alle Unterpunkte.

| Unterpunkt           | Wofür                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Leitung**          | Der ganze Ablauf auf einer Seite – hier änderbar, zum Ausdrucken fürs Pult |
| **Bekanntmachungen** | Liste pro Sonntag, in der Reihenfolge des Vorlesens; speichert von selbst  |
| **Angelegenheiten**  | Bestätigungen, Entlassungen, Segnungen, Konfirmierungen                    |
| **Ansprachen**       | Programmplätze vergeben, Vorschlagsliste, Verlauf                          |
| **Musik**            | Drei bis vier Lieder und Musikeinlagen                                     |
| **Gebet**            | Anfangs- und Schlussgebet, mit «zuletzt gebetet»                           |

**Leitung** zeigt den ganzen Ablauf – und alles darin lässt sich hier ändern:
Vorsitz und Begrüssung, Bekanntmachungen, Angelegenheiten, Lieder, Gebete,
Ansprachen und Musikeinlagen. Bei **Es präsidiert** und **Es leitet** stehen
die freigeschalteten Konten zur Wahl – und mit **Person hinzufügen** jede
weitere Person: Ist Besuch aus der Pfahlführung da, präsidiert er, und ein
Konto in der App hat er nicht. Ein einmal erfasster Name ist an jedem Sonntag
wählbar und lässt sich im selben Fenster wieder aus der Auswahl nehmen, ohne
aus schon erfassten Programmen zu verschwinden. Der Knopf **Bearbeiten** schaltet zwischen dem
reinen Programm (so wird es gedruckt) und den Eingabefeldern um; gespeichert
wird laufend, ohne Speichern-Knopf. Was noch fehlt, steht als kurze Liste
zuoberst.

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

**Ein Name von Hand.** Am Pult steht nicht immer jemand aus der eigenen
Gemeinde: ein besuchender Hoher Rat, die Missionare, «Zeugnisse der neuen
Ältesten». In jedes Namensfeld einer Ansprache lässt sich deshalb schreiben,
was dort stehen soll; darunter erscheint **«…» ohne Mitglied eintragen** (die
Eingabetaste tut dasselbe). Der Eintrag belegt seinen Programmplatz wie jeder
andere, ist aber keinem Mitglied zugeordnet und bleibt in der Auswertung «wer
war lange nicht dran» unberücksichtigt. Ein Mitglied wird ausschliesslich dann
zugeordnet, wenn es in der Vorschlagsliste angetippt wird – getippter Text
allein genügt dafür nie.

**Liederliste.** Unter **Import → Lieder** einlesen, dann genügt beim Erfassen
der Musik die Nummer – der Titel erscheint automatisch. Nur die Zahl, aus dem
PV-Liederbuch mit dem Kürzel davor: **«PV 6»**; es zählt wie das Gesangbuch ab
1, ohne das Kürzel wäre nicht zu sagen, welches gemeint ist. Doppelnummern
behalten ihren Buchstaben: «PV 18a». Eine Nummer, die nicht in der Liste steht,
lässt sich von Hand ergänzen und auf Wunsch in die Liste aufnehmen. Der Titel
wird im Programm mitgespeichert, damit ein bereits verteiltes Programm nach
einem Neuimport gleich bleibt.

**Gebet.** Beim Zuteilen steht bei jedem Vorschlag, wann die Person zuletzt
gebetet hat; zuoberst steht, wer noch nie an der Reihe war – dieselbe Logik
wie bei den Ansprachen.

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

## Mitgliederliste importieren

**Mitglieder → Import**.

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

---

## Berufungen und Betreuung importieren

Reiter im Import-Bereich führen zu allem, was sich von aussen übernehmen lässt:
**Mitglieder**, **Berufungen**, **Betreuung**, **Verlauf** und **Lieder**. Die
ersten drei kommen aus dem LCR, und der Weg ist derselbe wie beim
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

---

## Berufungshistorie übernehmen

**Import → Berufungen → Berufungshistorie**, einmalig.

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

## Verlauf aus der bisherigen Excel-Tabelle

**Import → Verlauf**, einmalig.

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

## Liederlisten importieren

**Import → Lieder**, einmalig – einmal je Buch.

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

Die Rolle beschreibt die **Aufgabe** in der Bischofschaft, nicht den Umfang
der Rechte. Bischof, beide Ratgeber und die Sekretäre arbeiten am selben
Datenbestand und sehen alles – auch vertrauliche Traktanden. Einzig ein noch
nicht freigeschaltetes Konto sieht nichts.

| Rolle                 | Zugriff |
| --------------------- | ------- |
| **Bischof**           | alles   |
| **1. Ratgeber**       | alles   |
| **2. Ratgeber**       | alles   |
| **Exekutivsekretär**  | alles   |
| **Sekretär**          | alles   |
| _Wartet auf Freigabe_ | nichts  |

Wozu dann überhaupt Rollen? Sie halten fest, wer welche Aufgabe hat – etwa
wer die Abendmahlsversammlung leitet oder präsidiert – und sie steuern die
Freigabe neuer Konten.

Jede und jeder kann die **eigene Rolle** anpassen, unter
**Einstellungen → Mein Profil** oder in der Liste unter **Benutzer und
Rollen**. Wer beim Einrichten versehentlich als Bischof angelegt wurde, trägt
sich also selbst als 1. Ratgeber ein. Nur den eigenen Zugang entziehen kann
man sich nicht – «Wartet auf Freigabe» steht für das eigene Konto nicht zur
Wahl.

Das Kennzeichen «vertraulich» an einem Traktandum bleibt bestehen: Es markiert
seelsorgerische Anliegen, die nicht nach aussen getragen werden, schränkt den
Zugriff innerhalb der Bischofschaft aber nicht ein.

---

## Projektstruktur

```
src/
├── components/
│   ├── agenda/          Traktanden: Karte, Formular, Sitzungsmodus, Verschieben
│   ├── sacrament/       Abendmahlsversammlung: Rahmen mit Sonntagswahl, Lied- und Personenfelder
│   ├── ui/              Bausteine: Modal, Badges, Avatare, Auswahlfelder
│   ├── Layout.tsx       Navigation (Seitenleiste bzw. untere Leiste)
│   └── UpdatePrompt.tsx Hinweis auf neue Version
├── contexts/            Anmeldung, Stammdaten, Meldungen
├── hooks/               Firestore-Abfragen, lokale Einstellungen, Uhrzeit
├── lib/                 Firebase-Anbindung, Typen, Datums-, Programm- und Hilfsfunktionen
├── pages/
│   ├── sacrament/       Leitung, Bekanntmachungen, Angelegenheiten, Musik, Gebet
│   └── …                Eine Datei pro übriger Ansicht
└── services/            Schreibzugriffe und Fachlogik pro Sammlung

tests/                   Tests der Zugriffsregeln (laufen in der CI)
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

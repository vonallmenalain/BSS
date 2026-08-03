# Bischofschaft

Progressive Web App für die administrativen Aufgaben einer Bischofschaft:
Sitzungen mit Traktanden- und Pendenzenliste, Programm der
Abendmahlsversammlung, Berufungsverwaltung und Mitgliederdaten.

- **Produktion:** [bss.alae.app](https://bss.alae.app) (Netlify)
- **Konzept:** [`docs/KONZEPT.md`](docs/KONZEPT.md)

---

## Auf einen Blick

| Bereich                     | Was die App leistet                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| **Sitzungen**               | Termin festlegen, Traktanden sammeln, Sitzungsmodus zum Durchgehen, Protokoll drucken      |
| **Pendenzen**               | Offenes über alle Sitzungen hinweg, gefiltert nach «meine», «überfällig», «ohne Sitzung»   |
| **Abendmahlsversammlung**   | Ganzer Ablauf pro Sonntag: Leitung, Bekanntmachungen, Angelegenheiten, Ansprachen, Musik, Gebet |
| **Berufungen**              | Vom Vorschlag bis zur Einsetzung, gruppiert nach Organisation                              |
| **Mitglieder**              | Stammdaten, Notizen, Suche und Sortierung; Import aus eingefügter Liste, Excel oder CSV, CSV-Export |

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
(*Firestore-Regeln → Run workflow*), etwa nach einem Wechsel des Projekts.

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

| Rolle | Wofür |
| --- | --- |
| **Firebase Rules Admin** | `firestore.rules` veröffentlichen |
| **Cloud Datastore Index Admin** | Indizes anlegen und ändern |

**3. Zwei Secrets hinterlegen.** GitHub → Repository → **Settings** →
**Secrets and variables** → **Actions** → **New repository secret**:

| Name | Inhalt |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | der **gesamte** Inhalt der JSON-Datei aus Schritt 1 |
| `FIREBASE_PROJECT_ID` | die Projekt-ID, derselbe Wert wie `VITE_FIREBASE_PROJECT_ID` |

Beim JSON die komplette Datei einfügen, von der ersten geschweiften Klammer
bis zur letzten. Fehlt eines der beiden Secrets, bricht der Workflow mit einer
Meldung ab, die genau darauf hinweist.

**4. Löschen nicht vergessen.** Die heruntergeladene JSON-Datei vom eigenen
Rechner entfernen, sobald sie in GitHub hinterlegt ist.

### Wenn das Ausrollen scheitert

- *«Missing permissions»* → Schritt 2 wurde übersprungen oder betraf das
  falsche Dienstkonto.
- *Indizes können nicht gelöscht werden* → Der Workflow entfernt bewusst keine
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
einschliesslich Programm der Abendmahlsversammlung, Gebete und Liederliste.

Dieselben Tests laufen in der CI, bevor Regeln ausgerollt werden.

---

## Abendmahlsversammlung

Ein Bereich, sechs Unterpunkte – oben wird der Sonntag gewählt, und er gilt
für alle Unterpunkte.

| Unterpunkt            | Wofür |
| --------------------- | ----- |
| **Leitung**           | Der ganze Ablauf auf einer Seite, zum Ausdrucken fürs Pult |
| **Bekanntmachungen**  | Liste pro Sonntag, in der Reihenfolge des Vorlesens |
| **Angelegenheiten**   | Bestätigungen, Entlassungen, Segnungen, Konfirmierungen |
| **Ansprachen**        | Programmplätze vergeben, Vorschlagsliste, Verlauf |
| **Musik**             | Drei bis vier Lieder und Musikeinlagen |
| **Gebet**             | Anfangs- und Schlussgebet, mit «zuletzt gebetet» |

**Leitung** erfasst nichts doppelt. Ansprachen, Bekanntmachungen, Lieder und
Gebete stammen aus ihren Bereichen und erscheinen dort automatisch; der Ablauf
folgt dem Handbuch (Abschnitt 29.2.1), vereinfacht auf das, was am Pult
gebraucht wird. Anpassbar ist an dieser Stelle, wer leitet und präsidiert, wen
man begrüsst – und mit den Pfeiltasten die Reihenfolge von Ansprachen,
Zeugnissen, Zwischenlied und Musikeinlagen. Was noch fehlt, steht als kurze
Liste zuoberst.

**Ansprachen und Zeugnisse.** Wie viele Ansprachen eine Versammlung hat, steht
als Standard in den Einstellungen. Für einen einzelnen Sonntag lässt sich mehr
vorsehen: eine zusätzliche Ansprache, ein Zeugnis oder ein leerer Platz zum
späteren Vergeben. Der Standard bleibt davon unberührt.

**Liederliste.** Unter **Einstellungen → Liederliste** eine Excel- oder
CSV-Datei mit Liednummer und Titel hochladen. Welche Spalten das sind, erkennt
der Import selbst und zeigt es vor dem Übernehmen zur Kontrolle. Danach genügt
beim Erfassen der Musik die Nummer – der Titel erscheint automatisch. Eine
Nummer, die nicht in der Liste steht, lässt sich von Hand ergänzen und auf
Wunsch in die Liste aufnehmen. Der Titel wird im Programm mitgespeichert,
damit ein bereits verteiltes Programm nach einem Neuimport gleich bleibt.

**Gebet.** Beim Zuteilen steht bei jedem Vorschlag, wann die Person zuletzt
gebetet hat; zuoberst steht, wer noch nie an der Reihe war – dieselbe Logik
wie bei den Ansprachen.

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

## Rollen

Die Rolle beschreibt die **Aufgabe** in der Bischofschaft, nicht den Umfang
der Rechte. Bischof, beide Ratgeber und die Sekretäre arbeiten am selben
Datenbestand und sehen alles – auch vertrauliche Traktanden. Einzig ein noch
nicht freigeschaltetes Konto sieht nichts.

| Rolle                   | Zugriff |
| ----------------------- | ------- |
| **Bischof**             | alles   |
| **1. Ratgeber**         | alles   |
| **2. Ratgeber**         | alles   |
| **Exekutivsekretär**    | alles   |
| **Sekretär**            | alles   |
| *Wartet auf Freigabe*   | nichts  |

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
├── lib/                 Firebase-Anbindung, Typen, Datums- und Hilfsfunktionen
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

| Anzeige | Bedeutung |
| --- | --- |
| «Gespeichert.» | Der Server hat bestätigt. |
| «… Wird übertragen, sobald wieder Verbindung besteht.» | Lokal gespeichert, Übertragung steht aus. |
| Wolken-Symbol in der Kopfzeile mit Zahl | So viele Änderungen sind noch unterwegs. Verschwindet es, ist alles beim Server. |

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
die eigenen Änderungen zugunsten der fremden Fassung. Solange nichts bearbeitet
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

- **Mitgliederliste:** *Einstellungen → Daten → Mitgliederliste als CSV sichern*
- **Vollständig:** [geplante Firestore-Exporte](https://firebase.google.com/docs/firestore/manage-data/export-import)
  in einen Cloud-Storage-Bucket

# Bischofschaft

Progressive Web App für die administrativen Aufgaben einer Bischofschaft:
Sitzungen mit Traktanden- und Pendenzenliste, Ansprachenplanung,
Berufungsverwaltung und Mitgliederdaten.

- **Produktion:** [bss.alae.app](https://bss.alae.app) (Netlify)
- **Konzept:** [`docs/KONZEPT.md`](docs/KONZEPT.md)

---

## Auf einen Blick

| Bereich          | Was die App leistet                                                                     |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Sitzungen**    | Termin festlegen, Traktanden sammeln, Sitzungsmodus zum Durchgehen, Protokoll drucken     |
| **Pendenzen**    | Offenes über alle Sitzungen hinweg, gefiltert nach «meine», «überfällig», «ohne Sitzung»  |
| **Ansprachen**   | Programm der nächsten Sonntage, Vorschlagsliste «wer war lange nicht dran»                |
| **Berufungen**   | Vom Vorschlag bis zur Einsetzung, gruppiert nach Organisation                             |
| **Mitglieder**   | Stammdaten, Notizen, Suche und Sortierung; Excel-/CSV-Import und -Export                  |

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
npx firebase use --add          # das Projekt auswählen
npx firebase deploy --only firestore:rules,firestore:indexes
```

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

---

## Mitgliederliste importieren

**Mitglieder → Import** (nur für Bischof und Ratgeber).

Unterstützt werden `.xlsx` und `.csv`. Der Assistent führt durch vier
Schritte: Datei wählen, Spalten zuordnen (wird geraten), Vorschau prüfen,
importieren.

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

| Rolle         | Sitzungen & Pendenzen | Mitglieder | Vertrauliche Traktanden | Benutzer verwalten | Import |
| ------------- | :-------------------: | :--------: | :---------------------: | :----------------: | :----: |
| **Bischof**   |           ✓           |     ✓      |            ✓            |         ✓          |   ✓    |
| **Ratgeber**  |           ✓           |     ✓      |            ✓            |         ✓          |   ✓    |
| **Sekretär**  |           ✓           |     ✓      |            –            |         –          |   –    |
| *pending*     |           –           |     –      |            –            |         –          |   –    |

Vertrauliche Traktanden werden Sekretären nicht bloss ausgeblendet – die
Firestore-Regeln liefern sie gar nicht erst aus.

---

## Projektstruktur

```
src/
├── components/
│   ├── agenda/          Traktanden: Karte, Formular, Sitzungsmodus, Verschieben
│   ├── ui/              Bausteine: Modal, Badges, Avatare, Auswahlfelder
│   ├── Layout.tsx       Navigation (Seitenleiste bzw. untere Leiste)
│   └── UpdatePrompt.tsx Hinweis auf neue Version
├── contexts/            Anmeldung, Stammdaten, Meldungen
├── hooks/               Firestore-Abfragen, lokale Einstellungen, Uhrzeit
├── lib/                 Firebase-Anbindung, Typen, Datums- und Hilfsfunktionen
├── pages/               Eine Datei pro Ansicht
└── services/            Schreibzugriffe und Fachlogik pro Sammlung

firestore.rules          Zugriffsregeln (die eigentliche Absicherung)
firestore.indexes.json   Zusammengesetzte Indizes
netlify.toml             Build, Weiterleitungen, Header
scripts/                 Icon-Generierung
docs/KONZEPT.md          Fachliches Konzept
```

---

## PWA

Die App ist installierbar (Browser-Menü → «Zum Startbildschirm hinzufügen»)
und läuft offline. Firestore hält eine lokale Kopie der Daten vor; Änderungen
ohne Netz werden gepuffert und später synchronisiert.

Neue Versionen werden nicht ungefragt geladen – stattdessen erscheint ein
Hinweis mit einer Schaltfläche. So startet die App nicht mitten in der Sitzung
neu und verliert Eingaben.

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

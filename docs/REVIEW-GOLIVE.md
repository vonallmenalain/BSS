# Gesamt-Review vor dem Produktivstart

> **Stand der Umsetzung (6. August 2026):** Erledigt sind 1.1 (Logout löscht
> lokale Daten), 1.4 (Error Boundary), 1.5 (Autosave), 1.6 (iOS-Zoom),
> 1.7 (Lint) sowie aus Stufe 2: Benutzerverwaltung nur noch über das
> Administrator-Konto (2.1), zeilenweises Zusammenführen der Berufungsrunde
> und Konfliktkopie bei Notizen (2.2), «Rückgängig»-Toast statt sofortigem
> Löschen (2.4b), Absicherung der Einstellungswerte (2.5), fehlende
> Fehlerbehandlung (2.7) und die kleineren Bugs (2.8). Punkt 1.2 (PITR)
> übernimmt der Betreiber in der Firebase-Konsole; 1.3 ist bei 3–4 bekannten
> Nutzern als Risiko akzeptiert; 2.3 (Touch-Ziele), 2.4a (Dialog-Fokus),
> 2.6 (CSP) und Stufe 3 sind bewusst zurückgestellt.

Stand: 6. August 2026. Geprüft wurden Sicherheit (Firestore-Regeln, Auth,
lokale Datenhaltung, Header), Nutzerfreundlichkeit und Mobile, die
Daten-/Backend-Schicht sowie die Code-Qualität (Typecheck, Lint, Tests,
Build, Bug-Suche). Alle Befunde sind am Code verifiziert; Datei und Zeile
stehen jeweils dabei.

**Gesamturteil:** Die App ist für einen ersten Entwurf ungewöhnlich reif.
Typecheck sauber, 321/321 Tests grün, Build in Ordnung, durchdachtes
Offline-Konzept (Watermark-Sync, Offline-Queue mit ehrlicher Anzeige),
konsequente Empty States, Schweizer Datumsformate, Bestätigungsdialoge,
saubere Firestore-Regeln mit Default-Deny und getrennten AP-Rollen. Für die
Vorstellung in der Bischofschaft steht dem nichts im Weg. Vor dem
**produktiven** Betrieb mit echten Personendaten sollten aber die Punkte
der Stufe 1 erledigt sein.

---

## Stufe 1 – vor dem Produktivstart zwingend

### 1.1 Abmelden lässt alle Personendaten auf dem Gerät zurück (Sicherheit, KRITISCH)

`src/contexts/AuthContext.tsx:216-230`, `src/lib/firebase.ts:64-69`.
Die Offline-Persistenz (`persistentLocalCache`, unbegrenzt) legt den ganzen
Datenbestand – Mitglieder mit Adressen und Notizen, seelsorgerische
Traktanden, Berufungen – unverschlüsselt in IndexedDB ab. `signOut` leert
nur die In-Memory-Stores; `clearIndexedDbPersistence`/`terminate` kommen im
ganzen Code nicht vor. Wer sich auf einem fremden oder geteilten Gerät
abmeldet, hinterlässt dort sämtliche Daten, mit den DevTools auslesbar.

**Fix:** Im `signOut` nach `fbSignOut`: `await terminate(db)` und
`await clearIndexedDbPersistence(db)`, dazu die `bss:sync:*`-Watermarks aus
localStorage löschen, anschliessend `location.assign('/anmelden')` (nach
`terminate` ist ein Neustart der App nötig).

### 1.2 Kein Backup, aber viele unwiderrufliche Löschpfade (Betrieb, KRITISCH)

Firestore hat ohne Konfiguration weder Backup noch Papierkorb. Gleichzeitig
kann jedes Vollzugriffskonto endgültig löschen: Sitzungen, Notizen,
Ansprachen, Massenlöschung von Mitgliedern über den Import
(`removeMissing`, `src/services/import.ts:539-546`), AP-Import mit
`replace`. Eine falsche Importdatei oder ein kompromittiertes Konto genügt
für irreparablen Datenverlust.

**Fix:** (a) Point-in-time-Recovery im Firebase-Projekt aktivieren
(`gcloud firestore databases update --enable-pitr`, 7 Tage Rückgriff –
wichtigste Einzelmassnahme, kein Code nötig). (b) Zusätzlich ein
«Alle Daten als JSON herunterladen»-Knopf in den Einstellungen – die Daten
liegen ohnehin im Client vor, ~20 Zeilen Code – oder ein geplanter
`gcloud firestore export`.

### 1.3 Freischaltung lässt sich mit gefälschtem Profil erschleichen (Sicherheit, HOCH)

Kette: offene Registrierung (`src/pages/Login.tsx:184-190`), die
create-Regel prüft nur `role == 'pending'` – `email` und `displayName` im
Profil sind frei wählbar und werden nicht gegen die echte Login-E-Mail
geprüft (`firestore.rules:109-112`) – und freischalten darf jedes
Vollzugriffskonto (`src/pages/Settings.tsx:627-631`). Ein Fremder
registriert sich als «Hans Muster» mit plausibler Mail-Angabe im Profil und
wartet, bis ihn jemand gutgläubig freischaltet.

**Fix:** In der create-Regel
`request.resource.data.email == request.auth.token.email` erzwingen und in
der Freischalt-Ansicht die verifizierte Auth-Mail anzeigen. Zusätzlich in
Firebase Auth die E-Mail-Verifizierung verlangen. Organisatorisch:
Freischaltung nur durch den Bischof (siehe 2.1).

### 1.4 Keine Error Boundary – ein Renderfehler heisst weisser Bildschirm (Stabilität, HOCH)

`src/App.tsx`; im ganzen `src/` gibt es keine Error Boundary. Ein einziger
Renderfehler (etwa durch ein unerwartetes Feld in einem Firestore-Dokument)
legt die ganze PWA lahm – am Sonntag am Pult der schlechteste Moment.

**Fix:** Eine ErrorBoundary-Komponente um `<Layout/>` (und je Route in den
bestehenden `Suspense`-Wrappern) mit «Neu laden»-Fallback.

### 1.5 Autosave speichert zurückgenommene Änderungen nie (Datenverlust, HOCH)

`src/hooks/useAutosave.ts:101-113`. `opened` wird beim Öffnen fixiert und
nach einem Save nicht nachgeführt. Ablauf: Text A → B tippen (wird nach
900 ms gespeichert), dann zurück auf A ändern → die Signatur entspricht dem
Öffnungsstand, es wird nichts mehr geschrieben. Die Anzeige zeigt A, in
Firestore steht B; beim nächsten Öffnen ist B wieder da. Betroffen:
Notizen (`src/pages/Notes.tsx:458`) und der Traktanden-Editor
(`src/components/agenda/AgendaItemEditor.tsx:83`).

**Fix:** In `run()` nach erfolgreichem `await save(value)` den Vergleichs-
stand nachführen: `opened.current = JSON.stringify(value)`.

### 1.6 iOS zoomt bei jedem Eingabefeld hinein (Mobile, HOCH)

`src/index.css:163-170`: Das `input`-Utility setzt 14 px (`text-sm`).
iOS Safari (auch als installierte PWA) zoomt bei Schriftgrössen unter 16 px
in jedes fokussierte Feld – das Layout springt bei jedem Formular.

**Fix:** Auf schmalen Screens 16 px erzwingen, z. B. `text-base sm:text-sm`
im `input`-Utility (gilt über das Utility auch für select/textarea).

### 1.7 Lint bricht mit einem Fehler ab (Pipeline, MITTEL)

`src/hooks/useBack.ts:131` – React-Compiler-Fehler «Existing memoization
could not be preserved» (Deps `origin?.from` statt `origin`). Funktional
harmlos, aber `npm run lint` endet rot.

**Fix:** `origin?.from` vor dem `useCallback` in eine Variable ziehen oder
das Dep-Array anpassen. Die 23 Warnungen (`set-state-in-effect`) können
bleiben.

---

## Stufe 2 – dringend empfohlen, in den ersten Wochen

### 2.1 Jedes freigeschaltete Konto ist voller Benutzer-Admin (Sicherheit/Governance)

`firestore.rules:124-126`. Jede Vollzugriffsrolle kann jeden befördern,
degradieren, deaktivieren oder löschen – auch den Bischof, auch alle auf
einmal (Reparatur dann nur über die Firebase-Konsole). Es gibt keine
Validierung, dass `role` überhaupt ein gültiger Wert ist, und keine Spur,
wer wen freigeschaltet hat.

**Empfehlung:** Rollen-/`active`-Änderungen und Löschen auf den Bischof
(ggf. plus Ratgeber) beschränken; mindestens den Rollenwert gegen die
gültige Liste validieren und Selbst-Deaktivierung sowie das Löschen des
eigenen Profils verbieten. Wenn «alle verwalten alle» bewusst so bleiben
soll: als Entscheid dokumentieren.

### 2.2 Gleichzeitige Bearbeitung überschreibt sich bei Traktanden und Berufungsrunden

`src/components/agenda/AgendaItemEditor.tsx:62-93`. Der Editor lädt den
Eintrag einmal und schreibt beim Speichern alle Felder als Ganzes zurück –
inklusive der kompletten `callingChanges`-Tabelle. Die Berufungsrunde ist
aber genau dafür gedacht, dass mehrere Mitglieder gleichzeitig Zeilen
abhaken: Wer später speichert, überschreibt die Änderungen der anderen
kommentarlos. Dasselbe Muster bei Notizen (`src/services/notes.ts:49-63`).
Das Sonntagsprogramm macht es mit `useDraft` bereits richtig vor.

**Fix:** `callingChanges` zeilenweise schreiben (Feldpfade/Map statt
ganzem Array) oder die Konfliktprüfung aus
`src/components/sacrament/useDraft.ts:37-57` übernehmen.

### 2.3 Zu kleine Touch-Ziele an den meistgenutzten Stellen (Mobile)

Richtwert ≥ 44 px; real ~24-28 px bei: Umsortier-Pfeilen der Ansprachen
(`src/pages/Talks.tsx:527-545`, zwei Pfeile direkt übereinander – genau die
Sonntags-Interaktion), Angelegenheiten (`src/pages/sacrament/WardBusiness.tsx:101-128`),
Bekanntmachungen (`Announcements.tsx:185ff.`), Notiz-Aktionen
(`Notes.tsx:346,355`), Navigations-Chevron (`Layout.tsx:332-343`); Header-
Knöpfe ~36 px. **Fix:** mindestens `p-2` + `size-5` und Abstand zwischen
gestapelten Pfeilen.

### 2.4 Löschsicherheit in den Schnell-Listen

(a) Der Bestätigen-Knopf ist auch bei Lösch-Dialogen vorfokussiert –
versehentliches Enter bestätigt die Löschung
(`src/components/ui/Modal.tsx:205-207`; bei `danger` den Abbrechen-Knopf
fokussieren). (b) Musikeinlagen, Angelegenheiten und Bekanntmachungs-Zeilen
löschen sofort und ohne Rückfrage oder Undo
(`src/pages/sacrament/Music.tsx:120-127`, `WardBusiness.tsx:120-127`,
`Conducting.tsx` ~697-755) – in Kombination mit 2.3 riskant; Undo-Toast
(«Eintrag entfernt – Rückgängig») ergänzen.

### 2.5 Leere Einstellungswerte legen das Eintragen lahm

`src/pages/Settings.tsx:354-374`. Wird die Abendmahlszeit geleert, speichert
das Autosave `''`; danach wirft `Timestamp.fromDate` bei jedem Eintragen
einer Ansprache (`src/pages/Talks.tsx:965`, `Conducting.tsx:416`) – nur mit
generischem Fehler-Toast. Leeres `talksPerSunday` wird als 0 gespeichert:
alle Sonntage zeigen 0 Plätze. **Fix:** beim Speichern validieren bzw. auf
die Defaults zurückfallen.

### 2.6 Content-Security-Policy fehlt

`netlify.toml:15-24` ist sonst solide (X-Frame-Options, HSTS, nosniff,
Referrer-Policy). Eine CSP als zweite Verteidigungslinie ergänzen –
gerade weil viel Fremdtext importiert wird (docx, xlsx, CSV). Vorschlag im
Sicherheitsbericht; vor dem Rollout gegen die echten Firestore-Endpunkte
testen (Long-Polling/WebChannel).

### 2.7 Ungefangene Fehler in Lösch-/Statusaktionen

Ohne try/catch bzw. `.catch`: `startMeeting`/`reopenMeeting`
(`src/pages/MeetingDetail.tsx:283,299`), `deleteMeeting` (`:483`),
`deleteTalk` (`src/pages/Talks.tsx:1430`), Serie löschen
(`src/pages/sacrament/Announcements.tsx:799`). Schlägt der Vorgang fehl
(offline, Berechtigung), passiert sichtbar nichts. Muster der übrigen
Handler (try/catch + `toast.error`) übernehmen.

### 2.8 Kleinere verifizierte Bugs

- «Anfragen» aus den Vorschlägen fällt auf das heutige Datum zurück, wenn
  kein Sonntag frei ist – der Eintrag landet unsichtbar an einem Werktag
  (`src/pages/Talks.tsx:415-420`; Fallback `schedule[0].date`).
- Slot-Tausch ist nicht atomar – zwei Ansprachen können auf demselben Platz
  landen, die zweite verschwindet optisch (`src/pages/Talks.tsx:198-202`,
  `src/services/sacrament.ts:256-258`; `writeBatch` verwenden).
- Settings-Formular kann bei eintreffendem Snapshot Tipparbeit verlieren
  (`src/pages/Settings.tsx:116`; nur übernehmen, wenn nicht dirty).
- Fremde Löschungen bleiben in laufender Sitzung unsichtbar, weil der
  Zählabgleich nur einmal pro Sitzung läuft
  (`src/lib/collectionStore.ts:361-364`; bei `visibilitychange` → sichtbar
  wiederholen).

---

## Stufe 3 – nachgelagert, iterativ

**Sicherheit/Betrieb:** Passwort-Mindestlänge in Firebase Auth auf ≥ 10
stellen, MFA für Vollzugriffsrollen erwägen; E-Mail-Enumeration-Schutz im
Projekt aktivieren; App Check erwägen; Schema-Validierung mindestens für
die AP-Sammlungen (Fremdrolle `ap_editor` schreibt unvalidiert);
`unchanged()` in den Rules gegen Feld-Löschung härten
(`firestore.rules:92-96`); toten Mitglieder-CSV-Export entfernen oder
verdrahten (`src/services/import.ts:560-616`); Rules-Tests ergänzen
(deaktivierte Konten, `delete` auf users, create-Varianten).

**Datenpflege:** Umbenennung eines Mitglieds führt denormalisierte Namen
künftiger Talks/Gebete/aktiver Berufungen nicht nach
(`src/services/members.ts:56-70`); Mitglieder-Entfernung im Import lässt
aktive Berufungen und Ministering-Verweise zurück; AP-Import-`replace`
löscht auch Handeinträge (mit `importedFrom` kennzeichnen); Protokoll-
Import ohne «ersetzen» dupliziert; `pagehide`-Handler im Autosave ergänzen
(30-Sekunden-Fenster beim Tab-Schliessen); Sync-Fehler-Toast um den
betroffenen Eintrag ergänzen.

**UX-Feinschliff:** Anruf-/Mail-Knöpfe ausgerechnet auf dem Telefon
ausgeblendet (`src/pages/Members.tsx:166`, `Talks.tsx:515-523` –
`hidden sm:flex` entfernen); aria-Labels für Icon-only-Knöpfe auf Mobile
(`Talks.tsx:242`, `ApActivities.tsx:194`, `Conducting.tsx:881`); Kontrast
`text-slate-400` → `text-slate-500` für inhaltstragende Kleintexte;
Hinweis auf der Warteseite, dass man den Sekretär/Bischof kurz anstossen
soll (`src/pages/PendingApproval.tsx:29-37`); xlsx-Uploads um den
MIME-Typ ergänzen (Android-Dateipicker); Scroll-Hinweis an den Tab-Leisten;
«Ziehen und Ablegen»-Hinweis relativieren (geht auf Touch nicht);
theme-color im Light Mode an den weissen Header angleichen; kleine
Schliessen-Ziele in Toast/Update-Hinweis; Geburtstagshinweis 29. Februar
(`src/lib/dates.ts:213-215`).

---

## Ausdrücklich geprüft und in Ordnung

- Keine Secrets im Repo, `.gitignore` und CI-Umgang mit dem
  Service-Account korrekt; `noindex` und robots.txt gesetzt.
- Pending-Konten sehen nichts; Selbst-Freischaltung blockiert; AP-Rollen
  sauber auf zwei Sammlungen begrenzt; Default-Deny am Schluss der Rules.
- Service Worker cached keine Firestore-/Auth-Daten, nur eigene Assets.
- Ladeverhalten sparsam (Warmstart ~15-25 Reads); Kostenrisiko auch auf
  Jahre niedrig; keine Memory-Leaks; alle Indexe vorhanden.
- Datums-/Zeitzonenlogik (Sonntage, Serien, Jahreswechsel, Sommerzeit)
  fehlerfrei, durch 321 grüne Tests abgedeckt.
- Import-Pipeline: Batch-Limits eingehalten, deterministische IDs gegen
  Dubletten, Löschungen zuletzt, Online-Pflicht bei Massenimporten.
- Navigation vollständig, Offline-Anzeige ehrlich, Update-Prompt
  vorbildlich, Sitzungs- und Pult-Modus gut auf den Einsatz zugeschnitten.

# App-Konzept «Bischofschaft»

Stand: erste Fassung, umgesetzt als lauffähiger Entwurf.

---

## 1. Ausgangslage

Die Bischofschaft leitet eine Kirchengemeinde. Die Arbeit verteilt sich auf

| Rolle         | Personen | Zugriff                                                             |
| ------------- | -------- | ------------------------------------------------------------------- |
| **Bischof**   | 1        | alles, inklusive vertraulicher Traktanden                            |
| **Ratgeber**  | 2        | alles, inklusive vertraulicher Traktanden                            |
| **Sekretäre** | 2        | alles ausser vertraulichen Traktanden; arbeiten bei Bedarf mit       |

Der Takt ist die **wöchentliche Sitzung**. Dazwischen sammeln sich Themen an,
in der Sitzung werden sie abgearbeitet, und was offen bleibt, muss beim
nächsten Mal wieder auf den Tisch.

Daneben laufen zwei wiederkehrende Aufgaben: **Ansprachen vergeben** und
**Berufungen begleiten**. Beide brauchen dieselbe Grundlage – eine gepflegte
**Mitgliederliste**.

---

## 2. Leitgedanken

Vier Entscheidungen prägen den ganzen Entwurf:

**Traktandum und Pendenz sind dasselbe Objekt.**
Der übliche Fehler wäre, zwei Listen zu führen und Einträge hin- und
herzuschieben. Stattdessen gibt es einen Eintrag mit einem Status. Ist er in
einer Sitzung traktandiert, heisst er Traktandum; bleibt er offen, heisst er
Pendenz. Beim Abschluss der Sitzung lösen sich offene Einträge automatisch von
ihr und warten auf die nächste. Nichts geht verloren, nichts muss umgetragen
werden.

**Die Sitzung führt, nicht die Liste.**
Während der Sitzung zählt nur eine Frage: Was ist gerade dran? Deshalb steht
der Sitzungsmodus im Mittelpunkt – ein Traktandum gross im Bild, Notizfeld und
Statusknöpfe darunter, weiter zum nächsten. Die Listenansicht bleibt für die
Vorbereitung.

**Vertrauliches bleibt vertraulich.**
Seelsorgerische Themen gehen Sekretäre nichts an. Das ist keine
Anzeige-Einstellung, sondern in den Firestore-Sicherheitsregeln verankert:
Sekretäre bekommen solche Dokumente gar nicht erst ausgeliefert.

**Der Import ist Nebensache, aber muss verlässlich sein.**
Alle drei bis vier Monate eine Excel-Datei einlesen – das darf ruhig versteckt
sein, darf aber niemals Dubletten erzeugen oder gepflegte Notizen überschreiben.

---

## 3. Die drei Arbeitsbereiche

### 3.1 Sitzungsmanagement

```
Sammelkorb  ──►  Sitzung  ──►  erledigt
    ▲                │
    └────────────────┘
      offen geblieben
```

**Vorbereiten.** Traktanden lassen sich jederzeit erfassen – mit Titel,
Beschreibung, Bereich, Priorität, Zuständigen, betroffenen Mitgliedern und
einem Termin. Ohne Sitzungszuordnung landen sie im Sammelkorb.

**Nächste Sitzung festlegen.** Datum, Zeit, Ort und Anwesende. Die
Einstellungen kennen den üblichen Wochentag und schlagen den Termin vor. Ein
Klick übernimmt alle offenen Pendenzen in die neue Sitzung.

**Durchführen (Sitzungsmodus).** Fortschrittsbalken, Sprungleiste über alle
Traktanden, dann das aktuelle Thema in voller Breite: Beschreibung,
Zuständige, betroffene Mitglieder, Notizen. Darunter die Aktionsleiste –
*Erledigt*, *In Arbeit*, *Verschieben*, *Verwerfen* – und Vor/Zurück.
Nach «Erledigt» rückt die App von selbst zum nächsten Punkt. Am Laptop geht
das Blättern auch mit den Pfeiltasten, `N` springt ins Notizfeld.

**Verschieben.** Vier Fälle, die im Alltag vorkommen, als je ein Klick:
auf die nächste Sitzung, um eine Woche, um einen Monat, um drei Monate –
plus freies Datum. Jede Verschiebung zählt mit: Ein Traktandum mit
«3× verschoben» fällt in der Liste auf, und genau das soll es auch.

**Abschliessen.** Alles Offene wird zur Pendenz, die Sitzung wandert ins
Archiv, und die App bietet gleich die Folgeplanung an. Ein Protokoll lässt
sich drucken.

### 3.2 Ansprachenmanagement

**Programm.** Die nächsten acht Abendmahlsversammlungen mit je drei
Programmplätzen (einstellbar). Freie Plätze sind sofort als solche erkennbar.

**Vorschläge.** Die eigentliche Antwort auf «wer war schon lange nicht mehr
dran»: eine nach Dringlichkeit sortierte Liste. Zuoberst, wer noch nie
gesprochen hat, danach nach Abstand absteigend. Wer bereits eingeplant ist,
rutscht nach unten – aber bleibt sichtbar, damit klar ist warum.

**Nachführen.** Beim Wechsel auf «gehalten» schreibt die App das Datum der
letzten Ansprache beim Mitglied fort und erhöht den Zähler. Ein nachgetragener
alter Termin überschreibt dabei nie ein neueres Datum.

Statusfolge: *Vorgesehen → Angefragt → Zugesagt → Gehalten*
(mit *Abgesagt* und *Gestrichen* als Ausstieg).

### 3.3 Berufungsmanagement

Berufungen durchlaufen feste Schritte, und jeder hat sein Datum:

*Vorgeschlagen → Genehmigt → Berufung ausgesprochen → Bestätigt → Eingesetzt*
(→ *Entlassen*)

Die Ansicht gruppiert nach Organisation (Ältestenkollegium, FHV, JD, JM, PV,
Sonntagsschule …) und kennt die üblichen Positionen als Eingabehilfe. Ein
Knopf «Mit heutigem Datum» schiebt eine Berufung einen Schritt weiter, ohne
dass jemand ein Datum tippen muss.

---

## 4. Mitgliederverwaltung

Die gemeinsame Datenbasis für alles andere.

**Felder.** Vor- und Nachname, Geschlecht, Geburtsdatum, E-Mail, Telefon und
Mobile, Adresse, Status (aktiv / weniger aktiv / inaktiv / weggezogen),
Notiz, Kontaktperson, Schlagworte, Datum der letzten Ansprache, Anzahl
Ansprachen.

**Sortieren und filtern.** Nach Nachname, Vorname, Alter, letzter Ansprache
oder Status; dazu Volltextsuche über Name, E-Mail, Telefon, Ort und Notiz.
Die Sortierung «letzte Ansprache» stellt bewusst diejenigen nach vorn, die
noch nie gesprochen haben.

**Notiz pro Mitglied.** Freitext für Betreuungshinweise, Absprachen oder wer
Kontaktperson ist. Die Kontaktperson lässt sich zusätzlich als Verweis auf ein
anderes Mitglied setzen.

**Import (alle 3–4 Monate).** Ein vierstufiger Assistent, erreichbar über
*Mitglieder → Import* – nicht prominent, aber auffindbar:

1. **Datei** – `.xlsx` oder `.csv`, per Auswahl oder Drag-and-drop.
2. **Spalten** – die App rät die Zuordnung anhand der Überschriften
   (deutsch und englisch) und lässt sie korrigieren.
3. **Prüfen** – eine Vorschau zeigt pro Zeile, ob neu angelegt oder
   aktualisiert wird, und warnt bei unsicheren Zuordnungen.
4. **Schreiben** – in Blöcken, mit Fortschrittsanzeige.

Der Abgleich läuft in drei Stufen: Mitglieds-Nummer (sicher), dann Name +
Geburtsdatum (nahezu sicher), dann Name allein (mit Warnung). Drei Schalter
schützen gepflegte Daten: leere Zellen ignorieren, Notizen behalten,
Status behalten.

Ein CSV-Export dient als Sicherung.

---

## 5. Technik

| Baustein     | Wahl                                       | Begründung                                                     |
| ------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite                 | schnelle Entwicklung, gute Typsicherheit                        |
| Gestaltung   | Tailwind CSS v4                            | einheitliches Erscheinungsbild ohne separate CSS-Pflege         |
| PWA          | vite-plugin-pwa (Workbox)                  | installierbar, offline lauffähig                                |
| Daten        | Firebase Firestore                         | Echtzeit-Synchronisation, Offline-Cache eingebaut               |
| Anmeldung    | Firebase Authentication (E-Mail/Passwort)  | bereits vorhanden                                               |
| Auslieferung | Netlify → `bss.alae.app`                   | bereits eingerichtet                                            |

**Warum Echtzeit zählt.** Wenn in der Sitzung drei Personen dieselbe Liste
offen haben, sieht jede sofort, was die andere ändert. Firestore liefert das
ohne Zusatzaufwand.

**Warum offline zählt.** Firestore legt eine lokale Kopie an. Fällt im
Sitzungszimmer das Netz aus, wird weitergearbeitet; die Änderungen fliessen
nach, sobald wieder Verbindung besteht. Die PWA-Hülle sorgt dafür, dass die
App selbst auch ohne Netz startet.

### Datenmodell

```
users/{uid}            Rolle, Name, aktiv/inaktiv
meetings/{id}          Datum, Titel, Ort, Status, Anwesende, Gebete, Notizen
agendaItems/{id}       Traktandum = Pendenz
                       ├─ meetingId  (null = Sammelkorb)
                       ├─ status     offen | in Arbeit | erledigt |
                       │             zurückgestellt | verworfen
                       ├─ assignees  UIDs der Zuständigen
                       ├─ memberRefs betroffene Mitglieder
                       ├─ dueDate, priority, category, deferCount
                       ├─ confidential
                       └─ notes[], history[]
members/{id}           Stammdaten, Status, Notiz, lastTalkDate, talkCount
talks/{id}             Mitglied, Datum, Programmplatz, Thema, Status
callings/{id}          Mitglied, Position, Organisation, Status, Meilensteine
settings/app           Gemeindename, Sitzungsrhythmus, Ansprachen-Vorgaben
```

`lastTalkDate` und `talkCount` liegen bewusst redundant beim Mitglied. Ohne
diese Vorberechnung liesse sich die Frage «wer war lange nicht dran» nicht
sortieren, ohne bei jedem Aufruf sämtliche Ansprachen zu laden.

### Rechte

Zugriff bekommt nur, wer angemeldet **und** freigeschaltet ist. Neue Konten
starten als `pending` und sehen nichts – erst ein Bischof oder Ratgeber
vergibt eine Rolle. Durchgesetzt wird das in `firestore.rules`, nicht im
Frontend.

Vertrauliche Traktanden sind der einzige Fall einer feineren Abstufung: Für
Sekretäre filtert bereits die Abfrage auf `confidential == false`, und die
Regeln erzwingen genau das.

---

## 6. Bedienung

**Zuerst das Handy.** Die Sitzung findet am Tisch statt, oft mit dem Telefon
in der Hand. Untere Navigationsleiste, grosse Tippflächen, Dialoge fahren als
Blatt von unten ein. Am Desktop wird daraus eine Seitennavigation.

**Wenig Farbe, klare Signale.** Gedecktes Blau als Grundton; Rot und Bernstein
sind für Überfälliges und Warnungen reserviert. Ein rot markierter Rand heisst
immer dasselbe: Termin verstrichen.

**Dunkelmodus** folgt dem System oder wird manuell gesetzt.

---

## 7. Umgesetzt und offen

**Enthalten:**

- Anmeldung, Registrierung, Passwort zurücksetzen, Freigabe-Sperre
- Rollen und Benutzerverwaltung
- Sitzungen planen, starten, durchführen, abschliessen, Protokoll drucken
- Sitzungsmodus mit Notizen, Statuswechsel, Verschieben, Tastatursteuerung
- Pendenzenübersicht mit Filtern (alle / meine / überfällig / ohne Sitzung)
- Mitgliederliste mit Suche, Sortierung, Detailansicht, Notizen
- Excel-/CSV-Import mit Spaltenzuordnung, Abgleich und Vorschau; CSV-Export
- Ansprachenplanung mit Vorschlagsliste und Verlauf
- Berufungsverwaltung mit Prozessschritten
- Einstellungen für Gemeinde, Sitzungsrhythmus und Ansprachen
- PWA: installierbar, offline, Update-Hinweis
- Firestore-Sicherheitsregeln und Indizes

**Bewusst zurückgestellt:**

- Ziehen und Ablegen zum Umsortieren der Traktanden (die Reihenfolge ist
  gespeichert, nur die Geste fehlt)
- E-Mail-Erinnerungen für fällige Pendenzen (bräuchte Cloud Functions)
- Kalender-Export der Sitzungstermine (`.ics`)
- Auswertungen über längere Zeiträume
- Verknüpfung von App-Benutzern mit ihrem Mitgliederdatensatz (Feld ist
  vorbereitet)

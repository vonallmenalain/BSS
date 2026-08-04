# App-Konzept «Bischofschaft»

Stand: erste Fassung, umgesetzt als lauffähiger Entwurf.

---

## 1. Ausgangslage

Die Bischofschaft leitet eine Kirchengemeinde. Die Arbeit verteilt sich auf

| Rolle                | Personen | Aufgabe                                   |
| -------------------- | -------- | ----------------------------------------- |
| **Bischof**          | 1        | leitet die Gemeinde und die Bischofschaft |
| **1. Ratgeber**      | 1        | vertritt und unterstützt den Bischof      |
| **2. Ratgeber**      | 1        | vertritt und unterstützt den Bischof      |
| **Exekutivsekretär** | 1        | Sitzungen, Termine, Nachverfolgung        |
| **Sekretär**         | 1–2      | Protokolle, Aufzeichnungen, Berichte      |

Alle fünf arbeiten am selben Datenbestand und sehen dasselbe. Die Rolle hält
die Aufgabe fest, nicht den Rechteumfang – sie beantwortet etwa, wer die
Abendmahlsversammlung leitet, und nicht, wer welches Dokument sehen darf.

Der Takt ist die **wöchentliche Sitzung**. Dazwischen sammeln sich Themen an,
in der Sitzung werden sie abgearbeitet, und was offen bleibt, muss beim
nächsten Mal wieder auf den Tisch.

Der zweite Takt ist der **Sonntag**: Für jede Abendmahlsversammlung braucht es
Ansprachen, Bekanntmachungen, Angelegenheiten, Lieder und Gebete. Daneben
laufen die **Berufungen**. Alles zusammen braucht dieselbe Grundlage – eine
gepflegte **Mitgliederliste**.

---

## 2. Leitgedanken

Vier Entscheidungen prägen den ganzen Entwurf:

**Traktandum und Pendenz sind derselbe Datensatz – aber nicht dasselbe Wort.**
Der übliche Fehler wäre, zwei Listen zu führen und Einträge hin- und
herzuschieben. Stattdessen gibt es einen Eintrag, der weiss, was er ist: Was
neu auf die Liste kommt, ist ein **Traktandum**; übersteht es eine Sitzung,
ohne erledigt zu werden, wird es zur **Pendenz** und bleibt es. Beim Abschluss
der Sitzung lösen sich offene Einträge automatisch von ihr und warten auf die
nächste, wo sie unter den Pendenzen stehen und nicht unter den neuen
Traktanden. Nichts geht verloren, nichts muss umgetragen werden – und man
sieht auf einen Blick, was schon einmal liegengeblieben ist.

**Die Sitzung führt, nicht die Liste.**
Während der Sitzung zählt nur eine Frage: Was ist gerade dran? Deshalb steht
der Sitzungsmodus im Mittelpunkt – ein Punkt gross im Bild, Notizfeld und
Statusknöpfe darunter, weiter zum nächsten. Und er ist zugleich das Formular:
Titel und Beschreibung sind Text, in den man hineingreift, Priorität, Termin
und Zuständige stehen darunter, gespeichert wird von selbst. Ein Fenster, das
sich zum Ändern eines Wortes über die Sitzung legt, wäre ein Handgriff zu
viel. Die Listenansicht bleibt für die Vorbereitung – dort wird die
Reihenfolge festgelegt.

**Die Bischofschaft ist eine Einheit.**
Eine Abstufung innerhalb der Bischofschaft würde mehr Reibung erzeugen als
Schutz: Wer im Sitzungszimmer sitzt, muss ohnehin alles wissen. Deshalb gibt
es nur eine Grenze, und die liegt aussen – ein neu registriertes Konto sieht
nichts, bis es freigeschaltet wird. Ein Kennzeichen «vertraulich» am einzelnen
Traktandum gibt es folgerichtig nicht mehr: Es wurde gepflegt, ohne je etwas
zu bewirken.

**Jeder Wert wird an einer Stelle erfasst.**
Das Programm des Sonntags entsteht in sechs Bereichen und läuft unter
«Leitung» zusammen. Dort wird nichts noch einmal eingetippt, sondern nur
angeordnet. Sonst hätte man zwei Wahrheiten – und die falsche steht dann am
Pult.

**Der Import ist Nebensache, aber muss verlässlich sein.**
Alle drei bis vier Monate eine Excel-Datei einlesen – das darf ruhig versteckt
sein, darf aber niemals Dubletten erzeugen oder gepflegte Notizen überschreiben.

---

## 3. Die Arbeitsbereiche

### 3.1 Sitzungsmanagement

```
Sammelkorb  ──►  Sitzung  ──►  erledigt
    ▲                │
    └────────────────┘
      offen geblieben
```

**Vorbereiten.** Traktanden lassen sich jederzeit erfassen – mit Titel,
Beschreibung, Priorität, Zuständigen und einem Termin. Mehr wird nicht
gefragt; alles Weitere lässt sich in der Sitzung nachtragen. Ohne
Sitzungszuordnung landen sie im Sammelkorb.

**Nächste Sitzung festlegen.** Datum, Zeit, Ort und Anwesende. Die
Einstellungen kennen den üblichen Wochentag und schlagen den Termin vor. Ein
Klick übernimmt alle offenen Pendenzen in die neue Sitzung.

**Beginnen.** Anwesenheit, Anfangs- und Schlussgebet, geistiger Gedanke stehen
zuoberst auf der Seite, je eine Zeile mit den fünf Konten als Knöpfe.
Gespeichert wird beim Antippen. Das war einmal ein Fenster – für vier Angaben,
die in einer halben Minute festgehalten sind, ein Umweg.

**Durchführen (Sitzungsmodus).** Fortschrittsbalken, Sprungleiste über alle
Punkte – zuerst die neuen Traktanden, dann die Pendenzen –, dann das aktuelle
Thema in voller Breite und unmittelbar bearbeitbar: Titel, Beschreibung,
Priorität, Termin, Zuständige. Darunter die Aktionsleiste – _Erledigt_,
_Verschieben_, _Löschen_ – und Vor/Zurück. Nach «Erledigt» rückt die App von
selbst zum nächsten Punkt. Am Laptop geht das Blättern auch mit den
Pfeiltasten.

**Status.** Drei, mehr nicht: _Neu_ vor dem Start der Sitzung, _Pendent_,
solange nicht abgehakt ist, _Erledigt_ danach. Der Start der Sitzung macht
aus allem Neuen Pendentes – ab da ist jeder Punkt schlicht offen.

**Reihenfolge.** In der Listenansicht mit Pfeilen oder durch Ziehen und
Ablegen, innerhalb der beiden Gruppen. Eine Zeile ist zugeklappt schmal und
zeigt den Titel; ein Klick klappt sie auf, und dann steht alles da.

Eine eigene Notizliste je Traktandum gab es einmal; sie ist weggefallen. Zwei
Textfelder nebeneinander beantworten dieselbe Frage zweimal, und in der
Sitzung schreibt niemand zweimal.

**Verschieben.** Vier Fälle, die im Alltag vorkommen, als je ein Klick:
auf die nächste Sitzung, um eine Woche, um einen Monat, um drei Monate –
plus freies Datum. Jede Verschiebung zählt mit: Ein Traktandum mit
«3× verschoben» fällt in der Liste auf, und genau das soll es auch.

**Abschliessen.** Alles Offene wird zur Pendenz, die Sitzung wandert ins
Archiv, und die App bietet gleich die Folgeplanung an. Ein Protokoll lässt
sich drucken.

### 3.2 Abendmahlsversammlung

Ein Bereich mit sechs Unterpunkten. Der Sonntag wird einmal oben gewählt und
gilt für alle.

```
Bekanntmachungen ─┐
Angelegenheiten  ─┤
Ansprachen       ─┼─►  Leitung  ──►  Ablauf fürs Pult
Musik            ─┤
Gebet            ─┘
```

**Leitung.** Der Ablauf gemäss Handbuch (Abschnitt 29.2.1), vereinfacht auf
das, was am Pult gebraucht wird: Vorspiel, Willkommensgrüsse, Begrüssung der
Besucher, Bekanntmachungen, Anfangslied und Anfangsgebet, Angelegenheiten,
Namensgebung und Konfirmierung (nur wenn erfasst), Abendmahl, Botschaften und
Musik, Schlusslied und Schlussgebet, Nachspiel. Alle Werte erscheinen
automatisch. Angepasst wird hier nur, wer leitet und präsidiert, wen man
begrüsst – und die Reihenfolge von Ansprachen, Zeugnissen, Zwischenlied und
Musikeinlagen.

Diese Seite wird während der Versammlung gelesen, nicht nur davor ausgefüllt.
Ohne «Bearbeiten» steht deshalb nur der Ablauf da: kein erklärender Satz, kein
Verweis in einen anderen Bereich, kein Punkt ohne Inhalt – wozu nichts ansteht,
erscheint erst beim Bearbeiten wieder. Offene Stellen stehen in Orange an ihrem
Platz im Ablauf. Wie gross Schrift und Abstände sind, ist wählbar (kompakt,
mittel, weit): Am Pult wird aus Distanz gelesen.

Zur Wahl für «Es präsidiert» und «Es leitet» stehen die freigeschalteten
Konten und Personen ohne Konto: Ist Besuch aus der Pfahlführung da,
präsidiert er. Ein solcher Name wird einmal erfasst, bleibt in den
Einstellungen stehen und ist an jedem weiteren Sonntag wählbar – im Programm
selbst steht er ausgeschrieben, damit ein altes Programm auch dann lesbar
bleibt, wenn die Person später aus der Auswahl genommen wird.

**Bekanntmachungen und Angelegenheiten.** Je eine Liste pro Sonntag, in der
Reihenfolge des Vorlesens. Angelegenheiten kennen ihre Art (Bestätigung,
Entlassung, Ordinierung, Konfirmierung, Namensgebung, Begrüssung) und lassen
sich aus den Berufungen übernehmen, statt den Namen ein zweites Mal zu tippen.

**Musik.** Anfangs-, Abendmahls- und Schlusslied, dazu das freiwillige
Zwischenlied und beliebig viele Musikeinlagen mit den vortragenden
Mitgliedern. Erfasst wird nur die Liednummer – den Titel liefert die
importierte Liederliste. Er wird im Programm mitgespeichert, damit ein
verteiltes Programm nach einem Neuimport gleich bleibt.

Drei Bücher stehen nebeneinander: das Gesangbuch, das Liederbuch für Kinder
und «Für zuhause und für die Kirche». Die ersten beiden zählen ab 1, deshalb
trägt das zweite ein Kürzel – «PV 6»; Doppelnummern behalten ihren Buchstaben,
«PV 18a». Das dritte beginnt bei 1001 und braucht keines, weil die Kirche dort
bewusst weiterzählt. Ohne diese Unterscheidung überschriebe ein Import den
anderen.

**Gebet.** Anfangs- und Schlussgebet, zwei Personen pro Sonntag. Bei jedem
Vorschlag steht, wann die Person zuletzt gebetet hat; zuoberst steht, wer noch
nie an der Reihe war. Berechnet wird das aus der Sammlung `prayers` – anders
als bei den Ansprachen ohne redundantes Feld am Mitglied, weil Gebete häufig
umdisponiert werden und ein nachgeführtes Datum dabei leicht falsch würde.

**Ansprachen: Programm.** Acht Versammlungen ab dem gewählten Sonntag mit je
so vielen Programmplätzen, wie in den Einstellungen stehen. Freie Plätze sind
sofort als solche erkennbar. Für einen einzelnen Sonntag lässt sich mehr
vorsehen – eine zusätzliche Ansprache, ein Zeugnis oder ein leerer Platz zum
späteren Vergeben. Der Standard bleibt davon unberührt; die Ausnahme steht als
`talkSlots` beim betreffenden Sonntag.

**Ein Name von Hand.** Nicht jeder, der spricht, steht in der Mitgliederliste:
ein besuchender Hoher Rat, die Missionare, «Zeugnisse der neuen Ältesten».
Jedes Namensfeld einer Ansprache nimmt deshalb auch reinen Text an. Ein
Mitglied wird ausschliesslich dann zugeordnet, wenn es in der Vorschlagsliste
angetippt wird – getippter Text allein genügt nie, sonst entstünden aus
Tippfehlern stillschweigend falsche Zuordnungen. Ein solcher Eintrag belegt
seinen Programmplatz wie jeder andere, trägt aber kein Mitglied und bleibt
damit ausserhalb von `lastTalkDate`, `talkCount` und der Vorschlagsliste – es
gibt niemanden, bei dem er zu vermerken wäre.

**Vorschläge.** Die eigentliche Antwort auf «wer war schon lange nicht mehr
dran»: eine nach Dringlichkeit sortierte Liste. Zuoberst, wer noch nie
gesprochen hat, danach nach Abstand absteigend. Wer bereits eingeplant ist,
rutscht nach unten – aber bleibt sichtbar, damit klar ist warum.

Zwei Grenzen halten die Liste brauchbar: ein Mindestalter, sonst stünden die
Kinder zuoberst (sie haben ja noch nie gesprochen), und der Status. Beides
lässt sich in der Liste umschalten, das Mindestalter steht in den
Einstellungen. Wer kein Geburtsdatum hat, bleibt drin – ein fehlendes Datum
ist kein Grund, jemanden zu übergehen.

**Nachführen.** Beim Wechsel auf «gehalten» schreibt die App das Datum der
letzten Ansprache beim Mitglied fort und erhöht den Zähler. Ein nachgetragener
alter Termin überschreibt dabei nie ein neueres Datum.

Statusfolge: _Vorgesehen → Angefragt → Zugesagt → Gehalten_
(mit _Abgesagt_ und _Gestrichen_ als Ausstieg).

**Verlauf übernehmen.** Die Vorschlagsliste ist nur so gut wie das, was sie
über die Vergangenheit weiss – ohne Verlauf hielte sie anfangs alle für gleich
lange nicht dran. Deshalb lässt sich die bisher geführte Excel-Tabelle
einmalig einlesen: ein Blatt je Jahr, zwei Spalten je Monat, «A» für die
Ansprache und «G» für das Gebet. Die Zählweise hat unterwegs gewechselt – bis
2018 stand dort der wievielte Sonntag des Monats, danach der Tag selbst –,
erkannt wird sie am Inhalt statt an der Beschriftung. Handnotizen ohne Datum
werden gemeldet, nicht gedeutet.

### 3.3 Berufungsmanagement

Berufungen durchlaufen feste Schritte, und jeder hat sein Datum:

_Vorgeschlagen → Genehmigt → Berufung ausgesprochen → Bestätigt → Eingesetzt_
(→ _Entlassen_)

Die Ansicht gruppiert nach Organisation (Ältestenkollegium, FHV, JD, JM, PV,
Sonntagsschule …) und behält innerhalb jeder Organisation die Reihenfolge des
LCR: zuoberst der Präsident, dann die Ratgeber, dann die übrigen. Alphabetisch
sortiert stünde der Bischof unter «B» zwischen den Lehrern. Von Hand erfasste
Berufungen tragen keine Nummer und kommen ans Ende. Die Ansicht kennt die
üblichen Positionen als Eingabehilfe. Ein
Knopf «Mit heutigem Datum» schiebt eine Berufung einen Schritt weiter, ohne
dass jemand ein Datum tippen muss.

**Zwei Sparten.** Berufungen der Gemeinde und Berufungen ausserhalb der
Einheit – Pfahl, Seminar, Institut, Mission – stehen getrennt. Der
Sonntagsschulpräsident des Pfahls ist nicht der Sonntagsschulpräsident der
Gemeinde: gleiche Bezeichnung, andere Einheit. Nebeneinander in einer Liste
wären sie nicht auseinanderzuhalten, und beim Abgleich hielte der Import den
einen für den anderen. Auswärtige Berufungen zählen für die Person, erscheinen
aber nicht im Organisationsplan der Gemeinde.

**Import aus dem LCR.** Die Seiten _Organisationen_ und _Berufungen
ausserhalb der Einheit_ lassen sich hineinkopieren; welche vorliegt, wird
gewählt. Der Abgleich zählt Person, Rolle, Organisation und Bereich – so
bleibt die Bischofschaft doppelt bestehen, wie das LCR sie auch führt.

Die eingefügte Seite gilt als **vollständige Wahrheit** über die aktuelle
Besetzung: Was sie nicht mehr führt, wird entlassen. Entlassen heisst nicht
löschen – die Berufung behält ihren Verlauf. Damit das nie zu weit greift,
ersetzt der Import nur, was die Quelle abdeckt: Wer bloss die Sonntagsschule
kopiert, entlässt niemanden in der FHV. Unberührt bleibt, was die
Bischofschaft erst vorbereitet – Vorgeschlagenes und Ausgesprochenes steht
nicht im LCR und kann dort deshalb auch nicht fehlen.

### 3.4 Notizen

Was sich nicht an eine Sitzung, ein Mitglied oder einen Sonntag hängen lässt:
der Gedanke aus einem Telefonat, eine Liste zum Mitdenken, der Entwurf einer
Ansage. Bisher landete das auf einem Zettel oder in einer Notiz-App auf einem
einzelnen Telefon – und damit ausserhalb dessen, was die Bischofschaft
gemeinsam sieht.

**Titel und Text, mehr nicht.** Keine Farben, kein Anheften, keine
Checklisten. Wer eine Aufgabe festhalten will, legt eine Pendenz an: Sie kann
terminiert und zugewiesen werden und kommt in der nächsten Sitzung von selbst
wieder. Eine Notiz, die dasselbe zu können versucht, wäre nur die schlechtere
Pendenz.

**Für alle.** Es gibt keine private Notiz und deshalb auch keinen Schalter
dafür – wie bei allem Übrigen in dieser App sehen alle freigeschalteten Rollen
denselben Bestand. Was niemand sonst sehen soll, gehört nicht in diese
Datenbank.

**Geschrieben wird laufend**, kurz nach dem letzten Tastendruck und noch
einmal beim Schliessen. Ein Speichern-Knopf wäre hier die einzige
Gelegenheit, Geschriebenes zu verlieren. Eine leere Notiz entsteht gar nicht
erst; angelegt wird beim ersten Speichern.

**Reihenfolge.** Normalerweise steht zuoberst, woran zuletzt gearbeitet wurde;
das braucht keine Pflege und trifft es meistens. Wo die Abfolge selbst etwas
bedeutet, lässt sich stattdessen von Hand sortieren. Diese Reihenfolge steht
als Position bei jeder Notiz und gilt deshalb für alle – anders als
Darstellung und Anzeigegrösse, die zum Gerät gehören. Umsortiert wird immer die
ganze Liste: Trüge nur die verschobene Notiz eine Position, stünde sie nach der
nächsten Bearbeitung wieder woanders.

---

## 4. Mitgliederverwaltung

Die gemeinsame Datenbasis für alles andere.

**Felder.** Vor- und Nachname, Geschlecht, Geburtsdatum, E-Mail, Telefon und
Mobile, Adresse, Status (aktiv / weniger aktiv / inaktiv / weggezogen),
Notiz, Betreuungspartner und Betreuungsauftrag, Schlagworte, Datum der
letzten Ansprache, Anzahl Ansprachen.

**Status.** Nur aktiv oder inaktiv. Frühere Fassungen kannten «weniger aktiv»
und «weggezogen»; das klang genauer, half aber nirgends – für jede Frage, die
die App stellt, zählt nur, ob jemand da ist. Umschalten lässt sich der Status
direkt im Detail einer Person, ohne den Bearbeiten-Dialog: Es ist die Angabe,
die sich am häufigsten ändert.

**Sortieren und filtern.** Nach Nachname, Vorname, Alter, letzter Ansprache
oder Status; dazu Volltextsuche über Name, E-Mail, Telefon, Ort und Notiz.
Die Sortierung «letzte Ansprache» stellt bewusst diejenigen nach vorn, die
noch nie gesprochen haben.

**Notiz pro Mitglied.** Freitext für Betreuungshinweise, Absprachen oder wer
sich kümmert.

**Betreuung.** Zwei Listen statt einer einzelnen Kontaktperson, weil die
Betreuungsorganisation genau so aufgebaut ist: mit wem zusammen betreut wird
(_Betreuungspartner_) und wer betreut wird (_Betreuungsauftrag_). Beides kommt
mehrfach vor und lässt sich aus dem LCR übernehmen – auch hier ist die
eingefügte Seite die vollständige Wahrheit, beide Listen werden ersetzt statt
ergänzt.

**Import (alle 3–4 Monate).** Ein vierstufiger Assistent, erreichbar über
_Mitglieder → Import_ – nicht prominent, aber auffindbar. Von dort führen
Reiter zu allem, was sich von aussen übernehmen lässt: Mitglieder, Berufungen
und Betreuung aus dem LCR, dazu der einmalige Verlauf aus der bisherigen
Excel-Tabelle. Die Mitglieder kommen zuerst, weil alle übrigen ihre Einträge
erfassten Personen zuordnen und alles Unbekannte überspringen:

1. **Quelle** – die aus dem LCR-Mitgliederverzeichnis kopierte Liste in ein
   freies Textfeld einfügen, oder `.xlsx` bzw. `.csv` per Auswahl und
   Drag-and-drop. Das Verzeichnis gibt es dort nur zum Ansehen, nicht zum
   Herunterladen – deshalb ist Einfügen der übliche Weg. Der Parser trennt
   die Einträge selbst auf und überspringt Navigation und Fusszeile.
2. **Spalten** – die App rät die Zuordnung anhand der Überschriften
   (deutsch und englisch) und lässt sie korrigieren. Beim eingefügten Text
   steht die Zuordnung bereits fest und ist nur noch zu bestätigen.
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

| Baustein     | Wahl                                      | Begründung                                              |
| ------------ | ----------------------------------------- | ------------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite                | schnelle Entwicklung, gute Typsicherheit                |
| Gestaltung   | Tailwind CSS v4                           | einheitliches Erscheinungsbild ohne separate CSS-Pflege |
| PWA          | vite-plugin-pwa (Workbox)                 | installierbar, offline lauffähig                        |
| Daten        | Firebase Firestore                        | Echtzeit-Synchronisation, Offline-Cache eingebaut       |
| Anmeldung    | Firebase Authentication (E-Mail/Passwort) | bereits vorhanden                                       |
| Auslieferung | Netlify → `bss.alae.app`                  | bereits eingerichtet                                    |

**Warum Echtzeit zählt.** Wenn in der Sitzung drei Personen dieselbe Liste
offen haben, sieht jede sofort, was die andere ändert. Firestore liefert das
ohne Zusatzaufwand.

**Warum offline zählt.** Firestore legt eine lokale Kopie an. Fällt im
Sitzungszimmer das Netz aus, wird weitergearbeitet; die Änderungen fliessen
nach, sobald wieder Verbindung besteht. Die PWA-Hülle sorgt dafür, dass die
App selbst auch ohne Netz startet.

Eine Feinheit entscheidet darüber, ob sich das auch so anfühlt: Das Versprechen
eines Firestore-Schreibvorgangs löst sich erst auf, wenn der **Server**
bestätigt hat. Wer darauf wartet, zeigt ohne Netz endlos «wird gespeichert» –
obwohl die Daten längst sicher in der lokalen Datenbank liegen. Deshalb geht
jeder Schreibzugriff durch `commit()` (`src/lib/sync.ts`): kurz auf die
Bestätigung warten, sonst «zwischengespeichert» melden. In der Kopfzeile zeigt
ein Zähler, wie viele Änderungen noch unterwegs sind; ein Fehler, der erst beim
Übertragen auftritt, wird nachträglich gemeldet statt verschluckt.

Auch die Dokument-IDs entstehen deshalb im Client statt über `addDoc()`. Nur so
steht die ID einer neuen Sitzung sofort fest und die Ansicht kann dorthin
springen, ohne auf den Server zu warten.

**Konflikte.** Firestore kennt keine Versionen: Wer zuletzt schreibt, gewinnt.
Bei einzelnen Feldern geht das gut, weil nur Geändertes übertragen wird. Bei
ganzen Listen – Bekanntmachungen, Angelegenheiten, Musik – nicht: Dort
verschwänden fremde Einträge stillschweigend. Diese Seiten merken sich deshalb
den Stand, auf dem der Entwurf aufsetzt, und melden eine Abweichung, statt sie
zu überschreiben (`src/components/sacrament/useDraft.ts`). Zwei
Sperrmechanismen wären der falsche Weg gewesen – eine Bischofschaft ist klein
genug, dass ein Hinweis reicht.

Der eigene Schreibvorgang zählt dabei nicht: Firestore hält ihn sofort lokal
fest und meldet ihn als Schnappschuss zurück, lange bevor der Server
bestätigt. Wer das nicht auseinanderhält, zeigt den Hinweis bei jeder Eingabe
für einen Sekundenbruchteil – und schiebt die halbe Seite mit.

### Datenmodell

```
users/{uid}            Rolle, Name, aktiv/inaktiv
meetings/{id}          Datum, Titel, Ort, Status, Anwesende, Gebete,
                       geistiger Gedanke
agendaItems/{id}       Traktandum bzw. Pendenz
                       ├─ meetingId  (null = Sammelkorb)
                       ├─ kind       Traktandum | Pendenz
                       ├─ status     neu | pendent | erledigt
                       ├─ assignees  UIDs der Zuständigen
                       ├─ memberRefs mit «@» erwähnte Mitglieder
                       ├─ dueDate, priority, order, deferCount
                       └─ history[]
members/{id}           Stammdaten, Status, Notiz, lastTalkDate, talkCount
talks/{id}             Mitglied (leer = Name von Hand), Datum,
                       Programmplatz, Art (Ansprache | Zeugnis), Thema,
                       Status
callings/{id}          Mitglied, Position, Organisation, Status, Meilensteine
sacramentMeetings/{yyyy-MM-dd}
                       Programm eines Sonntags
                       ├─ kind          regulär | Fast- und Zeugnisversammlung
                       │                | eigener Grund (mit kindLabel)
                       ├─ responsibleId  wer den Sonntag vorbereitet
                       ├─ presidingId, conductingId, visitors
                       ├─ presidingName, conductingName
                       │                Personen ohne Konto, ausgeschrieben
                       ├─ talkSlots     Ausnahme zur Standardanzahl
                       ├─ hymns         opening | sacrament |
                       │                intermediate | closing
                       ├─ musicalNumbers[], announcements[], business[]
                       └─ programOrder  Reihenfolge «Botschaften und Musik»
prayers/{yyyy-MM-dd_slot}
                       Datum, Anfangs- oder Schlussgebet, Mitglied
hymns/{nummer}         Liednummer und Titel (importiert)
notes/{id}             Notiz: Titel, Text, wer zuletzt geschrieben hat,
                       Platz in der selbst gewählten Reihenfolge
settings/app           Gemeindename, Sitzungsrhythmus, Vorgaben zur
                       Abendmahlsversammlung, Personen ohne Konto für
                       Vorsitz und Leitung
```

Das Datum als **Dokument-ID** – bei `sacramentMeetings` und `prayers` – ist
kein Schönheitsentscheid: Sechs Bereiche schreiben unabhängig voneinander am
selben Sonntag. Mit einer erzeugten ID entstünden über kurz oder lang zwei
Programme für denselben Tag.

Ansprachen und Zeugnisse liegen bewusst **nicht** im Programm, sondern in
`talks`. Sie haben einen eigenen Lebenszyklus – vorgesehen, angefragt,
zugesagt, gehalten – und treiben die Auswertung «wer war lange nicht dran».

`lastTalkDate` und `talkCount` liegen bewusst redundant beim Mitglied. Ohne
diese Vorberechnung liesse sich die Frage «wer war lange nicht dran» nicht
sortieren, ohne bei jedem Aufruf sämtliche Ansprachen zu laden.

### Rechte

Zugriff bekommt nur, wer angemeldet **und** freigeschaltet ist. Neue Konten
starten als `pending` und sehen nichts – erst ein freigeschaltetes Konto
vergibt eine Rolle. Durchgesetzt wird das in `firestore.rules`, nicht im
Frontend.

Innerhalb der Bischofschaft gibt es keine weitere Abstufung: Alle Rollen lesen
und schreiben dasselbe, und jede Person kann ihre eigene Rolle korrigieren –
mangels Rechteunterschied ist damit keine Rechteausweitung verbunden. Ein
wartendes Konto darf zwar seinen Namen pflegen, aber weder `role` noch
`active` anfassen. Genau diese Sperre halten die Regeltests fest.

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
- Sitzungsmodus mit unmittelbarer Bearbeitung, Statuswechsel, Verschieben,
  Tastatursteuerung
- Anwesenheit, Gebete und geistiger Gedanke als Knopfleiste zuoberst in der
  Sitzung
- Trennung von Pendenzen früherer Sitzungen und neuen Traktanden, mit eigener
  Reihenfolge je Gruppe (Pfeile oder Ziehen und Ablegen)
- Mit «@» erwähnte Mitglieder bleiben im Text anklickbar und führen zur Person
  und wieder zurück
- Pendenzenübersicht mit Filtern (alle / meine / überfällig / ohne Sitzung)
- Notizen für alle: Titel und Text, Suche, Liste oder Kacheln, eigene
  Reihenfolge, laufendes Speichern
- Mitgliederliste mit Suche, Sortierung, Detailansicht, Notizen
- Import aus eingefügter Liste, Excel oder CSV mit Spaltenzuordnung, Abgleich
  und Vorschau; CSV-Export
- Import der Berufungen und der Betreuungsaufträge aus dem LCR; beide ersetzen
  ihren Bereich, statt ihn zu ergänzen
- Einmaliger Import des Ansprachen- und Gebetsverlaufs aus der bisherigen
  Excel-Tabelle, damit die Vorschlagslisten von Anfang an stimmen
- Ansprachen und Zeugnisse mit Vorschlagsliste, Verlauf, Zusatzplätzen und
  Einträgen von Hand für alle, die nicht in der Mitgliederliste stehen
- Abendmahlsversammlung: Leitung, Bekanntmachungen, Angelegenheiten, Musik,
  Gebet – mit dem ganzen Ablauf fürs Pult
- Zuständigkeit für einen Sonntag oder gleich für den ganzen Monat
- Liederlisten aus dem Musikarchiv oder aus Excel bzw. CSV – Gesangbuch,
  PV-Liederbuch und «Für zuhause und für die Kirche» getrennt, Liedtitel aus
  der Nummer
- Berufungsverwaltung mit Prozessschritten
- Einstellungen für Gemeinde, Sitzungsrhythmus und Abendmahlsversammlung
- PWA: installierbar, offline speichern mit Warteschlange und Konflikthinweis,
  Update-Hinweis
- Firestore-Sicherheitsregeln und Indizes

**Bewusst zurückgestellt:**

- E-Mail-Erinnerungen für fällige Pendenzen (bräuchte Cloud Functions)
- Kalender-Export der Sitzungstermine (`.ics`)
- Auswertungen über längere Zeiträume
- Verknüpfung von App-Benutzern mit ihrem Mitgliederdatensatz (Feld ist
  vorbereitet)

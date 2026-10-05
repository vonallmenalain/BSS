# Konzept «Impuls» – ein geistiger Bereich für die AP’s

Stand: Die Entscheide vom 12. August 2026 sind eingearbeitet
([Abschnitt 12](#12-entscheide)). Umgesetzt sind die Etappen 0 bis 5:
Zugang und Gerüst, Wochenimpuls und Quizfrage samt Redaktionsseite und
Startpaket, Wochenziel, Tages-Challenge, Serie, Abzeichen und
Gruppenleiste, der endliche Impuls-Feed mit «Amen» und Favoriten, die
Frage der Woche mit Antworten, Vornamen und Moderation, die Mitmach-Ecke
samt stillem Erinnerungspunkt in der Navigation – und die
Wochenerinnerung als Web-Push (siehe 5.7; braucht den öffentlichen
VAPID-Schlüssel als `VITE_FIREBASE_VAPID_KEY` bei Netlify). Die
Erinnerung ist inzwischen Teil der allgemeinen Benachrichtigungen der
App – einstellbar im Benutzermenü, mit frei wählbarem Takt. Das Konzept
ist damit vollständig umgesetzt. Der Bereich heisst «Impuls».

**Neustart im Oktober 2026** ([Abschnitt 13](#13-neustart-nach-dem-leitfaden-oktober-2026)):
Jede Woche bereitet jetzt auf die Lektion am Sonntag nach dem Leitfaden
«Für eine starke Jugend» vor. Dazu kamen die Umfrage (mit Skala), das
Vers-Puzzle, «Fakt oder Mythos?», die Verteilung des Kollegiums nach der
eigenen Antwort, das Wochen-Wappen mit seinen Sternen, die
Fortschrittsleiste im Feed – und ein Themenpaket mit sieben Wochen, das
die bisherigen Inhalte auf Wunsch ersetzt.

---

## 1. Ausgangslage und Ziel

Die App kennt heute einen einzigen Bereich, den auch Konten ohne Vollzugriff
erreichen: **«Aktivitäten AP’s»**, den Aktivitätenplan der
Priestertumskollegien, geteilt mit Beratern und Jugendführung (`ap_editor`,
`ap_viewer`). Daneben soll ein zweiter Bereich entstehen – nicht für die
Organisation der Jugendarbeit, sondern **für die Jugendlichen selbst**.

**Das Hauptziel in einem Satz:** Die AP’s sollen ein- bis zweimal pro Woche
durch die App eingeladen werden, sich fünf Minuten mit dem Evangelium zu
befassen – eine Schriftstelle lesen, eine Konferenzansprache anschauen, eine
Quizfrage lösen – und am Ende der Woche sagen können: «Ich war dabei, ich habe
etwas geschafft.»

Drei Dinge stecken in diesem Satz:

| | |
| ------------- | ------------------------------------------------------------------------- |
| **Rhythmus** | ein bis zwei Anstösse pro Woche, dazu die freiwillige Tages-Challenge – Druck macht beides nicht |
| **Spielform** | Quiz, Challenge, Feed – Formen, die Jugendliche kennen und gerne benutzen |
| **Verankerung** | jede Karte und jede Frage führt zu offiziellem Material der Kirche Jesu Christi der Heiligen der Letzten Tage |

Die Zielgruppe ist klein und bekannt: das Kollegium einer Gemeinde, eine
Handvoll bis zwei Dutzend Jugendliche zwischen 12 und 18. Das ist eine Stärke.
Es braucht keinen Algorithmus, keine Skalierung, keine Fremdmoderation – eine
Person mit einer Viertelstunde pro Woche kann den ganzen Inhalt kuratieren,
und alles Soziale spielt sich in einer Gruppe ab, in der sich alle mit Namen
kennen.

---

## 2. Leitgedanken

Sieben Entscheidungen, die alles Weitere prägen – in derselben Rolle wie die
Leitgedanken im [Hauptkonzept](KONZEPT.md):

**1 · Einladen, nicht verpflichten.** Der Bereich lädt ein und mahnt nie. Es
gibt kein rotes Abzeichen «versäumt», keine Erinnerung im Ton einer offenen
Rechnung – aus demselben Grund, aus dem die Pendenzen-Zahl aus der Navigation
gefallen ist: Eine Dauermahnung sagt jeden Tag dasselbe und bewirkt nichts.
Wer eine Woche aussetzt, wird beim nächsten Öffnen freundlich empfangen und
nicht mit dem Rückstand begrüsst.

**2 · Fünf Minuten genügen.** Vom Öffnen der App bis zum Erlebnis ist es ein
Fingertipp: Die Woche steht als Karte da, die Frage darunter. Wer mehr will,
findet mehr (die ganze Ansprache, das ganze Kapitel) – aber der kurze Weg ist
der Normalfall, nicht die abgespeckte Variante.

**3 · Nur offizielles Material – verlinkt statt kopiert.** Jeder Inhalt
stammt aus den Schriften, der Generalkonferenz, den Kirchenzeitschriften oder
anderem offiziellem Material und trägt seine Quelle sichtbar bei sich: kurzer
Auszug in der App, Link in die Evangeliumsbibliothek bzw. auf
churchofjesuschrist.org für den Rest. So bleibt die App auf der sicheren
Seite des Urheberrechts – und der Klick auf die Quelle **ist** das Ziel des
Bereichs, nicht ein Abfluss.

**4 · Miteinander, nicht gegeneinander.** Sichtbar ist, **wer dabei war und
was die Gruppe zusammen geschafft hat** – nicht, wer besser ist als wer. Es
gibt Serien («4 Wochen in Folge») und Abzeichen, aber keine Rangliste und
keine öffentlichen Punktzahlen. Die Challenge heisst: ich gegen meinen
inneren Schweinehund, wir als Kollegium gemeinsam – nie ich gegen dich.

**5 · Die Redaktion kuratiert, die App liefert aus.** Inhalte entstehen nicht
von selbst und kommen nicht von einem Dienst – sie werden von einer
verantwortlichen Person erfasst (am Anfang: das Administrator-Konto). Damit
das trägt, muss das Erfassen billig sein: Vorlagen je Kartenart, ein
wachsender Fragenpool, Planung mehrerer Wochen im Voraus. Zielmarke: **eine
Viertelstunde pro Woche** Redaktionsaufwand.

**6 · Endlich statt endlos.** Der Feed borgt die Form von Reels und TikTok –
Karte für Karte, mit dem Daumen – aber nicht deren Mechanik: Er ist
**redaktionell und endlich**. Fünf bis zehn Karten pro Woche, dann kommt die
Schlusskarte «Du bist durch – bis nächste Woche». Kein Algorithmus, kein
Nachschub, kein Sog. Genau darin liegt die Botschaft des Bereichs: Das
Telefon kann auch auftanken statt absaugen.

**7 · Zurückhaltung mit den Daten der Jugendlichen.** Im Bereich erscheinen
Vorname und Kürzel, sonst nichts – keine Adressen, keine Geburtsdaten, kein
Zugriff auf die Mitgliederdaten (das erzwingen die Zugriffsregeln, wie heute
schon bei den AP-Rollen). Alles Soziale bleibt innerhalb der freigeschalteten
Gruppe, und die Redaktion kann jeden Beitrag ausblenden.

---

## 3. Der Name

Der Bereich braucht ein Wort, das in die Navigation passt (die App benennt
Bereiche mit einem Wort: Sitzungen, Pendenzen, Notizen …) und das bei den
Jugendlichen nicht nach Schulstoff klingt.

| Kandidat | Klang |
| ------------ | ------------------------------------------------------------------ |
| **Impuls** | der Anstoss, der geistige Gedanke – kurz, kirchenvertraut, treffend |
| **Funke** | jugendlicher, wärmer – der Funke, der überspringt |
| **Kompass** | Richtung fürs Leben – etwas abgegriffen |
| **Anker** | Halt – eher statisch für einen wöchentlichen Takt |
| **Wegweiser** | beschreibend, aber lang und nüchtern |

**Empfehlung: «Impuls».** Es beschreibt genau das, was der Bereich tut (ein
Anstoss, ein geistiger Gedanke pro Woche), trägt kirchlichen Klang ohne
Schulton und bleibt als Navigationseintrag und Route (`/impuls`) sauber.
«Funke» wäre die charmante Alternative, wenn es verspielter sein darf.

**Entschieden: «Impuls».** Zweitfavorit ist «Kompass» – er bleibt notiert,
falls sich der Name im Piloten nicht bewährt.

**Umentschieden (August 2026): «Anti Doom».** Der Bereich heisst in der
App jetzt «Anti Doom» – das Gegenprogramm zum Doomscrolling: dieselbe
Geste, die Karten im Vollbild, aber gefüllt mit Substanz statt Sog. Der
Wochenimpuls heisst neu **Wochenthema**, der Impuls-Feed schlicht
**Feed**; die Adresse ist `/anti-doom` (alte `/impuls`-Links leiten
weiter). In Code, Datenbank-Sammlungen und in diesem Konzept bleibt aus
historischen Gründen die Benennung `impulse`/«Impuls» stehen – sie ist
nirgends mehr sichtbar.

---

## 4. So fühlt sich eine Woche an

Bevor die Bausteine einzeln beschrieben sind, der Ablauf am Stück – so soll
eine gewöhnliche Woche für einen AP aussehen:

**Montag.** In der App steht ein Punkt am Bereich «Impuls». Darin: die neue
Wochenkarte – eine Schriftstelle mit zwei Sätzen dazu, passend zum Thema der
AP-Klasse vom kommenden Sonntag. Darunter die Quizfrage der Woche: *«In der
verlinkten Ansprache erzählt der Sprecher von seinem Hund. Wie heisst er?»* –
die Antwort steht nicht in der App, sondern in der Ansprache; wer sie wissen
will, muss hineinlesen oder hineinhören. Dazu das Wochenziel: *«Lies diese
Woche ein Kapitel im Buch Mormon.»*

**Unter der Woche.** Jeden Tag ein kleiner Haken: Die Tages-Challenge –
«Lies heute eine Schriftstelle» – wird Tag für Tag abgehakt, und die Reihe
aus sieben Punkten füllt sich. Dazwischen zwei Minuten im Bus: den Feed
durchtippen – eine Konferenz-Aussage, ein Vers, ein «Wusstest du?», ein
kurzes Video von der Kirche, fertig nach acht Karten. Eine Karte gefällt –
sie bekommt ein «Amen» und landet bei den Favoriten. Das Kapitel ist
gelesen, ein Tipp aufs Wochenziel: erledigt. Die Serie zählt auf «5 Wochen
in Folge».

**Sonntag.** Die Frage der Woche wird aufgelöst: Wer geantwortet hat, sieht
die Auflösung samt Erklärung – und was die anderen geantwortet haben. In der
Gruppenleiste ist zu sehen: 8 von 11 waren diese Woche dabei. In der
Kollegiumsstunde sagt der Berater: «Wer hat den Hund gefunden?» – und das
Gespräch ist lanciert.

Der Bereich ersetzt nichts – nicht das Seminar, nicht «Komm und folge mir
nach!», nicht die Kollegiumsstunde. Er ist der **Zubringer**: klein genug für
den Alltag, verbunden mit dem, was am Sonntag ohnehin stattfindet.

---

## 5. Die Bausteine

Sechs Bausteine, unabhängig voneinander ein- und ausschaltbar. Nicht alle
kommen am Anfang (siehe [Etappen](#10-etappen)); zusammen ergeben sie den
Bereich.

```
                    ┌──────────────────────────────┐
                    │  Woche  «2026-W34»           │
                    │                              │
   Redaktion  ──►   │  Wochenimpuls   (Karte)      │   ◄──  AP’s: lesen,
   plant Wochen     │  Quizfrage      (+Auflösung) │        antworten,
   im Voraus        │  Wochenziel     (Challenge)  │        abhaken,
                    │  Tages-Challenge (7 Haken)   │        swipen
                    │  Feed           (5–10 Karten)│
                    │  Frage der Woche (Antworten) │
                    └──────────────┬───────────────┘
                                   │
                          Fortschritt je Person
                       (Serie, Abzeichen, Favoriten)
                                   │
                          Gruppenbild «8 von 11 dabei»
```

### 5.1 Wochenimpuls – das Herzstück

Eine Karte pro Woche: eine Schriftstelle oder ein kurzer Auszug aus einer
Konferenzansprache, zwei bis drei Sätze Hinführung, Link zur Quelle. Mehr
nicht – das ist der Mindestinhalt, der jede Woche sicher da ist, auch wenn
die Redaktion einmal wenig Zeit hatte.

Zwei Anker machen den Impuls stärker als eine beliebige schöne Stelle:

- **Passend zur AP-Klasse.** Der Aktivitätenplan kennt die Lektionsthemen
  bereits – die Klassen stehen mit Titel im Plan (`apActivities`, Art
  «AP-Klasse»). Der Impuls der Woche kann das Thema des kommenden Sonntags
  aufnehmen; die App kann den Titel der nächsten Klasse gleich neben dem
  Erfassungsformular anzeigen. Wer den Impuls gelesen hat, kennt das Thema
  schon – und die Lektion holt ab, was die Woche gesät hat.
- **Passend zum Lehrplan.** Alternativ oder ergänzend: das Wochenthema aus
  «Komm und folge mir nach!» – dem Lehrplan, den Seminar und Familien ohnehin
  begleiten – oder das Jahresmotto der Jugend.

Eine Ausnahme im Jahreslauf: **In der Woche nach der Generalkonferenz**
übernimmt eine Konferenz-Themenwoche den Takt – Impuls, Quiz und Feed
schöpfen dann aus den frischen Ansprachen des Wochenendes. (Zur
Pfahlkonferenz gibt es bewusst keine eigene Woche.)

### 5.2 Die Quizfrage

Eine Frage pro Woche, spielerisch, mit sofortiger Auflösung – und die
Auflösung ist der Lernmoment: Sie erklärt die Antwort in zwei Sätzen und
verlinkt die Quelle.

Formen, damit es nicht eintönig wird (der Fragenpool hält zu jeder Frage ihre
Form fest):

| Form | Beispiel |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **Suchfrage** | «In dieser Ansprache erzählt der Sprecher von seinem Hund – wie heisst er?» (Antwort steht nur in der verlinkten Quelle) |
| **Multiple Choice** | «In welchem Buch steht die Geschichte der 2000 jungen Krieger?» – 1 Nephi / Alma / Ether / Moroni |
| **Wahr oder falsch** | «Das Buch Mormon enthält 15 Bücher.» |
| **Wer hat’s gesagt?** | Ein Zitat – welcher Prophet oder Apostel hat es gesagt? |
| **Lückentext** | «Ich will hingehen und das tun, was der Herr ___ hat» (1 Nephi 3:7) |
| **Emoji-Rätsel** | 🌊 🪨 🏠 – welches Gleichnis ist gemeint? |
| **Reihenfolge** | Glaube, Umkehr, Taufe, Gabe des Heiligen Geistes – in die richtige Ordnung bringen (4. Glaubensartikel) |
| **Bildfrage** | Ein Bild aus der Mediathek der Kirche – welche Begebenheit zeigt es? |
| **Schätzfrage** | «Wie viele Kapitel hat das Buch Alma?» – wer am nächsten liegt |

Spielregeln, bewusst milde: **ein Versuch, keine Noten** – gewertet wird die
Teilnahme, nicht die Richtigkeit. Wer falsch liegt, bekommt dieselbe
freundliche Auflösung und denselben Haken «dabei gewesen». Die Suchfrage ist
die wertvollste Form (sie erzwingt den Blick in die Quelle) und zugleich die
aufwendigste – der Pool lebt von der Mischung.

Drei Präzisierungen aus der Umsetzung: Technisch genügen **zwei
Mechaniken** – Auswahl und freie Antwort (Suchfrage); die Vielfalt der
Formen liegt im Inhalt, nicht im Datenmodell. Die Auflösung ist
**persönlich und sofort**: Wer antwortet, sieht Erklärung und Quelle im
selben Moment, solange die Aufmerksamkeit noch da ist. Und geantwortet
wird mit **einem Tipp**: Bei Auswahlfragen gilt die angetippte
Möglichkeit sofort – der Knopf «Antworten» darunter ist weg, er kostete
jede Antwort einen zweiten Griff und liess die Karte wie ein Formular
wirken. Es bleibt bei einem Versuch; die Suchfrage behält ihren Knopf,
weil eine getippte Antwort nicht von selbst weiss, wann sie fertig ist.
Der Sonntag bleibt der gemeinsame Abschluss – dort löst die
Kollegiumsstunde auf, und ab Etappe 4 werden dann auch die Antworten der
anderen zur Frage der Woche sichtbar.

### 5.3 Tages-Challenge, Wochenziel, Serie und Abzeichen

Der Challenge-Baustein – die Antwort auf «ich möchte am Ende der Woche mit
Stolz sagen können, dass ich etwas geschafft habe».

- **Tages-Challenge.** Die kleine Schwester des Wochenziels: eine
  Mini-Aufgabe, die jeden Tag aufs Neue abgehakt werden kann – «Lies heute
  eine Schriftstelle», «Bete heute Morgen um Hilfe für den Tag». Die
  Redaktion setzt sie pro Woche (eine Aufgabe, die für alle sieben Tage
  gilt); die Anzeige ist eine Reihe aus sieben Punkten, die sich über die
  Woche füllt. Auch hier gilt Leitgedanke 1: Ein leerer Tag mahnt nicht –
  er bleibt einfach leer, und der nächste Punkt wartet.
- **Wochenziel.** Die Redaktion setzt es pro Woche: «Lies ein Kapitel», «Schau
  eine Konferenzansprache», «Bete jeden Abend». Abgehakt wird per
  Selbstauskunft – ohne Kontrolle, wie in der Kirche üblich: Es zählt, was
  jemand vor sich selbst und dem Herrn sagt.
- **Serie.** Wochen in Folge mit Beteiligung (Ziel erreicht, Quiz
  beantwortet oder an mindestens einem Tag die Tages-Challenge abgehakt).
  Gezählt wird ohne Milde-Mechanik – eine Jokerwoche pro Monat gab es
  einmal und ist bewusst wieder ausgebaut: Die Zahl soll genau das sagen,
  was sie zählt. Eine gerissene Serie wird nüchtern neu gestartet, nicht
  betrauert; nur die laufende Woche ist neutral, solange sie offen ist.
- **Meilensteine pro Woche** statt Punkte – vier kleine Ziele, die am
  Montag wieder offen sind: «Dabei» (diese Woche hineingeschaut),
  «Mitgeredet» (Frage der Woche beantwortet), «Tageschallenge erreicht»
  (alle sieben Haken, mit Stand «1 von 7») und der «Anti Doom Scroller»
  (alle Karten der Woche samt Vertiefungen angeschaut). Ein Meilenstein
  erzählt, **was** jemand getan hat – eine Punktzahl erzählt nur, wie viel.
  Jede Kachel lässt sich antippen: Ein kleines Fenster sagt in einem Satz,
  wie der Meilenstein zustande kommt, und zählt seine Schritte auf – die
  sieben Tage mit Datum, die Karten der Woche mit Titel (Vertiefungen als
  eigene Zeile), die Frage der Woche. So beantwortet «21 von 22», welche
  Karte die fehlende ist, und «Dabei!» sagt, wofür es das gibt. Das Offene
  steht zuoberst, das Erledigte darunter – es mahnt nicht, es erklärt.
- **Gruppenbild.** Eine Leiste: «Diese Woche dabei: 8 von 11» mit den Kürzeln
  bzw. Vornamen derer, die dabei waren – die Form der Anerkennung, die
  motiviert, ohne zu beschämen. Dazu, wenn gewünscht, ein **gemeinsames
  Ziel**: «Als Kollegium zusammen 40 Kapitel in diesem Monat» mit einem
  Balken, zu dem jeder beiträgt. Das dreht Wettbewerb in Zusammenarbeit.

Bewusst **keine Rangliste** und keine öffentlich vergleichbaren Zahlen: In
einer Gruppe von zehn ist der Letzte einer Rangliste keine Statistik, sondern
ein Jugendlicher mit Namen, der nicht wiederkommt.

### 5.4 Der Impuls-Feed (Swipen)

Der Feed ist die niederschwelligste Tür: Karten im Vollbild, mit dem Daumen
weiter – die Form von Reels, gefüllt mit Substanz.

Wie viele Karten eine Woche trägt, entscheidet die Redaktion. Der Plan sind
etwa fünf bis zehn; eine Obergrenze im Programm gibt es bewusst nicht –
«endlich» meint die Woche, die zu Ende geht, nicht eine feste Zahl
(Leitgedanke 6). Dasselbe gilt für Quizfragen und Bilderrätsel.

Kartenarten:

- **Schriftstelle** – ein Vers, gross gesetzt, mit Link zum Kapitel
- **Zitat** – zwei, drei Sätze aus einer Konferenzansprache, mit Sprecher und
  Link (Text, Audio und Video der Generalkonferenz sind auf Deutsch verfügbar)
- **Video** – Verweis auf ein offizielles Kurzvideo der Kirche
- **«Wusstest du?»** – eine Kleinigkeit aus Schriften oder
  Kirchengeschichte, die man weitererzählen mag
- **Zum Nachdenken** – eine offene Frage für den Tag
- **Aus der Jugendzeitschrift** – Auszug mit Quelle («Für eine starke
  Jugend», früher der Jugendteil des Liahona; ebenso die Broschüre)
- **Bild** – aus der Mediathek der Kirche, mit einem Satz

Bedienung: **«Amen»** als einzige Reaktion (die kirchliche Form der
Zustimmung – herzlicher als ein Like und ohne Zählwettbewerb), **Merken** für
die eigene Favoritensammlung, Weiterwischen. Nach der letzten Karte kommt die
Schlusskarte: «Das war’s für diese Woche – stark, dass du da warst.» Der Feed
der Vorwochen bleibt erreichbar, aber es gibt keinen unendlichen Nachschub
(Leitgedanke 6).

### 5.5 Die Frage der Woche (Diskussion)

Die soziale Stufe – klein gehalten, damit sie trägt statt kippt:

- Eine offene Frage pro Woche: «Welche Schriftstelle hat dir diese Woche
  geholfen – und warum?», «Was heisst für dich, den Sabbat heilig zu halten?»
- Jeder schreibt eine kurze Antwort. **Sichtbar werden die Antworten der
  anderen erst nach der eigenen** – das nimmt den Druck, das «Richtige» zu
  schreiben, und verhindert Einheitsbrei.
- Antworten tragen den Vornamen (Empfehlung – in einer Gruppe, die sich
  kennt, wirkt Anonymität fremd und senkt die Hemmschwelle für Unfug),
  können ein «Amen» bekommen und von der Redaktion ausgeblendet werden.
- **Kein Chat, keine Direktnachrichten, keine Kommentare unter Kommentaren.**
  Eine moderierte Frage mit Antworten ist überschaubar; ein offenes Forum
  unter Minderjährigen wäre eine Moderationslast, die niemand tragen will.

Die besten Antworten sind zugleich Material für den Sonntag: Der Berater
sieht vor der Kollegiumsstunde, was die Jugendlichen bewegt.

### 5.5a Teilen, Bilderrätsel und Vertiefung (Feed-Ausbau)

Drei Bausteine, die den Vollbild-Feed vom Anschauen zum Weitertragen führen:

- **Teilen-Aufgabe** – je Woche eine Einladung, das Thema aus der App
  hinauszutragen: «Frag ein Familienmitglied oder einen Freund, wann er dem
  Beispiel von Nephi gefolgt ist …». Bewusst die letzte Karte des Feeds
  (erst lesen, dann weitergeben), mit einem Haken wie beim Wochenziel –
  Selbstauskunft, zählt zur Wochenbeteiligung (`weeks[week].share`).
- **Bilderrätsel** – ein Bild aus der offiziellen Mediathek der Kirche
  (verlinkt, nicht hochgeladen): ein Tempel («In welcher Stadt steht er?»),
  ein Prophet, eine Begebenheit aus den Schriften. Dieselbe Mechanik wie die
  Quizfrage (Auswahl oder Suchfrage, sofortige Auflösung, Antworten in
  `impulseAnswers`), bis zu drei je Woche – wie beim Quiz. Ein
  Schwierigkeitsgrad wird nicht angesagt: Unter der Frage steht höchstens
  ein Hinweis zur Sache, oder nur die Frage selbst.
- **Vertiefung** – jede Feed-Karte kann eine zweite Seite tragen: ein Wisch
  nach links (die Karte kommt vom rechten Rand herein) zeigt Freitext der
  Redaktion mit weiterführenden Gedanken, Quellen und anklickbaren Links.
  Nur Karten mit Vertiefung zeigen den pulsierenden Pfeil «Vertiefen»; ohne
  bleibt die Karte, wie sie ist. In der Redaktion ist die Vertiefung ein
  Feld unterhalb der Hinführung.

### 5.5b Bild und Video auf jeder Karte

Das Bild war zuerst dem Bilderrätsel vorbehalten – dort ist es die Aufgabe.
Inzwischen darf **jede Kartenart** eines tragen: das Wochenthema, die
Feed-Karte, die Frage der Woche, die Aufgaben. Weiterhin verlinkt aus der
offiziellen Mediathek der Kirche, nie hochgeladen; die App speichert nur
die Adresse.

Im Vollbild-Feed ist ein Bild kein Beiwerk, sondern die erste Seite der
Karte: **Der erste Wisch zeigt das Bild allein** – ganz, ohne Text, ohne
Zeile –, **der zweite holt den Text darüber**, während das Bild stehen
bleibt und eine Spur näher rückt. So bekommt jedes Bild den Moment, den
ein Bild braucht, und beim Bilderrätsel ist genau das die Aufgabe:
erst schauen, dann fragen.

Nicht jedes Bild will man ganz zeigen. Neben dem Bild-Link steht darum
der Knopf **«Ausschnitt»**: Er öffnet das Bild gross, mit einem Rahmen
zum Schieben und Ziehen, und darunter steht dasselbe so, wie es auf der
Karte ankommt. Zugeschnitten wird dabei nichts – gespeichert werden vier
Masse in Prozent, das Bild bleibt unangetastet in der Mediathek liegen.
Der Ausschnitt gilt überall gleich: in der Karte, als Fläche im Feed und
im Vollbild mit Zoom. Gerade beim Bilderrätsel zählt das Letzte: Was die
Redaktion weggelassen hat, taucht auch beim Vergrössern nicht auf.
Ohne Ausschnitt bleibt alles wie bisher – das ganze Bild, ungeschnitten.

Die **Video-Karte** ist die konsequente Fortsetzung: eine Kartenart mit
einem Link statt einer Datei – YouTube, Vimeo oder die direkte Adresse
einer Videodatei (der Download-Link einer Videoseite der Kirche). Das
Video füllt den Bildschirm, startet mit Ton, sobald die Karte im Bild
ist, und hält an, sobald man weiterwischt; Untertitel bleiben aus, und
den Ton bedient die Leiste des Videos selbst. Was sich
nicht einbetten lässt, wird zur Karte mit einem Knopf, der das Video
draussen öffnet – ein ehrlicher Weg hinaus statt eines schwarzen
Rechtecks.

**Ein Wisch oder zwei.** Anders als die Bildkarte gehört der Video-Karte
standardmässig nur ein Bildschirm: Das Video hat ihn für sich, und der
nächste Wisch bringt schon die nächste Karte – kein Text, keine Zeile,
nichts, was sich darüberschiebt. Wo der Text dazugehört – eine Frage
zum Schauen, ein Gedanke danach –, setzt die Redaktion im Formular den
Haken **«Text über dem Video – zweiter Wisch»**: Dann fährt er beim
zweiten Wisch darüber, wie bei jeder Bildkarte, und mit ihm Titel,
Quelle sowie Amen und Merken. Die Vertiefung bleibt in beiden Fällen
erreichbar; auf der einstufigen Karte führt der Pfeil «Vertiefen»
hinüber, weil dort das Wischen dem Video gehört. Gewertet wird wie
überall die Teilnahme.

### 5.6 Die Mitmach-Ecke

Die stärkste Form der Aneignung: Die Jugendlichen liefern selbst – und
zwar **für jede Kartenart**: Impuls, Quizfrage, Bilderrätsel, Video,
Wochenziel, Tages-Challenge, Frage der Woche, Feed-Karte oder
Teilen-Aufgabe – samt Bild und, bei der Video-Karte, dem Videolink.

- Eingereicht wird **formlos** (Art wählen, Freitext, Quelle) – die
  Redaktion prüft, öffnet ihr Formular gleich in der eingereichten Art
  und bringt die Idee in Form; auf der fertigen Karte steht «Eingereicht
  von …». Wer je eine Karte beigesteuert hat, liest die anderen anders.
- Wer eine Frage baut, muss die Quelle genau lesen – die lehrreichste
  Übung von allen, versteckt als Spiel. Veröffentlichung immer erst nach
  Prüfung.
- **Wo die Einreichungen landen:** in der Redaktion, Abschnitt
  Mitmach-Ecke – die offenen zuoberst (Übernehmen oder still entfernen),
  die übernommenen als aufklappbare Chronik.

### 5.7 Erinnerungen

Der Bereich soll abholen, ohne zu nerven – in dieser Reihenfolge:

1. **Rhythmus als Gewohnheit** (sofort): feste Zeiten – montags der neue
   Impuls, sonntags die Auflösung. Ein verlässlicher Takt schlägt jede
   Benachrichtigung; er lässt sich in der Kollegiumsstunde verankern.
2. **Zeichen in der App** *(umgesetzt)*: ein Punkt am Navigationseintrag,
   solange die Woche noch nicht angeschaut ist – dieselbe stille Sprache
   wie beim Update-Hinweis. Er hängt an `lastSeenWeek` im
   Fortschrittsdokument und verschwindet mit dem ersten Blick.
3. **Push aufs Telefon** *(umgesetzt)*: die **Wochenerinnerung**, seit
   dem Ausbau der Benachrichtigungen Teil eines gemeinsamen Versands
   (`netlify/functions/benachrichtigungen.mts`, alle 15 Minuten). Der
   Lauf schaut nach, wer die Erinnerung eingeschaltet hat und wessen
   Zeitpunkt erreicht ist, prüft, ob die Woche bereiten Inhalt hat, und
   schickt nur dann eine kurze Nachricht – eine leere Woche bleibt still.
   **Wann** erinnert wird, stellt jede Person selbst ein (täglich oder
   wöchentlich, Wochentag und Uhrzeit in Schweizer Zeit; Standard ist
   Montag, 08:00); **ob** ein Gerät empfängt, entscheidet das Gerät. Beides
   steht im Benutzermenü unter «Benachrichtigungen». Abgelaufene
   Geräte-Adressen räumt der Lauf selbst weg. Eingerichtet wird mit dem
   **öffentlichen** VAPID-Schlüssel (`VITE_FIREBASE_VAPID_KEY`,
   Firebase-Konsole → Cloud Messaging → Web-Push-Zertifikate; kein
   Geheimnis, gehört ins Browser-Bundle) – versendet wird über das
   Dienstkonto (`FIREBASE_SERVICE_ACCOUNT`), der private Teil bleibt bei
   Firebase. Auf dem iPhone erreicht Web-Push nur die installierte PWA;
   der Dialog sagt genau das, statt still zu scheitern.

---

## 6. Inhalte und Quellen

### Woraus geschöpft wird

Alles offizielle Kanäle der Kirche, alle auf Deutsch verfügbar:

| Quelle | Eignet sich für |
| ----------------------------------------- | ------------------------------------------------ |
| Heilige Schriften (Evangeliumsbibliothek) | Wochenimpuls, Verse im Feed, Lückentexte |
| Generalkonferenz (Text/Audio/Video) | Suchfragen, Zitate, «Wer hat’s gesagt?» |
| «Für eine starke Jugend» (Zeitschrift und Broschüre) | Feed-Karten, Alltagsthemen |
| «Komm und folge mir nach!» | Wochenthema als roter Faden |
| Seminar – «Beherrschen der Lehre» | Schlüsselschriftstellen als fertiger Fragenpool |
| Evangeliumsthemen (Gospel Topics) | Erklärungen in den Auflösungen |
| Mediathek der Kirche | Bildfragen, Bildkarten |
| Jahresmotto der Jugend | Jahresbogen über alle Wochen |

### Urheberrecht

Die Nutzungsbedingungen der Kirche erlauben die nichtkommerzielle Verwendung
für Kirche, Heim und Familie – genau der Rahmen dieser App. Trotzdem gilt als
Hausregel: **kurze Auszüge statt Volltexte, immer mit Quellenangabe und
Link**; Videos werden verlinkt bzw. eingebettet, nie kopiert. Das ist
rechtlich sauber, hält die Datenbank klein – und der Sprung zur Quelle ist ja
gerade das Ziel.

### Der Redaktions-Arbeitsplatz

Damit die Viertelstunde pro Woche reicht:

- **Wochenplan-Ansicht:** die kommenden Wochen als Zeilen – wo schon etwas
  steht, wo noch Lücken sind. Dieselbe Logik wie das Ansprachen-Programm mit
  seinen freien Plätzen.
- **Vorlagen je Kartenart:** Schriftstellen-Karte, Zitat-Karte, Quizfrage je
  Form – jeweils drei, vier Felder, nicht mehr.
- **Fragenpool:** Fragen entstehen, wann immer eine einfällt, und werden
  später einer Woche zugeteilt. Nichts verfällt.
- **Vorschau:** jede Karte so sehen, wie die AP’s sie sehen werden – und
  die ganze Woche genau so, wie sie sie erleben (siehe Abschnitt 13.5).
- **Vorproduktion:** Vor dem Start werden vier bis sechs Wochen eingeplant –
  der Puffer, der verhindert, dass der Bereich beim ersten vollen Terminplan
  der Redaktion versiegt.

Mittelfristig muss die Redaktion nicht am Administrator-Konto hängen: Ein
eigenes Recht «Impuls-Redaktion» (siehe unten) kann an Berater oder die
JM-Leitung gehen – oder, mit Prüfschritt, teilweise an die Jugendlichen
selbst (Mitmach-Ecke).

---

## 7. Zugriff und Rechte

### Ein Schalter pro Konto, keine neue Rolle

Der Wunsch ist zweischichtig: grundsätzlich sollen alle den Bereich sehen
können, die den AP-Kalender lesen – aber steuerbar **pro Konto**, und am
Anfang nur das Administrator-Konto. Das spricht gegen eine Lösung über die
Rolle (sie würde Kalender- und Impuls-Zugang aneinanderketten) und für ein
**eigenes Feld am Benutzer**:

```
users/{uid}.impulse: boolean     – darf den Bereich «Impuls» sehen
```

- **Pro Konto schaltbar**, unabhängig von der Rolle: ein `ap_viewer` mit
  Flag sieht Kalender und Impuls; einer ohne Flag nur den Kalender; auch ein
  Konto mit Vollzugriff braucht das Flag (oder ist Admin). Ein Konto, das
  **nur** den Impuls-Bereich sieht, gibt es inzwischen als eigene Rolle
  (siehe «Die Rolle «Nur Anti Doom»» unten).
- **Verwalten kann es nur der Admin** – Benutzerdokumente darf heute schon
  ausschliesslich das Administrator-Konto ändern (`isAdmin()` in den Regeln).
  In der Benutzerverwaltung kommt neben die Rolle ein Schalter «Impuls»,
  dazu eine Sammelaktion «für alle AP-Konten einschalten» für den Rollout.
- **Das Administrator-Konto sieht den Bereich immer** (`isAdmin()` schliesst
  den Zugriff ein). Damit ist die Startphase «nur ich» ohne jeden Sondercode
  erledigt: Flag nirgends gesetzt → nur der Admin sieht den Bereich.

**Eine Falle, die von Anfang an zu verriegeln ist:** Die bestehende Regel
lässt jedes Konto sein eigenes Profil pflegen, gesperrt sind nur `role` und
`active` (`unchanged(…)`). Ohne Erweiterung könnte sich also **jedes Konto
das Impuls-Flag selbst setzen**. Die Selbst-Update-Regel braucht zwingend
zusätzlich `unchanged('impulse')` – und `tests/firestore-rules.test.js`
einen Testfall dafür, wie ihn die Sperre gegen die Selbstfreischaltung schon
hat.

Für die Redaktion dasselbe Muster ein zweites Mal:

```
users/{uid}.impulseEditor: boolean   – darf Inhalte pflegen und moderieren
```

Am Anfang blieb es ungesetzt – Redaktion war der Admin. Beide Flags stehen
damit dort, wo heute schon Rolle und Aktivstatus verwaltet werden.

**In der Benutzerverwaltung** sind die beiden Flags eine einzige Auswahl
neben der Rollenwahl, in drei Stufen (`impulseLevelOf` in `lib/access`):

| Stufe | `impulse` | `impulseEditor` | darf |
|---|---|---|---|
| Ohne Anti Doom | – | – | nichts im Bereich |
| **Anti Doom** | ✓ | – | ansehen und mitmachen wie alle |
| **Anti Doom + Redaktion** | ✓ | ✓ | dazu Inhalte pflegen und moderieren |

Das gilt für jede Rolle gleich, **auch für den Vollzugriff**: Wer zur
Bischofschaft gehört, bekommt mit «Anti Doom» nur die Ansicht der
Jugendlichen und keinen Knopf zur Redaktion. Bei der Rolle «Nur Anti Doom»
fehlt die erste Stufe – den Bereich bringt die Rolle mit, es bleibt die
Wahl der Redaktion. Bei der Assistenz und bei wartenden Konten fehlt die
Auswahl ganz: `impulseAccess()` kennt den Bereich für sie nicht, also gilt
er auch in der App nicht (`IMPULSE_SWITCH_ROLES`, in `tests/access.test.ts`
mit den Regeln abgeglichen).

### Die Rolle «Nur Anti Doom»

Für die AP's selbst gibt es eine eigene Rolle, `impulse_only` («Nur Anti
Doom»). Sie sieht **ausschliesslich** diesen Bereich – keinen AP-Kalender
hinter der Anmeldung, keine Mitglieder, keine Benutzerliste, nicht einmal die
Einstellungen der Gemeinde. Den Bereich bringt sie von sich aus mit: In der
Auswahl neben der Rolle fehlt «Ohne Anti Doom», es bleibt «Anti Doom» oder
«Anti Doom + Redaktion». Bei allen übrigen Rollen hängt der Bereich an der
Auswahl.

- **Zugriffsregeln:** `impulseAccess()` lässt `impulse_only` ohne Haken
  durch. `notifyAccess()` schliesst `impulseAccess()` ein – sonst könnte sich
  die Rolle nicht an die neue Woche erinnern lassen, denn bisher hing das am
  AP-Zugang. `impulseWrite()` kennt die Rolle ebenfalls, damit sie mit
  `impulseEditor` auch redigieren könnte.
- **App:** `canViewImpulse` (AuthContext) gilt für die Rolle, ihr Zuhause ist
  `/anti-doom`, und das Menü trägt einen einzigen Eintrag.
- **Versand:** Die geplante Function behandelt die Rolle wie ein Konto mit
  Haken (`netlify/functions/benachrichtigungen.mts`).
- **Vergeben:** in der Benutzerverwaltung (Gruppe «Nur Anti Doom» in der
  Rollenwahl) oder schon beim Freischalten (Zugriffsstufe «Nur Anti Doom»).

Geprüft in `tests/firestore-rules.test.js` («Rolle «Nur Anti Doom»»): Sie
liest und macht mit wie ein Konto mit Haken, scheitert an allem anderen, gibt
sich weder Rolle noch Schalter selbst – und deaktiviert bleibt sie draussen.

### Regeln je Sammlung

| Sammlung | Lesen | Schreiben |
| ------------------ | ---------------------- | ------------------------------------------------ |
| Inhalte (Karten, Fragen, Wochen) | Impuls-Zugang | nur Redaktion |
| Antworten & Fortschritt | Impuls-Zugang | **nur die eigene Person** (UID im Dokumentpfad); eine Woche zurücksetzen – nur wegnehmen, nie eintragen: Redaktion |
| Beiträge zur Frage der Woche | Impuls-Zugang | anlegen: die eigene Person; ausblenden: Redaktion |
| Ranglisten der Minispiele | Impuls-Zugang | der eigene beste Lauf (steigt nur); ausblenden und löschen: Redaktion |
| Einstellungen des Bereichs | Impuls-Zugang | nur Redaktion |

Durchgesetzt wie überall in `firestore.rules`, nicht in der Oberfläche. Die
AP-Rollen behalten ihren heutigen Zuschnitt: kein Zugriff auf Mitglieder,
Sitzungen oder sonst etwas – der Impuls-Bereich kommt als zweite Insel neben
den Kalender.

### Jugendschutz

- Die Konten der Jugendlichen sind gewöhnliche Konten (E-Mail, Passwort,
  Freischaltung durch den Admin) – es gelten dieselben Hürden wie heute.
- Im Bereich erscheinen nur Vorname bzw. Kürzel und das, was jemand selbst
  schreibt. Beiträge sind gruppenintern, moderierbar und meldbar.
- **Anonym mitmachen.** Der eigene Name soll kein Grund sein, nichts zu
  schreiben. Umfragen sind immer anonym – der Hinweis «Anonym – dein Name
  wird nicht geteilt» steht bei jeder, und in der Stimme selbst steht kein
  Vorname. Bei der Frage der Woche gibt es den Haken **«Meinen Namen nicht
  anzeigen»**: Die anderen sehen dann «Anonym», der Vorname steht nicht im
  Beitrag; die Redaktion sieht weiterhin, von wem er stammt («Anonym ·
  Levin»), denn wer moderiert, muss im Ernstfall nachfragen können – so
  steht es auch beim Haken. In der Mitmach-Ecke heisst der Haken **«Ohne
  meinen Namen veröffentlichen»**: Die fertige Karte trägt dann kein
  «Eingereicht von …», und «Übernehmen» lässt den Namen von selbst weg.
  Technisch bleibt jede Antwort einem Konto zugeordnet (eine Antwort pro
  Person, die eigene nachbessern) – anonym ist sie gegenüber den anderen
  in der App.
- Vor dem Rollout an die Jugendlichen gehört das Einverständnis der Eltern
  eingeholt (kurze Information, was die App speichert und wer es sieht) –
  und die Führung der Gemeinde ins Boot. Beides ist kein App-Thema, aber
  Teil des Plans.

---

## 8. Datenmodell (Skizze)

Die Woche ist die tragende Einheit – analog zum Datum als Dokument-ID bei
`sacramentMeetings`: Mehrere Bausteine gehören zur selben Woche, die
ISO-Woche als Schlüssel hält sie zusammen, ohne dass Dubletten entstehen
können.

```
users/{uid}                    + impulse: boolean        (Zugang, schaltet der Admin)
                               + impulseEditor: boolean  (Redaktion, schaltet der Admin)

impulseItems/{id}              eine Karte oder Frage
                               ├─ week      «2026-W34» – zu welcher Woche sie gehört
                               ├─ kind      impuls | quiz | wochenziel |
                               │            tageschallenge | frage | feed
                               ├─ title, body, emoji, imageUrl …
                               ├─ source    { label, url }        – Pflicht
                               ├─ quiz      { form, optionen[], antwort, erklärung }
                               ├─ order     Reihenfolge im Feed
                               ├─ startsAt  nur am Wochenthema: verschobener Start
                                            der Woche (siehe 13.6)
                               └─ status    entwurf | bereit – veröffentlicht wird
                                            durch den Kalender: Woche beginnt, Inhalt
                                            erscheint (kein Handgriff am Montag)

impulseAnswers/{itemId_uid}    genau eine Antwort pro Person und Frage
                               ├─ uid, firstName            (mitgeschrieben –
                               │            bei Umfragen leer: sie sind anonym)
                               ├─ choice / text, correct
                               └─ answeredAt

impulseComments/{itemId_uid}   Beitrag zur Frage der Woche – eine Antwort
                               pro Person und Frage, die ID erzwingt es
                               ├─ itemId, uid, firstName    (mitgeschrieben –
                               │            leer, wenn anonym)
                               ├─ anonymous                 «Anonym» für die
                               │            anderen; die Redaktion sieht den Namen
                               ├─ text                      (nachbesserbar)
                               ├─ hidden                    (Moderation – setzt
                               │                             nur die Redaktion)
                               └─ createdAt

                               «Amen» und «Melden» zu Beiträgen liegen wie beim
                               Feed am eigenen Fortschrittsdokument (amens[],
                               reports[]) – kein Schreibrecht am fremden
                               Beitrag nötig.

impulseSubmissions/{id}        Einreichung aus der Mitmach-Ecke
                               ├─ uid, firstName            (mitgeschrieben)
                               ├─ anonymous                 ohne «Eingereicht
                               │            von …» auf der fertigen Karte
                               ├─ kind      gedanke | frage
                               ├─ text, sourceLabel, sourceUrl   – formlos,
                               │            die Redaktion bringt es in Form
                               └─ status    open | accepted – «abgelehnt» gibt
                                            es nicht: Was nicht passt, wird
                                            still entfernt (Leitgedanke 1)

impulseProgress/{uid}          der persönliche Stand – schreibt nur die Person
                               (die Redaktion darf eine Woche zurücksetzen:
                               nur wegnehmen, siehe 13.8)
                               ├─ firstName                 (mitgeschrieben)
                               ├─ lastSeenWeek              – der stille Punkt
                               │            in der Navigation hängt daran
                               ├─ firstSeenWeek             – die erste geöffnete
                               │            Woche; der Verlauf «Seit du dabei
                               │            bist» beginnt dort (einmal gesetzt)
                               ├─ weeks     { «2026-W34»: { ziel, feed,
                               │              tage: [«2026-08-11», …] } }
                               ├─ amens[]                   «Amen» je Karte – am
                               │             eigenen Dokument, nicht am Inhalt:
                               │             Inhalte schreibt nur die Redaktion,
                               │             und die Karte zeigt Vornamen statt
                               │             Zählstände
                               └─ favorites[]               gemerkte Karten

                               Serie, Abzeichen und Gruppenleiste werden beim
                               Lesen berechnet (lib/impulse) statt gespeichert:
                               Ein gespeicherter Stand veraltete genau dann,
                               wenn niemand schreibt – die gerissene Serie ist
                               das Musterbeispiel. Die Quiz-Beteiligung kommt
                               aus den Antworten selbst und steht nirgends
                               doppelt.

settings/impulse               Name, Rhythmus, Gruppenanzeige, Jokerregel
```

Vier bewusste Anleihen bei der bestehenden Architektur:

- **`itemId_uid` als Antwort-ID** erzwingt «eine Antwort pro Person» durch
  die ID selbst, und die Regel prüft, dass das Suffix zur anmeldenden UID
  gehört – kein Zähler, kein Duplikat, dieselbe Denkweise wie beim Datum als
  Programm-ID.
- **`streak` liegt vorberechnet** am Fortschrittsdokument – dieselbe
  Abwägung wie `lastTalkDate`/`talkCount` am Mitglied: Ohne Vorberechnung
  müsste jede Anzeige alle Wochen aller Personen laden.
- **`firstName` wird mitgeschrieben** statt nachgeschlagen – wie im
  Zugriffsprotokoll: Ein Beitrag bleibt lesbar, auch wenn das Konto später
  verschwindet, und die AP’s können ohnehin keine fremden Profile lesen.
- **Geschrieben wird über `commit()`** (`lib/sync.ts`) wie überall – damit
  Antworten und Haken auch im Zug ohne Empfang «zwischengespeichert» statt
  «hängend» sind. Die Inhalte einer Woche sind klein; der Firestore-Cache
  macht den Bereich vollständig offlinefähig.

Die Mengen bleiben winzig (bei 15 Jugendlichen und 10 Karten pro Woche
entstehen ein paar Hundert Dokumente pro Jahr) – Kosten und Indizes sind kein
Thema.

---

## 9. Oberfläche (Skizze)

- **Route `/impuls`**, ausserhalb von `RequireFullAccess` – exakt das Muster
  von `/ap`. `RequireAuth` lässt zusätzlich durch, wer das Impuls-Flag trägt;
  die Navigation zeigt den Punkt nur mit Flag (bzw. dem Admin). Für ein
  AP-Konto mit beidem stehen am Telefon zwei Punkte in der unteren Leiste:
  «AP» und «Impuls».
- **Einstieg «Dashboard»:** das Wochenthema (der Wochenimpuls) gross im
  Zentrum, noch ohne Wischen – ein Tipp öffnet den Vollbild-Feed bei der
  ersten Karte. In derselben Kachel stehen unter dem grossen Knopf
  Wochenziel und Tages-Challenge, gleich abhakbar (siehe
  [13.8](#138-mission-menü-und-zurücksetzen)). Darunter die Kacheln, die
  bewusst nicht Teil des Feeds sind: Mein Fortschritt, Gemerkt,
  Mitmach-Ecke und «Diese Woche dabei». Eine Bildschirmhöhe, keine
  Unterseitenpflicht.
- **Feed im Vollbild**, Karte für Karte, vertikal gewischt – nur die Karte
  und der Menüknopf oben links, alle Kacheln sind verschwunden. Reihenfolge:
  Wochenimpuls, Quiz, Bilderrätsel, Video, Frage der Woche, Feed-Karten,
  Teilen-Aufgabe. Ein Wisch nach links vertieft die Karte (wenn eine
  Vertiefung erfasst ist); Reaktion und Merken als stille Knöpfe. Karten
  mit Bild oder Video sind **zwei Bildschirme** hoch (siehe
  [5.5b](#55b-bild-und-video-auf-jeder-karte)).
- **Ohne Kachel.** Im Vollbild steht der Text frei: kein Rahmen, keine
  eigene Fläche, kein Schatten. Was die Karte trägt, ist der Farbverlauf
  ihres Bereichs – oben satt, unten im Grund der App auslaufend (Farbe
  ins Weiss, im Dunkelmodus Farbe ins Schwarz) – oder das Bild, das den
  ganzen Bildschirm füllt. Kacheln bleiben dort, wo sie ordnen: in den
  Listen der Räume und in der Redaktion.
- **«Ansicht» oben rechts** wie überall: was der Einstieg zeigt
  (Serie, Gruppenleiste ein/aus), Schriftgrösse des Feeds.
- **Dunkel von sich aus.** Der Bereich wird abends gelesen und lebt vom
  Vollbild – der dunkle Grund lässt die Farben der Bereiche ruhiger
  wirken. Er gilt nur hier: Die übrige App behält ihre eigene Darstellung
  (hell, dunkel oder wie das System), und wem der dunkle Grund nicht
  liegt, stellt in den Anti-Doom-Einstellungen auf «Hell».
- **Anti-Doom-Einstellungen** als Fenster, nicht als Ort: Darstellung
  (dunkel/hell), Reihenfolge der Karten (der Reihe nach oder gemischt)
  und der Rückblick in eine frühere Woche. Sie legen sich über das, was
  gerade offen ist – wer sie aus dem Feed heraus aufschlägt, steht beim
  Schliessen wieder dort, bei derselben Karte.
- **Redaktion** als eigene Seite, sichtbar nur mit Redaktionsrecht:
  Wochenplan, Karten mit Vorlagen, Fragenpool, Vorschau. Erreichbar über die
  Einstellungen – nach dem Muster der Importe.
- **Dashboard-Kachel «Impuls»** für die Bischofschaft (Beteiligung der
  laufenden Woche auf einen Blick) – als spätere Ergänzung der bestehenden
  Kachelliste.
- **Icon:** eine Flamme (`Flame`) oder Funken (`Sparkles`) – neben dem Zelt
  des Aktivitätenplans sofort unterscheidbar.

---

## 10. Etappen

Jede Etappe ist für sich lauffähig und einzeln freischaltbar; nach Etappe 1
ist der Bereich bereits benutzbar. Reihenfolge von 3 und 4 ist tauschbar.

| # | Inhalt | Sichtbar für | Grösse |
| - | ------------------------------------------------------------------------ | ---------------------------- | ------ |
| 0 | **Zugang & Gerüst** *(umgesetzt)*: Flags samt Regelverriegelung und Regeltests, Route, Navigation, leere Wochen-Seite, Impuls-Haken in der Benutzerverwaltung | nur Admin | klein |
| 1 | **Wochenimpuls & Quiz** *(umgesetzt)* mit sofortiger Auflösung; **Redaktions-Seite** (Wochenplan, Fragenpool, Vergangenes, Wochen-Vorschau «was sehen die AP’s», ohne zu speichern); **Startpaket** mit vier Wochen aus den Schriften zum Einspielen – weitere Wochen produziert die Redaktion laufend | Admin, dann 1–2 Pilot-AP’s | mittel |
| 2 | **Wochenziel, Tages-Challenge, Serie, Meilensteine, Gruppenleiste** *(umgesetzt)* – Aufgaben als planbare Wochen-Inhalte, Serie ohne Jokerwoche, Meilensteine pro Woche (Dabei, Mitgeredet, Tageschallenge, Anti Doom Scroller), Gruppenleiste mit Vornamen | Pilotgruppe → alle AP’s | mittel |
| 3 | **Feed** mit Amen und Favoriten *(umgesetzt)* – Vollbild mit Wisch-Karten und Schlusskarte; unter dem «Amen» stehen Vornamen statt Zählstände, die Schlusskarte zählt zur Wochenbeteiligung, «Gemerkt» sammelt Favoriten | alle mit Flag | mittel |
| 4 | **Frage der Woche** *(umgesetzt)* – eine Antwort pro Person (nachbesserbar), sichtbar erst nach der eigenen; Amen und Melden liegen am eigenen Fortschritt, die Redaktion blendet aus und sieht Meldungen; ein Beitrag zählt zur Beteiligung («Mitgeredet»-Abzeichen) | alle mit Flag | mittel |
| 5 | **Mitmach-Ecke** *(umgesetzt)* – formlose Einreichungen, Übernahme mit «Eingereicht von …», stilles Entfernen statt Ablehnung; **Erinnerungspunkt** *(umgesetzt)* – der stille Punkt am Navigationseintrag, weg mit dem ersten Blick; **Push** wartet auf die FCM-Einrichtung (Konsole); Öffnung über die AP’s hinaus bleibt ein Schalter | nach Bedarf | je klein |

Zum Rollout gehört mehr als Software:

1. **Nur Admin** (Etappe 0–1): Inhalte aufbauen, selbst eine Weile benutzen.
2. **Pilot:** ein, zwei wohlgesinnte Jugendliche schalten – Wortlaut,
   Schwierigkeitsgrad und Ton an echten Reaktionen schärfen.
3. **Kollegium:** Einführung nicht per Link, sondern **in der
   Kollegiumsstunde** – Konten freischalten, App als PWA installieren, erste
   Quizfrage gemeinsam lösen. Eltern vorab informiert.
4. **Takt halten:** Der Bereich lebt von der Verlässlichkeit der Redaktion,
   nicht von seiner Featureliste. Lieber Etappe 1 mit ununterbrochen guten
   Wochen als Etappe 5 mit Lücken.

---

## 11. Was der Bereich bewusst nicht ist

- **Kein endloser Feed und kein Algorithmus** – die Woche ist endlich, die
  Reihenfolge redaktionell.
- **Keine Rangliste, keine öffentlichen Punkte** – sichtbar ist Beteiligung
  und Gemeinsames, nie ein Vergleich von Zahlen auf Personen.
- **Kein Chat und keine Direktnachrichten** – die eine moderierte Frage der
  Woche ist die ganze soziale Fläche.
- **Keine Inhalte ausserhalb offizieller Quellen** – keine selbst
  geschriebenen Lehren, keine fremden Zitate-Accounts, keine KI-Andachten.
- **Kein Ersatz** für Seminar, «Komm und folge mir nach!» oder die
  Kollegiumsstunde – ein Zubringer mit fünf Minuten pro Anlauf.
- **Kein zweites soziales Netzwerk** – die Gruppe ist das Kollegium, und der
  beste Erfolg des Bereichs ist ein Gespräch am Sonntag, nicht mehr Zeit in
  der App.

---

## 12. Entscheide

Am 12. August 2026 besprochen und festgelegt:

1. **Name:** «Impuls». Zweitfavorit bleibt «Kompass», falls sich der Name
   im Piloten nicht bewährt.
2. **Frage der Woche:** Die Antworten tragen den Vornamen – keine
   Anonymität.
3. **Reihenfolge:** Die Antworten der anderen erscheinen erst nach der
   eigenen Antwort.
4. **Gruppenleiste:** Die Namen der Beteiligten werden gezeigt – ohne
   Hervorhebung der Fehlenden.
5. **Wochenziel:** Selbstauskunft genügt, keine Kontrolle.
6. **Rhythmus:** Wöchentlich – Veröffentlichung am Montag, Auflösung am
   Sonntag. Dazu kommt die **Tages-Challenge** als kleiner täglicher Haken
   (siehe [5.3](#53-tages-challenge-wochenziel-serie-und-abzeichen)).
7. **Redaktion:** Das Administrator-Konto und, wer in der Benutzerverwaltung
   die Stufe «Anti Doom + Redaktion» hat (`impulseEditor`) – bei jeder
   Rolle, auch beim Vollzugriff, nur mit dieser Stufe.
8. **Öffnung über die AP’s hinaus:** bleibt als Möglichkeit bestehen – der
   Bereich wird neutral gebaut (Schalter pro Konto, kein AP-Bezug im
   Datenmodell).
9. **Konferenzwochen:** Ja zur Generalkonferenz – als Themenwoche in der
   Woche **nach** der Konferenz. Keine Spezialwoche zur Pfahlkonferenz.

---

## 13. Neustart nach dem Leitfaden (Oktober 2026)

Am 4. Oktober 2026 hat die Redaktion entschieden, die bisherigen Inhalte
zu ersetzen und neu zu starten – mit einem klaren roten Faden und mehr
Spiel. Das Hauptziel bleibt, wird aber schärfer: **Die Jugendlichen –
im Kollegium junge Männer – sollen sich die Woche über auf das Thema
vorbereiten, das am Sonntag in der Klasse drankommt, und dabei Spass
haben.**

### 13.1 Der rote Faden: die Lektion am Sonntag

Die Woche läuft von Montag bis Sonntag – und am Sonntag steht im
Kollegium genau das Thema an, um das sich die Woche dreht. Grundlage ist
das Heft «Für eine starke Jugend» (Oktober 2026, mit den Lektionen für
Oktober und November) und der Wegweiser «Für eine starke Jugend»:

| Woche              | Sonntag | Lektion                                           |
| ------------------ | ------- | ------------------------------------------------- |
| 5.–11. Okt.        | 11. Okt | Erfahre mehr über das Wort der Weisheit           |
| 12.–18. Okt.       | 18. Okt | Erfahre mehr über das Gesetz der Keuschheit       |
| 19.–25. Okt.       | 25. Okt | Ein Sohn Gottes werden … (Helamans junge Krieger) |
| 26. Okt. – 1. Nov. | 1. Nov  | Kapitel «Die Wahrheit befreit dich» (Fastsonntag) |
| 2.–8. Nov.         | 8. Nov  | Erfahre mehr über das Schriftstudium              |
| 9.–15. Nov.        | 15. Nov | Erfahre mehr über die Suche nach Wahrheit         |
| 16.–22. Nov.       | 22. Nov | Ein Sohn Gottes werden … (Hauptmann Moroni)       |

Das Wochenthema trägt dafür drei neue Felder: die **Zeile über dem
Titel** (meist das Monatsthema), die **Lektion am Sonntag** samt Link –
das Dashboard zeigt sie mit einem Countdown («4 Tage bis Sonntag») – und
das **Wappen** der Woche (siehe 13.3). Die Inhalte dürfen vom Thema
abweichen (die Woche nach der Generalkonferenz fragt etwa nach dem Satz,
der hängen geblieben ist), der Faden bleibt die Lektion.

**Der Faden, nicht das Ziel.** Die Woche zählt für sich – sie ist keine
Vorbereitung auf den Sonntag. Seit Oktober 2026 heisst es darum nirgends
mehr «bereit für Sonntag» oder «du gehst vorbereitet in die Klasse», und
keine Aufgabe verlangt, etwas am Sonntag mitzubringen. Die Wochenthemen
beginnen mit «Diese Woche geht es um …», die Lektion steht als
«Lektion: …» unter der Mission. Das Wappen vor Sonntag zu vollenden,
bleibt ein Stern – als Termin, nicht als Vorbereitung.

### 13.2 Mehr Spiel: neue Kartenarten und der Wechsel im Feed

- **Umfrage** (`umfrage`) – zwei Formen: die **Auswahl** (auch als «Was
  würdest du tun?» mit einer echten Situation aus dem Alltag) und die
  **Skala** (ein Regler zwischen zwei Enden: «Wie leicht fällt es dir,
  Nein zu sagen?», «Wie viele Stunden hast du geschlafen?»). **Das
  Ergebnis des Kollegiums erscheint erst nach der eigenen Stimme** – als
  Balken mit Prozenten bzw. als Säulen mit dem Schnitt –, und es bleibt
  bei Zahlen: Wer was gewählt hat, zeigt die Karte nie. So lässt sich
  auch dort ehrlich antworten, wo es persönlich wird. Nach der Stimme
  folgt ein Gedanke aus den Schriften oder dem Wegweiser.
- **Vers-Puzzle** (`puzzle`) – die Teile eines Verses liegen gemischt
  da, wer sie in der richtigen Reihenfolge antippt, baut den Vers. Ein
  Versuch, wie beim Quiz; danach steht der Vers richtig da, und die
  Karte sagt, wie viele aus dem Kollegium ihn auf Anhieb gebaut haben.
  Die Redaktion schreibt den Vers mit « / » zwischen den Teilen.
- **Fakt oder Mythos?** – eine Quizfrage mit genau zwei Möglichkeiten
  erscheint als zwei grosse Kacheln nebeneinander.
- **Die Verteilung nach der Antwort** – Quiz und Bilderrätsel zeigen
  nach der eigenen Antwort, wie das Kollegium geantwortet hat («4 von 5
  lagen richtig»).
- **Ein Emoji je Karte** – ein grosser Blickfang über dem Titel, auch
  ohne Bild aus der Mediathek.

Beide neuen Arten schreiben in dieselbe Sammlung wie das Quiz
(`impulseAnswers`, eine Stimme bzw. ein Versuch je Person, erzwungen
durch die Dokument-ID) – **die Zugriffsregeln bleiben unverändert**.

**Der Platz im Feed gilt jetzt über alle Arten hinweg** (`deckOrder`):
Umfrage, Fakt, Quiz, Selbsteinschätzung, Geschichte, Puzzle – der
Wechsel hält wach, ein Block aus zehn gleichen Karten nicht. Das
Wochenthema steht weiterhin immer vorn, die Teilen-Aufgabe hinten. Eine
neue Karte reiht sich am Ende des ganzen Feeds ein.

### 13.3 Das Wochen-Wappen

Das Erfolgserlebnis der Woche: ein **Wappen**, das sich mit jeder
geschafften Karte aufbaut – ein Schild im Rautenmuster («gerautet», wie
es in der Heraldik heisst), dessen Felder sich färben wie ein
Kirchenfenster, während sich der Rand als Fortschrittslinie füllt. Erst
wenn **alles** geschafft ist, erscheint das Zeichen der Woche in der
Mitte (vorher ein Fragezeichen), der Rand wird golden, Strahlen gehen
auf, und das Band mit dem Spruch entrollt sich («Laufen und nicht
ermüden», «Treu zu allen Zeiten»). Ein Vollbild feiert den Moment –
einmal je Woche und Gerät.

- **Geschafft heisst vollständig** (`impulseCrestSteps`): angeschaut –
  und wo es etwas zu tun gibt, auch getan (Quiz beantwortet, Umfrage
  abgestimmt, Puzzle gebaut, Frage beantwortet, Teilen abgehakt), dazu
  die Vertiefung, wo es eine gibt. Angeschaut zählt eine Karte erst,
  wenn sie einen Moment im Bild stand (gut eine Sekunde) – wer quer
  durch den Feed springt, rauscht an den Karten dazwischen vorbei.
- **Drei Sterne** über dem Wappen (`impulseCrestStars`): «Vor Sonntag
  vollendet» (ganz, bevor die Woche um ist), das
  Wochenziel und die Tages-Challenge an allen sieben Tagen. Gibt es
  diese Woche kein Ziel oder keine Challenge, fehlt der Stern, statt
  unerreichbar dazustehen. Den Tag der Vollendung vermerkt das eigene
  Fortschrittsdokument (`weeks[woche].crest`).
- **Im Feed** steht oben eine Fortschrittsleiste wie über einer Story:
  ein Strich je Karte, gefüllt in der Farbe ihrer Art, sobald sie
  geschafft ist – daneben das kleine Wappen, das bei jeder geschafften
  Karte kurz hüpft («+1»). Ein Tipp aufs kleine Wappen öffnet es gross:
  wie weit es ist, welche Sterne leuchten und an welchen Karten noch etwas
  fehlt – ein Tipp auf eine Karte springt dorthin. Die Abschlusskarte zeigt
  das Wappen ebenfalls gross und zählt auf, was noch fehlt.
- **Im Dashboard** steht die **Mission der Woche** im Zentrum: Countdown
  bis Sonntag, Thema, Wappen, Stand und «Weiter swipen» – das genau bei
  der ersten Karte einsteigt, an der noch etwas fehlt.
- **Miteinander:** Wer sein Wappen schon hat, steht in der Gruppenleiste
  («Wappen vollendet: …») – genannt wird, wer es geschafft hat, nie, wer
  noch unterwegs ist (Leitgedanke 4).
- **Die Sammlung:** «Mein Fortschritt» zeigt das Wappen jeder Woche –
  vollendet oder auf dem Weg dorthin. Der Verlauf darüber heisst «Seit du
  dabei bist» und zeigt so viele Wochen, wie jemand dabei ist – am Anfang
  eine, dann zwei, dann drei (`impulseWeeksSince`, ab `firstSeenWeek`).

Zeichen, Farbe und Spruch wählt die Redaktion am Wochenthema; ohne
Angabe leitet sich das Wappen aus der Woche ab (`defaultCrest`).

### 13.4 Das Themenpaket und der Neustart in der Redaktion

Das frühere Startpaket (vier Wochen aus den Schriften) ist durch ein
**Themenpaket** ersetzt (`lib/impulsePack`): sieben Wochen, je
Wochenthema mit Lektion und Wappen, Wochenziel, Tages-Challenge und
zwölf bis sechzehn Karten im Wechsel – Umfragen, eine Skala, ein «Was
würdest du tun?», Quizfragen, «Fakt oder Mythos?», ein Vers-Puzzle,
offene Fragen, Feed-Karten und die Teilen-Aufgabe. Alles stammt aus
offiziellem Material der Kirche (Heft und Wegweiser «Für eine starke
Jugend», heilige Schriften, Evangeliumsthemen, Kirchengeschichte);
wörtlich zitiert wird nur, wo der Wortlaut gesichert ist, sonst steht
der Gedanke in eigenen Worten mit Fundstelle.

In der Redaktion bietet der Kasten «Themenpaket» zwei Wege:

- **«Bisheriges löschen und neu starten»** – solange vom Paket noch
  nichts da ist: Alle bisherigen Karten werden gelöscht, mitsamt ihren
  Antworten und Beiträgen, danach wird das Paket eingespielt. Fortschritt,
  Serien, Gemerktes und die Einreichungen der Mitmach-Ecke bleiben
  stehen. Der Schritt lässt sich nicht rückgängig machen und verlangt
  eine Bestätigung und eine Verbindung. Welche Antworten und Beiträge
  dazugehören, fragt er frisch beim Server ab (die Abos der Seite können
  noch laden). Dann schreibt er zuerst das Paket und löscht erst danach,
  Stapel für Stapel mit Bestätigung des Servers wie bei den Importen –
  reisst die Verbindung ab, bleibt so nie eine Löschung ohne Paket zurück.
- **«Einspielen»** bzw. **«Nur einspielen»** – ohne zu löschen.
  Vergangene Wochen bleiben weg, und dank fester IDs (`fsy26-w41-…`)
  holt ein späterer Lauf nur nach, was fehlt.

**Das Wappen der Woche** lässt sich in der Redaktion ansehen, bevor es
jemand baut: Der Knopf **«Wappen»** neben «Vorschau der Woche» zeigt es
im Kleinen und öffnet ein Fenster mit dem Wappen im Grossen und einem
Schieberegler – vom leeren Schild bis zum vollendeten, jede bereite
Karte ein Stück, in der Reihenfolge des Feeds. Beim Öffnen spielt es
einmal ab; am Ende stehen alle Sterne. Unter dem Regler steht, welche
Karte zuletzt dazugekommen ist.

`tests/impulse-pack.test.ts` hält fest, dass jeder Inhalt die Prüfung
des Formulars besteht, dass jede Woche mit dem Sonntag ihrer Lektion
endet, dass nie zwei gleiche Arten aufeinander folgen und dass die IDs
fest und eindeutig sind – dazu, dass kein Paket-Text mehr auf die
Vorbereitung für den Sonntag zielt.

**Einmalige Kästen** in der Redaktion – etwa «Schwierigkeits-Hinweise
entfernen» – verschwinden, sobald sie ausgeführt sind, ohne erst auf die
Rückmeldung des Bestands zu warten.

### 13.5 Die Vorschau der Woche: genau die Ansicht der Jugendlichen

«Vorschau der Woche» in der Redaktion öffnet nicht mehr nur den Feed,
sondern **den Bereich selbst** – Übersicht mit «Mission der Woche» und
Wochen-Wappen, Feed mit Fortschrittsleiste und kleinem Wappen, Räume,
Kacheln und die Feier, wenn das Wappen ganz dasteht. Die gewählte Woche
spielt dabei die laufende; einzige Zugabe ist eine Leiste oben mit dem
gespielten Tag und «Vorschau verlassen».

- **Wie bei den Jugendlichen:** nur, was «bereit» ist (die Leiste nennt
  ausgeblendete Entwürfe), keine Redaktions- und Moderationsknöpfe, und
  die Vorschau beginnt bei null – gespielt wird eine eigene Person mit
  dem Vornamen der Redaktion (`PREVIEW_UID`), die echten Antworten der
  Redaktion zählen nicht als die eigenen.
- **Der Tag:** die laufende Woche beginnt heute, jede andere am Montag.
  In der Leiste lässt sich jeder Tag von Montag bis Sonntag wählen –
  Countdown, Tages-Challenge und Sonntag folgen ihm.
- **Nichts wird gespeichert:** Seite und Karten schreiben über
  `useImpulseWrites`; in der Vorschau führen diese Wege einen Stand im
  Arbeitsspeicher nach (`lib/impulsePreview`), mit denselben Feldern wie
  die Dienste, und die Seite liest ihn zum echten Bestand dazu. So
  reagieren Wappen, Sterne, Ergebnisse und Feier wie echt. Auch die
  Statistik am Gerät und die gemerkte Feier bleiben unberührt.
- **Kein Weg hinaus ohne es zu merken:** Jeder Schritt in der Vorschau
  trägt die Woche im Verlauf mit (`state.vorschau`, `useImpulseNavigate`,
  ebenso die Links des App-Menüs in den Bereich); auch Zurück- und
  Vorblättern bleibt Vorschau. Und solange man im Bereich ist, bleibt sie
  auch bei einem Schritt ohne Vermerk bestehen. Sie endet mit «Vorschau
  verlassen» oder wenn der Bereich verlassen wird – und mit ihr der Stand.

Die einzelne Karte und die Einreichung schaut die Redaktion weiterhin im
Fenster an (`ImpulseEditorPreview`). `tests/impulse-preview.test.ts`
hält den gespielten Tag und die Regeln fest, nach denen ein
Schreibvorgang den Stand verändert.

### 13.6 Den Start einer Woche verschieben

Die neue Woche beginnt am Montag, 00:00 – so bleibt es meistens. Wenn die
Redaktion das neue Thema schon früher freischalten will (etwa am
Sonntagabend nach der Kirche) oder die alte Woche länger laufen soll,
verschiebt sie den Start: in der Redaktion bei der gewählten Woche unter
**«Start»** – mit «Jetzt freischalten», «Heute, 19:00», einer frei
wählbaren Zeit oder «Zurück auf Montag, 00:00».

- **Gespeichert am Wochenthema** (`startsAt`, samt der Woche, für die er
  gilt). Ohne Wochenthema bleibt es beim Montag, und ein Entwurf
  verschiebt noch nichts – sonst begänne eine Woche, deren Thema niemand
  sieht. Wandert ein Wochenthema in eine andere Woche, bleibt sein alter
  Start ohne Wirkung. Eine Regeländerung braucht es nicht: Das
  Wochenthema darf die Redaktion ohnehin schreiben.
- **Der Rahmen:** frühestens am Montag der Woche davor, spätestens am
  Sonntag der Woche selbst. Die Woche davor endet entsprechend früher
  oder später.
- **Eine Rechnung für alle:** `impulseCurrentWeek` sagt, welche Woche
  gerade läuft – für die Seite der Jugendlichen, den Punkt in der
  Navigation und die Erinnerung (`benachrichtigungen.mts`). Hat eine
  verschobene Woche noch nicht begonnen, wartet die wöchentliche
  Erinnerung, statt die alte Woche ein zweites Mal als neu anzukündigen –
  und kommt, sobald die Woche beginnt (`weeklyReminderCatchUp`). Der
  Tagestakt spricht von «dieser Woche» und läuft weiter.
- Die Vorschau der Redaktion zeigt immer die gewählte Woche, gleich wann
  sie startet.
- **Heute in der Woche** (`impulseWeekToday`): Läuft eine früher
  freigeschaltete Woche schon, bevor ihr Montag da ist, lägen am
  Sonntagabend alle sieben Tage der Tages-Challenge in der Zukunft – und
  nichts liesse sich abhaken. Bis Montag gilt darum der Montag als heute:
  Wer am Sonntagabend loslegt, hakt den ersten Tag der neuen Woche ab.
  Dieselbe Rechnung gilt für die Meilensteine und den Vermerk des
  Wappens; läuft eine Woche länger, bleibt es beim Sonntag.

`tests/impulse-week-start.test.ts` hält die Regeln fest – auch über den
Jahreswechsel.

### 13.7 Das Minispiel der Woche

Die letzte Karte des Feeds ist ein Spiel: kurz, schnell, mit einer
Rangliste – im Stil der Mini-Games (games.alae.app), etwa von Turmbau. Es
soll sich anfühlen wie jede andere Karte und zugleich die Belohnung nach
den Karten sein.

**Die Karte.** Eine eigene Kartenart, `spiel` («Minispiel»), höchstens eine
je Woche und im Feed immer ganz zuletzt – hinter der Teilen-Aufgabe, auch
in der gemischten Reihenfolge (`deckOrder`). Auf der Karte stehen das
Spiel, «Spielen», der eigene Rekord samt Platz und die Rangliste. Gespielt
wird im Vollbild darüber (`ImpulseGameStage`): Der Feed gehört dem
senkrechten Wisch, das Spiel dem waagrechten – auf derselben Fläche gäbe
das ein Gerangel. Ein **X** oben rechts bricht ab (was bis dahin geschafft
ist, zählt); danach steht wieder die Karte da, an derselben Stelle, und
der Feed lässt sich weiterwischen. Escape schliesst nur das Spiel, nicht
den Feed; geht das Telefon in den Hintergrund, hält die Runde an.

**Das erste Spiel: «Gut für dich?»** – zum Wort der Weisheit. Von oben
fallen Gegenstände: Weizen, Brot, Obst, Rüebli, Wasser, Milch, Joggen,
Velo, Schlaf – und Zigarette, Vape, Bier, Wein, Schnaps, Cocktail, Sekt,
Kaffee, Drogen. Der unterste trägt einen Ring; ein Wisch nach rechts legt
ihn zu «Gut für dich», einer nach links zu «Nein, danke» (Tippen auf die
linke bzw. rechte Hälfte geht auch, am Rechner die Pfeiltasten). Daneben
greifen oder ihn bis zur Linie fallen lassen kostet ein Leben; drei gibt
es, zehn richtige am Stück geben eines zurück. Ein Fehler zeigt kurz, wohin
der Gegenstand gehört hätte («Kaffee: Nein, danke») – das Spiel lehrt
nebenbei. Bewusst fehlt, was nicht klar Ja oder Nein ist (Pommes,
Schokolade, Energydrinks).

**Das Tempo** zieht von Anfang an an und hat ab etwa vierzig Sekunden einen
zweiten Schub, den auf Dauer niemand hält (`sortPace`). Eine Uhr gibt es
nicht – sie gäbe jedem fehlerfreien Lauf dieselbe Zahl, und eine
Rangliste, in der oben alle gleich stehen, ist keine. Ausgespielt mit
einem nachgebildeten Spieler (`tests/impulse-game.test.ts`): Anfänger
kommen auf gut 20 Sekunden, der Durchschnitt auf gut 30, die Besten auf
knapp 55 – keine Runde dauert länger als eine Minute.

**Flüssig auch auf älteren Telefonen.** Gezeichnet wird auf eine Leinwand,
wie Turmbau: jeder Gegenstand einmal vorgezeichnet und danach nur noch
gestempelt, der Hintergrund fertig auf einer zweiten Leinwand, gerechnet
mit der verstrichenen Zeit statt mit Bildern, die Pixeldichte auf 2
begrenzt. React kennt nur die Ränder (Einführung, Ergebnis, X); die Runde
selbst läuft ohne einen einzigen Render. Gemessen im Chromium mit
Handy-Massen: knapp 60 Bilder je Sekunde, mit vierfach gedrosselter CPU
noch über 50.

**Die Rangliste.** Je Spiel-Karte und Konto **ein** Eintrag mit dem besten
Lauf (`impulseGameScores/{itemId}_{uid}`) – wie oft jemand gespielt hat,
steht nirgends, auch nicht in der Datenbank. Nach der ersten Runde fragt
die Karte nach einem Namen für die Liste; vorgeschlagen ist der Vorname,
ein Spitzname geht genauso. Der Name liegt am eigenen Fortschritt
(`gameName`) und gilt für jede weitere Runde und die Spiele der nächsten
Wochen; «Name ändern» führt ihn in allen eigenen Einträgen nach. Ohne
Namen sieht nur die Person selbst ihren Eintrag. Gleichstand heisst
gleicher Platz, wer früher dort war, steht oben; der eigene Platz steht
immer da, auch weit hinten.

**Die Zugriffsregeln** lassen einen Eintrag nur auf den eigenen Namen
entstehen, den Bestwert nur steigen (ganze Zahl bis 9999) und den Namen
höchstens 20 Zeichen lang sein. Aus- und wieder einblenden kann allein die
Redaktion – direkt in der Rangliste der Karte (das Auge neben jedem
fremden Eintrag); ein neuer Bestwert holt einen ausgeblendeten Eintrag
nicht zurück. Fälschen lässt sich ein Bestwert trotzdem, wer die
Datenbank unmittelbar beschreibt: Das Spiel läuft auf dem Gerät – eine
Rangliste unter Freunden, keine Urkunde.

**Das Wappen** zählt die erste Runde wie eine Antwort: Wer einmal gespielt
hat, hat die Karte geschafft. Ebenso zählt sie als Beteiligung (Serie,
Gruppenleiste).

**In der Redaktion** ist «Minispiel» eine Art wie jede andere: anlegen,
Spiel wählen, Titel und ein Satz dazu, «bereit». Die Sparte zählt, wie
viele gespielt haben; wer die Karte löscht, löscht ihre Rangliste mit. Die
Vorschau einer einzelnen Karte lässt sich spielen, speichert aber nichts;
in der Vorschau der Woche lebt der Lauf im Arbeitsspeicher wie jede andere
Antwort. In der Mitmach-Ecke lässt sich ein Minispiel nicht einreichen –
ein Spiel ist Code, keine Karte zum Ausfüllen. Das Themenpaket bringt
«Gut für dich?» für die Woche zum Wort der Weisheit mit; der Kasten
«Themenpaket» bietet es an, solange es fehlt.

**Ein weiteres Spiel** kommt als neuer Schlüssel in `ImpulseGameId`
(`lib/types`) samt Zeichnung in `components/impulse/game` – die Karte, die
Rangliste und die Regeln bleiben dieselben.

### 13.8 Mission, Menü und Zurücksetzen

**Die Aufgaben in der Mission.** Wochenziel und Tages-Challenge waren zwei
eigene Kacheln unter der Mission der Woche. Jetzt stehen sie in der
Mission selbst (`ImpulseMissionTasks`), unter dem grossen Knopf – der
bleibt das Erste, was ins Auge fällt. Sie gehören dorthin, weil sie die
beiden übrigen Sterne über dem Wappen bringen: Wer das Ziel abhakt, sieht
den Stern gleich darüber aufleuchten. Jede Aufgabe hat zwei Teile: oben sie
selbst – ein Tipp öffnet den Vollbild-Raum mit dem ganzen Text und der
Quelle –, darunter der Haken: «Geschafft? Hier abhaken.» beim Ziel, die
sieben Tage bei der Challenge (künftige Tage warten). Abgehakt wird mit
derselben Logik wie im Raum (`hooks/useImpulseTasks`). Eine Woche ohne
Karten, aber mit Aufgaben zeigt sie für sich.

**Die ganze Kachel führt in den Feed.** Nicht nur der Knopf und das Wappen:
Ein Tipp irgendwo auf die Mission öffnet den Feed – bei der ersten Karte,
an der noch etwas fehlt, und von der Stelle aus, an der getippt wurde.
Ausgenommen ist, was ein eigenes Ziel hat: Knöpfe, Links (die Lektion) und
die Aufgaben. Wer bloss Text markiert, bleibt ebenfalls stehen.

**Das Menü zeigt die Woche.** Im Menü stehen nur noch die Karten und
Aufgaben, die die laufende Woche hat – ein «Video» in einer Woche ohne
Video führte ins Leere. Dazu kamen die Umfrage, das Vers-Puzzle und das
Minispiel: Ein Tipp auf «Minispiel» öffnet den Feed bei der Spielkarte, mit
dem Knopf «Spielen». Die Werkzeuge (Mein Fortschritt, Gemerkt,
Mitmach-Ecke, Einstellungen) stehen jede Woche da. In der Vorschau der
Redaktion zeigt das Menü die gespielte Woche.

**Eine Woche zurücksetzen.** Ganz unten in der Redaktion – für die Zeit des
Ausprobierens, bevor der Link an alle geht. Zurückgesetzt wird, was die
Leute in der gewählten Woche getan haben; die Karten selbst bleiben. Ein
Fenster zeigt vorher, was geschieht, und lässt es einstellen:

- **wer:** alle mit Spuren in der Woche oder einzelne Personen – je Person
  steht, was sie getan hat («18 Karten · Wappen · 3 Haken · 5 Antworten»);
- **was:** angeschaute Karten, Wappen und Haken (die ganze Woche im
  Fortschritt, dazu die zuletzt bzw. zuerst gesehene Woche, wenn es diese
  ist) · Antworten · Beiträge zur Frage der Woche · Minispiel-Rangliste ·
  Amen, Gemerktes und Meldungen zu den Karten und Beiträgen der Woche.

Die Zahlen folgen der Auswahl; erst «Zurücksetzen» schreibt. Gerechnet wird
in `lib/impulseReset` (ohne Datenbank, `tests/impulse-reset.test.ts`), beim
Zurücksetzen noch einmal mit dem frischen Stand vom Server
(`resetImpulseWeek`) – kam inzwischen eine Antwort dazu, geht sie mit.
Zwei Feinheiten: Werden Beiträge gelöscht, verschwinden auch die Amen und
Meldungen **aller** dazu – sonst hinge an einem neuen Beitrag derselben
Person (gleiche ID) das Amen von gestern. Und der Name in den Ranglisten
gehört zum Konto, nicht zur Woche: Er kommt nur weg, wenn danach kein
Eintrag der Person mehr bleibt; dann fragt das Spiel nach der nächsten
Runde wieder danach.

**Die Regel dazu.** Am fremden Fortschritt darf die Redaktion nur
wegnehmen (`resetOnly` in `firestore.rules`): ganze Wochen aus `weeks`,
Einträge aus `amens`, `favorites` und `reports`, und `lastSeenWeek`,
`firstSeenWeek` und `gameName` als Ganzes. Eintragen, ändern oder Konto und
Vorname anfassen kann sie nicht – Selbstauskunft gilt weiter.

**Auf den Geräten.** Geschrieben werden zuerst die Löschungen, dann der
Fortschritt. Bei den Betroffenen kommt der zurückgesetzte Fortschritt
sofort an; verschwindet die Woche daraus, liest die App Antworten,
Beiträge und Ranglisten gleich frisch (der schrittweise Abgleich sähe die
Löschungen sonst erst beim nächsten Start). Und die Feier des Wappens gilt
auf dem Gerät nicht mehr, sobald das Wappen wieder leer dasteht: Wer es
neu baut, wird neu gefeiert.

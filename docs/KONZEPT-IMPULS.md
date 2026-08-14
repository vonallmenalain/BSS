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
  Erfassungsformular anzeigen. Wer den Impuls gelesen hat, kommt vorbereitet
  in die Lektion – und die Lektion holt ab, was die Woche gesät hat.
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

Die **Video-Karte** ist die konsequente Fortsetzung: eine Kartenart mit
einem Link statt einer Datei – YouTube, Vimeo oder die direkte Adresse
einer Videodatei (der Download-Link einer Videoseite der Kirche). Das
Video füllt den Bildschirm, startet mit Ton, sobald die Karte im Bild
ist, und hält an, sobald man weiterwischt; Untertitel bleiben aus, und
den Ton bedient die Leiste des Videos selbst. Was sich
nicht einbetten lässt, wird zur Karte mit einem Knopf, der das Video
draussen öffnet – ein ehrlicher Weg hinaus statt eines schwarzen
Rechtecks. Auch die Video-Karte kennt Amen, Merken und die Vertiefung;
gewertet wird wie überall die Teilnahme.

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
- **Vorschau:** jede Karte so sehen, wie die AP’s sie sehen werden.
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
  Konto mit Vollzugriff braucht das Flag (oder ist Admin). Später wäre sogar
  ein Konto denkbar, das **nur** den Impuls-Bereich sieht.
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

Am Anfang bleibt es ungesetzt – Redaktion ist der Admin. Beide Flags stehen
damit dort, wo heute schon Rolle und Aktivstatus verwaltet werden, und
tauchen in denselben Oberflächen auf (Benutzerverwaltung, Freischalt-Dialog).

### Regeln je Sammlung

| Sammlung | Lesen | Schreiben |
| ------------------ | ---------------------- | ------------------------------------------------ |
| Inhalte (Karten, Fragen, Wochen) | Impuls-Zugang | nur Redaktion |
| Antworten & Fortschritt | Impuls-Zugang | **nur die eigene Person** (UID im Dokumentpfad) |
| Beiträge zur Frage der Woche | Impuls-Zugang | anlegen: die eigene Person; ausblenden: Redaktion |
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
                               └─ status    entwurf | bereit – veröffentlicht wird
                                            durch den Kalender: Woche beginnt, Inhalt
                                            erscheint (kein Handgriff am Montag)

impulseAnswers/{itemId_uid}    genau eine Antwort pro Person und Frage
                               ├─ uid, firstName            (mitgeschrieben)
                               ├─ choice / text, correct
                               └─ answeredAt

impulseComments/{itemId_uid}   Beitrag zur Frage der Woche – eine Antwort
                               pro Person und Frage, die ID erzwingt es
                               ├─ itemId, uid, firstName    (mitgeschrieben)
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
                               ├─ kind      gedanke | frage
                               ├─ text, sourceLabel, sourceUrl   – formlos,
                               │            die Redaktion bringt es in Form
                               └─ status    open | accepted – «abgelehnt» gibt
                                            es nicht: Was nicht passt, wird
                                            still entfernt (Leitgedanke 1)

impulseProgress/{uid}          der persönliche Stand – schreibt nur die Person
                               ├─ firstName                 (mitgeschrieben)
                               ├─ lastSeenWeek              – der stille Punkt
                               │            in der Navigation hängt daran
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
  ersten Karte. Darunter die Kacheln, die bewusst nicht Teil des Feeds sind:
  Wochenziel, Tages-Challenge, Mein Fortschritt, Gemerkt, Mitmach-Ecke und
  «Diese Woche dabei». Eine Bildschirmhöhe, keine Unterseitenpflicht.
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
7. **Redaktion:** Vorerst allein das Administrator-Konto; die Öffnung für
   weitere Personen ist mit `impulseEditor` vorbereitet.
8. **Öffnung über die AP’s hinaus:** bleibt als Möglichkeit bestehen – der
   Bereich wird neutral gebaut (Schalter pro Konto, kein AP-Bezug im
   Datenmodell).
9. **Konferenzwochen:** Ja zur Generalkonferenz – als Themenwoche in der
   Woche **nach** der Konferenz. Keine Spezialwoche zur Pfahlkonferenz.

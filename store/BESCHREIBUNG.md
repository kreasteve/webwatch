# Store-Beschreibung (Deutsch)

Quelle für Chrome Web Store, Firefox Add-ons (AMO) und Edge Add-ons.
Stand: v0.3.2. Änderungen hier pflegen, dann in die Store-Formulare kopieren.

---

## Kurzbeschreibung

**Chrome Web Store** (max. 132 Zeichen) — identisch mit `description` im
Manifest, weil der Store dieses Feld übernimmt:

> Zeigt, was eine Website an ihren Betreiber und an Dritte schickt — Klartext für Laien, Rohdaten für Profis. Alles bleibt lokal.

**AMO-Zusammenfassung** (max. 250 Zeichen):

> Datenspur zeigt dir pro Tab, welche Verbindungen eine Website aufbaut: an den Betreiber selbst und an Drittserver. Zu jeder Anfrage siehst du, wem die Gegenstelle gehört, welche Daten mitgingen und welches Risiko dahintersteckt. Alles lokal, nichts wird geblockt.

---

## Langbeschreibung

**Sichtbar machen, wo deine Daten bei einem Webseitenbesuch landen.**

Fast jede Website baut im Hintergrund Verbindungen zu Servern auf, die dir nie
begegnen: Werbenetzwerke, Analysedienste, Datenhändler, Sitzungsaufzeichner.
Datenspur zeigt dir für jeden Tab, wohin diese Verbindungen gehen, wem die
Gegenstelle gehört und was dabei mitgeschickt wurde — live und in
verständlichem Deutsch.

Damit bekommst du Klarheit darüber, was mit deinen Daten passiert und ob du auf
einer Seite verfolgt wirst oder nicht. Ganz ohne Vorwissen: Eine Ampel bewertet
die Seite, dazu Klartext-Sätze wie „Diese Seite hat Daten an 14 fremde Stellen
geschickt, darunter 9 Werbenetzwerke", eine Erklärung zu jeder Firma und jeder
Kategorie und ein Lexikon der Fachbegriffe. Wer genauer hinsehen will, schaltet
auf Profi um: alle Anfragen mit Kopfzeilen, dekodierten Parametern und
Inhalten, ein Netzwerk-Graph der Verbindungen und JSON-Export.

**Was Datenspur erkennt**

• Erst- und Drittanbieter-Anfragen, getrennt pro Tab
• Zuordnung von mehreren hundert Domains zu Firma und Kategorie — handkuratiert,
  mit Fokus auf im deutschsprachigen Raum verbreitete Dienste
• Dekodierte Übertragungen: Query-Parameter, Formulardaten, JSON, Base64 — mit
  deutschen Labels für bekannte Tracking-Parameter
• Erkenntnisse in Klartext: übertragene E-Mail-Adressen (auch gehasht),
  Bildschirmgröße, weitergegebene Seiten-URLs, eindeutige Kennungen, Cookies an
  Dritte, Zählpixel, Geräte-Fingerabdrücke, Cookie-Syncing und mehr

**Der Datenschutz der Erweiterung selbst**

Datenspur sendet nichts nach Hause, baut keine eigenen Verbindungen auf, hat
keine Konten, keine Werbung, kein Tracking. Alle Daten bleiben im Browser und
verschwinden, sobald du den Tab schließt.

**Datenspur blockiert nichts**

Diese Erweiterung ist ein Messgerät, kein Filter. Sie verändert keine Anfrage
und verhindert keine — sie zeigt dir nur, was ohnehin passiert.

**Hinweis bei eingebautem Tracking-Schutz**

Wenn dein Browser Tracker bereits blockiert — etwa Brave mit Shields, Firefox
mit striktem Schutz oder ein installierter Werbeblocker —, siehst du in
Datenspur entsprechend weniger: Was gar nicht erst rausgeht, kann hier nicht
auftauchen. Eine kurze Liste ist in diesem Fall ein gutes Zeichen. Wer sehen
will, was eine Seite ohne Schutz verschicken würde, schaltet den Schutz für
diese Seite kurz ab oder öffnet sie in einem Browser ohne Blocker.

**Wie genau sind die Angaben — und wie du mithelfen kannst**

Was gemessen wird, misst Datenspur genau: Jede Anfrage, die dein Browser
abschickt, wird mitgeschnitten, samt der Daten, die darin stecken. Eine
Einschätzung ist die Einordnung — welche Firma hinter einer Adresse steckt und
wie riskant ihr Geschäftsmodell ist. Diese Zuordnung ist von Hand gepflegt und
wird nie vollständig sein: „Unbekannt" heißt nur, dass eine Adresse noch nicht
in der Datenbank steht — nicht, dass sie harmlos ist.

Die Datenbank wächst stetig, und dafür ist deine Mithilfe gefragt: Stößt du auf
eine unbekannte Adresse, schickst du sie mit dem Melden-Knopf direkt aus der
Erweiterung zur Prüfung ein. Jede Meldung wird recherchiert und von Hand
eingetragen.

Die aktuelle Liste holst du dir mit dem Knopf „Aktualisieren" in der Fußzeile
des Dashboards — ohne auf ein Update der Erweiterung zu warten. Das passiert
ausschließlich auf diesen Klick: Datenspur verbindet sich von sich aus mit
keinem Server.

**Grenzen, offen dokumentiert**

Datenspur sieht, was abgeschickt wird — nicht, was der Empfänger damit macht.
Antwort-Inhalte der Server sind technisch nicht lesbar. Verkehr anderer
Erweiterungen erscheint nicht. Was du siehst, hängt außerdem von deiner
Cookie-Banner-Entscheidung ab.

Quelloffen (MIT): https://github.com/kreasteve/datenspur

---

## Alleiniger Zweck (Single Purpose)

> Datenspur hat einen einzigen Zweck: sichtbar zu machen, welche
> Netzwerk-Verbindungen eine besuchte Website aufbaut und welche Daten dabei an
> Dritte übertragen werden.
>
> Dazu zeichnet die Erweiterung die Anfragen des jeweiligen Tabs auf, ordnet die
> Empfänger anhand einer mitgelieferten Datenbank Firmen und Kategorien zu und
> erklärt die übertragenen Daten in verständlichem Deutsch. Alles davon dient
> dieser einen Aufgabe — Transparenz über den Datenabfluss beim Surfen.
>
> Datenspur blockiert und verändert keine Anfragen, fügt keinen Code in
> Webseiten ein, sendet keine Daten an eigene oder fremde Server und erfüllt
> keine weitere Funktion.

---

## Berechtigungs-Begründungen

**webRequest** — Einzige Datenquelle der Erweiterung. Nur damit lässt sich
beobachten, welche Anfragen eine Seite auslöst, an wen sie gehen und welche
Parameter, Kopfzeilen und Inhalte sie mitführen. Genau das ist der Zweck der
Erweiterung. Es werden ausschließlich die beobachtenden Ereignisse verwendet
(onBeforeRequest, onBeforeSendHeaders, onCompleted, onErrorOccurred) — keine
blockierende Variante, es wird keine Anfrage verändert oder verhindert.

**host_permissions `<all_urls>`** — Nutzerinnen und Nutzer sollen auf jeder
beliebigen Website nachsehen können, wohin ihre Daten fließen. Eine
Beschränkung auf einzelne Domains würde den Zweck aufheben: Gerade die
unbekannten Drittanbieter, um die es geht, lassen sich vorher nicht auflisten,
und ein Werkzeug zur Tracking-Transparenz wäre wertlos, wenn es ausgerechnet
auf der gerade besuchten Seite nichts sehen dürfte. Die Berechtigung wird
ausschließlich zum Beobachten von Anfragen genutzt. Datenspur bringt keine
Content-Scripts mit, liest oder verändert keine Seiteninhalte und führt keinen
Code auf Webseiten aus.

**tabs** — Nötig, um jede Anfrage dem richtigen Tab zuzuordnen und die Adresse
der besuchten Seite zu kennen. Ohne die Seiten-Domain lässt sich nicht
unterscheiden, was Erstanbieter und was Drittanbieter ist — diese
Unterscheidung ist der Kern der Auswertung. Die Tab-Adresse wird nur lokal
ausgewertet und im Dashboard angezeigt.

**storage** — Speichert die Aufzeichnung des jeweiligen Tabs in
`storage.session`, damit die Daten einen Neustart des Service Workers
überstehen; sie werden mit dem Tab verworfen. In `storage.local` liegen nur
zwei Einstellungen: die gewählte Ansicht (Einfach/Profi) und ob ein Neuladen
die Aufzeichnung leeren soll. Es werden keine besuchten Adressen dauerhaft
gespeichert.

**Kein Remote-Code** — Die Erweiterung lädt keinen Code nach. Sämtliche
Skripte und die Tracker-Datenbank sind im Paket enthalten.

**Datennutzung** — Es werden keine Nutzerdaten erhoben, übertragen oder
verkauft. Datenspur baut keine eigenen Netzwerkverbindungen auf; alle Daten
bleiben im Browser des Nutzers.

Firmen-Zuordnungen beruhen auf öffentlich zugänglichen Quellen; Kategorien und
Risiko-Einstufungen sind redaktionelle Bewertungen. Korrekturverfahren für
betroffene Unternehmen: siehe KORREKTUREN.md im Repository.

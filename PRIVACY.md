# Datenschutzerklärung — Datenspur

Stand: August 2026

Datenspur ist eine Browser-Erweiterung, die sichtbar macht, welche Verbindungen
dein Browser beim Besuch von Websites aufbaut. Der Zweck der Erweiterung ist
Transparenz — und sie hält sich selbst daran.

**Die Kurzfassung:** Datenspur überträgt nichts. Es gibt keinen Server der
Entwickler, keine Konten, keine Telemetrie, keine Werbung. Alles, was die
Erweiterung verarbeitet, bleibt auf deinem Gerät.

## Welche Daten Datenspur verarbeitet

Damit die Erweiterung ihre Aufgabe erfüllen kann, wertet sie auf deinem Gerät
Folgendes aus:

- **Verlaufsdaten der besuchten Seiten (Webprotokoll):** Adresse, Hostname,
  Titel und Zeitpunkt der Seiten, die im jeweiligen Tab geöffnet sind. Ohne
  diese Angaben lässt sich nicht unterscheiden, was Erstanbieter und was
  Drittanbieter ist — die Grundlage der gesamten Auswertung.
- **Nutzeraktivität (Netzwerküberwachung):** die Netzwerk-Anfragen, die eine
  Seite auslöst — Zieladresse, Zeitpunkt, Typ, Statuscode, Kopfzeilen sowie
  die mitgeschickten Parameter und Inhalte.

Diese Anfragen können Daten enthalten, die eine Website an Dritte übermittelt —
etwa eine (auch gehashte) E-Mail-Adresse, Standort-Koordinaten, Kennungen oder
Gerätemerkmale. Genau das sichtbar zu machen, ist der Zweck von Datenspur.
Solche Inhalte werden ausschließlich lokal erkannt und dir angezeigt; sie
werden nicht gespeichert, nicht ausgewertet und nirgendwohin übertragen.

Datenspur liest **keine Inhalte** der besuchten Seiten. Die Erweiterung bringt
keine Content-Scripts mit und führt keinen Code auf Webseiten aus. Antworten
der Server sind für sie technisch nicht lesbar.

## Wo diese Daten liegen und wie lange

- Die Aufzeichnung eines Tabs liegt in `storage.session` — im Speicher deines
  Browsers. Sie wird verworfen, sobald du den Tab schließt, spätestens beim
  Beenden des Browsers.
- Dauerhaft gespeichert werden ausschließlich zwei Einstellungen in
  `storage.local`: der gewählte Anzeigemodus (Einfach/Profi) und ob ein
  Neuladen die Aufzeichnung leeren soll. Besuchte Adressen sind davon nicht
  betroffen.
- Es gibt keine Cloud-Synchronisierung. Die Chrome-Storage-Sync-API wird nicht
  verwendet.

## Verbindliche Zusagen

- **Keine Übertragung.** Die Erweiterung baut keine eigenen Netzwerk-
  verbindungen auf, meldet sich bei keinem Server und enthält keine Telemetrie.
- **Keine Weitergabe, kein Verkauf.** Nutzerdaten gehen an niemanden — auch
  nicht zur Bonitätsprüfung oder für Darlehenszwecke.
- **Keine zweckfremde Nutzung.** Die verarbeiteten Daten dienen ausschließlich
  der Anzeige in der Erweiterung selbst.
- **Kein Blockieren, kein Verändern.** Datenspur beobachtet nur; jede Anfrage
  läuft unverändert durch.
- **Kein nachgeladener Code.** Sämtliche Skripte und die Tracker-Datenbank
  sind im Paket enthalten.

## Wenn du selbst Daten weitergibst

- **Export und Kopieren:** Die Kopier- und Exportfunktionen legen die
  Auswertung in deine Zwischenablage oder in eine von dir gespeicherte Datei.
  Was du damit machst — etwa sie einer KI zur Erklärung vorlegen —,
  entscheidest ausschließlich du.
- **Unbekannte Adresse melden:** Wenn du den Melden-Knopf benutzt, öffnet
  Datenspur in einem neuen Tab ein vorausgefülltes Formular für ein Ticket im
  öffentlichen GitHub-Repository. Vorausgefüllt sind: die unbekannte(n)
  Domain(s), die dabei gesehenen Hostnamen, die Anzahl der Anfragen, die
  Hauptdomain der besuchten Seite (sie hilft bei der Zuordnung) und die
  Versionsnummer der Erweiterung. Nichts davon wird automatisch abgeschickt —
  du siehst den vollständigen Text vor dem Absenden und kannst ihn ändern
  oder Angaben löschen, insbesondere die besuchte Seite. Sobald du absendest,
  ist das Ticket öffentlich; dafür gilt dann die Datenschutzerklärung von
  GitHub.

## Warum welche Berechtigungen?

- **webRequest:** um die Anfragen zu sehen, die eine besuchte Seite auslöst.
  Verwendet werden nur beobachtende Ereignisse — keine blockierende Variante.
- **Zugriff auf alle Websites (`<all_urls>`):** damit du auf jeder beliebigen
  Seite nachsehen kannst. Gerade die unbekannten Drittanbieter, um die es
  geht, lassen sich vorher nicht auflisten.
- **tabs:** um Anfragen dem richtigen Tab zuzuordnen und die beobachtete Seite
  anzuzeigen.
- **storage:** für die Aufzeichnung des Tabs und die beiden Einstellungen.

## Kontakt

Fragen und Meldungen: über den
[Issue-Tracker des Quellcode-Repositories](https://github.com/kreasteve/datenspur/issues)
oder das [Impressum](https://kreasteve.de/impressum.html).

Der vollständige Quellcode ist offen (MIT-Lizenz) und überprüfbar — jede
Aussage in dieser Erklärung lässt sich darin nachlesen.
Hinweise für betroffene Unternehmen: [KORREKTUREN.md](KORREKTUREN.md).

# Entwurf 2 — „Pit Lane"

Ein zweiter Gestaltungsentwurf der Startseite, **völlig getrennt** von der
Hauptseite: eigenes CSS, eigene Schriften, eigenes JavaScript. Nicht ans CMS
angebunden, nicht in der Sitemap, auf `noindex` gestellt. Zum Anschauen und
Vergleichen — nichts hier beeinflusst die echte Website.

Aufrufen: `/v2/`

## Woran ich mich orientiert habe

hunteryeany.com · thiswasmajor.com · thegrind.nl — was diese drei gemeinsam haben:
weiches Scrollen, eigener Cursor, Marquee-Bänder, clip-path-Enthüllungen,
Hell-Dunkel-Wechsel und große Statement-Typografie.

## Was anders ist als in Fassung 1

**Hell-Dunkel-Wechsel.** Statt durchgehend Schwarz wechseln sich dunkle und
helle Bahnen ab. Die hellen geben den dunklen erst ihre Wucht.

**Eine variable Schrift statt zwei.** Archivo über die volle Breitenachse
(wdth 62–125): schmal-hoch für Stapel, breit-fett für Statements. Dazu
Martian Mono für alles Technische — Marker, Zahlen, Kleingedrucktes.
Antonio und Inter kommen nicht mehr vor.

**Bewegung kommt vom Scrollen.** Weiches Scrollen ohne Bibliothek (der Körper
läuft der Scrollposition gedämpft hinterher), Zeilen fahren hinter Masken auf,
Bilder werden über clip-path aufgezogen, Zahlen laufen hoch, Bänder laufen quer.

**Eigener Cursor** mit Beschriftung an interaktiven Stellen.

**Inhaltlich umgebaut.** Neue Hero-Aussage („Wir bauen Maschinen, die beißen."),
Leistungen als nummerierter Index statt Kartenraster, Racing als geteilte Bahn,
Bikes reduziert auf drei, Fußbereich mit großer Schlusszeile.

**Farben bleiben in der Marke:** `#05050b`, `#e51a36`, `#54ffe6` — unverändert
aus Fassung 1 übernommen. Neu ist nur das kühle Off-White `#eceded` für die
hellen Bahnen und ein aufgehellter Rotton `#ff5064` für kleinen Text auf Schwarz.

## Vier Bilder wurden dafür erzeugt

`assets/` — Pit Lane bei Nacht, Rennhandschuhe am Lenker, Bremsscheibe im Detail,
Schräglage bei Dämmerung. Alle mit gpt-image-1, bewusst als dunkle Detailaufnahmen.

## Eine Falle, die hier steckte

Der clip-path-Aufzug hatte anfangs **seinen eigenen Auslöser blockiert**: Chrome
rechnet `clip-path` in die Sichtbarkeitsprüfung des IntersectionObservers ein.
Ein vollständig weggeclipptes Element meldet nie eine Schnittfläche, bekommt die
Klasse nie und bleibt für immer unsichtbar. Lösung: geclippt wird das Bild,
beobachtet wird sein Rahmen.

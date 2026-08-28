# motorized.at

Website von **Schwarz Motorized** (Autohaus Schwarz e.U., Mönchhof, Burgenland) —
offizieller Aprilia Händler und Racing Performance Center.

Statisches HTML/CSS/JS. Kein Framework, kein Build-Schritt, keine externen
Abhängigkeiten. GitHub Pages liefert die Dateien direkt aus.

---

## Lokal ansehen

Doppelklick auf `index.html` genügt. Wer einen echten Server möchte:

```bash
python3 -m http.server 4330
```

---

## Seiten

| Pfad | Datei | Inhalt |
|---|---|---|
| `/` | `index.html` | Startseite — Hero, Leistungen, Racing, Angebote, Mieten, Testimonials, Team, FAQ, Kontakt |
| `/racing/` | `racing/index.html` | **Landingpage** — auf Anfragen optimiert, zwei Zielgruppen |
| `/bikes/` | `bikes/index.html` | Pre-Owned & Demo Bikes mit Preisen |
| `/bikes/<modell>/` | | Detailseite je Motorrad, entsteht automatisch |
| `/impressum/` · `/datenschutz/` · `/agb/` · `/cookies/` | | Rechtstexte |
| `/admin/` | `admin/index.html` | CMS zum Pflegen der Inhalte |
| — | `404.html` | Fehlerseite |

## Aufbau

```
index.html, racing/, bikes/, impressum/, datenschutz/, agb/, 404.html
css/style.css      Tokens → Reset → Bausteine → Sections → Mobile → Unterseiten
css/fonts.css      @font-face für die selbst gehosteten Schriften
fonts/             Antonio + Inter als woff2 (latin, latin-ext) — 175 KB
js/main.js         Header, Menü, Scroll-Reveals, Cursor-Vorschau, FAQ, Anker
assets/web/        Bilder, web-optimiert
assets/partners/   Marken-Logos
assets/logo/       Wortmarke (SVG)
assets/icons/      Favicon, Share-Bild
content/           die Inhalte als JSON — das, was im CMS bearbeitet wird
content/seo.json   Meta-Titel, Beschreibungen und Teilbilder je Seite
admin/index.html   Anmeldung
admin/app.html     das CMS selbst (eigene Seite)
admin/github.js    gemeinsame GitHub-Anbindung beider Seiten
tools/rebuild.py   erzeugt alle HTML-Seiten aus content/
.github/workflows/ baut die Seiten neu und veröffentlicht auf Pages
docs/              Analyse der alten Seite, verworfene Webflow-Variante
```

## Inhalte pflegen — das CMS

Unter **`/admin/`** liegt ein kleines Redaktionssystem. Damit lassen sich ohne Code ändern:

- **Motorräder** — anlegen, bearbeiten, ausblenden, Reihenfolge, Bilder hochladen.
  Für jedes sichtbare Motorrad entsteht automatisch eine Detailseite.
- **Leistungen** auf der Startseite
- **Team**
- **FAQ** in Gruppen
- **Rezensionen**
- **SEO & Teilen** — Titel und Beschreibung für Google, Bild für WhatsApp/Facebook/LinkedIn,
  mit Zeichenzähler und Live-Vorschau beider Darstellungen
- **Kontaktdaten** — Adresse, Telefon, Öffnungszeiten, Buchungslink, Vorschau-Modus
- **Tracking** — Google Tag Manager und Facebook-Pixel

Die Listen sind eingeklappt: eine Zeile je Eintrag mit Vorschaubild, Kennzahlen und Status.
Ein Klick öffnet das Formular, und es ist immer nur eines offen. Offene Änderungen sammeln
sich in einer Leiste am unteren Rand, die sich erst zeigt, wenn es etwas zu speichern gibt —
mit „Veröffentlichen" und „Verwerfen".

### Anmeldung

Es gibt keinen eigenen Benutzer und kein Passwort — die Anmeldung läuft über einen
**GitHub-Token**. Wer keinen Token hat, kommt nicht rein.

1. Auf [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
   einen **Fine-grained Token** erzeugen.
2. Bei *Repository access* nur dieses Repository auswählen.
3. Unter *Permissions → Repository permissions* den Punkt **Contents** auf
   **Read and write** stellen.
4. Token kopieren, unter `/admin/` einfügen, Repository als `benutzername/repository`
   angeben.

Der Token liegt danach nur im Browser des Nutzers (localStorage) und geht ausschließlich
an `api.github.com`. Setz ein Ablaufdatum — läuft er ab, erzeugst du einfach einen neuen.

### Was beim Speichern passiert

„Änderungen veröffentlichen" schreibt alle bearbeiteten Dateien als **einen** Commit
nach `content/`. Die GitHub Action `build.yml` baut daraufhin die HTML-Seiten neu,
`pages.yml` veröffentlicht sie. Nach ein bis zwei Minuten ist die Änderung live.

## Etwas am Layout ändern

Text und Struktur, die nicht im CMS stehen (Hero, Manifest, Racing-Texte), liegen in
`tools/rebuild.py` bzw. `tools/home-main.html`. Nach dem Bearbeiten einmal:

```bash
python3 tools/rebuild.py
```

Direkt in `index.html` zu schreiben funktioniert auch — aber der nächste Rebuild
überschreibt es wieder. Deshalb besser in den Vorlagen ändern.

## Vorschau-Modus

In `content/settings.json` steht `"noindex": true` — im CMS unter *Kontaktdaten*
als Schalter „Vorschau-Modus". Solange er an ist:

- jede Seite trägt `<meta name="robots" content="noindex, nofollow">`
- `robots.txt` erlaubt das Auslesen weiterhin (wichtig!) und nennt keine Sitemap

Das Auslesen bleibt bewusst erlaubt: Sperrt man Suchmaschinen per `robots.txt` aus,
können sie das `noindex` gar nicht lesen — und nehmen die Adresse trotzdem in den
Index, nur ohne Beschreibung. Der umgekehrte Weg ist der sichere.

**Vor dem echten Livegang ausschalten**, sonst findet Google die Seite nie.
Zusammen mit `site_url` sind das die zwei Werte, die beim Umzug auf die echte
Domain angepasst werden müssen.

## Konversions-Ereignisse für Werbung

Die Website meldet wichtige Handlungen an den `dataLayer`. Im Tag Manager legst du
dafür Auslöser vom Typ „Benutzerdefiniertes Ereignis" an:

| Ereignis | Wann |
|---|---|
| `sm_anruf` | jemand tippt auf eine Telefonnummer |
| `sm_termin` | jemand öffnet die Online-Terminbuchung |
| `sm_anfrage` | das Racing-Formular wurde abgeschickt |
| `sm_bike_anfrage` | jemand fragt ein bestimmtes Motorrad an |
| `sm_email` | jemand klickt auf eine E-Mail-Adresse |

Die Meldung selbst ist kein Tracking — sie landet nur im `dataLayer`. Ausgewertet
wird sie erst, wenn der Besucher zugestimmt hat und der Tag Manager dadurch läuft.

## Cookies und Tracking

Solange in `content/tracking.json` keine ID eingetragen und aktiviert ist, lädt die
Website **nichts** von fremden Servern und zeigt **kein** Cookie-Banner.

Sobald du im CMS eine GTM- oder Pixel-ID einträgst und aktivierst, erscheint das Banner.
Getestet und belegt: vor der Zustimmung wird kein einziges externes Skript geladen,
und der Google Consent Mode steht auf `denied`. Erst bei „Alle akzeptieren" werden
Tag Manager und Pixel nachgeladen. „Nur notwendige" lädt weiterhin nichts.

Die Cookie-Seite unter `/cookies/` passt ihren Inhalt automatisch an — sie listet nur
Dienste auf, die tatsächlich aktiv sind.

## Design-System

| | |
|---|---|
| Display | **Antonio** 700, durchgehend UPPERCASE |
| Fließtext | **Inter** 400–800, 17 px, Zeilenhöhe 1,7 |
| Basis | `#05050b` |
| Primär / Aktion | `#e51a36` — für kleinen Text auf Schwarz `#ff5064` |
| Signal / Highlight | `#54ffe6` |
| Radien | 2 px |

Zwei Fallstricke, die schon aufgetreten sind:

- **Überschriften nicht enger als `line-height: 1.02`** setzen. Antonio legt die
  Umlautpunkte über die Versalhöhe; darunter kollidieren sie mit der Zeile davor.
- **Kein `text-wrap: nowrap` auf Überschriften.** In Kombination mit
  `overflow-x: hidden` am Body verschluckt es die Umlautpunkte — aus „MOTORRÄDER"
  wird sichtbar „MOTORRADER".

## Geprüft

- Kontrast: alle Textknoten auf allen 7 Seiten erfüllen WCAG AA
- Kein horizontaler Überlauf bei 390 px und 1440 px
- Alle internen Links und Assets lösen auf, keine kaputten Bilder
- `prefers-reduced-motion` respektiert, ohne JavaScript vollständig lesbar
- Selbst gehostete Schriften — kein Google-CDN, keine IP-Übertragung an Dritte

## Offene Punkte

1. **Datenschutzerklärung überarbeiten.** Der Text stammt von der WordPress-Seite und
   nennt Google Analytics, Cookies und Dienste, die es hier nicht mehr gibt. Diese
   Seite setzt keine Cookies und lädt nichts von Dritt-Servern — ein Cookie-Banner
   ist deshalb nicht nötig, die Erklärung muss aber angepasst werden.
2. **AGB rechtlich prüfen lassen.** Übernommen wie sie waren; enthält einen Link auf
   die alte Domain `autohausschwarz.at`.
3. **Preise und Bike-Daten gegenprüfen** — Stand der alten Seite.
4. **Vier Bilder sind KI-generiert** (ECU-Flash, Werkstatt-Detail, Carbon-Teil,
   Nachtaufnahme im Kontaktblock). Sobald es echte Fotos gibt, austauschen.
5. **Racing-Anfrageformular** öffnet aktuell das E-Mail-Programm des Besuchers
   (kein Server nötig). Wenn Anfragen direkt ankommen sollen, braucht es einen
   Formulardienst — dann fallen Datenschutzhinweise dafür an.
6. **Vorschau-Modus ist aktiv** — die Seite steht auf `noindex` und wird von Google
   nicht aufgenommen. Vor dem Livegang zusammen mit `site_url` umstellen.
7. **Preise auf der Racing-Seite:** Die drei Ausbaustufen nennen bewusst keine Beträge,
   weil mir keine vorliegen. Sobald es Richtwerte gibt, gehören sie dort hin — das ist
   der größte verbleibende Conversion-Hebel.

---

© Autohaus Schwarz e.U. · Umsetzung: [outlize](https://outlize.com)

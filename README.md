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
| `/racing/` | `racing/index.html` | Rennstreckenumbau, ECU Flash, Racing-Service |
| `/bikes/` | `bikes/index.html` | Pre-Owned & Demo Bikes mit Preisen |
| `/impressum/` · `/datenschutz/` · `/agb/` | | Rechtstexte |
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
tools/rebuild.py   optional — erzeugt Header/Footer auf allen Seiten neu
docs/              Analyse der alten Seite, verworfene Webflow-Variante
```

## Etwas ändern

**Inhalt einer Seite** — die HTML-Datei direkt bearbeiten. Fertig.

**Navigation oder Footer** (steht auf allen 7 Seiten identisch) — entweder in allen
Dateien suchen und ersetzen, oder `tools/rebuild.py` anpassen und einmal ausführen:

```bash
python3 tools/rebuild.py
```

Das Skript überschreibt alle Seiten aus den Vorlagen in `tools/`. Wer nur Text auf
einer einzelnen Seite ändert, braucht es nicht.

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
5. **Die Bike-Detailseiten** (`/motorraeder/<modell>`) der alten Seite gibt es hier
   noch nicht — aktuell verlinkt die Übersicht auf den Kontakt.

---

© Autohaus Schwarz e.U. · Umsetzung: [outlize](https://outlize.com)

# Übertragung nach Webflow

Die Seite ist so gebaut, dass du sie **Section für Section** nach Webflow ziehen kannst.
Jede Section ist ein in sich geschlossener Block: eigener Klassen-Präfix, keine Abhängigkeit
zu Nachbar-Sections, keine Utility-Klassen quer über die Seite.

---

## 1. Was einmalig ins Projekt muss

### Schriften
Beide sind Google Fonts und in Webflow nativ verfügbar → *Project Settings → Fonts → Google Fonts*:

| Familie | Schnitte | Rolle |
|---|---|---|
| **Antonio** | 400, 600, 700 | alle Headlines, FAQ-Fragen, Preise, Kennzahlen — immer UPPERCASE |
| **Inter** | 400, 500, 600, 700, 800 | Fließtext, Labels, Buttons, Navigation |

> Die alte Seite schrieb `font-weight: 900` für Antonio. Antonio gibt es nur bis 700 —
> der Browser hat das bisher stillschweigend auf 700 geclampt. In Webflow direkt **700** setzen.

### Variablen (*Project Settings → Variables*, oder Custom Code im `<head>`)
```css
:root{
  --ink:#05050b; --ink-raised:#0b0b15;
  --ink-line:rgba(255,255,255,.12); --ink-line-2:rgba(255,255,255,.07);
  --red:#e51a36; --red-hot:#ff2b48; --red-lite:#ff5064;
  --cyan:#54ffe6; --white:#fff;
  --text:rgba(255,255,255,.74); --text-dim:rgba(255,255,255,.52);
}
```
`--red-lite` ist der hellere Rotton für **kleinen** Text auf Schwarz — das normale `#e51a36`
schafft bei 13 px die 4,5:1-Kontrastschwelle nicht.

### Globale Einstellungen
- Body: Background `--ink`, Text `--text`, Inter 17 px, **Line-height 1.7**
  (helle Schrift auf Dunkel braucht mehr Durchschuss als üblich).
- H1–H4: Antonio 700, `text-transform: uppercase`, `letter-spacing: -0.015em`,
  **`line-height: 0.96`** — enger schneidet Webflow dir die Umlaut-Punkte ab (Ä, Ö, Ü).
- Alle Radien: **2 px**. Keine abgerundeten Karten — die Marke ist Motorsport, keine App.

### Zwei globale Helfer im Custom Code (`</body>`)
1. **Filmkorn** – ein `div.grain`, `position: fixed`, komplettes SVG-Rauschen als Data-URI,
   `opacity .045`, `mix-blend-mode: overlay`. Kostet nichts und nimmt den Flächen das Digitale.
2. **Doppel-Chevron als SVG-Symbol** – das `<symbol id="i-chev">` einmal ins Body-Custom-Code,
   danach überall `<svg class="chev"><use href="#i-chev"/></svg>`. In Webflow: als HTML-Embed
   in ein Symbol/Component packen und wiederverwenden.

---

## 2. Sections in Reihenfolge

| # | Section | Klassen-Präfix | Webflow-Umsetzung |
|---|---|---|---|
| 00 | Header | `.hdr`, `.mnav` | Navbar-Component, fixed. Klasse `is-stuck` per Interaction bei Scroll > 24 px |
| 01 | Hero | `.hero` | Section 100 svh (max. 58 rem), Bild absolut dahinter, Verlaufs-Overlay als eigenes Div |
| 02 | Partner-Marquee | `.partners` | Label fix links, Logos im Endlos-Lauf (2 identische Sets, `translateX(-50%)`) |
| 03 | Manifest + Kennzahlen | `.manifest`, `.stats` | 2-Spalten-Grid + 4er-Grid mit 1 px Gap als Trennlinien |
| 04 | Leistungen | `.svc` | Collection oder 4 statische Zeilen + Cursor-Vorschau (siehe unten) |
| 05 | Racing-Spotlight | `.racing` | Vollflächiges Bild, Text linksbündig, Overlay-Verlauf |
| 06 | Aktuelle Angebote | `.offers`, `.offer` | **CMS-Collection „Angebote"** — Bild, Flag, Titel, Meta, Preis |
| 07 | Motorrad mieten | `.rent` | 2-spaltiges Full-Bleed-Grid, Bild links, Text rechts |
| 08 | Warum wir | `.why` | 3er-Grid mit 1 px Gap, Icons als Inline-SVG (damit sie die Farbe erben) |
| 09 | Testimonials | `.says`, `.say` | **CMS-Collection „Rezensionen"** — Zitat, Text, Quelle, Avatar, Name, Bike |
| 10 | Team | `.team` | **CMS-Collection „Team"** — Foto, Name, Rolle |
| 11 | FAQ | `.faq` | 3 Gruppen, je ein Akkordeon. Answer-Wrapper mit `grid-template-rows: 0fr → 1fr` |
| 12 | Kontakt / Standort | `.contact`, `.info` | Bild als Hintergrund, Infoliste rechts mit Trennlinien |
| 13 | Footer | `.ft` | Roter Block, 3 Spalten oben, Rechtliches unten |

---

## 3. Die vier Interactions

Alles ohne Fremdbibliothek — jede lässt sich als Webflow-Interaction nachbauen.

**A · Header wird fest** — Page Scroll, ab 24 px: Background `rgba(5,5,11,.82)` + Blur 14 px.

**B · Hero-Headline zieht zeilenweise auf** — jede Zeile liegt in einem Wrapper mit
`overflow: hidden`, der Text startet auf `translateY(105%)` und fährt beim Laden auf 0.
Zeile 2 und 3 mit je 100 ms Versatz. Easing `cubic-bezier(.16,1,.3,1)`, 1,1 s.
Dazu das Hero-Bild von `scale(1.18)` auf `scale(1.06)` über 2,4 s.

**C · Scroll-Reveal** — `opacity 0 → 1`, `translateY(28px) → 0`, 0,9 s, gleiches Easing.
In Webflow: *While Scrolling in View* bzw. *Scroll Into View*.
Wichtig: die versteckte Ausgangslage darf **nie** der Auslieferungszustand sein.
Im Code hängt sie an einer `.js`-Klasse, die ein Watchdog nach 3 s wieder entfernt,
falls das Skript gar nicht startet. In Webflow löst das die Interaction von selbst.

**D · Bildvorschau folgt dem Cursor (Leistungen)** — die Signature-Interaktion.
Beim Hover über eine Zeile blendet ein 4:5-Bild an der Cursorposition ein, folgt der Maus
gedämpft (Lerp 0,14) und neigt sich leicht in Bewegungsrichtung.
In Webflow: *Mouse Move over Element* auf die Liste + *Mouse Hover* auf die Zeile.
**Unter 896 px und auf Touch-Geräten** steht das Bild stattdessen fest in der Zeile —
diese Umschaltung passiert im Code beim Ereignis, nicht beim Laden, damit sie ein
Resize und Geräte mit Maus *und* Touch überlebt.

Alle vier respektieren `prefers-reduced-motion` (in Webflow: Häkchen bei der Interaction).

---

## 4. CMS-Collections, die sich lohnen

**Angebote** — Bild · Flag-Text (`Cool Deal Aktion`) · Titel · Meta · Preis · „ab"-Kennzeichen (Switch) · Link
**Rezensionen** — Zitat (kurz, wird groß gesetzt) · Fließtext · Quelle (Google/Facebook) · Avatar · Name · Bike · Hervorheben (Switch → Cyan-Karte)
**Team** — Foto · Name · Rolle · Reihenfolge
**FAQ** — Frage · Antwort · Gruppe (Option: Service & Werkstatt / Racing & Umbau / Kaufen & Mieten)

Die Cyan-Karten bei den Rezensionen sind bewusst gesetzt (Position 1 und 5), nicht zufällig —
über einen Switch im CMS steuerbar.

---

## 5. Worauf du beim Nachbauen achten solltest

- **Kein `overflow: hidden` auf dem Leistungs-Wrapper**, sonst wird die Cursor-Vorschau abgeschnitten.
- **Die Verläufe sind Divs, keine Bilder.** Die alte Seite hat dieselben drei „light-source"-PNGs
  zehnmal wiederholt — sichtbare Kanten, mehrere MB. Jetzt sind es CSS-Verläufe mit `filter: blur()`.
- **`font-variant-numeric: tabular-nums`** auf Preise, Kilometerstände, Telefonnummer und
  Öffnungszeiten (Klasse `.num`). Sonst tanzen die Ziffern.
- **Der Hero deckelt bei 58 rem.** Ein reines `100vh` wird auf hohen Monitoren absurd.
- Section-Abstände: `clamp(3.75rem, 7vw, 6.5rem)` oben und unten. Bewusst enger als die
  alte Seite — die war 13.000 px lang bei wenig Inhalt.

---

## 6. Was vor dem Livegang noch zu klären ist

1. **Preise und Angebotsdaten prüfen.** Tuono V4 1100 Factory ab € 21.490,– / Tuareg 660 ab
   € 12.490,– / Moto Guzzi V9 Bobber € 7.790,– sind aus der Bestandsseite übernommen.
   Die PS-Angaben (175 PS V4, 80 PS Twin) sind Herstellerwerte — bitte gegen die
   tatsächlich angebotene Ausstattung gegenprüfen.
2. **Drei Bilder sind KI-generiert** (`assets/generated/`): ECU-Flash, Werkstatt-Detail und
   die Nachtaufnahme in der Kontakt-Section. Sie ersetzen einen Excel-artigen Software-Screenshot
   und ein Handyfoto. Sobald es echte Fotos vom Betrieb gibt, sollten sie getauscht werden —
   sie sind bewusst als dunkle Detailaufnahmen angelegt, damit sie nicht nach KI aussehen,
   aber echte Fotos sind immer besser.
3. **Das Gebrauchtbike-Foto** (Moto Guzzi) trägt unten rechts noch einen Pfeil aus der alten
   Bildbearbeitung. Den roten „TOP Gebrauchtbike"-Balken habe ich weggeschnitten.
4. **Die Service-Fotos der Bestandsseite sind nur 505 × 641 px.** Für die Cursor-Vorschau
   reicht das gerade so — größere Originale wären besser.
5. **Cookie-Banner** neu einbauen (Complianz fällt mit WordPress weg).
6. Die Links zu `/racing/` und `/gebrauchte-bikes/` zeigen noch auf die alte Domain.

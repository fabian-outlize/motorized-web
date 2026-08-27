# motorized.at — Analyse der Bestandsseite

**Kunde:** Schwarz Motorized / Autohaus Schwarz e.U., Betriebsgebiet Nord 4, 7123 Mönchhof, Burgenland
**Positionierung:** Offizieller Aprilia Händler + Racing/Performance Center. „WE ARE RACERS – FROM STREET TO TRACK"
**Aktuell:** WordPress 7.1 + Elementor, gebaut von outlize
**Ziel:** neu designte, bessere Version — sectionweise nach Webflow übertragbar

---

## 1. Design-System (Bestand)

### Schriften — bleiben (beide Google Fonts, in Webflow nativ verfügbar)
| Rolle | Font | Einsatz |
|---|---|---|
| Display / Headlines | **Antonio** (100–700, verwendet als „900" → clamped 700) | durchgehend UPPERCASE, sehr condensed, riesig (bis ~160px im Hero) |
| Body / UI | **Inter** (100–900) | 12–16px, Fließtext, Labels, Buttons (800) |

### Farben
| Token | Hex | Verwendung |
|---|---|---|
| Base / Background | `#03000E` | fast-schwarzes Navy, gesamte Seite |
| Accent Red | `#E51A36` | CTA-Buttons, Footer-Fläche, Doppelpfeil-Icon |
| Accent Cyan | `#54FFE6` | Highlight-Wörter in Headlines, Pfeile, Testimonial-Karten-Flächen |
| Weiß | `#FFFFFF` | Headlines, Text |
| Body-Text | `rgba(255,255,255,~.7)` | Fließtext |
| Deep Purple/Blue | `#3308A6` | Verlaufsanteil |

### Grafische Signatur
- **Doppel-Chevron `»`** als Marken-Icon (SVG-Path, rot oder cyan) — vor fast jeder Headline und in jedem Button.
- **Light-Source-PNGs** (blau / cyan / rot) als riesige weiche Farbverläufe, die von den Seitenrändern in die dunkle Fläche leuchten. Erzeugen die „Neon-Garage"-Stimmung. → In der Neuauflage besser als CSS-Gradients/Blur nachbauen (Performance, Schärfe).
- Logo-Wortmarke: kursive, geschnittene Slab-Type (eigene SVG, `schwarz-motorized-logo-white-rgb.svg`).
- Footer: vollflächig **rot** — starker Kontrastblock am Ende.

---

## 2. Seitenstruktur Startseite (Ist-Zustand, 13 Sections)

| # | Section | Inhalt |
|---|---|---|
| 01 | **Header** | Logo mittig, „» KONTAKT" (rot) + Burger rechts. Off-Canvas-Menü: Home / Pre-Owned & Demo Bikes / Racing + „Werkstatttermin buchen" (extern: osb.motiondata-vector.com) + Öffnungszeiten + Adresse |
| 02 | **Hero** | H1 „WE ARE **RACERS**" über Bild, darunter „FROM **STREET** » TO **TRACK**". Bild: Hero-Website (Neon-Showroom, 2 Aprilia RSV4) |
| 03 | **Intro** | H2 „WE ARE DEDICATED TO RIDING BIKES" + 2 Absätze Positionierungstext |
| 04 | **Partner-Marquee** | „» OFFICIAL PARTNER OF" + Logos: Aprilia, Moto Morini, VENT, SYM, UM Motors (Endlos-Slider, 2 identische PNG-Streifen) |
| 05 | **What We Offer** | Intro-Text + 4 Karten: Offizieller Aprilia Händler / ECU Flash by ROM Racing / Rennstrecken Umbau / Motorradservice für alle Marken |
| 06 | **Motorrad ausleihen** | Bild + Text + CTA „» MOTORRAD MIETEN" (Mietkosten werden beim Kauf gutgeschrieben) |
| 07 | **The Difference We Make** | 3 Spalten 01/02/03 mit Icons: Leidenschaftliche Motorradfahrer / Rundum-sorglos-Paket / Immer bereit + CTA „» TERMIN BUCHEN" |
| 08 | **Current Offers** | 2 Angebots-Karten: Aprilia Tuono V4 1100 Factory „Cool Deal Aktion" ab € 21.490,- · Aprilia Tuareg 660 „Anmeldeaktion" ab € 12.490,- + CTA „Probefahrt vereinbaren" |
| 09 | **What They Say** | Testimonial-Slider, 6 Reviews (Google/Facebook), Karten abwechselnd cyan / dunkel, jeweils mit Avatar, Name, „fährt: <Modell>" |
| 10 | **Get In Contact** | Riesige Headline + roter CTA „» JETZT KONTAKTIEREN" |
| 11 | **Our Great Team** | 4 Portraits: Ing. Thomas Schwarz (GF, Verkauf) · Christoph Halbauer (Reparaturannahme) · Roland Strobl (Mechaniker) · Max Barwik (Mechaniker) |
| 12 | **Still Some Questions?** | FAQ-Akkordeon, 13 Fragen (SEO-getrieben, Volltexte in `_source/page.html` als FAQ-JSON-LD) |
| 13 | **Footer** | Roter Block: Logo, Öffnungszeiten Mo–Fr 7:30–12:00 / 13:00–17:30, Adresse, Impressum/AGB/Datenschutz/Cookies, „» KONTAKT", „designed with love ❤ by outlize®" |

### Weitere Seiten
- `/racing/` — Hero „RACING" + Trackday-Foto · „DEIN RENNBIKE / DEIN SETUP / DEIN VORSPRUNG" · „WARUM RACING BEI SCHWARZ MOTORIZED?" · 3-Spalten 01/02/03 „DEIN RACEBIKE INDIVIDUELL" · CTAs
- `/gebrauchte-bikes/` — „PRE-OWNED & DEMO BIKES", Bike-Listen-Karten (Bild links, Modell + Baujahr/km + Preis rechts)
- `/motorraeder/…` — Einzel-Bike-Detailseiten (CPT)
- Rechtliches: /impressum/, /agb/, /datenschutz/, /cookie-policy-eu/

---

## 3. Was heute schwach ist (Redesign-Ansatzpunkte)

**Struktur & Rhythmus**
- Sehr lang (≈13.000 px Desktop) bei relativ wenig Substanz — viel Leerraum ohne Spannung, Sections „stapeln" statt zu erzählen.
- Kein klarer Conversion-Pfad: „Kontakt", „Termin buchen", „Motorrad mieten", „Probefahrt vereinbaren" konkurrieren, ohne Hierarchie.
- Hero verschenkt den stärksten Moment: Headline sitzt halb über dem Bild, das Bild ist ein statischer Showroom-Schnappschuss.

**Typografie**
- Antonio in nur einer Größenlogik (riesig / normal) — keine Mittelstufen, kein Rhythmus. Body (Inter 12–16px) ist zu klein und zu grau gegen die XXL-Headlines.
- Englische Section-Titles („WHAT WE OFFER", „WHAT THEY SAY") vs. deutscher Fließtext — inkonsistent, aber markentypisch; als bewusstes System nutzbar.

**Farbe & Licht**
- Die Light-Source-PNGs wirken fleckig und wiederholen sich (dieselben 3 Dateien 10×), teils sichtbare Kanten.
- Cyan-Testimonial-Karten sind ein harter, unmotivierter Farbbruch.
- Rot/Cyan werden nicht systematisch eingesetzt (mal Akzent, mal Fläche).

**Bilder**
- Sehr gemischte Qualität: `Service-2` ist ein **Screenshot einer ECU-Software** (Excel-artig), `Service-4` ein Werkstatt-Schnappschuss. Service-Bilder nur 505×641 px.
- Teamfotos sind okay, aber unterschiedlich in Licht/Hintergrund.
- Es fehlen echte „Hero"-Momente: Bike-Details, Werkstatt-Handwerk, Rennstrecke.

**Technik / Detail**
- Elementor-Overhead, Cookie-Banner überlagert Content.
- FAQ mit 13 Fragen ungefiltert am Stück — ermüdend.
- Doppel-Chevron ist eine gute Marken-Idee, wird aber inflationär verwendet.

---

## 4. Assets (heruntergeladen)

`_source/img/` (Originale) · `assets/img/` (Arbeitskopien) · `assets/logo/schwarz-motorized-logo-white-rgb.svg`

**Brauchbar:** `Hero-Website` (Neon-Showroom, 1762×1920) · `2025_02_CD1_24-141-34-scaled.jpg` (Wheelie auf der Rennstrecke) · `Service-1/-3` (Bike im Showroom, Carbon-Verkleidung) · `Motorrad-verleih` (Herbst-Tour) · 4 Teamportraits · `Current-Offer-1/-2` (Tuono, Tuareg) · `2024_04_Frame-7` / `Rs125` (freigestellte Bikes) · `2025_09/2026_07 Frontphoto`, `2026_08 Frontpic` (Gebrauchtbike-Fotos) · Partner-Logostreifen `Slide-1/2`
**Ersetzen / neu generieren:** `Service-2` (ECU-Screenshot) · `Service-4` (Werkstatt-Schnappschuss) · die 3 `light-source`-PNGs (→ CSS)

`_source/screens/` — Full-Page-Screenshots Desktop (`fullpage.png` + `part-01…09`), Mobile, `/racing/`, `/gebrauchte-bikes/`, `contact-sheet.png`
`_source/page.html`, `page-racing.html`, `page-gebrauchte-bikes.html` — Original-Markup inkl. aller FAQ-Volltexte

---

## 5. Setup

- **Bildgenerierung:** OpenAI `gpt-image-1`, Key aus `Design Test/openai_key.rtf` — verifiziert, funktioniert.
- **Preview-Server:** `.claude/launch.json` → `motorized-preview` auf Port **4330**.
- **Webflow-Tauglichkeit:** Antonio + Inter sind Google Fonts (nativ in Webflow). Jede Section wird als eigenständiger, in sich geschlossener Block gebaut (eigene BEM-Klassen, keine globalen Abhängigkeiten), damit sie 1:1 nach Webflow übertragen werden kann.

#!/usr/bin/env python3
"""Erzeugt die HTML-Seiten mit identischem Header/Footer.

Die Website braucht dieses Skript NICHT — im Repo liegt fertiges HTML,
GitHub Pages liefert es direkt aus. Das Skript ist nur dann nützlich, wenn du
etwas änderst, das auf ALLEN Seiten gleich ist: Navigation, Footer, Meta-Tags.

    python3 tools/rebuild.py

Achtung: Es überschreibt alle Seiten. Änderst du den Inhalt der Startseite
direkt in index.html, sichere ihn vorher nach tools/home-main.html
(nur der Teil zwischen <main> und </main>)."""
import json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.dirname(os.path.abspath(__file__))
SITE = "https://motorized.at"
BOOKING = ("https://osb.motiondata-vector.com/"
           "?d=aK4R5zkrGzP73AP9STMjSadQmMsnCELL6D8Gy8GXPQxZPafxBL")

CHEV = '<svg class="chev" aria-hidden="true"><use href="#i-chev"/></svg>'


def rel(depth, path):
    """Pfad relativ zur Seitentiefe — funktioniert auch unter file:// und in Unterordnern."""
    if path.startswith("#"):
        return path if depth == 0 else "../" + path
    prefix = "../" * depth
    return prefix + path if path else prefix or "./"


NAV = [
    ("Leistungen", "#leistungen"),
    ("Racing",     "racing/"),
    ("Bikes",      "bikes/"),
    ("Kontakt",    "#kontakt"),
]


def head(depth, title, desc, canonical, og_type="website"):
    r = lambda p: rel(depth, p)
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{SITE}{canonical}">

<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Schwarz Motorized">
<meta property="og:locale" content="de_AT">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{SITE}{canonical}">
<meta property="og:image" content="{SITE}/assets/icons/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#05050b">

<link rel="icon" href="{r('assets/icons/favicon.png')}">
<link rel="apple-touch-icon" href="{r('assets/icons/favicon.png')}">

<script>
/* Reveal-Animationen nur aktivieren, wenn das Skript auch wirklich startet.
   Bleibt main.js aus (404, Fehler, Blocker), wird die Klasse wieder entfernt
   und die Seite ist ganz normal sichtbar. */
document.documentElement.classList.add("js");
setTimeout(function(){{ if(!window.__smInit) document.documentElement.classList.remove("js"); }}, 3000);
</script>

<link rel="preload" href="{r('fonts/antonio-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{r('fonts/inter-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{r('css/fonts.css')}">
<link rel="stylesheet" href="{r('css/style.css')}">
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="i-chev" viewBox="0 0 217 217">
    <path d="M0 217L74.082 108.5L0 0H44.6104L118.692 108.5L44.6104 217H0ZM98.3076 217L172.39 108.5L98.3076 0H142.918L217 108.5L142.918 217H98.3076Z"/>
  </symbol>
</svg>

<div class="grain" aria-hidden="true"></div>
<a class="skip" href="#main">Zum Inhalt springen</a>
"""


def header(depth, active=None):
    r = lambda p: rel(depth, p)
    links, mlinks = [], []
    for label, href in NAV:
        cur = ' aria-current="page"' if label == active else ""
        links.append(f'<a class="hdr__link" href="{r(href)}"{cur}>{label}</a>')
        mlinks.append(f'<a class="mnav__item" href="{r(href)}"{cur}>{label}</a>')
    home = r("") if depth else "#top"
    return f"""
<header class="hdr" id="hdr">
  <div class="wrap hdr__in">
    <a class="hdr__logo" href="{home}" aria-label="Schwarz Motorized — Startseite">
      <img src="{r('assets/logo/schwarz-motorized-logo-white-rgb.svg')}" alt="Schwarz Motorized" width="300" height="58">
    </a>

    <nav class="hdr__nav" aria-label="Hauptmenü">
      {chr(10).join('      ' + x for x in links).strip()}
    </nav>

    <a class="hdr__tel" href="tel:+43217380060">+43 2173 80060</a>

    <div class="hdr__cta">
      <a class="btn" href="{BOOKING}" target="_blank" rel="noopener">
        {CHEV}Termin buchen
      </a>
    </div>

    <button class="hdr__burger" id="burger" aria-label="Menü öffnen" aria-expanded="false" aria-controls="mnav">
      <span></span>
    </button>
  </div>
</header>

<div class="mnav" id="mnav">
  <nav aria-label="Mobiles Menü">
    <a class="mnav__item" href="{home}">Startseite</a>
    {chr(10).join('    ' + x for x in mlinks).strip()}
  </nav>
  <div class="mnav__foot">
    <a class="btn" href="{BOOKING}" target="_blank" rel="noopener">
      {CHEV}Werkstatttermin buchen
    </a>
    <a class="tlink" href="tel:+43217380060">+43 2173 80060</a>
    <a class="tlink" href="mailto:schwarz@motorized.at">schwarz@motorized.at</a>
  </div>
</div>
"""


def footer(depth):
    r = lambda p: rel(depth, p)
    home = r("") if depth else "#top"
    return f"""
<footer class="ft">
  <div class="wrap ft__in">
    <div class="ft__top">
      <a class="ft__logo" href="{home}" aria-label="Schwarz Motorized — Startseite">
        <img src="{r('assets/logo/schwarz-motorized-logo-white-rgb.svg')}" alt="Schwarz Motorized" width="300" height="58" loading="lazy">
      </a>
      <div class="ft__mid">
        <b>Autohaus Schwarz e.U.</b>
        <a href="https://maps.app.goo.gl/D2jVzh5HcYnCtnNU9" target="_blank" rel="noopener">Betriebsgebiet Nord 4, 7123 Mönchhof, Burgenland</a><br>
        <a class="num" href="tel:+43217380060">+43 2173 80060</a> &nbsp;·&nbsp;
        <a href="mailto:schwarz@motorized.at">schwarz@motorized.at</a>
      </div>
      <div class="ft__cta">
        <a class="btn" href="{BOOKING}" target="_blank" rel="noopener">
          {CHEV}Termin buchen
        </a>
      </div>
    </div>

    <div class="ft__bot">
      <nav class="ft__links" aria-label="Rechtliches">
        <a href="{r('impressum/')}">Impressum</a>
        <a href="{r('agb/')}">AGB</a>
        <a href="{r('datenschutz/')}">Datenschutz</a>
      </nav>
      <span class="ft__cr">© <span class="num">2026</span> Autohaus Schwarz e.U.</span>
      <span class="ft__by">designed with love by <b>outlize®</b></span>
    </div>
  </div>
</footer>

<script src="{rel(depth, 'js/main.js')}" defer></script>
</body>
</html>
"""


def crumbs(depth, label):
    r = lambda p: rel(depth, p)
    return f"""<nav class="crumbs" aria-label="Brotkrumen">
        <a href="{r('')}">Startseite</a>{CHEV}<span aria-current="page">{label}</span>
      </nav>"""


def page(depth, *, title, desc, canonical, active, body, og_type="website"):
    return head(depth, title, desc, canonical, og_type) + header(depth, active) \
        + '\n<main id="main">\n' + body + '\n</main>\n' + footer(depth)


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8").write(content)
    print(f"  {path:28} {len(content)//1024} KB")


# ---------------------------------------------------------------- Startseite
def build_home():
    src = open(os.path.join(PARTS, "home-main.html"), encoding="utf-8").read()
    write("index.html", page(
        0,
        title="Schwarz Motorized — Aprilia Händler & Racing Performance Center | Mönchhof",
        desc=("Offizieller Aprilia Händler im Burgenland. Service für alle Marken, ECU Flash "
              "by ROM Racing exklusiv in Österreich und kompromisslose Rennstreckenumbauten."),
        canonical="/", active=None, body=src))


# -------------------------------------------------------------------- Racing
def build_racing():
    r = lambda p: rel(1, p)
    reasons = [
        ("Perfekte Abstimmung",
         "Wir optimieren jedes Detail — von Fahrwerk und Bremsen bis zur Motorsteuerung — "
         "auf deine Strecke, deinen Fahrstil und dein Ziel."),
        ("Alles aus einer Hand",
         "Vom Kauf über den kompletten Umbau bis zum Racing-Service. Du bekommst nicht nur "
         "ein Bike, sondern ein startklares Paket."),
        ("Erfahrung von der Strecke",
         "Wir fahren selbst unter der Startnummer 141. Was wir an deinem Bike machen, haben "
         "wir vorher selbst gebraucht."),
    ]
    cards = "\n".join(f"""      <article class="why__i" data-rv style="--rv-d:{i*100}ms">
        <h3 class="why__t">{t}</h3>
        <p class="why__d">{d}</p>
      </article>""" for i, (t, d) in enumerate(reasons))

    body = f"""
<section class="phero phero--media">
  <div class="phero__media">
    <img src="{r('assets/web/racing-hero.jpg')}" alt="Rennmotorrad von Schwarz Motorized mit Startnummer 141 im Wheelie auf der Rennstrecke" fetchpriority="high">
  </div>
  <div class="phero__scrim" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(1, 'Racing')}
    <h1 class="phero__h">Dein Rennbike.<br>Dein Setup.<br><em>Dein Vorsprung.</em></h1>
    <p class="lead phero__lead">
      Vom kompromisslosen Superbike bis zum effizienten Trainingsgerät — wir entwickeln
      dein Rennmotorrad exakt nach deinem Anspruch.
    </p>
    <div class="phero__acts">
      <a class="btn" href="{r('#kontakt')}">{CHEV}Racing-Beratung sichern</a>
      <a class="btn btn--ghost" href="{r('bikes/')}">Bikes ansehen</a>
    </div>
  </div>
</section>

<section class="sec manifest">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    <p class="idx">{CHEV}Warum racing</p>
    <div class="manifest__grid">
      <h2 class="manifest__h" data-rv>Wir verkaufen keine Motorräder.<br>Wir bauen <em>Rennmaschinen.</em></h2>
      <div class="manifest__copy" data-rv style="--rv-d:120ms">
        <p>Jedes Bike entsteht mit einem klaren Ziel: maximale Performance, perfekte
           Abstimmung und absolute Zuverlässigkeit auf der Rennstrecke.</p>
        <p>Ob Profi oder ambitionierter Einsteiger — wir holen dich genau dort ab, wo du stehst.
           Und wir sagen dir ehrlich, was dein Bike braucht und was nicht.</p>
      </div>
    </div>

    <ul class="stats" data-rv style="--rv-d:200ms">
      <li class="stats__i"><span class="stats__k">RSV4</span><span class="stats__v">Unser Spezialgebiet — Performance, Fahrwerk, Elektronik</span></li>
      <li class="stats__i"><span class="stats__k">RS 660</span><span class="stats__v">Ideal für den Einstieg auf die Rennstrecke</span></li>
      <li class="stats__i"><span class="stats__k">Tuono V4</span><span class="stats__v">Naked Bike mit Superbike-Genen</span></li>
      <li class="stats__i"><span class="stats__k num">#141</span><span class="stats__v">Unsere eigene Startnummer</span></li>
    </ul>
  </div>
</section>

<section class="sec svc">
  <div class="wrap">
    <p class="idx">{CHEV}Was wir aufbauen</p>
    <div class="svc__head">
      <h2 class="svc__h" data-rv>Von der Schraube<br>bis zum Kennfeld.</h2>
      <p class="lead" data-rv style="--rv-d:120ms">
        Ein Rennstreckenumbau ist kein Zubehörkatalog. Wir stimmen die Komponenten
        aufeinander ab — sonst arbeitet das Bike gegen dich.
      </p>
    </div>

    <div class="svc__list" id="svcList">
      <div class="svc__peek" id="svcPeek" aria-hidden="true"><img alt="" id="svcPeekImg"></div>

      <a class="svc__row" href="{r('#kontakt')}" data-img="{r('assets/web/svc-race.jpg')}" data-rv>
        <div class="svc__in">
          <h3 class="svc__t">Fahrwerk &amp; Bremsen</h3>
          <p class="svc__d">Federelemente, Geometrie, Bremsanlage und Beläge — abgestimmt auf dein Gewicht, dein Tempo und deine Strecke.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-race.jpg')}" alt="Aprilia RSV4 Factory mit Carbon-Rennverkleidung" loading="lazy"></div>
      </a>

      <a class="svc__row" href="{r('#kontakt')}" data-img="{r('assets/web/svc-ecu.jpg')}" data-rv style="--rv-d:80ms">
        <div class="svc__in">
          <h3 class="svc__t">ECU Flash by ROM Racing</h3>
          <p class="svc__d">Individuelle Abstimmung der Motorsteuerung für alle V4- und 660er-Modelle. Exklusiv in Österreich bei uns.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-ecu.jpg')}" alt="Laptop mit Kennfeld-Tabellen, per Diagnosekabel mit einem Motorrad verbunden" loading="lazy"></div>
      </a>

      <a class="svc__row" href="{r('#kontakt')}" data-img="{r('assets/web/carbon.jpg')}" data-rv style="--rv-d:160ms">
        <div class="svc__in">
          <h3 class="svc__t">Verkleidung &amp; Ergonomie</h3>
          <p class="svc__d">Rennverkleidung, Sitzposition, Rasten und Lenker. Damit du auf der Strecke arbeiten kannst statt zu kämpfen.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/carbon.jpg')}" alt="Carbon-Verkleidungsteil mit Sicherungsdraht und Werkzeug auf der Werkbank" loading="lazy"></div>
      </a>

      <a class="svc__row" href="{r('#kontakt')}" data-img="{r('assets/web/svc-service.jpg')}" data-rv style="--rv-d:240ms">
        <div class="svc__in">
          <h3 class="svc__t">Racing-Service</h3>
          <p class="svc__d">Wir berücksichtigen Verschleiß, Einsatzbedingungen und bei Aprilia die erfassten Stresskilometer — Ventilservice und Revision werden geplant, nicht abgewartet.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-service.jpg')}" alt="Hände mit Drehmomentschlüssel an der Hinterradaufhängung eines Sportmotorrads" loading="lazy"></div>
      </a>
    </div>
  </div>
</section>

<section class="sec why">
  <div class="glow glow--cool glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    <p class="idx">{CHEV}Dein Racebike individuell</p>
    <div class="why__head"><h2 class="why__h" data-rv>Was du bei uns bekommst.</h2></div>
    <div class="why__grid">
{cards}
    </div>
    <div class="why__acts" data-rv>
      <a class="btn" href="{r('#kontakt')}">{CHEV}Beratungstermin vereinbaren</a>
    </div>
  </div>
</section>
"""
    write("racing/index.html", page(
        1,
        title="Racing & Rennstreckenumbau — Schwarz Motorized",
        desc=("Rennstreckenumbauten für Aprilia RSV4, RS 660 und Tuono V4. Fahrwerk, Bremsen, "
              "Ergonomie und ECU Flash by ROM Racing — exklusiv in Österreich."),
        canonical="/racing/", active="Racing", body=body))


# --------------------------------------------------------------------- Bikes
def build_bikes():
    r = lambda p: rel(1, p)
    bikes = [
        ("Moto Guzzi V9 Bobber",             "05/2025", "1.300 km",  "€ 7.790,–",  "bike-guzzi-v9.jpg",   "Moto Guzzi V9 Bobber in Mattschwarz"),
        ("BMW M 1000 R",                     "2024",    "8.718 km",  "€ 22.990,–", "bike-bmw-m1000r.jpg", "BMW M 1000 R in M-Lackierung"),
        ("Aprilia Tuono V4 1100 E5+",        "03/2026", "1.440 km",  "€ 23.590,–", "bike-tuono-e5.jpg",   "Aprilia Tuono V4 1100 E5+"),
        ("Aprilia RSV4 1100 Factory E5",     "04/2022", "5.783 km",  "€ 22.590,–", "bike-rsv4-e5.jpg",    "Aprilia RSV4 1100 Factory E5"),
        ("Aprilia Tuono V4 1100",            "2023",    "24.423 km", "€ 18.900,–", "bike-tuono-2023.jpg", "Aprilia Tuono V4 1100"),
        ("Aprilia Tuono V4 Factory 1100 E4", "05/2021", "16.928 km", "€ 14.590,–", "bike-tuono-e4.jpg",   "Aprilia Tuono V4 Factory 1100 E4"),
        ("Aprilia RS 125",                   "2024",    "1.731 km",  "€ 7.200,–",  "bike-rs125.jpg",      "Aprilia RS 125"),
    ]
    rows = "\n".join(f"""      <article class="bike" data-rv style="--rv-d:{min(i,5)*70}ms">
        <div class="bike__media">
          <img src="{r('assets/web/' + img)}" alt="{alt}" loading="lazy">
          <span class="bike__flag">Gebraucht</span>
        </div>
        <div>
          <h2 class="bike__t">{name}</h2>
          <p class="bike__meta num"><span>Baujahr {bj}</span><span>{km}</span></p>
        </div>
        <p class="bike__price num">{price}</p>
      </article>""" for i, (name, bj, km, price, img, alt) in enumerate(bikes))

    body = f"""
<section class="phero">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(1, 'Pre-Owned &amp; Demo Bikes')}
    <h1 class="phero__h">Pre-Owned &amp;<br><em>Demo Bikes</em></h1>
    <p class="lead phero__lead">
      Gepflegte Gebrauchte und unsere eigenen Vorführer — alle aus dem Haus,
      alle mit bekannter Geschichte. Probefahrt nach Terminvereinbarung.
    </p>
    <div class="phero__acts">
      <a class="btn" href="{r('#kontakt')}">{CHEV}Probefahrt vereinbaren</a>
      <a class="btn btn--ghost" href="tel:+43217380060">Kurz anrufen</a>
    </div>
  </div>
</section>

<section class="sec sec--flush-t">
  <div class="wrap">
    <div class="bikes__grid">
{rows}
    </div>
    <p class="bikes__note">
      Alle Preise inkl. USt., Stand der Veröffentlichung. Verfügbarkeit auf Anfrage —
      ruf kurz an oder schreib uns, dann sagen wir dir sofort, ob das Bike noch da ist.
      Sonderausstattung teilweise gegen Aufpreis, Irrtümer vorbehalten.
    </p>
  </div>
</section>

<section class="rent">
  <div class="rent__grid">
    <div class="rent__media">
      <img src="{r('assets/web/mieten.jpg')}" alt="Motorradfahrer auf einer Landstraße im Herbstlicht" loading="lazy">
    </div>
    <div class="rent__body">
      <p class="idx">{CHEV}Try before you buy</p>
      <h2 class="rent__h" data-rv>Erst fahren.<br><em>Dann entscheiden.</em></h2>
      <p class="lead" data-rv style="--rv-d:100ms">
        Eine Probefahrt dauert eine halbe Stunde. Ein Motorradkauf begleitet dich Jahre.
        Deshalb kannst du dir unseren Vorführer für ein paar Tage mieten.
      </p>
      <p class="rent__hook" data-rv style="--rv-d:160ms">
        {CHEV}
        <span>Kaufst du das Bike danach, rechnen wir dir die komplette Miete auf den Kaufpreis an.</span>
      </p>
      <div class="rent__acts" data-rv style="--rv-d:220ms">
        <a class="btn btn--cyan" href="{r('#kontakt')}">{CHEV}Motorrad mieten</a>
      </div>
    </div>
  </div>
</section>
"""
    write("bikes/index.html", page(
        1,
        title="Pre-Owned & Demo Bikes — Schwarz Motorized",
        desc=("Gebrauchte Motorräder und Vorführer bei Schwarz Motorized in Mönchhof: "
              "Aprilia, Moto Guzzi, BMW. Mit Baujahr, Kilometerstand und Preis."),
        canonical="/bikes/", active="Bikes", body=body))


# ------------------------------------------------------------ Rechtsseiten
def render_nodes(nodes, skip_first_h1=True):
    out, first = [], True
    for kind, val in nodes:
        if kind.startswith("h"):
            if first and skip_first_h1:
                first = False
                continue
            first = False
            lvl = "h2" if kind in ("h1", "h2") else "h3"
            out.append(f"      <{lvl}>{html.escape(val)}</{lvl}>")
        elif kind == "p":
            out.append(f"      <p>{val}</p>")
        else:
            items = "".join(f"<li>{html.escape(x)}</li>" for x in val)
            out.append(f"      <{kind}>{items}</{kind}>")
    return "\n".join(out)


LEGAL_NOTE = {
    "datenschutz": ("Diese Datenschutzerklärung stammt noch von der bisherigen WordPress-Seite "
                    "und beschreibt Dienste, die es hier nicht mehr gibt. Die neue Seite setzt "
                    "keine Cookies, bindet keine externen Schriften ein und verwendet kein "
                    "Tracking. Der Text muss vor dem Livegang überarbeitet werden."),
    "agb":         ("Übernommen von der bisherigen Seite. Bitte vor dem Livegang rechtlich "
                    "prüfen lassen."),
}


PROSE_LINKS = {
    "https://www.motorized.at/agb": "../agb/",
    "https://motorized.at/agb/": "../agb/",
    "https://motorized.at/datenschutz/": "../datenschutz/",
    "https://motorized.at/impressum/": "../impressum/",
}


def fix_prose_links(markup):
    """Interne Links relativ, externe Links sicher öffnen."""
    for a, b in PROSE_LINKS.items():
        markup = markup.replace(f'href="{a}"', f'href="{b}"')
        markup = markup.replace(f'href="{a}/"', f'href="{b}"')
    return re.sub(r'<a href="(https?://[^"]+)"(?![^>]*target)',
                  r'<a href="" target="_blank" rel="noopener noreferrer"', markup)


def build_legal(slug, title, h1, desc):
    nodes = json.load(open(os.path.join(PARTS, f"legal-{slug}.json"), encoding="utf-8"))
    note = ""
    if slug in LEGAL_NOTE:
        note = f"""    <p class="legal-note">{CHEV}<span>{LEGAL_NOTE[slug]}</span></p>\n"""
    body = f"""
<section class="phero">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(1, h1)}
    <h1 class="phero__h">{h1}</h1>
  </div>
</section>

<section class="sec sec--flush-t">
  <div class="wrap">
{note}    <div class="prose">
{fix_prose_links(render_nodes(nodes))}
    </div>
  </div>
</section>
"""
    write(f"{slug}/index.html", page(
        1, title=title, desc=desc, canonical=f"/{slug}/", active=None, body=body))


# ----------------------------------------------------------------------- 404
def build_404():
    r = lambda p: rel(0, p)
    body = f"""
<section class="nf">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap">
    <p class="nf__code num">404</p>
    <h1 class="nf__h">Falsche Abzweigung.</h1>
    <p class="lead">
      Diese Seite gibt es nicht (mehr). Kein Drama — hier geht's zurück auf die Strecke.
    </p>
    <div class="nf__acts">
      <a class="btn" href="{r('')}">{CHEV}Zur Startseite</a>
      <a class="btn btn--ghost" href="tel:+43217380060">+43 2173 80060</a>
    </div>
    <nav class="nf__links" aria-label="Weiterführende Links">
      <a href="{r('racing/')}">{CHEV}Racing &amp; Rennstreckenumbau</a>
      <a href="{r('bikes/')}">{CHEV}Pre-Owned &amp; Demo Bikes</a>
      <a href="{r('#leistungen')}">{CHEV}Unsere Leistungen</a>
      <a href="{r('#kontakt')}">{CHEV}Kontakt &amp; Öffnungszeiten</a>
    </nav>
  </div>
</section>
"""
    write("404.html", page(
        0, title="Seite nicht gefunden — Schwarz Motorized",
        desc="Diese Seite existiert nicht. Zurück zur Startseite von Schwarz Motorized.",
        canonical="/404.html", active=None, body=body))


if __name__ == "__main__":
    print("Baue Seiten:")
    build_home()
    build_racing()
    build_bikes()
    build_legal("impressum", "Impressum — Schwarz Motorized", "Impressum",
                "Impressum und Offenlegung nach §25 MedienG — Autohaus Schwarz e.U., Mönchhof.")
    build_legal("datenschutz", "Datenschutz — Schwarz Motorized", "Datenschutz",
                "Datenschutzerklärung von Autohaus Schwarz e.U.")
    build_legal("agb", "AGB — Schwarz Motorized", "AGB",
                "Allgemeine Geschäftsbedingungen von Autohaus Schwarz e.U.")
    build_404()
    print("fertig.")

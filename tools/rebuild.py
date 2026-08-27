#!/usr/bin/env python3
"""Baut alle HTML-Seiten aus den Inhalten in content/.

    python3 tools/rebuild.py

Die Website selbst braucht kein Python — im Repo liegt fertiges HTML und
GitHub Pages liefert es direkt aus. Dieses Skript läuft nur, wenn sich Inhalte
ändern: lokal von Hand oder automatisch über die GitHub Action, sobald das CMS
etwas in content/ speichert.

Aus content/ (und damit im CMS änderbar):
  settings.json      Adresse, Telefon, Öffnungszeiten, Buchungslink
  services.json      die vier Leistungen auf der Startseite
  bikes.json         Angebote und Gebrauchtbikes inkl. Detailseiten
  team.json          Team
  faq.json           FAQ in Gruppen
  testimonials.json  Rezensionen
  tracking.json      GTM- und Pixel-ID (greifen erst nach Cookie-Zustimmung)

Der Fließtext der Startseite liegt in tools/home-main.html, die Rechtstexte
in tools/legal-*.json.
"""
import hashlib
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.join(ROOT, "tools")
CONTENT = os.path.join(ROOT, "content")

def stamp(relpath):
    """Kurzer Fingerabdruck einer Datei. Haengt als ?v=… an CSS und JS, damit
    Browser nach einer Aenderung garantiert die neue Fassung laden und nicht
    tagelang die alte aus dem Zwischenspeicher zeigen."""
    f = os.path.join(ROOT, relpath)
    try:
        with open(f, "rb") as fh:
            return hashlib.sha1(fh.read()).hexdigest()[:8]
    except OSError:
        return "0"


CHEV = '<svg class="chev" aria-hidden="true"><use href="#i-chev"/></svg>'


def load(name):
    with open(os.path.join(CONTENT, name), encoding="utf-8") as f:
        return json.load(f)


S = load("settings.json")
TRACK = load("tracking.json")
SEO = load("seo.json")
# Basisadresse der Seite. Für eine Vorschau unter github.io hier die
# Vorschau-Adresse eintragen, damit Link-Vorschauen und canonical stimmen.
SITE = S.get("site_url", "https://motorized.at").rstrip("/")
# Vorschau-Modus: haelt die Seite komplett aus Google raus.
NOINDEX = bool(S.get("noindex"))
BOOKING = S["buchung_url"]
TEL = S["telefon_link"]
MAIL = S["email"]


def rel(depth, path):
    if path == "BUCHUNG":
        return BOOKING
    if path.startswith(("http", "mailto:", "tel:")):
        return path
    if path.startswith("#"):
        return path if depth == 0 else "../" * depth + path
    return "../" * depth + path if path else ("../" * depth or "./")


def esc(t):
    return html.escape(str(t), quote=False)


NAV = [
    ("Leistungen", "#leistungen"),
    ("Racing", "racing/"),
    ("Bikes", "bikes/"),
    ("Kontakt", "#kontakt"),
]


# ============================================================== Seitengerüst
def head(depth, title, desc, canonical, noindex=False, og_image=None):
    r = lambda p: rel(depth, p)
    base = "../" * depth
    tcfg = json.dumps({
        "gtm_id": TRACK.get("gtm_id", ""),
        "facebook_pixel_id": TRACK.get("facebook_pixel_id", ""),
        "aktiv": bool(TRACK.get("aktiv")),
    }, ensure_ascii=False)
    robots = ('<meta name="robots" content="noindex, nofollow">\n'
              if (noindex or NOINDEX) else "")
    std = SEO.get("og_bild_standard") or ""
    pick = og_image or std
    og = (SITE + "/assets/web/" + pick) if pick else (SITE + "/assets/icons/og.jpg")
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
{robots}<link rel="canonical" href="{SITE}{canonical}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Schwarz Motorized">
<meta property="og:locale" content="de_AT">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{SITE}{canonical}">
<meta property="og:image" content="{og}">
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
window.SM_TRACKING = {tcfg};
window.SM_BASE = "{base}";
</script>

<link rel="preload" href="{r('fonts/antonio-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{r('fonts/inter-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{r('css/fonts.css')}?v={stamp("css/fonts.css")}">
<link rel="stylesheet" href="{r('css/style.css')}?v={stamp("css/style.css")}">
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

    <a class="hdr__tel" href="tel:{TEL}">{S['telefon']}</a>

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
    <a class="tlink" href="tel:{TEL}">{S['telefon']}</a>
    <a class="tlink" href="mailto:{MAIL}">{MAIL}</a>
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
        <b>{esc(S['firma'])}</b>
        <a href="{S['maps_url']}" target="_blank" rel="noopener">{esc(S['strasse'])}, {esc(S['plz_ort'])}, {esc(S['region'])}</a><br>
        <a class="num" href="tel:{TEL}">{S['telefon']}</a> &nbsp;·&nbsp;
        <a href="mailto:{MAIL}">{MAIL}</a>
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
        <a href="{r('cookies/')}">Cookies</a>
        <a href="#" data-cookie-settings>Cookie-Einstellungen</a>
      </nav>
      <span class="ft__cr">© <span class="num">2026</span> {esc(S['firma'])}</span>
      <span class="ft__by">designed with love by <b>outlize®</b></span>
    </div>
  </div>
</footer>

<script src="{rel(depth, 'js/main.js')}?v={stamp('js/main.js')}" defer></script>
<script src="{rel(depth, 'js/consent.js')}?v={stamp('js/consent.js')}" defer></script>
</body>
</html>
"""


def seo_meta(key, fallback_title, fallback_desc):
    """Titel, Beschreibung und Teilbild aus seo.json — mit Rückfallwerten."""
    e = SEO.get("seiten", {}).get(key, {})
    return (e.get("titel") or fallback_title,
            e.get("beschreibung") or fallback_desc,
            e.get("og_bild") or "")


def crumbs(depth, label):
    return (f'<nav class="crumbs" aria-label="Brotkrumen">\n'
            f'        <a href="{rel(depth, "")}">Startseite</a>{CHEV}'
            f'<span aria-current="page">{label}</span>\n      </nav>')


def page(depth, *, title, desc, canonical, active, body, noindex=False, og_image=None):
    return (head(depth, title, desc, canonical, noindex, og_image) + header(depth, active)
            + '\n<main id="main">\n' + body + '\n</main>\n' + footer(depth))


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  {path:36} {len(content)//1024:>3} KB")


# ================================================= wiederverwendete Bausteine
def services_block(depth):
    r = lambda p: rel(depth, p)
    rows = []
    for i, s in enumerate(load("services.json")):
        img = r("assets/web/" + s["bild"])
        link = rel(depth, s.get("link") or "#kontakt")
        ext = ' target="_blank" rel="noopener"' if link.startswith("http") else ""
        rows.append(f"""      <a class="svc__row" href="{link}"{ext} data-img="{img}" data-rv style="--rv-d:{i*80}ms">
        <div class="svc__in">
          <h3 class="svc__t">{esc(s['titel'])}</h3>
          <p class="svc__d">{esc(s['text'])}</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{img}" alt="{esc(s.get('bild_alt',''))}" loading="lazy"></div>
      </a>""")
    return "\n".join(rows)


def testimonials_block(depth=0):
    r = lambda p: rel(depth, p)
    cards = []
    for i, t in enumerate(load("testimonials.json")):
        hi = " say--hi" if t.get("hervorheben") else ""
        text = f'\n        <p class="say__b">{esc(t["text"])}</p>' if t.get("text") else ""
        cards.append(f"""      <article class="say{hi}" data-rv style="--rv-d:{min(i,5)*40}ms">
        <p class="say__q">{esc(t['zitat'])}</p>{text}
        <div class="say__foot">
          <img class="say__av" src="{r('assets/web/' + t['avatar'])}" alt="" loading="lazy" width="72" height="72">
          <span><span class="say__n">{esc(t['name'])}</span><br><span class="say__ride">fährt: {esc(t['faehrt'])}</span></span>
          <span class="say__src">{esc(t['quelle'])}</span>
        </div>
      </article>""")
    return "\n".join(cards)


def team_block(depth):
    r = lambda p: rel(depth, p)
    out = []
    for i, m in enumerate(load("team.json")):
        out.append(f"""      <article class="team__i" data-rv style="--rv-d:{i*80}ms">
        <div class="team__media"><img src="{r('assets/web/' + m['bild'])}" alt="{esc(m['name'])}" loading="lazy"></div>
        <div class="team__cap"><h3 class="team__n">{esc(m['name'])}</h3><p class="team__r">{esc(m['rolle'])}</p></div>
      </article>""")
    return "\n".join(out)


def faq_block(only_group=None):
    out = []
    for grp in load("faq.json"):
        if only_group and grp["gruppe"] != only_group:
            continue
        items = []
        for e in grp["eintraege"]:
            items.append(f"""      <div class="faq__i">
        <button class="faq__q" type="button">{esc(e['frage'])}
          {CHEV}</button>
        <div class="faq__a"><div><p>{esc(e['antwort'])}</p></div></div>
      </div>""")
        head_ = "" if only_group else f'      <p class="faq__gt">{esc(grp["gruppe"])}</p>\n'
        out.append(f'    <div class="faq__group">\n{head_}' + "\n".join(items) + "\n    </div>")
    return "\n\n".join(out)


def faq_schema(only_group=None):
    qs = []
    for grp in load("faq.json"):
        if only_group and grp["gruppe"] != only_group:
            continue
        for e in grp["eintraege"]:
            qs.append({"@type": "Question", "name": e["frage"],
                       "acceptedAnswer": {"@type": "Answer", "text": e["antwort"]}})
    data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": qs}
    return ('<script type="application/ld+json">'
            + json.dumps(data, ensure_ascii=False) + "</script>")


def bike_card(depth, b):
    r = lambda p: rel(depth, p)
    flag = f'\n          <span class="offer__flag">{esc(b["flag"])}</span>' if b.get("flag") else ""
    meta = b.get("specs") or " · ".join(x for x in [
        f'Baujahr {b["baujahr"]}' if b.get("baujahr") else "", b.get("km", "")] if x)
    ab = '<span>ab</span> ' if b.get("preis_ab") else ""
    href = r("#kontakt") if b.get("kategorie") == "aktion" else r(f"bikes/{b['slug']}/")
    return f"""      <a class="offer" href="{href}" data-rv>
        <div class="offer__media">
          <img src="{r('assets/web/' + b['bild'])}" alt="{esc(b['alt'])}" loading="lazy">{flag}
        </div>
        <div class="offer__body">
          <h3 class="offer__t">{esc(b['name'])}</h3>
          <p class="offer__meta num">{esc(meta)}</p>
          <p class="offer__price">{ab}<b class="num">{esc(b['preis'])}</b></p>
        </div>
      </a>"""


def kontakt_block(depth):
    r = lambda p: rel(depth, p)
    zeiten = "<br>".join(
        (f'{esc(z["tage"])}&nbsp;&nbsp;{esc(z["zeit"])}' if z["tage"]
         else f'<span style="opacity:0" aria-hidden="true">Mo – Fr</span>&nbsp;&nbsp;{esc(z["zeit"])}')
        for z in S["oeffnungszeiten"])
    return f"""
<section class="contact" id="kontakt">
  <div class="contact__media">
    <img src="{r('assets/web/standort-nacht.jpg')}" alt="" loading="lazy" aria-hidden="true">
  </div>
  <div class="contact__scrim" aria-hidden="true"></div>

  <div class="wrap">
    <div class="contact__grid">
      <div>
        <p class="idx">{CHEV}Get in contact</p>
        <h2 class="contact__h" data-rv>Komm vorbei.<br>Oder ruf einfach <em>an.</em></h2>
        <p class="lead" data-rv style="--rv-d:100ms">
          Werkstatttermine buchst du am schnellsten selbst online. Für alles andere —
          Beratung, Probefahrt, Umbau, Miete — melde dich direkt bei uns.
        </p>
        <div class="contact__acts" data-rv style="--rv-d:180ms">
          <a class="btn" href="{BOOKING}" target="_blank" rel="noopener">
            {CHEV}Werkstatttermin buchen
          </a>
          <a class="btn btn--ghost" href="mailto:{MAIL}">E-Mail schreiben</a>
        </div>
      </div>

      <ul class="info" data-rv style="--rv-d:120ms">
        <li class="info__i">
          <span class="info__k">Adresse</span>
          <span class="info__v">
            <a href="{S['maps_url']}" target="_blank" rel="noopener">
              {esc(S['strasse'])}<br>{esc(S['plz_ort'])}, {esc(S['region'])}
            </a>
            <small>Route in Google Maps öffnen</small>
          </span>
        </li>
        <li class="info__i">
          <span class="info__k">Öffnungszeiten</span>
          <span class="info__v num">{zeiten}
            <small>{esc(S['oeffnungszeiten_hinweis'])}</small></span>
        </li>
        <li class="info__i">
          <span class="info__k">Telefon</span>
          <span class="info__v"><a class="num" href="tel:{TEL}">{S['telefon']}</a></span>
        </li>
        <li class="info__i">
          <span class="info__k">E-Mail</span>
          <span class="info__v"><a href="mailto:{MAIL}">{MAIL}</a></span>
        </li>
      </ul>
    </div>
  </div>
</section>
"""


def local_business_schema():
    data = {
        "@context": "https://schema.org",
        "@type": "MotorcycleDealer",
        "name": S["marke"],
        "legalName": S["firma"],
        "url": SITE + "/",
        "telephone": S["telefon"],
        "email": S["email"],
        "image": SITE + "/assets/icons/og.jpg",
        "address": {"@type": "PostalAddress", "streetAddress": S["strasse"],
                    "postalCode": S["plz_ort"].split()[0],
                    "addressLocality": " ".join(S["plz_ort"].split()[1:]),
                    "addressRegion": S["region"], "addressCountry": "AT"},
        "openingHours": ["Mo-Fr 07:30-12:00", "Mo-Fr 13:00-17:30"],
    }
    return ('<script type="application/ld+json">'
            + json.dumps(data, ensure_ascii=False) + "</script>")


# ================================================================ Startseite
def build_home():
    main = open(os.path.join(PARTS, "home-main.html"), encoding="utf-8").read()
    bikes = [b for b in load("bikes.json") if b.get("aktiv") and b.get("startseite")]
    main = (main
            .replace("<!--SERVICES-->", services_block(0))
            .replace("<!--OFFERS-->", "\n".join(bike_card(0, b) for b in bikes))
            .replace("<!--TESTIMONIALS-->", testimonials_block(0))
            .replace("<!--TEAM-->", team_block(0))
            .replace("<!--FAQ-->", faq_block())
            .replace("<!--KONTAKT-->", kontakt_block(0)))
    main += "\n" + local_business_schema() + "\n" + faq_schema()
    ti, de, og = seo_meta("start",
        "Schwarz Motorized — Aprilia Händler & Racing Performance Center | Mönchhof",
        "Offizieller Aprilia Händler im Burgenland. Service für alle Marken, ECU Flash "
        "by ROM Racing exklusiv in Österreich und kompromisslose Rennstreckenumbauten.")
    write("index.html", page(0, title=ti, desc=de, canonical="/", active=None,
                             body=main, og_image=og))


# ============================================== Racing — Conversion-Landing
RACING_STEPS = [
    ("Gespräch", "Kostenlos und unverbindlich. Du erzählst uns, was du fährst, wo du hin "
                 "willst und was dich aktuell stört. Wir sagen dir ehrlich, was Sinn ergibt "
                 "— und was nicht."),
    ("Bestandsaufnahme", "Wir schauen uns dein Bike an: Fahrwerk, Bremsen, Elektronik, "
                         "Verschleiß. Danach weißt du, wo du stehst und was der Umbau "
                         "wirklich kostet."),
    ("Aufbau & Abstimmung", "Wir bauen um und stimmen ab — Federelemente auf dein Gewicht, "
                            "Motorsteuerung auf deine Strecke, Ergonomie auf deine Größe."),
    ("Strecke & Betreuung", "Setup-Anpassungen nach dem ersten Einsatz, Racing-Service nach "
                            "Belastung statt nach Kalender. Wir bleiben dran."),
]

RACING_PATHS = [
    dict(kicker="Du hast schon ein Bike",
         h="Du fährst schon —<br>aber es geht mehr.",
         p="Du warst auf der Strecke und merkst: Das Bike kann mehr, oder es arbeitet gegen "
           "dich. Das Heck stempelt beim Bremsen, die Elektronik regelt zu früh, nach zwei "
           "Sessions lässt die Bremse nach. Das sind keine Fahrfehler — das ist Setup.",
         li=["Fahrwerks-Setup auf dein Gewicht und deine Strecke",
             "ECU Flash by ROM Racing — Abstimmung statt Kompromiss",
             "Bremsanlage, Beläge und Leitungen, die eine Session durchhalten",
             "Racing-Service nach Belastung, nicht nach Kalender"],
         cta="Setup-Gespräch vereinbaren"),
    dict(kicker="Du willst einsteigen",
         h="Du willst auf<br>die Strecke.",
         p="Erster Trackday, und du weißt nicht, ob dein Bike passt — oder ob du dir gleich "
           "eine richtige Maschine holen sollst. Beides geht. Wir sagen dir, was dein "
           "Straßenbike wirklich braucht, um sicher auf die Strecke zu dürfen.",
         li=["Straßenbike trackday-tauglich machen — Abklebe- oder Vollumbau",
             "Gebrauchte Rennmaschine aus unserem Bestand",
             "Neuaufbau auf RSV4, RS 660 oder Tuono V4",
             "Vorführer mieten und erst danach entscheiden"],
         cta="Einstieg besprechen"),
]

RACING_SCOPES = [
    ("Trackday-tauglich",
     "Dein Straßenbike für den ersten Einsatz.",
     ["Sicherheitscheck und Abnahme-Vorbereitung", "Bremsflüssigkeit, Beläge, Reifen",
      "Abklebung oder Demontage der Straßenteile", "Grund-Setup für dein Gewicht"]),
    ("Basis-Racebike",
     "Für alle, die regelmäßig fahren.",
     ["Rennverkleidung und Sturzschutz", "Fahrwerk abgestimmt, Federelemente überarbeitet",
      "Ergonomie: Rasten, Lenker, Sitzposition", "ECU Flash auf Strecke und Auspuff"]),
    ("Vollausbau",
     "Wenn die Rundenzeit zählt.",
     ["Fahrwerk auf Rennniveau, Geometrie vermessen", "Bremsanlage komplett auf Racing-Spec",
      "Elektronik, Datenaufzeichnung, Getriebe-Optionen",
      "Betreuung an der Strecke und laufende Setup-Arbeit"]),
]


def build_racing():
    d = 1
    r = lambda p: rel(d, p)
    steps = "\n".join(f"""      <li class="step" data-rv style="--rv-d:{i*90}ms">
        <span class="step__n num">{i+1:02d}</span>
        <div>
          <h3 class="step__t">{esc(t)}</h3>
          <p class="step__d">{esc(x)}</p>
        </div>
      </li>""" for i, (t, x) in enumerate(RACING_STEPS))

    paths = "\n".join(f"""      <article class="path" data-rv style="--rv-d:{i*120}ms">
        <p class="path__k">{CHEV}{esc(p['kicker'])}</p>
        <h3 class="path__h">{p['h']}</h3>
        <p class="path__p">{esc(p['p'])}</p>
        <ul class="path__l">{''.join(f'<li>{esc(x)}</li>' for x in p['li'])}</ul>
        <a class="btn{' btn--cyan' if i else ''}" href="#anfrage">{CHEV}{esc(p['cta'])}</a>
      </article>""" for i, p in enumerate(RACING_PATHS))

    scopes = "\n".join(f"""      <article class="scope" data-rv style="--rv-d:{i*100}ms">
        <h3 class="scope__t">{esc(t)}</h3>
        <p class="scope__s">{esc(s)}</p>
        <ul class="scope__l">{''.join(f'<li>{esc(x)}</li>' for x in items)}</ul>
      </article>""" for i, (t, s, items) in enumerate(RACING_SCOPES))

    body = f"""
<section class="phero phero--media">
  <div class="phero__media">
    <img src="{r('assets/web/racing-hero.jpg')}" alt="Rennmotorrad von Schwarz Motorized mit Startnummer 141 auf der Rennstrecke" fetchpriority="high">
  </div>
  <div class="phero__scrim" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(d, 'Racing')}
    <h1 class="phero__h">Rennstrecke<br>ohne <em>Rätselraten.</em></h1>
    <p class="lead phero__lead">
      Wir bauen und stimmen dein Motorrad ab — für den ersten Trackday genauso wie für die
      Rundenzeit, die dir noch fehlt. Kein Teilekatalog, sondern ein Setup, das zu dir passt.
    </p>
    <div class="phero__acts">
      <a class="btn" href="#anfrage">{CHEV}Kostenloses Racing-Gespräch</a>
      <a class="btn btn--ghost" href="#ablauf">Wie das abläuft</a>
    </div>
    <ul class="trust" >
      <li class="trust__i">{CHEV}<span><b>ECU Flash by ROM Racing</b> — exklusiv in Österreich</span></li>
      <li class="trust__i">{CHEV}<span><b>Offizieller Aprilia Händler</b> — RSV4, RS 660, Tuono</span></li>
      <li class="trust__i">{CHEV}<span><b>Eigenes Bike unter #141</b> — wir fahren selbst</span></li>
    </ul>
  </div>
</section>

<section class="sec paths">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    <p class="idx">{CHEV}Zwei Wege auf die Strecke</p>
    <div class="paths__head">
      <h2 class="paths__h" data-rv>Wo stehst du gerade?</h2>
      <p class="lead" data-rv style="--rv-d:100ms">
        Beide Wege enden am selben Punkt: einem Motorrad, das genau das macht, was du willst.
        Der Weg dorthin ist ein anderer.
      </p>
    </div>
    <div class="paths__grid">
{paths}
    </div>
  </div>
</section>

<section class="sec svc">
  <div class="wrap">
    <p class="idx">{CHEV}Was wir konkret machen</p>
    <div class="svc__head">
      <h2 class="svc__h" data-rv>Von der Schraube<br>bis zum Kennfeld.</h2>
      <p class="lead" data-rv style="--rv-d:120ms">
        Ein Rennstreckenumbau ist kein Zubehörkatalog. Die Komponenten müssen zueinander
        passen — sonst arbeitet das Bike gegen dich.
      </p>
    </div>

    <div class="svc__list" id="svcList">
      <div class="svc__peek" id="svcPeek" aria-hidden="true"><img alt="" id="svcPeekImg"></div>

      <a class="svc__row" href="#anfrage" data-img="{r('assets/web/svc-race.jpg')}" data-rv>
        <div class="svc__in">
          <h3 class="svc__t">Fahrwerk &amp; Bremsen</h3>
          <p class="svc__d">Federelemente auf dein Gewicht, Geometrie auf deine Strecke, Bremsanlage auf deinen Bremspunkt. Das ist der größte Hebel — und der, den die meisten auslassen.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-race.jpg')}" alt="Aprilia RSV4 Factory mit Carbon-Rennverkleidung" loading="lazy"></div>
      </a>

      <a class="svc__row" href="#anfrage" data-img="{r('assets/web/svc-ecu.jpg')}" data-rv style="--rv-d:80ms">
        <div class="svc__in">
          <h3 class="svc__t">ECU Flash by ROM Racing</h3>
          <p class="svc__d">Motorsteuerung abgestimmt auf Auspuff, Strecke und Fahrstil. Für alle V4- und 660er-Modelle — exklusiv in Österreich bei uns.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-ecu.jpg')}" alt="Laptop mit Kennfeld-Tabellen, per Diagnosekabel mit einem Motorrad verbunden" loading="lazy"></div>
      </a>

      <a class="svc__row" href="#anfrage" data-img="{r('assets/web/carbon.jpg')}" data-rv style="--rv-d:160ms">
        <div class="svc__in">
          <h3 class="svc__t">Verkleidung &amp; Ergonomie</h3>
          <p class="svc__d">Rennverkleidung, Rasten, Lenker, Sitzposition. Damit du auf der Strecke arbeiten kannst statt zu kämpfen.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/carbon.jpg')}" alt="Carbon-Verkleidungsteil mit Sicherungsdraht und Werkzeug auf der Werkbank" loading="lazy"></div>
      </a>

      <a class="svc__row" href="#anfrage" data-img="{r('assets/web/svc-service.jpg')}" data-rv style="--rv-d:240ms">
        <div class="svc__in">
          <h3 class="svc__t">Racing-Service</h3>
          <p class="svc__d">Wir planen Ventilservice und Revision nach Belastung — bei Aprilia über die erfassten Stresskilometer. So steht dein Motor nicht mitten in der Saison.</p>
          <span class="svc__go">{CHEV}</span>
        </div>
        <div class="svc__img"><img src="{r('assets/web/svc-service.jpg')}" alt="Hände mit Drehmomentschlüssel an der Hinterradaufhängung eines Sportmotorrads" loading="lazy"></div>
      </a>
    </div>
  </div>
</section>

<section class="sec scopes">
  <div class="wrap">
    <p class="idx">{CHEV}Was kostet das?</p>
    <div class="scopes__head">
      <h2 class="scopes__h" data-rv>Drei Ausbaustufen.</h2>
      <p class="lead" data-rv style="--rv-d:100ms">
        Was dein Umbau kostet, hängt vom Bike und vom Ziel ab — pauschale Preise wären
        geraten. Diese drei Stufen zeigen dir, worüber wir reden. Nach dem ersten Gespräch
        bekommst du ein konkretes, schriftliches Angebot.
      </p>
    </div>
    <div class="scopes__grid">
{scopes}
    </div>
  </div>
</section>

<section class="sec steps" id="ablauf">
  <div class="glow glow--cool glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    <p class="idx">{CHEV}Ablauf</p>
    <div class="steps__head">
      <h2 class="steps__h" data-rv>In vier Schritten<br>auf die Strecke.</h2>
    </div>
    <ol class="steps__list">
{steps}
    </ol>
  </div>
</section>

<section class="sec says">
  <div class="wrap">
    <p class="idx">{CHEV}Was Kunden sagen</p>
    <div class="says__head">
      <h2 class="says__h" data-rv>Leute, die bei uns<br>schrauben lassen.</h2>
    </div>
    <div class="says__grid">
{testimonials_block(d)}
    </div>
  </div>
</section>

<section class="sec anfrage" id="anfrage">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap">
    <div class="anfrage__grid">
      <div>
        <p class="idx">{CHEV}Racing-Gespräch</p>
        <h2 class="anfrage__h" data-rv>Erzähl uns,<br>was du <em>vorhast.</em></h2>
        <p class="lead" data-rv style="--rv-d:100ms">
          Kostenlos und unverbindlich. Wir melden uns in der Regel am nächsten Werktag —
          und sagen dir ehrlich, ob und wie wir dir weiterhelfen können.
        </p>
        <ul class="anfrage__facts" data-rv style="--rv-d:160ms">
          <li>{CHEV}<span>Antwort meist am nächsten Werktag</span></li>
          <li>{CHEV}<span>Kostenlos und unverbindlich</span></li>
          <li>{CHEV}<span>Auch für Bikes, die nicht von uns sind</span></li>
        </ul>
        <p class="anfrage__alt" data-rv style="--rv-d:200ms">
          Lieber direkt reden? <a class="tlink" href="tel:{TEL}">{S['telefon']}</a>
        </p>
      </div>

      <form class="af" id="racingForm" data-mail="{MAIL}" novalidate>
        <p class="af__lead">Drei Fragen, dann wissen wir Bescheid.</p>

        <div class="af__f">
          <label class="af__l" for="af-bike">Welches Motorrad fährst du?</label>
          <input class="af__i" type="text" id="af-bike" name="bike" placeholder="z. B. Aprilia RS 660, Baujahr 2023" required>
        </div>

        <div class="af__f">
          <label class="af__l" for="af-ziel">Wo willst du hin?</label>
          <select class="af__i" id="af-ziel" name="ziel" required>
            <option value="">Bitte auswählen</option>
            <option>Erster Trackday — Bike tauglich machen</option>
            <option>Ich fahre schon — Setup verbessern</option>
            <option>Rennmaschine kaufen oder neu aufbauen</option>
            <option>ECU Flash / Abstimmung</option>
            <option>Racing-Service für die Saison</option>
            <option>Noch unklar — bitte beraten</option>
          </select>
        </div>

        <div class="af__f">
          <label class="af__l" for="af-text">Was ist dir wichtig?</label>
          <textarea class="af__i af__i--ta" id="af-text" name="text" rows="4"
            placeholder="Was stört dich aktuell, was soll besser werden, wann willst du fahren?"></textarea>
        </div>

        <div class="af__f af__f--row">
          <div>
            <label class="af__l" for="af-name">Name</label>
            <input class="af__i" type="text" id="af-name" name="name" required>
          </div>
          <div>
            <label class="af__l" for="af-tel">Telefon oder E-Mail</label>
            <input class="af__i" type="text" id="af-tel" name="kontakt" required>
          </div>
        </div>

        <button class="btn af__go" type="submit">{CHEV}Anfrage senden</button>
        <p class="af__note">
          Der Button öffnet dein E-Mail-Programm mit einer fertig ausgefüllten Nachricht an
          {MAIL}. Es werden keine Daten an Dritte übertragen.
        </p>
      </form>
    </div>
  </div>
</section>

<section class="sec" id="faq">
  <div class="wrap">
    <p class="idx">{CHEV}Häufige Fragen</p>
    <div class="faq__head">
      <h2 class="faq__h" data-rv>Was uns Racer<br>am häufigsten fragen.</h2>
    </div>
{faq_block('Racing & Umbau')}
  </div>
</section>
{faq_schema('Racing & Umbau')}
"""
    ti, de, og = seo_meta("racing", "Rennstreckenumbau & Racing-Setup — Schwarz Motorized",
        "Rennstreckenumbau, Fahrwerks-Setup und ECU Flash by ROM Racing für Aprilia "
        "RSV4, RS 660 und Tuono V4. Vom ersten Trackday bis zur Rundenzeit.")
    write("racing/index.html", page(d, title=ti, desc=de, canonical="/racing/",
                                    active="Racing", body=body, og_image=og))


# ===================================================================== Bikes
def build_bikes():
    d = 1
    r = lambda p: rel(d, p)
    bikes = [b for b in load("bikes.json") if b.get("aktiv") and b.get("kategorie") != "aktion"]
    rows = []
    for i, b in enumerate(bikes):
        flag = f'\n          <span class="bike__flag">{esc(b["flag"] or ("Vorführer" if b["kategorie"]=="vorfuehrer" else "Gebraucht"))}</span>'
        meta = " ".join(f'<span>{esc(x)}</span>' for x in [
            f'Baujahr {b["baujahr"]}' if b.get("baujahr") else "", b.get("km", "")] if x)
        rows.append(f"""      <a class="bike" href="{r('bikes/' + b['slug'] + '/')}" data-rv style="--rv-d:{min(i,5)*70}ms">
        <div class="bike__media">
          <img src="{r('assets/web/' + b['bild'])}" alt="{esc(b['alt'])}" loading="lazy">{flag}
        </div>
        <div>
          <h2 class="bike__t">{esc(b['name'])}</h2>
          <p class="bike__meta num">{meta}</p>
        </div>
        <p class="bike__price num">{esc(b['preis'])}</p>
      </a>""")

    body = f"""
<section class="phero">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(d, 'Pre-Owned &amp; Demo Bikes')}
    <h1 class="phero__h">Pre-Owned &amp;<br><em>Demo Bikes</em></h1>
    <p class="lead phero__lead">
      Gepflegte Gebrauchte und unsere eigenen Vorführer — alle aus dem Haus,
      alle mit bekannter Geschichte. Probefahrt nach Terminvereinbarung.
    </p>
    <div class="phero__acts">
      <a class="btn" href="{r('#kontakt')}">{CHEV}Probefahrt vereinbaren</a>
      <a class="btn btn--ghost" href="tel:{TEL}">Kurz anrufen</a>
    </div>
  </div>
</section>

<section class="sec sec--flush-t">
  <div class="wrap">
    <div class="bikes__grid">
{chr(10).join(rows)}
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
    ti, de, og = seo_meta("bikes", "Pre-Owned & Demo Bikes — Schwarz Motorized",
        "Gebrauchte Motorräder und Vorführer bei Schwarz Motorized in Mönchhof: "
        "Aprilia, Moto Guzzi, BMW. Mit Baujahr, Kilometerstand und Preis.")
    write("bikes/index.html", page(d, title=ti, desc=de, canonical="/bikes/",
                                   active="Bikes", body=body, og_image=og))

    for b in bikes:
        build_bike_detail(b)


def build_bike_detail(b):
    d = 2
    r = lambda p: rel(d, p)
    specs = [("Baujahr", b.get("baujahr")), ("Kilometerstand", b.get("km")),
             ("Zustand", "Vorführmotorrad" if b["kategorie"] == "vorfuehrer" else "Gebraucht")]
    spec_html = "\n".join(
        f'        <li class="dspec__i"><span class="dspec__k">{esc(k)}</span>'
        f'<span class="dspec__v num">{esc(v)}</span></li>'
        for k, v in specs if v)
    hl = ""
    if b.get("highlights"):
        hl = ('\n      <ul class="dhl">'
              + "".join(f'<li>{CHEV}<span>{esc(x)}</span></li>' for x in b["highlights"])
              + "</ul>")
    kurz = f'\n      <p class="lead" data-rv>{esc(b["kurz"])}</p>' if b.get("kurz") else ""
    subject = f"Anfrage: {b['name']}"
    mail = (f"mailto:{MAIL}?subject={subject.replace(' ', '%20')}"
            f"&body=Hallo%20Schwarz%20Motorized%2C%0A%0Aich%20interessiere%20mich%20f%C3%BCr%20"
            f"{b['name'].replace(' ', '%20')}%20({b.get('preis','')}).%0A%0AMeine%20Frage%3A%0A%0A")

    body = f"""
<section class="sec detail">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    <nav class="crumbs" aria-label="Brotkrumen">
      <a href="{r('')}">Startseite</a>{CHEV}<a href="{r('bikes/')}">Bikes</a>{CHEV}<span aria-current="page">{esc(b['name'])}</span>
    </nav>

    <div class="detail__grid">
      <div class="detail__media">
        <img src="{r('assets/web/' + b['bild'])}" alt="{esc(b['alt'])}" fetchpriority="high">
      </div>

      <div class="detail__body">
        <p class="idx">{CHEV}{esc('Vorführmotorrad' if b['kategorie']=='vorfuehrer' else 'Gebrauchtbike')}</p>
        <h1 class="detail__h">{esc(b['name'])}</h1>
        <p class="detail__price num">{esc(b['preis'])}</p>{kurz}{hl}

        <ul class="dspec">
{spec_html}
        </ul>

        <div class="detail__acts">
          <a class="btn" href="{mail}">{CHEV}Bike anfragen</a>
          <a class="btn btn--ghost" href="tel:{TEL}">{S['telefon']}</a>
        </div>

        <p class="detail__note">
          Preis inkl. USt. Verfügbarkeit auf Anfrage. Probefahrt nach Terminvereinbarung —
          bei Vorführmotorrädern rechnen wir dir eine Miete auf den Kaufpreis an.
        </p>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--flush-t">
  <div class="wrap">
    <p class="idx">{CHEV}Weitere Bikes</p>
    <a class="tlink" href="{r('bikes/')}">Alle Pre-Owned &amp; Demo Bikes ansehen {CHEV}</a>
  </div>
</section>
"""
    write(f"bikes/{b['slug']}/index.html", page(
        d, title=f"{b['name']} — {b['preis']} | Schwarz Motorized",
        desc=(b.get("kurz") or f"{b['name']} bei Schwarz Motorized in Mönchhof.")[:170],
        canonical=f"/bikes/{b['slug']}/", active="Bikes", body=body,
        og_image=b.get("bild", "")))


# ============================================================== Rechtsseiten
PROSE_LINKS = {
    "https://www.motorized.at/agb": "../agb/",
    "https://motorized.at/agb/": "../agb/",
    "https://motorized.at/datenschutz/": "../datenschutz/",
    "https://motorized.at/impressum/": "../impressum/",
}


def fix_prose_links(markup):
    import re as _re
    for a, b in PROSE_LINKS.items():
        markup = markup.replace(f'href="{a}"', f'href="{b}"').replace(f'href="{a}/"', f'href="{b}"')
    return _re.sub(r'<a href="(https?://[^"]+)"(?![^>]*target)',
                   r'<a href="\1" target="_blank" rel="noopener noreferrer"', markup)


def render_nodes(nodes, skip_first=True):
    out, first = [], True
    for kind, val in nodes:
        if kind.startswith("h"):
            if first and skip_first:
                first = False
                continue
            first = False
            lvl = "h2" if kind in ("h1", "h2") else "h3"
            out.append(f"      <{lvl}>{esc(val)}</{lvl}>")
        elif kind == "p":
            out.append(f"      <p>{val}</p>")
        else:
            out.append(f"      <{kind}>" + "".join(f"<li>{esc(x)}</li>" for x in val) + f"</{kind}>")
    return "\n".join(out)


LEGAL_NOTE = {
    "datenschutz": ("Diese Datenschutzerklärung stammt noch von der bisherigen WordPress-Seite "
                    "und beschreibt Dienste, die es hier so nicht mehr gibt. Sie muss vor dem "
                    "Livegang überarbeitet werden."),
    "agb": ("Übernommen von der bisherigen Seite. Bitte vor dem Livegang rechtlich prüfen lassen."),
}


def build_legal(slug, title, h1, desc):
    title, desc, og = seo_meta(slug, title, desc)
    with open(os.path.join(PARTS, f"legal-{slug}.json"), encoding="utf-8") as f:
        nodes = json.load(f)
    note = ""
    if slug in LEGAL_NOTE:
        note = f'    <p class="legal-note">{CHEV}<span>{LEGAL_NOTE[slug]}</span></p>\n'
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
    write(f"{slug}/index.html", page(1, title=title, desc=desc, canonical=f"/{slug}/",
                                     active=None, body=body, og_image=og))


def build_cookies():
    gtm = TRACK.get("gtm_id", "")
    fbp = TRACK.get("facebook_pixel_id", "")
    aktiv = bool(TRACK.get("aktiv")) and (gtm or fbp)
    if aktiv:
        rows = []
        if gtm:
            rows.append(("Google Tag Manager / Google-Dienste", "Statistik & Marketing",
                         "Google Ireland Ltd.",
                         "Lädt Mess- und Marketing-Tags. Wird erst nach deiner Zustimmung geladen."))
        if fbp:
            rows.append(("Meta-Pixel", "Marketing", "Meta Platforms Ireland Ltd.",
                         "Misst Werbeerfolg auf Facebook und Instagram. Wird erst nach deiner "
                         "Zustimmung geladen."))
        table = ("\n      <div class=\"ctab-wrap\"><table class=\"ctab\">"
                 "<thead><tr><th>Dienst</th><th>Zweck</th><th>Anbieter</th><th>Hinweis</th></tr></thead><tbody>"
                 + "".join(f"<tr><td>{esc(a)}</td><td>{esc(b)}</td><td>{esc(c)}</td><td>{esc(dd)}</td></tr>"
                           for a, b, c, dd in rows)
                 + "</tbody></table></div>")
        intro = ("<p>Diese Website bindet Dienste von Dritten ein. <strong>Keiner davon wird "
                 "geladen, bevor du im Cookie-Banner zustimmst.</strong> Lehnst du ab oder "
                 "reagierst du nicht, bleibt die Seite vollständig nutzbar — es wird lediglich "
                 "nichts gemessen.</p>")
    else:
        table = ""
        intro = ("<p><strong>Diese Website setzt derzeit keine Cookies und lädt nichts von "
                 "fremden Servern.</strong> Schriften, Bilder, Stylesheets und Skripte liegen "
                 "alle auf unserem eigenen Server. Es findet keine Analyse, kein Tracking und "
                 "keine Weitergabe deiner Daten statt.</p>")

    body = f"""
<section class="phero">
  <div class="glow glow--soft" aria-hidden="true"></div>
  <div class="wrap">
    {crumbs(1, 'Cookies')}
    <h1 class="phero__h">Cookies</h1>
  </div>
</section>

<section class="sec sec--flush-t">
  <div class="wrap">
    <div class="prose">
      {intro}

      <h2>Was technisch notwendig ist</h2>
      <p>Wir speichern eine einzige Information lokal in deinem Browser: deine Entscheidung
         aus dem Cookie-Banner. Sie verlässt dein Gerät nicht und wird nicht an uns übertragen.
         Sie liegt im sogenannten <em>Local Storage</em> unter dem Schlüssel
         <strong>sm-consent-v1</strong>.</p>

      <h2>Deine Entscheidung ändern</h2>
      <p>Du kannst deine Auswahl jederzeit anpassen:
         <a href="#" data-cookie-settings>Cookie-Einstellungen öffnen</a>.
         Alternativ löschst du die Websitedaten in deinem Browser — dann fragen wir erneut.</p>
{table}

      <h2>Mehr dazu</h2>
      <p>Wie wir mit personenbezogenen Daten umgehen, steht in der
         <a href="../datenschutz/">Datenschutzerklärung</a>.
         Verantwortlich ist {esc(S['firma'])}, {esc(S['strasse'])}, {esc(S['plz_ort'])} —
         siehe <a href="../impressum/">Impressum</a>.</p>
    </div>
  </div>
</section>
"""
    ti, de, og = seo_meta("cookies", "Cookies — Schwarz Motorized",
        "Welche Cookies und Dienste diese Website verwendet und wie du deine Auswahl änderst.")
    write("cookies/index.html", page(1, title=ti, desc=de, canonical="/cookies/",
                                     active=None, body=body, og_image=og))


# ======================================================================= 404
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
      <a class="btn btn--ghost" href="tel:{TEL}">{S['telefon']}</a>
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
        canonical="/404.html", active=None, body=body, noindex=True))


# ================================================================== Sitemap
def build_robots():
    if NOINDEX:
        # Crawlen bleibt erlaubt — sonst koennte Google das noindex gar nicht lesen
        # und die Adresse trotzdem in den Index nehmen.
        write("robots.txt",
              "# Vorschau — diese Seite soll nicht in Suchmaschinen erscheinen.\n"
              "# Das Auslesen bleibt absichtlich erlaubt, damit das noindex\n"
              "# in jeder Seite auch gelesen werden kann.\n"
              "User-agent: *\n"
              "Allow: /\n"
              "Disallow: /admin/\n"
              "Disallow: /tools/\n"
              "Disallow: /content/\n")
        return
    write("robots.txt",
          "User-agent: *\n"
          "Allow: /\n"
          "Disallow: /admin/\n"
          "Disallow: /tools/\n"
          "Disallow: /content/\n"
          "\n"
          f"Sitemap: {SITE}/sitemap.xml\n")


def build_admin():
    """Setzt den Fingerabdruck in admin/index.html, damit auch das CMS
    nach einer Aenderung sofort neu geladen wird."""
    import re as _re
    p = os.path.join(ROOT, "admin", "index.html")
    s = open(p, encoding="utf-8").read()
    s = _re.sub(r'href="admin\.css(\?v=[a-f0-9]+)?"',
                f'href="admin.css?v={stamp("admin/admin.css")}"', s)
    s = _re.sub(r'src="admin\.js(\?v=[a-f0-9]+)?"',
                f'src="admin.js?v={stamp("admin/admin.js")}"', s)
    open(p, "w", encoding="utf-8").write(s)
    print(f"  {'admin/index.html':36} gestempelt")


def build_sitemap():
    urls = [("/", "1.0"), ("/racing/", "0.9"), ("/bikes/", "0.8")]
    for b in load("bikes.json"):
        if b.get("aktiv") and b.get("kategorie") != "aktion":
            urls.append((f"/bikes/{b['slug']}/", "0.6"))
    urls += [("/impressum/", "0.2"), ("/datenschutz/", "0.2"),
             ("/agb/", "0.2"), ("/cookies/", "0.2")]
    body = "\n".join(f"  <url><loc>{SITE}{u}</loc><priority>{p}</priority></url>"
                     for u, p in urls)
    write("sitemap.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + body + "\n</urlset>\n")


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
    build_cookies()
    build_404()
    build_robots()
    build_sitemap()
    build_admin()
    if NOINDEX:
        print("\n  ACHTUNG: Vorschau-Modus aktiv — alle Seiten stehen auf noindex.")
    print("fertig.")

/* ==========================================================================
   SCHWARZ MOTORIZED — Interaktion
   Kein Framework, keine externen Abhängigkeiten.
   Alles hier ist so gebaut, dass es sich in Webflow 1:1 als Interaction
   nachbilden lässt (siehe WEBFLOW.md).
   ========================================================================== */
(function () {
  'use strict';

  window.__smInit = true;   // Signal an den Watchdog im <head>

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1) Header: solide Fläche, sobald gescrollt wird
     --------------------------------------------------------------- */
  var hdr = document.getElementById('hdr');
  function onScroll() {
    if (!hdr) return;
    hdr.classList.toggle('is-stuck', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------
     2) Mobiles Menü
     --------------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var mnav = document.getElementById('mnav');

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (burger) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    }
  }
  if (burger) {
    burger.addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
  }
  if (mnav) {
    mnav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  });

  /* ---------------------------------------------------------------
     3) Scroll-Reveals
     Sichtbarkeit ist per Watchdog im <head> abgesichert (siehe index.html).
     --------------------------------------------------------------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('[data-rv]'));

  function showAll() {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  if (reduce || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     4) Hero-Headline: zeilenweiser Aufzug beim Laden
     --------------------------------------------------------------- */
  var heroH = document.getElementById('heroH');
  if (heroH) {
    if (reduce) {
      heroH.classList.add('is-in');
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { heroH.classList.add('is-in'); });
      });
      setTimeout(function () { heroH.classList.add('is-in'); }, 1200);
    }
  }

  /* ---------------------------------------------------------------
     5) Leistungen: Bildvorschau folgt dem Cursor
     Die Listener hängen immer dran; ob die Vorschau läuft, wird erst
     beim Ereignis entschieden — so überlebt sie auch ein Resize vom
     Handy-Layout auf Desktop und Geräte mit Touch UND Maus.
     --------------------------------------------------------------- */
  var list = document.getElementById('svcList');
  var peek = document.getElementById('svcPeek');
  var peekImg = document.getElementById('svcPeekImg');
  var mqFine = window.matchMedia('(hover: hover) and (min-width: 56rem)');

  function peekAllowed() { return mqFine.matches && !reduce; }

  if (list && peek && peekImg) {
    var tx = 0, ty = 0, cx = 0, cy = 0, active = false, raf = null, primed = false;

    function prime() {                       // Bilder erst vorladen, wenn sie gebraucht werden
      if (primed) return;
      primed = true;
      Array.prototype.forEach.call(list.querySelectorAll('[data-img]'), function (row) {
        var i = new Image();
        i.src = row.getAttribute('data-img');
      });
    }

    function place() {
      var rot = Math.max(-9, Math.min(9, (tx - cx) * 0.14));
      peek.style.transform =
        'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px) translate(-50%,-50%) rotate(' +
        rot.toFixed(2) + 'deg) scale(' + (active ? 1 : 0.92) + ')';
    }

    function loop() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      place();
      raf = (active || Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5)
        ? requestAnimationFrame(loop) : null;
    }
    function start() { if (!raf) raf = requestAnimationFrame(loop); }

    function stop() {
      active = false;
      peek.classList.remove('is-on');
      start();
    }

    list.addEventListener('pointermove', function (e) {
      if (!peekAllowed()) return;
      var r = list.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      start();
    });

    Array.prototype.forEach.call(list.querySelectorAll('[data-img]'), function (row) {
      row.addEventListener('pointerenter', function (e) {
        if (!peekAllowed() || e.pointerType === 'touch') return;
        prime();
        var src = row.getAttribute('data-img');
        if (peekImg.getAttribute('src') !== src) peekImg.setAttribute('src', src);
        // Beim ersten Eintritt direkt an die Cursorposition setzen, nicht hereinfliegen
        if (!active) {
          var r = list.getBoundingClientRect();
          cx = tx = e.clientX - r.left;
          cy = ty = e.clientY - r.top;
        }
        active = true;
        peek.classList.add('is-on');
        place();
        start();
      });
      row.addEventListener('pointerleave', stop);
    });

    list.addEventListener('pointerleave', stop);
    mqFine.addEventListener ? mqFine.addEventListener('change', stop) : null;
  }

  /* ---------------------------------------------------------------
     6) FAQ-Akkordeon (eine Antwort gleichzeitig, pro Gruppe)
     --------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.faq__q'), function (btn) {
    var item = btn.parentElement;
    var panel = item.querySelector('.faq__a');
    btn.setAttribute('aria-expanded', 'false');
    if (panel) panel.setAttribute('role', 'region');

    btn.addEventListener('click', function () {
      var open = item.hasAttribute('data-open');
      var group = item.closest('.faq__group');
      if (group) {
        Array.prototype.forEach.call(group.querySelectorAll('.faq__i[data-open]'), function (o) {
          o.removeAttribute('data-open');
          var b = o.querySelector('.faq__q');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
      }
      if (!open) {
        item.setAttribute('data-open', '');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });



  /* ---------------------------------------------------------------
     9) Konversions-Ereignisse für Werbung
     Meldet wichtige Handlungen an den dataLayer. Das ist für sich
     genommen kein Tracking — es wird nur ausgewertet, wenn der
     Besucher zugestimmt hat und der Tag Manager dadurch läuft.
     Auslöser im GTM auf diese Ereignisnamen setzen:
       sm_anruf · sm_email · sm_termin · sm_anfrage · sm_bike_anfrage
     --------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function ereignis(name, daten) {
    var d = { event: name, seite: location.pathname };
    if (daten) for (var k in daten) if (daten.hasOwnProperty(k)) d[k] = daten[k];
    window.dataLayer.push(d);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      ereignis('sm_anruf', { nummer: href.replace('tel:', '') });
    } else if (href.indexOf('mailto:') === 0) {
      var betreff = /\?subject=([^&]*)/.exec(href);
      ereignis(href.indexOf('subject=Anfrage') > -1 ? 'sm_bike_anfrage' : 'sm_email',
               { betreff: betreff ? decodeURIComponent(betreff[1]) : '' });
    } else if (href.indexOf('osb.motiondata-vector.com') > -1) {
      ereignis('sm_termin', { quelle: a.textContent.trim().slice(0, 40) });
    }
  }, true);

  /* ---------------------------------------------------------------
     8) Racing-Anfrage: baut aus dem Formular eine fertige E-Mail
     Kein Server, kein Dienstleister — es öffnet das Mailprogramm
     des Besuchers mit vorausgefülltem Betreff und Text.
     --------------------------------------------------------------- */
  var form = document.getElementById('racingForm');
  if (form) {
    var v = function (n) { return String((form.elements[n] || {}).value || '').trim(); };

    function markiere(ok) {
      var fehlt = null;
      ['bike', 'ziel', 'name', 'kontakt'].forEach(function (n) {
        var el = form.elements[n];
        if (!el) return;
        var leer = !v(n);
        el.setAttribute('aria-invalid', leer ? 'true' : 'false');
        if (leer && !fehlt) fehlt = el;
      });
      return fehlt;
    }

    function meldung(text, istFehler) {
      var box = form.querySelector('.af__err');
      if (!text) { if (box) box.remove(); return; }
      if (!box) {
        box = document.createElement('p');
        box.className = 'af__err';
        form.querySelector('.af__go').before(box);
      }
      box.textContent = text;
      box.style.color = istFehler ? '' : 'var(--cyan)';
    }

    function textFassung() {
      var z = ['Motorrad: ' + v('bike'), 'Ziel: ' + v('ziel')];
      if (v('text')) z.push('', 'Was mir wichtig ist:', v('text'));
      z.push('', 'Name: ' + v('name'), 'Erreichbar unter: ' + v('kontakt'));
      return z.join('\n');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var fehlt = markiere();
      if (fehlt) {
        meldung('Bitte fülle Motorrad, Ziel, Name und Kontakt aus.', true);
        fehlt.focus();
        return;
      }
      meldung('');

      // Spam-Falle: echte Menschen füllen dieses Feld nie aus
      if (v('website')) { return; }

      ereignis('sm_anfrage', { bike: v('bike'), ziel: v('ziel') });

      var endpunkt = form.getAttribute('data-endpunkt');
      var mail = form.getAttribute('data-mail') || 'schwarz@motorized.at';

      if (!endpunkt) {
        // Ohne Formulardienst: E-Mail-Programm mit fertiger Nachricht öffnen
        window.location.href = 'mailto:' + mail
          + '?subject=' + encodeURIComponent('Racing-Anfrage: ' + v('bike'))
          + '&body=' + encodeURIComponent('Hallo Schwarz Motorized,\n\nich hätte gerne ein '
              + 'Racing-Gespräch.\n\n' + textFassung() + '\n\nDanke und liebe Grüße');
        return;
      }

      var knopf = form.querySelector('.af__go');
      var alt = knopf.innerHTML;
      knopf.disabled = true;
      knopf.textContent = 'Wird gesendet…';

      var daten = new FormData();
      daten.append('Motorrad', v('bike'));
      daten.append('Ziel', v('ziel'));
      daten.append('Anliegen', v('text'));
      daten.append('Name', v('name'));
      daten.append('Kontakt', v('kontakt'));
      daten.append('_subject', 'Racing-Anfrage: ' + v('bike'));

      fetch(endpunkt, { method: 'POST', body: daten, headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.querySelectorAll('.af__f, .af__go, .af__note, .af__hp').forEach(function (n) {
            n.hidden = true;
          });
          var ok = form.querySelector('.af__ok');
          if (ok) { ok.hidden = false; ok.focus && ok.focus(); }
          ereignis('sm_anfrage_gesendet', { bike: v('bike') });
        })
        .catch(function () {
          knopf.disabled = false; knopf.innerHTML = alt;
          meldung('Das hat gerade nicht geklappt. Ruf uns kurz an oder schreib direkt an '
                  + mail + '.', true);
        });
    });
  }

  /* ---------------------------------------------------------------
     7) Sanftes Springen zu Ankern, Header-Höhe berücksichtigt
     --------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    var top = target.getBoundingClientRect().top + window.scrollY - (hdr ? hdr.offsetHeight - 1 : 0);
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  });
})();

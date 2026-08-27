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
     8) Racing-Anfrage: baut aus dem Formular eine fertige E-Mail
     Kein Server, kein Dienstleister — es öffnet das Mailprogramm
     des Besuchers mit vorausgefülltem Betreff und Text.
     --------------------------------------------------------------- */
  var form = document.getElementById('racingForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var fields = ['bike', 'ziel', 'name', 'kontakt'];
      var ok = true;
      fields.forEach(function (n) {
        var el = form.elements[n];
        if (!el) return;
        var empty = !String(el.value || '').trim();
        el.setAttribute('aria-invalid', empty ? 'true' : 'false');
        if (empty && ok) { el.focus(); ok = false; }
      });
      var errBox = form.querySelector('.af__err');
      if (!ok) {
        if (!errBox) {
          errBox = document.createElement('p');
          errBox.className = 'af__err';
          form.querySelector('.af__go').before(errBox);
        }
        errBox.textContent = 'Bitte fülle Motorrad, Ziel, Name und Kontakt aus.';
        return;
      }
      if (errBox) errBox.remove();

      var v = function (n) { return String((form.elements[n] || {}).value || '').trim(); };
      var lines = [
        'Hallo Schwarz Motorized,', '',
        'ich hätte gerne ein Racing-Gespräch.', '',
        'Motorrad: ' + v('bike'),
        'Ziel: ' + v('ziel'), ''
      ];
      if (v('text')) lines.push('Was mir wichtig ist:', v('text'), '');
      lines.push('Name: ' + v('name'), 'Erreichbar unter: ' + v('kontakt'), '', 'Danke und liebe Grüße');

      var mail = form.getAttribute('data-mail') || 'schwarz@motorized.at';
      window.location.href = 'mailto:' + mail
        + '?subject=' + encodeURIComponent('Racing-Anfrage: ' + v('bike'))
        + '&body=' + encodeURIComponent(lines.join('\n'));
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

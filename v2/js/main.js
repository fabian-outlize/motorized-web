/* ==========================================================================
   Entwurf 2 — Bewegung
   Kein Framework. Weiches Scrollen, eigener Cursor, Aufzüge beim Scrollen,
   hochlaufende Zahlen und die Bildvorschau in der Leistungsliste.
   ========================================================================== */
(function () {
  'use strict';

  window.__v2 = true;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fein = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------------
     1) Weiches Scrollen
     Der Körper wird per transform verschoben und läuft der echten
     Scrollposition gedämpft hinterher. Das ist der Effekt, den die
     Referenzseiten über Lenis lösen — hier in zwanzig Zeilen.
     --------------------------------------------------------------- */
  var glatt = null;
  if (!reduce && fein) {
    var buehne = document.getElementById('stage');
    if (buehne) {
      var ziel = 0, ist = 0, laeuft = false;

      function hoehe() {
        document.body.style.height = buehne.getBoundingClientRect().height + 'px';
      }
      hoehe();
      addEventListener('resize', hoehe);
      if (window.ResizeObserver) new ResizeObserver(hoehe).observe(buehne);

      buehne.style.position = 'fixed';
      buehne.style.inset = '0 0 auto';
      buehne.style.willChange = 'transform';

      function takt() {
        ziel = scrollY;
        ist += (ziel - ist) * 0.11;
        if (Math.abs(ziel - ist) < 0.06) ist = ziel;
        buehne.style.transform = 'translate3d(0,' + (-ist).toFixed(2) + 'px,0)';
        requestAnimationFrame(takt);
      }
      requestAnimationFrame(takt);
      laeuft = true;
      glatt = { pos: function () { return ist; } };
    }
  }

  /* ---------------------------------------------------------------
     2) Eigener Cursor
     --------------------------------------------------------------- */
  if (fein && !reduce) {
    var cur = document.createElement('div');
    cur.className = 'cur';
    cur.innerHTML = '<span class="cur__t"></span>';
    document.body.appendChild(cur);
    var cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;

    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function folge() {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) translate(-50%,-50%)';
      requestAnimationFrame(folge);
    })();

    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('[data-cursor]');
      if (t) {
        cur.classList.add('is-big');
        cur.querySelector('.cur__t').textContent = t.getAttribute('data-cursor');
      } else if (!e.target.closest('.cur')) {
        cur.classList.remove('is-big');
      }
    });
  }

  /* ---------------------------------------------------------------
     3) Aufzüge beim Scrollen
     Ohne Skript ist alles sichtbar — die Klasse js kommt aus dem Kopf
     und wird von einem Wächter wieder entfernt, falls es hier klemmt.
     --------------------------------------------------------------- */
  var zuZeigen = [].slice.call(document.querySelectorAll('[data-rv], .up, .wipe'));
  if (reduce || !('IntersectionObserver' in window)) {
    zuZeigen.forEach(function (n) { n.classList.add('is-in'); });
  } else {
    var beob = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        beob.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    zuZeigen.forEach(function (n) { beob.observe(n); });
  }

  /* ---------------------------------------------------------------
     4) Zahlen laufen hoch
     --------------------------------------------------------------- */
  var zahlen = [].slice.call(document.querySelectorAll('[data-zahl]'));
  if (zahlen.length && !reduce && 'IntersectionObserver' in window) {
    var zb = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        zb.unobserve(e.target);
        var el = e.target;
        var bis = parseFloat(el.getAttribute('data-zahl'));
        var suffix = el.getAttribute('data-suffix') || '';
        var start = performance.now(), dauer = 1400;
        (function tick(jetzt) {
          var p = Math.min(1, (jetzt - start) / dauer);
          var e2 = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.round(bis * e2) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.5 });
    zahlen.forEach(function (n) { zb.observe(n); });
  }

  /* ---------------------------------------------------------------
     5) Kopfzeile wird fest
     --------------------------------------------------------------- */
  var hdr = document.getElementById('hdr');
  function beimScrollen() {
    if (hdr) hdr.classList.toggle('is-solid', (glatt ? glatt.pos() : scrollY) > 40);
  }
  addEventListener('scroll', beimScrollen, { passive: true });
  beimScrollen();

  /* ---------------------------------------------------------------
     6) Mobiles Menü
     --------------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var mnav = document.getElementById('mnav');
  function menue(auf) {
    document.body.classList.toggle('nav-on', auf);
    if (burger) burger.setAttribute('aria-expanded', String(auf));
  }
  if (burger) burger.addEventListener('click', function () {
    menue(!document.body.classList.contains('nav-on'));
  });
  if (mnav) mnav.addEventListener('click', function (e) { if (e.target.closest('a')) menue(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') menue(false); });

  /* ---------------------------------------------------------------
     7) Bildvorschau in der Leistungsliste
     --------------------------------------------------------------- */
  var liste = document.getElementById('idxList');
  var peek = document.getElementById('peek');
  var peekImg = document.getElementById('peekImg');

  if (liste && peek && peekImg) {
    var px = 0, py = 0, zx = 0, zy = 0, an = false, raf = null;
    function erlaubt() { return matchMedia('(hover: hover) and (min-width: 58rem)').matches && !reduce; }

    function setzen() {
      var dreh = Math.max(-10, Math.min(10, (zx - px) * 0.14));
      peek.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) '
        + 'translate(-50%,-50%) rotate(' + dreh.toFixed(2) + 'deg) scale(' + (an ? 1 : 0.9) + ')';
    }
    function schleife() {
      px += (zx - px) * 0.16; py += (zy - py) * 0.16;
      setzen();
      raf = (an || Math.abs(zx - px) > 0.5) ? requestAnimationFrame(schleife) : null;
    }
    function los() { if (!raf) raf = requestAnimationFrame(schleife); }

    liste.addEventListener('pointermove', function (e) {
      if (!erlaubt()) return;
      var r = liste.getBoundingClientRect();
      zx = e.clientX - r.left; zy = e.clientY - r.top;
      los();
    });

    [].forEach.call(liste.querySelectorAll('[data-img]'), function (row) {
      var vor = new Image(); vor.src = row.getAttribute('data-img');
      row.addEventListener('pointerenter', function (e) {
        if (!erlaubt() || e.pointerType === 'touch') return;
        var src = row.getAttribute('data-img');
        if (peekImg.getAttribute('src') !== src) peekImg.setAttribute('src', src);
        if (!an) {
          var r = liste.getBoundingClientRect();
          px = zx = e.clientX - r.left; py = zy = e.clientY - r.top;
        }
        an = true; peek.classList.add('is-on'); setzen(); los();
      });
      row.addEventListener('pointerleave', function () {
        an = false; peek.classList.remove('is-on'); los();
      });
    });
    liste.addEventListener('pointerleave', function () {
      an = false; peek.classList.remove('is-on');
    });
  }

  /* ---------------------------------------------------------------
     8) Anker sanft anspringen
     --------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var ziel = document.querySelector(id);
    if (!ziel) return;
    e.preventDefault();
    var oben = ziel.getBoundingClientRect().top + (glatt ? glatt.pos() : scrollY) - 20;
    scrollTo({ top: Math.max(0, oben), behavior: reduce ? 'auto' : 'smooth' });
  });
})();

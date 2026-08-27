/* ==========================================================================
   Cookie-Zustimmung + Tracking
   --------------------------------------------------------------------------
   Grundregel: Vor der Zustimmung wird NICHTS von Google oder Meta geladen.
   Kein Skript, kein Pixel, kein Cookie. Erst wenn der Besucher zustimmt,
   werden GTM und/oder der Facebook-Pixel nachgeladen.

   Die IDs kommen aus content/tracking.json und werden beim Bauen der Seiten
   als window.SM_TRACKING in die Seite geschrieben. Sind sie leer, passiert
   hier gar nichts und das Banner erscheint erst gar nicht.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SM_TRACKING || {};
  var KEY = 'sm-consent-v1';

  var hasTools = !!(CFG.aktiv && (CFG.gtm_id || CFG.facebook_pixel_id));

  /* ---------------------------------------------------------- Zustand */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ------------------------------------------------- Google Consent Mode */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // Vor allem anderen: alles verweigert. GTM liest das, sobald es startet.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  /* ------------------------------------------------------- Tools laden */
  var loaded = { gtm: false, fb: false };

  function loadGTM(id) {
    if (loaded.gtm || !id) return;
    loaded.gtm = true;
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  function loadPixel(id) {
    if (loaded.fb || !id) return;
    loaded.fb = true;
    /* Meta-Pixel-Loader, gekürzt auf das Nötige */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function apply(state) {
    if (!hasTools) return;
    var marketing = !!state.marketing;
    var statistik = !!state.statistik;

    gtag('consent', 'update', {
      ad_storage: marketing ? 'granted' : 'denied',
      ad_user_data: marketing ? 'granted' : 'denied',
      ad_personalization: marketing ? 'granted' : 'denied',
      analytics_storage: statistik ? 'granted' : 'denied'
    });

    if (marketing || statistik) loadGTM(CFG.gtm_id);
    if (marketing) loadPixel(CFG.facebook_pixel_id);

    window.dataLayer.push({
      event: 'sm_consent',
      sm_consent_marketing: marketing,
      sm_consent_statistik: statistik
    });
  }

  /* ------------------------------------------------------------ Banner */
  var el = null;

  function close() {
    if (!el) return;
    el.classList.remove('is-open');
    setTimeout(function () { if (el) { el.remove(); el = null; } }, 320);
  }

  function decide(marketing, statistik) {
    var state = {
      marketing: marketing, statistik: statistik,
      zeit: new Date().toISOString()
    };
    save(state);
    apply(state);
    close();
  }

  function banner(existing) {
    if (el) return;
    var st = existing || { marketing: false, statistik: false };
    el = document.createElement('div');
    el.className = 'cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', 'Cookie-Einstellungen');
    el.innerHTML =
      '<div class="cc__box">' +
        '<h2 class="cc__h">Cookies</h2>' +
        '<p class="cc__t">Wir verwenden Cookies nur, wenn du zustimmst. Notwendige Funktionen ' +
          'laufen ohne. Für Statistik und Marketing binden wir Dienste von Google und Meta ein — ' +
          'die laden erst nach deiner Zustimmung.</p>' +
        '<div class="cc__opts">' +
          '<label class="cc__opt cc__opt--fixed">' +
            '<input type="checkbox" checked disabled>' +
            '<span><b>Notwendig</b>Damit die Seite funktioniert. Immer aktiv.</span>' +
          '</label>' +
          '<label class="cc__opt">' +
            '<input type="checkbox" id="ccStat"' + (st.statistik ? ' checked' : '') + '>' +
            '<span><b>Statistik</b>Hilft uns zu verstehen, wie die Seite genutzt wird.</span>' +
          '</label>' +
          '<label class="cc__opt">' +
            '<input type="checkbox" id="ccMark"' + (st.marketing ? ' checked' : '') + '>' +
            '<span><b>Marketing</b>Erlaubt uns, dir passende Werbung auszuspielen.</span>' +
          '</label>' +
        '</div>' +
        '<div class="cc__acts">' +
          '<button class="btn" type="button" id="ccAll">Alle akzeptieren</button>' +
          '<button class="btn btn--ghost" type="button" id="ccSel">Auswahl speichern</button>' +
          '<button class="btn btn--ghost" type="button" id="ccNone">Nur notwendige</button>' +
        '</div>' +
        '<p class="cc__links"><a href="' + (window.SM_BASE || '') + 'datenschutz/">Datenschutz</a>' +
          '<a href="' + (window.SM_BASE || '') + 'impressum/">Impressum</a></p>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-open'); });

    el.querySelector('#ccAll').addEventListener('click', function () { decide(true, true); });
    el.querySelector('#ccNone').addEventListener('click', function () { decide(false, false); });
    el.querySelector('#ccSel').addEventListener('click', function () {
      decide(el.querySelector('#ccMark').checked, el.querySelector('#ccStat').checked);
    });
  }

  /* --------------------------------------------------------------- Start */
  var state = read();
  if (state) {
    apply(state);
  } else if (hasTools) {
    // Banner erst zeigen, wenn wirklich etwas zuzustimmen ist
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { banner(null); });
    } else {
      banner(null);
    }
  }

  // Footer-Link „Cookie-Einstellungen“ öffnet das Banner erneut
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cookie-settings]');
    if (!t) return;
    e.preventDefault();
    if (!hasTools) {
      alert('Diese Seite lädt aktuell keine Dienste von Dritten. Es gibt nichts einzustellen.');
      return;
    }
    banner(read());
  });

  window.SM_CONSENT = { get: read, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} } };
})();

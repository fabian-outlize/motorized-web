/* Anmeldeseite. Bei Erfolg geht es weiter auf app.html — das CMS liegt
   bewusst auf einer eigenen Seite. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  function dbg(line) {
    var box = $('#loginLog');
    box.hidden = false;
    box.textContent += (box.textContent ? '\n' : '')
      + new Date().toISOString().slice(11, 19) + '  ' + line;
    box.scrollTop = box.scrollHeight;
    console.log('[CMS]', line);
  }
  function fail(msg) {
    var e = $('#loginErr');
    e.textContent = msg; e.hidden = false;
    dbg('FEHLER: ' + msg);
  }
  window.addEventListener('unhandledrejection', function (e) {
    dbg('UNBEHANDELT: ' + (e.reason && e.reason.message || e.reason));
  });

  function go() { location.href = 'app.html'; }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn');
    $('#loginErr').hidden = true;
    $('#loginLog').textContent = '';

    var token = $('#token').value.trim();
    if (!token) { fail('Bitte zuerst den GitHub-Token einfügen.'); $('#token').focus(); return; }

    var repoStr = ($('#repo').value.trim()) || SM.knownRepo();
    if (!repoStr) {
      $('#repoField').hidden = false;
      fail('Ich konnte das Repository nicht automatisch erkennen — bitte unten eintragen '
           + '(Form: benutzername/repository) und erneut auf Anmelden klicken.');
      return;
    }
    repoStr = repoStr.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
    var parts = repoStr.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      $('#repoField').hidden = false;
      fail('„' + repoStr + '" sieht nicht wie ein Repository aus. Erwartet: benutzername/repository');
      return;
    }

    btn.disabled = true;
    dbg('Start — Repository ' + parts.join('/') + ', Token ' + token.length + ' Zeichen');

    SM.connect(token, parts[0], parts[1], function (t) { btn.textContent = t; dbg(t); })
      .then(function () {
        SM.remember(token, parts.join('/'));
        if (!$('#remember').checked) {
          // nur für diese Sitzung: beim Schließen des Tabs wieder vergessen
          window.addEventListener('pagehide', function () { SM.forget(); });
        }
        go();
      })
      .catch(function (ex) {
        dbg('Abbruch: ' + (ex && ex.message || ex));
        fail(SM.describeError(ex, parts.join('/')));
        btn.disabled = false; btn.textContent = 'Anmelden';
      });
  });

  /* Wer schon angemeldet ist, wird direkt durchgereicht. */
  SM.loadConfig().then(function () {
    var s = SM.saved();
    if (s.token && s.repo) go();
  });
})();

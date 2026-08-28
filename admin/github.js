/* ==========================================================================
   Gemeinsame Grundlage von Anmeldeseite und CMS.
   Spricht direkt mit der GitHub-API — kein eigener Server.
   Der Token liegt nur im Browser (localStorage) und geht ausschließlich
   an api.github.com.
   ========================================================================== */
window.SM = (function () {
  'use strict';

  var API = 'https://api.github.com';
  var LS_TOKEN = 'sm-cms-token';
  var LS_REPO = 'sm-cms-repo';
  var TIMEOUT = 20000;

  var FILES = ['settings.json', 'tracking.json', 'services.json', 'bikes.json',
               'team.json', 'faq.json', 'testimonials.json', 'seo.json'];

  var state = {
    token: null, owner: null, repo: null, branch: 'main',
    files: {}, original: {}, images: [], uploads: {}
  };

  var CONFIG = { owner: '', repo: '' };

  function loadConfig() {
    return fetch('config.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { if (c && c.owner && c.repo) CONFIG = c; })
      .catch(function () {});
  }

  function knownRepo() {
    var ls = (localStorage.getItem(LS_REPO) || '').trim();
    if (ls) return ls;
    if (CONFIG.owner && CONFIG.repo) return CONFIG.owner + '/' + CONFIG.repo;
    return '';
  }

  function b64decode(str) { return decodeURIComponent(escape(atob(str.replace(/\n/g, '')))); }

  function api(path, opts) {
    opts = opts || {};
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    return fetch(API + path, {
      method: opts.method || 'GET',
      signal: ctl ? ctl.signal : undefined,
      headers: {
        'Authorization': 'Bearer ' + state.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) {
        return r.text().then(function (t) {
          var msg = r.status + ' ' + r.statusText;
          try { msg = JSON.parse(t).message || msg; } catch (e) {}
          throw new Error(msg + ' (' + path + ')');
        });
      }
      return r.status === 204 ? null : r.json();
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') {
        throw new Error('Zeitüberschreitung nach 20 Sekunden bei ' + path
                        + ' — die Anfrage an GitHub kam nicht zurück.');
      }
      throw err;
    });
  }

  function repoPath(p) { return '/repos/' + state.owner + '/' + state.repo + p; }

  function connect(token, owner, repo, onStep) {
    var step = onStep || function () {};
    state.token = token; state.owner = owner; state.repo = repo;
    step('Verbinde…');
    return api(repoPath('')).then(function (r) {
      state.branch = r.default_branch || 'main';
      var done = 0;
      step('Lade Inhalte 0/' + FILES.length + '…');
      return Promise.all(FILES.map(function (f) {
        return api(repoPath('/contents/content/' + f + '?ref=' + state.branch))
          .then(function (res) {
            state.files[f] = JSON.parse(b64decode(res.content));
            state.original[f] = JSON.stringify(state.files[f]);
            step('Lade Inhalte ' + (++done) + '/' + FILES.length + '…');
          });
      }));
    }).then(function () {
      step('Lade Bilder…');
      return api(repoPath('/contents/assets/web?ref=' + state.branch))
        .then(function (list) {
          state.images = list.filter(function (x) { return x.type === 'file'; })
                             .map(function (x) { return x.name; }).sort();
        }).catch(function () { state.images = []; });
    });
  }

  function saved() {
    return { token: localStorage.getItem(LS_TOKEN), repo: knownRepo() };
  }

  function remember(token, repo) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_REPO, repo);
  }

  function forget() { localStorage.removeItem(LS_TOKEN); }

  function dirty() {
    return FILES.filter(function (f) {
      return JSON.stringify(state.files[f]) !== state.original[f];
    });
  }

  /* Alles Geänderte in EINEM Commit — sonst löst jede Datei einen
     eigenen Build aus und die Historie wird unlesbar. */
  function publish() {
    var changed = dirty();
    var uploads = Object.keys(state.uploads);
    var baseCommit, baseTree;

    return api(repoPath('/git/ref/heads/' + state.branch))
      .then(function (r) { return api(repoPath('/git/commits/' + r.object.sha)); })
      .then(function (c) {
        baseCommit = c; baseTree = c.tree.sha;
        return Promise.all(
          changed.map(function (f) {
            return api(repoPath('/git/blobs'), {
              method: 'POST',
              body: { content: JSON.stringify(state.files[f], null, 2) + '\n', encoding: 'utf-8' }
            }).then(function (b) { return { path: 'content/' + f, sha: b.sha }; });
          }).concat(uploads.map(function (p) {
            return api(repoPath('/git/blobs'), {
              method: 'POST', body: { content: state.uploads[p], encoding: 'base64' }
            }).then(function (b) { return { path: p, sha: b.sha }; });
          })));
      })
      .then(function (entries) {
        return api(repoPath('/git/trees'), {
          method: 'POST',
          body: {
            base_tree: baseTree,
            tree: entries.map(function (e) {
              return { path: e.path, mode: '100644', type: 'blob', sha: e.sha };
            })
          }
        });
      })
      .then(function (tree) {
        var what = changed.map(function (f) { return f.replace('.json', ''); });
        if (uploads.length) what.push(uploads.length + ' Bild(er)');
        return api(repoPath('/git/commits'), {
          method: 'POST',
          body: { message: 'Inhalte aktualisiert: ' + what.join(', '),
                  tree: tree.sha, parents: [baseCommit.sha] }
        });
      })
      .then(function (commit) {
        return api(repoPath('/git/refs/heads/' + state.branch),
                   { method: 'PATCH', body: { sha: commit.sha } });
      })
      .then(function () {
        changed.forEach(function (f) { state.original[f] = JSON.stringify(state.files[f]); });
        state.uploads = {};
      });
  }

  function describeError(ex, repoLabel) {
    var m = String(ex && ex.message || ex);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m))
      return 'Keine Verbindung zu api.github.com. Blockt ein Adblocker oder eine Erweiterung '
           + 'die Anfrage? Versuch es einmal in einem privaten Fenster.';
    if (/Bad credentials|401/.test(m))
      return 'Der Token wird von GitHub abgelehnt. Ist er vollständig kopiert und noch gültig?';
    if (/Not Found|404/.test(m))
      return 'Repository „' + repoLabel + '" nicht gefunden — oder der Token hat keinen Zugriff '
           + 'darauf. Bei „Repository access" muss dieses Repository ausgewählt sein.';
    if (/Zeitüberschreitung/.test(m))
      return m + ' Meist blockt eine Erweiterung die Verbindung zu api.github.com.';
    if (/403/.test(m) || /rate limit/i.test(m))
      return 'GitHub verweigert den Zugriff (403). Fehlt dem Token die Berechtigung '
           + '„Contents: Read and write"?';
    return m;
  }

  return {
    FILES: FILES, state: state, api: api, repoPath: repoPath,
    loadConfig: loadConfig, knownRepo: knownRepo, connect: connect,
    saved: saved, remember: remember, forget: forget,
    dirty: dirty, publish: publish, describeError: describeError
  };
})();

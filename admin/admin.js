/* ==========================================================================
   CMS für motorized.at
   --------------------------------------------------------------------------
   Kein Server. Die Seite spricht direkt mit der GitHub-API:
   Inhalte lesen → im Browser bearbeiten → als EIN Commit zurückschreiben.
   Danach baut die GitHub Action die HTML-Seiten neu.

   Der Token liegt nur im Browser des Nutzers (localStorage). Er wird nie an
   uns oder Dritte übertragen — nur an api.github.com.
   ========================================================================== */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var LS_TOKEN = 'sm-cms-token';
  var LS_REPO = 'sm-cms-repo';

  var state = {
    token: null, owner: null, repo: null, branch: 'main',
    files: {},        // pfad -> geparster Inhalt
    original: {},     // pfad -> JSON-String beim Laden
    images: [],       // Dateinamen in assets/web
    uploads: {},      // pfad -> base64 (neu hochgeladene Bilder)
    view: 'bikes'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };

  // Vorgabe aus admin/config.json — damit Benutzername und Repository nicht
  // jeder von Hand eintippen muss. localStorage sticht die Vorgabe.
  var CONFIG = { owner: '', repo: '' };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* ------------------------------------------------------------- Toast */
  var toastT;
  function toast(msg, warn) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (warn ? ' is-warn' : '');
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, warn ? 6000 : 3000);
  }

  /* --------------------------------------------------------- GitHub-API */
  var API_TIMEOUT = 20000;   // nach 20 s gilt eine Anfrage als hängen geblieben

  function api(path, opts) {
    opts = opts || {};
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, API_TIMEOUT);

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
    }, function (netErr) {
      clearTimeout(timer);
      if (netErr && netErr.name === 'AbortError') {
        throw new Error('Zeitüberschreitung nach 20 Sekunden bei ' + path
          + ' — die Anfrage an GitHub kam nicht zurück.');
      }
      throw netErr;
    });
  }

  function repoPath(p) {
    return '/repos/' + state.owner + '/' + state.repo + p;
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
  }

  /* ------------------------------------------------------------ Anmelden */
  var FILES = ['settings.json', 'tracking.json', 'services.json',
               'bikes.json', 'team.json', 'faq.json', 'testimonials.json', 'seo.json'];

  function login(token, owner, repo, onStep) {
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
            var txt = b64decode(res.content);
            state.files[f] = JSON.parse(txt);
            state.original[f] = JSON.stringify(state.files[f]);
            done++;
            step('Lade Inhalte ' + done + '/' + FILES.length + '…');
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

  function knownRepo() {
    var ls = (localStorage.getItem(LS_REPO) || '').trim();
    if (ls) return ls;
    if (CONFIG.owner && CONFIG.repo) return CONFIG.owner + '/' + CONFIG.repo;
    return '';
  }

  function showRepoField() {
    var f = $('#repoField');
    if (f) { f.hidden = false; $('#repo').value = knownRepo(); }
  }

  function dbg(line) {
    var box = $('#loginLog');
    if (!box) return;
    box.hidden = false;
    var t = new Date().toISOString().slice(11, 19);
    box.textContent += (box.textContent ? '\n' : '') + t + '  ' + line;
    box.scrollTop = box.scrollHeight;
    console.log('[CMS]', line);
  }

  window.addEventListener('unhandledrejection', function (e) {
    dbg('UNBEHANDELT: ' + (e.reason && e.reason.message || e.reason));
  });

  function fail(msg) {
    var err = $('#loginErr');
    err.textContent = msg;
    err.hidden = false;
    dbg('FEHLER: ' + msg);
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'), err = $('#loginErr');
    err.hidden = true;

    var token = $('#token').value.trim();
    if (!token) { fail('Bitte zuerst den GitHub-Token einfügen.'); $('#token').focus(); return; }

    var repoStr = ($('#repo') && $('#repo').value.trim()) || knownRepo();
    if (!repoStr) {
      showRepoField();
      fail('Ich konnte das Repository nicht automatisch erkennen — bitte unten eintragen '
           + '(Form: benutzername/repository) und erneut auf Anmelden klicken.');
      return;
    }

    repoStr = repoStr.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
    var parts = repoStr.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      showRepoField();
      fail('„' + repoStr + '" sieht nicht wie ein Repository aus. Erwartet: benutzername/repository');
      return;
    }

    btn.disabled = true; btn.textContent = 'Verbinde…';
    $('#loginLog').textContent = '';
    dbg('Start — Repository ' + parts.join('/') + ', Token ' + token.length + ' Zeichen'
        + ' (' + token.slice(0, 11) + '…)');

    login(token, parts[0], parts[1], function (txt) {
      btn.textContent = txt;
      dbg(txt);
    }).then(function () {
      dbg('Alle Daten geladen — öffne die Oberfläche');
      if ($('#remember').checked) {
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_REPO, parts.join('/'));
      }
      try { start(); }
      catch (uiEx) { dbg('Oberfläche konnte nicht aufgebaut werden: ' + uiEx.message); throw uiEx; }
    }).catch(function (ex) {
      var m = String(ex && ex.message || ex);
      dbg('Abbruch: ' + m);
      if (ex && ex.stack) dbg(String(ex.stack).split('\n').slice(0, 3).join(' | '));
      console.warn('[CMS] Anmeldung fehlgeschlagen:', m);
      if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
        fail('Keine Verbindung zu api.github.com. Blockt ein Adblocker oder eine '
             + 'Erweiterung die Anfrage? Bitte kurz deaktivieren und erneut versuchen.');
      } else if (/Bad credentials|401/.test(m)) {
        fail('Der Token wird von GitHub abgelehnt. Ist er vollständig kopiert und noch gültig?');
      } else if (/Not Found|404/.test(m)) {
        showRepoField();
        fail('Repository „' + parts.join('/') + '" nicht gefunden — oder der Token hat keinen '
             + 'Zugriff darauf. Bei „Repository access" muss dieses Repository ausgewählt sein.');
      } else if (/Zeitüberschreitung/.test(m)) {
        fail(m + ' Meist blockt eine Erweiterung (Adblocker, Privacy-Tool, VPN) die '
             + 'Verbindung zu api.github.com. Versuch es einmal in einem privaten Fenster.');
      } else if (/403/.test(m) || /rate limit/i.test(m)) {
        fail('GitHub verweigert den Zugriff (403). Fehlt dem Token die Berechtigung '
             + '„Contents: Read and write"?');
      } else {
        fail('Anmeldung fehlgeschlagen: ' + m);
      }
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Anmelden';
    });
  });

  $('#logoutBtn').addEventListener('click', function () {
    if (dirty().length && !confirm('Es gibt ungespeicherte Änderungen. Wirklich abmelden?')) return;
    localStorage.removeItem(LS_TOKEN);
    location.reload();
  });

  /* -------------------------------------------------------- Änderungen */
  function dirty() {
    return FILES.filter(function (f) {
      return JSON.stringify(state.files[f]) !== state.original[f];
    });
  }

  function touched() {
    var n = dirty().length + Object.keys(state.uploads).length;
    var bar = $('#savebar'), st = $('#state');
    bar.classList.toggle('is-on', n > 0);
    $('#savebarT').textContent = n === 1 ? '1 Änderung offen' : n + ' Änderungen offen';
    if (!n) { st.className = 'top__state'; st.textContent = ''; }
    renderSide();
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty().length || Object.keys(state.uploads).length) {
      e.preventDefault(); e.returnValue = '';
    }
  });

  $('#discardBtn').addEventListener('click', function () {
    if (!confirm('Alle offenen Änderungen verwerfen und den zuletzt veröffentlichten Stand laden?')) return;
    FILES.forEach(function (f) { state.files[f] = JSON.parse(state.original[f]); });
    state.uploads = {};
    open_ = null;
    touched(); render();
    toast('Änderungen verworfen.');
  });

  /* ----------------------------------------------------- Veröffentlichen */
  $('#publishBtn').addEventListener('click', function () {
    var changed = dirty();
    var uploads = Object.keys(state.uploads);
    if (!changed.length && !uploads.length) return;

    var btn = this;
    btn.disabled = true; btn.textContent = 'Veröffentliche…';

    var ref, baseCommit, baseTree;
    api(repoPath('/git/ref/heads/' + state.branch))
      .then(function (r) {
        ref = r; return api(repoPath('/git/commits/' + r.object.sha));
      })
      .then(function (c) {
        baseCommit = c; baseTree = c.tree.sha;
        var blobs = changed.map(function (f) {
          return api(repoPath('/git/blobs'), {
            method: 'POST',
            body: { content: JSON.stringify(state.files[f], null, 2) + '\n', encoding: 'utf-8' }
          }).then(function (b) { return { path: 'content/' + f, sha: b.sha }; });
        }).concat(uploads.map(function (p) {
          return api(repoPath('/git/blobs'), {
            method: 'POST', body: { content: state.uploads[p], encoding: 'base64' }
          }).then(function (b) { return { path: p, sha: b.sha }; });
        }));
        return Promise.all(blobs);
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
          body: {
            message: 'Inhalte aktualisiert: ' + what.join(', '),
            tree: tree.sha, parents: [baseCommit.sha]
          }
        });
      })
      .then(function (commit) {
        return api(repoPath('/git/refs/heads/' + state.branch), {
          method: 'PATCH', body: { sha: commit.sha }
        });
      })
      .then(function () {
        changed.forEach(function (f) { state.original[f] = JSON.stringify(state.files[f]); });
        state.uploads = {};
        touched();
        $('#state').className = 'top__state is-ok';
        $('#state').textContent = 'Veröffentlicht — die Seite baut jetzt neu (1–2 Minuten)';
        toast('Gespeichert. Die Website aktualisiert sich in ein bis zwei Minuten.');
        render();
      })
      .catch(function (ex) {
        toast('Fehler beim Veröffentlichen: ' + (ex.message || ex), true);
      })
      .then(function () {
        btn.textContent = 'Änderungen veröffentlichen';
        touched();
      });
  });

  /* --------------------------------------------------------- Navigation */
  var VIEWS = [
    { id: 'bikes',        label: 'Motorräder',  ico: '\u{1F3CD}', file: 'bikes.json' },
    { id: 'services',     label: 'Leistungen',  ico: '\u{1F527}', file: 'services.json' },
    { id: 'team',         label: 'Team',        ico: '\u{1F464}', file: 'team.json' },
    { id: 'faq',          label: 'FAQ',         ico: '\u{2753}',  file: 'faq.json' },
    { id: 'testimonials', label: 'Rezensionen', ico: '\u{2B50}',  file: 'testimonials.json' },
    { id: 'seo',          label: 'SEO & Teilen',ico: '\u{1F50D}', file: 'seo.json' },
    { id: 'settings',     label: 'Kontaktdaten',ico: '\u{1F4CD}', file: 'settings.json' },
    { id: 'tracking',     label: 'Tracking',    ico: '\u{1F4CA}', file: 'tracking.json' }
  ];

  var open_ = null;      // welcher Eintrag gerade aufgeklappt ist
  var filter = '';       // Suchbegriff der aktuellen Liste

  function renderSide() {
    var side = $('#side');
    side.innerHTML = '';
    VIEWS.forEach(function (v) {
      var b = el('button', 'side__b' + (state.view === v.id ? ' is-on' : ''));
      b.type = 'button';
      b.append(el('span', 'side__ico', v.ico), el('span', null, v.label));
      var data = state.files[v.file];
      if (JSON.stringify(data) !== state.original[v.file]) {
        var d = el('span', 'dot');
        d.title = 'ungespeicherte Änderungen';
        b.append(d);
      } else if (Array.isArray(data)) {
        b.append(el('span', 'count', data.length));
      }
      b.addEventListener('click', function () {
        state.view = v.id; open_ = null; filter = ''; render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      side.append(b);
    });
  }

  /* ------------------------------------------------------- Feld-Helfer */
  function field(label, value, onChange, opts) {
    opts = opts || {};
    var wrap = el('label', 'f');
    if (label) wrap.append(el('span', 'f__l', label));
    var input;
    if (opts.type === 'textarea') {
      input = el('textarea', 'f__ta');
      input.rows = opts.rows || 3;
    } else if (opts.type === 'select') {
      input = el('select', 'f__sel');
      (opts.options || []).forEach(function (o) {
        var op = el('option', null, o.label != null ? o.label : o);
        op.value = o.value != null ? o.value : o;
        input.append(op);
      });
    } else {
      input = el('input', 'f__i');
      input.type = opts.type || 'text';
    }
    input.value = value == null ? '' : value;
    if (opts.placeholder) input.placeholder = opts.placeholder;

    var counter = null;
    if (opts.max) {
      counter = el('span', 'f__hint');
      var paint = function () {
        var n = input.value.length;
        counter.textContent = n + ' von ' + opts.max + ' Zeichen'
          + (n > opts.max ? ' — zu lang, Google kürzt das ab' : (n < (opts.min || 0) ? ' — noch etwas kurz' : ' ✓'));
        counter.style.color = n > opts.max ? 'var(--warn)' : (n < (opts.min || 0) ? 'var(--ink-3)' : 'var(--ok)');
      };
      paint();
      input.addEventListener('input', paint);
    }

    var fire = function () { onChange(input.value); touched(); if (opts.live) opts.live(); };
    input.addEventListener('input', fire);
    if (opts.type === 'select') input.addEventListener('change', fire);

    wrap.append(input);
    if (opts.hint) wrap.append(el('span', 'f__hint', opts.hint));
    if (counter) wrap.append(counter);
    if (opts.type === 'select') input.value = value == null ? '' : value;
    return wrap;
  }

  function checkbox(label, value, onChange) {
    var wrap = el('label', 'f f--check');
    var i = el('input');
    i.type = 'checkbox'; i.checked = !!value;
    i.addEventListener('change', function () { onChange(i.checked); touched(); });
    wrap.append(i, el('span', null, label));
    return wrap;
  }

  function group(title, nodes) {
    var g = el('div', 'f');
    if (title) g.append(el('span', 'f__l', title));
    nodes.forEach(function (n) { g.append(n); });
    g.style.gap = '.7rem';
    return g;
  }

  function row(nodes) {
    var g = el('div', 'grid2');
    nodes.forEach(function (n) { g.append(n); });
    return g;
  }

  function imagePicker(label, value, onChange, opts) {
    opts = opts || {};
    var wrap = el('div', 'imgpick');
    var top = el('div', 'imgpick__row');
    var img = el('img');
    img.alt = '';
    var setPreview = function (v) {
      img.src = v ? '../assets/web/' + v : '';
      img.style.visibility = v ? 'visible' : 'hidden';
    };
    setPreview(value);
    if (opts.round) img.className = 'item__thumb--round';

    var f = field(label, value, function (v) { onChange(v); setPreview(v); if (opts.live) opts.live(); }, {
      type: 'select',
      options: [{ value: '', label: '— kein Bild —' }].concat(state.images.map(function (n) {
        return { value: n, label: n };
      }))
    });
    var sel = f.querySelector('select');
    if (sel) sel.value = value || '';

    top.append(img, f);

    var up = el('label', 'imgpick__up');
    up.append('↑ Bild hochladen');
    var inp = el('input');
    inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp';
    inp.addEventListener('change', function () {
      var file = inp.files && inp.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast('Das Bild ist größer als 4 MB. Bitte kleiner speichern.', true);
        inp.value = ''; return;
      }
      var name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
      var reader = new FileReader();
      reader.onload = function () {
        state.uploads['assets/web/' + name] = String(reader.result).split(',')[1];
        if (state.images.indexOf(name) === -1) { state.images.push(name); state.images.sort(); }
        onChange(name); setPreview(name);
        if (sel) {
          if (!sel.querySelector('option[value="' + name + '"]')) {
            var op = el('option', null, name); op.value = name; sel.append(op);
          }
          sel.value = name;
        }
        touched();
        if (opts.live) opts.live();
        toast('Bild vorgemerkt — es wird beim Veröffentlichen hochgeladen.');
      };
      reader.readAsDataURL(file);
    });
    up.append(inp);

    wrap.append(top, up);
    return wrap;
  }

  function btn(label, cls, fn) {
    var b = el('button', 'btn btn--sm' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(e); });
    return b;
  }

  /* Ein Listeneintrag: eingeklappt eine Zeile, aufgeklappt das Formular.
     Es ist immer nur einer offen — sonst wird die Liste wieder endlos. */
  function item(key, opts) {
    var isOpen = open_ === key;
    var it = el('div', 'item' + (isOpen ? ' is-open' : ''));

    var head = el('button', 'item__h');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(isOpen));

    if (opts.thumb !== undefined) {
      var th = el('img', 'item__thumb' + (opts.round ? ' item__thumb--round' : ''));
      th.alt = '';
      th.src = opts.thumb ? '../assets/web/' + opts.thumb : '';
      th.style.visibility = opts.thumb ? 'visible' : 'hidden';
      head.append(th);
    }

    var main = el('div', 'item__main');
    main.append(el('div', 'item__t', opts.title || '(ohne Titel)'));
    if (opts.sub) main.append(el('div', 'item__sub', opts.sub));
    head.append(main);

    (opts.tags || []).forEach(function (t) {
      if (t) head.append(el('span', 'item__tag' + (t.cls ? ' ' + t.cls : ''), t.text));
    });
    head.append(el('span', 'item__caret', '▼'));

    head.addEventListener('click', function () {
      open_ = isOpen ? null : key;
      render();
      if (!isOpen) {
        requestAnimationFrame(function () {
          var n = document.querySelector('.item.is-open');
          if (n) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    });
    it.append(head);

    if (isOpen) {
      var body = el('div', 'item__b');
      opts.body().forEach(function (n) { body.append(n); });
      if (opts.actions) {
        var a = el('div', 'item__acts');
        opts.actions().forEach(function (n) { a.append(n); });
        body.append(a);
      }
      it.append(body);
    }
    return it;
  }

  function moveBtns(arr, i) {
    return [
      btn('↑', '', function () {
        if (i > 0) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); touched(); render(); }
      }),
      btn('↓', '', function () {
        if (i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); touched(); render(); }
      })
    ];
  }

  function delBtn(label, arr, i, name) {
    return btn('Löschen', 'btn--danger', function () {
      if (confirm('„' + (name || 'Eintrag') + '" wirklich löschen?')) {
        arr.splice(i, 1); open_ = null; touched(); render();
      }
    });
  }

  function panel(opts) {
    var p = el('div', 'panel');
    var h = el('div', 'panel__h');
    var r = el('div', 'panel__row');
    var t = el('div');
    t.append(el('h2', 'panel__t', opts.title));
    if (opts.desc) t.append(el('p', 'panel__d', opts.desc));
    r.append(t);
    if (opts.head) { var sp = el('span'); sp.style.flex = '1'; r.append(sp); opts.head.forEach(function (n) { r.append(n); }); }
    h.append(r);
    if (opts.search) h.append(opts.search);
    p.append(h);

    var b = el('div', 'panel__b' + (opts.flush ? ' panel__b--flush' : ''));
    if (!opts.body.length) {
      b.append(el('div', 'empty', opts.empty || 'Noch nichts angelegt.'));
    } else {
      opts.body.forEach(function (n) { b.append(n); });
    }
    p.append(b);
    if (opts.add) { var bar = el('div', 'addbar'); bar.append(opts.add); p.append(bar); }
    return p;
  }

  function searchBox(placeholder) {
    var w = el('div', 'search');
    var i = el('input');
    i.type = 'search'; i.placeholder = placeholder; i.value = filter;
    i.addEventListener('input', function () { filter = i.value; render(); requestAnimationFrame(function () {
      var f = document.querySelector('.search input'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }); });
    w.append(i);
    return w;
  }

  function matches(hay) {
    if (!filter) return true;
    return String(hay).toLowerCase().indexOf(filter.toLowerCase()) !== -1;
  }

  /* --------------------------------------------------------- Ansichten */
  function viewBikes() {
    var arr = state.files['bikes.json'];
    var nodes = [];
    arr.forEach(function (b, i) {
      if (!matches(b.name + ' ' + b.kategorie + ' ' + (b.baujahr || ''))) return;
      var KAT = { gebraucht: 'Gebraucht', vorfuehrer: 'Vorführer', aktion: 'Neu-Aktion' };
      nodes.push(item('bike' + i, {
        thumb: b.bild,
        title: b.name,
        sub: [KAT[b.kategorie] || b.kategorie, b.baujahr, b.km, b.preis].filter(Boolean).join('  ·  '),
        tags: [
          b.startseite ? { text: 'Startseite', cls: 'is-note' } : null,
          b.aktiv ? { text: 'sichtbar', cls: 'is-on' } : { text: 'versteckt', cls: 'is-off' }
        ],
        body: function () {
          return [
            field('Name', b.name, function (v) { b.name = v; }),
            field('Kurzbeschreibung', b.kurz, function (v) { b.kurz = v; },
                  { type: 'textarea', hint: 'Ein bis zwei Sätze. Steht auf der Detailseite und dient Google als Beschreibung.' }),
            row([
              field('Baujahr', b.baujahr, function (v) { b.baujahr = v; }, { placeholder: '05/2025' }),
              field('Kilometerstand', b.km, function (v) { b.km = v; }, { placeholder: '1.300 km' })
            ]),
            row([
              field('Preis', b.preis, function (v) { b.preis = v; }, { placeholder: '€ 7.790,–' }),
              field('Kategorie', b.kategorie, function (v) { b.kategorie = v; }, {
                type: 'select',
                options: [{ value: 'gebraucht', label: 'Gebraucht' },
                          { value: 'vorfuehrer', label: 'Vorführer' },
                          { value: 'aktion', label: 'Neu-Aktion (nur Startseite)' }]
              })
            ]),
            imagePicker('Bild', b.bild, function (v) { b.bild = v; }),
            field('Bildbeschreibung', b.alt, function (v) { b.alt = v; },
                  { hint: 'Was ist zu sehen? Für Screenreader und Google.' }),
            field('Highlights', (b.highlights || []).join('\n'), function (v) {
              b.highlights = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
            }, { type: 'textarea', hint: 'Ein Punkt pro Zeile.' }),
            field('Störer auf dem Bild', b.flag, function (v) { b.flag = v; },
                  { placeholder: 'z. B. Top Gebrauchtbike', hint: 'Leer lassen für die Standardbeschriftung.' }),
            group('Anzeige', [
              checkbox('Sichtbar auf der Website', b.aktiv, function (v) { b.aktiv = v; }),
              checkbox('Zusätzlich auf der Startseite zeigen', b.startseite, function (v) { b.startseite = v; }),
              checkbox('Preis mit „ab" anzeigen', b.preis_ab, function (v) { b.preis_ab = v; })
            ])
          ];
        },
        actions: function () {
          var acts = moveBtns(arr, i);
          if (b.kategorie !== 'aktion' && b.aktiv) {
            var link = el('a', 'btn btn--sm btn--quiet', 'Seite ansehen ↗');
            link.href = '../bikes/' + b.slug + '/';
            link.target = '_blank'; link.rel = 'noopener';
            link.addEventListener('click', function (e) { e.stopPropagation(); });
            acts.push(link);
          }
          var sp = el('span', 'spacer'); acts.push(sp);
          acts.push(delBtn(null, arr, i, b.name));
          return acts;
        }
      }));
    });

    return panel({
      title: 'Motorräder',
      desc: 'Steht auf der Bikes-Seite und — wenn angehakt — auf der Startseite. Jedes sichtbare Motorrad bekommt automatisch eine eigene Detailseite.',
      search: arr.length > 4 ? searchBox('Motorrad suchen…') : null,
      body: nodes, flush: true,
      empty: filter ? 'Kein Motorrad gefunden.' : 'Noch kein Motorrad angelegt.',
      add: btn('+ Motorrad hinzufügen', 'btn--primary', function () {
        arr.unshift({
          slug: 'neues-bike-' + Date.now(), name: 'Neues Motorrad', kategorie: 'gebraucht',
          baujahr: '', km: '', preis: '', preis_ab: false, bild: '', alt: '', kurz: '',
          specs: '', highlights: [], aktiv: false, startseite: false, flag: ''
        });
        filter = ''; open_ = 'bike0'; touched(); render();
      })
    });
  }

  function viewServices() {
    var arr = state.files['services.json'];
    var nodes = arr.map(function (s, i) {
      return item('svc' + i, {
        thumb: s.bild, title: s.titel, sub: s.text,
        body: function () {
          return [
            field('Titel', s.titel, function (v) { s.titel = v; }),
            field('Text', s.text, function (v) { s.text = v; }, { type: 'textarea' }),
            imagePicker('Bild', s.bild, function (v) { s.bild = v; }),
            field('Bildbeschreibung', s.bild_alt, function (v) { s.bild_alt = v; }),
            field('Verlinkt auf', s.link, function (v) { s.link = v; }, {
              type: 'select',
              options: [{ value: '#kontakt', label: 'Kontaktbereich der Startseite' },
                        { value: 'racing/', label: 'Racing-Seite' },
                        { value: 'bikes/', label: 'Bikes-Seite' },
                        { value: 'BUCHUNG', label: 'Online-Terminbuchung' }]
            })
          ];
        },
        actions: function () {
          return moveBtns(arr, i).concat([el('span', 'spacer'), delBtn(null, arr, i, s.titel)]);
        }
      });
    });
    return panel({
      title: 'Leistungen', desc: 'Die Liste im Bereich „What we offer" auf der Startseite.',
      body: nodes, flush: true,
      add: btn('+ Leistung hinzufügen', 'btn--primary', function () {
        arr.push({ titel: 'Neue Leistung', text: '', bild: '', bild_alt: '', link: '#kontakt' });
        open_ = 'svc' + (arr.length - 1); touched(); render();
      })
    });
  }

  function viewTeam() {
    var arr = state.files['team.json'];
    var nodes = arr.map(function (m, i) {
      return item('team' + i, {
        thumb: m.bild, round: true, title: m.name, sub: m.rolle,
        body: function () {
          return [
            row([field('Name', m.name, function (v) { m.name = v; }),
                 field('Rolle', m.rolle, function (v) { m.rolle = v; })]),
            imagePicker('Foto', m.bild, function (v) { m.bild = v; })
          ];
        },
        actions: function () {
          return moveBtns(arr, i).concat([el('span', 'spacer'), delBtn(null, arr, i, m.name)]);
        }
      });
    });
    return panel({
      title: 'Team', desc: 'Die Reihenfolge hier ist die Reihenfolge auf der Startseite.',
      body: nodes, flush: true,
      add: btn('+ Person hinzufügen', 'btn--primary', function () {
        arr.push({ name: 'Neue Person', rolle: '', bild: '' });
        open_ = 'team' + (arr.length - 1); touched(); render();
      })
    });
  }

  function viewFaq() {
    var groups = state.files['faq.json'];
    var nodes = [];
    groups.forEach(function (g, gi) {
      var inner = [];
      inner.push(field('Name der Gruppe', g.gruppe, function (v) { g.gruppe = v; }));
      g.eintraege.forEach(function (e, ei) {
        if (!matches(e.frage + ' ' + e.antwort)) return;
        inner.push(item('faq' + gi + '-' + ei, {
          title: e.frage,
          sub: (e.antwort || '').slice(0, 90),
          body: function () {
            return [
              field('Frage', e.frage, function (v) { e.frage = v; }),
              field('Antwort', e.antwort, function (v) { e.antwort = v; }, { type: 'textarea', rows: 5 })
            ];
          },
          actions: function () {
            return moveBtns(g.eintraege, ei).concat([el('span', 'spacer'), delBtn(null, g.eintraege, ei, e.frage)]);
          }
        }));
      });
      inner.push(btn('+ Frage hinzufügen', '', function () {
        g.eintraege.push({ frage: 'Neue Frage', antwort: '' });
        open_ = 'faq' + gi + '-' + (g.eintraege.length - 1); touched(); render();
      }));

      var p = el('div', 'panel');
      var h = el('div', 'panel__h');
      var r = el('div', 'panel__row');
      r.append(el('h2', 'panel__t', g.gruppe));
      var sp = el('span'); sp.style.flex = '1'; r.append(sp);
      moveBtns(groups, gi).forEach(function (n) { r.append(n); });
      r.append(btn('Gruppe löschen', 'btn--danger', function () {
        if (confirm('Gruppe „' + g.gruppe + '" mit allen Fragen löschen?')) {
          groups.splice(gi, 1); touched(); render();
        }
      }));
      h.append(r);
      p.append(h);
      var b = el('div', 'panel__b panel__b--flush');
      inner.forEach(function (n) { b.append(n); });
      p.append(b);
      nodes.push(p);
    });

    var wrap = el('div');
    wrap.style.display = 'grid'; wrap.style.gap = '1rem';
    var lead = panel({
      title: 'FAQ',
      desc: 'Nach Themen gruppiert. Erscheint auf der Startseite und wird von Google als FAQ-Ausschnitt ausgelesen. Die Gruppe „Racing & Umbau" steht zusätzlich auf der Racing-Seite.',
      search: searchBox('Frage suchen…'),
      body: [], empty: '',
      add: btn('+ Gruppe hinzufügen', 'btn--primary', function () {
        groups.push({ gruppe: 'Neue Gruppe', eintraege: [] }); touched(); render();
      })
    });
    lead.querySelector('.panel__b').remove();
    wrap.append(lead);
    nodes.forEach(function (n) { wrap.append(n); });
    return wrap;
  }

  function viewTestimonials() {
    var arr = state.files['testimonials.json'];
    var nodes = arr.map(function (t, i) {
      return item('say' + i, {
        thumb: t.avatar, round: true,
        title: t.zitat || '(ohne Zitat)',
        sub: t.name + (t.faehrt ? '  ·  fährt: ' + t.faehrt : ''),
        tags: [{ text: t.quelle, cls: '' }, t.hervorheben ? { text: 'hervorgehoben', cls: 'is-note' } : null],
        body: function () {
          return [
            field('Kurzzitat', t.zitat, function (v) { t.zitat = v; },
                  { type: 'textarea', rows: 2, hint: 'Wird groß und in Versalien gesetzt — kurz halten.' }),
            field('Fließtext', t.text, function (v) { t.text = v; }, { type: 'textarea' }),
            row([field('Name', t.name, function (v) { t.name = v; }),
                 field('Fährt', t.faehrt, function (v) { t.faehrt = v; }, { placeholder: 'Aprilia RSV4' })]),
            field('Quelle', t.quelle, function (v) { t.quelle = v; },
                  { type: 'select', options: ['Google', 'Facebook'] }),
            imagePicker('Profilbild', t.avatar, function (v) { t.avatar = v; }, { round: true }),
            checkbox('Farbig hervorheben (türkise Karte)', t.hervorheben, function (v) { t.hervorheben = v; })
          ];
        },
        actions: function () {
          return moveBtns(arr, i).concat([el('span', 'spacer'), delBtn(null, arr, i, t.name)]);
        }
      });
    });
    return panel({
      title: 'Rezensionen',
      desc: 'Echte Bewertungen von Google und Facebook. Bitte nur übernehmen, nicht erfinden — sonst wird aus Vertrauen schnell das Gegenteil.',
      body: nodes, flush: true,
      add: btn('+ Rezension hinzufügen', 'btn--primary', function () {
        arr.push({ zitat: '', text: '', quelle: 'Google', name: '', faehrt: '', avatar: '', hervorheben: false });
        open_ = 'say' + (arr.length - 1); touched(); render();
      })
    });
  }

  /* ------------------------------------------------------ SEO & Sharing */
  var SEO_PAGES = [
    { id: 'start',       label: 'Startseite',   pfad: '' },
    { id: 'racing',      label: 'Racing',       pfad: 'racing/' },
    { id: 'bikes',       label: 'Bikes',        pfad: 'bikes/' },
    { id: 'impressum',   label: 'Impressum',    pfad: 'impressum/' },
    { id: 'datenschutz', label: 'Datenschutz',  pfad: 'datenschutz/' },
    { id: 'agb',         label: 'AGB',          pfad: 'agb/' },
    { id: 'cookies',     label: 'Cookies',      pfad: 'cookies/' }
  ];

  function googlePreview(titel, beschreibung, pfad) {
    var box = el('div');
    box.style.cssText = 'border:1px solid var(--line);border-radius:var(--r-s);padding:.85rem .95rem;background:#fff';
    var url = el('div', null, (state.files['settings.json'].site_url || '').replace(/^https?:\/\//, '') + '/' + pfad);
    url.style.cssText = 'font-size:12.5px;color:#5f6368';
    var t = el('div', null, titel || '(kein Titel)');
    t.style.cssText = 'font-size:18px;color:#1a0dab;line-height:1.3;margin:.15rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    var d = el('div', null, beschreibung || '(keine Beschreibung)');
    d.style.cssText = 'font-size:13px;color:#4d5156;line-height:1.5';
    box.append(url, t, d);
    return box;
  }

  function ogPreview(bild, titel, beschreibung) {
    var box = el('div');
    box.style.cssText = 'border:1px solid var(--line);border-radius:var(--r-s);overflow:hidden;background:#fff;max-width:26rem';
    var img = el('img');
    img.alt = '';
    img.style.cssText = 'width:100%;aspect-ratio:1200/630;object-fit:cover;background:#eef0f3;display:block';
    img.src = bild ? '../assets/web/' + bild : '../assets/icons/og.jpg';
    var b = el('div');
    b.style.cssText = 'padding:.6rem .75rem;border-top:1px solid var(--line-2)';
    var u = el('div', null, (state.files['settings.json'].site_url || '').replace(/^https?:\/\//, '').toUpperCase());
    u.style.cssText = 'font-size:11px;color:var(--ink-3);letter-spacing:.03em';
    var t = el('div', null, titel || '(kein Titel)');
    t.style.cssText = 'font-size:14px;font-weight:650;line-height:1.35;margin-top:.1rem';
    var d = el('div', null, beschreibung || '');
    d.style.cssText = 'font-size:12.5px;color:var(--ink-2);line-height:1.45;margin-top:.15rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';
    b.append(u, t, d);
    box.append(img, b);
    return box;
  }

  function viewSeo() {
    var seo = state.files['seo.json'];
    var nodes = SEO_PAGES.map(function (p, i) {
      var e = seo.seiten[p.id] || (seo.seiten[p.id] = { titel: '', beschreibung: '', og_bild: '' });
      var redraw;
      return item('seo' + i, {
        title: p.label,
        sub: e.titel || '(Standardtitel)',
        tags: [(!e.titel || !e.beschreibung) ? { text: 'unvollständig', cls: 'is-note' } : { text: 'gepflegt', cls: 'is-on' }],
        body: function () {
          var prevG = el('div'), prevO = el('div');
          redraw = function () {
            prevG.innerHTML = ''; prevG.append(googlePreview(e.titel, e.beschreibung, p.pfad));
            prevO.innerHTML = ''; prevO.append(ogPreview(e.og_bild || seo.og_bild_standard, e.titel, e.beschreibung));
          };
          redraw();
          return [
            field('Titel bei Google', e.titel, function (v) { e.titel = v; }, {
              max: 60, min: 30, live: function () { redraw(); },
              hint: 'Steht als blaue Überschrift im Suchergebnis und im Browser-Tab.'
            }),
            field('Beschreibung bei Google', e.beschreibung, function (v) { e.beschreibung = v; }, {
              type: 'textarea', rows: 3, max: 155, min: 70, live: function () { redraw(); },
              hint: 'Der graue Text unter dem Suchergebnis. Kein Ranking-Faktor, aber entscheidet, ob geklickt wird.'
            }),
            group('So sieht es bei Google aus', [prevG]),
            imagePicker('Bild beim Teilen (WhatsApp, Facebook, LinkedIn)', e.og_bild,
                        function (v) { e.og_bild = v; }, { live: function () { redraw(); } }),
            el('span', 'f__hint', 'Leer lassen = Standardbild. Ideal 1200 × 630 Pixel.'),
            group('So sieht der geteilte Link aus', [prevO])
          ];
        }
      });
    });

    var std = panel({
      title: 'Standardwerte',
      desc: 'Gilt überall dort, wo bei einer Seite nichts Eigenes hinterlegt ist — auch auf den Detailseiten der Motorräder.',
      body: [
        imagePicker('Standard-Teilbild', seo.og_bild_standard, function (v) { seo.og_bild_standard = v; }),
        el('span', 'f__hint',
           'Bei den Motorrad-Detailseiten wird automatisch das jeweilige Motorradbild verwendet — '
           + 'das wirkt beim Teilen deutlich besser als ein allgemeines Bild.')
      ]
    });

    var wrap = el('div');
    wrap.style.display = 'grid'; wrap.style.gap = '1rem';
    wrap.append(panel({
      title: 'SEO & Teilen',
      desc: 'Was Google im Suchergebnis anzeigt und wie der Link in WhatsApp, Facebook oder LinkedIn aussieht. Die Vorschau unten zeigt es dir live.',
      body: nodes, flush: true
    }));
    wrap.append(std);
    return wrap;
  }

  function viewSettings() {
    var s = state.files['settings.json'];
    var body = [
      group('Sichtbarkeit', [
        checkbox('Vorschau-Modus — Seite aus Google heraushalten', s.noindex, function (v) { s.noindex = v; }),
        el('span', 'f__hint',
           'Solange das an ist, trägt jede Seite ein noindex und erscheint nicht bei Google. '
           + 'Vor dem echten Livegang ausschalten.'),
        field('Adresse der Website', s.site_url, function (v) { s.site_url = v.replace(/\/+$/, ''); },
              { hint: 'Ohne Schrägstrich am Ende. Steuert Link-Vorschauen, canonical und die Sitemap.' })
      ]),
      group('Firma', [
        field('Firmenname', s.firma, function (v) { s.firma = v; }),
        row([field('Straße', s.strasse, function (v) { s.strasse = v; }),
             field('PLZ und Ort', s.plz_ort, function (v) { s.plz_ort = v; })]),
        field('Bundesland', s.region, function (v) { s.region = v; })
      ]),
      group('Erreichbarkeit', [
        row([field('Telefon (Anzeige)', s.telefon, function (v) { s.telefon = v; }),
             field('Telefon (Wählformat)', s.telefon_link, function (v) { s.telefon_link = v; },
                   { hint: 'Ohne Leerzeichen, z. B. +43217380060' })]),
        field('E-Mail', s.email, function (v) { s.email = v; }, { type: 'email' }),
        field('Google-Maps-Link', s.maps_url, function (v) { s.maps_url = v; }),
        field('Link zur Online-Terminbuchung', s.buchung_url, function (v) { s.buchung_url = v; },
              { hint: 'Steht hinter allen „Termin buchen"-Schaltflächen.' })
      ])
    ];
    var zeiten = [];
    (s.oeffnungszeiten || []).forEach(function (z, i) {
      zeiten.push(row([
        field('Tage (Zeile ' + (i + 1) + ')', z.tage, function (v) { z.tage = v; },
              { hint: i ? 'Leer lassen für eine Folgezeile' : '' }),
        field('Zeit (Zeile ' + (i + 1) + ')', z.zeit, function (v) { z.zeit = v; })
      ]));
    });
    zeiten.push(field('Hinweis', s.oeffnungszeiten_hinweis, function (v) { s.oeffnungszeiten_hinweis = v; }));
    body.push(group('Öffnungszeiten', zeiten));

    return panel({ title: 'Kontaktdaten',
      desc: 'Diese Angaben stehen im Kopf, im Fußbereich und im Kontaktbereich jeder Seite.',
      body: body });
  }

  function viewTracking() {
    var t = state.files['tracking.json'];
    var body = [
      el('div', 'note',
        'Solange hier nichts eingetragen und aktiviert ist, lädt die Website nichts von Google '
        + 'oder Meta — und es erscheint kein Cookie-Banner. Sobald eine ID hinterlegt und aktiv '
        + 'ist, erscheint das Banner. Geladen wird erst nach Zustimmung des Besuchers.'),
      field('Google Tag Manager ID', t.gtm_id, function (v) { t.gtm_id = v.trim(); },
            { placeholder: 'GTM-XXXXXXX', hint: 'Steht im Tag Manager oben neben dem Kontonamen.' }),
      field('Facebook-Pixel ID', t.facebook_pixel_id, function (v) { t.facebook_pixel_id = v.trim(); },
            { placeholder: '1234567890123456', hint: 'Reine Zahlenfolge aus dem Meta Events Manager.' }),
      checkbox('Tracking aktiv', t.aktiv, function (v) { t.aktiv = v; }),
      el('div', 'note note--warn',
        'Wenn du Tracking aktivierst, muss die Datenschutzerklärung die eingesetzten Dienste '
        + 'nennen. Die Cookie-Seite aktualisiert sich automatisch — die Datenschutzerklärung nicht.')
    ];
    return panel({ title: 'Tracking & Cookies',
      desc: 'Google Tag Manager und Facebook-Pixel, gesteuert über das Cookie-Banner.',
      body: body });
  }

  var RENDER = {
    bikes: viewBikes, services: viewServices, team: viewTeam, faq: viewFaq,
    testimonials: viewTestimonials, seo: viewSeo, settings: viewSettings, tracking: viewTracking
  };

  function render() {
    renderSide();
    var m = $('#main');
    m.innerHTML = '';
    m.append(RENDER[state.view]());
  }

  function start() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#repoLabel').textContent = state.owner + '/' + state.repo;
    touched();
    render();
  }

  /* ------------------------------------------------- Automatisch anmelden */
  function boot() {
  var saved = localStorage.getItem(LS_TOKEN);
  var savedRepo = localStorage.getItem(LS_REPO) || (CONFIG.owner && CONFIG.repo
    ? CONFIG.owner + '/' + CONFIG.repo : '');
  if (saved && savedRepo) {
    var parts = savedRepo.split('/');
    $('#loginBtn').textContent = 'Verbinde…';
    $('#loginBtn').disabled = true;
    login(saved, parts[0], parts[1], function (txt) { $('#loginBtn').textContent = txt; })
      .then(start).catch(function (ex) {
      localStorage.removeItem(LS_TOKEN);
      $('#loginBtn').disabled = false;
      $('#loginBtn').textContent = 'Anmelden';
      $('#loginErr').textContent = 'Gespeicherter Token funktioniert nicht mehr: ' + (ex.message || ex);
      $('#loginErr').hidden = false;
    });
  }
  }

  fetch('config.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) { if (c && c.owner && c.repo) CONFIG = c; })
    .catch(function () {})
    .then(boot);
})();

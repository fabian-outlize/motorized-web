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
  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + state.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var msg = r.status + ' ' + r.statusText;
          try { msg = JSON.parse(t).message || msg; } catch (e) {}
          throw new Error(msg);
        });
      }
      return r.status === 204 ? null : r.json();
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
               'bikes.json', 'team.json', 'faq.json', 'testimonials.json'];

  function login(token, owner, repo) {
    state.token = token; state.owner = owner; state.repo = repo;
    return api(repoPath('')).then(function (r) {
      state.branch = r.default_branch || 'main';
      return Promise.all(FILES.map(function (f) {
        return api(repoPath('/contents/content/' + f + '?ref=' + state.branch))
          .then(function (res) {
            var txt = b64decode(res.content);
            state.files[f] = JSON.parse(txt);
            state.original[f] = JSON.stringify(state.files[f]);
          });
      }));
    }).then(function () {
      return api(repoPath('/contents/assets/web?ref=' + state.branch))
        .then(function (list) {
          state.images = list.filter(function (x) { return x.type === 'file'; })
                             .map(function (x) { return x.name; }).sort();
        }).catch(function () { state.images = []; });
    });
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'), err = $('#loginErr');
    var token = $('#token').value.trim();
    var repoStr = (localStorage.getItem(LS_REPO) || '').trim();
    if (!repoStr && CONFIG.owner && CONFIG.repo) repoStr = CONFIG.owner + '/' + CONFIG.repo;

    err.hidden = true;
    btn.disabled = true; btn.textContent = 'Verbinde…';

    var ask = repoStr ? Promise.resolve(repoStr)
      : Promise.resolve(prompt('Repository (Form: benutzername/repository)', '') || '');

    ask.then(function (rs) {
      rs = String(rs).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      var parts = rs.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Bitte das Repository als benutzername/repository angeben.');
      }
      return login(token, parts[0], parts[1]).then(function () {
        if ($('#remember').checked) {
          localStorage.setItem(LS_TOKEN, token);
          localStorage.setItem(LS_REPO, parts.join('/'));
        }
        start();
      });
    }).catch(function (ex) {
      var m = ex.message || String(ex);
      if (/Bad credentials|401/.test(m)) m = 'Token ungültig oder abgelaufen.';
      else if (/Not Found|404/.test(m)) m = 'Repository nicht gefunden — oder der Token hat keinen Zugriff darauf.';
      err.textContent = m;
      err.hidden = false;
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
    var s = $('#state');
    $('#publishBtn').disabled = n === 0;
    s.className = 'top__state' + (n ? ' is-dirty' : '');
    s.textContent = n ? (n === 1 ? '1 Änderung offen' : n + ' Änderungen offen') : 'Alles veröffentlicht';
    renderSide();
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty().length || Object.keys(state.uploads).length) {
      e.preventDefault(); e.returnValue = '';
    }
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
    { id: 'bikes', label: 'Motorräder', file: 'bikes.json' },
    { id: 'services', label: 'Leistungen', file: 'services.json' },
    { id: 'team', label: 'Team', file: 'team.json' },
    { id: 'faq', label: 'FAQ', file: 'faq.json' },
    { id: 'testimonials', label: 'Rezensionen', file: 'testimonials.json' },
    { id: 'settings', label: 'Kontaktdaten', file: 'settings.json' },
    { id: 'tracking', label: 'Tracking & Cookies', file: 'tracking.json' }
  ];

  function renderSide() {
    var side = $('#side');
    side.innerHTML = '';
    VIEWS.forEach(function (v) {
      var b = el('button', 'side__b' + (state.view === v.id ? ' is-on' : ''));
      b.type = 'button';
      b.append(v.label);
      var data = state.files[v.file];
      var c = el('span', 'count');
      if (Array.isArray(data)) c.textContent = data.length;
      if (JSON.stringify(data) !== state.original[v.file]) { c.textContent = '●'; c.style.color = '#b42318'; }
      b.append(c);
      b.addEventListener('click', function () { state.view = v.id; render(); });
      side.append(b);
    });
  }

  /* ------------------------------------------------------- Feld-Helfer */
  function field(label, value, onChange, opts) {
    opts = opts || {};
    var wrap = el('label', 'f');
    wrap.append(el('span', 'f__l', label));
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
    input.addEventListener('input', function () { onChange(input.value); touched(); });
    if (opts.type === 'select') input.addEventListener('change', function () { onChange(input.value); touched(); });
    wrap.append(input);
    if (opts.hint) wrap.append(el('span', 'f__hint', opts.hint));
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

  function imagePicker(label, value, onChange) {
    var wrap = el('div', 'imgpick');
    var img = el('img');
    img.alt = '';
    var setPreview = function (v) {
      img.src = v ? '../assets/web/' + v : '';
      img.style.visibility = v ? 'visible' : 'hidden';
    };
    setPreview(value);

    var f = field(label, value, function (v) { onChange(v); setPreview(v); }, {
      type: 'select',
      options: [{ value: '', label: '— kein Bild —' }].concat(state.images.map(function (n) {
        return { value: n, label: n };
      }))
    });
    var sel = $('select', f);
    if (sel) sel.value = value || '';

    var up = el('input');
    up.type = 'file'; up.accept = 'image/jpeg,image/png,image/webp';
    up.style.cssText = 'font-size:12px;margin-top:.4rem';
    up.addEventListener('change', function () {
      var file = up.files && up.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast('Bild ist größer als 4 MB — bitte kleiner speichern.', true); up.value = ''; return; }
      var name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
      var reader = new FileReader();
      reader.onload = function () {
        state.uploads['assets/web/' + name] = String(reader.result).split(',')[1];
        if (state.images.indexOf(name) === -1) state.images.push(name);
        onChange(name); setPreview(name);
        if (sel) {
          var op = el('option', null, name); op.value = name; sel.append(op); sel.value = name;
        }
        touched();
        toast('Bild vorgemerkt — wird beim Veröffentlichen hochgeladen.');
      };
      reader.readAsDataURL(file);
    });
    f.append(up);

    wrap.append(img, f);
    return wrap;
  }

  function listItem(title, tag, tagCls, bodyNodes, actions) {
    var it = el('div', 'item');
    var h = el('div', 'item__h');
    h.append(el('span', 'item__t', title));
    if (tag) h.append(el('span', 'item__tag' + (tagCls ? ' ' + tagCls : ''), tag));
    var body = el('div', 'item__b');
    bodyNodes.forEach(function (n) { body.append(n); });
    if (actions && actions.length) {
      var a = el('div', 'item__acts');
      actions.forEach(function (n) { a.append(n); });
      body.append(a);
    }
    var open = true;
    h.addEventListener('click', function () { open = !open; body.style.display = open ? '' : 'none'; });
    it.append(h, body);
    return it;
  }

  function btn(label, cls, fn) {
    var b = el('button', 'btn btn--sm' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function moveBtns(arr, i, redraw) {
    return [
      btn('↑', '', function () { if (i > 0) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); touched(); redraw(); } }),
      btn('↓', '', function () { if (i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); touched(); redraw(); } })
    ];
  }

  function panel(title, desc, bodyNodes, addNode) {
    var p = el('div', 'panel');
    var h = el('div', 'panel__h');
    h.append(el('h2', 'panel__t', title));
    if (desc) h.append(el('p', 'panel__d', desc));
    var b = el('div', 'panel__b');
    bodyNodes.forEach(function (n) { b.append(n); });
    p.append(h, b);
    if (addNode) {
      var bar = el('div', 'addbar');
      bar.append(addNode);
      p.append(bar);
    }
    return p;
  }

  /* --------------------------------------------------------- Ansichten */
  function viewBikes() {
    var arr = state.files['bikes.json'];
    var nodes = arr.map(function (b, i) {
      var body = [
        field('Name', b.name, function (v) {
          b.name = v;
          if (!b.slug) b.slug = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }),
        field('Kurzbeschreibung', b.kurz, function (v) { b.kurz = v; },
              { type: 'textarea', hint: 'Ein bis zwei Sätze. Steht auf der Detailseite.' }),
        (function () {
          var g = el('div', 'grid2');
          g.append(field('Baujahr', b.baujahr, function (v) { b.baujahr = v; }, { placeholder: 'z. B. 05/2025' }));
          g.append(field('Kilometerstand', b.km, function (v) { b.km = v; }, { placeholder: 'z. B. 1.300 km' }));
          return g;
        })(),
        (function () {
          var g = el('div', 'grid2');
          g.append(field('Preis', b.preis, function (v) { b.preis = v; }, { placeholder: '€ 7.790,–' }));
          g.append(field('Kategorie', b.kategorie, function (v) { b.kategorie = v; }, {
            type: 'select',
            options: [{ value: 'gebraucht', label: 'Gebraucht' },
                      { value: 'vorfuehrer', label: 'Vorführer' },
                      { value: 'aktion', label: 'Neu-Aktion (nur Startseite)' }]
          }));
          return g;
        })(),
        field('Störer auf dem Bild', b.flag, function (v) { b.flag = v; },
              { placeholder: 'z. B. Top Gebrauchtbike — leer lassen für Standard' }),
        imagePicker('Bild', b.bild, function (v) { b.bild = v; }),
        field('Bildbeschreibung', b.alt, function (v) { b.alt = v; },
              { hint: 'Für Screenreader und Google. Was ist auf dem Bild zu sehen?' }),
        field('Highlights', (b.highlights || []).join('\n'), function (v) {
          b.highlights = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        }, { type: 'textarea', hint: 'Ein Punkt pro Zeile.' }),
        checkbox('Preis mit „ab" anzeigen', b.preis_ab, function (v) { b.preis_ab = v; }),
        checkbox('Auf der Startseite zeigen', b.startseite, function (v) { b.startseite = v; }),
        checkbox('Sichtbar (aus = überall ausgeblendet)', b.aktiv, function (v) { b.aktiv = v; })
      ];
      var acts = moveBtns(arr, i, function () { render(); }).concat([
        btn('Löschen', 'btn--danger', function () {
          if (confirm('„' + b.name + '" wirklich löschen?')) { arr.splice(i, 1); touched(); render(); }
        })
      ]);
      return listItem(b.name || '(ohne Namen)', b.aktiv ? 'sichtbar' : 'versteckt',
                      b.aktiv ? 'is-on' : 'is-off', body, acts);
    });

    var add = btn('+ Motorrad hinzufügen', 'btn--primary', function () {
      arr.unshift({
        slug: 'neues-bike-' + Date.now(), name: 'Neues Motorrad', kategorie: 'gebraucht',
        baujahr: '', km: '', preis: '', preis_ab: false, bild: state.images[0] || '',
        alt: '', kurz: '', specs: '', highlights: [], aktiv: false, startseite: false, flag: ''
      });
      touched(); render();
    });

    return panel('Motorräder',
      'Steht auf der Bikes-Seite und — wenn angehakt — auf der Startseite. Für jedes sichtbare Motorrad entsteht automatisch eine eigene Detailseite.',
      nodes, add);
  }

  function viewServices() {
    var arr = state.files['services.json'];
    var nodes = arr.map(function (s, i) {
      var body = [
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
      var acts = moveBtns(arr, i, render).concat([
        btn('Löschen', 'btn--danger', function () {
          if (confirm('Leistung löschen?')) { arr.splice(i, 1); touched(); render(); }
        })
      ]);
      return listItem(s.titel, null, null, body, acts);
    });
    var add = btn('+ Leistung hinzufügen', 'btn--primary', function () {
      arr.push({ titel: 'Neue Leistung', text: '', bild: state.images[0] || '', bild_alt: '', link: '#kontakt' });
      touched(); render();
    });
    return panel('Leistungen', 'Die Liste im Bereich „What we offer" auf der Startseite.', nodes, add);
  }

  function viewTeam() {
    var arr = state.files['team.json'];
    var nodes = arr.map(function (m, i) {
      var body = [
        field('Name', m.name, function (v) { m.name = v; }),
        field('Rolle', m.rolle, function (v) { m.rolle = v; }),
        imagePicker('Foto', m.bild, function (v) { m.bild = v; })
      ];
      var acts = moveBtns(arr, i, render).concat([
        btn('Löschen', 'btn--danger', function () {
          if (confirm(m.name + ' löschen?')) { arr.splice(i, 1); touched(); render(); }
        })
      ]);
      return listItem(m.name, m.rolle, null, body, acts);
    });
    var add = btn('+ Person hinzufügen', 'btn--primary', function () {
      arr.push({ name: 'Neue Person', rolle: '', bild: '' });
      touched(); render();
    });
    return panel('Team', 'Reihenfolge bestimmt die Anzeige auf der Startseite.', nodes, add);
  }

  function viewFaq() {
    var groups = state.files['faq.json'];
    var nodes = [];
    groups.forEach(function (g, gi) {
      var inner = [field('Name der Gruppe', g.gruppe, function (v) { g.gruppe = v; })];
      g.eintraege.forEach(function (e, ei) {
        var body = [
          field('Frage', e.frage, function (v) { e.frage = v; }),
          field('Antwort', e.antwort, function (v) { e.antwort = v; }, { type: 'textarea', rows: 5 })
        ];
        var acts = moveBtns(g.eintraege, ei, render).concat([
          btn('Löschen', 'btn--danger', function () {
            if (confirm('Frage löschen?')) { g.eintraege.splice(ei, 1); touched(); render(); }
          })
        ]);
        inner.push(listItem(e.frage, null, null, body, acts));
      });
      inner.push(btn('+ Frage hinzufügen', '', function () {
        g.eintraege.push({ frage: 'Neue Frage', antwort: '' }); touched(); render();
      }));
      var acts = moveBtns(groups, gi, render).concat([
        btn('Gruppe löschen', 'btn--danger', function () {
          if (confirm('Gruppe „' + g.gruppe + '" mit allen Fragen löschen?')) {
            groups.splice(gi, 1); touched(); render();
          }
        })
      ]);
      nodes.push(listItem(g.gruppe, g.eintraege.length + ' Fragen', null, inner, acts));
    });
    var add = btn('+ Gruppe hinzufügen', 'btn--primary', function () {
      groups.push({ gruppe: 'Neue Gruppe', eintraege: [] }); touched(); render();
    });
    var hint = el('div', 'note',
      'Die Gruppe „Racing & Umbau" erscheint zusätzlich auf der Racing-Landingpage. ' +
      'Benennst du sie um, verschwindet sie dort — dann bitte Bescheid geben.');
    return panel('FAQ', 'Gruppiert nach Themen. Erscheint auf der Startseite und bei Google als FAQ-Snippet.',
                 [hint].concat(nodes), add);
  }

  function viewTestimonials() {
    var arr = state.files['testimonials.json'];
    var nodes = arr.map(function (t, i) {
      var body = [
        field('Kurzzitat (groß gesetzt)', t.zitat, function (v) { t.zitat = v; },
              { type: 'textarea', rows: 2, hint: 'Kurz halten — wird in Versalien gesetzt.' }),
        field('Fließtext', t.text, function (v) { t.text = v; }, { type: 'textarea' }),
        (function () {
          var g = el('div', 'grid2');
          g.append(field('Name', t.name, function (v) { t.name = v; }));
          g.append(field('Fährt', t.faehrt, function (v) { t.faehrt = v; }, { placeholder: 'Aprilia RSV4' }));
          return g;
        })(),
        field('Quelle', t.quelle, function (v) { t.quelle = v; }, {
          type: 'select', options: ['Google', 'Facebook']
        }),
        imagePicker('Profilbild', t.avatar, function (v) { t.avatar = v; }),
        checkbox('Farbig hervorheben (türkise Karte)', t.hervorheben, function (v) { t.hervorheben = v; })
      ];
      var acts = moveBtns(arr, i, render).concat([
        btn('Löschen', 'btn--danger', function () {
          if (confirm('Rezension von ' + t.name + ' löschen?')) { arr.splice(i, 1); touched(); render(); }
        })
      ]);
      return listItem(t.name + ' — ' + (t.zitat || '').slice(0, 40), t.quelle, null, body, acts);
    });
    var add = btn('+ Rezension hinzufügen', 'btn--primary', function () {
      arr.push({ zitat: '', text: '', quelle: 'Google', name: '', faehrt: '', avatar: '', hervorheben: false });
      touched(); render();
    });
    return panel('Rezensionen', 'Echte Bewertungen von Google und Facebook. Bitte nur übernehmen, nicht erfinden.', nodes, add);
  }

  function viewSettings() {
    var s = state.files['settings.json'];
    var body = [
      field('Adresse der Website', s.site_url, function (v) { s.site_url = v.replace(/\/+$/, ''); },
            { hint: 'Ohne Schrägstrich am Ende. Steuert Link-Vorschauen, canonical und die Sitemap. ' +
                    'Während einer Vorschau auf die github.io-Adresse setzen.' }),
      field('Firmenname', s.firma, function (v) { s.firma = v; }),
      (function () {
        var g = el('div', 'grid2');
        g.append(field('Straße', s.strasse, function (v) { s.strasse = v; }));
        g.append(field('PLZ und Ort', s.plz_ort, function (v) { s.plz_ort = v; }));
        return g;
      })(),
      field('Bundesland', s.region, function (v) { s.region = v; }),
      (function () {
        var g = el('div', 'grid2');
        g.append(field('Telefon (Anzeige)', s.telefon, function (v) { s.telefon = v; }));
        g.append(field('Telefon (Wählformat)', s.telefon_link, function (v) { s.telefon_link = v; },
                       { hint: 'Ohne Leerzeichen, z. B. +43217380060' }));
        return g;
      })(),
      field('E-Mail', s.email, function (v) { s.email = v; }, { type: 'email' }),
      field('Google-Maps-Link', s.maps_url, function (v) { s.maps_url = v; }),
      field('Link zur Online-Terminbuchung', s.buchung_url, function (v) { s.buchung_url = v; },
            { hint: 'Steht hinter allen „Termin buchen"-Buttons.' }),
      field('Hinweis zu den Öffnungszeiten', s.oeffnungszeiten_hinweis,
            function (v) { s.oeffnungszeiten_hinweis = v; })
    ];
    (s.oeffnungszeiten || []).forEach(function (z, i) {
      var g = el('div', 'grid2');
      g.append(field('Tage (Zeile ' + (i + 1) + ')', z.tage, function (v) { z.tage = v; },
                     { hint: 'Leer lassen für eine Folgezeile' }));
      g.append(field('Zeit (Zeile ' + (i + 1) + ')', z.zeit, function (v) { z.zeit = v; }));
      body.push(g);
    });
    return panel('Kontaktdaten', 'Diese Angaben stehen im Kopf, im Fußbereich und im Kontaktbereich jeder Seite.', body);
  }

  function viewTracking() {
    var t = state.files['tracking.json'];
    var body = [
      el('div', 'note',
        'Solange hier nichts eingetragen und aktiviert ist, lädt die Website nichts von Google ' +
        'oder Meta — und es erscheint kein Cookie-Banner. Sobald du eine ID einträgst und ' +
        'aktivierst, erscheint das Banner. Geladen wird erst nach Zustimmung des Besuchers.'),
      field('Google Tag Manager ID', t.gtm_id, function (v) { t.gtm_id = v.trim(); },
            { placeholder: 'GTM-XXXXXXX', hint: 'Findest du im Tag Manager oben neben dem Kontonamen.' }),
      field('Facebook-Pixel ID', t.facebook_pixel_id, function (v) { t.facebook_pixel_id = v.trim(); },
            { placeholder: '1234567890123456', hint: 'Reine Zahlenfolge aus dem Meta Events Manager.' }),
      checkbox('Tracking aktiv', t.aktiv, function (v) { t.aktiv = v; }),
      el('div', 'note note--warn',
        'Wichtig: Wenn du Tracking aktivierst, muss die Datenschutzerklärung die eingesetzten ' +
        'Dienste nennen. Die Cookie-Seite aktualisiert sich automatisch — die Datenschutzerklärung nicht.')
    ];
    return panel('Tracking & Cookies',
                 'Google Tag Manager und Facebook-Pixel. Beide werden über das Cookie-Banner gesteuert.',
                 body);
  }

  var RENDER = {
    bikes: viewBikes, services: viewServices, team: viewTeam, faq: viewFaq,
    testimonials: viewTestimonials, settings: viewSettings, tracking: viewTracking
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
    login(saved, parts[0], parts[1]).then(start).catch(function (ex) {
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

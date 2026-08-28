/* ==========================================================================
   Das CMS. Liegt bewusst auf einer eigenen Seite — wer hier landet, ist
   angemeldet. Ohne gespeicherten Token geht es zurück zur Anmeldung.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  var state = SM.state;
  var view = 'bikes';
  var open_ = null;      // welcher Eintrag gerade aufgeklappt ist
  var filter = '';       // Suchbegriff
  var kat = 'alle';      // Segmentfilter bei den Motorrädern
  var drag = null, dropAt = 0;

  function clearMarks() {
    Array.prototype.forEach.call(document.querySelectorAll('.is-over, .is-over-after'),
      function (n) { n.classList.remove('is-over', 'is-over-after'); });
  }

  var toastT;
  function toast(msg, warn) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (warn ? ' is-warn' : '');
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, warn ? 6000 : 3000);
  }

  function dirty() { return SM.dirty(); }

  function touched() {
    var n = dirty().length + Object.keys(state.uploads).length + state.deletions.length;
    $('#savebar').classList.toggle('is-on', n > 0);
    $('#savebarT').textContent = n === 1 ? '1 Änderung offen' : n + ' Änderungen offen';
    renderSide();
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty().length || Object.keys(state.uploads).length || state.deletions.length) {
      e.preventDefault(); e.returnValue = '';
    }
  });

  /* ------------------------------------------------------- Veröffentlichen */
  $('#publishBtn').addEventListener('click', function () {
    var b = this;
    pruefen(function () {
    b.disabled = true; b.textContent = 'Veröffentliche…';
    SM.publish().then(function () {
      touched(); render();
      toast('Gespeichert. Die Website aktualisiert sich in ein bis zwei Minuten.');
    }).catch(function (ex) {
      toast('Fehler beim Veröffentlichen: ' + (ex.message || ex), true);
    }).then(function () {
      b.disabled = false; b.textContent = 'Veröffentlichen'; touched();
    });
    });
  });

  $('#discardBtn').addEventListener('click', function () {
    if (!confirm('Alle offenen Änderungen verwerfen und den zuletzt veröffentlichten Stand laden?')) return;
    SM.FILES.forEach(function (f) { state.files[f] = JSON.parse(state.original[f]); });
    state.uploads = {}; state.deletions = []; open_ = null;
    touched(); render();
    toast('Änderungen verworfen.');
  });


  /* ------------------------------------------------- Änderungen prüfen */
  var BEREICH = {
    'bikes.json': 'Motorräder', 'services.json': 'Leistungen', 'team.json': 'Team',
    'faq.json': 'FAQ', 'testimonials.json': 'Rezensionen', 'aktionen.json': 'Aktionen',
    'seo.json': 'SEO & Teilen', 'settings.json': 'Kontaktdaten', 'tracking.json': 'Tracking'
  };
  var NAMEFELD = ['name', 'titel', 'frage', 'gruppe', 'zitat'];

  function bezeichne(x, i) {
    if (x && typeof x === 'object') {
      for (var k = 0; k < NAMEFELD.length; k++) {
        if (x[NAMEFELD[k]]) return String(x[NAMEFELD[k]]).slice(0, 48);
      }
    }
    return 'Eintrag ' + (i + 1);
  }

  /* Vergleicht die gespeicherte mit der bearbeiteten Fassung und beschreibt
     den Unterschied in Worten — keine technischen Diffs. */
  function unterschiede(datei) {
    var alt = JSON.parse(state.original[datei]);
    var neu = state.files[datei];
    var out = [];

    if (Array.isArray(neu) && Array.isArray(alt)) {
      // Gleich lange Listen: Eintrag fuer Eintrag vergleichen. Dadurch wird ein
      // umbenannter Eintrag als "geaendert" erkannt und nicht als neu + entfernt.
      var altSort = alt.map(function (y) { return JSON.stringify(y); }).slice().sort();
      var neuSort = neu.map(function (y) { return JSON.stringify(y); }).slice().sort();
      if (alt.length === neu.length && altSort.join('|') === neuSort.join('|')) {
        // Gleiche Einträge, andere Reihenfolge — mehr gibt es nicht zu sagen.
        return [['geaendert', 'Reihenfolge geändert']];
      }

      if (alt.length === neu.length) {
        var umsortiert = false;
        neu.forEach(function (x, i) {
          if (JSON.stringify(alt[i]) === JSON.stringify(x)) return;
          var woher = alt.map(function (y) { return JSON.stringify(y); }).indexOf(JSON.stringify(x));
          if (woher > -1) { umsortiert = true; return; }
          var name = bezeichne(x, i);
          var altName = bezeichne(alt[i], i);
          out.push(['geaendert', name === altName ? name : altName + ' → ' + name]);
        });
        if (umsortiert) out.push(['geaendert', 'Reihenfolge']);
        return out;
      }

      var altS = alt.map(function (y) { return JSON.stringify(y); });
      var neuS = neu.map(function (y) { return JSON.stringify(y); });
      neu.forEach(function (x, i) {
        if (altS.indexOf(neuS[i]) === -1) out.push(['neu', bezeichne(x, i)]);
      });
      alt.forEach(function (x, i) {
        if (neuS.indexOf(altS[i]) === -1) out.push(['weg', bezeichne(x, i)]);
      });
      return out;
    }

    Object.keys(neu || {}).forEach(function (k) {
      if (JSON.stringify(alt[k]) !== JSON.stringify(neu[k])) out.push(['geaendert', k]);
    });
    return out;
  }

  function pruefen(weiter) {
    var box = el('div', 'modal');
    var karte = el('div', 'modal__box');
    karte.append(el('h2', 'modal__h', 'Das wird veröffentlicht'));

    var liste = el('div', 'modal__b');
    var geaendert = dirty();
    geaendert.forEach(function (f) {
      var g = el('div', 'chg');
      g.append(el('div', 'chg__h', BEREICH[f] || f));
      var ul = el('ul', 'chg__l');
      unterschiede(f).forEach(function (u) {
        var li = el('li');
        var LABEL = { neu: 'neu', weg: 'entfernt', geaendert: 'geändert' };
        li.append(el('span', 'chg__tag chg__tag--' + u[0], LABEL[u[0]]), el('span', null, u[1]));
        ul.append(li);
      });
      g.append(ul);
      liste.append(g);
    });

    var neueBilder = Object.keys(state.uploads);
    if (neueBilder.length || state.deletions.length) {
      var g2 = el('div', 'chg');
      g2.append(el('div', 'chg__h', 'Bilder'));
      var ul2 = el('ul', 'chg__l');
      neueBilder.forEach(function (p) {
        var li = el('li');
        li.append(el('span', 'chg__tag chg__tag--neu', 'neu'), el('span', null, p.split('/').pop()));
        ul2.append(li);
      });
      state.deletions.forEach(function (p) {
        var li = el('li');
        li.append(el('span', 'chg__tag chg__tag--weg', 'entfernt'), el('span', null, p.split('/').pop()));
        ul2.append(li);
      });
      g2.append(ul2);
      liste.append(g2);
    }

    if (!liste.children.length) liste.append(el('div', 'empty', 'Nichts zu veröffentlichen.'));
    karte.append(liste);

    var foot = el('div', 'modal__f');
    var ab = btn('Zurück', 'btn--quiet', function () { box.remove(); });
    var ok = el('button', 'btn btn--primary', 'Jetzt veröffentlichen');
    ok.type = 'button';
    ok.addEventListener('click', function () { box.remove(); weiter(); });
    foot.append(el('span', 'modal__hint',
      'Danach dauert es ein bis zwei Minuten, bis die Website neu gebaut ist.'));
    foot.append(ab, ok);
    karte.append(foot);

    box.append(karte);
    box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.append(box);
    ok.focus();
  }

  /* -------------------------------------------------------------- Sidebar */
  var GROUPS = [
    { label: 'Inhalte', items: [
      { id: 'bikes',        label: 'Motorräder',   ico: '\u{1F3CD}', file: 'bikes.json' },
      { id: 'services',     label: 'Leistungen',   ico: '\u{1F527}', file: 'services.json' },
      { id: 'team',         label: 'Team',         ico: '\u{1F464}', file: 'team.json' },
      { id: 'faq',          label: 'FAQ',          ico: '❓',    file: 'faq.json' },
      { id: 'testimonials', label: 'Rezensionen',  ico: '⭐',    file: 'testimonials.json' },
      { id: 'aktionen',     label: 'Aktionen',     ico: '\u{1F4E3}', file: 'aktionen.json' },
      { id: 'medien',       label: 'Medien',       ico: '\u{1F5BC}', file: null }
    ]},
    { label: 'Einstellungen', items: [
      { id: 'seo',      label: 'SEO & Teilen', ico: '\u{1F50D}', file: 'seo.json' },
      { id: 'settings', label: 'Kontaktdaten', ico: '\u{1F4CD}', file: 'settings.json' },
      { id: 'tracking', label: 'Tracking',     ico: '\u{1F4CA}', file: 'tracking.json' }
    ]}
  ];

  function renderSide() {
    var side = $('#side');
    side.innerHTML = '';

    var brand = el('div', 'side__brand');
    var logo = el('div', 'side__logo');
    logo.innerHTML = '<svg viewBox="0 0 217 217"><path d="M0 217L74.082 108.5L0 0H44.6104L118.692 108.5L44.6104 217H0ZM98.3076 217L172.39 108.5L98.3076 0H142.918L217 108.5L142.918 217H98.3076Z"/></svg>';
    var names = el('div');
    names.append(el('div', 'side__name', 'Schwarz Motorized'),
                 el('div', 'side__sub', state.owner + '/' + state.repo));
    brand.append(logo, names);
    side.append(brand);

    GROUPS.forEach(function (g) {
      side.append(el('div', 'side__group', g.label));
      g.items.forEach(function (v) {
        var b = el('button', 'side__b' + (view === v.id ? ' is-on' : ''));
        b.type = 'button';
        b.append(el('span', null, v.ico), el('span', null, v.label));
        var data = v.file ? state.files[v.file] : null;
        if (v.file && JSON.stringify(data) !== state.original[v.file]) {
          var d = el('span', 'dot'); d.title = 'ungespeicherte Änderungen'; b.append(d);
        } else if (Array.isArray(data)) {
          b.append(el('span', 'count', data.length));
        } else if (!v.file) {
          b.append(el('span', 'count', state.images.length));
        }
        if (v.id === 'seo' && state.files['settings.json'].noindex) {
          var w = el('span', 'pill is-note', 'Vorschau');
          w.style.cssText += ';margin-left:auto;font-size:10px';
          b.append(w);
        }
        b.addEventListener('click', function () {
          view = v.id; open_ = null; filter = ''; kat = 'alle';
          render(); window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        side.append(b);
      });
    });

    var foot = el('div', 'side__foot');
    var look = el('a', 'side__b', null);
    look.href = '../'; look.target = '_blank'; look.rel = 'noopener';
    look.append(el('span', null, '↗'), el('span', null, 'Website ansehen'));
    var out = el('button', 'side__b');
    out.type = 'button';
    out.append(el('span', null, '⏻'), el('span', null, 'Abmelden'));
    out.addEventListener('click', function () {
      if (dirty().length && !confirm('Es gibt ungespeicherte Änderungen. Wirklich abmelden?')) return;
      SM.forget(); location.href = 'index.html';
    });
    foot.append(look, out);
    side.append(foot);
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

    if (opts.sort) {
      var grip = el('span', 'item__grip');
      grip.title = 'Zum Sortieren ziehen';
      grip.setAttribute('aria-hidden', 'true');
      grip.addEventListener('mousedown', function () { it.draggable = true; });
      grip.addEventListener('mouseup', function () { it.draggable = false; });
      grip.addEventListener('click', function (e) { e.stopPropagation(); });
      head.append(grip);
    }

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
      if (t) head.append(el('span', 'pill' + (t.cls ? ' ' + t.cls : ''), t.text));
    });
    var car = el('span', 'item__caret');
    car.innerHTML = '<svg class="ico" viewBox="0 0 24 24" style="width:.85rem;height:.85rem"><path d="m6 9 6 6 6-6"/></svg>';
    head.append(car);

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

    if (opts.sort) {
      var arr = opts.sort.arr, idx = opts.sort.index;
      it.addEventListener('dragstart', function (e) {
        drag = { arr: arr, from: idx };
        it.classList.add('is-dragging');
        document.body.classList.add('dragmode');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {}
      });
      it.addEventListener('dragend', function () {
        it.draggable = false;
        it.classList.remove('is-dragging');
        document.body.classList.remove('dragmode');
        clearMarks();
        drag = null;
      });
      it.addEventListener('dragover', function (e) {
        if (!drag || drag.arr !== arr) return;
        e.preventDefault();
        var r = it.getBoundingClientRect();
        var after = (e.clientY - r.top) > r.height / 2;
        clearMarks();
        it.classList.add(after ? 'is-over-after' : 'is-over');
        dropAt = idx + (after ? 1 : 0);
      });
      it.addEventListener('drop', function (e) {
        if (!drag || drag.arr !== arr) return;
        e.preventDefault();
        var from = drag.from, to = dropAt;
        clearMarks();
        if (to > from) to--;
        if (to !== from && to >= 0 && to <= arr.length - 1) {
          arr.splice(to, 0, arr.splice(from, 1)[0]);
          open_ = null;
          touched(); render();
          toast('Reihenfolge geändert.');
        }
        drag = null;
      });
    }

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
    var p = el('div', 'card');
    if (opts.title) {
      var h = el('div', 'card__h');
      h.append(el('h2', 'card__t', opts.title));
      if (opts.desc) h.append(el('p', 'card__d', opts.desc));
      p.append(h);
    }
    var b = el('div', 'card__b' + (opts.flush ? ' card__b--list' : ''));
    if (!opts.body.length) b.append(el('div', 'empty', opts.empty || 'Noch nichts angelegt.'));
    else opts.body.forEach(function (n) { b.append(n); });
    p.append(b);
    if (opts.add) { var f = el('div', 'card__f'); f.append(opts.add); p.append(f); }
    return p;
  }

  /* Filter- und Suchleiste ueber der Liste */
  function bar(nodes) {
    var w = el('div', 'bar');
    nodes.forEach(function (n) { if (n) w.append(n); });
    return w;
  }

  function segmented(options, current, onPick) {
    var w = el('div', 'seg');
    options.forEach(function (o) {
      var b = el('button', current === o.id ? 'is-on' : '');
      b.type = 'button';
      b.append(el('span', null, o.label));
      if (o.n != null) b.append(el('span', 'n', o.n));
      b.addEventListener('click', function () { onPick(o.id); });
      w.append(b);
    });
    return w;
  }

  function searchBox(placeholder) {
    var w = el('div', 'search');
    w.innerHTML = '<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
    var i = el('input');
    i.type = 'search'; i.placeholder = placeholder; i.value = filter;
    i.addEventListener('input', function () {
      filter = i.value; render();
      requestAnimationFrame(function () {
        var f = document.querySelector('.search input');
        if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
      });
    });
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
      if (kat !== 'alle' && b.kategorie !== kat) return;
      if (!matches(b.name + ' ' + b.kategorie + ' ' + (b.baujahr || ''))) return;
      var KAT = { gebraucht: 'Gebraucht', vorfuehrer: 'Vorführer', aktion: 'Neu-Aktion' };
      nodes.push(item('bike' + i, {
        sort: { arr: arr, index: i },
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

    var zaehl = function (k) {
      return arr.filter(function (x) { return k === 'alle' || x.kategorie === k; }).length;
    };
    var wrap = el('div');
    wrap.append(bar([
      segmented([
        { id: 'alle', label: 'Alle', n: zaehl('alle') },
        { id: 'gebraucht', label: 'Gebraucht', n: zaehl('gebraucht') },
        { id: 'vorfuehrer', label: 'Vorführer', n: zaehl('vorfuehrer') },
        { id: 'aktion', label: 'Aktionen', n: zaehl('aktion') }
      ], kat, function (id) { kat = id; open_ = null; render(); }),
      searchBox('Motorrad suchen…')
    ]));
    wrap.append(panel({
      body: nodes, flush: true,
      empty: filter || kat !== 'alle' ? 'Kein Motorrad gefunden.' : 'Noch kein Motorrad angelegt.',
      add: btn('+ Motorrad hinzufügen', 'btn--primary', function () {
        arr.unshift({
          slug: 'neues-bike-' + Date.now(), name: 'Neues Motorrad', kategorie: 'gebraucht',
          baujahr: '', km: '', preis: '', preis_ab: false, bild: '', alt: '', kurz: '',
          specs: '', highlights: [], aktiv: false, startseite: false, flag: ''
        });
        filter = ''; kat = 'alle'; open_ = 'bike0'; touched(); render();
      })
    }));
    return wrap;
  }

  function viewServices() {
    var arr = state.files['services.json'];
    var nodes = arr.map(function (s, i) {
      return item('svc' + i, {
        sort: { arr: arr, index: i },
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
        sort: { arr: arr, index: i },
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
      body: nodes, flush: true,
      add: btn('+ Person hinzufügen', 'btn--primary', function () {
        arr.push({ name: 'Neue Person', rolle: '', bild: '' });
        open_ = 'team' + (arr.length - 1); touched(); render();
      })
    });
  }

  function viewFaq() {
    var groups = state.files['faq.json'];
    var wrap = el('div');

    wrap.append(bar([searchBox('Frage suchen…')]));

    wrap.append(panel({
      body: [el('div', 'note',
        'Die Gruppe „Racing & Umbau" erscheint zusätzlich auf der Racing-Seite. '
        + 'Benennst du sie um, verschwindet sie dort — dann bitte Bescheid geben.')]
    }));

    groups.forEach(function (g, gi) {
      var karte = el('div', 'card');

      var kopf = el('div', 'card__h');
      var zeile = el('div');
      zeile.style.cssText = 'display:flex;align-items:center;gap:.6rem;flex-wrap:wrap';
      zeile.append(el('h2', 'card__t', g.gruppe || '(ohne Namen)'));
      zeile.append(el('span', 'pill', g.eintraege.length + ' Fragen'));
      var luecke = el('span'); luecke.style.flex = '1';
      zeile.append(luecke);
      moveBtns(groups, gi).forEach(function (n) { zeile.append(n); });
      zeile.append(btn('Gruppe löschen', 'btn--danger', function () {
        if (confirm('Gruppe „' + g.gruppe + '" mit allen ' + g.eintraege.length
                    + ' Fragen löschen?')) {
          groups.splice(gi, 1); open_ = null; touched(); render();
        }
      }));
      kopf.append(zeile);
      karte.append(kopf);

      var koerper = el('div', 'card__b card__b--list');
      koerper.append(field('Name der Gruppe', g.gruppe, function (v) { g.gruppe = v; }));

      var sichtbar = 0;
      g.eintraege.forEach(function (e, ei) {
        if (!matches(e.frage + ' ' + e.antwort)) return;
        sichtbar++;
        koerper.append(item('faq' + gi + '-' + ei, {
          sort: { arr: g.eintraege, index: ei },
          title: e.frage,
          sub: (e.antwort || '').slice(0, 90),
          body: function () {
            return [
              field('Frage', e.frage, function (v) { e.frage = v; }),
              field('Antwort', e.antwort, function (v) { e.antwort = v; },
                    { type: 'textarea', rows: 5 })
            ];
          },
          actions: function () {
            return moveBtns(g.eintraege, ei)
              .concat([el('span', 'spacer'), delBtn(null, g.eintraege, ei, e.frage)]);
          }
        }));
      });
      if (!sichtbar) {
        koerper.append(el('div', 'empty',
          filter ? 'Keine Frage passt zur Suche.' : 'Noch keine Frage in dieser Gruppe.'));
      }
      karte.append(koerper);

      var fuss = el('div', 'card__f');
      fuss.append(btn('+ Frage hinzufügen', '', function () {
        g.eintraege.push({ frage: 'Neue Frage', antwort: '' });
        filter = ''; open_ = 'faq' + gi + '-' + (g.eintraege.length - 1);
        touched(); render();
      }));
      karte.append(fuss);

      wrap.append(karte);
    });

    var neueGruppe = el('div', 'card');
    var f = el('div', 'card__b');
    f.append(btn('+ Gruppe hinzufügen', 'btn--primary', function () {
      groups.push({ gruppe: 'Neue Gruppe', eintraege: [] });
      touched(); render();
    }));
    neueGruppe.append(f);
    wrap.append(neueGruppe);

    return wrap;
  }

  function viewTestimonials() {
    var arr = state.files['testimonials.json'];
    var nodes = arr.map(function (t, i) {
      return item('say' + i, {
        sort: { arr: arr, index: i },
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
      body: nodes, flush: true,
      add: btn('+ Rezension hinzufügen', 'btn--primary', function () {
        arr.push({ zitat: '', text: '', quelle: 'Google', name: '', faehrt: '', avatar: '', hervorheben: false });
        open_ = 'say' + (arr.length - 1); touched(); render();
      })
    });
  }


  /* -------------------------------------------------------- Aktionen */
  function heute() { return new Date().toISOString().slice(0, 10); }

  function laufzeitText(a) {
    if (!a.aktiv) return { text: 'aus', cls: 'is-off' };
    var h = heute();
    if (a.von && h < a.von) return { text: 'geplant', cls: 'is-note' };
    if (a.bis && h > a.bis) return { text: 'abgelaufen', cls: 'is-off' };
    return { text: 'läuft', cls: 'is-on' };
  }

  function viewAktionen() {
    var arr = state.files['aktionen.json'];
    var nodes = arr.map(function (a, i) {
      var st = laufzeitText(a);
      return item('akt' + i, {
        sort: { arr: arr, index: i },
        thumb: a.bild, title: a.titel, sub: a.text,
        tags: [st],
        body: function () {
          return [
            field('Titel', a.titel, function (v) { a.titel = v; }),
            field('Text', a.text, function (v) { a.text = v; }, { type: 'textarea' }),
            imagePicker('Bild', a.bild, function (v) { a.bild = v; }),
            row([
              field('Läuft ab', a.von, function (v) { a.von = v; },
                    { type: 'date', hint: 'Leer = sofort' }),
              field('Läuft bis', a.bis, function (v) { a.bis = v; },
                    { type: 'date', hint: 'Leer = unbegrenzt' })
            ]),
            el('div', 'note',
               'Abgelaufene Aktionen verschwinden von selbst — die Website wird dafür '
               + 'einmal täglich neu gebaut. Du musst nichts löschen.'),
            row([
              field('Verlinkt auf', a.link, function (v) { a.link = v; }, {
                type: 'select',
                options: [{ value: '', label: '— kein Link —' },
                          { value: '#kontakt', label: 'Kontaktbereich' },
                          { value: 'racing/', label: 'Racing-Seite' },
                          { value: 'bikes/', label: 'Bikes-Seite' },
                          { value: 'BUCHUNG', label: 'Online-Terminbuchung' }]
              }),
              field('Beschriftung des Links', a.link_text, function (v) { a.link_text = v; },
                    { placeholder: 'Mehr erfahren' })
            ]),
            checkbox('Aktion ist aktiv', a.aktiv, function (v) { a.aktiv = v; })
          ];
        },
        actions: function () {
          return moveBtns(arr, i).concat([el('span', 'spacer'), delBtn(null, arr, i, a.titel)]);
        }
      });
    });
    return panel({
      body: nodes, flush: true,
      empty: 'Keine Aktion angelegt. Solange nichts läuft, erscheint der Bereich gar nicht auf der Website.',
      add: btn('+ Aktion hinzufügen', 'btn--primary', function () {
        arr.unshift({ titel: 'Neue Aktion', text: '', bild: '', link: '', link_text: '',
                      von: '', bis: '', aktiv: false });
        open_ = 'akt0'; touched(); render();
      })
    });
  }

  /* ---------------------------------------------------------- Medien */
  function bildVerwendung(name) {
    var wo = [];
    (state.files['bikes.json'] || []).forEach(function (b) {
      if (b.bild === name) wo.push('Motorrad „' + b.name + '“');
    });
    (state.files['services.json'] || []).forEach(function (x) {
      if (x.bild === name) wo.push('Leistung „' + x.titel + '“');
    });
    (state.files['team.json'] || []).forEach(function (x) {
      if (x.bild === name) wo.push('Team: ' + x.name);
    });
    (state.files['testimonials.json'] || []).forEach(function (x) {
      if (x.avatar === name) wo.push('Rezension von ' + x.name);
    });
    (state.files['aktionen.json'] || []).forEach(function (x) {
      if (x.bild === name) wo.push('Aktion „' + x.titel + '“');
    });
    if (state.inVerwendung.indexOf(name) > -1 && !wo.length) {
      wo.push('fest in einer Seitenvorlage (Hero, Racing, Kontakt …)');
    }
    var seo = state.files['seo.json'] || {};
    if (seo.og_bild_standard === name) wo.push('Standard-Teilbild');
    Object.keys(seo.seiten || {}).forEach(function (k) {
      if (seo.seiten[k].og_bild === name) wo.push('Teilbild: ' + k);
    });
    return wo;
  }

  function viewMedien() {
    var neu = Object.keys(state.uploads).map(function (p) { return p.split('/').pop(); });
    var alle = state.images.filter(function (n) {
      return state.deletions.indexOf('assets/web/' + n) === -1;
    });

    var grid = el('div');
    grid.style.cssText = 'display:grid;gap:.7rem;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))';

    alle.filter(function (n) { return matches(n); }).forEach(function (n) {
      var wo = bildVerwendung(n);
      var c = el('div');
      c.style.cssText = 'border:1px solid var(--line);border-radius:var(--r-s);overflow:hidden;background:var(--card)';
      var img = el('img');
      img.src = '../assets/web/' + n; img.alt = n; img.loading = 'lazy';
      img.style.cssText = 'width:100%;aspect-ratio:3/2;object-fit:cover;background:#eef0f3';
      var b = el('div');
      b.style.cssText = 'padding:.5rem .6rem;display:grid;gap:.3rem';
      var t = el('div', null, n);
      t.style.cssText = 'font-size:11.5px;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      t.title = n;
      var u = el('div', null, wo.length
        ? (wo.length === 1 && wo[0].indexOf('Vorlage') > -1 ? 'in einer Vorlage' : wo.length + '× verwendet')
        : 'nicht verwendet');
      u.style.cssText = 'font-size:11px;color:' + (wo.length ? 'var(--ok)' : 'var(--ink-3)');
      if (wo.length) u.title = wo.join('\n');
      b.append(t, u);
      if (neu.indexOf(n) > -1) {
        var p = el('span', 'pill is-note', 'neu, noch nicht veröffentlicht');
        p.style.cssText += ';font-size:10px';
        b.append(p);
      }
      if (!wo.length) {
        b.append(btn('Löschen', 'btn--danger', function () {
          if (!confirm('„' + n + '“ wirklich löschen? Das lässt sich nur über GitHub rückgängig machen.')) return;
          if (state.uploads['assets/web/' + n]) delete state.uploads['assets/web/' + n];
          else state.deletions.push('assets/web/' + n);
          state.images = state.images.filter(function (x) { return x !== n; });
          touched(); render();
        }));
      }
      c.append(img, b);
      grid.append(c);
    });

    var up = el('label', 'btn btn--primary');
    up.append('+ Bilder hochladen');
    var inp = el('input');
    inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.multiple = true;
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []);
      var zuGross = files.filter(function (f) { return f.size > 4 * 1024 * 1024; });
      if (zuGross.length) {
        toast(zuGross.length + ' Bild(er) über 4 MB wurden übersprungen.', true);
      }
      files.filter(function (f) { return f.size <= 4 * 1024 * 1024; }).forEach(function (file) {
        var name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
        var reader = new FileReader();
        reader.onload = function () {
          state.uploads['assets/web/' + name] = String(reader.result).split(',')[1];
          if (state.images.indexOf(name) === -1) { state.images.push(name); state.images.sort(); }
          touched(); render();
        };
        reader.readAsDataURL(file);
      });
      inp.value = '';
    });
    up.append(inp);

    var wrap = el('div');
    wrap.append(bar([searchBox('Dateiname suchen…')]));
    wrap.append(panel({
      body: [
        el('div', 'note',
           'Bilder, die nirgends verwendet werden, kannst du löschen. Verwendete lassen sich '
           + 'nicht löschen — nimm sie erst im jeweiligen Eintrag heraus.'),
        grid
      ],
      empty: 'Keine Bilder gefunden.',
      add: up
    }));
    return wrap;
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

    var set = state.files['settings.json'];
    var sicht = panel({
      title: 'Sichtbarkeit',
      desc: 'Ob die Website bei Google auftauchen darf — und unter welcher Adresse sie läuft.',
      body: [
        checkbox('Vorschau-Modus — Seite aus Google heraushalten', set.noindex,
                 function (v) { set.noindex = v; render(); }),
        el('div', set.noindex ? 'note note--warn' : 'note',
           set.noindex
             ? 'Aktiv: Jede Seite trägt ein noindex, Google nimmt sie nicht auf. '
               + 'Vor dem echten Livegang ausschalten — sonst findet dich niemand.'
             : 'Aus: Die Website darf in den Suchergebnissen erscheinen.'),
        field('Adresse der Website', set.site_url,
              function (v) { set.site_url = v.replace(/\/+$/, ''); },
              { hint: 'Ohne Schrägstrich am Ende. Steuert die Vorschauen unten, canonical und die Sitemap.' })
      ]
    });

    var wrap = el('div');
    wrap.style.display = 'grid'; wrap.style.gap = '1rem';
    wrap.append(sicht);
    wrap.append(panel({ body: nodes, flush: true }));
    wrap.append(std);
    return wrap;
  }

  function viewSettings() {
    var s = state.files['settings.json'];
    var body = [
      group('Firma', [
        field('Firmenname', s.firma, function (v) { s.firma = v; }),
        row([field('Straße', s.strasse, function (v) { s.strasse = v; }),
             field('PLZ und Ort', s.plz_ort, function (v) { s.plz_ort = v; })]),
        field('Bundesland', s.region, function (v) { s.region = v; })
      ]),
      group('Anfrageformular', [
        field('Formular-Endpunkt (URL)', s.formular_endpunkt,
              function (v) { s.formular_endpunkt = v.trim(); }, {
          placeholder: 'https://…',
          hint: 'Leer lassen = das Formular öffnet das E-Mail-Programm des Besuchers. '
              + 'Trägst du hier die Adresse eines Formulardienstes ein (z. B. Formspree oder '
              + 'Web3Forms), kommen Anfragen direkt bei dir an.'
        }),
        el('div', 'note note--warn',
           'Ein Formulardienst empfängt personenbezogene Daten. Er gehört dann in die '
           + 'Datenschutzerklärung, und es braucht in der Regel einen Auftragsverarbeitungsvertrag.')
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

    var aus = [el('div', 'note',
      'Feiertage und Betriebsurlaub. Der Hinweis erscheint im Kontaktbereich, solange er '
      + 'läuft — und verschwindet danach von selbst.')];
    (s.ausnahmen || []).forEach(function (a, i) {
      var box = el('div', 'f');
      box.style.cssText = 'gap:.6rem;padding:.8rem;border:1px solid var(--line);border-radius:var(--r-s);background:var(--raised)';
      box.append(row([
        field('Von', a.von, function (v) { a.von = v; }, { type: 'date' }),
        field('Bis', a.bis, function (v) { a.bis = v; }, { type: 'date' })
      ]));
      box.append(field('Text', a.text, function (v) { a.text = v; },
                       { placeholder: 'Betriebsurlaub — wir sind ab … wieder da.' }));
      box.append(btn('Entfernen', 'btn--danger', function () {
        s.ausnahmen.splice(i, 1); touched(); render();
      }));
      aus.push(box);
    });
    aus.push(btn('+ Ausnahme hinzufügen', '', function () {
      if (!s.ausnahmen) s.ausnahmen = [];
      s.ausnahmen.push({ von: '', bis: '', text: '' });
      touched(); render();
    }));
    body.push(group('Ausnahmen bei den Öffnungszeiten', aus));

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
        + 'nennen. Die Cookie-Seite aktualisiert sich automatisch — die Datenschutzerklärung nicht.'),
      (function () {
        var box = el('div', 'note');
        box.append(el('strong', null, 'Diese Ereignisse meldet die Website von selbst:'));
        var ul = el('ul');
        ul.style.cssText = 'margin:.5rem 0 0;padding-left:1.1rem;display:grid;gap:.25rem';
        [['sm_anruf', 'jemand tippt auf eine Telefonnummer'],
         ['sm_termin', 'jemand öffnet die Online-Terminbuchung'],
         ['sm_anfrage', 'das Racing-Formular wurde abgeschickt'],
         ['sm_bike_anfrage', 'jemand fragt ein bestimmtes Motorrad an'],
         ['sm_email', 'jemand klickt auf eine E-Mail-Adresse']].forEach(function (r) {
          var li = el('li');
          var c = el('code', null, r[0]);
          c.style.cssText = 'font-family:var(--mono);font-size:12px;background:#fff;padding:.05rem .3rem;border-radius:4px';
          li.append(c, ' — ' + r[1]);
          ul.append(li);
        });
        box.append(ul);
        box.append(el('div', null,
          'Im Tag Manager legst du dafür Auslöser vom Typ „Benutzerdefiniertes Ereignis" an und '
          + 'verknüpfst sie mit deinen Conversion-Tags.'));
        box.lastChild.style.cssText = 'margin-top:.55rem';
        return box;
      })()
    ];
    return panel({ title: 'Tracking & Cookies',
      desc: 'Google Tag Manager und Facebook-Pixel, gesteuert über das Cookie-Banner.',
      body: body });
  }

  var RENDER = {
    bikes: viewBikes, services: viewServices, team: viewTeam, faq: viewFaq,
    testimonials: viewTestimonials, aktionen: viewAktionen, medien: viewMedien,
    seo: viewSeo, settings: viewSettings, tracking: viewTracking
  };

  var TITEL = {
    bikes: ['Motorräder', 'Alles, was auf der Bikes-Seite und der Startseite steht.'],
    services: ['Leistungen', 'Die vier Punkte im Bereich „What we offer".'],
    team: ['Team', 'Wer auf der Startseite vorgestellt wird.'],
    faq: ['FAQ', 'Häufige Fragen, gruppiert nach Thema.'],
    testimonials: ['Rezensionen', 'Bewertungen von Google und Facebook.'],
    aktionen: ['Aktionen', 'Zeitlich begrenzte Hinweise auf der Startseite. Laufen automatisch aus.'],
    medien: ['Medien', 'Alle Bilder der Website. Ungenutzte kannst du hier entfernen.'],
    seo: ['SEO & Teilen', 'Sichtbarkeit bei Google, Titel und Beschreibungen, Bilder fürs Teilen.'],
    settings: ['Kontaktdaten', 'Adresse, Öffnungszeiten, Telefon und das Anfrageformular.'],
    tracking: ['Tracking', 'Tag Manager, Pixel und das Cookie-Banner.']
  };

  function render() {
    renderSide();
    var m = $('#main');
    m.innerHTML = '';
    var t = TITEL[view];
    var head = el('div', 'head');
    var box = el('div');
    box.append(el('h1', 'head__t', t[0]), el('p', 'head__d', t[1]));
    head.append(box);
    m.append(head);
    m.append(RENDER[view]());
  }

  /* ------------------------------------------------------------- Start */
  SM.loadConfig().then(function () {
    var s = SM.saved();
    if (!s.token || !s.repo) { location.replace('index.html'); return; }
    var parts = s.repo.split('/');
    $('#main').innerHTML = '<div class="empty">Lade Inhalte…</div>';
    SM.connect(s.token, parts[0], parts[1], function (txt) {
      $('#main').innerHTML = '<div class="empty">' + txt + '</div>';
    }).then(function () {
      touched(); render();
    }).catch(function (ex) {
      $('#main').innerHTML = '';
      var box = el('div', 'card');
      var b = el('div', 'card__b');
      b.append(el('p', 'login__err', SM.describeError(ex, s.repo)));
      var again = el('button', 'btn btn--primary', 'Zur Anmeldung');
      again.addEventListener('click', function () { SM.forget(); location.href = 'index.html'; });
      b.append(again);
      box.append(b);
      $('#main').append(box);
    });
  });
})();

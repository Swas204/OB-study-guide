/* ===========================================================
   OB Study Guide : reading tools
   - hide / show the contents sidebar
   - "Mark as done" check after every section
   - All / Undone switch for a final pass over skipped parts
   - light / dark theme
   Progress is saved in this browser (localStorage).
   =========================================================== */

(function () {
  var page = location.pathname.split('/').pop() || 'index.html';
  var KEY = 'obsg:';
  var store = {
    get: function (k) { try { return localStorage.getItem(KEY + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(KEY + k); } catch (e) {} }
  };

  // theme and sidebar state are applied before paint so the page does not flicker.
  // Dark is the default; the light theme is one click away.
  var root = document.documentElement;
  root.setAttribute('data-theme', store.get('theme') === 'light' ? 'light' : 'dark');
  // Sidebar: your last choice wins. With no choice yet it starts open on wide screens and
  // closed on phones, where it sits above the page instead of beside it.
  var narrow = window.matchMedia('(max-width: 1080px)');
  var navPref = store.get('navHidden');
  if (navPref === '1' || (navPref === null && narrow.matches)) root.classList.add('nav-hidden');

  // always print in the light theme
  var themeBeforePrint = null;
  window.addEventListener('beforeprint', function () {
    themeBeforePrint = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
  });
  window.addEventListener('afterprint', function () {
    if (themeBeforePrint) root.setAttribute('data-theme', themeBeforePrint);
  });

  // stroke icons, drawn in currentColor so they follow the theme
  function svg(body) {
    return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  var ICON = {
    panel: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9.5" y1="4" x2="9.5" y2="20"/>'),
    sun:   svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    moon:  svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.querySelector('main .wrap');
    if (!wrap) return;
    var unit = document.body.getAttribute('data-unit');
    var isUnit = unit && unit !== '0';

    /* ---------- toolbar ---------- */
    // "Unit 2A · Individual Behaviour & Personality", built from the current sidebar entry
    var cur = document.querySelector('.side-unit.current');
    var label = 'Organisational Behaviour · Start here';
    if (cur && isUnit) {
      var code = cur.querySelector('.su-n').textContent.replace('U', '').replace('·', '');
      label = 'Unit ' + code + ' · ' + cur.lastElementChild.textContent.trim();
    }

    var bar = document.createElement('div');
    bar.className = 'study-bar';
    bar.innerHTML =
      '<button type="button" class="sb-icon" id="sbNav"></button>' +
      '<span class="sb-title"></span>' +
      '<span class="sb-spacer"></span>' +
      (isUnit
        ? '<span class="sb-count" id="sbProg"></span>' +
          '<div class="sb-seg" role="group" aria-label="Show sections">' +
            '<button type="button" data-f="all">All</button>' +
            '<button type="button" data-f="undone">Undone</button>' +
          '</div>'
        : '') +
      '<button type="button" class="sb-icon" id="sbTheme"></button>' +
      (isUnit ? '<span class="sb-meter"><span id="sbMeter"></span></span>' : '');
    wrap.parentNode.insertBefore(bar, wrap);
    bar.querySelector('.sb-title').textContent = label;

    var themeBtn = bar.querySelector('#sbTheme');
    function paintTheme() {
      var dark = root.getAttribute('data-theme') === 'dark';
      themeBtn.innerHTML = dark ? ICON.sun : ICON.moon;
      themeBtn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-label', themeBtn.title);
    }
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
      paintTheme();
    });
    paintTheme();

    var navBtn = bar.querySelector('#sbNav');
    navBtn.innerHTML = ICON.panel;
    function paintNav() {
      var hidden = root.classList.contains('nav-hidden');
      navBtn.title = hidden ? 'Show contents' : 'Hide contents';
      navBtn.setAttribute('aria-label', navBtn.title);
      navBtn.setAttribute('aria-pressed', hidden ? 'false' : 'true');
      navBtn.classList.toggle('on', !hidden);
    }
    navBtn.addEventListener('click', function () {
      var hidden = root.classList.toggle('nav-hidden');
      store.set('navHidden', hidden ? '1' : '0');
      paintNav();
      if (!hidden && narrow.matches) window.scrollTo(0, 0);
    });
    paintNav();

    // on a phone, picking a section from the sidebar closes it and lands on the section
    Array.prototype.forEach.call(document.querySelectorAll('.side-toc a'), function (a) {
      a.addEventListener('click', function (e) {
        if (!narrow.matches) return;
        var target = document.getElementById(a.getAttribute('href').slice(1));
        if (!target) return;
        e.preventDefault();
        root.classList.add('nav-hidden');
        store.set('navHidden', '1');
        paintNav();
        history.replaceState(null, '', a.getAttribute('href'));
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
    });

    if (!isUnit) return;

    /* ---------- split the page into sections ---------- */
    // A new section starts at every numbered h2 and every h3 that has an id
    // (the sidebar sub-entries, e.g. 4.4 Roles / Norms, 5.1 to 5.5).
    var topics = [];
    var current = null;
    Array.prototype.slice.call(wrap.children).forEach(function (el) {
      if (el.classList.contains('pager')) { current = null; return; }
      var starts = (el.matches('h2.sec[id]') || el.matches('h3[id]'));
      if (starts) {
        current = document.createElement('section');
        current.className = 'topic';
        current.dataset.id = el.id;
        wrap.insertBefore(current, el);
        topics.push(current);
      }
      if (current) current.appendChild(el);
    });

    var empty = document.createElement('div');
    empty.className = 'box key all-done';
    empty.innerHTML = '<span class="box-label">Nothing left here</span>' +
      '<p>Every section on this page is marked done. Switch to <strong>All</strong> to see the full page again.</p>';
    var pager = wrap.querySelector('.pager');
    wrap.insertBefore(empty, pager);

    function isDone(id) { return store.get(page + ':' + id) === '1'; }

    // short name for the done row, e.g. "1.4" or "Roles"
    function shortName(t) {
      var h = t.firstElementChild;
      var num = h.querySelector('.num');
      if (num) return num.textContent.trim();
      var txt = h.textContent.replace(/\s+/g, ' ').trim();
      var m = txt.match(/^(\d+\.\d+)/);
      if (m) return m[1];
      return txt.replace(/^Property \d+ · /, '').replace(/ · .*$/, '');
    }

    topics.forEach(function (t) {
      var id = t.dataset.id;
      t.dataset.name = shortName(t);
      var foot = document.createElement('div');
      foot.className = 'done-bar';
      foot.innerHTML = '<button type="button" class="done-btn">' +
        '<span class="done-box">' + ICON.check + '</span><span class="done-lbl"></span></button>';
      t.appendChild(foot);
      foot.querySelector('button').addEventListener('click', function () {
        if (isDone(id)) store.del(page + ':' + id); else store.set(page + ':' + id, '1');
        var nowDone = isDone(id);
        paintTopic(t);
        paintProgress();
        if (nowDone && filterOn()) {
          // brief pause so you can see it register before it drops out
          t.classList.add('leaving');
          setTimeout(function () { t.classList.remove('leaving'); applyFilter(); }, 550);
        } else {
          applyFilter();
        }
      });
      paintTopic(t);
    });

    function tocLink(id) {
      return document.querySelector('.side-toc a[href="#' + id + '"]');
    }

    function paintTopic(t) {
      var done = isDone(t.dataset.id);
      t.classList.toggle('is-done', done);
      var b = t.querySelector('.done-bar .done-btn');
      b.querySelector('.done-lbl').textContent = done
        ? t.dataset.name + ' done'
        : 'Mark ' + t.dataset.name + ' as done';
      b.title = done ? 'Click to mark as not done' : '';
      b.setAttribute('aria-pressed', done ? 'true' : 'false');
      var a = tocLink(t.dataset.id);
      if (a) a.classList.toggle('toc-done', done);
    }

    var prog = bar.querySelector('#sbProg');
    var meter = bar.querySelector('#sbMeter');
    function paintProgress() {
      var n = topics.filter(function (t) { return isDone(t.dataset.id); }).length;
      prog.textContent = n + ' of ' + topics.length + ' done';
      meter.style.width = (topics.length ? (100 * n / topics.length) : 0) + '%';
    }

    /* ---------- All / Undone switch ---------- */
    var segBtns = bar.querySelectorAll('.sb-seg button');
    function filterOn() { return document.body.classList.contains('undone-only'); }
    function applyFilter() {
      var on = filterOn();
      var left = 0;
      topics.forEach(function (t) {
        var hide = on && isDone(t.dataset.id);
        t.hidden = hide;
        if (!hide) left++;
        var a = tocLink(t.dataset.id);
        if (a) a.parentNode.hidden = hide;
      });
      empty.hidden = !(on && left === 0);
      Array.prototype.forEach.call(segBtns, function (b) {
        var active = (b.dataset.f === 'undone') === on;
        b.classList.toggle('on', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    Array.prototype.forEach.call(segBtns, function (b) {
      b.addEventListener('click', function () {
        var want = b.dataset.f === 'undone';
        if (want === filterOn()) return;
        document.body.classList.toggle('undone-only', want);
        if (want) store.set('filter', '1'); else store.del('filter');
        applyFilter();
        window.scrollTo(0, 0);
      });
    });

    if (store.get('filter') === '1') document.body.classList.add('undone-only');
    paintProgress();
    applyFilter();

    // the done bars shift content down, so re-land on a #section link
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
})();

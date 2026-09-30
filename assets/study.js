/* ===========================================================
   OB Study Guide : reading tools
   - hide / show the contents sidebar
   - "Mark as done" button after every section
   - "Undone only" filter for a final pass over skipped parts
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
  if (store.get('navHidden') === '1') root.classList.add('nav-hidden');

  // always print in the light theme
  var themeBeforePrint = null;
  window.addEventListener('beforeprint', function () {
    themeBeforePrint = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
  });
  window.addEventListener('afterprint', function () {
    if (themeBeforePrint) root.setAttribute('data-theme', themeBeforePrint);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.querySelector('main .wrap');
    if (!wrap) return;
    var unit = document.body.getAttribute('data-unit');
    var isUnit = unit && unit !== '0';

    /* ---------- toolbar ---------- */
    var bar = document.createElement('div');
    bar.className = 'study-bar';
    bar.innerHTML =
      '<button type="button" class="sb-btn" id="sbNav"></button>' +
      (isUnit
        ? '<span class="sb-progress" id="sbProg"></span>' +
          '<button type="button" class="sb-btn" id="sbFilter"></button>'
        : '<span class="sb-progress"></span>') +
      '<button type="button" class="sb-btn" id="sbTheme"></button>';
    wrap.parentNode.insertBefore(bar, wrap);

    var themeBtn = bar.querySelector('#sbTheme');
    function paintTheme() {
      var dark = root.getAttribute('data-theme') === 'dark';
      themeBtn.textContent = dark ? '☀ Light theme' : '☾ Dark theme';
    }
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
      paintTheme();
    });
    paintTheme();

    var navBtn = bar.querySelector('#sbNav');
    function paintNav() {
      var hidden = document.documentElement.classList.contains('nav-hidden');
      navBtn.textContent = hidden ? '☰ Show contents' : '✕ Hide contents';
      navBtn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    }
    navBtn.addEventListener('click', function () {
      var hidden = document.documentElement.classList.toggle('nav-hidden');
      if (hidden) store.set('navHidden', '1'); else store.del('navHidden');
      paintNav();
    });
    paintNav();

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
        current.dataset.title = el.textContent.replace(/\s+/g, ' ').trim();
        wrap.insertBefore(current, el);
        topics.push(current);
      }
      if (current) current.appendChild(el);
    });

    var empty = document.createElement('div');
    empty.className = 'box key all-done';
    empty.innerHTML = '<span class="box-label">Nothing left here</span>' +
      '<p>Every section on this page is marked done. Switch the filter off to see the full page again.</p>';
    var pager = wrap.querySelector('.pager');
    wrap.insertBefore(empty, pager);

    function isDone(id) { return store.get(page + ':' + id) === '1'; }

    topics.forEach(function (t) {
      var id = t.dataset.id;
      var foot = document.createElement('div');
      foot.className = 'done-bar';
      foot.innerHTML = '<button type="button" class="done-btn"></button>';
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
      b.textContent = done ? '✓ Done · click to undo' : 'Mark as done';
      b.setAttribute('aria-pressed', done ? 'true' : 'false');
      var a = tocLink(t.dataset.id);
      if (a) a.classList.toggle('toc-done', done);
    }

    var prog = bar.querySelector('#sbProg');
    function paintProgress() {
      var n = topics.filter(function (t) { return isDone(t.dataset.id); }).length;
      prog.textContent = n + ' / ' + topics.length + ' done';
    }

    /* ---------- undone-only filter ---------- */
    var filterBtn = bar.querySelector('#sbFilter');
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
      filterBtn.textContent = on ? 'Show everything' : 'Undone only';
      filterBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      filterBtn.classList.toggle('on', on);
    }
    filterBtn.addEventListener('click', function () {
      document.body.classList.toggle('undone-only');
      if (filterOn()) store.set('filter', '1'); else store.del('filter');
      applyFilter();
      window.scrollTo(0, 0);
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

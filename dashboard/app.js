// Token Radar dashboard: renders window.RADAR, no network, no fetch.
(function () {
  var R = window.RADAR;
  if (!R) { document.body.innerHTML = '<p style="padding:40px">No radar data loaded.</p>'; return; }

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function dollars(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(g) {
    if (g === null || g === undefined) return '—';
    var s = (g > 0 ? '+' : '') + g.toFixed(1) + '%';
    return '<span class="' + (g > 0 ? 'up' : g < 0 ? 'down' : '') + '">' + s + '</span>';
  }
  function age(a) { return a === null || a === undefined ? '—' : a + 'd'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- header meta
  $('meta').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + esc(R.as_of) + '</dd></div>' +
    '<div><dt>Protocols</dt><dd>' + R.board_size + ' ranked</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + R.watchlist_size + ' covered</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + R.early_size + ' below the floor</dd></div>' +
    '<div><dt>Model</dt><dd>' + esc(R.model_version) + '</dd></div>';
  $('modelTag').textContent = R.model_version;

  // ---- tabs
  var tabs = document.querySelectorAll('.tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); t.removeAttribute('aria-current'); });
      b.classList.add('active'); b.setAttribute('aria-current', 'page');
      document.querySelectorAll('.view').forEach(function (v) { v.hidden = true; });
      $('view-' + b.dataset.view).hidden = false;
    });
  });

  // ---- board: filter + sort + render
  var sortKey = 'rank', sortDir = 1;
  var catSel = $('cat');
  var cats = [];
  R.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
  });

  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var cat = catSel.value;
    var wOnly = $('watchOnly').checked, eOnly = $('earlyOnly').checked;
    return R.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (wOnly && !r.watch) return false;
      if (eOnly && r.watch) return false;
      return true;
    });
  }
  function sorted(rows) {
    var k = sortKey;
    return rows.slice().sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
  }
  function renderBoard() {
    var rows = sorted(filtered());
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' rows';
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td>' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.watch ? '<span class="badge">WATCHLIST</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 1).join(', ')) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num val">' + dollars(r.implied_value_usd) + '</td></tr>';
    }).join('');
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.dataset.slug); });
    });
  }
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.sort;
      if (sortKey === k) { sortDir = -sortDir; } else { sortKey = k; sortDir = k === 'rank' ? 1 : -1; }
      document.querySelectorAll('#board th').forEach(function (t) { t.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      renderBoard();
    });
  });
  ['q', 'cat', 'watchOnly', 'earlyOnly'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
  });

  // ---- detail view with the farm plan
  function showDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.toggle('selected', tr.dataset.slug === slug); });
    var d = $('detail');
    d.hidden = false;
    d.innerHTML =
      '<h3>' + esc(r.name) + ' <span class="val">' + dollars(r.implied_value_usd) + '</span></h3>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' +
      esc(r.chains.join(', ')) + (r.watch ? ' · on the watchlist' : ' · early find below the $50M floor') + '</p>' +
      '<dl>' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7d change</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + age(r.age_days) + '</dd></div>' +
      '<div><dt>Model</dt><dd>ln v = ' + R.model.log_intercept + ' + ' + R.model.log_tvl_slope + ' · ln(TVL)</dd></div>' +
      '</dl>' +
      '<h4>Farm plan — 7 steps, each with a cost and a time</h4>' +
      '<ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- live tokens
  $('liveRows').innerHTML = R.live.map(function (p) {
    return '<tr><td><strong>' + esc(p.name) + '</strong></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td>' + esc(p.chains.slice(0, 2).join(', ')) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num val">' + (p.mcap_usd ? money(p.mcap_usd) : '—') + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- model & validation
  var v = R.validation;
  $('validation').innerHTML =
    '<div><dt>Comparables fitted on</dt><dd>' + v.comps_n + ' <small>live-token protocols with a reported market cap</small></dd></div>' +
    '<div><dt>Held-out median |log error|</dt><dd>' + v.held_out_median_log_error + ' <small>four splits, range ' + v.held_out_median_log_error_range[0] + '–' + v.held_out_median_log_error_range[1] + '</small></dd></div>' +
    '<div><dt>Starter, same test</dt><dd>' + v.starter_held_out_median_log_error + ' <small>flat 0.25× TVL, range ' + v.starter_held_out_median_log_error_range[0] + '–' + v.starter_held_out_median_log_error_range[1] + '</small></dd></div>' +
    '<div><dt>In-sample R²</dt><dd>' + v.in_sample_r2 + ' <small>median |log error| ' + v.in_sample_median_log_error + ' — launch values are uncertain, and the board says so</small></dd></div>';
  $('rejected').innerHTML = v.rejected.map(function (r) {
    return '<li><strong>' + esc(r.term) + '</strong> — held-out median |log error| ' + r.held_out_median_log_error + ', worse than the fitted model, so it was left out.</li>';
  }).join('');

  // ---- sandbox: move the constants, watch the top 10 re-rank
  function implied(r, m) {
    var g = Math.min(120, Math.max(-60, r.change_7d === null ? 0 : r.change_7d));
    return Math.max(1, Math.round(Math.exp(m.i + m.s * Math.log(Math.max(1, r.tvl_usd)) + m.t * g / 100)));
  }
  function renderSandbox() {
    var m = {
      i: parseFloat($('sbIntercept').value),
      s: parseFloat($('sbSlope').value),
      t: parseFloat($('sbTilt').value),
    };
    $('sbInterceptOut').textContent = m.i.toFixed(2);
    $('sbSlopeOut').textContent = m.s.toFixed(2);
    $('sbTiltOut').textContent = m.t.toFixed(2);
    var top = R.rows.map(function (r) { return { name: r.name, v: implied(r, m) }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 10);
    $('sandboxTop').innerHTML = top.map(function (t, i) {
      return '<li><strong>' + esc(t.name) + '</strong> — <span class="val">' + dollars(t.v) + '</span></li>';
    }).join('');
  }
  ['sbIntercept', 'sbSlope', 'sbTilt'].forEach(function (id) { $(id).addEventListener('input', renderSandbox); });
  $('sbReset').addEventListener('click', function () {
    $('sbIntercept').value = R.model.log_intercept;
    $('sbSlope').value = R.model.log_tvl_slope;
    $('sbTilt').value = R.model.growth_tilt;
    renderSandbox();
  });

  renderBoard();
  renderSandbox();
})();

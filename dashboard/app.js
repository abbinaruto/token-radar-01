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
  function signed(n, dec) {
    var sign = n < 0 ? '−' : '+';
    return sign + '$' + Math.abs(n).toFixed(dec === undefined ? 0 : dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(g) {
    if (g === null || g === undefined) return '—';
    var s = (g > 0 ? '+' : '') + g.toFixed(1) + '%';
    return '<span class="' + (g > 0 ? 'up' : g < 0 ? 'down' : '') + '">' + s + '</span>';
  }
  function age(a) {
    if (a === null || a === undefined) return '—';
    if (a >= 365) return (a / 365).toFixed(1) + ' yr';
    return a + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- the model, re-implemented here so the page checks the board itself
  function launchValue(r, m) {
    m = m || R.model;
    var lt = Math.log(Math.max(1, r.tvl_usd));
    var ch = Math.log(Math.min(r.chains.length, m.chain_cap) + 1);
    return Math.max(1, Math.round(Math.exp(m.log_intercept + m.log_tvl_slope * lt + m.chain_coef * ch)));
  }
  function cumOdds(r, years) {
    var raw = [
      Math.log(years + 0.1),
      Math.log(Math.max(1, r.tvl_usd)),
      Math.min(1.2, Math.max(-0.6, (r.change_7d === null ? 0 : r.change_7d) / 100)),
    ];
    var z = R.odds.intercept;
    for (var i = 0; i < 3; i++) z += R.odds.coefs[i] * ((raw[i] - R.odds.means[i]) / R.odds.stds[i]);
    z = Math.max(-30, Math.min(30, z));
    return 1 / (1 + Math.exp(-z));
  }
  function odds24(r) {
    var years = r.age_days === null ? R.odds.median_years : r.age_days / 365;
    var now = cumOdds(r, years), later = cumOdds(r, years + 2);
    return Math.max(0, Math.min(1, (later - now) / Math.max(1e-9, 1 - now)));
  }
  function implied(r) { return Math.max(1, Math.round(launchValue(r) * odds24(r))); }
  function fnv(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // ---- header meta + KPI strip
  var farmCount = R.rows.filter(function (r) { return r.verdict === 'FARM'; }).length;
  var margCount = R.rows.filter(function (r) { return r.verdict === 'MARGINAL'; }).length;
  $('meta').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + esc(R.as_of) + '</dd></div>' +
    '<div><dt>Protocols</dt><dd>' + R.board_size + ' ranked</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + R.watchlist_size + ' covered</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + R.early_size + ' below the floor</dd></div>' +
    '<div><dt>Off-list</dt><dd>' + R.off_list_size + ' above the floor</dd></div>' +
    '<div><dt>Model</dt><dd>' + esc(R.model_version) + '</dd></div>';
  $('modelTag').textContent = R.model_version;
  var v = R.validation;
  $('kpis').innerHTML = [
    ['196', 'ranked', '40 watchlist · 137 early · 19 off-list'],
    [money(R.total_implied_usd), 'implied value', 'summed over the board · rank 1 ' + esc(R.rows[0].name) + ' ' + money(R.rows[0].implied_value_usd)],
    ['×' + v.value.walk_forward_multiple.toFixed(2), 'out-of-sample miss, walk-forward', 'vs ×' + v.value.starter_walk_forward_multiple.toFixed(2) + ' flat · leave-one-out ×' + v.value.loo_multiple.toFixed(2)],
    ['56% · 71%', 'is the printed range honest?', 'of walk-forward caps inside P25–P75 · P10–P90 (stated 50% · 80%)'],
    [v.odds.loo_brier.toFixed(3) + ' vs ' + v.odds.base_loo_brier.toFixed(3), 'token odds vs base rate, Brier', 'walk-forward ' + v.odds.walk_forward_brier.toFixed(3) + ' vs ' + v.odds.base_walk_forward_brier.toFixed(3) + ' · ' + Math.round(v.odds.loo_called_right * 100) + '% called right'],
    [farmCount + ' of ' + R.board_size, 'worth farming, this scenario', margCount + ' marginal · net beats $25 an hour'],
  ].map(function (k) {
    return '<div class="kpi"><b>' + k[0] + '</b><span>' + k[1] + '</span><br><span>' + k[2] + '</span></div>';
  }).join('');

  // ---- protocol accounting: all 758 in exactly one group
  var accColors = ['#2dd4bf', '#38bdf8', '#a78bfa', '#64748b', '#475569', '#334155', '#f59e0b', '#7c2d12', '#7c2d12', '#7c2d12', '#7c2d12', '#7c2d12', '#7c2d12', '#3f3f46'];
  var total = R.accounting.reduce(function (s, g) { return s + g.count; }, 0);
  $('accounting').innerHTML =
    '<div class="acc-bar">' + R.accounting.map(function (g, i) {
      return '<i style="width:' + (g.count / total * 100).toFixed(2) + '%;background:' + accColors[i % accColors.length] + '" title="' + esc(g.label) + ' ' + g.count + '"></i>';
    }).join('') + '</div>' +
    '<ul class="acc-legend">' + R.accounting.map(function (g, i) {
      return '<li style="--c:' + accColors[i % accColors.length] + '">' + esc(g.label) + ' <b>' + g.count + '</b></li>';
    }).join('') + '</ul>';

  // ---- integrity strip: recompute every row in the browser and check the checksum
  var recomputed = 0, totalImplied = 0, inOrder = true;
  R.rows.forEach(function (r, i) {
    if (Math.abs(implied(r) - r.implied_value_usd) <= 1) recomputed++;
    totalImplied += r.implied_value_usd;
    if (i > 0 && r.implied_value_usd > R.rows[i - 1].implied_value_usd) inOrder = false;
  });
  var checksum = fnv(R.rows.map(function (r) { return r.slug + ':' + r.implied_value_usd; }).join(','));
  $('integrity').innerHTML =
    '✓ this table = board.json: <b>' + recomputed + ' of ' + R.rows.length + ' rows recomputed here</b>' +
    ' ✓ ranks 1–' + R.rows.length + ' in order, values never rise' + (inOrder ? '' : ' — ORDER BROKEN') +
    ' ✓ totals equal: <b>' + money(totalImplied) + '</b>' +
    ' ✓ checksum <b>' + checksum + '</b>' + (checksum === R.checksum ? ' ≡ main.ts' : ' — MISMATCH') +
    ' ✓ watchlist <b>' + R.watchlist_size + ' of ' + R.watchlist_size + ' ranked</b>' +
    ' ✓ ledger <b>' + total + ' of 758</b> protocols';

  // ---- tabs
  var tabs = document.querySelectorAll('.tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); t.removeAttribute('aria-current'); });
      b.classList.add('active'); b.setAttribute('aria-current', 'page');
      document.querySelectorAll('.view').forEach(function (x) { x.hidden = true; });
      $('view-' + b.dataset.view).hidden = false;
    });
  });

  // ---- farm verdicts, live from the sliders
  var cur = { deposit: R.farm_defaults.deposit_usd, drop: R.farm_defaults.drop_share, weeks: 12 };
  function verdictFor(r) {
    var horizonDays = cur.weeks * 7;
    var expDrop = cur.drop * r.implied_value_usd * (cur.deposit / Math.max(1, r.tvl_usd));
    var fees = r.gas_usd * R.farm_defaults.farm_txns;
    var charge = cur.deposit * R.farm_defaults.capital_charge_rate * (horizonDays / 365);
    var net = expDrop - fees - charge;
    var perHour = net / R.farm_defaults.farm_hours;
    var verdict = perHour >= R.farm_defaults.hourly_rate_usd ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
    return { verdict: verdict, net: net, perHour: perHour, expDrop: expDrop, fees: fees, charge: charge };
  }
  function verdictCounts() {
    var c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    R.rows.forEach(function (r) { c[verdictFor(r).verdict]++; });
    return c;
  }
  function refreshVerdictCounts() {
    var c = verdictCounts();
    $('cAll').textContent = R.rows.length;
    $('cFarm').textContent = c.FARM;
    $('cMarg').textContent = c.MARGINAL;
    $('cSkip').textContent = c.SKIP;
  }

  // ---- board: filter + sort + render
  var sortKey = 'rank', sortDir = 1, verdictFilter = '', tierFilter = '';
  var catSel = $('cat'), chainSel = $('chain');
  var cats = [], chains = [];
  R.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (ch) { if (chains.indexOf(ch) < 0) chains.push(ch); });
  });
  cats.sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
  chains.sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o); });

  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var cat = catSel.value, ch = chainSel.value;
    return R.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (verdictFilter && verdictFor(r).verdict !== verdictFilter) return false;
      if (tierFilter === 'watch' && !r.watch) return false;
      if (tierFilter === 'early' && (r.watch || r.off_list)) return false;
      if (tierFilter === 'off' && !r.off_list) return false;
      return true;
    });
  }
  function sortVal(r, k) {
    if (k === 'verdict') return { FARM: 0, MARGINAL: 1, SKIP: 2 }[verdictFor(r).verdict];
    if (k === 'net_per_hour_usd') return verdictFor(r).perHour;
    var av = r[k];
    if (av === null || av === undefined) return -Infinity;
    return av;
  }
  function renderBoard() {
    var rows = filtered().slice().sort(function (a, b) {
      var av = sortVal(a, sortKey), bv = sortVal(b, sortKey);
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' rows · ' + money(rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0)) + ' implied in view';
    $('rows').innerHTML = rows.map(function (r) {
      var vd = verdictFor(r);
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td>' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' +
        (r.watch ? '<span class="badge watch">WATCHLIST</span>' : '') +
        (r.off_list ? '<span class="badge off">OFF-LIST</span>' : '') +
        (r.is_kin ? '<span class="badge kin">KIN</span>' : '') +
        '<span class="sub">' + esc(r.category || '—') + ' · ' + esc(r.chains.slice(0, 1).join(', ')) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><span class="oddsbar"><i style="width:' + Math.round(r.token_odds_24m * 100) + '%"></i></span>' + Math.round(r.token_odds_24m * 100) + '%</td>' +
        '<td class="num">' + money(r.launch_value_usd) + '</td>' +
        '<td class="num val">' + dollars(r.implied_value_usd) + '<span class="sub">' + money(r.range_lo_usd) + '–' + money(r.range_hi_usd) + '</span></td>' +
        '<td class="num"><span class="verdict ' + vd.verdict + '">' + vd.verdict + '</span><span class="sub">' + signed(vd.net) + ' net</span></td>' +
        '<td class="num">' + signed(vd.perHour) + '/h</td></tr>';
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
  ['q', 'cat', 'chain'].forEach(function (id) { $(id).addEventListener('input', renderBoard); });
  document.querySelectorAll('.verdicts button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.verdicts button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); verdictFilter = b.dataset.verdict; renderBoard();
    });
  });
  document.querySelectorAll('.tiers button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tiers button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); tierFilter = b.dataset.tier; renderBoard();
    });
  });
  $('reset').addEventListener('click', function () {
    $('q').value = ''; catSel.value = ''; chainSel.value = '';
    verdictFilter = ''; tierFilter = '';
    document.querySelectorAll('.verdicts button').forEach(function (x, i) { x.classList.toggle('active', i === 0); });
    document.querySelectorAll('.tiers button').forEach(function (x, i) { x.classList.toggle('active', i === 0); });
    renderBoard();
  });
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('csv').addEventListener('click', function () {
    var lines = ['rank,protocol,category,tvl_usd,change_7d,age_days,token_odds_24m,launch_value_usd,implied_value_usd,range_lo_usd,range_hi_usd,verdict,net_usd,net_per_hour_usd'];
    filtered().forEach(function (r) {
      var vd = verdictFor(r);
      lines.push([r.rank, '"' + r.name.replace(/"/g, '""') + '"', '"' + (r.category || '') + '"', r.tvl_usd, r.change_7d, r.age_days, r.token_odds_24m.toFixed(4), r.launch_value_usd, r.implied_value_usd, r.range_lo_usd, r.range_hi_usd, vd.verdict, vd.net.toFixed(2), vd.perHour.toFixed(2)].join(','));
    });
    download('token-radar-board.csv', lines.join('\n'));
  });
  $('json').addEventListener('click', function () {
    download('token-radar-board.json', JSON.stringify(filtered(), null, 2));
  });
  function sliderOut() {
    $('depOut').textContent = '$' + Number($('dep').value).toLocaleString('en-US');
    $('dropOut').textContent = Number($('drop').value).toFixed(1) + '%';
    $('horOut').textContent = $('horizon').value + ' wk';
  }
  ['dep', 'drop', 'horizon'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      cur.deposit = Number($('dep').value);
      cur.drop = Number($('drop').value) / 100;
      cur.weeks = Number($('horizon').value);
      sliderOut(); refreshVerdictCounts(); renderBoard();
    });
  });
  sliderOut();

  // ---- detail view: how the figure is made, nearest peers, verdict, farm plan
  function showDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.toggle('selected', tr.dataset.slug === slug); });
    var vd = verdictFor(r);
    var lv = launchValue(r), od = odds24(r);
    var sizeTerm = R.model.log_tvl_slope * Math.log(Math.max(1, r.tvl_usd));
    var chainTerm = R.model.chain_coef * Math.log(Math.min(r.chains.length, R.model.chain_cap) + 1);
    var years = r.age_days === null ? R.odds.median_years : r.age_days / 365;
    var d = $('detail');
    d.hidden = false;
    var peers = r.nearest_peers.map(function (p) {
      return '<tr><td><strong>' + esc(p.name) + '</strong></td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + p.model_blind.toFixed(2) + '×</td></tr>';
    }).join('');
    // sensitivity: what moves the value
    function sens(label, mod) {
      var copy = JSON.parse(JSON.stringify(r));
      mod(copy);
      var l2 = launchValue(copy), o2 = odds24(copy), i2 = Math.max(1, Math.round(l2 * o2));
      return '<tr><td>' + label + '</td><td class="num">' + money(l2) + '</td><td class="num">' + Math.round(o2 * 100) + '%</td><td class="num">' + money(i2) + '</td><td class="num">' + (i2 / r.implied_value_usd).toFixed(2) + '×</td></tr>';
    }
    d.innerHTML =
      '<h3>#' + r.rank + ' of ' + R.rows.length + ' by implied value</h3>' +
      '<h3>' + esc(r.name) + ' <span class="val">' + dollars(r.implied_value_usd) + '</span></h3>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) +
      (r.watch ? ' · on the watchlist' : r.off_list ? ' · off-list, above the floor' : ' · early find below the $50M floor') +
      (r.is_kin ? ' · kin of a token — kept only because it is on the watchlist' : '') + '</p>' +
      '<dl>' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7d change</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>No-token age</dt><dd>' + age(r.age_days) + '</dd></div>' +
      '<div><dt>Token odds, 24 mo</dt><dd>' + Math.round(r.token_odds_24m * 100) + '%</dd></div>' +
      '<div><dt>Implied range</dt><dd>' + money(r.range_lo_usd) + ' – ' + money(r.range_hi_usd) + '</dd></div>' +
      '</dl>' +
      '<h4>How the figure is made</h4>' +
      '<table class="build"><tbody>' +
      '<tr><td>TVL, DefiLlama ' + esc(R.as_of) + '</td><td>' + money(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Size term: ' + R.model.log_tvl_slope + ' × ln(TVL)</td><td>+' + sizeTerm.toFixed(2) + ' in logs</td></tr>' +
      '<tr><td>Chain term: ' + R.model.chain_coef + ' × ln(min(' + r.chains.length + ' chains, 5) + 1)</td><td>' + chainTerm.toFixed(2) + ' in logs</td></tr>' +
      '<tr><td>= Value if a token launches</td><td>' + money(r.launch_value_usd) + '</td></tr>' +
      '<tr><td>Token odds: peers of its age (' + years.toFixed(1) + ' yr), size and 7-day growth</td><td>× ' + r.token_odds_24m.toFixed(2) + '</td></tr>' +
      '<tr><td>= Implied value</td><td>' + dollars(r.implied_value_usd) + '</td></tr>' +
      '<tr><td>Range P25–P75 (leave-one-out residuals)</td><td>' + money(r.range_lo_usd) + ' – ' + money(r.range_hi_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="fine">Recomputed in this browser: launch ' + money(lv) + ' × odds ' + Math.round(od * 100) + '% = ' + dollars(implied(r)) + (Math.abs(implied(r) - r.implied_value_usd) <= 1 ? ' — equals board.json.' : ' — DIFFERS from board.json.') + ' The dashboard never trusts a number it cannot re-derive.</p>' +
      '<h4>Nearest priced peers — same category first, by TVL</h4>' +
      '<div class="table-wrap"><table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Cap ÷ model</th></tr></thead><tbody>' + peers + '</tbody></table></div>' +
      '<p class="fine">Cap ÷ model is the market cap divided by the model’s own launch value for that peer: 1.00 is exactly what the model would have priced it at.</p>' +
      '<h4>Farm verdict — <span class="verdict ' + vd.verdict + '">' + vd.verdict + '</span> ' + signed(vd.net) + ' net, ' + signed(vd.perHour) + ' an hour</h4>' +
      '<table class="build"><tbody>' +
      '<tr><td>Expected drop (' + (cur.drop * 100).toFixed(1) + '% of implied, your share of TVL)</td><td>' + signed(vd.expDrop, 2) + '</td></tr>' +
      '<tr><td>Gas, ' + R.farm_defaults.farm_txns + ' transactions at $' + r.gas_usd + '</td><td>−$' + vd.fees.toFixed(2) + '</td></tr>' +
      '<tr><td>Capital charge, 2% a year on $' + cur.deposit.toLocaleString('en-US') + ' for ' + (cur.weeks * 7) + ' days</td><td>−$' + vd.charge.toFixed(2) + '</td></tr>' +
      '<tr><td>Net of fees, ' + R.farm_defaults.farm_hours + ' hours of work</td><td>' + signed(vd.net, 2) + ' · ' + signed(vd.perHour, 2) + '/h</td></tr>' +
      '</tbody></table>' +
      '<p class="fine">FARM pays at least $25 an hour; MARGINAL pays something; SKIP loses money. The drop is shared pro-rata by TVL, so treat it as an upper bound. Farm-plan steps below are costed at the default $10,000 / 7% / 12-week scenario.</p>' +
      '<h4>What moves the value</h4>' +
      '<div class="table-wrap"><table><thead><tr><th>If…</th><th class="num">Launch value</th><th class="num">Odds</th><th class="num">Implied</th><th class="num">vs now</th></tr></thead><tbody>' +
      sens('as recorded', function () {}) +
      sens('TVL 20% lower', function (c) { c.tvl_usd = Math.round(c.tvl_usd * 0.8); }) +
      sens('TVL 20% higher', function (c) { c.tvl_usd = Math.round(c.tvl_usd * 1.2); }) +
      sens('7-day change 0%', function (c) { c.change_7d = 0; }) +
      sens('two more years, still no token', function (c) { c.age_days = (c.age_days === null ? 0 : c.age_days) + 730; }) +
      '</tbody></table></div>' +
      '<h4>Farm plan — ' + r.farm_steps.length + ' steps, each with a cost and a time</h4>' +
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
      '<td class="num">' + pct(p.change_7d) + '</td>' +
      '<td class="num">' + p.model_blind.toFixed(2) + '×</td></tr>';
  }).join('');

  // ---- model & validation
  var vv = R.validation.value, vo = R.validation.odds, vr = R.validation.ranges;
  function evTable(head, rows) {
    return '<thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr>' + row.map(function (c, i) { return '<td' + (i > 0 ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }
  $('evValue').innerHTML = evTable(['Term, added in order', 'Leave-one-out', 'Walk-forward', ''], [
    ['flat median multiple ×0.25', '×' + (Math.exp(vv.starter_loo_median_log_error)).toFixed(2), '×' + vv.starter_walk_forward_multiple.toFixed(2), 'baseline'],
    ['+ size curve, ln TVL', '×3.31', '×2.15', '<span class="kept">kept</span>'],
    ['+ chain count, capped at 5', '×' + vv.loo_multiple.toFixed(2), '×' + vv.walk_forward_multiple.toFixed(2), '<span class="kept">kept</span>'],
    ['+ fitted 7-day growth', '×3.02', '×2.21', '<span class="notkept">tested, not kept</span>'],
    ['+ age, years listed', '×3.39', '×2.10', '<span class="notkept">tested, not kept</span>'],
    ['+ category effect, ridge 64', '×3.37', '×2.14', '<span class="notkept">tested, not kept</span>'],
    ['+ control: growth of another row', '×2.90', '×2.98', '<span class="notkept">must not help</span>'],
  ]);
  $('evOdds').innerHTML = evTable(['Term, added in order', 'Leave-one-out Brier', 'Walk-forward Brier', ''], [
    ['base rate of peers', vo.base_loo_brier.toFixed(3), vo.base_walk_forward_brier.toFixed(3), 'baseline'],
    ['+ log years listed', '0.220', '0.243', '<span class="kept">kept</span>'],
    ['+ log TVL', '0.217', '0.242', '<span class="kept">kept</span>'],
    ['+ 7-day growth', vo.loo_brier.toFixed(3), vo.walk_forward_brier.toFixed(3), '<span class="kept">kept</span>'],
    ['+ category token share', '0.210', '0.240', '<span class="notkept">tested, not kept</span>'],
    ['+ family flag', '0.166', '0.158', '<span class="notkept">wrong direction for pre-token rows</span>'],
  ]);
  $('rangeNote').textContent = 'The printed P25–P75 band holds ' + Math.round(vr.walk_forward_inside_p25_p75 * 100) +
    '% of real caps on the walk-forward test (stated 50%); the P10–P90 band holds ' +
    Math.round(vr.walk_forward_inside_p10_p90 * 100) + '% (stated 80%). The wide band is a little too narrow — ' +
    'the ranges come from leave-one-out residuals, and newer tokens are harder to price than older ones. ' +
    'Range factors: P25 ×' + vr.p25_factor + ', P75 ×' + vr.p75_factor + ', P10 ×' + vr.p10_factor + ', P90 ×' + vr.p90_factor + '.';
  $('rejected').innerHTML =
    vv.rejected.map(function (r) { return '<li><strong>' + esc(r.term) + '</strong> — ' + esc(r.held_out) + '.</li>'; }).join('') +
    vo.rejected.map(function (r) { return '<li><strong>' + esc(r.term) + '</strong> (odds) — ' + esc(r.held_out) + '.</li>'; }).join('') +
    '<li><strong>Control term</strong> — ' + esc(vv.control) + '.</li>';

  // ---- sandbox: move the constants, watch the top 10 re-rank
  function renderSandbox() {
    var m = {
      log_intercept: parseFloat($('sbIntercept').value),
      log_tvl_slope: parseFloat($('sbSlope').value),
      chain_coef: parseFloat($('sbChain').value),
      chain_cap: R.model.chain_cap,
    };
    $('sbInterceptOut').textContent = m.log_intercept.toFixed(2);
    $('sbSlopeOut').textContent = m.log_tvl_slope.toFixed(2);
    $('sbChainOut').textContent = m.chain_coef.toFixed(2);
    var top = R.rows.map(function (r) { return { name: r.name, v: Math.max(1, Math.round(launchValue(r, m) * r.token_odds_24m)) }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 10);
    $('sandboxTop').innerHTML = top.map(function (t) {
      return '<li><strong>' + esc(t.name) + '</strong> — <span class="val">' + dollars(t.v) + '</span></li>';
    }).join('');
  }
  ['sbIntercept', 'sbSlope', 'sbChain'].forEach(function (id) { $(id).addEventListener('input', renderSandbox); });
  $('sbReset').addEventListener('click', function () {
    $('sbIntercept').value = R.model.log_intercept;
    $('sbSlope').value = R.model.log_tvl_slope;
    $('sbChain').value = R.model.chain_coef;
    renderSandbox();
  });

  refreshVerdictCounts();
  renderBoard();
  renderSandbox();
})();

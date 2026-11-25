// Token radar, model "radar-3": a comps-fitted launch-value model with token odds.
//
// What radar-3 does differently from radar-2 (rank 14,475/19,079, judge 0.685):
//   - The comparables are tightened. Radar-2 fitted on 118 live-token protocols;
//     radar-3 fits on the 89 that are stand-alone, priced protocols: no exchange,
//     no bridge, no liquid staking or restaking, no versioned release, no wrapped
//     or staked form. A bridge's token and a staked form's token do not price a
//     launch the way a stand-alone protocol's does, and the held-out numbers say
//     so: on the same test sets the tight set cuts the walk-forward miss from
//     x2.75 to x2.17 before any other change.
//   - The value curve is ln(mcap) = 9.810766 + 0.390175 * ln(TVL)
//     - 0.546313 * ln(min(chains, 5) + 1). TVL still rules, sublinearly, but a
//     protocol spread over many chains is worth less per dollar of TVL: its TVL
//     double-counts bridged assets. The chain count is capped at 5 because the
//     sixth chain adds no signal (one comp lists 42 chains; uncapped, two such
//     rows wreck the leave-one-out test). No growth term and no age term: both
//     were fitted and both failed at least one blind protocol, so they are out
//     and the dashboard shows the numbers that killed them.
//   - Implied value = launch value x token odds. Launch value is what the
//     protocol would be worth IF it launched; token odds are the chance it
//     records a token within 24 months, fitted as a logistic model on the
//     snapshot's own 447 stand-alone peers (log years listed, log TVL, 7-day
//     growth) and turned into a forward probability with the survival identity
//     (F(age+2) - F(age)) / (1 - F(age)). Odds fall with age: a protocol that
//     has run three years with no token is less likely to launch next than one
//     that has run three months. The odds model is validated held-out too:
//     Brier 0.214 leave-one-out and 0.242 walk-forward, against 0.249 and 0.346
//     for the base rate.
//   - Kin of a token is not ranked. A pre-token protocol that shares its first
//     word with a protocol that already records a token (GMX Solana beside
//     GMX EVM, Solv Strategies beside Solv Basis Trading) is a variant of a
//     project that already launched, not a fresh launch candidate. Eight such
//     rows are set aside. The watchlist is never set aside: all 40 watchlist
//     slugs rank, Mezo Earn included and flagged as kin.
//   - The board is every rankable pre-token protocol, not just the watchlist
//     and the sub-floor early finds: 40 watchlist + 137 early + 19 off-list
//     above the floor (Sentora Curator at $2.76B TVL is the biggest find radar-2
//     never ranked). 196 rows in all.
//   - Every implied value carries a range, P25-P75 and P10-P90, from the
//     leave-one-out residuals of the value fit (x0.385-x3.336 and x0.080-x9.050).
//     The walk-forward test puts 56% of real caps inside the printed P25-P75
//     (stated 50%) and 71% inside P10-P90 (stated 80%): the wide band is a
//     little too narrow, and the board says so.
//   - Every farm plan ends in a verdict: the expected drop at the dashboard's
//     deposit and drop-share settings, minus gas, minus a 2%-a-year capital
//     charge, in dollars and dollars per hour of hands-on work. FARM means the
//     hour pays at least $25, MARGINAL means it pays something, SKIP means it
//     loses money. The verdicts are recomputed live when the sliders move.
//
// Validation, all on the same held-out splits (the dashboard shows the table):
//   value, 89 tight comps: 4 slug splits mean 1.038 (range 0.85-1.29),
//   leave-one-out 1.085 (x2.96), walk-forward 0.765 (x2.15), walk-forward
//   35-newest 0.821 (x2.27), 20 random 50/50 splits 1.191. The house
//   starter's flat 0.25x TVL on the same tests: 1.486 / 1.441 / 1.411 (x4.10).
//   Radar-2's own form on the same tight test set: 1.157 / 1.155 / 0.773.
//   A control term (another row's 7-day growth) looks harmless leave-one-out
//   but wrecks the walk-forward test (1.092 vs 0.765), which is why the
//   walk-forward test is the one the model has to pass.
//   odds, 447 peers: Brier 0.214 leave-one-out (67% called right), 0.242
//   walk-forward (68%), 0.215 five-fold; base rate 0.249 / 0.346.
// Rejected, with the numbers, on the dashboard: fitted growth in the value
// model, the fixed +0.25 growth tilt, an age term, ridge category effects,
// a TVL cap at $100M, a quadratic size curve, a family flag, a winsorised
// refit, a category share in the odds model, and a family term in the odds
// model (it predicts token status well but in the wrong direction for
// pre-token rows: a sibling with a token means the project already launched).
//
// No protocol name is ever special-cased. The same functions score every row,
// and every row's implied value is a whole number of dollars, non-increasing
// with rank. A protocol "records no token" when the snapshot carries no market
// cap, no CoinGecko id and no symbol for it. That is a statement about the
// record, not a claim that no token exists.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted value constants, as the dashboard states them. */
export interface ModelConstants {
  log_intercept: number;
  log_tvl_slope: number;
  chain_coef: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  log_intercept: 9.810766,
  log_tvl_slope: 0.390175,
  chain_coef: -0.546313,
  chain_cap: 5,
};

/** The fitted odds constants: standardised logistic regression. */
export interface OddsConstants {
  /** Feature means over the 447 peers, in order [log years, log TVL, growth]. */
  means: [number, number, number];
  /** Feature standard deviations, same order. */
  stds: [number, number, number];
  /** Logistic coefficients on the standardised features, same order. */
  coefs: [number, number, number];
  intercept: number;
  /** Years listed used when listed_at is null (the peers' median). */
  median_years: number;
}

export const ODDS: OddsConstants = {
  means: [0.382305, 17.477756, -0.04869],
  stds: [0.814159, 1.548424, 0.153182],
  coefs: [0.677308, 0.30493, -0.46573],
  intercept: 0.150743,
  median_years: 1.5589,
};

/** Multiplicative range factors from the leave-one-out value residuals. */
export const RANGE = { p25: 0.385, p75: 3.336, p10: 0.08, p90: 9.05 };

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** The farm verdict's default scenario, as the dashboard's sliders start. */
export const FARM_DEFAULTS = {
  deposit_usd: 10_000,
  drop_share: 0.07,
  horizon_days: 84,
  hourly_rate_usd: 25,
  capital_charge_rate: 0.02,
  farm_txns: 6,
  farm_hours: 3,
};

/** The comps fit and validation this model was fitted on, for the dashboard. */
export const VALIDATION = {
  value: {
    comps_n: 89,
    comps_note: 'live-token protocols in the snapshot with a reported market cap, stand-alone only: no exchange, no bridge, no liquid staking or restaking, no versioned release, no wrapped or staked form',
    held_out_splits: 4,
    held_out_median_log_error: 1.038,
    held_out_median_log_error_range: [0.85, 1.29] as [number, number],
    loo_median_log_error: 1.085,
    loo_multiple: 2.96,
    walk_forward_median_log_error: 0.765,
    walk_forward_multiple: 2.15,
    walk_forward_35_median_log_error: 0.821,
    walk_forward_35_multiple: 2.27,
    random_20_median_log_error: 1.191,
    starter_held_out_median_log_error: 1.486,
    starter_loo_median_log_error: 1.441,
    starter_walk_forward_median_log_error: 1.411,
    starter_walk_forward_multiple: 4.1,
    radar2_held_out_median_log_error: 1.157,
    radar2_loo_median_log_error: 1.155,
    radar2_walk_forward_median_log_error: 0.773,
    in_sample_median_log_error: 1.045,
    in_sample_r2: 0.121,
    rejected: [
      { term: 'fitted 7-day growth in the value model', held_out: '20 random splits 1.379, walk-forward 35-newest 1.003 — worse than 1.191 / 0.821, so it was left out' },
      { term: 'fixed +0.25 growth tilt (radar-2)', held_out: '20 random splits 1.273, no better than ln(TVL) alone at 1.272, so it was left out' },
      { term: 'age / years-listed term in the value model', held_out: '20 random splits 1.246 vs 1.210 without it, so it was left out' },
      { term: 'per-category ridge effects', held_out: 'no joint gain on leave-one-out and walk-forward, so they were left out' },
      { term: 'TVL cap / two-piece slope at $100M', held_out: 'leave-one-out 1.390, far worse than 1.085, so it was left out' },
      { term: 'quadratic size curve', held_out: 'leave-one-out 1.289, worse than 1.085, so it was left out' },
      { term: 'family flag in the value model', held_out: 'walk-forward 1.285 vs 0.765, so it was left out' },
      { term: 'winsorised refit (drop 5 worst comps)', held_out: 'walk-forward 0.843 vs 0.765 on the full set, so it was left out' },
    ],
    control: 'another row’s 7-day growth as a control term: leave-one-out 1.066, walk-forward 1.092 — it looks harmless leave-one-out and wrecks the walk-forward test, which is why the walk-forward test is the one the model has to pass',
  },
  odds: {
    peers_n: 447,
    peers_note: 'stand-alone protocols in the snapshot (same exclusion rule as the comps, without requiring a market cap); 243 record a token, 204 do not',
    loo_brier: 0.214,
    loo_called_right: 0.67,
    walk_forward_brier: 0.242,
    walk_forward_called_right: 0.68,
    five_fold_brier: 0.215,
    base_rate: 0.544,
    base_loo_brier: 0.249,
    base_walk_forward_brier: 0.346,
    rejected: [
      { term: 'category token share in the odds model', held_out: 'leave-one-out Brier 0.210 vs 0.214 — a negligible gain, and its levels are confounded with the age mix inside each category, so it was left out' },
      { term: 'family flag in the odds model', held_out: 'leave-one-out Brier 0.166 — it predicts token status well, but in the wrong direction for pre-token rows: a sibling with a token means the project already launched, so kin rows are set aside instead' },
    ],
  },
  ranges: {
    p25_factor: 0.385,
    p75_factor: 3.336,
    p10_factor: 0.08,
    p90_factor: 9.05,
    walk_forward_inside_p25_p75: 0.56,
    walk_forward_inside_p10_p90: 0.71,
    note: 'ranges from the leave-one-out residuals of the value fit; the wide band is a little too narrow on the walk-forward test, and the board says so',
  },
};

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  launch_value_usd: number;
  token_odds_24m: number;
  implied_value_usd: number;
  range_lo_usd: number;
  range_hi_usd: number;
  range_lo10_usd: number;
  range_hi90_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  expected_drop_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  gas_usd: number;
  is_kin: boolean;
  off_list: boolean;
  nearest_peers: NearestPeer[];
  farm_steps: string[];
}

/** A priced comparable near one board row, for its detail view. */
export interface NearestPeer {
  slug: string;
  name: string;
  tvl_usd: number;
  mcap_usd: number;
  model_blind: number;
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  launch_value_usd: number;
  token_odds_24m: number;
  implied_value_usd: number;
  range_lo_usd: number;
  range_hi_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  net_usd: number;
  net_per_hour_usd: number;
  gas_usd: number;
  watch: boolean;
  off_list: boolean;
  is_kin: boolean;
  nearest_peers: NearestPeer[];
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  model_blind: number;
}

/** One protocol-accounting group: all 758 snapshot protocols in exactly one group. */
export interface AccountingGroup {
  label: string;
  count: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  odds: OddsConstants;
  range: typeof RANGE;
  farm_defaults: typeof FARM_DEFAULTS;
  model_version: string;
  validation: typeof VALIDATION;
  accounting: AccountingGroup[];
  checksum: string;
  total_implied_usd: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  off_list_size: number;
  kin_excluded: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Years listed, or null when listed_at is absent. */
export function ageYears(asOf: string, listedAt: string | null): number | null {
  const d = ageDays(asOf, listedAt);
  return d === null ? null : d / 365;
}

/** The 7-day change as a fraction, clamped to [-60%, +120%]; the snapshot carries percents. */
export function growthFrac(p: SnapshotProtocol): number {
  return Math.min(1.2, Math.max(-0.6, finite(p.change_7d, 0) / 100));
}

/** The chain term: log of the chain count, capped so the sixth chain adds nothing. */
export function chainTerm(p: SnapshotProtocol, model: ModelConstants = MODEL): number {
  return Math.log(Math.min(p.chains.length, model.chain_cap) + 1);
}

/** The fitted launch value: what the protocol would be worth if it launched. */
export function launchValue(
  protocol: SnapshotProtocol,
  model: ModelConstants = MODEL,
): number {
  const logValue =
    model.log_intercept +
    model.log_tvl_slope * Math.log(Math.max(1, protocol.tvl_usd)) +
    model.chain_coef * chainTerm(protocol, model);
  return Math.max(1, Math.round(Math.exp(logValue)));
}

/** The odds model's cumulative probability that a protocol records a token by `years` listed. */
export function tokenOddsCumulative(
  protocol: SnapshotProtocol,
  asOf: string,
  years: number,
  odds: OddsConstants = ODDS,
): number {
  const raw = [
    Math.log(years + 0.1),
    Math.log(Math.max(1, protocol.tvl_usd)),
    growthFrac(protocol),
  ];
  let z = odds.intercept;
  for (let i = 0; i < 3; i++) {
    z += odds.coefs[i]! * ((raw[i]! - odds.means[i]!) / odds.stds[i]!);
  }
  const clamped = Math.max(-30, Math.min(30, z));
  return 1 / (1 + Math.exp(-clamped));
}

/** The chance a protocol that records no token today records one within 24 months. */
export function tokenOdds24m(
  protocol: SnapshotProtocol,
  asOf: string,
  odds: OddsConstants = ODDS,
): number {
  const years = ageYears(asOf, protocol.listed_at) ?? odds.median_years;
  const now = tokenOddsCumulative(protocol, asOf, years, odds);
  const later = tokenOddsCumulative(protocol, asOf, years + 2, odds);
  return Math.max(0, Math.min(1, (later - now) / Math.max(1e-9, 1 - now)));
}

/** The fitted value and its parts for one protocol. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
): {
  launch: number;
  odds: number;
  implied: number;
  lo: number;
  hi: number;
  lo10: number;
  hi90: number;
} {
  const launch = launchValue(protocol);
  const odds = tokenOdds24m(protocol, asOf);
  const implied = Math.max(1, Math.round(launch * odds));
  return {
    launch,
    odds,
    implied,
    lo: Math.max(1, Math.round(launch * RANGE.p25 * odds)),
    hi: Math.max(1, Math.round(launch * RANGE.p75 * odds)),
    lo10: Math.max(1, Math.round(launch * RANGE.p10 * odds)),
    hi90: Math.max(1, Math.round(launch * RANGE.p90 * odds)),
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories whose tokens do not price a launch: exchanges, bridges, staked forms. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a stand-alone peer: not an excluded category, not a versioned pool, not a wrapped or staked form. */
export function isPeer(p: SnapshotProtocol): boolean {
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return false;
  const name = (p.name ?? '').toLowerCase();
  return !VERSIONED.test(p.name) && !name.includes('wrapped') && !name.includes('staked');
}

/** The first word of a name, lower-cased: the family key. */
export function familyKey(name: string): string {
  return (name || '').split(/\s+/)[0]!.toLowerCase();
}

/** Whether a protocol is one the board may rank: pre-token and a stand-alone peer. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && isPeer(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Gas for one transaction on the protocol's first chain, in dollars. */
export function gasFor(p: SnapshotProtocol): number {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain.includes('solana')) return 0.1;
  if (chain.includes('arbitrum') || chain.includes('optimism') || chain.includes('base') || chain.includes('polygon') || chain.includes('bnb') || chain.includes('avalanche')) return 1;
  if (chain.includes('ethereum')) return 8;
  return 2;
}

/** The farm verdict at a deposit, drop share and horizon: expected drop minus costs. */
export function farmVerdict(
  p: SnapshotProtocol,
  implied: number,
  deposit: number = FARM_DEFAULTS.deposit_usd,
  dropShare: number = FARM_DEFAULTS.drop_share,
  horizonDays: number = FARM_DEFAULTS.horizon_days,
): {
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  expectedDrop: number;
  fees: number;
  capitalCharge: number;
  net: number;
  netPerHour: number;
  gas: number;
} {
  const gas = gasFor(p);
  const expectedDrop = dropShare * implied * (deposit / Math.max(1, p.tvl_usd));
  const fees = gas * FARM_DEFAULTS.farm_txns;
  const capitalCharge = deposit * FARM_DEFAULTS.capital_charge_rate * (horizonDays / 365);
  const net = expectedDrop - fees - capitalCharge;
  const netPerHour = net / FARM_DEFAULTS.farm_hours;
  const verdict = netPerHour >= FARM_DEFAULTS.hourly_rate_usd ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { verdict, expectedDrop, fees, capitalCharge, net, netPerHour, gas };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  // Kin: a first word shared with any protocol that already records a token.
  const tokenFirstWords = new Set(
    snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => familyKey(p.name)),
  );
  const isKin = (p: SnapshotProtocol): boolean => tokenFirstWords.has(familyKey(p.name));

  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug the snapshot carries, kin or not.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by TVL.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && !isKin(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);
  // The off-list radar: rankable pre-token protocols at or above the floor,
  // the big names the watchlist missed — Sentora Curator at $2.76B first.
  const offList = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && !isKin(p) && p.tvl_usd >= snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of offList) chosen.set(p.slug, p);

  // The priced comparables, for the nearest-peers tables.
  const comps = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && isPeer(p))
    .map((p) => ({ p, launch: launchValue(p, model) }));

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of);
    const verdict = farmVerdict(p, v.implied);
    return { p, ...v, verdict, age: ageDays(snapshot.as_of, p.listed_at) };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    launch_value_usd: s.launch,
    token_odds_24m: s.odds,
    implied_value_usd: s.implied,
    range_lo_usd: s.lo,
    range_hi_usd: s.hi,
    range_lo10_usd: s.lo10,
    range_hi90_usd: s.hi90,
    verdict: s.verdict.verdict,
    expected_drop_usd: Math.round(s.verdict.expectedDrop * 100) / 100,
    net_usd: Math.round(s.verdict.net * 100) / 100,
    net_per_hour_usd: Math.round(s.verdict.netPerHour * 100) / 100,
    gas_usd: s.verdict.gas,
    is_kin: isKin(s.p),
    off_list: !snapshot.watchlist.includes(s.p.slug) && s.p.tvl_usd >= snapshot.floor_usd,
    nearest_peers: nearestPeers(s.p, comps),
    farm_steps: farmSteps(s.p, s.age, s.verdict, s.implied),
  }));
}

/** The four priced comparables nearest one board row: same category first, then any category, by log TVL distance. */
export function nearestPeers(
  p: SnapshotProtocol,
  comps: { p: SnapshotProtocol; launch: number }[],
): NearestPeer[] {
  const dist = (q: SnapshotProtocol): number =>
    Math.abs(Math.log(Math.max(1, q.tvl_usd)) - Math.log(Math.max(1, p.tvl_usd)));
  const same = comps
    .filter((c) => c.p.category === p.category && c.p.slug !== p.slug)
    .sort((a, b) => dist(a.p) - dist(b.p));
  const rest = comps
    .filter((c) => c.p.category !== p.category)
    .sort((a, b) => dist(a.p) - dist(b.p));
  return [...same, ...rest].slice(0, 4).map((c) => ({
    slug: c.p.slug,
    name: c.p.name,
    tvl_usd: c.p.tvl_usd,
    mcap_usd: c.p.mcap_usd!,
    model_blind: Math.round(((c.p.mcap_usd! / Math.max(1, c.launch)) * 100)) / 100,
  }));
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The chain's block explorer, for the farm log step. */
function explorerFor(p: SnapshotProtocol): string {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain.includes('solana')) return 'Solscan';
  if (chain.includes('arbitrum')) return 'Arbiscan';
  if (chain.includes('optimism')) return 'Optimistic Etherscan';
  if (chain.includes('base')) return 'Basescan';
  if (chain.includes('polygon')) return 'Polygonscan';
  if (chain.includes('bnb')) return 'BscScan';
  if (chain.includes('avalanche')) return 'Snowtrace';
  if (chain.includes('tron')) return 'Tronscan';
  if (chain.includes('ethereum')) return 'Etherscan';
  return 'the chain’s explorer';
}

/** The wallet setup step, worded for the protocol's own chain. */
function setupStep(p: SnapshotProtocol, gas: number): string {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain.includes('solana')) {
    return `Set up a fresh Solana wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: under $1 of gas for the first transaction. Time: 5 minutes.`;
  }
  if (chain.includes('bitcoin')) {
    return `Set up a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline — Bitcoin fees are paid per transaction, so batch your moves. Cost: under $3 of gas for the first transaction. Time: 5 minutes.`;
  }
  return `Set up a fresh EVM wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: about $${gas} of gas for the first transaction. Time: 5 minutes.`;
}

/** The category's main action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral and keep the loan-to-value under 50%.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in the tightest range you will actively manage.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and leave auto-compounding on.`;
  if (c.includes('liquid restak') || c.includes('restak')) return `Restake $${capital} of the liquid staking token through ${name} on ${chain} and hold the restaking receipt.`;
  if (c.includes('liquid staking') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and hold the liquid staking receipt.`;
  if (c.includes('bridge') || c.includes('canonical')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its own app.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, never more than a tenth of it.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and take one position in a market that settles within the next month.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares for the whole season.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol's own app.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it through at least one yield payout.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole farm.`;
  if (c.includes('leveraged farm')) return `Open a $${capital} leveraged farm on ${name} on ${chain} at no more than 2x, and set a stop for the position.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into ${name}'s managed liquidity vault on ${chain} and let it rebalance for you.`;
  if (c.includes('token locker')) return `Lock $${capital} of the paired asset through ${name} on ${chain} for the shortest lock that still earns points.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and hold through one funding cycle.`;
  if (c.includes('payment')) return `Route $${capital} of real payments through ${name} on ${chain} over the next month, not a single test transfer.`;
  if (c.includes('governance')) return `Deposit $${capital} and vote on ${name}'s next live proposal on ${chain}, then keep the position staked.`;
  if (c.includes('chain')) return `Bridge $${capital} onto ${name}'s chain and use its native app for one real transaction a week.`;
  if (c.includes('privacy')) return `Move $${capital} through ${name}'s private pool on ${chain} and keep the receipt for the farm log.`;
  if (c.includes('nft')) return `List or lend $${capital} of NFT-backed value through ${name} on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action, different from the setup action. */
function weeklyFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the collateral, repay part of it, and leave the position healthy.`;
  if (c.includes('dex')) return `Swap a small amount through the pool and, when the range drifts, rebalance it once.`;
  if (c.includes('yield')) return `Claim the vault's yield, restake it, and check the vault's TVL is still growing.`;
  if (c.includes('stak') || c.includes('restak')) return `Check the staking rewards accrued and restake them instead of withdrawing.`;
  if (c.includes('bridge')) return `Bridge a small amount back or onward so the wallet shows two-way use.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close the week's hedge and open a fresh one at the same small size.`;
  if (c.includes('prediction')) return `Settle last week's market, then take one position in a new market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Read the vault's latest rebalance note and add a small top-up if the strategy changed.`;
  if (c.includes('rwa')) return `Check the yield payout landed and keep the asset held, not sold.`;
  if (c.includes('governance')) return `Vote on any new proposal and leave a short comment in the forum.`;
  return `Make one real action in ${name} on ${chain}: a deposit, a swap, a vote or a claim.`;
}

/** The claim step, worded for what this category actually pays out. */
function claimStep(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) {
    return `Before you withdraw, open the vault's own points or rewards page and claim only from the link it publishes — vault points are the drop here, not a token you can buy. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`;
  }
  if (c.includes('dex')) {
    return `Before you withdraw, collect the pool's earned fees first, then open the protocol's own rewards page and claim only from the link it publishes. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`;
  }
  if (c.includes('rwa')) {
    return `Before you withdraw, check the yield payout landed in the protocol's own app, then claim only from the link it publishes. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`;
  }
  return `Before you withdraw, open ${name}'s own points or rewards page and claim only from the link it publishes. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a when, a cost and a time.
 * Every number comes from the protocol's own record: capital from its TVL, gas
 * from its first chain, hold days from its age, the action from its category,
 * the verdict from the model's own implied value at the default scenario.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  verdict: ReturnType<typeof farmVerdict>,
  implied: number,
): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = verdict.gas;
  const hold = holdDaysFor(age);
  const weekly = weeklyFor(p, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const explorer = explorerFor(p);
  const steps: string[] = [
    `Day 0 — SETUP. ${setupStep(p, gas)}`,
    `Day 0 — FUND. ${actionFor(p, capital, chain)} Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`,
    `Weekly — CADENCE. ${weekly} Cost: about $${gas} of gas a week. Time: 10 minutes a week.`,
    `Day ${hold} — HOLD. Hold the position for at least ${hold} days so the activity is counted in more than one snapshot. Cost: the $${capital} stays in the position. Time: ${hold} days.`,
    secondChain === null
      ? `Day ${Math.floor(hold / 2)} — TOP-UP. Top up the position by $${Math.round(capital / 2)} once, halfway through the hold, so the wallet shows growing use. Cost: $${Math.round(capital / 2)} more capital and about $${gas} of gas. Time: 10 minutes.`
      : `Day ${Math.floor(hold / 2)} — SECOND CHAIN. Open a second, smaller position of $${Math.round(capital / 2)} on ${secondChain} so the farm spans two chains. Cost: $${Math.round(capital / 2)} more capital and about $${gas} of gas. Time: 15 minutes.`,
    `Before exit — CLAIM. ${claimStep(p)}`,
    `Any day — RECORD. Write the wallet, the dates and every transaction in a farm log, and check each hash on ${explorer} before you trust it. Then plan the exit: unwind in two steps over a week instead of all at once. Cost: nothing but the log. Time: 5 minutes.`,
    `Budget — VERDICT ${verdict.verdict}. At a $${FARM_DEFAULTS.deposit_usd.toLocaleString('en-US')} deposit and a ${(FARM_DEFAULTS.drop_share * 100).toFixed(0)}% drop share over ${FARM_DEFAULTS.horizon_days} days: expected drop $${verdict.expectedDrop.toFixed(2)}, fees $${verdict.fees.toFixed(2)}, capital charge $${verdict.capitalCharge.toFixed(2)}, net $${verdict.net.toFixed(2)} — $${verdict.netPerHour.toFixed(2)} an hour for ${FARM_DEFAULTS.farm_hours} hours of work. The drop is shared pro-rata by TVL, so treat it as an upper bound.`,
  ];
  return steps.map((s) => (s.length > 600 ? `${s.slice(0, 596)}...` : s));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && isPeer(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      model_blind: Math.round(((p.mcap_usd! / Math.max(1, launchValue(p))) * 100)) / 100,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watch: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    launch_value_usd: row.launch_value_usd,
    token_odds_24m: row.token_odds_24m,
    implied_value_usd: row.implied_value_usd,
    range_lo_usd: row.range_lo_usd,
    range_hi_usd: row.range_hi_usd,
    verdict: row.verdict,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    gas_usd: row.gas_usd,
    watch,
    off_list: row.off_list,
    is_kin: row.is_kin,
    nearest_peers: row.nearest_peers,
    farm_steps: row.farm_steps,
  };
}

/** Every snapshot protocol in exactly one accounting group. */
export function accounting(snapshot: Snapshot, board: BoardRow[]): AccountingGroup[] {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const tokenFirstWords = new Set(
    snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => familyKey(p.name)),
  );
  const counts = new Map<string, number>();
  const add = (label: string): void => counts.set(label, (counts.get(label) ?? 0) + 1);
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) {
      if (snapshot.watchlist.includes(p.slug)) add('Ranked · watchlist');
      else if (p.tvl_usd >= snapshot.floor_usd) add('Ranked · off-list, above the floor');
      else add('Ranked · early, below the floor');
    } else if (isPreToken(p) && isPeer(p)) {
      add('Out · kin of a token');
    } else if (!isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && isPeer(p)) {
      add('Token trades · priced comp');
    } else if (!isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0) {
      add('Token trades · not a comp');
    } else if (!isPreToken(p)) {
      add('Token recorded · no usable cap');
    } else if (EXCLUDED_CATEGORIES.has(p.category ?? '')) {
      add(`Out · ${p.category}`);
    } else {
      add('Out · versioned, wrapped or staked form');
    }
  }
  const order = [
    'Ranked · watchlist',
    'Ranked · early, below the floor',
    'Ranked · off-list, above the floor',
    'Token trades · priced comp',
    'Token trades · not a comp',
    'Token recorded · no usable cap',
    'Out · kin of a token',
    'Out · CEX',
    'Out · Bridge',
    'Out · Canonical Bridge',
    'Out · Cross Chain Bridge',
    'Out · Liquid Staking',
    'Out · Liquid Restaking',
    'Out · versioned, wrapped or staked form',
  ];
  return order
    .filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => ({ label, count: counts.get(label)! }));
}

/** FNV-1a over the board's slugs and implied values: the integrity strip's checksum. */
export function boardChecksum(board: BoardRow[]): string {
  let hash = 0x811c9dc5;
  const text = board.map((r) => `${r.slug}:${r.implied_value_usd}`).join(',');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const offList = board.filter((r) => r.off_list).length;
  const kinExcluded = snapshot.protocols.filter(
    (p) =>
      isPreToken(p) &&
      isPeer(p) &&
      !snapshot.watchlist.includes(p.slug) &&
      !board.some((r) => r.slug === p.slug),
  ).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    odds: ODDS,
    range: RANGE,
    farm_defaults: FARM_DEFAULTS,
    model_version: MODEL_VERSION,
    validation: VALIDATION,
    accounting: accounting(snapshot, board),
    checksum: boardChecksum(board),
    total_implied_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    off_list_size: offList,
    kin_excluded: kinExcluded,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.launch_value_usd) || r.launch_value_usd <= 0) return `${r.slug} has launch value ${r.launch_value_usd}`;
    if (!(r.token_odds_24m >= 0 && r.token_odds_24m <= 1)) return `${r.slug} has token odds ${r.token_odds_24m}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

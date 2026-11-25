# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/abbinaruto/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/abbinaruto/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the 196 rankable pre-token protocols in a sealed DefiLlama snapshot (frozen 2026-11-14) by an implied launch value, and hands each one a costed farm plan with a verdict. The model — radar-3 — is fitted from the snapshot itself: a log-log fit of market cap on TVL and chain count over the 89 stand-alone protocols in the same snapshot that already trade (ln mcap = 9.8108 + 0.3902 · ln TVL − 0.5463 · ln(min(chains, 5) + 1)), times 24-month token odds from a logistic model on the snapshot's 447 stand-alone peers, then tested held-out four ways before it was trusted. The board covers all 40 watchlist protocols plus 137 early finds below the $50M floor and 19 off-list protocols above it, and the static dashboard is sortable, filterable, shows a detail view with a value build-up, nearest priced peers and a farm plan per protocol, and lets you move the model constants and watch the top 10 re-rank.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Node 22 or later, standard library only. `main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory, and runs twice byte-identical. Open `out/dashboard/index.html` in a browser — it needs no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=x4x7sknz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

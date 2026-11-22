# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/abbinaruto/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/abbinaruto/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the 342 pre-token protocols in a sealed DefiLlama snapshot (frozen 2026-11-14) by an implied launch value, and hands each one a costed farm plan. The model — radar-2 — is fitted from the snapshot itself: a log-log fit of market cap on TVL over the 118 protocols in the same snapshot that already trade (ln mcap = 7.9295 + 0.4617 · ln TVL, plus a small 7-day growth tilt), then tested held-out four ways before it was trusted. The board covers all 40 watchlist protocols plus 160 early finds below the $50M floor, and the static dashboard is sortable, filterable, shows a detail view with a farm plan per protocol, and lets you move the model constants and watch the top 10 re-rank.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Node 22 or later, standard library only. `main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory, and runs twice byte-identical. Open `out/dashboard/index.html` in a browser — it needs no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=x4x7sknz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

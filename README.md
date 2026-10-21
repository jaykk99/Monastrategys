# Monastrategys — Trading Strategy Ecosystem

A client-side React + Vite trading-strategy app with a cyberpunk-terminal aesthetic.
Auth and data sync run on Firebase when configured; without config the app boots
into **demo mode** (local strategies + local profile in `localStorage`) and every
feature stays usable.

## Quick start

```bash
npm install
npm run dev      # dev server
npm run build    # production build -> dist/
npm run lint     # tsc --noEmit
npm test         # engine + validation + export tests (tsx)
```

## Deploying to Render (off Vercel, per hosting order)

This is a client-only SPA. Two paths are provided:

1. **Docker (default, via `render.yaml` + `Dockerfile`)**: New > Web Service >
   this repo. Render builds the image, substitutes `$PORT` at start, and nginx
   serves `dist/` with an SPA fallback (`/*` -> `/index.html`), so tab routing
   keeps working on refresh and deep links.
2. **Static site**: New > Static Site > this repo. Build command
   `npm ci && npm run build`, publish directory `dist`, then add a rewrite
   rule: source `/*` -> destination `/index.html` (Rewrite).

Vite bakes `VITE_*` env vars in at build time — set `VITE_FIREBASE_*` (and
optionally `VITE_ADMIN_EMAIL`/`VITE_ADMIN_PASS`) on the Render service before
deploying if you want Firebase instead of demo mode. With nothing set, the
app boots into demo mode (local strategies + localStorage profile) and every
feature stays usable.

## Configuration (all optional — keyless by default)

Copy `.env.example` to `.env` and fill in what you use:

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_*` | Firebase project (auth + Firestore). Without these the app runs in demo mode with 6 built-in strategies and a local profile. |
| `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASS` | Optional admin backdoor login. **Both** must be set; when unset, no admin path exists. Never commit these. |
| `GEMINI_API_KEY` | Reserved for future AI-assisted features (currently unused). |

Never commit `.env` — only `.env.example` is tracked (see `.gitignore`).

## Project structure

```
src/
  App.tsx                  # Orchestrator: auth, tabs, payments, admin actions
  lib/
    config.ts              # Env-gated Firebase config + admin flags
    firebase.ts            # Firebase init (null in demo mode) + collection paths
    types.ts               # Strategy, UserProfile, PlanDef, BacktestStats
    backtest.ts            # Deterministic simulated backtest engine + SVG chart helpers
                         # rules: momentum / meanreversion / breakout; trade log + Sharpe/expectancy/drawdown stats
    export.ts              # CSV export of backtest trade logs (client-side download)
    demo.ts                # Demo-mode strategies, profile store (localStorage)
    validation.ts          # Email/password/strategy/address/symbol validators
  components/
    ErrorBoundary.tsx      # Crash fallback
    Toast.tsx              # Toast notifications (replaces alert())
    AuthModal.tsx          # Sign in / sign up with inline validation
    PlansView.tsx          # Subscription plans + Solana payment panel
    StrategiesView.tsx     # Filterable/sortable strategy grid
    StrategyCard.tsx       # Strategy card with simulated equity sparkline
    StrategyModal.tsx      # Strategy detail: equity chart, extended stats, copy code
    BacktestView.tsx       # Backtest runner: rule selector, chart, stats, rule comparison, CSV export, run history
    CompareView.tsx        # Strategy side-by-side comparison: sortable stats table, best-per-column highlight
    AdminView.tsx          # Strategy publish form + user plan management
    TradingViewWidget.tsx  # TradingView chart embed
  tests/
    run.ts                 # Test runner (npx tsx tests/run.ts)
    backtest.test.ts       # Engine determinism, invariants, rule variants, trade-log consistency
    validation.test.ts     # Validator cases
    export.test.ts         # CSV builder cases
```

## Notes

- `firebase-applet-config.json` is a build-time placeholder with dummy values; real
  Firebase deployments inject the real config via `VITE_FIREBASE_*` env vars.
- `firestore.rules` contains the Firestore security rules for the backend.
- `firebase-blueprint.json` documents the Firestore data model.
- The backtest engine is **simulated and deterministic** (seeded by strategy id):
  same strategy + rule always yields the same result. Three signal rules run on
  the same seeded market: `momentum` (default, legacy behavior unchanged),
  `meanreversion`, and `breakout`. Each run records a per-trade log (exportable
  as CSV), Sharpe, expectancy, drawdown stats, and a per-rule comparison table.
  A **Compare** tab pits every strategy side by side. Illustrative only —
  not trading advice.
- Payments use Solana mainnet via Phantom. The recipient address is configured in
  `src/lib/types.ts` (`SOL_RECIPIENT`).
- Plans: **Starter** (1 random unlock, no backtests) → **Basic** ($9/mo, 3 unlocks,
  24h trial, 5 backtests/mo) → **Pro** ($29/mo, everything + auto-trade).

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
```

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
    demo.ts                # Demo-mode strategies, profile store (localStorage)
    validation.ts          # Email/password/strategy/address/symbol validators
  components/
    ErrorBoundary.tsx      # Crash fallback
    Toast.tsx              # Toast notifications (replaces alert())
    AuthModal.tsx          # Sign in / sign up with inline validation
    PlansView.tsx          # Subscription plans + Solana payment panel
    StrategiesView.tsx     # Filterable/sortable strategy grid
    StrategyCard.tsx       # Strategy card with simulated equity sparkline
    StrategyModal.tsx      # Strategy detail: equity chart, stats, copy code
    BacktestView.tsx       # Backtest runner: chart, stats, run history
    AdminView.tsx          # Strategy publish form + user plan management
    TradingViewWidget.tsx  # TradingView chart embed
```

## Notes

- `firebase-applet-config.json` is a build-time placeholder with dummy values; real
  Firebase deployments inject the real config via `VITE_FIREBASE_*` env vars.
- `firestore.rules` contains the Firestore security rules for the backend.
- `firebase-blueprint.json` documents the Firestore data model.
- The backtest engine is **simulated and deterministic** (seeded by strategy id):
  same strategy always yields the same result. Illustrative only — not trading advice.
- Payments use Solana mainnet via Phantom. The recipient address is configured in
  `src/lib/types.ts` (`SOL_RECIPIENT`).
- Plans: **Starter** (1 random unlock, no backtests) → **Basic** ($9/mo, 3 unlocks,
  24h trial, 5 backtests/mo) → **Pro** ($29/mo, everything + auto-trade).

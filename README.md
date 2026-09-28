# Monaco V7 — Trading Strategy Ecosystem

A client-side React + Vite trading-strategy app with a cyberpunk-terminal aesthetic.
Auth and data sync run on Firebase; the app boots and builds without any keys
(everything optional degrades gracefully).

## Quick start

```bash
npm install
npm run dev      # dev server
npm run build    # production build -> dist/
```

## Configuration (all optional — keyless by default)

Copy `.env.example` to `.env` and fill in what you use:

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_*` | Firebase project (auth + Firestore). Without these, `firebase-applet-config.json` holds placeholders and Firebase calls fail gracefully. |
| `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASS` | Optional admin backdoor login. Both must be set; when unset, no admin path exists. |
| `GEMINI_API_KEY` | Optional Gemini key for AI-assisted features. |

Never commit `.env` — only `.env.example` is tracked (see `.gitignore`).

## Notes

- `firebase-applet-config.json` is a build-time placeholder with dummy values; real
  Firebase deployments inject the real config.
- `firestore.rules` contains the Firestore security rules for the backend.
- `firebase-blueprint.json` documents the Firestore data model.

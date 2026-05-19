# Futures Trading Dashboard

React/Vite dashboard for managing prop trading accounts across multiple firms. Reads and writes live data through Airtable via a Netlify serverless proxy.

## Tech Stack

- **Frontend**: React 18 + Vite (JSX, no TypeScript in practice)
- **Hosting**: Netlify — site ID `99e1fbb2-5a99-4c89-aa9b-8e0856dcff8c`
- **Backend**: Airtable (all data stored there, no other database)
- **Serverless proxy**: `netlify/functions/airtable.cjs` — proxies all Airtable API calls so the token stays server-side

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Entire UI — one large component with all tabs, data fetching, and state |
| `netlify/functions/airtable.cjs` | Netlify Function that proxies requests to `api.airtable.com` |
| `netlify.toml` | Build config (`npm run build` → `dist`) + SPA redirect + CSP headers |
| `src/App.css` | Global styles |
| `src/allAccountsCompact.js` | Static account data (baked-in fallback) |

## Airtable Tables (constants at top of App.jsx)

| Constant | Table |
|----------|-------|
| `PERF_TABLE` | Performance accounts (live/payout) |
| `EVAL_TABLE` | Eval accounts |
| `PURCHASE_TABLE` | Purchase history |
| `TRADERS_TABLE` | Traders |
| `EVAL_TYPE_TABLE` | Eval type definitions |
| `PAYOUT_TABLE` | Payout records |

## Deployment

**Every push to `main` triggers an automatic Netlify deploy.** There is no manual step needed.

- Netlify watches the `main` branch
- Build command: `npm run build`
- Publish directory: `dist`
- The Netlify Function at `netlify/functions/airtable.cjs` is deployed automatically alongside the frontend

## Development Workflow — IMPORTANT

**Always commit and push directly to `main`.** This is a single-developer project where the goal is immediate Netlify auto-deploy on every change.

Do **not** create feature branches or open pull requests unless the user explicitly asks for one. The correct flow is:

1. Make changes in `src/App.jsx` (and other files as needed)
2. `git add` the changed files
3. `git commit -m "descriptive message"`
4. `git push -u origin main`

Netlify will pick up the push and deploy within ~1 minute.

## Common Tasks

- **UI changes**: edit `src/App.jsx`
- **Add/fix an Airtable field**: update the `fields[]` array in the relevant `fetchTable()` call and the mapping logic below it
- **Add a tab**: add a new tab name to the `TABS` array and a corresponding render block in the tab content switch/conditional
- **Netlify Function changes**: edit `netlify/functions/airtable.cjs`; changes deploy with the next push to `main`

## Local Dev

```bash
npm install
npm run dev      # starts Vite dev server on http://localhost:5173
```

The Netlify Function is only available in the deployed environment. During local dev, Airtable calls will fail unless you run `netlify dev` (requires Netlify CLI).

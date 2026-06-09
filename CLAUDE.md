# Wegmans Floorcare Reporting Portal — CLAUDE.md

Custom client-facing reporting/analytics layer on top of **Smart Inspect** inspection data
for the **Wegmans Floorcare Pilot**. Not a replacement for Smart Inspect — it pulls SI data
through the SI API and presents a cleaner Wegmans-specific dashboard.

## Status (as of 2026-06-09)

- **Live in production**: https://wegman-s-customer-report.vercel.app
- GitHub: `Stray26/Wegmans-floorcare-reporting` · Vercel team `stray26s-projects`, project `wegman-s-customer-report`
- **Phase 1** (Portfolio Overview, Store Manager Dashboard, Store Detail Modal) — done, live.
- **Phase 2** (Tickets page, Score Settings, Custom Detail Report) — done, live.
- Live Smart Inspect integration is **wired and working** (auth, permissions, inspection + ticket widgets, createTicket).
- **Deferred**: real PDF/Excel export (currently toast mocks), mobile-polish pass.

## Stack

React 18 + Vite + TypeScript + Tailwind + shadcn-style UI (hand-rolled on Radix) +
TanStack Query + Recharts + React Router. Deployed on **Vercel** with serverless
functions in `/api`. No Supabase (we chose Vercel functions for the proxy).

## Commands

```
npm install        # use Node 22 (see gotchas)
npm run dev        # Vite only — mock mode, no /api functions
vercel dev         # runs app + /api functions together (needs SMART_INSPECT_API_TOKEN)
npm run build      # tsc -b && vite build
npm run lint
vercel --prod      # deploy (uploads working dir, respects .vercelignore)
```

## Architecture (the important part)

**Mock ↔ live swap with zero UI changes.** Flag: `VITE_ENABLE_MOCK_DATA`
(`"false"` => live). `MOCK_MODE` in `src/api/smartInspectClient.ts`.

Data flow: `raw SI response → transforms → normalized reporting types → UI`.
- `src/types/smartInspect.ts` — RAW SI shapes + `transformApiRecord` (raw allRecords row → `SIRecord`) + `extractPermittedOuterTiers`.
- `src/types/reporting.ts` — normalized types the UI consumes (`StoreReport`, `PortfolioReport`, `CheckAreaReport`, `TicketReport`, `ScoreThreshold`, …). **UI only depends on these.**
- `src/api/mockData.ts` — mock data mirroring the real SI shapes (isolated; deterministic).
- `src/api/reportingTransforms.ts` — the ONLY place that knows the raw record shape. Builds `StoreReport`s.
- `src/api/smartInspectClient.ts` — browser client. Live mode POSTs `{endpoint, ...}` to `/api/smart-inspect`; mock mode resolves locally through the same transforms.
- `api/smart-inspect.ts` + `api/_lib/smartInspect.ts` — single Vercel proxy. Adds `Authorization: SIQ-1 <token>`, routes by `endpoint`, and validates requested stores against the token's permissions **server-side** (`reconcileOuterTiers`) before forwarding. The browser never sees the token.

**Permissions are the source of truth.** `useSmartInspectPermissions` reads SI permissions →
`stores.length` decides the view: >5 = Portfolio, 2–5 = scaled Portfolio (group), 1 = Store Manager.
A demo role toggle (Corporate/Region/Store Manager) in the top bar is mock-only.

**Score thresholds** live in `src/config/scoreThresholds.ts` behind `useScoreThresholds`
(provider, in-memory editable, DB-ready). QSP = acceptable/total × 100.
Passed ≥90, Needs Improvement 80–89.99, Failed <80, **Not Uploaded** = no inspection in range
(gray, never derived from a score, separate from Failed).

Wegmans constants centralized in `src/config/wegmans.ts` (10 bilingual check areas, attributes,
`friendlyCheckmark()` to shorten long live checkmark text).

## Live Smart Inspect facts (confirmed against prod)

- Base URL `https://app.mysmartinspect.com/api`, auth header `Authorization: SIQ-1 <token>`, all POST.
- Config: **"Wegmans Floorcare Pilot"**, `configId 20035`. Company/`companyId 1382`.
- `clientId` in runWidgets filters is **irrelevant** — the token scopes the company. (Doc said 1172; ignore.)
- 3 pilot stores (outer tiers): 115 Tysons Corner (`outerTierId 191864`), 73 Johnson City (191941), 92 Military Road (191958).
- **Pilot inspection data is in April 2026** (≈Apr 9–23). Default reporting window is last 90 days so it shows.
- Date filters require RFC-3339 with `Z`, e.g. `2026-04-01T00:00:00Z` (bare `...T00:00:00` is rejected).
- `inspection.allRecords` returns `{ records: [...], total }` — NOT a bare array. `ticket.getTickets` wraps similarly. `widgetArray()` in the client unwraps `records`/`tickets`/`data`/bare.
- Record fields: `checkmark` (long text, numbered "01.…"), `checkAttribute` ("Acceptable" / "Buildup" …), `isGood` (true→100/false→0/null→50), `outerTierId`, `count`. Live rows omit `configId`/`state`.

## Env vars

Server-side (no `VITE_` prefix, never in browser): `SMART_INSPECT_API_TOKEN`,
`SMART_INSPECT_API_BASE_URL` (defaults to the prod URL).
Frontend: `VITE_ENABLE_MOCK_DATA` (`false` in prod), `VITE_APP_ENV`.
All set in Vercel project env. `.env.local` is gitignored (Vercel CLI also writes a `VERCEL_OIDC_TOKEN` there).

## Gotchas (these will bite again)

- **Node 26 locally rewrites `package-lock.json` into a format Vercel's npm 10 rejects**
  (`npm error Invalid Version` during dedupe). Fix: regenerate the lockfile with npm 10
  (`rm package-lock.json && npm install` under Node 22), or just don't regenerate it locally.
  `engines.node` is pinned to `22.x`.
- The Vercel CLI ignores `.gitignore` and uploads everything not in **`.vercelignore`** — keep
  `node_modules`, `.npm-cache`, `.tmp`, `.npmrc`, logs out of it (a shipped `.npmrc` once redirected
  npm's cache and broke the build).
- Create Ticket is wired **live** — it writes real tickets to Smart Inspect production.

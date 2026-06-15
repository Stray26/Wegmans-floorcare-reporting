# Wegmans Floorcare Reporting Portal — AGENTS.md

Custom client-facing reporting/analytics layer on top of **Smart Inspect** inspection data
for the **Wegmans Floorcare Pilot**. Not a replacement for Smart Inspect — it pulls SI data
through the SI API and presents a cleaner Wegmans-specific dashboard.

## Status (as of 2026-06-11)

- **Live in production**: https://wegman-s-customer-report.vercel.app
- GitHub: `Stray26/Wegmans-floorcare-reporting` · Vercel team `stray26s-projects`, project `wegman-s-customer-report`
- **Phase 1** (Portfolio Overview, Store Manager Dashboard, Store Detail Modal) — done, live.
- **Phase 2** (Tickets page, Score Settings, Custom Detail Report) — done, live.
- **SI credential login — done, live (2026-06-12).** Users sign in with their Smart Inspect
  username/password; per-user permissions now drive the view (a single-store user lands on
  Store Manager, multi-store on Portfolio). See the Auth section below. This changed the access
  model: **the portal is no longer open — every user needs a Smart Inspect account.**
- Live Smart Inspect integration is **wired and working** (auth, permissions, inspection + ticket widgets, createTicket).
- **Store Manager redesign** — organized by manager questions: upload/pass hero, expandable
  CheckAreaAccordion with per-deficiency live Create Ticket, Top Deficiencies, QSP trend,
  Recent Inspections, photos, tickets; in-header date quick-picks + store switcher.
- **Navigation**: sidebar "Store View" link (all modes), store switcher dropdown (reads
  `?store=` query param), and "Open dashboard" deep-link from the Store Detail modal — so a
  multi-store user can reach any store's manager view. **`RequirePortfolioAccess` guards
  `/portfolio`**: a single-store user who reaches it (deep link / stale URL / post-login `from`)
  is bounced to `/my-store` — access enforced by permissions, not just hidden nav.
- **Wegmans-green rebrand**: Tailwind `brand` palette (#006938) replaced `navy`; status colors
  unchanged. Sidebar shows the logo from `/public/wegmans-logo.png` on a white chip (white-bg
  PNG, so don't CSS-invert it — that makes a white square).
- **Runtime Demo-data toggle** (TopBar Live/Demo) flips the whole app between live SI and a
  ~100-store mock Wegmans portfolio without redeploy. See architecture note below.
- **PDF exports are real** (jsPDF + jspdf-autotable, lazy-loaded): `src/utils/storePdf.ts`
  (My Store report) and `src/utils/portfolioPdf.ts` (landscape portfolio report). Wired to the
  Export buttons on Store Manager and Portfolio Overview.
- **Deferred**: real Excel export (Custom Detail Report still toast-mocks Excel/PDF), wiring the
  store PDF into the Store Detail modal, mobile-polish pass.

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

**Mock ↔ live swap with zero UI changes.** `VITE_ENABLE_MOCK_DATA` (`"false"` => live) sets
the INITIAL value (`DEFAULT_MOCK`), but mock mode is now **runtime-switchable**:
`isMockMode()` / `setMockMode()` in `src/api/smartInspectClient.ts`. The TopBar **Live/Demo
toggle** drives `demoData` in `SessionContext`, which calls `setMockMode()` **synchronously in
the setter** (NOT in an effect — an effect runs after the permissions query refetches, which
gave the "Demo shows 3 uninspected" bug: live permissions + mock data). All data hooks include
`demoData` in their query keys so toggling refetches. Demo = ~100-store mock Wegmans portfolio;
the Corporate/Region/Store-Manager role toggle only matters in Demo.

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
- Live `getPermissions` `permissionConfigs[]` entries use **`name`** (NOT `configName`) for the
  config label — `extractPermittedConfigs` reads both and falls back to "Config <id>". Known
  configIds are pinned to canonical names via `KNOWN_CONFIG_NAMES` (smartInspectClient.ts)
  because runWidgets matches configs BY NAME — a label mismatch silently fetches 0 records.

## Auth (feature/si-login)

Users sign in with their **Smart Inspect credentials**. `/api/auth/login` calls SI's
internal `POST /startSession` (see `docs/si-internal-api.md` — undocumented internal API,
SI blessing pending), verifies membership in companyId 1382, and seals the user's SIQ-0
session token + memberId + roleId + permissionLevels into an AES-256-GCM httpOnly cookie
(`api/_lib/session.ts`, 12h TTL, `SESSION_SECRET` env). The browser never sees any SI token.
Pieces: `/api/auth/{login,logout,me}`, `src/context/AuthContext.tsx`, `src/pages/Login.tsx`,
`RequireAuth` in `App.tsx`. **Demo mode bypasses auth entirely** (so `npm run dev` works).
`/api/smart-inspect` now requires a session (401 → client redirects to /login):
`getPermissions` runs AS THE USER (their SIQ-0 token + memberId → their stores), data calls
stay on the company SIQ-1 token but requested outer tiers are validated against the USER's
permissions. The permissions query key includes memberId so a re-login never sees the
previous user's cache. `createTicket` additionally checks the user's `canTicket` flag.

## Env vars

Server-side (no `VITE_` prefix, never in browser): `SMART_INSPECT_API_TOKEN`,
`SMART_INSPECT_API_BASE_URL` (defaults to the prod URL), `SESSION_SECRET`
(session-cookie encryption; generate with `openssl rand -base64 32`),
`SMART_INSPECT_COMPANY_ID` (default 1382 = Wegmans).
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
- **Logo** is `/public/wegmans-logo.png`, a black wordmark on a **white** background. The sidebar
  shows it on a white chip (`BrandLogo` in `Sidebar.tsx`). Do NOT use `filter:brightness(0) invert(1)`
  to white-out — the white bg becomes a white square. The PDFs embed it directly (white page, fine).
- **PDFs**: jsPDF + jspdf-autotable are dynamically `import()`-ed inside the export functions so they
  stay out of the main bundle (separate ~560 KB lazy chunk loaded on first export). Programmatic
  (autoTable), not html2canvas screenshots — keep it that way for crisp, paginated output.
- Adding npm deps means the lockfile changes → regenerate it with **npm 10** (build it in a scratch
  dir on a native FS, copy `package-lock.json` back) before deploying, per the Node-26 gotcha above.
- **`vercel dev` env comes from the cloud project's *Development* environment, not `.env.local`
  for vars that exist in the cloud.** A var set only for *Production* (e.g. `SMART_INSPECT_API_TOKEN`)
  is absent under `vercel dev` even if it's in `.env.local` → functions throw "not configured".
  Fix: `echo -n "<value>" | vercel env add <NAME> development`. `SESSION_SECRET` likewise needs a
  **Production** assignment or live login 500s. (Confirmed 2026-06-12 debugging session login.)
- **`vercel dev` + the SPA catch-all rewrite:** a `{ "source": "/((?!api/).*)", "destination":
  "/index.html" }` rewrite breaks `vercel dev` — Vite's virtual paths (`/@react-refresh`,
  `/@vite/client`, `/src/...`) get rewritten to index.html and served as JS → "Failed to parse
  source for import analysis ... index.html". The source regex now also excludes `@`, `src/`,
  `node_modules/`, and dotted asset paths. No prod impact (real files serve before rewrites).
- **SI login uses the undocumented internal API** (`/startSession`, `SIQ-0` tokens). Get SI's
  blessing before relying on it long-term. `docs/si-internal-api.md` has the full probed reference.
- **getPermissions is per-user via the SIQ-0 session** (companyId + memberId required). A member's
  grants can be a SINGLE store even if the company SIQ-1 token sees all 3 — that's correct, it
  drives Store-Manager vs Portfolio routing. Don't "fix" a sparse view by widening the token.

## Imported Claude Cowork project instructions

You are working in Claude Cowork as my coding partner. I want you to behave like a senior product engineer, not just generate code quickly.

How to work:

1. First inspect the repo

* Do not assume the structure.
* Read the existing files first.
* Identify the framework, routing setup, package manager, styling system, component structure, API patterns, and deployment setup.
* Tell me what you found before making major changes.

2. Make a plan before coding

* Before editing files, give me a short implementation plan.
* Break the work into phases.
* Tell me which files you expect to create or modify.
* Flag risks or unclear areas.

3. Work in small, safe steps

* Do not rewrite the whole app unless absolutely necessary.
* Prefer incremental changes.
* Preserve working code.
* Reuse existing components and patterns where possible.
* Avoid creating duplicate versions of the same logic.

4. Do not break the current app

* After each meaningful change, run the appropriate checks:

  * npm install only if dependencies changed
  * npm run build
  * npm run lint if available
  * npm run typecheck if available
* If a command fails, stop and explain the issue before continuing.
* Fix TypeScript errors instead of ignoring them.

5. Treat Smart Inspect API securely

* Do not put Smart Inspect API keys, usernames, passwords, tokens, or secrets in frontend code.
* Use environment variables.
* API calls to Smart Inspect must go through a server-side proxy, such as Vercel API routes, serverless functions, or Supabase Edge Functions.
* The browser should only call our own safe endpoints.

6. Keep mock data separate

* Build with mock data first if live API details are missing.
* Mock data should mirror the expected Smart Inspect API response shape.
* Keep mock data isolated in a dedicated file or folder.
* Build transform functions so we can swap mock data for live Smart Inspect API data later without rewriting the UI.

7. Smart Inspect permissions are the source of truth

* Do not create a new store permission system unless I explicitly approve it.
* The app should call Smart Inspect permissions and use those permissions to determine what stores/configurations the user can access.
* Multi-store users should see the Portfolio Dashboard.
* Single-store users should see the Store Manager Dashboard.
* Do not rely only on hiding UI elements. Server-side proxy routes should also validate that requested stores/configurations are allowed.

8. Product logic matters

* QSP Score = Acceptable checks / Total checks × 100.
* Passed = 90–100.
* Needs Improvement = 80–89.99.
* Failed = below 80.
* Not Uploaded = no inspection in selected date range.
* Not Uploaded is not the same as Failed. It should be gray and handled separately.
* KPIs on the corporate dashboard should be store-based, not inspection-count-based.

9. Design approach

* Keep the design clean, enterprise, and operational.
* Use a dark navy sidebar, white cards, soft borders, subtle shadows, and a light gray background.
* Use green for Passed, yellow for Needs Improvement, red for Failed, gray for Not Uploaded.
* Avoid generic SaaS dashboard clutter.
* The boss view should answer “which stores need attention?”
* The store manager view should answer “what do I need to fix?”

10. Ask when needed, but do not over-ask

* If something is missing but can be safely mocked, proceed with mock mode.
* Ask me only when a decision affects architecture, security, permissions, data model, or deployment.
* Do not ask me about tiny styling choices unless there are multiple meaningful options.

11. Explain changes clearly

* After making changes, summarize:

  * What changed
  * Which files were modified
  * How to test it
  * Any remaining issues or assumptions

12. Deployment target

* The app should be deployable to Vercel.
* Use Vercel-compatible routing/API patterns.
* Keep environment variables documented.
* Do not introduce tools or services that make Vercel deployment harder unless there is a clear reason.

13. Code quality expectations

* Use TypeScript types for Smart Inspect data, normalized reporting data, store reports, check areas, deficiencies, tickets, and thresholds.
* Use reusable components.
* Avoid hardcoding Wegmans-specific values throughout the UI; centralize configuration where practical.
* Keep transform logic separate from display components.
* Keep components readable and maintainable.

14. Git/workflow behavior

* Before large changes, tell me the recommended branch name.
* Make changes in logical batches.
* Do not delete large files, routes, or components without explaining why.
* If you encounter messy existing code, suggest cleanup but do not refactor unrelated areas unless needed.

Your goal:
Help me build a clean, secure, Vercel-deployable Wegmans Smart Inspect custom reporting portal that can start with mock data and later connect to the live Smart Inspect API without rewriting the app.

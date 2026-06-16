# Wegmans Floorcare Reporting Portal — CLAUDE.md

Custom client-facing reporting/analytics layer on top of **Smart Inspect** inspection data
for the **Wegmans Floorcare Pilot**. Not a replacement for Smart Inspect — it pulls SI data
through the SI API and presents a cleaner Wegmans-specific dashboard.

## Status (as of 2026-06-15)

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
  CheckAreaAccordion, Top Deficiencies, QSP trend, Recent Inspections, photos, tickets; store
  switcher in-header (the date filter is now global in the TopBar — see the 2026-06-15 notes).
- **Navigation**: sidebar "Store View" link (all modes), store switcher dropdown (reads
  `?store=` query param), and "Open dashboard" deep-link from the Store Detail modal — so a
  multi-store user can reach any store's manager view. **`RequirePortfolioAccess` guards
  `/portfolio`**: a single-store user who reaches it (deep link / stale URL / post-login `from`)
  is bounced to `/my-store` — access enforced by permissions, not just hidden nav.
- **Wegmans-green rebrand**: Tailwind `brand` palette (#006938) replaced `navy`; status colors
  unchanged. Sidebar shows the logo from `/public/wegmans-logo.png` on a white chip (white-bg
  PNG, so don't CSS-invert it — that makes a white square).
- **Demo-data mode** flips the whole app between live SI and a ~100-store mock Wegmans portfolio.
  The TopBar Live/Demo + role toggles were **removed 2026-06-15** (real users on it); the machinery
  stays dormant in `SessionContext` so `npm run dev` is still mock and prod is live-only
  (`VITE_ENABLE_MOCK_DATA=false`). Re-addable if a sales-demo build is needed.
- **PDF exports are real** (jsPDF + jspdf-autotable, lazy-loaded): `src/utils/storePdf.ts`
  (My Store report) and `src/utils/portfolioPdf.ts` (landscape portfolio report). Wired to the
  Export buttons on Store Manager and Portfolio Overview.
### 2026-06-15 session (shipped)

- **Default view = Today + global date filter.** Every dashboard lands on Today
  (`SessionContext.defaultRange`). Quick-picks (Today · Yesterday · 7d · 30d · 90d + custom) moved
  into the global TopBar (`DateRangePicker`), driving Portfolio + Store Manager from one control;
  the per-page pickers were removed. For a single-day range, per-check-area rows show Pass/Fail
  instead of a 0/100 "score".
- **Mock QSP scores are clean whole tens ≥60.** `mockData.ts` models each inspection as 10 single
  pass/fail check areas via a seeded accept-matrix, so store/inspection/area scores are multiples
  of 10, never <60. Demo data is anchored to "today" on a daily cadence and now honors the selected
  date range (Today shows a realistic uploaded-vs-Not-Uploaded board; pilot stores always present).
- **Ticket detail view.** Clicking a row in `TicketsTable` opens `TicketDetailModal`
  (store/area/deficiency/priority/dates/notes + photos) — live on Tickets page, Store Manager, and
  the Store Detail modal.
- **Create-Ticket UI removed ("start slow").** No creation entry points are shown; the
  `CreateTicketDialog` component, `createTicket` client, and `/api/createTicket` proxy are kept
  **dormant** for easy re-enable.
- **Live inspection photos wired.** `inspection.imageRecords` is fetched through the proxy; photos
  render straight from the SI file CDN (public URLs), like the SI web app. Mock keeps `mockPhotoUrl`.
- **Scheduled report emails.** Daily Vercel Cron emails curated recipients their store PDF via
  Resend; per-user stores captured at login into Supabase. See the Scheduled report emails section
  + `docs/scheduled-reports.md`. **Live path only.**
- **Demo/role toggles removed from the TopBar** (real users on it); machinery stays dormant (see
  Architecture). TopBar now just holds the date filter + user/sign-out.
- **Admin "Report Emails" page (`/settings/reports`).** Admins add/edit/pause/delete scheduled-
  report recipients + cadence and can **manually assign stores** for recipients who haven't logged
  in. Admin = email allowlist (default `vmaione@mysmartinspect.com`, extend via `REPORT_ADMIN_EMAILS`),
  server-enforced; `isAdmin` via `/api/auth/me`; `/api/admin/subscriptions` does the CRUD.
- **⚠️ Scheduled emails are NOT yet verified end-to-end** — deployed, but no real send confirmed.
  See "Needs work" in the Scheduled report emails section.

- **Deferred**: real Excel export (Custom Detail Report still toast-mocks Excel/PDF), wiring the
  store PDF into the Store Detail modal, mobile-polish pass.

## Stack

React 18 + Vite + TypeScript + Tailwind + shadcn-style UI (hand-rolled on Radix) +
TanStack Query + Recharts + React Router. Deployed on **Vercel** with serverless
functions in `/api`. The SI data proxy is plain Vercel functions (no DB). **Supabase**
(project `mjhuujbwkkfjmzfmzqol`, named "Wegmans Reports" — repurposed 2026-06-15 from the old
MeasureIQ project, which had moved to AWS; MeasureIQ's tables were dropped) backs the
**scheduled-report feature only** (recipient permissions + subscriptions) — see that section.

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

**Mock ↔ live swap.** `VITE_ENABLE_MOCK_DATA` (`"false"` => live) sets `DEFAULT_MOCK`; mock mode is
runtime-switchable via `isMockMode()`/`setMockMode()` (`src/api/smartInspectClient.ts`) driven by
`demoData` in `SessionContext`. The setter calls `setMockMode()` **synchronously** (NOT in an
effect — an effect refetches permissions before the flag flips, the "Demo shows 3 uninspected"
bug: live permissions + mock data). All data hooks key on `demoData` so toggling refetches.
**The TopBar Live/Demo + role toggles were removed 2026-06-15** (real users on it) — the machinery
is dormant: `npm run dev` is still mock, prod is live-only. Demo = ~100-store mock portfolio; the
role toggle only ever mattered in Demo.

Data flow: `raw SI response → transforms → normalized reporting types → UI`.
- `src/types/smartInspect.ts` — RAW SI shapes + `transformApiRecord` (raw allRecords row → `SIRecord`) + `extractPermittedOuterTiers`.
- `src/types/reporting.ts` — normalized types the UI consumes (`StoreReport`, `PortfolioReport`, `CheckAreaReport`, `TicketReport`, `ScoreThreshold`, …). **UI only depends on these.**
- `src/api/mockData.ts` — mock data mirroring the real SI shapes (isolated; deterministic).
- `src/api/reportingTransforms.ts` — the ONLY place that knows the raw record shape. Builds `StoreReport`s.
- `src/api/smartInspectClient.ts` — browser client. Live mode POSTs `{endpoint, ...}` to `/api/smart-inspect`; mock mode resolves locally through the same transforms.
- `api/smart-inspect.ts` + `api/_lib/smartInspect.ts` — single Vercel proxy. Adds `Authorization: SIQ-1 <token>`, routes by `endpoint`, and validates requested stores against the token's permissions **server-side** (`reconcileOuterTiers`) before forwarding. The browser never sees the token.

**Permissions are the source of truth.** `useSmartInspectPermissions` reads SI permissions →
`stores.length` decides the view: >5 = Portfolio, 2–5 = scaled Portfolio (group), 1 = Store Manager.
(The Corporate/Region/Store-Manager demo role toggle was removed from the top bar 2026-06-15; it
was mock-only.)

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
- **Pilot inspection data is in April 2026** (≈Apr 9–23). The default view is now **Today**
  (changed 2026-06-15), so under Live the board lands empty until daily uploads exist — widen to
  30d/90d (or use the quick-picks) to see the April pilot data.
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

## Scheduled report emails (2026-06-15)

Daily Vercel Cron (`api/cron/send-reports.ts`; `vercel.json` crons `0 11 * * *`) emails curated
recipients their store Floorcare PDF via **Resend**. A cron has no user session and SI only
returns a member's store grants to that member's own login, so each user's permitted stores are
**captured at login** into Supabase `report_recipients` (`api/auth/login.ts` → `upsertRecipient`,
best-effort). `report_subscriptions` (curated) holds who + cadence; stores resolve from
`report_recipients` (by `member_id`, else `email`). The server PDF reuses the shared layout
`src/utils/storePdfLayout.ts` — identical to the browser export. Supabase is **server-only**
(service-role key; RLS on, no policies; the browser never touches it). Cadence is evaluated by the
daily run (daily; weekly `weekly_dow`; monthly `monthly_dom`) with a `last_sent_at` same-day guard.
Full setup, env vars, and limitations: `docs/scheduled-reports.md`.

> The `/api` function bundler (esbuild) reads the **root** `tsconfig.json`, so `baseUrl`+`paths`
> were added there (not only in `tsconfig.app.json`) to let functions import `@/…` — that's how the
> cron reuses the shared transforms + PDF layout. Don't remove them.

**Admin config.** Report admins manage recipients + cadence at `/settings/reports`
(`src/pages/ReportSettings.tsx`, behind `RequireAdmin`; admin-only Sidebar link). Admin = session
email on an allowlist: `REPORT_ADMIN_EMAILS` env ∪ a code default (`vmaione@mysmartinspect.com`),
checked in `api/_lib/session.ts` (`isAdminSession`); `publicIdentity` / `/api/auth/me` expose
`isAdmin`. CRUD goes through `api/admin/subscriptions.ts` (session + admin gated; service-role
writes). Admins can **manually assign stores** to a subscription
(`report_subscriptions.stores_override` jsonb) for recipients who haven't logged in — the cron
prefers the override, else the captured stores, and no longer needs a `report_recipients` row.
Picker options come from the company SIQ-1 `getPermissions`.

**Needs work (NOT done):**
- **Not verified end-to-end** — deployed, but no real email confirmed sent. Run the cron once
  (`curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/send-reports`) and confirm delivery.
- A recipient gets mail only if they've logged in (captured stores) OR have a manual store
  assignment; otherwise the cron reports `skipped`.
- `send_hour` is stored but NOT enforced — the single daily cron (`0 11 * * *`, 11:00 UTC) sends at one time.
- Cron processes recipients sequentially — fine for a few; batch/fan-out before scaling (function timeout).
- Manual store assignment is admin-asserted, NOT validated against the recipient's own SI permissions.
- Couldn't auto-pull a not-logged-in member's SI stores (SI returns them only to that member's own
  session); the "admin SI lookup" path (probe `fullPermissions` / admin getPermissions) was deferred.
- Emailed-PDF logo is bundled via `vercel.json` `includeFiles`; falls back to a text header if not
  found at runtime — confirm it renders on deploy.
- Resend sends from the verified `mysmartinspect.com` domain; the admin allowlist matches the SI
  **login** email (so admin only works if the SI account email is on the list).

## Env vars

Server-side (no `VITE_` prefix, never in browser): `SMART_INSPECT_API_TOKEN`,
`SMART_INSPECT_API_BASE_URL` (defaults to the prod URL), `SESSION_SECRET`
(session-cookie encryption; generate with `openssl rand -base64 32`),
`SMART_INSPECT_COMPANY_ID` (default 1382 = Wegmans).
Scheduled report emails (server-side too): `SUPABASE_URL`
(`https://mjhuujbwkkfjmzfmzqol.supabase.co`), `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`REPORT_EMAIL_FROM` (verified Resend sender, e.g. `Wegmans Floorcare <reports@mysmartinspect.com>`),
`CRON_SECRET` (cron auth — the cron refuses to run without it), `REPORT_ADMIN_EMAILS`
(comma-separated extra report-admin emails; `vmaione@mysmartinspect.com` is a built-in default).
See `docs/scheduled-reports.md`.
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
- Create Ticket: the UI entry points were **removed 2026-06-15 ("start slow")**, but the
  `createTicket` client + `/api/createTicket` proxy remain **dormant** and still write **real**
  tickets to SI production when re-enabled — remember that before wiring buttons back.
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

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
  Export buttons on Store Manager and Portfolio Overview. The store PDF now embeds deficiency
  photos + inspector notes and `renderStorePdf` is **async** — see the 2026-06-17 session below.
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
  in. Admin = email allowlist (default `vincent.maione1@gmail.com`, extend via `REPORT_ADMIN_EMAILS`),
  server-enforced; `isAdmin` via `/api/auth/me`; `/api/admin/subscriptions` does the CRUD.
- **⚠️ Scheduled emails are NOT yet verified end-to-end** — deployed, but no real send confirmed.
  See "Needs work" in the Scheduled report emails section.

- **Deferred**: real Excel export (Custom Detail Report still toast-mocks Excel/PDF), wiring the
  store PDF into the Store Detail modal, mobile-polish pass.

### 2026-06-16 session (shipped, branch `feature/live-member-report-permissions`)

- **Scheduled reports now pull permissions LIVE per member.** A 2026-06-16 HAR revealed SI's
  `getMemberPermissions` (any member's store grants) + `listMembers` (the roster) — the per-member
  lookup previously thought blocked. The cron logs in as an SI admin service account
  (`SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD`) and resolves each subscriber's *current* Floorcare
  stores at send time; the `/settings/reports` picker is now the live member roster (keyed by
  `member_id`). Login-capture (`report_recipients`) is demoted to legacy/fallback. See the Scheduled
  report emails section, `docs/scheduled-reports.md`, and `docs/si-internal-api.md` (new endpoints +
  config/outer-tier map). Multi-config aware (Pre/Post-Launch); excludes the general config 19399.
- **`/api` is now type-checked** via `tsconfig.api.json` (`npm run typecheck:api`) — the app build's
  `tsc -b` only covers `src`. (Vercel runs `/api` as **un-bundled ESM**, NOT esbuild-bundled — see the
  `@/` gotcha below; it ignores this tsconfig.)
- **Report types**: each subscription has `report_type` (`store`|`portfolio`); server portfolio PDF
  via shared `src/utils/portfolioPdfLayout.ts`; per-subscription send extracted to
  `api/_lib/sendReport.ts`; admin **Send test** endpoint `POST /api/admin/send-report` (renders now,
  emails the signed-in admin, no `last_sent` change); read-only **All members & permissions** view
  (`GET /api/admin/members`); override + permissions store pickers are dropdowns (`StoreDropdown`),
  not pills.
- **Portfolio access is now ROLE-based** (Account → Portfolio, Operator/Supervisor → Store Manager) —
  see the "Role decides the view" section. Reverses the old store-count rule.
- **`@/` aliases crash deployed `/api`** (`ERR_MODULE_NOT_FOUND` → 500) — Vercel runs functions as
  un-bundled ESM, so `@/` specifiers survive to runtime. Converted every value `@/` import reachable
  from `/api` (incl. shared `src/` modules: reportingTransforms, scoreStatus) to relative `.js`. See
  Gotchas; `npm run typecheck:api` does NOT catch it.
- **Security cleanup.** `vmaione@mysmartinspect.com` is a SmartInspect STAFF account with
  cross-customer access — purged from the app: `DEFAULT_ADMIN_EMAILS` (now only
  `vincent.maione1@gmail.com`), docs, and BOTH Supabase tables. Portal admin + SI service account
  (`SI_ADMIN_USERNAME`/`PASSWORD`) are now `vincent.maione1@gmail.com` (member 30, Account role).
  `*.har` added to `.vercelignore` (HARs hold SI session tokens). **The `vmaione@` password was
  exposed in chat 2026-06-16 — rotate it in Smart Inspect.**
- **Per-completion ("on upload") auto-trigger — EVALUATED & DROPPED (2026-06-16).** SI has **no
  outbound webhook** and **no API to observe when its native on-upload reports send**, so there is no
  non-polling way to fire *our* email on completion, and we chose not to poll. SI *does* have native
  on-upload reports (`getMemberReports`, frequency `Upload`; member 22450 already has photo/dynamicQsp/
  deficiencyReport/notesReport) — configure those in SI if a per-completion email (SI's format) is
  wanted. Otherwise rely on the scheduled reports + the Send-test button. Don't re-litigate without a
  new SI capability. (Inspection records DO carry an `inspector` uploader name if ever useful.)
- **Status:** the live per-member path is merged to `main` + deployed; `/api/admin/members` and
  `/api/admin/send-report` return 200 in prod. **Still unconfirmed:** a real report email actually
  delivered to a real recipient — run Send test against a subscribed member who has Floorcare stores.

### 2026-06-16 session (cont. — admin nav + config filter, branch `feature/admin-nav-and-config-filter`)

- **Admin nav grouping.** Sidebar now renders **Score Settings** + **Report Emails** under an
  admin-only **"Admin"** heading (`ADMIN_NAV` in `Sidebar.tsx`, gated by `user?.isAdmin`). Score
  Settings moved from portfolio/group visibility to admin-only, and `/settings/scores` is now wrapped
  in `RequireAdmin` in `App.tsx` (was unguarded) — enforced, not just hidden.
- **Config filter "wouldn't change" — FIXED.** `FilterDrawer`'s re-sync effect depended on the
  `activeConfig` OBJECT, which `useSmartInspectPermissions` rebuilds every render (`permittedConfigs`
  maps fresh), so it reset the in-drawer selection every render and the Config dropdown couldn't be
  changed. Now it depends on the stable config NAME (`activeConfigName`). See Gotchas.
- **"All Configs" view (corporate all-stores).** New `ALL_CONFIGS` sentinel in `SessionContext`;
  `useSmartInspectPermissions` exposes `isAllConfigs` + `configLabel` and, when selected, returns the
  UNION of every config's stores. `smartInspectClient.fetchRecordsAndTickets` groups stores by config
  and fetches each program separately (runWidgets matches by NAME, outerTierIds are per-config), then
  merges. `StorePerformanceTable` renders a **Config column** in this mode (`showConfig`); the dropdown
  shows "All Configs" only when `configNames.length > 1`. **Caveat:** KPIs are per store-row, so a
  pilot store that lives in N configs counts N× — correct in production (one config per store),
  inflated in the pilot.
- **Frontend-only — no Vercel/env/dep changes.** No new env vars, API routes, or packages; lockfile
  untouched — nothing to change in Vercel; deploys via the normal `main` → Vercel build.
- **STATUS (resume here): committed on branch `feature/admin-nav-and-config-filter`, NOT yet
  pushed/merged/deployed.** Ship it: `git push -u origin feature/admin-nav-and-config-filter` → merge to
  `main` → Vercel auto-deploys prod. **The Admin section is admin-only, so it does NOT appear in
  `npm run dev`** (demo bypasses login → no `isAdmin`; Score Settings is hidden in demo now too) — verify
  it on the deployed site signed in as `vincent.maione1@gmail.com`. The config-filter fix + All Configs DO
  show in demo (boss has >1 config).

### 2026-06-17 session (store-report PDF overhaul)

Big enhancement to the **store** report PDF (`src/utils/storePdfLayout.ts`, shared by the browser
Export PDF and the emailed report). The **portfolio** PDF (`portfolioPdfLayout.ts`) is intentionally
left untouched (Vince's call).

- **Check Areas table:** dropped the **QSP** column; the numeric Deficiencies count + the attribute
  name were merged into ONE red **Deficiency** column (shows the reported attribute(s), e.g.
  "Buildup, Dust"; "—" when clean) — and that column is now **last**. Order: Check Area · Total ·
  Acceptable · Status · Deficiency.
- **Action Items removed everywhere** — the store-PDF KPI, the Store Manager dashboard KPI, AND the
  "Current Action Items" table in the Store Detail modal; **`ActionItemsTable.tsx` deleted**. (It had
  been "distinct deficiency types," confusingly close to the raw Deficiencies count.)
- **Two photo sections** between Top Deficiencies and Recent Inspections: **Deficiencies** photo cards
  (3/row: framed photo + area + red deficiency) and **Inspector Notes** (cards, 2/row: framed photo on
  top + store name + note text). Notes flow **directly under** the Deficiency cards with a divider
  (NOT their own page — a short Deficiencies page used to look like the document ended). Both start on
  their own page and **paginate without splitting a card** ("(cont.)" headers). Ceilings
  `MAX_DEFICIENCY_PHOTOS`/`MAX_NOTES` = 60 — sections paginate, never truncate.
- **Notes are a new normalized type** `NoteReport` on `StoreReport`, built in
  `reportingTransforms.transformStoreReport` from the **`noteRecords`** side of
  `inspection.imageRecords` (`SIInspectionNote`: `noteText`, `noteCategory`, `outerTier`, photo URL on
  `url`/`photo`). Surfaced in the browser client (`extractNoteRecords`) + mock (`getMockNotes`).
- **Emailed store PDF now includes photos + notes** (previously had neither):
  `api/_lib/sendReport.ts fetchStoreData` adds the `inspection.imageRecords` widget; `buildStoreReport`
  passes a photo resolver (record id → CDN `url`) + the note records into `transformStoreReport`.
- **Image embedding (programmatic, no html2canvas).** `renderStorePdf` is now **ASYNC** — it
  pre-fetches every photo to base64 and injects them into the shared layout via an injected
  `resolveImage(url) => EmbeddedImage|null` lookup (layout stays sync + env-agnostic). New pure helper
  `src/utils/imageMeta.ts` (`decodeImageMeta` → JPEG/PNG format + intrinsic dims for aspect-correct
  fit). The **server** (`api/_lib/reportPdf.ts`) fetches the SI CDN directly in Node; the **browser**
  (`src/utils/storePdf.ts`) fetches via a NEW same-origin proxy **`api/si-image.ts`** (host-allowlisted
  to `smartinspect-files.mysmartinspect.com`, session-gated) to dodge CORS. Unsplash demo images load
  directly. Missing/unsupported images render a "Photo unavailable" box and never block the PDF.
- **New live facts:** SI file CDN = `smartinspect-files.mysmartinspect.com`; the inspection-photo URL
  field on `imageRecords.inspectionRecords` is **`url`**. Member **22450** (Brian Cornuta) has
  `rules.accessAllOuterTiers: true` with explicit grants = the 3 pilot stores across Pre-Launch configs
  (20637 ABS / Tysons Corner, 20633 CSG / Johnson City, 20635 Tec / Military Road).
- **Scheduled-report scope clarification (no code change):** emailed-report scope reads the
  **subscribed member's** explicit `permissionOuterTiers` and **ignores `rules.accessAllOuterTiers`**.
  A "portfolio report not respecting permissions" report turned out to be test confusion — perms were
  being edited on the `vmaione@` account, not the subscribed member 30 (`vincent.maione1`). To test
  scoping, edit the SUBSCRIBED member (30 = vincent.maione1, 22450 = Brian); flipping a member to "all
  outer tiers" with an empty explicit list resolves to **0 Floorcare stores → skipped**, not "all."
- **STATUS:** commits `b5f32b7` (initial photos/notes), `b63ed74` (drop QSP / merge deficiency / card
  notes / own-page), and `2f468ed` (remove Action Items + pagination) are on **`main` and pushed**. The
  final `storePdfLayout.ts` tweaks (Deficiency column last + notes-flow-under-deficiencies divider) are
  a separate commit made at the end of this session — confirm it pushed and Vercel rebuilt `main`.
  Reminder: `renderStorePdf` is async now (callers must `await`); `api/si-image.ts` uses relative `.js`
  imports (safe re: the deployed-`/api` `@/` runtime gotcha).

### 2026-06-22 session (Eastern-time reports — suggested branch `feature/eastern-time-reports`, NOT committed)

- **All report times/dates now render in Eastern time** (`America/New_York`, auto EST/EDT) regardless of
  the server clock. New single source of truth **`src/utils/datetime.ts`**: `etTodayISO`, `etDayISO(offset)`,
  `etDayOfWeek`, `etDayOfMonth`, `isSameEasternDate`, `formatDateET` (a **date-only** `YYYY-MM-DD` is shown
  verbatim — NOT shifted into ET, which would render the previous day; a full timestamp IS converted to ET),
  `formatDateTimeET` (adds a zone label, e.g. "Jun 22, 2026, 9:30 AM EDT"). Pure `Intl`/`Date`, **no value
  `@/` imports** (it's reachable from `/api`, so the PDF layouts import it via relative `./datetime.js`).
- **UTC bugs fixed:** "Today"/quick-picks (`DateRangePicker.tsx`) + `SessionContext.defaultRange` used
  `toISOString()` (UTC) so an Eastern evening rolled to *tomorrow*; now ET. The emailed PDFs
  (`storePdfLayout.ts`/`portfolioPdfLayout.ts`) used `toLocale*` with **no** `timeZone`, so on Vercel (UTC
  Node) they printed UTC times; now ET (shared layout ⇒ browser export still matches). `sendReport.isoRange`
  window + `send-reports.isDue` cadence (DOW/DOM + same-day guard) are ET. `formatting.ts` delegates to the
  ET formatters (all dashboard tables/modals follow automatically).
- **Cron moved `0 11`→`0 13` UTC** (`vercel.json`) = **9:00 AM EDT** (Vince's pick). ⚠️ Vercel cron is
  UTC-only, so a fixed UTC instant **drifts EARLIER in winter → 8:00 AM EST** (once clocks fall back, the
  same UTC moment is an earlier ET wall-clock). A constant 9am-ET year-round would need flipping the cron at
  the DST boundary, or an hourly cron gated on the ET hour. Takes effect only after deploy.
- **Left unchanged on purpose:** the SI API date-filter wire format (`${date}T00:00:00Z` +
  `timezone: America/New_York`) — documented as working; only the date *strings* feeding it are ET now.
  `mockData.ts` (demo/dev only) stays UTC-anchored.
- **Verified:** `tsc -b`, `typecheck:api`, `eslint` (0 errors), `vite build` (clean to a scratch outDir; an
  in-place build only hit a sandbox `dist/` unlink `EPERM`, not a code error), and a TZ unit test of
  `datetime.ts` passing under process `TZ`=UTC/America-New_York/Asia-Tokyo (EDT in summer, EST in winter).
- **STATUS: uncommitted on `main` (8 edits + new `src/utils/datetime.ts`).** Ship via branch
  `feature/eastern-time-reports` → merge to `main` → Vercel auto-deploys (cron change needs the deploy).

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

**Role decides the view (changed 2026-06-16).** `useSmartInspectPermissions` sets `accessMode` from
the user's SI **role**: `Account` → Portfolio Overview, everyone else (Operator/Supervisor) → Store
Manager (multi-store non-Account users switch stores via the in-header switcher). This drives
`HomeRedirect`, `RequirePortfolioAccess`, and the Sidebar nav (all read `accessMode`). It is a
routing/UX gate only — the SI proxy still validates every requested store against the user's own
permissions server-side, so an Account user with few stores just sees a smaller portfolio.
**Demo mode** (no live role) falls back to the old store-count logic (>5 Portfolio, 2–5 group, 1
Store Manager) so the mock portfolio stays reachable under `npm run dev`. (Was store-count-based for
everyone before 2026-06-16; the Corporate/Region/Store-Manager demo role toggle was removed from the
top bar 2026-06-15.)

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
recipients their store Floorcare PDF via **Resend**. **Store scope is pulled LIVE per member
(2026-06-16)**: the cron logs in as an SI **admin service account**
(`SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD` → SIQ-0) and calls `listMembers` + `getMemberPermissions`
(`api/_lib/smartInspect.ts` → `getAdminSessionToken`, `listCompanyMembers`, `getMemberStoreGrants`)
to get each subscriber's current grants — no login-capture dependency, never stale. Only Floorcare
configs are reported (`isFloorcareConfig` in `src/config/wegmans.ts`; excludes the ~100-store
general `Wegmans` config 19399); grants are grouped by config (outerTierIds are per-config, SI
filters by store **name**); an explicit `stores_override` wins if set; capped at 30 PDFs/email.
`report_subscriptions` (curated, keyed by `member_id`) holds who + cadence. The server PDF reuses
the shared layout `src/utils/storePdfLayout.ts` — identical to the browser export. Supabase is
**server-only** (service-role key; RLS on, no policies). Cadence is evaluated by the daily run
(daily; weekly `weekly_dow`; monthly `monthly_dom`) with a `last_sent_at` same-day guard.
`report_recipients` (login-capture) is now **legacy** — the cron no longer reads stores from it
(login still upserts it; the admin picker falls back to it if the admin service account is down).
Full setup, env vars, and limitations: `docs/scheduled-reports.md`.

> **`@/` path aliases do NOT work in deployed `/api` functions** (corrected 2026-06-16). Vercel
> runs the functions as ESM **without bundling**, and TypeScript does NOT rewrite `@/` specifiers on
> emit, so an `@/…` import survives into the deployed `.js` and Node throws `ERR_MODULE_NOT_FOUND`
> at runtime (500 "function invocation failed"). **Anything reachable from `/api` must use relative
> imports with explicit `.js` extensions** — including shared `src/` modules (`reportingTransforms`,
> `scoreStatus`, etc.) which the cron + report PDFs pull in. **Type-only** `@/` imports
> (`import type …`) are safe — they're erased before emit. The root-tsconfig `baseUrl`+`paths` only
> help type-checking/Vite, not function runtime — don't rely on them in `/api`.

**Admin config.** Report admins manage recipients + cadence at `/settings/reports`
(`src/pages/ReportSettings.tsx`, behind `RequireAdmin`; admin-only Sidebar link). Admin = session
email on an allowlist: `REPORT_ADMIN_EMAILS` env ∪ a code default (`vincent.maione1@gmail.com`),
checked in `api/_lib/session.ts` (`isAdminSession`); `publicIdentity` / `/api/auth/me` expose
`isAdmin`. CRUD goes through `api/admin/subscriptions.ts` (session + admin gated; service-role
writes). The recipient picker is the **live SI member roster** (`listMembers` via the admin
session); subscriptions key on `member_id`. Admins can optionally **pin stores**
(`report_subscriptions.stores_override` jsonb) to override the live scope; otherwise stores come
from the member's live `getMemberPermissions`. Override store options come from the company SIQ-1
`getPermissions`.

**Report type, test send, members view (2026-06-16 cont.).** Each subscription has a
`report_type` (`store` = per-store Floorcare PDF(s), default; `portfolio` = one summary PDF across
the member's stores) — column on `report_subscriptions`, selectable in the add form + per row. The
portfolio PDF reuses a shared layout `src/utils/portfolioPdfLayout.ts` (browser `portfolioPdf.ts`
+ server `api/_lib/reportPdf.ts` → `renderPortfolioPdf`). The per-subscription send path is
extracted to `api/_lib/sendReport.ts` (`sendReportForSubscription`), shared by the cron AND a
**test-send** endpoint `POST /api/admin/send-report {id}` (admin-only) that renders now and emails
the **signed-in admin** (not the recipient), without touching `last_sent_at` — the "Send test"
button on each subscription row. `/settings/reports` also has a read-only **All members &
permissions** view (`GET /api/admin/members` → roster + each member's Floorcare grants). Store
pickers (override + permissions view) are dropdowns (`StoreDropdown`), not pill walls.

**Needs work (NOT done):**
- **Not verified end-to-end** — deployed, but no real email confirmed sent. Run the cron once
  (`curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/send-reports`) and confirm delivery.
- Requires `SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD` (Account-role) set in env, and relies on SI's
  **undocumented internal** `getMemberPermissions`/`listMembers` (admin session). Get SI's blessing.
- A subscriber with no Floorcare store grants (or an unresolvable member) is `skipped` (reported).
- `send_hour` is stored but NOT enforced — the single daily cron (`0 11 * * *`, 11:00 UTC) sends at one time.
- Cron processes recipients sequentially — fine for a few; batch/fan-out before scaling (function timeout).
- A pinned `stores_override` is admin-asserted, NOT validated against the member's own SI permissions.
- `getMemberPermissions` `rules.accessAllOuterTiers` isn't expanded; we use the explicit
  `permissionOuterTiers` per config. Live SIQ-1 support for `getMemberPermissions` is unconfirmed —
  if it works, the admin login can be dropped.
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
(comma-separated extra report-admin emails; `vincent.maione1@gmail.com` is a built-in default),
`SI_ADMIN_USERNAME` + `SI_ADMIN_PASSWORD` (an SI Account-role service login the cron uses to pull
members' live store permissions via `getMemberPermissions`/`listMembers`).
See `docs/scheduled-reports.md`.
Frontend: `VITE_ENABLE_MOCK_DATA` (`false` in prod), `VITE_APP_ENV`.
All set in Vercel project env. `.env.local` is gitignored (Vercel CLI also writes a `VERCEL_OIDC_TOKEN` there).

## Gotchas (these will bite again)

- **`@/` aliases crash deployed `/api` functions at runtime** (`ERR_MODULE_NOT_FOUND` → 500
  "function invocation failed"). Functions run as un-bundled ESM; TS leaves `@/` in the emitted JS.
  Use **relative `.js` imports** in `/api` AND in any `src/` file reachable from it (e.g.
  `reportingTransforms`, `scoreStatus`, the PDF layouts). `import type … from "@/…"` is fine (erased).
  `npm run typecheck:api` does NOT catch this (it resolves `@/` via tsconfig like the app build does)
  — only a real invocation does. Verify new function endpoints by actually hitting them after deploy.
- **Node 26 locally rewrites `package-lock.json` into a format Vercel's npm 10 rejects**
  (`npm error Invalid Version` during dedupe). Fix: regenerate the lockfile with npm 10
  (`rm package-lock.json && npm install` under Node 22), or just don't regenerate it locally.
  `engines.node` is pinned to `22.x`.
- The Vercel CLI ignores `.gitignore` and uploads everything not in **`.vercelignore`** — keep
  `node_modules`, `.npm-cache`, `.tmp`, `.npmrc`, logs, and **`*.har`** out of it (a shipped `.npmrc`
  once redirected npm's cache and broke the build; `*.har` was added 2026-06-16 because HAR captures
  embed SI session tokens and must never deploy).
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
- **`useSmartInspectPermissions` returns a NEW `activeConfig`/`configs` object every render**
  (`permittedConfigs` maps fresh each call). Never put `activeConfig` (or `configs`) in a `useEffect`
  dependency array that sets state — it fires every render and clobbers local state. Symptom seen
  2026-06-16: the FilterDrawer Config dropdown wouldn't change because its open-sync effect depended
  on `activeConfig`. Depend on a stable primitive (`activeConfig?.configName`) instead.

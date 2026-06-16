# Smart Inspect Internal (Web-App) API — Probed Reference

Captured 2026-06-12 from the SI web app (HAR + direct probes). These are SI's
**undocumented internal endpoints** (the ones their own webapp uses), distinct from
the documented SIQ-1 integration API. They could change without notice — get SI's
blessing before shipping anything built on them.

## Auth model

Two token schemes, same `Authorization` header style:

- `SIQ-1 <token>` — the documented integration API token. One per company, must be
  assigned to a member; inherits that member's permissions. What our Vercel proxy
  uses today (`SMART_INSPECT_API_TOKEN`).
- `SIQ-0 <sessionToken>` — a per-user session token issued by login. What the web
  app uses. **Sessions span all companies a member belongs to, so most calls
  require explicit `companyId` (and often `memberId`).**

## Login

`POST /api/startSession` — header `Authorization: SIQ-0 null`
Body: `{ "username": "<email>", "memberPassword": "<password>" }`

200 response includes:
- `sessionToken` — use as `SIQ-0 <token>` on subsequent calls
- `member` — `{ id, displayName, firstName, lastName, email, lastLogin, memberCompanies[] }`
- `companies[]` — one entry per company the member belongs to:
  - `companyId`, `roleId` (seen: `Operator`, `Supervisor`, `Account`)
  - `permissionLevels`: `{ canInspect, canView, canGetReports, canTicket,
    canChecklist, canManageTicket, canAssignTicket, assignTicketsByPermission,
    assignTicketsByGroup }`
  - `company`: branding + labels (`outerTierLabel`, `scoreType`, colors, timezone, …)

Invalid credentials → non-200 (login failure is detectable).

## Per-member permissions (the store scoping we needed)

`POST /api/getPermissions`
Body: `{ "permissionType": "Access", "companyId": 1382, "memberId": <id> }`
→ `permissions.permissionConfigs[]` each `{ name, configId,
   permissionOuterTiers: [{ id, name, outerTierId }] }` + `permissionNoteCategories`.
**Returns only what that member is granted.** Works with the member's own SIQ-0
session. (Without `memberId` + `companyId` → "Access Denied". Under SIQ-1 it
returns the assigned member's grants, no `memberId` accepted for others.)

`POST /api/fullPermissions` — same body → the company's FULL config/outer-tier tree
(what the permission-editing admin UI uses). Useful for an admin store-picker.

### getMemberPermissions / getPermissionLevels (confirmed 2026-06-16 HAR)

The web app's permission-editor uses two more endpoints that DO return an
arbitrary member's scope to an **admin (Account-role) session** — this is the
piece that unblocks per-member scheduled reports without that member logging in:

`POST /api/getMemberPermissions`  Body: `{ "memberId": <id>, "companyId": 1382 }`
→ `{ success, permissions: { rules, levels, access, pdf } }` where
  - `rules` — `{ accessAllConfigs, accessAllOuterTiers, accessAllNotes, linkAccessToPdf, pdfAll* }`
  - `levels` — capability flags (`canInspect, canView, canGetReports, canTicket, …`)
  - `access.permissionConfigs[]` — the member's granted stores:
    `{ name (configName), configId, permissionOuterTiers: [{ name, outerTierId }] }`
  - `pdf.permissionConfigs[]` — same shape, scoped to PDF access.
  A member may be granted stores across **multiple** configs.

`GET /api/getPermissionLevels?memberId=<id>&companyId=1382`
→ `{ success, permissionLevels: { id, canInspect, canView, canGetReports, … } }`
(just the capability flags, no store scope).

**Auth:** these are the web app's internal, **session-authed** endpoints. In the
HAR they ran under an Account-role SIQ-0 session (no `Authorization`/`Cookie`
captured — the export stripped it); they are NOT confirmed under the company
SIQ-1 token. The scheduled-report cron therefore logs in with a dedicated SI
**admin service account** (`SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD`) and reuses
that SIQ-0 session — see `api/_lib/smartInspect.ts` (`getAdminSessionToken`,
`listCompanyMembers`, `getMemberStoreGrants`).

### Per-member reports (SI's own scheduler — not used by this portal)

`POST /api/getMemberReports` `{ memberId, companyId }` → `reports[]`
(`reportFrequencyId`, `reportDefinitionName`, `onlyMyUploads`, …) and
`POST /api/listSchedulableReports` `{ companyId }` → the catalog of schedulable
report definitions (`buildingsInspectedReport`, `deficiencyReport`, `dynamicQsp`,
`photo`, `notesReport`, …). SI has a native per-member scheduled-report system;
this portal emails its **own** Wegmans Floorcare PDF instead, but this is where
to look if we ever want to hook into SI's scheduler.

### Config / outer-tier map (companyId 1382, from the 2026-06-16 HAR)

Outer-tier IDs are **per-config** — the same store has a different `outerTierId`
in every config, so always join by store **name**:

| config | configId | 115 Tysons | 73 Johnson City | 92 Military Rd |
| --- | --- | --- | --- | --- |
| Wegmans Floorcare Pilot (orig) | 20035 | 191864 | 191941 | 191958 |
| Pre-Launch – ABS | 20637 | 198003 | — | — |
| Pre-Launch – CSG | 20633 | — | 197992 | — |
| Pre-Launch – Tec Services | 20635 | — | — | 197999 |
| Post-Launch – ABS | 20639 | 198006 | 198007 | 198008 |
| Post-Launch – CSG | 20634 | 197994 | 197995 | 197996 |
| Post-Launch – Tec Services | 20636 | 198000 | 198001 | 198002 |

Plus the big general `Wegmans` config (19399, ~100 stores) — **excluded** from
the Floorcare report (`isFloorcareConfig` in `src/config/wegmans.ts`). 21 members
in the roster; all currently have `canGetReports: true`.

## Member management (session auth)

- `GET /api/listMembers?companyId=1382&status=all` → `members[]`:
  `{ id, displayName, firstName, lastName, email, customId, crmId,
     permissionLevels, memberGroups, memberCompany }` (21 members currently)
- `GET /api/getMember?memberId=<id>&companyId=1382` → `member` + `memberRoleId`
- `GET /api/listMemberGroups?companyId=1382&status=all` → `memberGroups[]` (empty for Wegmans)

## Data (session auth)

`POST /api/runWidgets` works under SIQ-0 when body includes `companyId` AND `memberId`.
SI enforces the member's permissions on the result — i.e., per-user data scoping for
free. Web app also uses a GET variant with URL-encoded `widgets`/`filters` params.

Widget properNames seen in the web app (superset of our documented list):
`company.info`, `inspection.actionItems`, `inspection.allRecords`, `inspection.details`,
`inspection.filterLists`, `inspection.imageRecords`, `inspection.inspectionStatus`,
`inspection.inspectionStatusZones`, `inspection.itemCount`, `inspection.list`,
`inspection.notes`, `inspection.qspBy`, `inspection.trend`, `ticket.countBy`,
`ticket.dashCounts`, `ticket.filter`, `ticket.getTickets`, `ticket.monthSummary`

Note the **widget aliasing**: web app sends `{"widgets":{"stats":{"properName":"inspection.details"}}}`
— key is an alias, `properName` is the real widget. Filters use `configIds`/`outerTierIds`
(ID arrays) rather than the name arrays our integration-API calls use, plus
`showArchives`, `excludeCore`, `uploadDates`, `inspections`, `noteCategories`, etc.

Other endpoints observed: `getDefaultTags`, `getTicketCompany`, `checkCompanySimpl`,
`checkPlanCompany`, `checkChecklistCompany`, `listSchedulableReports`,
`listConfigs?companyId=` (✓ session), `getConfig` (✓ session, needs `companyId` in body).

## Confirmed quirks

- True 404 body: `{"error":"unknown action or invalid apiVersion"}`. Privilege gate:
  `{"error":"Forbidden."}` or `{"error":"Access Denied"}` (the latter often just means
  missing `companyId`/`memberId`).
- `/getCompanyDetails` (our proxy's `configurations` endpoint) 404s both live schemes —
  it never worked; the working equivalent is `listConfigs`.
- Wegmans (companyId 1382) now has **10 configs**: original `Wegmans` (19399, ~100 stores),
  original pilot `Wegmans Floorcare Pilot` (20035), plus Pre-Launch and Post-Launch
  variants per vendor (ABS / CSG / Tec Services), updated 2026-06-11. The app currently
  assumes 20035 only — needs a product decision on which configs to report on.
- Outer-tier IDs are **per-config** (Tysons Corner has a different `outerTierId` in each
  config) — never treat outerTierId as a global store ID; the store *name* is the
  cross-config join key (matches how `reconcileOuterTiers` already works).

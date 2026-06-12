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

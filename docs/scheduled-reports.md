# Scheduled report emails

Emails each curated recipient their Wegmans Floorcare store PDF on a cadence
(daily / weekly / monthly). Live path only — Demo mode neither captures
permissions nor sends mail.

## How it works

Store scope is pulled **live per member** at send time (updated 2026-06-16) — no
login-capture dependency, never stale.

1. **Curated subscriptions** — rows in Supabase `report_subscriptions` say *who*
   gets email (`member_id` + `email`) and *how often*. The admin page picks from
   the live SI member roster, so each subscription is keyed to a real member.
2. **Live permission pull** — the cron logs in once as the SI **admin service
   account** (`SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD` → SIQ-0 session) and calls
   `listMembers` + `getMemberPermissions` to get each subscriber's *current*
   store grants. Only **Floorcare** configs are reported (`isFloorcareConfig`);
   the big general `Wegmans` config (19399) is excluded. An explicit
   `stores_override` on the subscription wins if set.
3. **Daily cron** — `api/cron/send-reports.ts` runs once a day (Vercel Cron,
   `vercel.json` → `0 11 * * *`, 11:00 UTC). For each due subscription it groups
   the member's grants by config (outer-tier IDs are per-config; SI filters by
   store *name*), fetches each config's data with the company SIQ-1 token,
   renders the **same** store PDF as the on-screen export (shared
   `src/utils/storePdfLayout.ts`), and emails via Resend. Capped at 30 store PDFs
   per email as a safety.

Cadence (stateless, evaluated by the daily run): `daily` every day; `weekly` on
`weekly_dow` (0=Sun…6=Sat, default Mon); `monthly` on `monthly_dom` (1–28,
default 1). A `last_sent_at` guard prevents a double-send the same day. The
report window is trailing: daily = 1 day, weekly = 7, monthly = 30.

> `report_recipients` (login-captured stores) is now **legacy** — the cron no
> longer reads stores from it. Login still upserts it (harmless) and the admin
> page falls back to it for the picker if the admin service account is
> unavailable. Removable once the live path is confirmed in production.

## Required environment variables (Vercel → server-side, never `VITE_`)

| Var | Value |
| --- | --- |
| `SUPABASE_URL` | `https://mjhuujbwkkfjmzfmzqol.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → **service_role** secret |
| `RESEND_API_KEY` | from Resend |
| `REPORT_EMAIL_FROM` | a **verified** Resend sender, e.g. `Wegmans Floorcare <reports@yourdomain.com>` |
| `CRON_SECRET` | any random string — `openssl rand -base64 32` (the cron refuses to run without it) |
| `SI_ADMIN_USERNAME` | a Smart Inspect **Account-role** login (a dedicated service account preferred over a personal one) — used to pull members' live permissions |
| `SI_ADMIN_PASSWORD` | that account's password (server-side only; never reaches the browser) |

```bash
# example (run per value; choose the right environments)
echo -n "https://mjhuujbwkkfjmzfmzqol.supabase.co" | vercel env add SUPABASE_URL production
echo -n "<service_role key>"  | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo -n "<resend key>"        | vercel env add RESEND_API_KEY production
echo -n "Wegmans Floorcare <reports@yourdomain.com>" | vercel env add REPORT_EMAIL_FROM production
echo -n "$(openssl rand -base64 32)" | vercel env add CRON_SECRET production
echo -n "<si admin username>" | vercel env add SI_ADMIN_USERNAME production
echo -n "<si admin password>" | vercel env add SI_ADMIN_PASSWORD production
```

> Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
> invocations, which the endpoint checks. Setting `CRON_SECRET` for *Preview*
> too lets you trigger it manually with that bearer token.

## Supabase tables (already created, project `mjhuujbwkkfjmzfmzqol`)

- `report_recipients` — `member_id` (pk), `email`, `display_name`, `company_id`,
  `config_id`, `config_name`, `stores` (jsonb `[{outerTierId,name}]`),
  `permission_levels`, `captured_at`, `updated_at`. Written at login.
- `report_subscriptions` — `id`, `email`, `member_id`, `frequency`
  (`daily|weekly|monthly`), `enabled`, `weekly_dow`, `monthly_dom`, `send_hour`,
  `last_sent_at`. Curated by you.

Both have RLS **on with no policies** → only the server (service-role key) can
read/write; the browser never touches Supabase directly.

## Add a recipient

Use the **Report Emails** admin page (`/settings/reports`) — pick a member from
the live SI roster, choose a cadence, Add. The recipient does **not** need to
have logged in; their stores are pulled live from Smart Inspect at send time.
(Direct SQL still works — `member_id` is the key, `email` is the To: address:)

```sql
insert into report_subscriptions (email, member_id, frequency)
values ('manager@wegmans.com', '22440', 'weekly');
```

## Deploy & test

1. Set the env vars above (incl. `SI_ADMIN_USERNAME`/`SI_ADMIN_PASSWORD`); deploy (`vercel --prod`).
2. Add a subscription on `/settings/reports` (pick a member, choose cadence).
3. Trigger manually to verify before waiting for the schedule:
   ```bash
   curl -i https://<your-app>/api/cron/send-reports \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   Response JSON reports `considered`, `due`, and per-recipient `results`.

## Limits / future work

- Store scope comes from SI's **undocumented internal** `getMemberPermissions`
  via an admin **service-account session** (SIQ-0). Get SI's blessing before
  relying on it long-term; if the company SIQ-1 token is later confirmed to
  accept `getMemberPermissions`, the admin login can be dropped.
- A subscriber with no Floorcare store grants (or whose member can't be resolved)
  is skipped (reported in the response).
- The `getMemberPermissions` `rules.accessAllOuterTiers` flag isn't expanded — we
  use the explicit `permissionOuterTiers` returned per config. An email is capped
  at 30 store PDFs as a safety.
- One daily cron covers all cadences; finer per-recipient send times
  (`send_hour`) need multiple crons (Vercel Pro) — `send_hour` is stored but not
  yet enforced.
- The cron runs recipients sequentially; fine for a small curated list. For many
  recipients, batch or fan out to stay under the function timeout.
- Logo: bundled via `vercel.json` `includeFiles`; if not found at runtime the
  PDF falls back to a text "Wegmans" header.

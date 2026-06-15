# Scheduled report emails

Emails each curated recipient their Wegmans Floorcare store PDF on a cadence
(daily / weekly / monthly). Live path only — Demo mode neither captures
permissions nor sends mail.

## How it works

1. **Capture at login** — `api/auth/login.ts` records each user's permitted
   stores into Supabase `report_recipients` on sign-in (best-effort; never
   blocks login). This is how the scheduler knows a recipient's stores without
   a live session — Smart Inspect only returns a member's store grants to that
   member's own login.
2. **Curated subscriptions** — rows in Supabase `report_subscriptions` say *who*
   gets email and *how often*. Stores are filled in automatically from the
   matching `report_recipients` row (by `member_id`, else `email`).
3. **Daily cron** — `api/cron/send-reports.ts` runs once a day (Vercel Cron,
   `vercel.json` → `0 11 * * *`, 11:00 UTC). It sends the subscriptions due
   today, fetching each store's data with the company SIQ-1 token, rendering the
   **same** store PDF as the on-screen export (shared `src/utils/storePdfLayout.ts`),
   and emailing via Resend.

Cadence (stateless, evaluated by the daily run): `daily` every day; `weekly` on
`weekly_dow` (0=Sun…6=Sat, default Mon); `monthly` on `monthly_dom` (1–28,
default 1). A `last_sent_at` guard prevents a double-send the same day. The
report window is trailing: daily = 1 day, weekly = 7, monthly = 30.

## Required environment variables (Vercel → server-side, never `VITE_`)

| Var | Value |
| --- | --- |
| `SUPABASE_URL` | `https://mjhuujbwkkfjmzfmzqol.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → **service_role** secret |
| `RESEND_API_KEY` | from Resend |
| `REPORT_EMAIL_FROM` | a **verified** Resend sender, e.g. `Wegmans Floorcare <reports@yourdomain.com>` |
| `CRON_SECRET` | any random string — `openssl rand -base64 32` (the cron refuses to run without it) |

```bash
# example (run per value; choose the right environments)
echo -n "https://mjhuujbwkkfjmzfmzqol.supabase.co" | vercel env add SUPABASE_URL production
echo -n "<service_role key>"  | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo -n "<resend key>"        | vercel env add RESEND_API_KEY production
echo -n "Wegmans Floorcare <reports@yourdomain.com>" | vercel env add REPORT_EMAIL_FROM production
echo -n "$(openssl rand -base64 32)" | vercel env add CRON_SECRET production
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

The person must have **logged into the portal at least once** (so their stores
are captured). Then insert a subscription:

```sql
insert into report_subscriptions (email, member_id, frequency)
values ('manager@wegmans.com', null, 'weekly');   -- member_id optional; matched by email
```

## Deploy & test

1. Set the env vars above; deploy (`vercel --prod`).
2. Have a recipient log in once (populates `report_recipients`).
3. Add their `report_subscriptions` row.
4. Trigger manually to verify before waiting for the schedule:
   ```bash
   curl -i https://<your-app>/api/cron/send-reports \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   Response JSON reports `considered`, `due`, and per-recipient `results`.

## Limits / future work

- Recipients with no captured stores (never logged in) are skipped (reported in
  the response).
- One daily cron covers all cadences; finer per-recipient send times
  (`send_hour`) need multiple crons (Vercel Pro) — `send_hour` is stored but not
  yet enforced.
- The cron runs recipients sequentially; fine for a small curated list. For many
  recipients, batch or fan out to stay under the function timeout.
- Logo: bundled via `vercel.json` `includeFiles`; if not found at runtime the
  PDF falls back to a text "Wegmans" header.

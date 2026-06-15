/**
 * Server-side Supabase client (service role). Runs ONLY in Vercel functions —
 * the service-role key bypasses RLS and must never reach the browser. Returns
 * null when env isn't configured so callers degrade gracefully (e.g. local dev
 * without Supabase set up just skips the capture).
 *
 * Tables (see migration create_wegmans_report_tables):
 *  - report_recipients   : per-user store permissions captured at login
 *  - report_subscriptions : curated recipient + cadence for the scheduled email
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export interface RecipientStore {
  outerTierId: string;
  name: string;
}

export interface RecipientRecord {
  member_id: string;
  email: string;
  display_name?: string | null;
  company_id?: number | null;
  config_id?: string | null;
  config_name?: string | null;
  stores: RecipientStore[];
  permission_levels?: Record<string, unknown> | null;
}

/** Upsert a recipient's captured store permissions. Best-effort; never throws. */
export async function upsertRecipient(rec: RecipientRecord): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db
    .from("report_recipients")
    .upsert({ ...rec, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (error) console.warn("report_recipients upsert failed:", error.message);
}

/* ----------------------------- subscriptions --------------------------- */

export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface SubscriptionRow {
  id: string;
  email: string;
  member_id: string | null;
  frequency: ReportFrequency;
  enabled: boolean;
  weekly_dow: number | null; // 0=Sun..6=Sat
  monthly_dom: number | null; // 1..28
  send_hour: number; // 0..23
  last_sent_at: string | null;
}

/** All enabled subscriptions. Empty if Supabase isn't configured. */
export async function getEnabledSubscriptions(): Promise<SubscriptionRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("report_subscriptions")
    .select("*")
    .eq("enabled", true);
  if (error) {
    console.warn("report_subscriptions read failed:", error.message);
    return [];
  }
  return (data ?? []) as SubscriptionRow[];
}

/** Resolve a subscription's captured recipient record (stores live here). */
export async function getRecipient(opts: {
  memberId?: string | null;
  email: string;
}): Promise<RecipientRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const q = db.from("report_recipients").select("*").limit(1);
  const { data, error } = opts.memberId
    ? await q.eq("member_id", opts.memberId)
    : await q.ilike("email", opts.email);
  if (error || !data || data.length === 0) return null;
  return data[0] as RecipientRecord;
}

export async function markSubscriptionSent(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("report_subscriptions")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id);
}

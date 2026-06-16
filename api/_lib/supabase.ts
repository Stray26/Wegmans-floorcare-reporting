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
/** Which report the recipient gets: their per-store PDF, or one portfolio summary. */
export type ReportType = "store" | "portfolio";

export interface SubscriptionRow {
  id: string;
  email: string;
  member_id: string | null;
  frequency: ReportFrequency;
  /** store = per-store Floorcare PDF(s); portfolio = single summary across their stores. */
  report_type: ReportType;
  enabled: boolean;
  weekly_dow: number | null; // 0=Sun..6=Sat
  monthly_dom: number | null; // 1..28
  send_hour: number; // 0..23
  last_sent_at: string | null;
  /** Admin-assigned store scope; when set, overrides the recipient's captured stores. */
  stores_override: RecipientStore[] | null;
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

/** A single subscription by id (for the admin test-send). */
export async function getSubscriptionById(id: string): Promise<SubscriptionRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("report_subscriptions")
    .select("*")
    .eq("id", id)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as SubscriptionRow;
}

export async function markSubscriptionSent(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("report_subscriptions")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id);
}

/* --------------------- admin: manage subscriptions --------------------- */

export interface SubscriptionInput {
  id?: string;
  email: string;
  member_id?: string | null;
  frequency: ReportFrequency;
  report_type?: ReportType;
  enabled?: boolean;
  weekly_dow?: number | null;
  monthly_dom?: number | null;
  send_hour?: number;
  stores_override?: RecipientStore[] | null;
}

export async function listSubscriptions(): Promise<SubscriptionRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("report_subscriptions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("report_subscriptions list failed:", error.message);
    return [];
  }
  return (data ?? []) as SubscriptionRow[];
}

export async function upsertSubscription(input: SubscriptionInput): Promise<SubscriptionRow> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase is not configured.");
  const fields: Record<string, unknown> = {
    email: input.email.trim(),
    member_id: input.member_id ?? null,
    frequency: input.frequency,
    enabled: input.enabled ?? true,
    weekly_dow: input.weekly_dow ?? null,
    monthly_dom: input.monthly_dom ?? null,
  };
  if (input.send_hour != null) fields.send_hour = input.send_hour;
  // Only touch report_type when provided, so other edits don't reset it.
  if (input.report_type !== undefined) fields.report_type = input.report_type;
  // Only touch stores_override when explicitly provided, so frequency/enable
  // edits don't wipe a previously-assigned store scope.
  if (input.stores_override !== undefined) fields.stores_override = input.stores_override;
  const { data, error } = input.id
    ? await db.from("report_subscriptions").update(fields).eq("id", input.id).select()
    : await db.from("report_subscriptions").insert(fields).select();
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as SubscriptionRow;
}

export async function deleteSubscription(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase is not configured.");
  const { error } = await db.from("report_subscriptions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface RecipientSummary {
  member_id: string;
  email: string;
  display_name: string | null;
  stores: RecipientStore[];
  captured_at: string;
}

export async function listRecipients(): Promise<RecipientSummary[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("report_recipients")
    .select("member_id,email,display_name,stores,captured_at")
    .order("captured_at", { ascending: false });
  if (error) {
    console.warn("report_recipients list failed:", error.message);
    return [];
  }
  return (data ?? []) as RecipientSummary[];
}

/**
 * Server-side Smart Inspect helper. Runs ONLY in Vercel serverless functions.
 * The SIQ-1 token lives in env vars and never reaches the browser.
 *
 * Transport (per the integration reference):
 *   Base URL: https://app.mysmartinspect.com/api
 *   Auth:     Authorization: SIQ-1 <RAW_TOKEN>
 *   Method:   POST, application/json, one path per endpoint.
 */

const BASE_URL =
  process.env.SMART_INSPECT_API_BASE_URL ?? "https://app.mysmartinspect.com/api";

/** The Smart Inspect company this portal serves (Wegmans). */
export const COMPANY_ID = Number(process.env.SMART_INSPECT_COMPANY_ID ?? 1382);

function token(): string {
  const t = process.env.SMART_INSPECT_API_TOKEN ?? process.env.VITE_SMART_INSPECT_API_TOKEN;
  if (!t) {
    throw Object.assign(
      new Error("SMART_INSPECT_API_TOKEN is not configured (set it in Vercel env)."),
      { statusCode: 500 }
    );
  }
  return t;
}

/** Map the client's `endpoint` value to the upstream path. */
export const ENDPOINT_PATHS: Record<string, string> = {
  runWidgets: "/runWidgets",
  getPermissions: "/getPermissions",
  getconfig: "/getConfig",
  configurations: "/getCompanyDetails",
  listTags: "/listTags",
  createTicket: "/createTicket",
  getTicket: "/getTicket",
};

/**
 * POST with an explicit Authorization value. Two schemes exist:
 *  - `SIQ-1 <apiToken>`     — the documented integration API token
 *  - `SIQ-0 <sessionToken>` — a per-user web session (from /startSession;
 *    use `SIQ-0 null` for the login call itself). See docs/si-internal-api.md.
 */
export async function siPostWith<T>(authorization: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `Smart Inspect ${res.status}`;
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }
  return data as T;
}

/** POST using the company SIQ-1 integration token (legacy/default path). */
export async function siPost<T>(path: string, body: unknown): Promise<T> {
  return siPostWith<T>(`SIQ-1 ${token()}`, path, body);
}

/** GET with an explicit Authorization value (SI member-management endpoints are GET). */
export async function siGetWith<T>(authorization: string, path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { authorization },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `Smart Inspect ${res.status}`;
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }
  return data as T;
}

/* ----------------------- admin session (SIQ-0) ------------------------- */
/*
 * Some Smart Inspect endpoints (listMembers, getMemberPermissions) are the
 * web app's internal, session-authed endpoints — they don't work under the
 * company SIQ-1 token. The scheduled-report cron has no user session, so it
 * logs in once with a dedicated SI admin (Account-role) service account and
 * reuses that SIQ-0 session to look up members + their live store permissions.
 * Credentials are server-side env only (SI_ADMIN_USERNAME / SI_ADMIN_PASSWORD)
 * and never reach the browser. See docs/si-internal-api.md + scheduled-reports.md.
 */

interface StartSessionResponse {
  sessionToken?: string;
  member?: { id: number };
}

/** Cached admin session token (module-scoped; lives for the function instance). */
let adminSession: { token: string; exp: number } | null = null;
const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000; // re-login at most every 10 min

/** Log in as the SI admin service account and return its SIQ-0 session token. */
export async function getAdminSessionToken(force = false): Promise<string> {
  if (!force && adminSession && adminSession.exp > Date.now()) return adminSession.token;
  const username = process.env.SI_ADMIN_USERNAME;
  const password = process.env.SI_ADMIN_PASSWORD;
  if (!username || !password) {
    throw Object.assign(
      new Error("SI_ADMIN_USERNAME / SI_ADMIN_PASSWORD are not configured (set them in Vercel env)."),
      { statusCode: 500 }
    );
  }
  const resp = await siPostWith<StartSessionResponse>("SIQ-0 null", "/startSession", {
    username,
    memberPassword: password,
  });
  if (!resp?.sessionToken) {
    throw Object.assign(new Error("Smart Inspect admin sign-in failed."), { statusCode: 502 });
  }
  adminSession = { token: resp.sessionToken, exp: Date.now() + ADMIN_SESSION_TTL_MS };
  return adminSession.token;
}

/**
 * Run an admin-session call, transparently re-logging-in once if the cached
 * session has gone stale (401/Access Denied).
 */
async function withAdminSession<T>(fn: (authorization: string) => Promise<T>): Promise<T> {
  const tok = await getAdminSessionToken();
  try {
    return await fn(`SIQ-0 ${tok}`);
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    const msg = (err as Error)?.message ?? "";
    if (status === 401 || /access denied|forbidden|session/i.test(msg)) {
      adminSession = null;
      const fresh = await getAdminSessionToken(true);
      return fn(`SIQ-0 ${fresh}`);
    }
    throw err;
  }
}

/* ----------------------- member management ----------------------------- */

export interface CompanyMember {
  memberId: string;
  email: string;
  displayName: string;
  roleId: string | null;
  canGetReports: boolean;
}

interface RawMember {
  id: number;
  email?: string;
  displayName?: string;
  permissionLevels?: { canGetReports?: boolean } | null;
  memberCompany?: { roleId?: string } | null;
}

/**
 * The company's member roster (admin session). Includes each member's
 * capability flags (we surface canGetReports). Store/outer-tier scope is NOT
 * here — use getMemberStoreGrants for that.
 */
export async function listCompanyMembers(): Promise<CompanyMember[]> {
  const resp = await withAdminSession((auth) =>
    siGetWith<{ members?: RawMember[] }>(auth, `/listMembers?companyId=${COMPANY_ID}`)
  );
  return (resp.members ?? []).map((m) => ({
    memberId: String(m.id),
    email: m.email ?? "",
    displayName: m.displayName ?? m.email ?? `Member ${m.id}`,
    roleId: m.memberCompany?.roleId ?? null,
    canGetReports: !!m.permissionLevels?.canGetReports,
  }));
}

export interface MemberStoreGrant {
  configId: string;
  configName: string;
  outerTierId: string;
  storeName: string;
}

interface RawMemberPermissions {
  permissions?: {
    access?: {
      permissionConfigs?: Array<{
        configId?: number | string;
        name?: string;
        permissionOuterTiers?: Array<{ id?: number | string; name?: string; outerTierId?: number | string }>;
      }>;
    };
  };
}

/**
 * A specific member's live store grants (admin session). Flattens
 * getMemberPermissions' access.permissionConfigs[] into (config, store) tuples.
 * A member may be granted stores across multiple configs.
 */
export async function getMemberStoreGrants(memberId: string | number): Promise<MemberStoreGrant[]> {
  const resp = await withAdminSession((auth) =>
    siPostWith<RawMemberPermissions>(auth, "/getMemberPermissions", {
      memberId: Number(memberId),
      companyId: COMPANY_ID,
    })
  );
  const configs = resp.permissions?.access?.permissionConfigs ?? [];
  const grants: MemberStoreGrant[] = [];
  for (const cfg of configs) {
    const configId = cfg.configId != null ? String(cfg.configId) : "";
    const configName = cfg.name ?? "";
    for (const ot of cfg.permissionOuterTiers ?? []) {
      const outerTierId = String(ot.outerTierId ?? ot.id ?? "");
      if (!outerTierId) continue;
      grants.push({ configId, configName, outerTierId, storeName: ot.name ?? "" });
    }
  }
  return grants;
}

/* ----------------------------- permissions ----------------------------- */

interface PermOuterTier {
  id: number | string;
  name: string;
  outerTierId: number | string;
}
interface PermConfig {
  configId?: number | string;
  name?: string;
  configName?: string;
  permissionOuterTiers?: PermOuterTier[];
}
interface Permission {
  permissionConfigs?: PermConfig[];
}
interface PermissionsResponse {
  permissions: Permission | Permission[];
}

/** Flatten a getPermissions response into the set of permitted store names. */
export function outerTierNamesFrom(resp: PermissionsResponse): Set<string> {
  const perms = Array.isArray(resp.permissions) ? resp.permissions : [resp.permissions];
  const names = new Set<string>();
  for (const p of perms) {
    for (const cfg of p?.permissionConfigs ?? []) {
      for (const ot of cfg.permissionOuterTiers ?? []) {
        if (ot?.name) names.add(ot.name);
      }
    }
  }
  return names;
}

export interface PermittedStore {
  outerTierId: string;
  name: string;
}

/** Flatten a getPermissions response into the user's permitted stores (id + name). */
export function permittedStoresFrom(resp: PermissionsResponse): PermittedStore[] {
  const perms = Array.isArray(resp.permissions) ? resp.permissions : [resp.permissions];
  const seen = new Set<string>();
  const stores: PermittedStore[] = [];
  for (const p of perms) {
    for (const cfg of p?.permissionConfigs ?? []) {
      for (const ot of cfg.permissionOuterTiers ?? []) {
        const id = String(ot.outerTierId ?? ot.id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        stores.push({ outerTierId: id, name: ot.name ?? "" });
      }
    }
  }
  return stores;
}

/** The first config (inspection program) named in a getPermissions response. */
export function firstConfigFrom(
  resp: PermissionsResponse
): { configId: string; configName: string } | null {
  const perms = Array.isArray(resp.permissions) ? resp.permissions : [resp.permissions];
  for (const p of perms) {
    for (const cfg of p?.permissionConfigs ?? []) {
      const configId = cfg.configId != null ? String(cfg.configId) : "";
      const configName = cfg.configName ?? cfg.name ?? "";
      if (configId || configName) return { configId, configName };
    }
  }
  return null;
}

/** Permitted store names for the company API token (token-assigned member). */
export async function getAllowedOuterTierNames(): Promise<Set<string>> {
  const resp = await siPost<PermissionsResponse>("/getPermissions", {
    permissionType: "Access",
  });
  return outerTierNamesFrom(resp);
}

/**
 * Per-user permissions via the member's own SIQ-0 session (companyId AND
 * memberId are required — see docs/si-internal-api.md). Any failure here means
 * the SI session is no longer valid → treat as logged out (statusCode 401).
 */
export async function getUserPermissions(
  siSessionToken: string,
  companyId: number,
  memberId: number
): Promise<PermissionsResponse> {
  try {
    return await siPostWith<PermissionsResponse>(
      `SIQ-0 ${siSessionToken}`,
      "/getPermissions",
      { permissionType: "Access", companyId, memberId }
    );
  } catch {
    throw Object.assign(new Error("Your session has expired. Please sign in again."), {
      statusCode: 401,
    });
  }
}

/**
 * Reconcile requested stores against the caller's permissions.
 *  - empty request  -> all permitted stores
 *  - any out-of-scope store -> 403
 * Returns the validated list of store names to forward to Smart Inspect.
 */
export function reconcileOuterTiers(
  allowed: Set<string>,
  requested: string[] | undefined
): string[] {
  if (!requested || requested.length === 0) return [...allowed];
  const denied = requested.filter((n) => !allowed.has(n));
  if (denied.length > 0) {
    throw Object.assign(new Error(`Forbidden store(s): ${denied.join(", ")}`), {
      statusCode: 403,
    });
  }
  return requested;
}

/** Flatten a getPermissions response into the set of permitted outer-tier IDs. */
export function outerTierIdsFrom(resp: PermissionsResponse): Set<string> {
  const perms = Array.isArray(resp.permissions) ? resp.permissions : [resp.permissions];
  const ids = new Set<string>();
  for (const p of perms) {
    for (const cfg of p?.permissionConfigs ?? []) {
      for (const ot of cfg.permissionOuterTiers ?? []) {
        const id = String(ot.outerTierId ?? ot.id ?? "");
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * Reconcile requested outer-tier IDs against the caller's permitted IDs — the
 * ID-based analogue of reconcileOuterTiers. Smart Inspect's runWidgets honors
 * `outerTierIds` (it ignores the name arrays), so this is the real store gate.
 */
export function reconcileOuterTierIds(
  allowed: Set<string>,
  requested: Array<string | number> | undefined
): Array<string | number> {
  if (!requested || requested.length === 0) return [...allowed];
  const denied = requested.filter((id) => !allowed.has(String(id)));
  if (denied.length > 0) {
    throw Object.assign(new Error(`Forbidden store(s): ${denied.join(", ")}`), {
      statusCode: 403,
    });
  }
  return requested;
}

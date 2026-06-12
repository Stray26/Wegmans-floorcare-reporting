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

/* ----------------------------- permissions ----------------------------- */

interface PermOuterTier {
  id: number | string;
  name: string;
  outerTierId: number | string;
}
interface PermConfig {
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

import * as React from "react";
import { useSession } from "@/context/SessionContext";

/**
 * Portal authentication state.
 *
 * Live mode: identity comes from /api/auth/me (the session cookie holds the
 * user's Smart Inspect SIQ-0 token server-side — the browser only ever sees
 * this safe profile). Demo mode: auth is bypassed entirely so the Live/Demo
 * toggle and `npm run dev` (no /api functions) keep working.
 *
 * Must be nested inside <SessionProvider>: it reads `demoData` reactively so
 * flipping the runtime Live/Demo toggle re-evaluates authentication.
 */

export interface PortalUser {
  memberId: number;
  companyId: number;
  /** Smart Inspect role for this company, e.g. "Operator" | "Supervisor" | "Account". */
  roleId: string;
  displayName: string;
  email: string;
  permissionLevels: Record<string, boolean | number>;
  /** Report-admin: may configure scheduled-report recipients + cadence. */
  isAdmin?: boolean;
}

interface AuthContextValue {
  user: PortalUser | null;
  /** true while an identity check is in flight (live mode only). */
  isLoading: boolean;
  /** Authenticated, or in demo mode (where auth doesn't apply). */
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { demoData } = useSession();
  const [user, setUser] = React.useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(!demoData);
  // Avoid re-fetching /me on every render; re-check when live mode (re)activates.
  const checkedRef = React.useRef(false);

  React.useEffect(() => {
    if (demoData) return; // demo mode: no identity check needed
    if (user || checkedRef.current) return;
    checkedRef.current = true;
    setIsLoading(true);
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: PortalUser }).user ?? null : null))
      .catch(() => null)
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demoData, user]);

  const login = React.useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      user?: PortalUser;
      error?: string;
    };
    if (!res.ok || !data.user) {
      throw new Error(data.error ?? "Sign-in failed. Please try again.");
    }
    setUser(data.user);
  }, []);

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined
    );
    checkedRef.current = false;
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: demoData || user != null,
      login,
      logout,
    }),
    [user, isLoading, demoData, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

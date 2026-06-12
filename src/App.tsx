import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/context/AuthContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { LoginPage } from "@/pages/Login";
import { PortfolioOverview } from "@/pages/PortfolioOverview";
import { StoreManagerDashboard } from "@/pages/StoreManagerDashboard";
import { CustomDetailReport } from "@/pages/CustomDetailReport";
import { TicketsPage } from "@/pages/TicketsPage";
import { ScoreSettings } from "@/pages/ScoreSettings";

/** The home route for an access mode. Single-store users belong on Store Manager. */
function homeFor(accessMode: string): string {
  return accessMode === "store" ? "/my-store" : "/portfolio";
}

/** Land users on the right home based on their Smart Inspect access. */
function HomeRedirect() {
  const { accessMode, isLoading } = useSmartInspectPermissions();
  if (isLoading) return null;
  return <Navigate to={homeFor(accessMode)} replace />;
}

/**
 * Permission-aware route guard. The Portfolio dashboard is for multi-store
 * users only; a single-store user who reaches /portfolio (via deep link, a
 * stale URL, or the post-login redirect) is bounced to their store view.
 * Enforces access by permissions, not just by hiding nav links.
 */
function RequirePortfolioAccess({ children }: { children: ReactNode }) {
  const { accessMode, isLoading } = useSmartInspectPermissions();
  if (isLoading) return null;
  if (accessMode === "store") return <Navigate to="/my-store" replace />;
  return <>{children}</>;
}

/**
 * Gate everything behind sign-in in live mode. Demo mode bypasses auth
 * (isAuthenticated is true) so the Live/Demo toggle and `npm run dev` work
 * without a session.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand-900" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <PageShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route
          path="/portfolio"
          element={
            <RequirePortfolioAccess>
              <PortfolioOverview />
            </RequirePortfolioAccess>
          }
        />
        <Route path="/my-store" element={<StoreManagerDashboard />} />
        <Route path="/report" element={<CustomDetailReport />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/settings/scores" element={<ScoreSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

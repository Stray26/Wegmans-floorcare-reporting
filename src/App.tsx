import { Navigate, Route, Routes } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { PortfolioOverview } from "@/pages/PortfolioOverview";
import { StoreManagerDashboard } from "@/pages/StoreManagerDashboard";
import { ComingSoon } from "@/pages/ComingSoon";

/** Land users on the right home based on their Smart Inspect access. */
function HomeRedirect() {
  const { accessMode, isLoading } = useSmartInspectPermissions();
  if (isLoading) return null;
  return <Navigate to={accessMode === "store" ? "/my-store" : "/portfolio"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/portfolio" element={<PortfolioOverview />} />
        <Route path="/my-store" element={<StoreManagerDashboard />} />
        <Route
          path="/report"
          element={
            <ComingSoon
              title="Custom Detail Report"
              subtitle="4-level QSP drilldown — Configuration → Store → Area Type → Check"
            />
          }
        />
        <Route
          path="/tickets"
          element={
            <ComingSoon
              title="Tickets"
              subtitle="Smart Inspect ticket tracking and follow-up"
            />
          }
        />
        <Route
          path="/settings/scores"
          element={
            <ComingSoon
              title="Score Settings"
              subtitle="Configure QSP thresholds"
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

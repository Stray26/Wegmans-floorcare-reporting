import { Navigate, Route, Routes } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import { PortfolioOverview } from "@/pages/PortfolioOverview";
import { StoreManagerDashboard } from "@/pages/StoreManagerDashboard";
import { CustomDetailReport } from "@/pages/CustomDetailReport";
import { TicketsPage } from "@/pages/TicketsPage";
import { ScoreSettings } from "@/pages/ScoreSettings";

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
        <Route path="/report" element={<CustomDetailReport />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/settings/scores" element={<ScoreSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

// Design system (theme store must initialise before first render)
import './design/theme';
import { Toaster } from './ui';

/*
 * Every route is its own chunk, so the landing page doesn't download the
 * dashboard's three.js twin, recharts and module code up front (and vice versa).
 */
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));

// Feature modules
import ElectricDataCenterPage from './pages/ElectricDataCenterPage';
const IndoorEnvironmentPage = lazy(() => import('./pages/IndoorEnvironmentPage'));
const ExecutiveDashboardPage = lazy(() => import('./pages/ExecutiveDashboardPage'));
const RoiDashboardPage = lazy(() => import('./pages/RoiDashboardPage'));
const CarbonPage = lazy(() => import('./pages/CarbonPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

// Digital twin
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FloorDetailPage = lazy(() => import('./pages/FloorDetailPage'));
const ZoneDetailsPage = lazy(() => import('./pages/ZoneDetailsPage'));
const ReservationPage = lazy(() => import('./pages/ReservationPage'));

// Waste management module
const WasteLayout = lazy(() => import('./components/waste/WasteLayout'));
const WasteScanPage = lazy(() => import('./pages/WasteScanPage'));
const WasteDashboardPage = lazy(() => import('./pages/WasteDashboardPage'));
const WasteHistoryPage = lazy(() => import('./pages/WasteHistoryPage'));
const WasteActionsPage = lazy(() => import('./pages/WasteActionsPage'));
const WasteGreenREPage = lazy(() => import('./pages/WasteGreenREPage'));
const WasteSettingsPage = lazy(() => import('./pages/WasteSettingsPage'));

// Water management module
const WaterLayout = lazy(() => import('./components/water/WaterLayout'));
const WaterDashboardPage = lazy(() => import('./pages/WaterDashboardPage'));
const WaterAnalyticsPage = lazy(() => import('./pages/WaterAnalyticsPage'));
const WaterGreenREPage = lazy(() => import('./pages/WaterGreenREPage'));
const WaterRulesPage = lazy(() => import('./pages/WaterRulesPage'));

function LandingFallback() {
  return <div className="fixed inset-0" style={{ background: 'linear-gradient(180deg,#0a2430,#1d4c56 40%,#3f7f7a 60%,#0b2c31)' }} />;
}

/** Thin top progress bar while a route chunk loads (no full-page flash). */
function RouteFallback() {
  return (
    <div role="status" aria-label="Loading page" className="fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-[gg-route-load_1s_ease-in-out_infinite] bg-brand-500" />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('GoGreen UI ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-fg">
          <div className="max-w-lg w-full rounded-xl border border-line bg-surface-2 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500 font-bold text-lg">
              <span>⚠️ Application Render Notice</span>
            </div>
            <p className="text-sm text-muted">
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold text-sm cursor-pointer"
              >
                Reload View
              </button>
              <a
                href="/"
                className="px-4 py-2 rounded-lg border border-line bg-surface text-fg font-semibold text-sm hover:bg-surface-2"
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          {/* Home: the 3D waterfront landing page is the main dashboard; every module is one click away */}
          <Route path="/" element={<Suspense fallback={<LandingFallback />}><LandingPage /></Suspense>} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />

          {/* Living style guide for the GoGreen design system */}
          <Route path="/design" element={<DesignSystemPage />} />

          {/* Feature modules */}
          <Route path="/electric" element={<ElectricDataCenterPage />} />
          <Route path="/indoor" element={<IndoorEnvironmentPage />} />
          <Route path="/carbon" element={<CarbonPage />} />
          <Route path="/executive" element={<ExecutiveDashboardPage />} />
          <Route path="/financial-esg" element={<Navigate to="/executive" replace />} />
          <Route path="/roi" element={<Navigate to="/executive" replace />} />
          <Route path="/reports" element={<ExecutiveDashboardPage defaultTab="reports" />} />

          {/* Dedicated Scenario Demo Hub (3D Model & Fault Injection Showroom) */}
          <Route path="/digital-twin" element={<DashboardPage />} />
          <Route path="/twin" element={<Navigate to="/digital-twin" replace />} />
          <Route path="/floor/:floorId" element={<FloorDetailPage />} />
          <Route path="/zone/:zoneId" element={<ZoneDetailsPage />} />
          <Route path="/reservations" element={<ReservationPage />} />

          {/* Waste management */}
          <Route path="/waste" element={<WasteLayout />}>
            <Route index element={<WasteScanPage />} />
            <Route path="dashboard" element={<WasteDashboardPage />} />
            <Route path="history" element={<WasteHistoryPage />} />
            <Route path="actions" element={<WasteActionsPage />} />
            <Route path="greenre" element={<WasteGreenREPage />} />
            <Route path="settings" element={<WasteSettingsPage />} />
          </Route>

          {/* Water management */}
          <Route path="/water" element={<WaterLayout />}>
            <Route index element={<WaterDashboardPage />} />
            <Route path="analytics" element={<WaterAnalyticsPage />} />
            <Route path="greenre" element={<WaterGreenREPage />} />
            <Route path="rules" element={<WaterRulesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ErrorBoundary>
  );
}

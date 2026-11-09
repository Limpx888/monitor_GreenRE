import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

// Design system (theme store must initialise before first render)
import './design/theme';
import { Toaster } from './ui';
import { FirstVisitGate } from './features/landing/firstVisit';

/*
 * Every route is its own chunk, so the landing page doesn't download the
 * dashboard's three.js twin, recharts and module code up front (and vice versa).
 */
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));

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

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Product landing page: shown once to first-time visitors of `/`, always at /welcome */}
          <Route path="/welcome" element={<Suspense fallback={<LandingFallback />}><LandingPage /></Suspense>} />

          {/* Living style guide for the GoGreen design system */}
          <Route path="/design" element={<DesignSystemPage />} />

          {/* Digital twin */}
          <Route path="/" element={<FirstVisitGate><DashboardPage /></FirstVisitGate>} />
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
  );
}

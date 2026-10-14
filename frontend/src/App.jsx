import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import FloorDetailPage from './pages/FloorDetailPage';
import ReservationPage from './pages/ReservationPage';
import ZoneDetailsPage from './pages/ZoneDetailsPage'; // <-- 1. Import the new page

// Waste Management Module
import WasteLayout from './components/waste/WasteLayout';
import WasteScanPage from './pages/WasteScanPage';
import WasteDashboardPage from './pages/WasteDashboardPage';
import WasteHistoryPage from './pages/WasteHistoryPage';
import WasteActionsPage from './pages/WasteActionsPage';
import WasteGreenREPage from './pages/WasteGreenREPage';
import WasteSettingsPage from './pages/WasteSettingsPage';

// Water Management Module
import WaterLayout from './components/water/WaterLayout';
import WaterDashboardPage from './pages/WaterDashboardPage';
import WaterAnalyticsPage from './pages/WaterAnalyticsPage';
import WaterGreenREPage from './pages/WaterGreenREPage';
import WaterRulesPage from './pages/WaterRulesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing Digital Twin routes */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/floor/:floorId" element={<FloorDetailPage />} />

        {/* 2. Add the new Zone Details route here */}
        <Route path="/zone/:zoneId" element={<ZoneDetailsPage />} />

        <Route path="/reservations" element={<ReservationPage />} />

        {/* Waste Management routes */}
        <Route path="/waste" element={<WasteLayout />}>
          <Route index element={<WasteScanPage />} />
          <Route path="dashboard" element={<WasteDashboardPage />} />
          <Route path="history" element={<WasteHistoryPage />} />
          <Route path="actions" element={<WasteActionsPage />} />
          <Route path="greenre" element={<WasteGreenREPage />} />
          <Route path="settings" element={<WasteSettingsPage />} />
        </Route>

        {/* Water Management routes */}
        <Route path="/water" element={<WaterLayout />}>
          <Route index element={<WaterDashboardPage />} />
          <Route path="analytics" element={<WaterAnalyticsPage />} />
          <Route path="greenre" element={<WaterGreenREPage />} />
          <Route path="rules" element={<WaterRulesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
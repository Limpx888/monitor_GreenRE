import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import FloorDetailPage from './pages/FloorDetailPage';
import ReservationPage from './pages/ReservationPage';

// Waste Management Module
import WasteLayout from './components/waste/WasteLayout';
import WasteScanPage from './pages/WasteScanPage';
import WasteDashboardPage from './pages/WasteDashboardPage';
import WasteHistoryPage from './pages/WasteHistoryPage';
import WasteActionsPage from './pages/WasteActionsPage';
import WasteGreenREPage from './pages/WasteGreenREPage';
import WasteSettingsPage from './pages/WasteSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing Digital Twin routes */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/floor/:floorId" element={<FloorDetailPage />} />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

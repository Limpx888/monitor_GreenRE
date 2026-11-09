import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BarChart3, BookOpen, Building, Droplets } from 'lucide-react';
import { waterApi } from '../../api/waterApi';
import AppShell from '../../layouts/AppShell';
import { Badge, Button, NavTabs, Select, StatusPill } from '../../ui';

const NAV_ITEMS = [
  { to: '/water', icon: <Droplets className="size-4" />, label: 'Dashboard', end: true },
  { to: '/water/analytics', icon: <BarChart3 className="size-4" />, label: 'Trends & Analytics' },
  { to: '/water/greenre', icon: <Building className="size-4" />, label: 'GreenRE WE Audit' },
  { to: '/water/rules', icon: <BookOpen className="size-4" />, label: 'Standards & Rules' },
];

export default function WaterLayout() {
  const [buildings, setBuildings] = useState([]);
  const [activeBuilding, setActiveBuilding] = useState('');
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState(null);

  const loadBuildings = () => {
    setLoading(true);
    setConnError(null);
    waterApi.getBuildings()
      .then((res) => {
        const list = res.buildings || [];
        setBuildings(list);
        setConnError(null);
        if (list.length > 0) {
          const saved = localStorage.getItem('water_active_building');
          const matched = list.find((b) => b.building_name === saved);
          const initial = matched ? matched.building_name : (list.find((b) => b.building_name === 'Cora') || list[0]).building_name;
          setActiveBuilding(initial);
        }
      })
      .catch((err) => {
        console.error('Failed to load buildings:', err);
        setConnError(err.message || 'Cannot reach water backend on port 5000');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  // Continuous auto-retry every 3.5s while disconnected until backend is ready
  useEffect(() => {
    if (connError && buildings.length === 0) {
      const interval = setInterval(() => {
        loadBuildings();
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [connError, buildings.length]);

  const handleBuildingChange = (name) => {
    setActiveBuilding(name);
    localStorage.setItem('water_active_building', name);
  };

  const selectedBuildingData = buildings.find((b) => b.building_name === activeBuilding);

  return (
    <AppShell subnav={<NavTabs items={NAV_ITEMS} label="Water sections" className="-mb-px" />}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-fg">Water management</h1>
          <StatusPill tone={connError ? 'danger' : 'info'} pulse={!connError}>
            {connError ? 'Backend disconnected' : 'DuckDB active'}
          </StatusPill>
          <Badge tone="info">Water score 90 · Platinum</Badge>
        </div>
        {buildings.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            Building
            <Select value={activeBuilding} onChange={(e) => handleBuildingChange(e.target.value)} className="min-w-56">
              {buildings.map((b) => (
                <option key={`${b.site}_${b.building_name}`} value={b.building_name}>
                  {b.building_name} ({b.space_usage} · {b.site})
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {connError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-bg p-4">
          <div>
            <p className="font-bold text-danger">Water backend disconnected</p>
            <p className="mt-0.5 text-sm text-muted">
              Can't reach DuckDB at <code className="font-mono">/api/water</code>. Start the backend with <code className="font-mono">npm run backend</code>. Retrying automatically.
            </p>
          </div>
          <Button variant="danger" size="sm" loading={loading} onClick={loadBuildings}>Retry now</Button>
        </div>
      )}

      {/* Legacy water pages are styled for a light surface; they get a light island until migrated */}
      <div data-theme="light" className="water-theme-container min-h-[65vh] rounded-xl border border-line bg-surface p-4 text-fg shadow-sm sm:p-6">
        <Outlet context={{ activeBuilding, setActiveBuilding, selectedBuildingData, buildings, loading, connError, retryConnect: loadBuildings }} />
      </div>
    </AppShell>
  );
}

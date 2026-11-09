import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Building, Camera, History, LayoutDashboard, Recycle, Settings } from 'lucide-react';
import { authApi } from '../../api/wasteApi';
import AppShell from '../../layouts/AppShell';
import { Badge, NavTabs, Select, StatusPill } from '../../ui';

const NAV_ITEMS = [
  { to: '/waste', icon: <Camera className="size-4" />, label: 'Scan', end: true },
  { to: '/waste/dashboard', icon: <LayoutDashboard className="size-4" />, label: 'Dashboard' },
  { to: '/waste/history', icon: <History className="size-4" />, label: 'History' },
  { to: '/waste/actions', icon: <Recycle className="size-4" />, label: '3R Actions' },
  { to: '/waste/greenre', icon: <Building className="size-4" />, label: 'GreenRE' },
  { to: '/waste/settings', icon: <Settings className="size-4" />, label: 'Settings' },
];

export default function WasteLayout() {
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState('');

  useEffect(() => {
    authApi.me().then(u => {
      setUser(u);
      return authApi.sites();
    }).then(s => {
      setSites(s);
      if (s.length > 0) {
        const saved = localStorage.getItem('waste_active_site');
        const siteId = saved && s.find(x => x.id === saved) ? saved : s[0].id;
        setActiveSite(siteId);
        localStorage.setItem('waste_active_site', siteId);
      }
    }).catch(() => {
      /* demo mode — will auto-login */
    });
  }, []);

  return (
    <AppShell subnav={<NavTabs items={NAV_ITEMS} label="Waste sections" className="-mb-px" />}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-fg">Waste management</h1>
          <StatusPill tone="success" pulse>System active</StatusPill>
          <Badge tone="warning">Score 88.4 · Gold</Badge>
        </div>
        {sites.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            Site
            <Select
              value={activeSite}
              onChange={(e) => {
                setActiveSite(e.target.value);
                localStorage.setItem('waste_active_site', e.target.value);
              }}
              className="min-w-48"
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </label>
        )}
      </div>

      {/* Legacy waste pages are styled for a light surface; they get a light island until migrated */}
      <div data-theme="light" className="waste-theme-container min-h-[60vh] rounded-xl border border-line bg-surface p-4 text-fg shadow-sm sm:p-6">
        <Outlet context={{ activeSite, sites, user }} />
      </div>
    </AppShell>
  );
}

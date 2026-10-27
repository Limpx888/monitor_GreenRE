import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/wasteApi';

const NAV_ITEMS = [
  { to: '/waste', icon: '📸', label: 'Scan', end: true },
  { to: '/waste/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/waste/history', icon: '📋', label: 'History' },
  { to: '/waste/actions', icon: '♻️', label: '3R Actions' },
  { to: '/waste/greenre', icon: '🏢', label: 'GreenRE' },
  { to: '/waste/settings', icon: '⚙️', label: 'Settings' },
];

export default function WasteLayout() {
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState('');
  const navigate = useNavigate();

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
    <div className="dashboard">
      {/* Hero Section (Top Bar) matching Dashboard */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/gogreen-logo.jpg" alt="GoGreen" style={{ height: '38px', width: '38px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <div className="system-title">GoGreen</div>
            <div className="system-subtitle">The Light City Penang · AI Waste Management</div>
          </div>
        </div>
        <div className="top-bar-actions">
          <div className="status-pill">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot"></span>
              <span style={{ color: '#475569' }}>System Active</span>
            </span>
            <span className="divider-v"></span>
            <span className="score-badge">Score: 88.4 (Gold)</span>
          </div>

          {/* Site Selector embedded in header */}
          <div style={{ display: 'flex', pointerEvents: 'auto' }}>
            {sites.length > 0 && (
              <select 
                value={activeSite} 
                onChange={(e) => {
                  setActiveSite(e.target.value);
                  localStorage.setItem('waste_active_site', e.target.value);
                }}
                className="btn-evidence"
                style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.9)', color: '#0f766e', border: '1px solid #ccfbf1', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold' }}
              >
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area (No tower, centered UI) */}
      <div style={{ position: 'absolute', top: '100px', left: 0, right: 0, bottom: '60px', overflowY: 'auto', padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1400px', pointerEvents: 'auto' }}>
          
          {/* Sub-navigation for Waste modules */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px', justifyContent: 'center' }}>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  background: isActive ? '#0f766e' : 'rgba(255, 255, 255, 0.95)',
                  color: isActive ? 'white' : '#64748b',
                  border: '1px solid',
                  borderColor: isActive ? '#0f766e' : '#e2e8f0',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                })}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Injected Waste Pages Wrapper for Dark Theme inheritance since waste pages use dark CSS classes by default */}
          <div className="waste-theme-container" style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', minHeight: '60vh', color: '#0f172a' }}>
            <Outlet context={{ activeSite, sites, user }} />
          </div>
        </div>
      </div>

      {/* Segmented Bottom Tabs (Same as Dashboard) */}
      <div className="bottom-pills" style={{ pointerEvents: 'auto' }}>
        {['Dashboard', 'Reserve Management', 'Waste Management', 'Water Management'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pill-btn ${tab === 'Waste Management' ? 'active' : 'inactive'}`}
            onClick={() => {
              if (tab === 'Dashboard') navigate('/');
              else if (tab === 'Reserve Management') navigate('/reservations');
              else if (tab === 'Water Management') navigate('/water');
            }}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

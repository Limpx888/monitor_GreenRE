import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { waterApi } from '../../api/waterApi';

const NAV_ITEMS = [
  { to: '/water', icon: '💧', label: 'Dashboard', end: true },
  { to: '/water/analytics', icon: '📈', label: 'Trends & Analytics' },
  { to: '/water/greenre', icon: '🏢', label: 'GreenRE WE Audit' },
  { to: '/water/rules', icon: '📜', label: 'Standards & Rules' },
];

export default function WaterLayout() {
  const [buildings, setBuildings] = useState([]);
  const [activeBuilding, setActiveBuilding] = useState('');
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState(null);
  const navigate = useNavigate();

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
    <div className="dashboard">
      {/* Top Bar matching Digital Twin and Waste modules */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/gogreen-logo.jpg" alt="GoGreen" style={{ height: '38px', width: '38px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <div className="system-title">GoGreen</div>
            <div className="system-subtitle">The Light City Penang · AI Water & Flow Management</div>
          </div>
        </div>
        <div className="top-bar-actions">
          <div className="status-pill">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot" style={{ background: connError ? '#ef4444' : '#0284c7' }}></span>
              <span style={{ color: connError ? '#dc2626' : '#0369a1', fontWeight: 700 }}>
                {connError ? 'Backend Disconnected' : 'DuckDB Active (20.6M)'}
              </span>
            </span>
            <span className="divider-v"></span>
            <span className="score-badge" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
              Water Score: 90 (Platinum)
            </span>
          </div>

          {/* Building Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>BUILDING:</span>
            <select
              value={activeBuilding}
              onChange={(e) => handleBuildingChange(e.target.value)}
              className="btn-evidence"
              style={{
                appearance: 'none',
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#0369a1',
                border: '1px solid #7dd3fc',
                padding: '6px 16px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {buildings.map((b) => (
                <option key={`${b.site}_${b.building_name}`} value={b.building_name}>
                  {b.building_name} ({b.space_usage} · {b.site})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          position: 'absolute',
          top: '90px',
          left: 0,
          right: 0,
          bottom: '60px',
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: '1400px', pointerEvents: 'auto' }}>
          {/* Sub-navigation for Water modules */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px',
              overflowX: 'auto',
              paddingBottom: '8px',
              justifyContent: 'center',
            }}
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  background: isActive ? '#0284c7' : 'rgba(255, 255, 255, 0.95)',
                  color: isActive ? 'white' : '#64748b',
                  border: '1px solid',
                  borderColor: isActive ? '#0284c7' : '#e2e8f0',
                  boxShadow: isActive ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                  padding: '8px 22px',
                  borderRadius: '20px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                })}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Connection Error Banner */}
          {connError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '14px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.9rem' }}>
                    Water Backend Disconnected
                  </div>
                  <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '2px' }}>
                    Unable to query DuckDB at <code>http://127.0.0.1:5000/api/water</code>. Ensure the backend is running via <code>npm run backend</code>.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={loadBuildings}
                disabled={loading}
                style={{
                  background: loading ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
              >
                {loading ? '⏳ Connecting...' : '🔄 Retry Connection'}
              </button>
            </div>
          )}

          {/* Module Content Container */}
          <div
            className="water-theme-container"
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
              minHeight: '65vh',
              color: '#0f172a',
            }}
          >
            <Outlet context={{ activeBuilding, setActiveBuilding, selectedBuildingData, buildings, loading, connError, retryConnect: loadBuildings }} />
          </div>
        </div>
      </div>

      {/* Segmented Bottom Tabs */}
      <div className="bottom-pills" style={{ pointerEvents: 'auto' }}>
        {['Dashboard', 'Reserve Management', 'Waste Management', 'Water Management'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pill-btn ${tab === 'Water Management' ? 'active' : 'inactive'}`}
            onClick={() => {
              if (tab === 'Dashboard') navigate('/');
              else if (tab === 'Reserve Management') navigate('/reservations');
              else if (tab === 'Waste Management') navigate('/waste');
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

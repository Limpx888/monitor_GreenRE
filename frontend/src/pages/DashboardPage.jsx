import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CssTower from '../components/CssTower';
import BuildingScene from '../components/BuildingScene';
import FloorLabels from '../components/FloorLabels';
import { ZONES } from '../data/zones';

export default function DashboardPage() {
  const [selectedZone, setSelectedZone] = useState('zone-c');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [glFailed, setGlFailed] = useState(false);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [weatherData, setWeatherData] = useState({ temp: 24, humidity: 78, emoji: '☀️', forecast: [] });
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const tooltipRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const handleBuildingHover = useCallback((info) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    if (info) {
      setHoveredZone((prev) => {
        // If we already have a tooltip hovered, don't update its position if it's the same zone
        // to avoid it jumping away from the cursor.
        if (prev && prev.zoneId === info.zoneId && tooltipRef.current && tooltipRef.current.matches(':hover')) {
          return prev;
        }
        
        // Position tooltip near cursor
        if (tooltipRef.current) {
          const pad = 16;
          const tt = tooltipRef.current;
          const maxX = window.innerWidth - tt.offsetWidth - pad;
          const maxY = window.innerHeight - tt.offsetHeight - pad;
          tt.style.left = `${Math.min(info.x + pad, maxX)}px`;
          tt.style.top = `${Math.min(info.y + pad, maxY)}px`;
        }
        return info;
      });
    } else {
      // Small delay before hiding to allow moving mouse into the tooltip
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredZone(null);
      }, 150);
    }
  }, []);

  const barData = [40, 55, 30, 45, 70, 85, 60, 50, 40, 30, 45, 65];

  const applyRemediation = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId: selectedZone, telemetryData: { energy: 310 } }),
      });
      const data = await res.json();
      alert(data.recommendation || data.message);
    } catch (e) {
      alert('Backend not connected: ' + e.message);
    }
  };

  useEffect(() => {
    // Fetch live weather data on mount
    fetch('http://localhost:5000/api/weather')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setWeatherData({
            temp: Math.round(data.temperature),
            humidity: Math.round(data.humidity),
            emoji: data.emoji,
            forecast: data.forecast || []
          });
        }
      })
      .catch(err => console.error('Error fetching weather:', err));
  }, []);

  return (
    <div className="dashboard">
      <div className="canvas-container">
        {glFailed && (
          <CssTower selectedZone={selectedZone} onSelect={setSelectedZone} />
        )}
        <div className={`webgl-overlay ${glFailed ? 'is-hidden' : 'is-active'}`}>
          <ErrorBoundaryCanvas onError={() => setGlFailed(true)}>
            <BuildingScene
              selectedZone={selectedZone}
              onSelect={setSelectedZone}
              onFail={() => setGlFailed(true)}
              onHover={handleBuildingHover}
            />
          </ErrorBoundaryCanvas>
        </div>

        <FloorLabels
          selectedZone={selectedZone}
          onHoverZone={(zoneId) => {
            if (zoneId) setSelectedZone(zoneId);
          }}
        />

        {!glFailed && (
          <div className="zone-float-card">
            {(() => {
              const z = ZONES.find((x) => x.id === selectedZone);
              if (!z) return null;
              return (
                <>
                  <div className="zone-float-top">
                    <strong>{z.name}</strong>
                    <span className={z.status === 'warn' ? 'badge-warn' : 'badge-ok'}>
                      {z.status === 'warn' ? 'GAP' : 'OK'}
                    </span>
                  </div>
                  <div className="zone-float-floors">{z.floors}</div>
                  <div className="zone-float-energy">
                    <span>Energy Load</span>
                    <b>{z.energy}</b>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Hover tooltip for 3D building zones */}
        {!glFailed && hoveredZone && (
          <div
            ref={tooltipRef}
            className="building-hover-tooltip interactive"
            style={{
              left: hoveredZone.x + 16,
              top: hoveredZone.y + 16,
            }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              hoverTimeoutRef.current = setTimeout(() => {
                setHoveredZone(null);
              }, 150);
            }}
            onClick={() => {
              if (hoveredZone.floorId) {
                navigate(`/floor/${hoveredZone.floorId}`);
              }
            }}
          >
            <div className="bht-header">
              <span
                className="bht-dot"
                style={{ background: hoveredZone.color }}
              />
              <span className="bht-name">{hoveredZone.name}</span>
              <span
                className={`bht-badge ${
                  hoveredZone.status === 'warn' ? 'warn' : 'ok'
                }`}
              >
                {hoveredZone.status === 'warn' ? 'GAP' : 'OK'}
              </span>
            </div>
            <div className="bht-floors-label">{hoveredZone.floors}</div>
            {hoveredZone.floorDetails?.length > 0 && (
              <ul className="bht-floor-list">
                {hoveredZone.floorDetails.map((f, i) => (
                  <li key={i}>
                    <span className="bht-fl-code">{f.label}</span>
                    <span className="bht-fl-desc">{f.description}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="bht-energy">
              <span>Energy Load</span>
              <b>{hoveredZone.energy}</b>
            </div>
            <div className="bht-click-hint">Click to explore →</div>
          </div>
        )}
      </div>

      <div className="top-bar">
        <div>
          <div className="system-title">GreenRE Smart Operation System</div>
          <div className="system-subtitle">The Light City Penang · Continuous Monitoring</div>
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
          <button className="btn-evidence" type="button">
            Prepare Evidence
          </button>
        </div>
      </div>

      <div className="left-panel">
        {activeTab === 'Waste Management' ? (
          <>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Smart Bin Diagnostics</div>
                  <span className="ai-badge">YOLO VISION + MATH</span>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                YOLO is used for object detection and classification, while image-based size estimation and geometric calculations are used to estimate the volumetric proportions of waste categories.
              </div>
              <div className="metrics-grid" style={{ gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.4)', paddingBottom: '4px' }}>
                  <span className="metric-label">Plastic bottles</span>
                  <span className="metric-value" style={{ fontSize: '0.9rem' }}>2.5 L</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.4)', paddingBottom: '4px' }}>
                  <span className="metric-label">Cans</span>
                  <span className="metric-value" style={{ fontSize: '0.9rem' }}>1.0 L</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.4)', paddingBottom: '4px' }}>
                  <span className="metric-label">Cardboard</span>
                  <span className="metric-value" style={{ fontSize: '0.9rem' }}>1.5 L</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.4)', paddingBottom: '4px' }}>
                  <span className="metric-label">Food waste</span>
                  <span className="metric-value alert" style={{ fontSize: '0.9rem', color: '#f59e0b' }}>2.0 L</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="metric-label">Other waste</span>
                  <span className="metric-value alert" style={{ fontSize: '0.9rem', color: '#f59e0b' }}>1.0 L</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '2px solid #e2e8f0' }}>
                  <b className="metric-label" style={{ color: '#0f172a' }}>Total Estimated Volume</b>
                  <b className="metric-value" style={{ fontSize: '1rem', color: '#0f172a' }}>8.0 L</b>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <div className="card-title">Recyclable Volume Ratio</div>
                <span className="btn-details">AI</span>
              </div>
              <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Estimated Recyclable</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>62.5%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill green" style={{ height: '100%', width: '62.5%', background: '#10b981' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Estimated General/Organic</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>37.5%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill warn" style={{ height: '100%', width: '37.5%', background: '#f59e0b' }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Compliance Overview</div>
                  <span className="ai-badge">GREENRE STATUS</span>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span className="big-metric">88.4</span>
                <span className="metric-unit">/ 100</span>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Next Renewal: <b>45 Days</b>
                </div>
              </div>
              <div className="metrics-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div className="metric-label">EE (Energy)</div>
                  <div className="metric-value green" style={{ fontSize: '1rem' }}>🟢 Met</div>
                </div>
                <div>
                  <div className="metric-label">WE (Water)</div>
                  <div className="metric-value warn" style={{ fontSize: '1rem', color: '#eab308' }}>🟡 Partial</div>
                </div>
                <div>
                  <div className="metric-label">IEQ (Indoor Air)</div>
                  <div className="metric-value green" style={{ fontSize: '1rem' }}>🟢 Met</div>
                </div>
                <div>
                  <div className="metric-label">SM-EP (Evidence)</div>
                  <div className="metric-value alert" style={{ fontSize: '1rem', color: '#ef4444' }}>🔴 Gap Found</div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => setShowWeatherModal(true)}>
              <div className="card-header">
                <div className="card-title">Weather</div>
                <span className="btn-details">Details</span>
              </div>
              <div className="weather-row">
                <span style={{ fontSize: '1.3rem' }}>{weatherData.emoji}</span>
                <span className="temp-big">{weatherData.temp}°C</span>
                <span className="weather-tag">HUMIDITY {weatherData.humidity}%</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <div className="card-title">Early Warnings</div>
                <span className="btn-details">View All</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Chiller Maintenance Log</div>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Expires in 12 days</div>
                  </div>
                  <span className="badge-warn">ACTION</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Water Meter Calibration</div>
                    <div style={{ fontSize: '0.75rem', color: '#eab308' }}>Due in 30 days</div>
                  </div>
                  <span className="badge-warn" style={{ background: '#fef08a', color: '#854d0e', borderColor: '#fde047' }}>WARN</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>IAQ Test Report</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Valid (210 days left)</div>
                  </div>
                  <span className="badge-ok">OK</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="right-panel">
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="copilot-header">
            <div className="copilot-icon">🧠</div>
            <div>
              <div className="copilot-title">AI Gap Identification</div>
              <div className="copilot-sub">Evidence & Anomaly Tracking</div>
            </div>
          </div>

          <div className="alert-box">
            <div className="alert-accent" />
            <div className="alert-content">
              <span className="alert-icon">⚠️</span>
              <div>
                <div className="alert-title">Non-compliant Trend (WE-1)</div>
                <div className="alert-desc">
                  Night-time water baseline flow detected at 50 LPM. Possible leak. No recent inspection evidence found in RAG index.
                </div>
              </div>
            </div>
          </div>

          <div className="reco-box">
            <div className="reco-header">
              <span className="reco-label">Action Recommendation</span>
              <span className="reco-tag">TEAMS APPROVAL</span>
            </div>
            <div className="reco-text" style={{ fontSize: '0.85rem' }}>
              <b>Owner:</b> Facility Manager<br/>
              <b>Action:</b> Dispatch inspection for Zone C water mains and upload maintenance evidence pack.<br/>
              <b>Priority:</b> High
            </div>
          </div>

          <button onClick={applyRemediation} className="btn-remediation" type="button">
            Approve Action in Teams
          </button>

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}
            >
              Building Zones
            </div>
            <div className="zone-list">
              {ZONES.map((z) => (
                <div
                  key={z.id}
                  className={`zone-item ${selectedZone === z.id ? 'selected' : ''}`}
                  onClick={() => setSelectedZone(z.id)}
                >
                  <div>
                    <div className="zone-name">{z.name}</div>
                    <div className="zone-floors">{z.floors}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="zone-energy">{z.energy}</span>
                    <span className={`zone-status-dot ${z.status === 'warn' ? 'warn' : 'ok'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-pills">
        {['Dashboard', 'Reserve Management', 'Waste Management', 'CE'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pill-btn ${activeTab === tab ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {showWeatherModal && (
        <div className="weather-modal-overlay" onClick={() => setShowWeatherModal(false)}>
          <div className="weather-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="weather-modal-header">
              <h2>Hourly Forecast</h2>
              <button className="weather-modal-close" onClick={() => setShowWeatherModal(false)}>✕</button>
            </div>
            
            <div className="weather-hourly-list">
              {weatherData.forecast && weatherData.forecast.length > 0 ? (
                weatherData.forecast.map((hour, idx) => (
                  <div key={idx} className="weather-hourly-item">
                    <span className="wh-time">{hour.time}</span>
                    <span className="wh-emoji">{hour.emoji}</span>
                    <span className="wh-temp">{hour.temp}°C</span>
                    <span className="wh-rain">{hour.rainProb > 0 ? `🌧️ ${hour.rainProb}%` : ''}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                  No forecast data available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

class ErrorBoundaryCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error('3D Canvas Error:', err);
    this.props.onError?.();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

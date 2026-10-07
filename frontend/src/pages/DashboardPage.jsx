import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CssTower from '../components/CssTower';
import BuildingScene from '../components/BuildingScene';
import FloorLabels from '../components/FloorLabels';
import { ZONES } from '../data/zones';

export default function DashboardPage() {
  const [selectedZone, setSelectedZone] = useState('zone-c');
  const [activeTab, setActiveTab] = useState('EE');
  const [glFailed, setGlFailed] = useState(false);
  const [hoveredZone, setHoveredZone] = useState(null);
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
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Predicted Load Tomorrow</div>
              <span className="ai-badge">AI FORECAST</span>
            </div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <span className="big-metric">48.63</span>
            <span className="metric-unit">kWh</span>
          </div>
          <div className="bar-chart">
            {barData.map((val, i) => (
              <div key={i} className="bar-bg">
                <div className={`bar-fill ${i === 5 ? 'alert' : 'normal'}`} style={{ height: `${val}%` }} />
              </div>
            ))}
          </div>
          <div className="chart-labels">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="card-header">
            <div className="card-title">Weather</div>
            <span className="btn-details">Details</span>
          </div>
          <div className="weather-row">
            <span style={{ fontSize: '1.3rem' }}>☀️</span>
            <span className="temp-big">24°C</span>
            <span className="weather-tag">HUMIDITY 78%</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="card-header">
            <div className="card-title">Energy Storage System</div>
            <span className="btn-details">Details</span>
          </div>
          <div className="metrics-grid">
            <div>
              <div className="metric-label">Storage Energy Load</div>
              <div className="metric-value">
                20.05<span className="metric-sm-unit">kWh</span>
              </div>
            </div>
            <div>
              <div className="metric-label">Renewable Retention Load</div>
              <div className="metric-value green">
                12.80<span className="metric-sm-unit">kWh</span>
              </div>
            </div>
            <div>
              <div className="metric-label">On-Site The Load</div>
              <div className="metric-value">
                7.21<span className="metric-sm-unit">kWh</span>
              </div>
            </div>
            <div>
              <div className="metric-label">Flexible Regulation Power</div>
              <div className="metric-value green">
                48.1<span className="metric-sm-unit">kWh</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="right-panel">
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="copilot-header">
            <div className="copilot-icon">⚡</div>
            <div>
              <div className="copilot-title">GreenRE Copilot</div>
              <div className="copilot-sub">AI Gap Analysis</div>
            </div>
          </div>

          <div className="alert-box">
            <div className="alert-accent" />
            <div className="alert-content">
              <span className="alert-icon">⚠️</span>
              <div>
                <div className="alert-title">High Load Detected — Zone C</div>
                <div className="alert-desc">
                  Offices (L4–L12) off-hour HVAC consumption exceeds GreenRE baseline by 18%.
                </div>
              </div>
            </div>
          </div>

          <div className="reco-box">
            <div className="reco-header">
              <span className="reco-label">AI Recommendation</span>
              <span className="reco-tag">AUTO-FIX READY</span>
            </div>
            <div className="reco-text">
              Re-align BMS AHU setback schedules for office floors L4–L12 past 19:00.
            </div>
          </div>

          <button onClick={applyRemediation} className="btn-remediation" type="button">
            Apply Remediation
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
        {['EE', 'WE', 'IEQ', 'CE'].map((tab) => (
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

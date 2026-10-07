import React, { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================
// 3D BUILDING ZONE COMPONENT
// ============================
const ZONES = [
  { id: 'zone-a', name: 'M&E Plant', floors: 'B2–LG', y: 0.4, h: 0.8, w: 4.5, d: 3.5, color: '#e2e8f0', energy: '92 kWh', status: 'ok' },
  { id: 'zone-b', name: 'Podium', floors: 'GF–L3', y: 1.5, h: 1.2, w: 4.2, d: 3.2, color: '#cbd5e1', energy: '185 kWh', status: 'ok' },
  { id: 'zone-c', name: 'Offices', floors: 'L4–L12', y: 3.2, h: 2.0, w: 3.2, d: 2.4, color: '#99f6e4', energy: '310 kWh', status: 'warn' },
  { id: 'zone-d', name: 'Hyatt Hotel', floors: 'L14–L28', y: 5.8, h: 3.0, w: 3.0, d: 2.2, color: '#e2e8f0', energy: '420 kWh', status: 'ok' },
  { id: 'zone-e', name: 'Amenities', floors: 'L29–L31', y: 7.6, h: 0.6, w: 2.8, d: 2.0, color: '#cbd5e1', energy: '140 kWh', status: 'ok' },
];

function BuildingZone({ zone, isSelected, onSelect }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const target = isSelected ? 0.95 : hovered ? 0.88 : 0.78;
      meshRef.current.material.opacity += (target - meshRef.current.material.opacity) * 0.1;
    }
  });

  return (
    <group position={[0, zone.y, 0]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        onClick={(e) => { e.stopPropagation(); onSelect(zone.id); }}
      >
        <boxGeometry args={[zone.w, zone.h, zone.d]} />
        <meshPhysicalMaterial
          color={isSelected ? '#0f766e' : hovered ? '#14b8a6' : zone.color}
          transparent
          opacity={0.78}
          roughness={0.15}
          metalness={0.05}
          clearcoat={0.8}
        />
      </mesh>
      {/* Wireframe edge */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(zone.w, zone.h, zone.d)]} />
        <lineBasicMaterial color={isSelected ? '#ffffff' : '#94a3b8'} opacity={isSelected ? 0.6 : 0.25} transparent />
      </lineSegments>

      {/* Floating label */}
      <Html position={[zone.w / 2 + 1.2, 0, 0]} distanceFactor={15} center zIndexRange={[10, 0]}>
        <div style={{
          display: hovered || isSelected ? 'block' : 'none',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          padding: '12px 16px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid rgba(204,251,241,0.5)',
          width: '180px',
          fontFamily: 'Inter, system-ui, sans-serif',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '12px', color: '#1e293b' }}>{zone.name}</span>
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px',
              background: zone.status === 'warn' ? '#fff1f2' : '#f0fdfa',
              color: zone.status === 'warn' ? '#e11d48' : '#0d9488',
              border: `1px solid ${zone.status === 'warn' ? '#fecdd3' : '#99f6e4'}`,
            }}>
              {zone.status === 'warn' ? 'WARNING' : 'NORMAL'}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{zone.floors}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Energy Load</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{zone.energy}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

function TowerModel({ selectedZone, onSelect }) {
  const groupRef = useRef();
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[0, -2, 0]}>
      {ZONES.map(zone => (
        <BuildingZone key={zone.id} zone={zone} isSelected={selectedZone === zone.id} onSelect={onSelect} />
      ))}
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#e2e8f0" opacity={0.3} transparent />
      </mesh>
    </group>
  );
}

function Scene3D({ selectedZone, onSelect }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [20, 20, 20], zoom: 45, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#f0f4f8']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[15, 25, 15]} intensity={1.5} />
      <pointLight position={[-10, 10, -10]} intensity={0.4} />
      <Suspense fallback={null}>
        <TowerModel selectedZone={selectedZone} onSelect={onSelect} />
      </Suspense>
      <OrbitControls enableZoom enablePan minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}

// ============================
// MAIN DASHBOARD APP
// ============================
function App() {
  const [selectedZone, setSelectedZone] = useState('zone-c');
  const [activeTab, setActiveTab] = useState('EE');
  const [sceneError, setSceneError] = useState(false);

  const barData = [40, 55, 30, 45, 70, 85, 60, 50, 40, 30, 45, 65];

  const applyRemediation = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId: selectedZone, telemetryData: { energy: 310 } })
      });
      const data = await res.json();
      alert(data.recommendation || data.message);
    } catch (e) {
      alert("Backend not connected: " + e.message);
    }
  };

  return (
    <div className="dashboard">

      {/* ===== 3D CANVAS ===== */}
      <div className="canvas-container">
        {!sceneError ? (
          <ErrorBoundaryCanvas onError={() => setSceneError(true)}>
            <Scene3D selectedZone={selectedZone} onSelect={setSelectedZone} />
          </ErrorBoundaryCanvas>
        ) : (
          <div className="canvas-fallback">
            <BuildingFallbackSVG />
          </div>
        )}
      </div>

      {/* ===== TOP BAR ===== */}
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
          <button className="btn-evidence">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Prepare Evidence
          </button>
        </div>
      </div>

      {/* ===== LEFT PANEL ===== */}
      <div className="left-panel">
        {/* Energy Forecast */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Predicted Load Tomorrow</div>
              <span className="ai-badge">AI FORECAST</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <span className="big-metric">48.63</span>
            <span className="metric-unit">kWh</span>
          </div>
          <div className="bar-chart">
            {barData.map((val, i) => (
              <div key={i} className="bar-bg">
                <div className={`bar-fill ${i === 5 ? 'alert' : 'normal'}`} style={{ height: `${val}%` }}></div>
              </div>
            ))}
          </div>
          <div className="chart-labels"><span>00:00</span><span>12:00</span><span>24:00</span></div>
        </div>

        {/* Weather */}
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
          <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 500, marginTop: '6px' }}>South Zürich conditions · last updated 3m ago</div>
        </div>

        {/* Water / Energy Storage */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="card-header">
            <div className="card-title">Energy Storage System</div>
            <span className="btn-details">Details</span>
          </div>
          <div className="metrics-grid">
            <div>
              <div className="metric-label">Storage Energy Load</div>
              <div className="metric-value">20.05<span className="metric-sm-unit">kWh</span></div>
            </div>
            <div>
              <div className="metric-label">Renewable Retention Load</div>
              <div className="metric-value green">12.80<span className="metric-sm-unit">kWh</span></div>
            </div>
            <div>
              <div className="metric-label">On-Site The Load</div>
              <div className="metric-value">7.21<span className="metric-sm-unit">kWh</span></div>
            </div>
            <div>
              <div className="metric-label">Flexible Regulation Power</div>
              <div className="metric-value green">48.1<span className="metric-sm-unit">kWh</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="right-panel">
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="copilot-header">
            <div className="copilot-icon">⚡</div>
            <div>
              <div className="copilot-title">GreenRE Copilot</div>
              <div className="copilot-sub">AI Gap Analysis</div>
            </div>
          </div>

          {/* Alert */}
          <div className="alert-box">
            <div className="alert-accent"></div>
            <div className="alert-content">
              <span className="alert-icon">⚠️</span>
              <div>
                <div className="alert-title">High Load Detected — Zone C</div>
                <div className="alert-desc">
                  Offices (L4–L12) off-hour HVAC consumption exceeds GreenRE baseline by 18%.
                  Anomaly detected at 20:47 today. Stream Analytics flagged energy drift past setback window.
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="reco-box">
            <div className="reco-header">
              <span className="reco-label">AI Recommendation</span>
              <span className="reco-tag">AUTO-FIX READY</span>
            </div>
            <div className="reco-text">
              Re-align BMS air handling unit (AHU) setback schedules for commercial office floors L4–L12 past 19:00. 
              Estimated savings: 14.2 kWh/day (≈ 5,183 kWh/yr).
            </div>
            <div className="reco-cite">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              Cite: <span className="cite-ref">GreenRE EN-2.01 · Building Envelope & Lighting</span>
            </div>
          </div>

          <button onClick={applyRemediation} className="btn-remediation">
            Apply Remediation
          </button>

          {/* Zone List */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Building Zones</div>
            <div className="zone-list">
              {ZONES.map(z => (
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
                    <span className={`zone-status-dot ${z.status === 'warn' ? 'warn' : 'ok'}`}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM PILLS ===== */}
      <div className="bottom-pills">
        {['EE', 'WE', 'IEQ', 'CE'].map(tab => (
          <button
            key={tab}
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

// ============================
// ERROR BOUNDARY FOR 3D CANVAS
// ============================
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
    if (this.props.onError) this.props.onError();
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="canvas-fallback">
          <BuildingFallbackSVG />
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================
// SVG FALLBACK IF 3D FAILS
// ============================
function BuildingFallbackSVG() {
  return (
    <svg className="building-svg" width="400" height="500" viewBox="0 0 400 500">
      <rect x="130" y="380" width="140" height="40" rx="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1"/>
      <rect x="140" y="320" width="120" height="60" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1"/>
      <rect x="155" y="200" width="90" height="120" rx="4" fill="#ccfbf1" stroke="#5eead4" strokeWidth="1.5"/>
      <rect x="158" y="80" width="84" height="120" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1"/>
      <rect x="162" y="50" width="76" height="30" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1"/>
      <text x="200" y="470" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">The Light City Penang · Digital Twin</text>
    </svg>
  );
}

export default App;

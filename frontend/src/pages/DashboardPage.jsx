import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CssTower from '../components/CssTower';
import BuildingScene from '../components/BuildingScene';
import NilmChart from '../components/NilmChart';
import UtilityMainMeter from '../components/UtilityMainMeter';
import ZoneConsumptionCards from '../components/ZoneConsumptionCards';
import BmsTelemetryDrawer from '../components/BmsTelemetryDrawer';
import { downloadGreenReEvidence, useZoneConsumption } from '../hooks/useZoneConsumption';

export default function DashboardPage() {
  const [selectedZone, setSelectedZone] = useState('zone-d');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [glFailed, setGlFailed] = useState(false);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [isBmsDrawerOpen, setIsBmsDrawerOpen] = useState(false);
  const [bmsTelemetry, setBmsTelemetry] = useState(null);
  const [bmsLoading, setBmsLoading] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [remediationBusy, setRemediationBusy] = useState(false);
  const [remediationLog, setRemediationLog] = useState(null);
  const { data: liveConsumption, error: liveError, isLoading: liveLoading } = useZoneConsumption();
  const warningZoneCodes = (liveConsumption?.zones || [])
    .filter((zone) => zone.compliance_status === 'warning')
    .map((zone) => zone.code);

  // Step 1: Centralized Global "Time Machine" & NILM State (Single Source of Truth)

  // 1. 默认场景改为 nominal
  const [selectedScenario, setSelectedScenario] = useState('nominal');

  // 2. 默认时间改为 Live
  const [currentTime, setCurrentTime] = useState('Live');

  // 3. 默认天气改为正常晴天
  const [currentWeather, setCurrentWeather] = useState({
    temp: 28.4,
    humidity: 72,
    condition: 'Clear Sky (Nominal Operation)',
    emoji: '☀️',
    timestamp: new Date().toISOString(),
    forecast: [
      { time: '12:00', emoji: '☀️', temp: 28.5, rainProb: 5 },
      { time: '13:00', emoji: '☀️', temp: 29.0, rainProb: 5 },
      { time: '14:00', emoji: '☀️', temp: 29.2, rainProb: 5 },
      { time: '15:00', emoji: '☀️', temp: 28.8, rainProb: 5 },
      { time: '16:00', emoji: '⛅', temp: 28.0, rainProb: 10 },
      { time: '17:00', emoji: '⛅', temp: 27.5, rainProb: 10 },
    ],
  });

  // 4. Real-time NILM 4-zone disaggregation results 
  // (在 Live 模式下会被 useSWR 真实数据覆盖，设为 null 即可)
  const [nilmZones, setNilmZones] = useState(null);

  // 5. 默认合规状态改为 COMPLIANT (绿色无报警状态)
  const [complianceGap, setComplianceGap] = useState({
    detected: false,
    status_code: 'COMPLIANT',
    clause: 'EE-1',
    clause_title: 'Energy Efficiency Standard Met',
    attribution: 'NORMAL',
    anomaly_zone: null,
    anomaly_floor: null,
    measured_load: 45.2,
    baseline_load: 330.0,
    outdoor_temp: 28.4,
    deviation_pct: 0.0,
    severity: 'NOMINAL',
    explanation: 'Real-time telemetry stream synchronized. All building zones operating within GreenRE compliance bounds.',
    action_recommendation: 'Continuous IoT surveillance active across all 5 zones.',
  });

  const tooltipRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Instant reactive scenario switch synchronizing Left Weather, 3D Building, and Right Panel
  const handleScenarioChange = useCallback(async (scenario) => {
    setSelectedScenario(scenario);

    if (scenario === 'cool_night_gap') {
      setCurrentTime('03:00');
      setCurrentWeather({
        temp: 24.5,
        humidity: 82,
        condition: 'Cool Night (Overcast)',
        emoji: '🌙',
        timestamp: '2016-03-15 03:00:00',
        forecast: [
          { time: '01:00', emoji: '🌙', temp: 24.8, rainProb: 10 },
          { time: '02:00', emoji: '🌙', temp: 24.6, rainProb: 10 },
          { time: '03:00', emoji: '🌙', temp: 24.5, rainProb: 15 },
          { time: '04:00', emoji: '🌙', temp: 24.3, rainProb: 15 },
          { time: '05:00', emoji: '☁️', temp: 24.1, rainProb: 20 },
          { time: '06:00', emoji: '⛅', temp: 24.8, rainProb: 10 },
        ],
      });
      setNilmZones({
        total: 1007,
        hotel: 420,
        office: 120,
        podium: 90,
        me: 92,
      });

      // ⚠️ Dynamic variables extraction
      const dynamicFloor = 'L14';
      const dynamicTemp = 24.5;
      const dynamicMeasured = 420.0;
      const dynamicDevPct = 27.3;
      // Dynamically derive the asset name: L14 -> AHU-14A
      const targetAsset = `AHU-${dynamicFloor.replace('L', '')}A`;

      setComplianceGap({
        detected: true,
        status_code: 'EQUIPMENT_MALFUNCTION_GAP',
        clause: 'EE-1 / WE-1 / EQ-3',
        clause_title: 'Energy Efficiency & Night Damper Bypass Loss',
        attribution: 'EQUIPMENT_FAULT',
        anomaly_zone: 'zone-d',
        anomaly_floor: dynamicFloor,
        zone_name: 'Hyatt Hotel (L14–L28)',
        measured_load: dynamicMeasured,
        baseline_load: 330.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        threshold_pct: 20.0,
        severity: 'CRITICAL',
        // ⚠️ Dynamic Interpolation
        explanation: `Cross-modal AI diagnostic: Hotel Zone electrical load (+${dynamicDevPct}%) correlates with abnormal BMS telemetry on Floor ${dynamicFloor}. ${targetAsset} fan speed is at 85% RPM despite cool ${dynamicTemp}°C ambient air. THD voltage harmonics indicate motor stress.`,
        action_recommendation: `Target Asset: ${targetAsset} (Floor ${dynamicFloor}). Diagnosed mechanical fault: Fresh air damper actuator stuck open. Execute OT override to reset damper to 15% night setback.`,
      });

    } else if (scenario === 'tropical_heatwave') {
      setCurrentTime('03:00');
      setCurrentWeather({
        temp: 30.2,
        humidity: 68,
        condition: 'Tropical Heatwave (High Ambient)',
        emoji: '🌡️',
        timestamp: '2016-07-22 03:00:00',
        forecast: [
          { time: '01:00', emoji: '🌡️', temp: 30.6, rainProb: 0 },
          { time: '02:00', emoji: '🌡️', temp: 30.4, rainProb: 0 },
          { time: '03:00', emoji: '🌡️', temp: 30.2, rainProb: 0 },
          { time: '04:00', emoji: '🌡️', temp: 30.0, rainProb: 0 },
          { time: '05:00', emoji: '🌡️', temp: 29.8, rainProb: 0 },
          { time: '06:00', emoji: '☀️', temp: 30.5, rainProb: 0 },
        ],
      });
      setNilmZones({
        total: 1005,
        hotel: 415,
        office: 305,
        podium: 190,
        me: 95,
      });

      // ⚠️ Extract dynamic variables
      const dynamicTemp = 30.2;
      const dynamicMeasured = 415.0;
      const dynamicDevPct = 25.8;

      setComplianceGap({
        detected: false,
        status_code: 'WEATHER_DRIVEN_LOAD',
        clause: 'EE-1 (Weather Compensated)',
        clause_title: 'Weather-Driven Thermal Envelope Load',
        attribution: 'WEATHER_DRIVEN',
        anomaly_zone: null,
        anomaly_floor: null,
        measured_load: dynamicMeasured,
        baseline_load: 330.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        severity: 'NOMINAL_HIGH',
        explanation: `At 03:00 AM, elevated power (${dynamicMeasured} kW) is thermally justified by extreme ${dynamicTemp}°C ambient heatwave. Chiller lift normal, zero mechanical fault.`,
        action_recommendation: `Outdoor heatwave (${dynamicTemp}°C) verified via meteorological record. Chillers operating within thermal lift envelope. Advise optimizing BMS night economizer enthalpy limits.`,
      });

    } else if (scenario === 'daytime_nominal') {
      setCurrentTime('14:00');
      setCurrentWeather({
        temp: 31.8,
        humidity: 62,
        condition: 'Clear Sky / Peak Operation',
        emoji: '☀️',
        timestamp: '2016-03-15 14:00:00',
        forecast: [
          { time: '12:00', emoji: '☀️', temp: 31.2, rainProb: 5 },
          { time: '13:00', emoji: '☀️', temp: 31.5, rainProb: 5 },
          { time: '14:00', emoji: '☀️', temp: 31.8, rainProb: 5 },
          { time: '15:00', emoji: '☀️', temp: 31.6, rainProb: 5 },
          { time: '16:00', emoji: '⛅', temp: 31.0, rainProb: 10 },
          { time: '17:00', emoji: '⛅', temp: 30.2, rainProb: 10 },
        ],
      });
      setNilmZones({
        total: 2450,
        hotel: 350,
        office: 850,
        podium: 650,
        me: 110,
      });

      // ⚠️ Extract dynamic variables
      const dynamicTemp = 31.8;
      const dynamicMeasured = 350.0;
      const dynamicDevPct = 6.1;

      setComplianceGap({
        detected: false,
        status_code: 'COMPLIANT',
        clause: 'EE-1',
        clause_title: 'Energy Efficiency Standard Met',
        attribution: 'NORMAL',
        anomaly_zone: null,
        anomaly_floor: null,
        measured_load: dynamicMeasured,
        baseline_load: 330.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        severity: 'NOMINAL',
        explanation: `All 4 zones conform to GreenRE EE-1 baseline bounds under ${dynamicTemp}°C nominal afternoon business peak.`,
        action_recommendation: 'All building zones operating in optimal energy envelope. Continuous NILM surveillance active.',
      });

    } else if (scenario === 'nominal') {
      setCurrentTime('Live');
      setCurrentWeather({
        temp: 28.4,
        humidity: 72,
        condition: 'Clear Sky (Nominal Operation)',
        emoji: '☀️',
        timestamp: new Date().toISOString(),
        forecast: [
          { time: '12:00', emoji: '☀️', temp: 28.5, rainProb: 5 },
          { time: '13:00', emoji: '☀️', temp: 29.0, rainProb: 5 },
          { time: '14:00', emoji: '☀️', temp: 29.2, rainProb: 5 },
          { time: '15:00', emoji: '☀️', temp: 28.8, rainProb: 5 },
          { time: '16:00', emoji: '⛅', temp: 28.0, rainProb: 10 },
          { time: '17:00', emoji: '⛅', temp: 27.5, rainProb: 10 },
        ],
      });

      // ⚠️ Extract dynamic variables
      const dynamicTemp = 28.4;
      const dynamicMeasured = 45.2;

      setComplianceGap({
        detected: false,
        status_code: 'COMPLIANT',
        clause: 'EE-1',
        clause_title: 'Energy Efficiency Standard Met',
        attribution: 'NORMAL',
        anomaly_zone: null,
        anomaly_floor: null,
        measured_load: dynamicMeasured,
        baseline_load: 330.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: 0.0,
        severity: 'NOMINAL',
        explanation: `Real-time telemetry stream synchronized at ${dynamicTemp}°C ambient. All building zones operating within GreenRE compliance bounds.`,
        action_recommendation: 'Continuous IoT surveillance active across all 5 zones.',
      });
    }

    // Remote-control the Python simulator via the FastAPI Demo State Bus
    const modeMap = {
      cool_night_gap: 'l14_anomaly',
      tropical_heatwave: 'tropical_heatwave',
      daytime_nominal: 'nominal',
      nominal: 'nominal',
    };
    const targetMode = modeMap[scenario] || scenario;
    try {
      await fetch('/api/v1/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode }),
      });
    } catch (e) {
      // Offline fallback
    }

    // Also synchronize live model predictions with backend if in historical scenarios
    if (scenario !== 'nominal') {
      try {
        const res = await fetch(`http://localhost:5000/api/nilm/latest?scenario=${scenario}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            setNilmZones({
              total: data.total_building_power,
              hotel: data.zones['zone-d'].value,
              office: data.zones['zone-c'].value,
              podium: data.zones['zone-b'].value,
              me: data.zones['zone-a'].value,
            });
            setComplianceGap(data.compliance_gap);
          }
        }
      } catch (e) {
        // Offline fallback already active
      }
    }
  }, []);

  const liveByCode = useMemo(() => {
    const map = {};
    (liveConsumption?.zones || []).forEach((zone) => {
      map[zone.code] = zone;
    });
    return map;
  }, [liveConsumption]);

  // Compute reactive 3D zones list from NILM, overlaid with live EMS kW when present
  const zonesData = useMemo(() => {
    const energyFor = (code, fallback) => {
      // ⚠️ 1. If currently in a historical simulation scenario (non-nominal), force using nilmZones data
      if (selectedScenario !== 'nominal' && nilmZones) {
        if (code === 'zone-a') return `${nilmZones.me} kW`;
        if (code === 'zone-b') return `${nilmZones.podium} kW`;
        if (code === 'zone-c') return `${nilmZones.office} kW`;
        if (code === 'zone-d') return `${nilmZones.hotel} kW`;
        return `${fallback} kW`;
      }

      // ⚠️ 2. If in Live (nominal) mode, prioritize reading the real live telemetry data
      const live = liveByCode[code];
      const liveKw = live?.demand_kw ?? live?.peak_demand_kw;
      if (liveKw > 0) return `${liveKw} kW`;

      return `${fallback} kW`;
    };

    const statusFor = (code, fallbackWarn) => {
      // ⚠️ 1. If in a historical simulation scenario, determine whether to trigger an alarm based on AI's complianceGap
      if (selectedScenario !== 'nominal') {
        return (complianceGap?.detected && complianceGap?.anomaly_zone === code) ? 'warn' : 'ok';
      }

      // ⚠️ 2. If in Live mode, use the real Live compliance status
      if (liveByCode[code]?.compliance_status === 'warning') return 'warn';
      return fallbackWarn ? 'warn' : 'ok';
    };

    return [
      { id: 'zone-a', name: 'M&E Plant', floors: 'B2–LG', y: 0.4, h: 0.85, w: 4.6, d: 3.5, color: '#4b5563', energy: energyFor('zone-a', nilmZones?.me || 0), status: statusFor('zone-a', false) },
      { id: 'zone-b', name: 'Podium', floors: 'GF–L3', y: 1.55, h: 1.2, w: 4.3, d: 3.3, color: '#94a3b8', energy: energyFor('zone-b', nilmZones?.podium || 0), status: statusFor('zone-b', false) },
      { id: 'zone-c', name: 'Offices', floors: 'L4–L12', y: 3.35, h: 2.2, w: 3.2, d: 2.45, color: '#3b82f6', energy: energyFor('zone-c', nilmZones?.office || 0), status: statusFor('zone-c', false) },
      { id: 'zone-d', name: 'Hyatt Hotel', floors: 'L14–L28', y: 6.05, h: 3.2, w: 3.0, d: 2.3, color: '#e11d48', energy: energyFor('zone-d', nilmZones?.hotel || 0), status: statusFor('zone-d', complianceGap?.detected) },
      { id: 'zone-e', name: 'Amenities', floors: 'L29–L31', y: 7.95, h: 0.7, w: 2.7, d: 2.05, color: '#fb7185', energy: energyFor('zone-e', 140), status: statusFor('zone-e', false) },
    ];
  }, [nilmZones, complianceGap, liveByCode, selectedScenario]); // ⚠️ Must include selectedScenario in the dependency array here

  const handleBuildingHover = useCallback((info) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (info) {
      setHoveredZone((prev) => {
        if (prev && prev.zoneId === info.zoneId && tooltipRef.current && tooltipRef.current.matches(':hover')) {
          return prev;
        }
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
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredZone(null);
      }, 150);
    }
  }, []);

  const applyRemediation = async () => {
    setRemediationBusy(true);
    setRemediationLog(null);
    try {
      const res = await fetch('/api/v1/control/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_damper',
          floor_id: complianceGap?.anomaly_floor || 'L14',
          register_addr: 12,
          target_val: 15,
        }),
      });
      const result = await res.json();
      setRemediationLog(result);
      if (result.status === 'SUCCESS') {
        setActionSuccess(true);
        setTimeout(() => setActionSuccess(false), 3500);
      }
    } catch (e) {
      setRemediationLog({
        status: 'FAILED',
        log: 'OT Alert: control API unreachable. Command was not verified.',
      });
    } finally {
      setRemediationBusy(false);
    }
  };

  const handleBmsDrillDown = async () => {
    setBmsLoading(true);
    try {
      const response = await fetch(
        `/api/bms/telemetry?floor=${encodeURIComponent(complianceGap?.anomaly_floor || 'L14')}&timestamp=${encodeURIComponent(currentWeather.timestamp)}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `BMS gateway returned ${response.status}`);
      }
      setBmsTelemetry(await response.json());
      setIsBmsDrawerOpen(true);
    } catch (error) {
      console.error('BMS drill-down failed:', error);
      alert(`Unable to load BMS telemetry: ${error.message}`);
    } finally {
      setBmsLoading(false);
    }
  };

  // ⚠️ Added: Floating window data interceptor
  // Forcefully use the dynamic zonesData to override the hardcoded energy and status inside the 3D model
  const activeHoverData = useMemo(() => {
    if (!hoveredZone) return null;

    // Use the zoneId output by the 3D model to query our latest reactive array for real data
    const freshData = zonesData.find(z => z.id === hoveredZone.zoneId || z.id === hoveredZone.id);

    if (freshData) {
      // Keep the mouse coordinates (x, y), but replace energy and status with real-time dynamic ones
      return {
        ...hoveredZone,
        energy: freshData.energy,
        status: freshData.status,
        color: freshData.color,
      };
    }
    return hoveredZone;
  }, [hoveredZone, zonesData]);

  // --- Place this code right before return ( ---
  const activePayload = useMemo(() => {
    // If it's Live mode, or data is not yet ready, continue using real Live data
    if (selectedScenario === 'nominal' || !nilmZones) {
      return liveConsumption;
    }

    // If it's Scenario mode, assemble a "forged" payload to forcefully override the component
    return {
      timestamp: currentWeather.timestamp,
      total_main_meter_kw: nilmZones.total,
      // ⚠️ Added: Declare that the main meter data is a true physical measurement (Ground Truth)
      is_main_meter_measured: true,
      zones: [
        // ⚠️ Added: is_estimated=true declares it's an estimated value, accompanied by the AI algorithm's confidence score
        { code: 'zone-a', name: 'M&E Plant', demand_kw: nilmZones.me, color: '#4b5563', compliance_status: 'SCENARIO', is_estimated: true, confidence: 88 },
        { code: 'zone-b', name: 'Podium', demand_kw: nilmZones.podium, color: '#94a3b8', compliance_status: 'SCENARIO', is_estimated: true, confidence: 92 },
        { code: 'zone-c', name: 'Offices', demand_kw: nilmZones.office, color: '#3b82f6', compliance_status: 'SCENARIO', is_estimated: true, confidence: 85 },
        { code: 'zone-d', name: 'Hyatt Hotel', demand_kw: nilmZones.hotel, color: '#e11d48', compliance_status: complianceGap?.detected ? '⚠️ GAP FOUND' : 'SCENARIO', is_estimated: true, confidence: 76 },
      ],
      disaggregated_loads: [
        { zone_name: 'M&E Plant', demand_kw: nilmZones.me, color: '#4b5563', is_estimated: true, confidence: 88 },
        { zone_name: 'Podium', demand_kw: nilmZones.podium, color: '#94a3b8', is_estimated: true, confidence: 92 },
        { zone_name: 'Offices', demand_kw: nilmZones.office, color: '#3b82f6', is_estimated: true, confidence: 85 },
        { zone_name: 'Hyatt Hotel', demand_kw: nilmZones.hotel, color: '#e11d48', is_estimated: true, confidence: 76 },
      ]
    };
  }, [selectedScenario, liveConsumption, nilmZones, currentWeather, complianceGap]);
  // ------------------------------------

  return (
    <div className="dashboard">
      <div className="canvas-container">
        {glFailed && (
          <CssTower selectedZone={selectedZone} onSelect={setSelectedZone} zonesData={zonesData} />
        )}
        <div className={`webgl-overlay ${glFailed ? 'is-hidden' : 'is-active'}`}>
          <ErrorBoundaryCanvas onError={() => setGlFailed(true)}>
            <BuildingScene
              selectedZone={selectedZone}
              onSelect={setSelectedZone}
              onFail={() => setGlFailed(true)}
              onHover={handleBuildingHover}
              anomalyFloor={complianceGap?.detected ? complianceGap.anomaly_floor : null}
              anomalyZone={complianceGap?.detected ? complianceGap.anomaly_zone : null}
              // ⚠️ Make sure to include this line: pass dynamic data to the 3D scene
              zonesData={zonesData}
            />
          </ErrorBoundaryCanvas>
        </div>
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
              if (hoveredZone.zoneId) {
                navigate(`/zone/${hoveredZone.zoneId}?scenario=${selectedScenario}`);
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
                className={`bht-badge ${hoveredZone.status === 'warn' ? 'warn' : 'ok'
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
            {/* Replace the Energy section of the Hover Tooltip with: */}
            <div className="bht-energy" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                  {hoveredZone.energy.includes('kW') ? '⚡ AI Estimated Load' : '⚡ Energy Load'}
                </span>
                <span style={{ fontSize: '0.6rem', color: '#8b5cf6', background: '#ede9fe', padding: '1px 4px', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                  ✨ NILM Engine
                </span>
              </div>
              <b style={{ fontSize: '1.1rem', color: '#0f172a', marginTop: '2px' }}>{hoveredZone.energy}</b>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                *No physical sub-meter installed
              </span>
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
          <button
            className="btn-evidence"
            type="button"
            disabled={evidenceBusy}
            onClick={async () => {
              setEvidenceBusy(true);
              try {
                await downloadGreenReEvidence();
              } catch (error) {
                alert(error.message || 'Unable to generate GreenRE evidence PDF.');
              } finally {
                setEvidenceBusy(false);
              }
            }}
          >
            {evidenceBusy ? 'Generating…' : 'Generate GreenRE Evidence'}
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

            {/* ⚠️ Added: Industrial-grade Power Quality (PQ) analysis card */}
            <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Power Quality (PQ)</div>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Main Incomer · EN50160</span>
                </div>
                <span className="btn-details" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>Live</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                {/* THD Harmonic Distortion Metric */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Voltage THD (Total Harmonic)</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: selectedScenario === 'cool_night_gap' ? '#e11d48' : '#10b981' }}>
                      {selectedScenario === 'cool_night_gap' ? '4.8%' : '1.2%'}
                    </span>
                  </div>
                  <div className="bar-bg" style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: selectedScenario === 'cool_night_gap' ? '48%' : '12%',
                        background: selectedScenario === 'cool_night_gap' ? '#e11d48' : '#10b981',
                        transition: 'all 0.5s ease'
                      }}
                    />
                  </div>
                  {selectedScenario === 'cool_night_gap' && (
                    <div style={{ fontSize: '0.6rem', color: '#e11d48', marginTop: '2px', fontWeight: 600 }}>
                      ⚠️ High harmonics detected. Motor heating risk on L14 AHU.
                    </div>
                  )}
                </div>

                {/* 3-Phase Voltage Imbalance Metric */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>3-Phase Imbalance</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>0.8%</span>
                  </div>
                  <div className="bar-bg" style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '8%', background: '#10b981' }} />
                  </div>
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
                <div>
                  <div className="card-title">Weather (BDG2 Station)</div>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>The Light City · Synced</span>
                </div>
                <span className="btn-details">Details</span>
              </div>
              <div className="weather-row">
                <span style={{ fontSize: '1.5rem' }}>{currentWeather.emoji}</span>
                <span className="temp-big">{currentWeather.temp}°C</span>
                <span className="weather-tag">HUMIDITY {currentWeather.humidity}%</span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>
                {currentWeather.condition || 'Penang Meteorological Station'} · {currentWeather.timestamp || 'Historical'}
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
              <div className="copilot-sub">2-Channel NILM · Weather Cross-Verification</div>
            </div>
          </div>

          {/* 1. DATA TIME MACHINE (BDG2 Scenarios) */}
          <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.05em' }}>
              ⏱️ Data Time Machine (BDG2 Scenarios)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button
                type="button"
                onClick={() => handleScenarioChange('cool_night_gap')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: selectedScenario === 'cool_night_gap' ? '#f43f5e' : '#cbd5e1',
                  background: selectedScenario === 'cool_night_gap' ? '#ffe4e6' : '#f8fafc',
                  color: selectedScenario === 'cool_night_gap' ? '#9f1239' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>🚨 03:00 Cool Night Anomaly</span>
                <span style={{ fontSize: '0.6rem', background: '#fecdd3', padding: '1px 5px', borderRadius: '4px' }}>24.5°C · Gap L14</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('tropical_heatwave')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: selectedScenario === 'tropical_heatwave' ? '#f59e0b' : '#cbd5e1',
                  background: selectedScenario === 'tropical_heatwave' ? '#fef3c7' : '#f8fafc',
                  color: selectedScenario === 'tropical_heatwave' ? '#92400e' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>☀️ 03:00 Tropical Heatwave</span>
                <span style={{ fontSize: '0.6rem', background: '#fde68a', padding: '1px 5px', borderRadius: '4px' }}>30.2°C · Weather Lift</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('daytime_nominal')}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: selectedScenario === 'daytime_nominal' ? '#0d9488' : '#cbd5e1',
                  background: selectedScenario === 'daytime_nominal' ? '#ccfbf1' : '#f8fafc',
                  color: selectedScenario === 'daytime_nominal' ? '#0f766e' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>🏢 14:00 Nominal Afternoon</span>
                <span style={{ fontSize: '0.6rem', background: '#99f6e4', padding: '1px 5px', borderRadius: '4px' }}>31.8°C · Peak OK</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('nominal')}
                style={{
                  padding: '7px 9px',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: '1.5px solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: selectedScenario === 'nominal' ? '#10b981' : '#86efac',
                  background: selectedScenario === 'nominal' ? '#dcfce7' : '#f0fdf4',
                  color: '#15803d',
                  transition: 'all 0.2s',
                  marginTop: '4px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  🟢 Resume Live / Nominal
                </span>
                <span style={{ fontSize: '0.6rem', background: '#bbf7d0', padding: '1px 6px', borderRadius: '4px', color: '#166534', fontWeight: 800 }}>
                  Live Bus
                </span>
              </button>
            </div>
          </div>

          {/* 🔥 2. Time-Series Visualization (Proves AI evaluates continuous data) */}
          <NilmChart currentTime={currentTime} />

          {/* 🔥 3. Spatial Disaggregation Visualization (Single Source of Truth SWR) */}
          <UtilityMainMeter overrideData={selectedScenario === 'nominal' ? null : activePayload} />
          <ZoneConsumptionCards
            payload={activePayload}
            loading={selectedScenario === 'nominal' ? liveLoading : false}
            error={selectedScenario === 'nominal' ? liveError : null}
          />

          {/* 4. AI Gap Identification (Red / Amber / Green Alert Card) */}
          {complianceGap && complianceGap.attribution === 'EQUIPMENT_FAULT' ? (
            <div
              className="alert-box"
              onClick={handleBmsDrillDown}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && handleBmsDrillDown()}
              style={{ border: '1.5px solid #fda4af', background: 'rgba(255, 241, 242, 0.95)', cursor: 'pointer' }}
            >
              <div className="alert-accent" style={{ background: '#e11d48', width: '4px' }} />
              <div className="alert-content">
                <span className="alert-icon" style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="alert-title" style={{ color: '#9f1239', fontWeight: 800 }}>
                      Non-compliant Trend ({complianceGap.clause})
                    </div>
                    <span style={{ fontSize: '0.6rem', background: '#ffe4e6', color: '#be123c', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Floor {complianceGap.anomaly_floor}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.58rem', background: '#fecdd3', color: '#881337', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      🌡️ Outdoor: {complianceGap.outdoor_temp}°C (Cool Night)
                    </span>
                    <span style={{ fontSize: '0.58rem', background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      ⚡ Hotel Load: {complianceGap.measured_load} kW (+{complianceGap.deviation_pct}%)
                    </span>
                  </div>
                  <div className="alert-desc" style={{ color: '#881337', marginTop: '2px', lineHeight: '1.45', fontSize: '0.68rem' }}>
                    {complianceGap.explanation}
                  </div>
                  <div style={{ color: '#9f1239', fontSize: '0.62rem', fontWeight: 800, marginTop: '6px' }}>
                    {bmsLoading ? 'Loading BMS gateway…' : 'Click to open L14 BMS drill-down →'}
                  </div>
                </div>
              </div>
            </div>
          ) : complianceGap && complianceGap.attribution === 'WEATHER_DRIVEN' ? (
            <div className="alert-box" style={{ background: 'rgba(254, 243, 199, 0.95)', border: '1.5px solid #fde68a' }}>
              <div className="alert-accent" style={{ background: '#d97706', width: '4px' }} />
              <div className="alert-content">
                <span className="alert-icon" style={{ color: '#d97706', fontSize: '1.25rem' }}>☀️</span>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="alert-title" style={{ color: '#92400e', fontWeight: 800 }}>
                      Weather-Driven Load ({complianceGap.clause})
                    </div>
                    <span style={{ fontSize: '0.6rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Ambient Heat 30.2°C
                    </span>
                  </div>
                  <div style={{ fontSize: '0.58rem', color: '#b45309', marginTop: '3px', fontWeight: 700 }}>
                    Cross-verification: High power physically correlated with 30.2°C outdoor heat. No equipment fault!
                  </div>
                  <div className="alert-desc" style={{ color: '#78350f', marginTop: '2px', lineHeight: '1.4', fontSize: '0.68rem' }}>
                    {complianceGap.explanation}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert-box" style={{ background: 'rgba(240, 253, 250, 0.95)', border: '1px solid #99f6e4' }}>
              <div className="alert-accent" style={{ background: '#14b8a6', width: '4px' }} />
              <div className="alert-content">
                <span className="alert-icon" style={{ color: '#0d9488', fontSize: '1.25rem' }}>✅</span>
                <div>
                  <div className="alert-title" style={{ color: '#0f766e' }}>GreenRE Baseline Compliant</div>
                  <div className="alert-desc" style={{ color: '#134e4a', fontSize: '0.68rem' }}>
                    All building zones operating inside GreenRE thermal efficiency bounds under continuous NILM surveillance.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Model Recommendation Box */}
          <div className="reco-box">
            <div className="reco-header">
              <span className="reco-label">Action Recommendation</span>
              <span className="reco-tag">TEAMS APPROVAL</span>
            </div>
            <div className="reco-text" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
              <b>Target:</b> {complianceGap?.detected ? `Hyatt Hotel (${complianceGap.anomaly_floor})` : 'Whole Tower'}<br />
              <b>Directive:</b> {complianceGap?.action_recommendation || 'Continuous monitoring active across sub-meters.'}<br />
              <b>Attribution:</b> <span style={{ color: complianceGap?.detected ? '#e11d48' : (complianceGap?.attribution === 'WEATHER_DRIVEN' ? '#d97706' : '#0d9488'), fontWeight: 800 }}>
                {complianceGap?.attribution || 'NORMAL'}
              </span>
            </div>
          </div>

          <button
            onClick={applyRemediation}
            className="btn-remediation bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            type="button"
            disabled={remediationBusy}
            style={{
              background: actionSuccess ? 'linear-gradient(135deg, #10b981, #059669)' : undefined
            }}
          >
            {remediationBusy
              ? 'Executing & verifying…'
              : actionSuccess
                ? '✓ Damper verified at 15%'
                : 'Apply Remediation (Execute & Verify)'}
          </button>
          {remediationLog && (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-semibold ${remediationLog.status === 'SUCCESS'
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border border-red-400 bg-red-50 text-red-800 animate-pulse'
                }`}
            >
              {remediationLog.status === 'SUCCESS' ? remediationLog.log : `OT Alert: ${remediationLog.log}`}
            </div>
          )}
        </div>
      </div>

      <div className="bottom-pills">
        {['Dashboard', 'Reserve Management', 'Waste Management', 'CE'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pill-btn ${activeTab === tab ? 'active' : 'inactive'}`}
            onClick={() => {
              if (tab === 'Reserve Management') {
                navigate('/reservations');
              } else if (tab === 'Waste Management') {
                navigate('/waste');
              } else {
                setActiveTab(tab);
              }
            }}
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
              {currentWeather.forecast && currentWeather.forecast.length > 0 ? (
                currentWeather.forecast.map((hour, idx) => (
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
              <BmsTelemetryDrawer
                isOpen={isBmsDrawerOpen}
                data={bmsTelemetry}
                onClose={() => setIsBmsDrawerOpen(false)}
              />
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

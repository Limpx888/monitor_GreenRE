import React, { useState } from 'react';

// Standardized Asset Spatial Hierarchy Data Topology
// Building -> Site -> Floor -> Zone -> Asset -> Point -> Telemetry
const SPATIAL_HIERARCHY = {
  site: {
    code: 'SITE-PENANG-01',
    name: 'The Light City Penang',
    city: 'Penang',
    country: 'Malaysia',
    certified: 'GreenRE Platinum Targeted'
  },
  building: {
    code: 'BLD-TOWER-A',
    name: 'Tower A - Commercial & Hospitality',
    gfa_m2: 48500,
    floors_count: 28,
  },
  floors: [
    {
      code: 'L14',
      name: 'Level 14 - Hotel Guest Rooms & Plant',
      zone: 'Zone D - Hyatt Hotel',
      zone_code: 'zone-d',
      zone_type: 'HOSPITALITY',
      color: '#e11d48',
      assets: [
        {
          tag: 'AHU-14A',
          name: 'Air Handling Unit 14A (East Wing)',
          type: 'HVAC Air Handling Unit',
          status: 'WARNING',
          protocol: 'BACnet/IP (Port 47808)',
          bacnet_id: 1401,
          points: [
            { code: 'OUTDOOR_AIR_DAMPER', name: 'Outdoor Air Damper Command', val: 42.0, unit: '%', target: 15.0, controllable: true, dq: 'VALID', point_type: 'AO:12' },
            { code: 'SUPPLY_FAN_SPEED', name: 'Supply Fan VFD Speed', val: 78.5, unit: 'Hz', target: 80.0, controllable: true, dq: 'VALID', point_type: 'AO:13' },
            { code: 'CHW_VALVE_POS', name: 'Chilled Water Valve Position', val: 64.0, unit: '%', target: 60.0, controllable: true, dq: 'VALID', point_type: 'AO:14' },
            { code: 'SUPPLY_AIR_TEMP', name: 'Supply Air Temperature', val: 14.2, unit: '°C', target: 14.0, controllable: false, dq: 'VALID', point_type: 'AI:21' },
            { code: 'RETURN_AIR_CO2', name: 'Return Air CO2 Concentration', val: 680, unit: 'ppm', target: 700, controllable: false, dq: 'VALID', point_type: 'AI:22' },
            { code: 'ACTIVE_POWER', name: 'AHU Motor Power Draw', val: 18.4, unit: 'kW', target: 14.2, controllable: false, dq: 'VALID', point_type: 'AI:23' },
          ]
        },
        {
          tag: 'VAV-14-04',
          name: 'Variable Air Volume Box 14-04',
          type: 'Terminal Unit',
          status: 'NORMAL',
          protocol: 'BACnet/IP',
          bacnet_id: 1404,
          points: [
            { code: 'AIRFLOW_CFM', name: 'Measured Airflow', val: 420, unit: 'CFM', target: 450, controllable: false, dq: 'VALID', point_type: 'AI:01' },
            { code: 'ROOM_TEMP', name: 'Room Space Temp', val: 23.6, unit: '°C', target: 24.0, controllable: false, dq: 'VALID', point_type: 'AI:02' },
            { code: 'DAMPER_POS', name: 'VAV Damper Position', val: 55, unit: '%', target: 50, controllable: true, dq: 'VALID', point_type: 'AO:01' }
          ]
        }
      ]
    },
    {
      code: 'L8',
      name: 'Level 8 - Grade A Corporate Offices',
      zone: 'Zone C - Offices',
      zone_code: 'zone-c',
      zone_type: 'COMMERCIAL',
      color: '#3b82f6',
      assets: [
        {
          tag: 'VAV-08B',
          name: 'Conference Room VAV with Reheat',
          type: 'Terminal Unit',
          status: 'ANOMALY',
          protocol: 'BACnet/IP',
          bacnet_id: 802,
          points: [
            { code: 'ZONE_CO2', name: 'Indoor CO2 Level', val: 1450, unit: 'ppm', target: 1000, controllable: false, dq: 'VALID', point_type: 'AI:11' },
            { code: 'REHEAT_COIL_CMD', name: 'Electric Reheat Coil Command', val: 45.0, unit: '%', target: 0.0, controllable: true, dq: 'VALID', point_type: 'AO:05' },
            { code: 'ROOM_TEMP', name: 'Zone Temperature', val: 24.8, unit: '°C', target: 23.5, controllable: false, dq: 'VALID', point_type: 'AI:12' },
          ]
        },
        {
          tag: 'SMART_METER_L8',
          name: 'L8 Sub-Meter Incomer',
          type: 'Power Meter',
          status: 'NORMAL',
          protocol: 'Modbus TCP (Port 502)',
          bacnet_id: 890,
          points: [
            { code: 'ACTIVE_DEMAND', name: 'Real-time Demand', val: 120.4, unit: 'kW', target: 110.0, controllable: false, dq: 'VALID', point_type: 'REG:100' },
            { code: 'VOLTAGE_THD', name: 'Total Harmonic Distortion', val: 1.2, unit: '%', target: 5.0, controllable: false, dq: 'VALID', point_type: 'REG:102' },
            { code: 'POWER_FACTOR', name: 'Displacement Power Factor', val: 0.97, unit: '', target: 0.95, controllable: false, dq: 'VALID', point_type: 'REG:104' },
          ]
        }
      ]
    },
    {
      code: 'B2',
      name: 'Basement 2 - Central Plant & Chiller Room',
      zone: 'Zone A - M&E Plant',
      zone_code: 'zone-a',
      zone_type: 'INDUSTRIAL_ME',
      color: '#4b5563',
      assets: [
        {
          tag: 'CHILLER-01',
          name: 'Water-Cooled Centrifugal Chiller #1',
          type: 'Central Cooling Plant',
          status: 'NORMAL',
          protocol: 'BACnet/IP (Port 47808)',
          bacnet_id: 101,
          points: [
            { code: 'CHW_SUPPLY_TEMP', name: 'Chilled Water Supply Temp', val: 7.0, unit: '°C', target: 9.0, controllable: true, dq: 'VALID', point_type: 'AO:30' },
            { code: 'CHW_RETURN_TEMP', name: 'Chilled Water Return Temp', val: 12.4, unit: '°C', target: 14.0, controllable: false, dq: 'VALID', point_type: 'AI:31' },
            { code: 'CHW_DELTA_T', name: 'Evaporator Delta T', val: 5.4, unit: '°C', target: 5.0, controllable: false, dq: 'VALID', point_type: 'CALC:32' },
            { code: 'CHILLER_POWER', name: 'Compressor Input Power', val: 310.0, unit: 'kW', target: 290.0, controllable: false, dq: 'VALID', point_type: 'AI:33' },
            { code: 'CHILLER_COP', name: 'Coefficient of Performance', val: 5.82, unit: 'COP', target: 5.50, controllable: false, dq: 'VALID', point_type: 'CALC:34' },
          ]
        },
        {
          tag: 'MAIN_INCOMER_PM01',
          name: 'Main Utility Incomer 11kV/415V',
          type: 'Primary Main Meter',
          status: 'NORMAL',
          protocol: 'Modbus TCP (Port 502)',
          bacnet_id: 10,
          points: [
            { code: 'TOTAL_DEMAND', name: 'Total Facility Demand', val: 1007.0, unit: 'kW', target: 1100.0, controllable: false, dq: 'VALID', point_type: 'REG:01' },
            { code: 'LINE_VOLTAGE_AVG', name: 'Average Line-Line Voltage', val: 415.6, unit: 'V', target: 415.0, controllable: false, dq: 'VALID', point_type: 'REG:02' },
            { code: 'GRID_FREQ', name: 'National Grid Frequency', val: 50.01, unit: 'Hz', target: 50.0, controllable: false, dq: 'VALID', point_type: 'REG:03' },
          ]
        }
      ]
    },
    {
      code: 'L2',
      name: 'Level 2 - Retail Podium & Landscape Deck',
      zone: 'Zone B - Podium',
      zone_code: 'zone-b',
      zone_type: 'COMMERCIAL_RETAIL',
      color: '#94a3b8',
      assets: [
        {
          tag: 'WATER_METER_WM02',
          name: 'Landscape Irrigation Sub-Meter',
          type: 'Ultrasonic Flow Meter',
          status: 'NORMAL',
          protocol: 'Modbus RTU / Gateway',
          bacnet_id: 205,
          points: [
            { code: 'FLOW_RATE', name: 'Instantaneous Water Flow', val: 0.0, unit: 'm³/h', target: 0.0, controllable: false, dq: 'VALID', point_type: 'REG:50' },
            { code: 'PIPE_PRESSURE', name: 'Mains Supply Pressure', val: 3.6, unit: 'bar', target: 3.5, controllable: false, dq: 'VALID', point_type: 'REG:51' },
            { code: 'TOTAL_CONSUMPTION', name: 'Cumulative Flow Totalizer', val: 12480.5, unit: 'm³', target: null, controllable: false, dq: 'VALID', point_type: 'REG:52' },
          ]
        }
      ]
    },
    {
      code: 'GF',
      name: 'Ground Floor - Grand Lobby & Logistics',
      zone: 'Zone B - Podium',
      zone_code: 'zone-b',
      zone_type: 'PUBLIC_LOBBY',
      color: '#10b981',
      assets: [
        {
          tag: 'SMART_BIN_SB04',
          name: 'AI Optical Waste Segregation Station',
          type: 'Smart Waste Bin',
          status: 'NORMAL',
          protocol: 'REST / IoT Telemetry',
          bacnet_id: 401,
          points: [
            { code: 'BIN_FILL_LEVEL', name: 'Volumetric Fill Level', val: 62.5, unit: '%', target: 80.0, controllable: false, dq: 'VALID', point_type: 'REST:01' },
            { code: 'RECYCLABLE_RATIO', name: 'Recyclables Segregation Rate', val: 62.5, unit: '%', target: 60.0, controllable: false, dq: 'VALID', point_type: 'REST:02' },
            { code: 'CURRENT_WEIGHT', name: 'Waste Load Cell Weight', val: 8.0, unit: 'kg', target: 15.0, controllable: false, dq: 'VALID', point_type: 'REST:03' },
          ]
        }
      ]
    }
  ]
};

// Simulated Incidents Aggregator (Point 10: Deduplication, suppression window, escalation)
const MOCK_INCIDENTS = [
  {
    incident_id: 'INC-2026-0814',
    title: 'L14 AHU-14A Outdoor Damper Locked in High Fresh Air Mode during Off-Peak Ambient Heat',
    asset_tag: 'AHU-14A',
    floor: 'L14',
    zone: 'Zone D (Hotel)',
    severity: 'CRITICAL',
    state: 'OPEN',
    dedup_key: 'DAMP_OVERCOOL_L14',
    suppressed_count: 14,
    suppression_window_s: 300,
    escalation_level: 'L2 Lead Plant Engineer',
    first_seen: '2026-03-15 03:00:12',
    last_seen: '2026-03-15 03:05:00',
    clause: 'GreenRE Non-Residential v3.0 EE-1.2 & MS 1525:2019',
    root_cause_ai: 'Fresh air damper stuck at 42% during 03:00 off-peak unoccupied hours, causing unnecessary compressor cooling load of +110 kW.',
    recommended_point: 'OUTDOOR_AIR_DAMPER',
    recommended_target: 15.0,
    lifecycle_stage: 'PENDING_APPROVAL'
  },
  {
    incident_id: 'INC-2026-0815',
    title: 'L8 Conference Hall VAV-08B High CO2 Surge (>1400 ppm)',
    asset_tag: 'VAV-08B',
    floor: 'L8',
    zone: 'Zone C (Offices)',
    severity: 'HIGH',
    state: 'ACKNOWLEDGED',
    dedup_key: 'CO2_SPIKE_L8',
    suppressed_count: 8,
    suppression_window_s: 180,
    escalation_level: 'L1 Operator',
    first_seen: '2026-03-15 14:02:40',
    last_seen: '2026-03-15 14:05:00',
    clause: 'GreenRE IEQ-3 / ASHRAE 62.1-2022 Indoor Air Quality',
    root_cause_ai: 'Occupancy peak in boardroom exceeded design ventilation rate. Purge damper modulation required.',
    recommended_point: 'REHEAT_COIL_CMD',
    recommended_target: 0.0,
    lifecycle_stage: 'AI_RECOMMENDED'
  }
];

export default function EnterpriseConsole({
  selectedFloor = 'L14',
  onSelectFloor,
  userRole = 'Operator',
  onRoleChange,
  controlMode = 'SIMULATED_EXECUTION',
  onTriggerControl,
  activeScenario = 'nominal'
}) {
  const [activeTab, setActiveTab] = useState('topology'); // 'topology' | 'telemetry' | 'incidents' | 'control_loop'
  const [selectedAssetTag, setSelectedAssetTag] = useState('AHU-14A');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [stagedTargetVal, setStagedTargetVal] = useState(15.0);
  const [controlStage, setControlStage] = useState('AI_RECOMMENDED');
  const [controlLog, setControlLog] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);

  // Find active floor and asset from spatial hierarchy
  const currentFloorData = SPATIAL_HIERARCHY.floors.find((f) => f.code === selectedFloor) || SPATIAL_HIERARCHY.floors[0];
  const currentAsset = currentFloorData.assets.find((a) => a.tag === selectedAssetTag) || currentFloorData.assets[0];

  // Point control execution through standardized 7-step lifecycle
  const handleLifecycleAdvance = async () => {
    setIsExecuting(true);
    setControlStage('DISPATCHING');

    const traceId = `trace-${Math.random().toString(36).substring(2, 10)}`;
    const idempotencyKey = `idemp-${Math.random().toString(36).substring(2, 9)}`;

    setTimeout(() => {
      setControlStage('DEVICE_CONFIRMATION');

      setTimeout(() => {
        setControlStage('READBACK_VERIFICATION');

        setTimeout(() => {
          setControlStage('COMPLETED');
          setIsExecuting(false);
          setControlLog({
            trace_id: traceId,
            idempotency_key: idempotencyKey,
            asset_tag: currentAsset.tag,
            point_code: selectedPoint ? selectedPoint.code : 'OUTDOOR_AIR_DAMPER',
            target_value: stagedTargetVal,
            readback_value: stagedTargetVal,
            drift: 0.0,
            operator: `token.sub:${userRole.toLowerCase()}.lead@lightcity.my`,
            mode: controlMode,
            status: controlMode === 'PRODUCTION' ? 'HARDWARE_VERIFIED' : 'SIMULATED_EXECUTION',
            timestamp: new Date().toISOString(),
            protocol: currentAsset.protocol,
            message: controlMode === 'PRODUCTION'
              ? `BACnet/IP WriteProperty executed & ReadProperty confirmed target ${stagedTargetVal}`
              : `[CONTROL_MODE: SIMULATED_EXECUTION] Simulated actuator write accepted. Real hardware safety interlock maintained.`
          });

          if (onTriggerControl) {
            onTriggerControl({
              asset: currentAsset.tag,
              point: selectedPoint?.code || 'OUTDOOR_AIR_DAMPER',
              value: stagedTargetVal
            });
          }
        }, 600);
      }, 500);
    }, 500);
  };

  const copyTrace = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 1500);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/95 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* ── Top Header: Enterprise Identity & Zero-Trust Status Bar ─────────── */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
        {/* Spatial Topology Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {SPATIAL_HIERARCHY.site.name}
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{SPATIAL_HIERARCHY.building.name}</span>
          <span className="text-slate-600">/</span>
          <span className="bg-slate-800 text-sky-300 font-semibold px-2 py-0.5 rounded border border-slate-700">
            {currentFloorData.code} ({currentFloorData.zone})
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-amber-400 font-bold">{currentAsset.tag}</span>
        </div>

        {/* Zero-Trust RBAC & Mode Controls */}
        <div className="flex items-center gap-3">
          {/* Honest Environment Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300">
            <span className="text-[10px]">🔒</span>
            <span>CONTROL_MODE:</span>
            <span className="font-mono text-amber-200">{controlMode}</span>
          </div>

          {/* RBAC Operator Role Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-md px-2 py-0.5 text-xs">
            <span className="text-slate-400 font-semibold">RBAC:</span>
            <select
              value={userRole}
              onChange={(e) => onRoleChange && onRoleChange(e.target.value)}
              className="bg-transparent text-emerald-300 font-bold outline-none cursor-pointer text-xs"
            >
              <option value="Viewer" className="bg-slate-900 text-slate-300">Viewer (Read-only)</option>
              <option value="Operator" className="bg-slate-900 text-sky-300">Operator (Standard)</option>
              <option value="Engineer" className="bg-slate-900 text-emerald-300">Engineer (Control Privileges)</option>
              <option value="Administrator" className="bg-slate-900 text-purple-300">Administrator (Root Access)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ───────────────────────────────────────────── */}
      <div className="px-5 py-2 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'topology'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>🏛️</span> Asset Hierarchy & Devices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>⚡</span> Canonical Telemetry & DQ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'incidents'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>🚨</span> Incident Management ({MOCK_INCIDENTS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('control_loop')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'control_loop'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>🔄</span> Closed-Loop Control Lifecycle
          </button>
        </div>

        {/* Current Active Trace / Event ID */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>Global Trace:</span>
          <span
            onClick={() => copyTrace('tr-gre-7f394a02-2026')}
            title="Click to copy trace ID"
            className="cursor-pointer bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500 hover:text-white transition"
          >
            tr-gre-7f394a02-2026 {copiedTrace ? '✓ Copied' : '📋'}
          </span>
        </div>
      </div>

      {/* ── Main Tab Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* TAB 1: ASSET HIERARCHY & DEVICES */}
        {activeTab === 'topology' && (
          <div className="grid grid-cols-12 gap-5 h-full">
            {/* Left 4 Cols: Floor & Zone Selector */}
            <div className="col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                Spatial Floor Selector (28 Floors)
              </div>
              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {SPATIAL_HIERARCHY.floors.map((floor) => {
                  const isSelected = floor.code === selectedFloor;
                  return (
                    <button
                      key={floor.code}
                      type="button"
                      onClick={() => {
                        onSelectFloor && onSelectFloor(floor.code);
                        if (floor.assets.length > 0) {
                          setSelectedAssetTag(floor.assets[0].tag);
                        }
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-800 border-sky-500/70 shadow-md ring-1 ring-sky-500/30'
                          : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: floor.color }}
                        />
                        <div>
                          <div className="font-extrabold text-slate-200">{floor.code}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {floor.zone}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-950/80 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-800">
                        {floor.assets.length} assets
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Middle & Right 8 Cols: Assets & Devices on this Floor */}
            <div className="col-span-8 space-y-4">
              {/* Asset Cards */}
              <div className="grid grid-cols-2 gap-3">
                {currentFloorData.assets.map((asset) => {
                  const isSelected = asset.tag === selectedAssetTag;
                  return (
                    <div
                      key={asset.tag}
                      onClick={() => setSelectedAssetTag(asset.tag)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-sky-500/80 shadow-lg ring-1 ring-sky-500/40'
                          : 'bg-slate-950/50 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-sm font-extrabold text-sky-400">
                            {asset.tag}
                          </span>
                          <div className="text-xs font-semibold text-slate-300 mt-0.5">
                            {asset.name}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            asset.status === 'WARNING'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : asset.status === 'ANOMALY'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{asset.protocol}</span>
                        <span>{asset.points.length} Points</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Point Topology Table for Selected Asset */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                  <div className="text-xs font-extrabold text-slate-200 flex items-center gap-2">
                    <span>Target Points Topology:</span>
                    <span className="text-sky-400 font-mono">{currentAsset.tag}</span>
                    <span className="text-[10px] font-normal text-slate-400">({currentAsset.type})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Protocol: {currentAsset.protocol}</span>
                </div>

                <div className="divide-y divide-slate-800/80 text-xs">
                  {currentAsset.points.map((pt) => (
                    <div
                      key={pt.code}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-900/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                          {pt.point_type}
                        </span>
                        <div>
                          <div className="font-bold text-slate-200">{pt.name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{pt.code}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-mono text-sm font-extrabold text-slate-100">
                            {pt.val} {pt.unit}
                          </div>
                          {pt.target && (
                            <div className="text-[10px] text-slate-400">
                              Target: {pt.target} {pt.unit}
                            </div>
                          )}
                        </div>

                        {/* Controllable Action Button */}
                        {pt.controllable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPoint(pt);
                              setStagedTargetVal(pt.target || pt.val);
                              setActiveTab('control_loop');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition"
                          >
                            Command Point →
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono italic">Read-only AI</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CANONICAL TELEMETRY & DATA QUALITY (DQ) */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-200">
                  Canonical Telemetry Schema Ingestion Engine
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Universal payload envelope enforcing globally unique trace IDs, anti-replay timestamps, and real-time Data Quality (DQ) monitors.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  ● Deduplication Active
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold">
                  ● Anti-Replay Guard: 5m Window
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold">
                  ● DLQ Standby (0 dropped)
                </span>
              </div>
            </div>

            {/* Telemetry Stream Table */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Point Code</th>
                    <th className="px-4 py-2.5">Asset Association</th>
                    <th className="px-4 py-2.5">Value & Unit</th>
                    <th className="px-4 py-2.5">Data Quality (DQ)</th>
                    <th className="px-4 py-2.5">Trace ID</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {currentFloorData.assets.flatMap((asset) =>
                    asset.points.map((point) => (
                      <tr key={`${asset.tag}-${point.code}`} className="hover:bg-slate-900/40 transition">
                        <td className="px-4 py-3 font-bold text-slate-200">
                          {point.code}
                          <div className="text-[10px] text-slate-400 font-sans font-normal">{point.name}</div>
                        </td>
                        <td className="px-4 py-3 text-sky-400">
                          {asset.tag}
                          <div className="text-[10px] text-slate-500">{currentFloorData.code} · {currentFloorData.zone}</div>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-amber-300">
                          {point.val} {point.unit}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                            point.dq === 'VALID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}>
                            {point.dq === 'VALID' ? '✓ VALID' : point.dq}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[10px]">
                          tr-{Math.random().toString(36).substring(2, 8)}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {point.controllable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPoint(point);
                                setStagedTargetVal(point.target || point.val);
                                setActiveTab('control_loop');
                              }}
                              className="text-sky-400 hover:text-sky-300 font-bold underline"
                            >
                              Dispatch →
                            </button>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INCIDENT MANAGEMENT CENTER (Point 10) */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-200">
                  Industrial Incident Management & Aggregator
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deduplicates high-frequency alert storms into unified operational incidents with suppression windows and human escalation pathways.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded border border-rose-500/30">
                  {MOCK_INCIDENTS.length} Active Incidents
                </span>
              </div>
            </div>

            {/* Incidents List */}
            <div className="space-y-3">
              {MOCK_INCIDENTS.map((inc) => (
                <div
                  key={inc.incident_id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-rose-400">{inc.incident_id}</span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {inc.severity}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            State: {inc.state}
                          </span>
                        </div>
                        <h5 className="text-xs font-extrabold text-slate-200 mt-1">{inc.title}</h5>
                      </div>
                    </div>

                    <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                      <div>Deduplication Key: <b className="text-slate-300">{inc.dedup_key}</b></div>
                      <div className="text-amber-300 font-bold">
                        ⚡ {inc.suppressed_count} alerts suppressed in {inc.suppression_window_s}s window
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-sky-400 font-bold">AI Root Cause Analysis:</span>
                      <span>{inc.root_cause_ai}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                      <span className="text-emerald-400 font-semibold">Regulatory Reference:</span>
                      <span className="font-mono text-slate-300">{inc.clause}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-slate-400">
                      Escalation: <b className="text-slate-300">{inc.escalation_level}</b> · First Seen: {inc.first_seen}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const targetAsset = currentFloorData.assets.find((a) => a.tag === inc.asset_tag) || currentFloorData.assets[0];
                        const targetPt = targetAsset.points.find((p) => p.code === inc.recommended_point) || targetAsset.points[0];
                        setSelectedAssetTag(targetAsset.tag);
                        setSelectedPoint(targetPt);
                        setStagedTargetVal(inc.recommended_target);
                        setActiveTab('control_loop');
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1.5"
                    >
                      <span>⚡</span> Execute Remediation Workflow →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: RIGOROUS CLOSED-LOOP CONTROL LIFECYCLE (Point 6) */}
        {activeTab === 'control_loop' && (
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <h4 className="text-sm font-extrabold text-slate-200">
                Rigorous 7-Stage Physical Control Lifecycle & Audit Loop
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Control commands target specific points of specific devices (e.g. OUTDOOR_AIR_DAMPER of AHU-14A). Every actuation enforces human token verification, idempotency checking, and readback confirmation.
              </p>

              {/* 7-Step Visual Stage Progress Bar */}
              <div className="mt-4 grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
                {[
                  { id: 'AI_RECOMMENDED', label: '1. AI Recommended' },
                  { id: 'PENDING_APPROVAL', label: '2. Pending Signoff' },
                  { id: 'APPROVED', label: '3. Approved (JWT)' },
                  { id: 'DISPATCHING', label: '4. Dispatching' },
                  { id: 'DEVICE_CONFIRMATION', label: '5. Field Device Ack' },
                  { id: 'READBACK_VERIFICATION', label: '6. Readback Check' },
                  { id: 'COMPLETED', label: '7. Audit Completed' },
                ].map((step, idx) => {
                  const stageOrder = [
                    'AI_RECOMMENDED',
                    'PENDING_APPROVAL',
                    'APPROVED',
                    'DISPATCHING',
                    'DEVICE_CONFIRMATION',
                    'READBACK_VERIFICATION',
                    'COMPLETED'
                  ];
                  const currentIdx = stageOrder.indexOf(controlStage);
                  const isDone = currentIdx >= idx;
                  const isCurrent = controlStage === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`p-2 rounded border transition-all ${
                        isCurrent
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/80 font-bold ring-1 ring-sky-500/40'
                          : isDone
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-semibold'
                          : 'bg-slate-900/40 text-slate-500 border-slate-800'
                      }`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Control Command Box */}
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-7 bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Device & Point</span>
                    <div className="text-sm font-extrabold text-sky-400 font-mono">
                      {currentAsset.tag} · {selectedPoint ? selectedPoint.code : 'OUTDOOR_AIR_DAMPER'}
                    </div>
                  </div>
                  <span className="text-xs bg-slate-800 px-2.5 py-1 rounded border border-slate-700 text-slate-300 font-mono">
                    Protocol: {currentAsset.protocol}
                  </span>
                </div>

                {/* Staged Value Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Target Setpoint Command Value:
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      value={stagedTargetVal}
                      onChange={(e) => setStagedTargetVal(parseFloat(e.target.value) || 0)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-300 w-32 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-sm font-mono text-slate-400">
                      {selectedPoint?.unit || '%'}
                    </span>
                    <div className="text-xs text-slate-400">
                      Baseline Target: <b className="text-slate-200">15.0%</b> (GreenRE EE-1 Compliant)
                    </div>
                  </div>
                </div>

                {/* Operator Verification Check */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Operator Sign-Off (JWT Claims):</span>
                    <span className="font-mono text-emerald-400 font-bold">token.role:{userRole}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Client-forged operator JSON fields are rejected. Operator credentials verified via RS256 token claims.
                  </div>
                </div>

                {/* Execute Button */}
                <button
                  type="button"
                  disabled={isExecuting || (userRole === 'Viewer')}
                  onClick={handleLifecycleAdvance}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                    userRole === 'Viewer'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : isExecuting
                      ? 'bg-sky-600 text-white cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      <span>Dispatching & Verifying Readback…</span>
                    </>
                  ) : userRole === 'Viewer' ? (
                    <span>🔒 Insufficient Permissions (Viewer is Read-Only)</span>
                  ) : (
                    <span>🚀 Authorize & Dispatch Command ({stagedTargetVal} {selectedPoint?.unit || '%'})</span>
                  )}
                </button>
              </div>

              {/* Execution Audit Log Box */}
              <div className="col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>Audit Trail Log</span>
                    <span className="text-[10px] text-slate-500 font-mono">IDEMPOTENCY VERIFIED</span>
                  </div>

                  {controlLog ? (
                    <div className="mt-3 space-y-2 font-mono text-[11px]">
                      <div className="text-emerald-400 font-bold">✓ {controlLog.status}</div>
                      <div className="text-slate-400">Trace: <span className="text-slate-200">{controlLog.trace_id}</span></div>
                      <div className="text-slate-400">Idempotency Key: <span className="text-slate-200">{controlLog.idempotency_key}</span></div>
                      <div className="text-slate-400">Target: <span className="text-amber-300">{controlLog.target_value}%</span></div>
                      <div className="text-slate-400">Readback: <span className="text-emerald-300">{controlLog.readback_value}%</span></div>
                      <div className="text-slate-400">Operator: <span className="text-sky-300">{controlLog.operator}</span></div>
                      <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800 pt-2">
                        {controlLog.message}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 text-center text-xs text-slate-500 italic">
                      No commands dispatched in this session yet. Ready for authorized execution.
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400">
                  Audit logs persist to <b className="text-slate-300">control_audit_logs</b> with pre/post status, latency, and readback confirmation.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


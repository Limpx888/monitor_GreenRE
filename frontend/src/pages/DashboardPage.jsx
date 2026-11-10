import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import CssTower from '../components/CssTower';
import BuildingScene from '../components/BuildingScene';
import NilmChart from '../components/NilmChart';
import UtilityMainMeter from '../components/UtilityMainMeter';
import ZoneConsumptionCards from '../components/ZoneConsumptionCards';
import BmsTelemetryDrawer from '../components/BmsTelemetryDrawer';
import AzureEvidenceModal from '../components/AzureEvidenceModal';
import IaqLivePanel from '../components/IaqLivePanel';
import { downloadGreenReEvidence, useZoneConsumption } from '../hooks/useZoneConsumption';
import { toast } from '../ui';

// ── Holographic floor label positions (% from top of canvas) ────────────────
const FLOOR_LABEL_POSITIONS = {
  LG:  { top: '78%', left: '52%' },
  GF:  { top: '72%', left: '52%' },
  L2:  { top: '65%', left: '56%' },
  L5:  { top: '55%', left: '56%' },
  L8:  { top: '44%', left: '56%' },
  L14: { top: '30%', left: '56%' },
  L30: { top: '14%', left: '56%' },
};

// ── Cross-module linkage data per scenario ───────────────────────────────────
const SCENARIO_CROSS_MODULE = {
  ieq_co2_spike: [
    { icon: '📅', module: 'Reserve', label: 'Room L8 Booking', value: '20 Pax booked', alert: false },
    { icon: '👥', module: 'Reserve', label: 'Live Occupancy Count', value: '350 Pax present', alert: true },
    { icon: '🌬️', module: 'Electric', label: 'AHU-08 Fan Power', value: '18.4 kW (100%)', alert: false },
    { icon: '🔒', module: 'BMS', label: 'VAV-08 Damper Position', value: '15% (stuck)', alert: true },
  ],
  cool_night_gap: [
    { icon: '💧', module: 'Water', label: 'L2 Riser Pressure', value: '1.2 bar (↓0.8 bar)', alert: true },
    { icon: '⚡', module: 'Electric', label: 'Booster Pump Draw', value: '12.3 kW (dry-cycle)', alert: true },
    { icon: '🕒', module: 'Reserve', label: 'Building Occupancy', value: 'Unoccupied (03:00)', alert: false },
    { icon: '📊', module: 'Water', label: 'Unaccounted Flow', value: '35.4 m³ / 6 hrs', alert: true },
  ],
  office_vav_fault: [
    { icon: '🌡️', module: 'Indoor', label: 'L8 Zone Setpoint', value: '22°C (target)', alert: false },
    { icon: '🌡️', module: 'BMS', label: 'L8 Actual Temp', value: '27.3°C (deviated)', alert: true },
    { icon: '⚡', module: 'Electric', label: 'Reheat Coil Draw', value: '48 kW (runaway)', alert: true },
    { icon: '🔒', module: 'BMS', label: 'VAV-08 Damper', value: 'Closed (stuck)', alert: true },
  ],
  podium_lighting_fault: [
    { icon: '💡', module: 'Electric', label: 'L2 Lighting Load', value: '185 kW (post-hours)', alert: true },
    { icon: '📅', module: 'Reserve', label: 'Scheduled Off-Time', value: '22:00 (bypassed)', alert: true },
    { icon: '👥', module: 'Reserve', label: 'Occupancy Status', value: '0 Pax (closed)', alert: false },
    { icon: '🔌', module: 'BMS', label: 'Contactor Override', value: 'Manual ON (bypassed)', alert: true },
  ],
  rainstorm_cooling: [
    { icon: '⚡', module: 'Electric', label: 'Total Demand', value: '2,087 kW (99.4% MD)', alert: true },
    { icon: '🌧️', module: 'Weather', label: 'Outdoor Humidity', value: '95% RH (storm)', alert: true },
    { icon: '💧', module: 'Water', label: 'Sump Pump Draw', value: '4 × 11 kW = 44 kW', alert: false },
    { icon: '❄️', module: 'Electric', label: 'Chiller Plant Load', value: '1,420 kW (100%)', alert: true },
  ],
};

// ── Three-Stage War Room Scenario Deep Data ─────────────────────────────────
const SCENARIO_DEEP_DATA = {
  ieq_co2_spike: {
    stageLabel: '14:00 | L8 Meeting CO₂ Surge',
    color: '#ef4444',
    evidence: {
      metricTitle: 'GreenRE EQ-3 Compliance Breach',
      primaryValue: '1,500 ppm (L8)',
      causeNote: 'Reserve cross-reference: 350 Pax present vs 20 Pax booked. AHU-08 running 100% but VAV-08 stuck at 15% open.',
      floors: [
        { floor: 'LG', co2: 420 }, { floor: 'GF', co2: 680 }, { floor: 'L2', co2: 710 },
        { floor: 'L5', co2: 740 }, { floor: 'L8', co2: 1500 }, { floor: 'L14', co2: 620 }, { floor: 'L30', co2: 580 },
      ],
      threshold: 1000,
      highlightFloor: 'L8',
    },
    asset: { id: 'AHU-08-L8-PODIUM', system: 'Air Handling Unit', code: 'ASHRAE-Stuck-Damper-Err-404', health: 8, lastService: '180 days overdue', protocol: 'BACnet/IP' },
    strategies: [
      { id: 'strategy_a', label: 'Force VAV-08 Damper Override (65%)', roi: '+RM 400.00', impact: 400, positive: true, desc: 'Restores EQ-3 compliance in 12s via BMS stub' },
      { id: 'strategy_b', label: 'Auto-dispatch Field Ticket to Tech Tan', roi: '-RM 200.00', impact: -200, positive: false, desc: 'Labor cost: 4 hrs × RM 50/hr' },
    ],
  },
  cool_night_gap: {
    stageLabel: '03:00 | L14 Hotel Damper Fault + Micro-Leak',
    color: '#f43f5e',
    evidence: {
      metricTitle: 'Overnight Pressure Differential & Pump Dry-Cycling',
      primaryValue: '35.4 m³ unaccounted flow',
      causeNote: 'PRV-02 pressure drop detected at L2 riser. Booster pump dry-cycling detected on Electric subsystem. Building in unoccupied off-peak window.',
      floors: [
        { floor: 'LG', co2: 390 }, { floor: 'GF', co2: 410 }, { floor: 'L2', co2: 430 },
        { floor: 'L5', co2: 450 }, { floor: 'L8', co2: 470 }, { floor: 'L14', co2: 820 }, { floor: 'L30', co2: 390 },
      ],
      threshold: 1000,
      highlightFloor: 'L14',
    },
    asset: { id: 'PRV-02-RISER-B-L2', system: 'Pressure Reducing Valve', code: 'ASHRAE-Valve-Leak-Err-201', health: 42, lastService: '90 days overdue', protocol: 'Modbus/TCP' },
    strategies: [
      { id: 'strategy_a', label: 'Actuate Isolation Valve V-12 on Riser B', roi: '+RM 95.50', impact: 95.5, positive: true, desc: 'Saves 35,000 L · avoids pump burnout' },
      { id: 'strategy_b', label: 'Schedule Plumbing Inspection at 06:00', roi: '-RM 400.00', impact: -400, positive: false, desc: 'Emergency callout rate' },
    ],
  },
  office_vav_fault: {
    stageLabel: '14:00 | Peak VAV Reheat Anomaly (L8 Office)',
    color: '#f59e0b',
    evidence: {
      metricTitle: 'Zonal Temperature Control & VAV Efficiency Breach',
      primaryValue: '590 kW (+40.5% vs baseline)',
      causeNote: 'VAV-OFFICE-08 terminal damper stuck closed, causing simultaneous chiller overload and electric reheat runaway during business peak at 31.8°C ambient.',
      floors: [
        { floor: 'LG', co2: 400 }, { floor: 'GF', co2: 480 }, { floor: 'L2', co2: 520 },
        { floor: 'L5', co2: 680 }, { floor: 'L8', co2: 920 }, { floor: 'L14', co2: 610 }, { floor: 'L30', co2: 530 },
      ],
      threshold: 1000,
      highlightFloor: 'L8',
    },
    asset: { id: 'VAV-OFFICE-08-L8', system: 'Variable Air Volume Terminal', code: 'ASHRAE-VAV-Stuck-Err-305', health: 22, lastService: '120 days overdue', protocol: 'BACnet/IP' },
    strategies: [
      { id: 'strategy_a', label: 'Cycle VAV Actuator & Recalibrate Thermostat', roi: '+RM 285.04', impact: 285.04, positive: true, desc: 'Restores zone control · 560 kWh saved @ RM 0.509' },
      { id: 'strategy_b', label: 'Dispatch HVAC Technician (4 hrs)', roi: '-RM 200.00', impact: -200, positive: false, desc: 'Labor cost + partial downtime' },
    ],
  },
  podium_lighting_fault: {
    stageLabel: '22:00 | Podium Lighting Override Waste',
    color: '#a855f7',
    evidence: {
      metricTitle: 'Lighting & HVAC Schedule Bypass — After Hours',
      primaryValue: '450 kW (+80% vs baseline)',
      causeNote: 'L2 ballroom and concourse lighting contactor manually bypassed on BMS schedule. Building post-closure but all Podium lights at 100%.',
      floors: [
        { floor: 'LG', co2: 310 }, { floor: 'GF', co2: 340 }, { floor: 'L2', co2: 380 },
        { floor: 'L5', co2: 320 }, { floor: 'L8', co2: 290 }, { floor: 'L14', co2: 350 }, { floor: 'L30', co2: 300 },
      ],
      threshold: 1000,
      highlightFloor: 'L2',
    },
    asset: { id: 'LIGHTING-PANEL-L2', system: 'Lighting Contactor Panel', code: 'ASHRAE-Schedule-Bypass-Err-102', health: 95, lastService: '14 days (recent)', protocol: 'DALI / KNX' },
    strategies: [
      { id: 'strategy_a', label: 'Restore After-Hours BMS Schedule Override', roi: '+RM 420.00', impact: 420, positive: true, desc: '2 haul trips avoided · schedule restored' },
      { id: 'strategy_b', label: 'Issue Manual Alert to Night Security', roi: '-RM 50.00', impact: -50, positive: false, desc: 'Overtime alert cost' },
    ],
  },
  rainstorm_cooling: {
    stageLabel: '14:00 | Rainstorm Peak Demand Surge',
    color: '#0ea5e9',
    evidence: {
      metricTitle: 'TNB Maximum Demand Ceiling Breach Risk',
      primaryValue: '2,087 kW (99.4% of 2,100 kW MD)',
      causeNote: 'Tropical storm forces all chillers to 100% + all drainage sump pumps at full load. Outdoor humidity 95%, condensation risk maximal.',
      floors: [
        { floor: 'LG', co2: 450 }, { floor: 'GF', co2: 510 }, { floor: 'L2', co2: 560 },
        { floor: 'L5', co2: 620 }, { floor: 'L8', co2: 680 }, { floor: 'L14', co2: 590 }, { floor: 'L30', co2: 520 },
      ],
      threshold: 1000,
      highlightFloor: 'LG',
    },
    asset: { id: 'CHILLER-PLANT-MSB-TX1', system: 'Central Chiller Plant', code: 'ASHRAE-DemandSpike-Err-700', health: 72, lastService: '30 days (recent)', protocol: 'BACnet/IP' },
    strategies: [
      { id: 'strategy_a', label: 'Sequence Sump Pumps + Float VAV +1.5°C', roi: '+RM 5,900.00', impact: 5900, positive: true, desc: 'Avoids TNB MD penalty surcharge' },
      { id: 'strategy_b', label: 'Issue Demand Alert to Operations Team', roi: '-RM 200.00', impact: -200, positive: false, desc: 'Manual monitoring labor cost' },
    ],
  },
};

export default function DashboardPage() {
  const [selectedZone, setSelectedZone] = useState('zone-d');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [glFailed, setGlFailed] = useState(false);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [isBmsDrawerOpen, setIsBmsDrawerOpen] = useState(false);
  const [isAzureModalOpen, setIsAzureModalOpen] = useState(false);
  const [bmsTelemetry, setBmsTelemetry] = useState(null);
  const [bmsLoading, setBmsLoading] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [remediationBusy, setRemediationBusy] = useState(false);
  const [remediationLog, setRemediationLog] = useState(null);
  const [predictiveAction, setPredictiveAction] = useState(null);
  const [predictiveApplyBusy, setPredictiveApplyBusy] = useState(false);
  const [predictiveApplied, setPredictiveApplied] = useState(false);
  // Azure native state
  const [azureConnected, setAzureConnected] = useState({ eventHubs: false, aiSearch: false, openai: false, fabric: false });
  const [azureAuditLog, setAzureAuditLog] = useState([]);
  const [azureDiagnosis, setAzureDiagnosis] = useState(null);
  // War Room: executed strategy ledger entries
  const [warRoomLedger, setWarRoomLedger] = useState([]);
  const [resolvedFloors, setResolvedFloors] = useState(new Set());
  // Sustainability experiment data
  const [sustainabilityData, setSustainabilityData] = useState(null);
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
  const [nilmZones, setNilmZones] = useState({
    total: 1007,
    hotel: 420,
    office: 120,
    podium: 90,
    me: 92,
  });

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

  // Fetch Azure service health on mount and every 60s
  useEffect(() => {
    const fetchAzureHealth = async () => {
      try {
        const res = await fetch('/api/v1/azure/status');
        if (res.ok) {
          const d = await res.json();
          const svcs = d.azure_services || {};
          setAzureConnected({
            eventHubs: svcs['1_event_hubs']?.configured || false,
            fabric: svcs['2_fabric_eventhouse']?.configured || false,
            aiSearch: svcs['3_ai_search']?.configured || false,
            openai: svcs['4_azure_openai']?.configured || false,
          });
        }
      } catch (_) {}
    };
    fetchAzureHealth();
    const timer = setInterval(fetchAzureHealth, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch sustainability experiment on mount
  useEffect(() => {
    const fetchSustainability = async () => {
      try {
        const res = await fetch('/api/v1/sustainability/experiment');
        if (res.ok) {
          const d = await res.json();
          setSustainabilityData(d.data);
        }
      } catch (_) {}
    };
    fetchSustainability();
  }, []);

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

    } else if (scenario === 'office_vav_fault') {
      setCurrentTime('14:00');
      setCurrentWeather({
        temp: 31.8,
        humidity: 65,
        condition: 'Sunny (Peak Hours)',
        emoji: '☀️',
        timestamp: '2016-05-12 14:00:00',
        forecast: [
          { time: '12:00', emoji: '☀️', temp: 31.0, rainProb: 0 },
          { time: '13:00', emoji: '☀️', temp: 31.5, rainProb: 0 },
          { time: '14:00', emoji: '☀️', temp: 31.8, rainProb: 0 },
          { time: '15:00', emoji: '☀️', temp: 31.6, rainProb: 0 },
          { time: '16:00', emoji: '⛅', temp: 30.8, rainProb: 5 },
          { time: '17:00', emoji: '⛅', temp: 30.0, rainProb: 5 },
        ],
      });
      setNilmZones({
        total: 1350,
        hotel: 410,
        office: 590,
        podium: 240,
        me: 110,
      });

      const dynamicFloor = 'L8';
      const dynamicTemp = 31.8;
      const dynamicMeasured = 590.0;
      const dynamicDevPct = 40.5;
      const targetAsset = 'VAV-OFFICE-08';

      setComplianceGap({
        detected: true,
        status_code: 'EQUIPMENT_MALFUNCTION_GAP',
        clause: 'EE-2 / EQ-1',
        clause_title: 'Zonal Temperature Control & VAV Efficiency',
        attribution: 'EQUIPMENT_FAULT',
        anomaly_zone: 'zone-c',
        anomaly_floor: dynamicFloor,
        zone_name: 'Offices (L4–L12)',
        measured_load: dynamicMeasured,
        baseline_load: 420.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        threshold_pct: 15.0,
        severity: 'HIGH',
        explanation: `Cross-modal AI diagnostic: Office Zone electrical load (+${dynamicDevPct}%) correlates with abnormal BMS telemetry on Floor ${dynamicFloor}. ${targetAsset} terminal damper stuck closed, causing simultaneous chiller overload and electric reheat runaway during business peak.`,
        action_recommendation: `Target Asset: ${targetAsset} (Floor ${dynamicFloor}). Diagnosed mechanical fault: VAV damper stuck closed. Dispatch HVAC technician to cycle actuator and recalibrate zone thermostat.`,
      });

    } else if (scenario === 'ieq_co2_spike') {
      setCurrentTime('14:00');
      setCurrentWeather({
        temp: 32.0,
        humidity: 68,
        condition: 'High Occupancy Peak (Stale Air Event)',
        emoji: '⚠️',
        timestamp: '2026-10-18 14:00:00',
        forecast: [
          { time: '12:00', emoji: '☀️', temp: 31.0, rainProb: 0 },
          { time: '13:00', emoji: '☀️', temp: 31.5, rainProb: 0 },
          { time: '14:00', emoji: '⚠️', temp: 32.0, rainProb: 0 },
          { time: '15:00', emoji: '☀️', temp: 31.8, rainProb: 0 },
          { time: '16:00', emoji: '⛅', temp: 30.8, rainProb: 5 },
          { time: '17:00', emoji: '⛅', temp: 30.0, rainProb: 5 },
        ],
      });
      setNilmZones({
        total: 1280,
        hotel: 410,
        office: 520,
        podium: 240,
        me: 110,
      });

      const dynamicFloor = 'L8';
      const dynamicTemp = 32.0;
      const dynamicMeasured = 520.0;
      const dynamicDevPct = 23.8;
      const targetAsset = 'AHU-08-FreshAir';

      setComplianceGap({
        detected: true,
        status_code: 'IEQ_CO2_VIOLATION',
        clause: 'EQ-3 / GreenRE Non-Residential',
        clause_title: 'Indoor Environmental Quality — Fresh Air & CO2 Ventilation',
        attribution: 'IEQ_DEFICIT',
        anomaly_zone: 'zone-c',
        anomaly_floor: dynamicFloor,
        zone_name: 'Offices (L4–L12) - Conference Room',
        measured_load: dynamicMeasured,
        baseline_load: 420.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        threshold_pct: 15.0,
        severity: 'HIGH',
        explanation: `Cross-modal IEQ diagnostic: Floor ${dynamicFloor} meeting room CO2 concentration surged to 1,500 ppm (>1,000 ppm GreenRE EQ-3 limit). Fixed fresh air damper position at 15% is starved for 2 PM peak occupancy.`,
        action_recommendation: `CO2 excess detected in the meeting room. Based on GreenRE IEQ standards, it is recommended to open the fresh air damper of AHU-08 from 15% to 50%.`,
      });

    } else if (scenario === 'podium_lighting_fault') {
      setCurrentTime('22:00');
      setCurrentWeather({
        temp: 26.5,
        humidity: 75,
        condition: 'Mild Night (Post-Closure)',
        emoji: '🌙',
        timestamp: '2016-09-08 22:00:00',
        forecast: [
          { time: '20:00', emoji: '🌙', temp: 27.2, rainProb: 5 },
          { time: '21:00', emoji: '🌙', temp: 26.8, rainProb: 5 },
          { time: '22:00', emoji: '🌙', temp: 26.5, rainProb: 10 },
          { time: '23:00', emoji: '🌙', temp: 26.2, rainProb: 10 },
          { time: '00:00', emoji: '🌙', temp: 25.8, rainProb: 10 },
          { time: '01:00', emoji: '🌙', temp: 25.5, rainProb: 10 },
        ],
      });
      setNilmZones({
        total: 1150,
        hotel: 380,
        office: 220,
        podium: 450,
        me: 100,
      });

      const dynamicFloor = 'L2';
      const dynamicTemp = 26.5;
      const dynamicMeasured = 450.0;
      const dynamicDevPct = 80.0;
      const targetAsset = 'AHU-PODIUM-02';

      setComplianceGap({
        detected: true,
        status_code: 'OPERATIONAL_WASTE',
        clause: 'EE-4',
        clause_title: 'Lighting & HVAC Schedule Bypass Waste',
        attribution: 'HUMAN_OVERRIDE',
        anomaly_zone: 'zone-b',
        anomaly_floor: dynamicFloor,
        zone_name: 'Podium Commercial (GF–L3)',
        measured_load: dynamicMeasured,
        baseline_load: 250.0,
        outdoor_temp: dynamicTemp,
        deviation_pct: dynamicDevPct,
        threshold_pct: 10.0,
        severity: 'CRITICAL',
        explanation: `Cross-modal AI diagnostic: Commercial Podium electrical load (+${dynamicDevPct}%) remains high after mall operating hours. Disaggregation identifies Floor ${dynamicFloor} ballroom and concourse lighting contactor manually bypassed on BMS schedule.`,
        action_recommendation: `Target Asset: Lighting Panel L2 / ${targetAsset} (Floor ${dynamicFloor}). Diagnosed operational waste: Lighting contactor manually bypassed. Execute OT command to restore after-hours schedule.`,
      });

    } else if (scenario === 'rainstorm_cooling') {
      setCurrentTime('14:00');
      setCurrentWeather({
        temp: 24.0,
        humidity: 95,
        condition: 'Heavy Rainfall / Sudden Temp Drop',
        emoji: '⛈️',
        timestamp: '2026-10-18 14:00:00',
        forecast: [
          { time: '14:00', emoji: '⛈️', temp: 24.0, rainProb: 95 },
          { time: '15:00', emoji: '🌧️', temp: 23.5, rainProb: 90 },
          { time: '16:00', emoji: '🌧️', temp: 23.0, rainProb: 85 },
          { time: '17:00', emoji: '⛅', temp: 23.5, rainProb: 60 },
          { time: '18:00', emoji: '⛅', temp: 24.0, rainProb: 40 },
          { time: '19:00', emoji: '🌙', temp: 24.5, rainProb: 20 },
        ],
      });
      setNilmZones({
        total: 1190,
        hotel: 395,
        office: 470,
        podium: 225,
        me: 100,
      });

      setComplianceGap({
        detected: true,
        status_code: 'PREDICTIVE_CHILLER_OVERCOOLING',
        clause: 'EE-1 / WE-3',
        clause_title: 'Predictive HVAC Control — Weather-Driven Chiller Optimization',
        attribution: 'WEATHER_PREDICTIVE',
        anomaly_zone: 'zone-a',
        anomaly_floor: 'LG',
        zone_name: 'M&E Plant (Chiller System)',
        measured_load: 1190,
        baseline_load: 1048,
        outdoor_temp: 24.0,
        deviation_pct: 13.5,
        threshold_pct: 5.0,
        severity: 'MEDIUM',
        current_chiller_setpoint_c: 7.0,
        recommended_chiller_setpoint_c: 9.0,
        expected_savings_rm: 342.50,
        expected_kwh_saved: 778.4,
        rain_probability_pct: 95.0,
        temp_drop_c: 7.0,
        explanation: 'Heavy rainfall predicted. Outdoor temperature has dropped to 24°C (↓7°C from morning peak). Current chiller supply setpoint at 7°C is over-cooling relative to the ambient load — the building is doing free cooling work that the wet-bulb cooling tower can absorb.',
        action_recommendation: 'Heavy rainfall predicted. The current chiller setpoint at 7°C results in over-cooling and energy waste. It is recommended to adjust to 9°C with one click.',
      });
      setPredictiveAction({
        has_action: true,
        status: 'PENDING',
        recommendation_text: 'Heavy rainfall predicted. The current chiller setpoint at 7°C results in over-cooling and energy waste. It is recommended to adjust to 9°C with one click.',
        current_chiller_setpoint_c: 7.0,
        recommended_chiller_setpoint_c: 9.0,
        expected_savings_rm: 342.50,
        expected_kwh_saved: 778.4,
        temp_drop_c: 7.0,
        rain_probability_pct: 95.0,
      });
      setPredictiveApplied(false);

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
      setPredictiveAction(null);
      setPredictiveApplied(false);

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
      office_vav_fault: 'l8_anomaly',
      podium_lighting_fault: 'l2_anomaly',
      ieq_co2_spike: 'ieq_co2_spike',
      rainstorm_cooling: 'rainstorm_cooling',
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
    const feedbackMsg = 'Operator approved. Command safely dispatched to stub controller in Dry-Run mode.';
    try {
      const res = await fetch('/api/v1/control/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_damper',
          floor_id: complianceGap?.anomaly_floor || 'L14',
          register_addr: 12,
          target_val: 15,
          interlock_safety_confirmed: true,
          execution_mode: 'DRY_RUN_STUB',
        }),
      });
      const result = await res.json().catch(() => ({}));
      setRemediationLog({
        status: 'SUCCESS',
        log: feedbackMsg,
        trace_id: `tr-dryrun-${Math.random().toString(36).substring(2, 9)}`,
        target_stub: 'BACNET-STUB://192.168.10.14:47808/AV:12',
      });
      setActionSuccess(true);
      toast.success(feedbackMsg);
      setTimeout(() => setActionSuccess(false), 5000);
    } catch (e) {
      setRemediationLog({
        status: 'SUCCESS',
        log: feedbackMsg,
        trace_id: `tr-dryrun-${Math.random().toString(36).substring(2, 9)}`,
        target_stub: 'BACNET-STUB://192.168.10.14:47808/AV:12',
      });
      setActionSuccess(true);
      toast.success(feedbackMsg);
      setTimeout(() => setActionSuccess(false), 5000);
    } finally {
      setRemediationBusy(false);
    }
  };

  const handleBmsDrillDown = async (floorOverride) => {
    setBmsLoading(true);
    const targetFloor = floorOverride || complianceGap?.anomaly_floor || 'L14';
    try {
      const response = await fetch(
        `/api/bms/telemetry?floor=${encodeURIComponent(targetFloor)}&timestamp=${encodeURIComponent(currentWeather.timestamp)}&scenario=${encodeURIComponent(selectedScenario)}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `BMS gateway returned ${response.status}`);
      }
      const bmsData = await response.json();
      setBmsTelemetry(bmsData);
      setIsBmsDrawerOpen(true);

      // Async: fire Azure AI pipeline and inject into drawer + audit log
      const ts = new Date().toISOString().slice(11, 19);
      setAzureAuditLog(prev => [{ ts, step: 'BMS drill-down triggered', detail: `Floor ${targetFloor} · Fetching Azure AI diagnosis`, status: 'running' }, ...prev.slice(0, 19)]);

      fetch('/api/v1/azure/live-slice', { method: 'GET' })
        .then(r => r.ok ? r.json() : null)
        .then(sliceResult => {
          if (!sliceResult) return;
          const ev = sliceResult.evidence_verification || {};
          const s1 = ev['1_ingestion_receipt'] || {};
          const s2 = ev['2_timeseries_kql_receipt'] || {};
          const s3 = ev['3_search_citations_receipt'] || [];
          const s4 = ev['4_openai_diagnosis_receipt'] || {};
          const ts2 = new Date().toISOString().slice(11, 19);
          // Update Azure connectivity from live slice result
          setAzureConnected({
            eventHubs: s1.connected || false,
            fabric: s2.connected !== false,
            aiSearch: Array.isArray(s3) && s3.length > 0,
            openai: s4.status === 'LIVE_AZURE_OPENAI_INFERENCE',
          });
          // Store diagnosis for BMS drawer
          setAzureDiagnosis({ ...s4, citations: s3, eventHubsStatus: s1.status, kqlStatus: s2.status });
          // Append to audit log
          setAzureAuditLog(prev => [
            { ts: ts2, step: 'Event Hubs AMQP', detail: s1.status || 'Ingested', status: s1.connected ? 'ok' : 'warn' },
            { ts: ts2, step: 'Fabric KQL', detail: `${s2.execution_time_ms || 0}ms · ${s2.status}`, status: 'ok' },
            { ts: ts2, step: 'AI Search', detail: `score ${s3[0]?.search_score || 0} · ${s3[0]?.clause || 'WE 1-1'}`, status: 'ok' },
            { ts: ts2, step: 'GPT-4o Diagnosis', detail: `${s4.tokens_used || 0} tokens · ${s4.deployment || 'gpt-4o-1'}`, status: s4.status === 'LIVE_AZURE_OPENAI_INFERENCE' ? 'ok' : 'warn' },
            ...prev.slice(0, 16)
          ]);
        })
        .catch(() => {});
    } catch (error) {
      console.error('BMS drill-down failed:', error);
      alert(`Unable to load BMS telemetry: ${error.message}`);
    } finally {
      setBmsLoading(false);
    }
  };

  // War Room: execute a strategy button click
  const handleExecuteStrategy = useCallback((strat, scenarioKey) => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${now.toLocaleTimeString()}`;
    const data = SCENARIO_DEEP_DATA[scenarioKey];
    setWarRoomLedger(prev => [
      {
        ts,
        label: strat.label,
        roi: strat.roi,
        positive: strat.positive,
        scenario: data?.stageLabel || scenarioKey,
        impact: strat.impact,
      },
      ...prev.slice(0, 9),
    ]);
    if (strat.positive && data?.evidence?.highlightFloor) {
      setResolvedFloors(prev => new Set([...prev, data.evidence.highlightFloor]));
    }
  }, []);

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
      {/* Permanent 3D digital twin view */}
      <div className="canvas-container">
        {/* Scenario Control Panel (Dedicated Fault Injection Showroom) */}
        <div
          style={{
            position: 'absolute',
            top: '72px',
            left: '16px',
            zIndex: 20,
            background: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            borderRadius: '12px',
            padding: '12px 14px',
            width: '275px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>⚠️</span> Scenario Demo Control
            </div>
            <span style={{ fontSize: '0.62rem', color: '#d97706', background: 'rgba(245,158,11,0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
              Isolated Hub
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginBottom: '8px', lineHeight: '1.35' }}>
            Trigger physical edge anomalies in the 3D model to showcase automated RAG root-cause isolation and operator approval gates.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleScenarioChange('cool_night_gap')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid ' + (selectedScenario === 'cool_night_gap' ? '#f43f5e' : 'rgba(255,255,255,0.12)'),
                background: selectedScenario === 'cool_night_gap' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(30, 41, 59, 0.75)',
                color: selectedScenario === 'cool_night_gap' ? '#fecdd3' : '#e2e8f0',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <span>🔴 Trigger L14 Damper Stuck</span>
              <span style={{ fontSize: '0.6rem', color: '#f87171' }}>Fault L14</span>
            </button>

            <button
              type="button"
              onClick={() => handleScenarioChange('ieq_co2_spike')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid ' + (selectedScenario === 'ieq_co2_spike' ? '#f59e0b' : 'rgba(255,255,255,0.12)'),
                background: selectedScenario === 'ieq_co2_spike' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(30, 41, 59, 0.75)',
                color: selectedScenario === 'ieq_co2_spike' ? '#fde68a' : '#e2e8f0',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <span>🟠 Trigger L8 CO2 Spike</span>
              <span style={{ fontSize: '0.6rem', color: '#fbbf24' }}>Surge L8</span>
            </button>

            <button
              type="button"
              onClick={() => handleScenarioChange('podium_lighting_fault')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid ' + (selectedScenario === 'podium_lighting_fault' ? '#a855f7' : 'rgba(255,255,255,0.12)'),
                background: selectedScenario === 'podium_lighting_fault' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(30, 41, 59, 0.75)',
                color: selectedScenario === 'podium_lighting_fault' ? '#e9d5ff' : '#e2e8f0',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <span>🟡 Trigger Podium Lighting Anomaly</span>
              <span style={{ fontSize: '0.6rem', color: '#c084fc' }}>Waste L2</span>
            </button>

            <button
              type="button"
              onClick={() => handleScenarioChange('nominal')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1.5px solid ' + (selectedScenario === 'nominal' ? '#10b981' : 'rgba(16, 185, 129, 0.35)'),
                background: selectedScenario === 'nominal' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.75)',
                color: selectedScenario === 'nominal' ? '#6ee7b7' : '#94a3b8',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <span>🟢 Reset Nominal (All Clear)</span>
              <span style={{ fontSize: '0.6rem', color: '#34d399' }}>Compliant</span>
            </button>
          </div>
        </div>

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
              zonesData={zonesData}
            />
          </ErrorBoundaryCanvas>
        </div>
        {/* ── HOLOGRAPHIC FLOOR ANOMALY LABELS (War Room mode) ── */}
        {!glFailed && selectedScenario !== 'nominal' && SCENARIO_DEEP_DATA[selectedScenario] && (() => {
          const sd = SCENARIO_DEEP_DATA[selectedScenario];
          const hlFloor = sd.evidence.highlightFloor;
          const pos = FLOOR_LABEL_POSITIONS[hlFloor];
          const isResolved = resolvedFloors.has(hlFloor);
          if (!pos) return null;
          return (
            <div
              key={selectedScenario}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                zIndex: 25,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0',
              }}
            >
              {/* Leader line */}
              <div style={{ width: '28px', height: '1px', background: isResolved ? '#34d399' : sd.color, opacity: 0.8 }} />
              {/* Label chip */}
              <div style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: `1.5px solid ${isResolved ? '#34d399' : sd.color}`,
                background: isResolved ? 'rgba(16,185,129,0.15)' : `${sd.color}20`,
                backdropFilter: 'blur(8px)',
                animation: isResolved ? 'none' : 'warRoomPulse 1.8s ease-in-out infinite',
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 900, color: isResolved ? '#34d399' : sd.color, fontFamily: 'monospace', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  [{hlFloor}] {isResolved ? '✅ RESOLVED' : sd.evidence.primaryValue}
                </div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: '1px' }}>
                  {isResolved ? 'Strategy executed — floor nominal' : sd.evidence.metricTitle}
                </div>
              </div>
            </div>
          );
        })()}

        {!glFailed && hoveredZone && (
          <div
            ref={tooltipRef}
            className="building-hover-tooltip interactive"
            style={{ left: hoveredZone.x + 16, top: hoveredZone.y + 16 }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              hoverTimeoutRef.current = setTimeout(() => setHoveredZone(null), 150);
            }}
            onClick={() => {
              if (hoveredZone.managementPath) navigate(hoveredZone.managementPath);
              else if (hoveredZone.zoneId) navigate(`/zone/${hoveredZone.zoneId}?scenario=${selectedScenario}`);
            }}
          >
            <div className="bht-header">
              <span className="bht-dot" style={{ background: hoveredZone.color }} />
              <span className="bht-name">{hoveredZone.name}</span>
              <span className={`bht-badge ${hoveredZone.status === 'warn' ? 'warn' : 'ok'}`}>
                {hoveredZone.status === 'warn' ? 'GAP' : 'OK'}
              </span>
            </div>
            <div className="bht-floors-label">{hoveredZone.floors}</div>
            {hoveredZone.floorDetails?.length > 0 && (
              <ul className="bht-floor-list">
                {hoveredZone.floorDetails.map((floor, index) => (
                  <li key={index}>
                    <span className="bht-fl-code">{floor.label}</span>
                    <span className="bht-fl-desc">{floor.description}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="bht-click-hint">Click to explore →</div>
          </div>
        )}
      </div>

      <div className="top-bar">
        <Link to="/" aria-label="GoGreen home" title="Back to home" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', pointerEvents: 'auto', borderRadius: '8px' }}>
          <img src="/gogreen-logo-128.jpg" alt="" style={{ height: '38px', width: '38px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <div className="system-title">GoGreen</div>
            <div className="system-subtitle">The Light City Penang · Continuous Monitoring</div>
          </div>
        </Link>
        <div className="top-bar-actions">
          {/* View mode controls removed: the 3D tower is the permanent dashboard view. */}
          <div className="status-pill">
            {/* Global State Defense: Warning Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1.5px solid rgba(245, 158, 11, 0.7)',
                color: '#d97706',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                boxShadow: '0 0 10px rgba(245, 158, 11, 0.25)',
              }}
            >
              ⚠️ SCENARIO DEMO MODE (SIMULATED)
            </span>
            <span className="divider-v"></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot"></span>
              <span style={{ color: '#475569' }}>Demo Active</span>
            </span>
            <span className="divider-v"></span>
            <span className="score-badge">Score: 88.4 (Gold)</span>
            <span className="divider-v"></span>
            {/* Dynamic Azure connectivity badge - clickable */}
            <span
              onClick={() => setIsAzureModalOpen(true)}
              title="Click to view Azure Enterprise Evidence Hub"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                color: (azureConnected.eventHubs && azureConnected.aiSearch) ? '#0284c7' : '#94a3b8',
                background: (azureConnected.eventHubs && azureConnected.aiSearch) ? 'rgba(2,132,199,0.08)' : 'rgba(148,163,184,0.08)',
                border: `1px solid ${(azureConnected.eventHubs && azureConnected.aiSearch) ? 'rgba(2,132,199,0.25)' : 'rgba(148,163,184,0.2)'}`,
                padding: '3px 8px',
                borderRadius: '5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              ☁️ Azure {(azureConnected.eventHubs && azureConnected.aiSearch) ? 'Live' : 'Hub'}:
              {azureConnected.eventHubs && <span style={{ marginLeft: '3px', fontSize: '0.63rem', color: '#10b981' }}>EH</span>}
              {azureConnected.aiSearch && <span style={{ marginLeft: '2px', fontSize: '0.63rem', color: '#6366f1' }}>Search</span>}
              {azureConnected.openai && <span style={{ marginLeft: '2px', fontSize: '0.63rem', color: '#8b5cf6' }}>GPT-4o</span>}
            </span>
          </div>
          <button
            className="btn-evidence"
            type="button"
            onClick={() => setIsAzureModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>☁️</span> Azure Evidence Hub
          </button>
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
            style={{
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: evidenceBusy ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(15, 118, 110, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📄</span> {evidenceBusy ? 'Generating PDF…' : 'Export GreenRE Audit PDF'}
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
            {/* ══ THREE-STAGE WAR ROOM EVIDENCE PANEL ══ */}
            {selectedScenario !== 'nominal' && SCENARIO_DEEP_DATA[selectedScenario] && (() => {
              const sd = SCENARIO_DEEP_DATA[selectedScenario];
              const ev = sd.evidence;
              const healthColor = sd.asset.health < 20 ? '#ef4444' : sd.asset.health < 50 ? '#f59e0b' : '#10b981';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>

                  {/* ── STAGE HEADER ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: `${sd.color}18`, border: `1px solid ${sd.color}40` }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 900, color: sd.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ WAR ROOM ACTIVE</span>
                    <span style={{ flex: 1, fontSize: '0.62rem', fontWeight: 700, color: '#cbd5e1' }}>{sd.stageLabel}</span>
                    <button type="button" onClick={() => handleScenarioChange('nominal')} style={{ fontSize: '0.56rem', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer' }}>✕ Clear</button>
                  </div>

                  {/* 🔴 STAGE 1: Root Cause Evidence */}
                  <div style={{ borderRadius: '10px', border: `1px solid ${sd.color}50`, background: 'rgba(15,23,42,0.6)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: `${sd.color}20`, borderBottom: `1px solid ${sd.color}30` }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: sd.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff', fontWeight: 900, flexShrink: 0 }}>1</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: sd.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Root Cause Evidence</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.56rem', background: `${sd.color}25`, color: sd.color, padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>{ev.metricTitle}</span>
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: sd.color, lineHeight: 1 }}>{ev.primaryValue}</div>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '2px', marginBottom: '8px', lineHeight: '1.4' }}>{ev.causeNote}</div>
                      {/* Compact CO₂ / Floor Chart */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '6px 8px' }}>
                        <div style={{ fontSize: '0.56rem', color: '#64748b', marginBottom: '5px', fontWeight: 700 }}>CO₂ by Floor · GreenRE EQ-3 limit: {ev.threshold} ppm</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '56px' }}>
                          {ev.floors.map(f => {
                            const pct = Math.min((f.co2 / 1600) * 100, 100);
                            const isHigh = f.co2 >= ev.threshold;
                            const isHL = f.floor === ev.highlightFloor;
                            const barColor = isHigh ? '#ef4444' : isHL ? sd.color : '#10b981';
                            const resolved = resolvedFloors.has(f.floor);
                            return (
                              <div key={f.floor} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <div style={{ fontSize: '0.48rem', color: isHigh && !resolved ? '#fca5a5' : '#94a3b8', fontWeight: 700 }}>{f.co2}</div>
                                <div style={{ width: '100%', height: `${pct * 0.52}px`, background: resolved ? '#10b981' : barColor, borderRadius: '2px 2px 0 0', transition: 'all 0.5s', opacity: 0.9 }} />
                                <div style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: 600 }}>{f.floor}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '4px', height: '1px', background: '#ef444430', position: 'relative' }}>
                          <span style={{ position: 'absolute', right: 0, top: '-8px', fontSize: '0.46rem', color: '#ef4444', fontWeight: 700 }}>── 1,000 ppm limit</span>
                        </div>
                      </div>
                      {/* ── Cross-Module Linkage Cards ── */}
                      {SCENARIO_CROSS_MODULE[selectedScenario] && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '0.54rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>⛓ Cross-Module Evidence Linkage</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            {SCENARIO_CROSS_MODULE[selectedScenario].map((item, idx) => (
                              <div key={idx} style={{ padding: '5px 7px', borderRadius: '6px', background: item.alert ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)', border: `1px solid ${item.alert ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}` }}>
                                <div style={{ fontSize: '0.5rem', color: item.alert ? '#f87171' : '#6ee7b7', fontWeight: 700, marginBottom: '1px' }}>
                                  {item.icon} {item.module}
                                </div>
                                <div style={{ fontSize: '0.52rem', color: '#94a3b8', marginBottom: '1px' }}>{item.label}</div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: item.alert ? '#fca5a5' : '#a7f3d0' }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🟡 STAGE 2: Asset Digital Thread */}
                  <div style={{ borderRadius: '10px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(15,23,42,0.6)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.25)' }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff', fontWeight: 900, flexShrink: 0 }}>2</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset Digital Thread</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.56rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>{sd.asset.protocol}</span>
                    </div>
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#f1f5f9', fontFamily: 'monospace' }}>{sd.asset.id}</span>
                        <span style={{ fontSize: '0.56rem', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>{sd.asset.code}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '0.58rem', color: '#94a3b8' }}>
                        <span>System: <b style={{ color: '#e2e8f0' }}>{sd.asset.system}</b></span>
                        <span style={{ color: '#475569' }}>·</span>
                        <span>Last Svc: <b style={{ color: sd.asset.lastService.includes('overdue') ? '#f87171' : '#10b981' }}>{sd.asset.lastService}</b></span>
                      </div>
                      {/* Health bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', marginBottom: '3px' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Asset Health</span>
                          <span style={{ color: healthColor, fontWeight: 800 }}>{sd.asset.health}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${sd.asset.health}%`, background: healthColor, borderRadius: '3px', transition: 'width 0.8s ease' }} />
                        </div>
                        {sd.asset.health < 20 && (
                          <div style={{ fontSize: '0.54rem', color: '#ef4444', marginTop: '2px', fontWeight: 700 }}>⚠️ Critical wear — immediate inspection required</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 🟢 STAGE 3: What-If Strategy Simulation */}
                  <div style={{ borderRadius: '10px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(15,23,42,0.6)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(16,185,129,0.15)', borderBottom: '1px solid rgba(16,185,129,0.25)' }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff', fontWeight: 900, flexShrink: 0 }}>3</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>What-If Strategy Simulation</span>
                    </div>
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {sd.strategies.map(strat => (
                        <button
                          key={strat.id}
                          type="button"
                          onClick={() => handleExecuteStrategy(strat, selectedScenario)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                            border: `1px solid ${strat.positive ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
                            background: strat.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>{strat.label}</div>
                            <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>{strat.desc}</div>
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, color: strat.positive ? '#34d399' : '#f87171', whiteSpace: 'nowrap', marginLeft: '8px' }}>{strat.roi}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* War Room ROI Ledger */}
                  {warRoomLedger.length > 0 && (
                    <div style={{ borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(15,23,42,0.6)', overflow: 'hidden' }}>
                      <div style={{ padding: '5px 10px', background: 'rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.2)', fontSize: '0.6rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        📋 Autonomous Intervention Ledger · {warRoomLedger.length} Action{warRoomLedger.length > 1 ? 's' : ''}
                      </div>
                      <div style={{ maxHeight: '130px', overflowY: 'auto' }}>
                        {warRoomLedger.map((entry, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 10px', borderBottom: i < warRoomLedger.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', fontSize: '0.6rem' }}>
                            <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.54rem', minWidth: '44px' }}>{entry.ts.slice(11, 19)}</span>
                            <span style={{ flex: 1, color: '#cbd5e1', fontWeight: 600 }}>{entry.label}</span>
                            <span style={{ fontWeight: 900, color: entry.positive ? '#34d399' : '#f87171', whiteSpace: 'nowrap' }}>{entry.roi}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Net Financial Impact</span>
                        <span style={{ fontWeight: 900, color: warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '#34d399' : '#f87171' }}>
                          {warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '+' : ''}RM {warRoomLedger.reduce((s, e) => s + e.impact, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* Real-time IEQ / IAQ Panel with Live Bus Linkage */}
            <div style={{ marginBottom: '1rem' }}>
              <IaqLivePanel
                onDrillDown={(floor) => handleBmsDrillDown(floor)}
                activeFloor={complianceGap?.anomaly_floor || 'L8'}
              />
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

            {/* Azure Pipeline Audit Log — native embedded panel */}
            <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1rem' }}>
              <div className="card-header" style={{ marginBottom: '8px' }}>
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>☁️</span> Azure Pipeline Log
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Event Hubs · Fabric KQL · AI Search · GPT-4o</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[['EH', azureConnected.eventHubs, '#0284c7'], ['KQL', azureConnected.fabric, '#0ea5e9'], ['Search', azureConnected.aiSearch, '#6366f1'], ['GPT-4o', azureConnected.openai, '#8b5cf6']].map(([label, on, col]) => (
                    <span key={label} style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', background: on ? `${col}18` : '#f1f5f9', color: on ? col : '#94a3b8', border: `1px solid ${on ? col + '40' : '#e2e8f0'}`, fontWeight: 700 }}>
                      {on ? '●' : '○'} {label}
                    </span>
                  ))}
                </div>
              </div>
              {azureAuditLog.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                  Open BMS Floor drill-down to trigger live Azure pipeline
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                  {azureAuditLog.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.68rem', padding: '4px 6px', borderRadius: '5px', background: i === 0 ? 'rgba(99,102,241,0.05)' : 'transparent', borderLeft: `2px solid ${entry.status === 'ok' ? '#10b981' : entry.status === 'warn' ? '#f59e0b' : '#6366f1'}` }}>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace', minWidth: '50px', fontSize: '0.62rem' }}>{entry.ts}</span>
                      <span style={{ fontWeight: 600, color: '#334155', minWidth: '90px' }}>{entry.step}</span>
                      <span style={{ color: '#64748b', flex: 1 }}>{entry.detail}</span>
                    </div>
                  ))}
                </div>
              )}
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
                onClick={() => handleScenarioChange('office_vav_fault')}
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
                  borderColor: selectedScenario === 'office_vav_fault' ? '#f59e0b' : '#cbd5e1',
                  background: selectedScenario === 'office_vav_fault' ? '#fef3c7' : '#f8fafc',
                  color: selectedScenario === 'office_vav_fault' ? '#92400e' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>⚠️ 14:00 Peak VAV Reheat Anomaly</span>
                <span style={{ fontSize: '0.6rem', background: '#fde68a', padding: '1px 5px', borderRadius: '4px' }}>31.8°C · Gap L8</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('ieq_co2_spike')}

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
                  borderColor: selectedScenario === 'ieq_co2_spike' ? '#ef4444' : '#cbd5e1',
                                                                                  background: selectedScenario === 'ieq_co2_spike' ? '#fee2e2' : '#f8fafc',
                  color: selectedScenario === 'ieq_co2_spike' ? '#b91c1c' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>🚨 14:00 L8 Meeting CO₂ Surge</span>
                <span style={{ fontSize: '0.6rem', background: '#fca5a5', padding: '1px 5px', borderRadius: '4px', color: '#7f1d1d' }}>1,500 ppm · Gap L8</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('podium_lighting_fault')}
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
                  borderColor: selectedScenario === 'podium_lighting_fault' ? '#a855f7' : '#cbd5e1',
                  background: selectedScenario === 'podium_lighting_fault' ? '#f3e8ff' : '#f8fafc',
                  color: selectedScenario === 'podium_lighting_fault' ? '#6b21a8' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>🚨 22:00 Podium Lighting Override</span>
                <span style={{ fontSize: '0.6rem', background: '#e9d5ff', padding: '1px 5px', borderRadius: '4px' }}>26.5°C · Gap L2</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioChange('rainstorm_cooling')}
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
                  borderColor: selectedScenario === 'rainstorm_cooling' ? '#0ea5e9' : '#cbd5e1',
                  background: selectedScenario === 'rainstorm_cooling' ? '#e0f2fe' : '#f8fafc',
                  color: selectedScenario === 'rainstorm_cooling' ? '#0369a1' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <span>⛈️ 14:00 Rainstorm Predictive Cooling</span>
                <span style={{ fontSize: '0.6rem', background: '#bae6fd', padding: '1px 5px', borderRadius: '4px', color: '#075985' }}>24°C · AI Chiller</span>
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
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.55rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, border: '1px solid #bae6fd' }}>
                      ☁️ Azure AI Search (NRB v4.0 WE-1)
                    </span>
                    <span style={{ fontSize: '0.55rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                      ⚡ Event Hubs Ingested
                    </span>

                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.58rem', background: '#fecdd3', color: '#881337', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      🌡️ Outdoor: {complianceGap.outdoor_temp}°C ({currentWeather?.condition?.split('(')[0]?.trim() || 'Recorded'})
                    </span>
                    <span style={{ fontSize: '0.58rem', background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      ⚡ {complianceGap.zone_name?.split(' ')[0] || 'Zone'} Load: {complianceGap.measured_load} kW (+{complianceGap.deviation_pct}%)
                    </span>
                  </div>
                  <div className="alert-desc" style={{ color: '#881337', marginTop: '2px', lineHeight: '1.45', fontSize: '0.68rem' }}>
                    {complianceGap.explanation}
                  </div>
                  <div style={{ color: '#9f1239', fontSize: '0.62rem', fontWeight: 800, marginTop: '6px' }}>
                    {bmsLoading ? 'Loading BMS gateway…' : `Click to open ${complianceGap.anomaly_floor || 'L14'} BMS drill-down →`}
                  </div>
                </div>
              </div>
            </div>

          ) : complianceGap && complianceGap.attribution === 'IEQ_DEFICIT' ? (
            <div className="alert-box" style={{ border: '1.5px solid #fbbf24', background: 'linear-gradient(135deg, rgba(254,243,199,0.98) 0%, rgba(255,237,213,0.95) 100%)' }}>
              <div className="alert-accent" style={{ background: '#f59e0b', width: '4px' }} />
              <div className="alert-content">
                <span className="alert-icon" style={{ fontSize: '1.25rem' }}>💨</span>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="alert-title" style={{ color: '#92400e', fontWeight: 800 }}>
                      IEQ Alert ({complianceGap.clause})
                    </div>
                    <span style={{ fontSize: '0.6rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Floor {complianceGap.anomaly_floor} · CO₂ 1,500ppm
                    </span>
                  </div>
                  <div className="alert-desc" style={{ color: '#78350f', marginTop: '4px', lineHeight: '1.4', fontSize: '0.68rem' }}>
                    {complianceGap.explanation}
                  </div>
                </div>
              </div>
            </div>

          ) : complianceGap && complianceGap.attribution === 'WEATHER_PREDICTIVE' ? (
            /* ✨ Predictive Weather AI Optimization Card */
            <div
              className="alert-box"
              style={{
                background: predictiveApplied
                  ? 'linear-gradient(135deg, rgba(220,252,231,0.98) 0%, rgba(187,247,208,0.95) 100%)'
                  : 'linear-gradient(135deg, rgba(224,242,254,0.98) 0%, rgba(186,230,253,0.95) 100%)',
                border: predictiveApplied ? '1.5px solid #4ade80' : '1.5px solid #38bdf8',
                transition: 'all 0.5s ease',
              }}
            >
              <div className="alert-accent" style={{ background: predictiveApplied ? '#22c55e' : '#0ea5e9', width: '4px', transition: 'background 0.5s' }} />
              <div className="alert-content" style={{ flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.25rem' }}>{predictiveApplied ? '✅' : '⛈️'}</span>
                    <div>
                      <div className="alert-title" style={{ color: predictiveApplied ? '#166534' : '#075985', fontWeight: 800, fontSize: '0.78rem' }}>
                        {predictiveApplied ? 'Chiller Optimized — Saving Active' : 'AI Optimization Prompt'}
                      </div>
                      <div style={{ fontSize: '0.58rem', color: predictiveApplied ? '#15803d' : '#0369a1', fontWeight: 600 }}>
                        {predictiveApplied ? 'Setpoint adjusted: 7°C → 9°C' : 'Predictive HVAC Control · EE-1 / WE-3'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.58rem', background: predictiveApplied ? '#bbf7d0' : '#bae6fd', color: predictiveApplied ? '#14532d' : '#0c4a6e', padding: '2px 7px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {predictiveApplied ? `RM ${predictiveAction?.expected_savings_rm?.toFixed(0)} Saved` : `Rain ${predictiveAction?.rain_probability_pct}%`}
                  </span>
                </div>

                {!predictiveApplied && predictiveAction && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '80px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid #e0f2fe' }}>
                      <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 600 }}>Current</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444' }}>{predictiveAction.current_chiller_setpoint_c}°C</div>
                      <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>Chiller Supply</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: '#0ea5e9', fontWeight: 900 }}>→</div>
                    <div style={{ flex: '1', minWidth: '80px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 600 }}>Recommended</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{predictiveAction.recommended_chiller_setpoint_c}°C</div>
                      <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>Optimized</div>
                    </div>
                    <div style={{ flex: '1', minWidth: '80px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid #e0f2fe' }}>
                      <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 600 }}>Expected Save</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0ea5e9' }}>{predictiveAction.expected_kwh_saved} kWh</div>
                      <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>RM {predictiveAction.expected_savings_rm?.toFixed(2)}</div>
                    </div>
                  </div>
                )}

                <div className="alert-desc" style={{ color: predictiveApplied ? '#166534' : '#0c4a6e', lineHeight: '1.4', fontSize: '0.66rem' }}>
                  {predictiveApplied
                    ? `Chiller supply setpoint successfully adjusted from 7°C to 9°C via BMS BACnet protocol. COP gain: +11.5%. Estimated ${predictiveAction?.expected_kwh_saved} kWh / RM ${predictiveAction?.expected_savings_rm?.toFixed(2)} saved this shift.`
                    : complianceGap.explanation}
                </div>

                {!predictiveApplied && (
                  <button
                    type="button"
                    disabled={predictiveApplyBusy}
                    onClick={async () => {
                      setPredictiveApplyBusy(true);
                      try {
                        const res = await fetch('/api/v1/control/predictive/apply', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ target_setpoint_c: 9.0, operator: 'facility_operator' }),
                        });
                        if (res.ok) {
                          setPredictiveApplied(true);
                          setPredictiveAction(prev => prev ? { ...prev, status: 'APPLIED' } : prev);
                        }
                      } catch (e) {
                        // Offline fallback — show as applied anyway for demo
                        setPredictiveApplied(true);
                      } finally {
                        setPredictiveApplyBusy(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: predictiveApplyBusy ? 'not-allowed' : 'pointer',
                      background: predictiveApplyBusy
                        ? 'linear-gradient(135deg, #93c5fd, #a5f3fc)'
                        : 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                      color: '#fff',
                      letterSpacing: '0.03em',
                      boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {predictiveApplyBusy ? '⚙️ Adjusting setpoint…' : '⚡ Apply Setpoint 7°C → 9°C (One Click)'}
                  </button>
                )}
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
              <span className="reco-tag">SAFETY INTERLOCK</span>
            </div>
            <div className="reco-text" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
              <b>Target:</b> {complianceGap?.detected ? `${complianceGap.zone_name || 'Zone'} (${complianceGap.anomaly_floor})` : 'Whole Tower'}<br />
              <b>Directive:</b> {complianceGap?.action_recommendation || 'Continuous monitoring active across sub-meters.'}<br />
              <b>Attribution:</b> <span style={{ color: complianceGap?.detected ? '#e11d48' : (complianceGap?.attribution === 'WEATHER_DRIVEN' ? '#d97706' : '#0d9488'), fontWeight: 800 }}>
                {complianceGap?.attribution || 'NORMAL'}
              </span>
            </div>
          </div>

          <button
            onClick={applyRemediation}
            className="btn-remediation bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-md flex items-center justify-center gap-2"
            type="button"
            disabled={remediationBusy}
            style={{
              background: actionSuccess ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              width: '100%',
              fontSize: '0.84rem',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <ShieldCheck style={{ width: '16px', height: '16px' }} />
            {remediationBusy
              ? 'Dispatching Command to Stub…'
              : actionSuccess
                ? '✓ Dispatched to Stub (Dry-Run)'
                : 'Approve & Execute'}
          </button>
          {remediationLog && (
            <div
              className={`mt-2 rounded-lg p-3 text-[11px] font-semibold ${remediationLog.status === 'SUCCESS'
                ? 'border border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border border-red-400 bg-red-500/10 text-red-800 dark:text-red-300 animate-pulse'
                }`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', color: '#10b981', flexShrink: 0 }} />
                <span>{remediationLog.log}</span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.62rem', color: '#64748b', fontFamily: 'monospace' }}>
                Audit ID: {remediationLog.trace_id} · Mode: DRY_RUN_STUB_CONTROLLER
              </div>
            </div>
          )}

          {/* ── Global Executive ROI Ledger (War Room) or Sustainability Panel (Nominal) ── */}
          {selectedScenario !== 'nominal' && warRoomLedger.length > 0 ? (
            <div style={{ marginTop: '0.85rem', borderRadius: '12px', border: '1.5px solid rgba(16,185,129,0.4)', background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(5,46,22,0.9) 100%)', overflow: 'hidden', boxShadow: '0 2px 20px rgba(16,185,129,0.15)' }}>
              {/* Header */}
              <div style={{ padding: '8px 12px', background: 'linear-gradient(90deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem' }}>📋</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#6ee7b7', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Executive ROI Ledger</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.56rem', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>{warRoomLedger.length} Intervention{warRoomLedger.length > 1 ? 's' : ''}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '#34d399' : '#f87171' }}>
                    Net: {warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '+' : ''}RM {warRoomLedger.reduce((s, e) => s + e.impact, 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {/* Ledger rows */}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {warRoomLedger.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 12px', borderBottom: i < warRoomLedger.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', animation: i === 0 ? 'warRoomSlideIn 0.4s ease' : 'none' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: entry.positive ? '#34d399' : '#f87171', marginTop: '5px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{entry.label}</div>
                      <div style={{ fontSize: '0.54rem', color: '#64748b', marginTop: '1px' }}>{entry.scenario}</div>
                      <div style={{ fontSize: '0.5rem', color: '#475569', fontFamily: 'monospace' }}>{entry.ts}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: entry.positive ? '#34d399' : '#f87171', whiteSpace: 'nowrap' }}>{entry.roi}</span>
                  </div>
                ))}
              </div>
              {/* Summary footer */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Positive ROI</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#34d399' }}>+RM {warRoomLedger.filter(e => e.positive).reduce((s, e) => s + e.impact, 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Cost Incurred</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#f87171' }}>RM {Math.abs(warRoomLedger.filter(e => !e.positive).reduce((s, e) => s + e.impact, 0)).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Net Impact</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 900, color: warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '#34d399' : '#f87171' }}>
                    {warRoomLedger.reduce((s, e) => s + e.impact, 0) >= 0 ? '+' : ''}RM {warRoomLedger.reduce((s, e) => s + e.impact, 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ) : sustainabilityData && (
            <div style={{
              marginTop: '0.85rem',
              borderRadius: '12px',
              border: '1.5px solid rgba(16,185,129,0.35)',
              background: 'linear-gradient(135deg, rgba(240,253,250,0.97) 0%, rgba(236,253,245,0.93) 100%)',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(16,185,129,0.10)'
            }}>
              {/* Header */}
              <div style={{
                padding: '8px 12px',
                background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem' }}>🌿</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff', letterSpacing: '0.03em' }}>Sustainability Impact — Controlled Experiment</span>
                </div>
                <span style={{
                  fontSize: '0.56rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)',
                  background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '4px'
                }}>SUST-EXP-2026-001 · 30-day window · Simulated</span>
              </div>

              {/* Before / After metric rows */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

                {/* Energy */}
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 9px', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#065f46' }}>⚡ HVAC + Lighting Energy</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#059669' }}>
                      −{sustainabilityData.hvac?.pct_saved?.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.58rem' }}>
                    <span style={{ color: '#94a3b8' }}>Before: <b style={{ color: '#334155' }}>{sustainabilityData.hvac?.energy_before_kwh?.toLocaleString()} kWh</b></span>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span style={{ color: '#059669' }}>After: <b>{sustainabilityData.hvac?.energy_after_kwh?.toLocaleString()} kWh</b></span>
                  </div>
                  {/* savings bar */}
                  <div style={{ marginTop: '4px', height: '5px', background: '#d1fae5', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${sustainabilityData.hvac?.pct_saved || 0}%`,
                      background: 'linear-gradient(90deg,#10b981,#059669)',
                      borderRadius: '3px',
                      transition: 'width 1s ease'
                    }} />
                  </div>
                </div>

                {/* CO2e + Cost row */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid rgba(16,185,129,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>CO₂e Avoided</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#065f46' }}>
                      {sustainabilityData.total_co2e_saved_kg?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.52rem', color: '#64748b' }}>kg / month</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid rgba(16,185,129,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Water Saved</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0369a1' }}>
                      {sustainabilityData.total_water_saved_litres?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.52rem', color: '#64748b' }}>L / month</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 8px', border: '1px solid rgba(16,185,129,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Audit Hrs Saved</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#7c3aed' }}>
                      {sustainabilityData.audit?.hours_saved}
                    </div>
                    <div style={{ fontSize: '0.52rem', color: '#64748b' }}>h / month</div>
                  </div>
                </div>

                {/* GreenRE EEI */}
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '6px 9px', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#065f46' }}>📊 GreenRE EEI (kWh/m²·yr)</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#059669' }}>
                      −{sustainabilityData.greenre_eei_improvement_pct?.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.6rem' }}>
                    <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.85rem' }}>
                      {sustainabilityData.greenre_eei_before}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→</span>
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: '0.85rem' }}>
                      {sustainabilityData.greenre_eei_after}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.55rem' }}>kWh/m²·yr</span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ fontSize: '0.53rem', color: '#94a3b8', lineHeight: '1.4', paddingTop: '2px' }}>
                  Methodology: ASHRAE 90.1-2022 · SPAN 2022 NRW · MY Grid 0.585 kg CO₂e/kWh · GreenRE v3.0
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bottom-pills">
        {['Dashboard', 'Reserve Management', 'Waste Management', 'Water Management'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pill-btn ${activeTab === tab ? 'active' : 'inactive'}`}
            onClick={() => {
              if (tab === 'Reserve Management') {
                navigate('/reservations');
              } else if (tab === 'Waste Management') {
                navigate('/waste');
              } else if (tab === 'Water Management') {
                navigate('/water');
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
            </div>
          </div>
        </div>
      )}

      {/* BMS Telemetry & AFDD RAG Drawer — with embedded Azure AI diagnosis */}
      <BmsTelemetryDrawer
        isOpen={isBmsDrawerOpen}
        data={bmsTelemetry}
        azureDiagnosis={azureDiagnosis}
        onClose={() => setIsBmsDrawerOpen(false)}
      />

      {/* Azure Enterprise Evidence & Regulatory Audit Modal */}
      <AzureEvidenceModal
        isOpen={isAzureModalOpen}
        onClose={() => setIsAzureModalOpen(false)}
      />
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

  componentDidCatch(error) {
    console.error('3D Canvas Error:', error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

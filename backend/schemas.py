"""Pydantic schemas for EMS API v2.

Backwards-compatible: all new fields on TelemetryReading are Optional so
existing simulators/BMS clients that only send reading_kwh continue to work.
"""

from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data-Quality Literals
# ---------------------------------------------------------------------------

QualityStatus = Literal["LIVE", "STALE", "INTERPOLATED", "ERROR"]

AlarmSeverityLiteral = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
AlarmStateLiteral = Literal[
    "OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "CLOSED"
]


# ---------------------------------------------------------------------------
# Telemetry Ingest
# ---------------------------------------------------------------------------

class TelemetryReading(BaseModel):
    """Single meter-reading record from a BMS, smart meter, or simulator.

    Power-quality fields are all Optional for backwards compatibility.
    The backend quality-gate will assign quality_status if not supplied.
    """

    timestamp: Union[datetime, str]
    floor_id: str = Field(..., description="Physical floor code, e.g. L14")
    meter_type: str = Field(default="electricity")

    # ── Core energy ────────────────────────────────────────────────────────
    reading_kwh: float = Field(..., ge=0, description="Interval/cumulative energy (kWh)")

    # ── Power-quality dimensions (optional) ───────────────────────────────
    demand_kw: Optional[float] = Field(
        None, ge=0, description="15-min sliding-average demand (kW)"
    )
    voltage_v: Optional[float] = Field(
        None, ge=0, le=500, description="Phase-to-neutral RMS voltage (V)"
    )
    current_a: Optional[float] = Field(
        None, ge=0, description="Line RMS current (A)"
    )
    power_factor: Optional[float] = Field(
        None, ge=0, le=1, description="Displacement power factor 0–1"
    )
    reactive_kvar: Optional[float] = Field(
        None, description="Reactive power (kVAR); positive = inductive lag"
    )

    # ── Data-quality override (optional; gate re-evaluates if absent) ─────
    quality_status: QualityStatus = "LIVE"


# Alias kept for import compatibility across the codebase
TelemetryReadingSchema = TelemetryReading


class TelemetryBatch(BaseModel):
    readings: List[TelemetryReading]


# ---------------------------------------------------------------------------
# Ingest response
# ---------------------------------------------------------------------------

class IngestResult(BaseModel):
    status: str
    inserted_count: int
    ingested: int
    rejected_count: int = 0
    flagged_count: int = 0
    alarm_count: int = 0


# ---------------------------------------------------------------------------
# Zone Consumption (enriched with analytics)
# ---------------------------------------------------------------------------

class ZoneConsumption(BaseModel):
    zone_id: int
    code: str
    name: str
    floors_label: str
    area_m2: float
    energy_kwh: float
    eei_kwh_m2_yr: float
    eei_baseline_kwh_m2_yr: float
    excess_kwh: float
    compliance_status: str
    recommendation: Optional[str] = None

    # Phase 2 analytics fields
    peak_demand_kw: Optional[float] = None           # max 15-min demand in window
    avg_power_factor: Optional[float] = None         # fleet-wide average PF
    carbon_kgco2e: Optional[float] = None            # Scope 2 emissions
    energy_cost_myr: Optional[float] = None          # TOU-rated energy cost
    demand_charge_myr: Optional[float] = None        # monthly demand charge
    total_cost_myr: Optional[float] = None           # energy + demand


class ZonesConsumptionResponse(BaseModel):
    status: str
    window_hours: float
    total_energy_kwh: float
    total_area_m2: float
    building_eei_kwh_m2_yr: float
    building_compliance_status: str
    zones: List[ZoneConsumption]
    latest_timestamp: Optional[datetime] = None

    # Phase 2 building-level analytics
    total_carbon_kgco2e: Optional[float] = None
    total_cost_myr: Optional[float] = None
    emission_factor_kg_per_kwh: Optional[float] = None
    peak_demand_kw: Optional[float] = None


# ---------------------------------------------------------------------------
# Alarm Schemas (Phase 3)
# ---------------------------------------------------------------------------

class AlarmRead(BaseModel):
    """Full alarm record returned by GET /api/v1/alarms."""

    id: int
    alarm_code: str
    description: str
    severity: AlarmSeverityLiteral
    state: AlarmStateLiteral
    floor_id: Optional[int] = None
    zone_id: Optional[int] = None
    generated_at: datetime
    acknowledged_at: Optional[datetime] = None
    investigated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    root_cause: Optional[str] = None
    notes: Optional[str] = None
    trigger_value: Optional[float] = None
    threshold_value: Optional[float] = None
    meter_type: Optional[str] = None
    created_by: str = "system"
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlarmAcknowledgeRequest(BaseModel):
    assigned_to: str = Field(..., description="Staff email or ID taking ownership")
    notes: Optional[str] = None


class AlarmInvestigateRequest(BaseModel):
    notes: Optional[str] = None


class AlarmResolveRequest(BaseModel):
    root_cause: str = Field(..., min_length=10, description="Root-cause analysis (min 10 chars)")
    notes: Optional[str] = None


class AlarmCloseRequest(BaseModel):
    notes: Optional[str] = None


class AlarmListResponse(BaseModel):
    total: int
    alarms: List[AlarmRead]


# ---------------------------------------------------------------------------
# TOU Tariff Schemas (Phase 2)
# ---------------------------------------------------------------------------

class TouRateRead(BaseModel):
    id: int
    name: str
    tariff_schedule: str
    day_mask: int
    hour_start: int
    hour_end: int
    rate_per_kwh: float
    demand_charge_per_kw: Optional[float] = None
    currency: str
    is_active: bool
    valid_from: datetime
    valid_until: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Control Command Schemas (Phase 3 stubs)
# ---------------------------------------------------------------------------

class HvacSetpointCommand(BaseModel):
    zone_id: int
    setpoint_c: float = Field(..., ge=16.0, le=30.0, description="Setpoint in °C")
    source: Literal["manual", "auto"] = "manual"
    operator: Optional[str] = None


class HvacModeCommand(BaseModel):
    zone_id: int
    mode: Literal["cool", "heat", "fan", "off"]
    operator: Optional[str] = None


class LightingSceneCommand(BaseModel):
    floor_id: int
    scene: Literal["full", "50pct", "off"]
    operator: Optional[str] = None


class ControlResult(BaseModel):
    success: bool
    command: str
    target_id: int
    requested_value: Union[float, str]
    confirmed_value: Optional[Union[float, str]] = None
    latency_ms: Optional[float] = None
    message: str = ""
    dispatched_at: Optional[datetime] = None

# --- Append to the bottom of schemas.py ---
from typing import Dict, Any

class AssetInfo(BaseModel):
    equipment_id: str = Field(..., description="Unique physical equipment identifier, e.g., AHU-L14-01")
    equipment_type: str = Field(..., description="Equipment type, e.g., AHU, Chiller, VAV")
    floor: str = Field(..., description="Floor location")
    zone: str = Field(..., description="Associated zone code")
    registers: List[str] = Field(default_factory=list, description="List of key telemetry registers/points")

class TelemetrySnapshot(BaseModel):
    timestamp: datetime
    data_quality: QualityStatus = Field(default="LIVE", description="Data quality label")
    readings: Dict[str, float] = Field(..., description="Key-value telemetry data")

class DiagnosticPayload(BaseModel):
    anomaly_id: str
    asset: AssetInfo
    telemetry: TelemetrySnapshot
    baseline_deviation_pct: float
    environmental_context: Dict[str, float] = Field(..., description="Environmental context, such as outdoor temperature")


# ---------------------------------------------------------------------------
# Sensor Telemetry Schemas
# ---------------------------------------------------------------------------

class SensorPayload(BaseModel):
    floor_id: str = Field(..., description="Floor or plant identifier, e.g. 'L8', 'L2', 'L14', 'LG', 'M&E'")
    sensor_type: str = Field(..., description="Sensor type: CO2, OCCUPANCY, WATER_FLOW, VIBRATION")
    value: float = Field(..., description="Numerical sensor telemetry reading")
    status: Optional[str] = Field("NORMAL", description="Status flag: NORMAL, WARNING, ERROR")
    timestamp: Optional[datetime] = Field(None, description="Optional timestamp; defaults to now")


class SensorTelemetryRead(BaseModel):
    id: int
    timestamp: datetime
    floor_id: str
    sensor_type: str
    value: float
    status: str

    class Config:
        from_attributes = True
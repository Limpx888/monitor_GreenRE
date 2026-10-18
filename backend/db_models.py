"""Physical mapping: Zone 1-N → Floor (L4–L12, L14–L28, …) → MeterReading.

Schema version 2.0 — adds power-quality dimensions, TOU tariff table, and
Alarm lifecycle table for production-grade EMS operation.
"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


# ---------------------------------------------------------------------------
# Physical mapping
# ---------------------------------------------------------------------------

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False)  # zone-a … zone-e
    name = Column(String(128), nullable=False)
    floors_label = Column(String(64), nullable=False)
    area_m2 = Column(Float, nullable=False)
    eei_baseline_kwh_m2_yr = Column(Float, nullable=False)

    # Dynamic baseline normalisation coefficients (Phase 2)
    cdd_coefficient = Column(Float, nullable=False, default=0.012)   # CDD sensitivity
    hdd_coefficient = Column(Float, nullable=False, default=0.004)   # HDD sensitivity
    contracted_hours = Column(Float, nullable=False, default=3640.0) # typical op hrs/yr
    demand_threshold_kw = Column(Float, nullable=True)               # alert threshold

    floors = relationship("Floor", back_populates="zone")


class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(16), unique=True, nullable=False)  # L14, GF, B2
    name = Column(String(128), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)

    zone = relationship("Zone", back_populates="floors")
    readings = relationship("MeterReading", back_populates="floor")
    alarms = relationship("Alarm", back_populates="floor")


class MeterReading(Base):
    """One telemetry record per (timestamp, floor, meter_type) tuple.

    Core energy field
    -----------------
    reading_kwh   Cumulative or interval energy for the measurement window.

    Power-quality fields (all nullable; populated by smart-meter or BMS)
    -------------------------------------------------------------------
    demand_kw     15-minute sliding-average demand (kW).
    voltage_v     Phase-to-neutral RMS voltage (V).
    current_a     Line RMS current (A).
    power_factor  Displacement PF, 0–1.
    reactive_kvar Reactive power (kVAR); positive = inductive lag.

    Data-quality flag
    -----------------
    quality_status  LIVE | STALE | INTERPOLATED | ERROR
    """

    __tablename__ = "meter_readings"
    __table_args__ = (
        UniqueConstraint(
            "timestamp", "floor_id", "meter_type", name="uq_reading_ts_floor_meter"
        ),
        Index("ix_meter_readings_timestamp", "timestamp"),
        Index("ix_meter_readings_floor_id", "floor_id"),
        Index("ix_meter_readings_quality", "quality_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    floor_id = Column(Integer, ForeignKey("floors.id", ondelete="CASCADE"), nullable=False)
    meter_type = Column(String(32), nullable=False, default="electricity")

    # ── Core energy ───────────────────────────────────────────────────────────
    reading_kwh = Column(Float, nullable=False)

    # ── Power-quality dimensions ──────────────────────────────────────────────
    demand_kw = Column(Float, nullable=True)      # 15-min avg demand
    voltage_v = Column(Float, nullable=True)      # phase voltage (V)
    current_a = Column(Float, nullable=True)      # line current (A)
    power_factor = Column(Float, nullable=True)   # PF 0–1
    reactive_kvar = Column(Float, nullable=True)  # reactive power (kVAR)

    # ── Data-quality flag ─────────────────────────────────────────────────────
    quality_status = Column(String(16), nullable=False, default="LIVE")

    floor = relationship("Floor", back_populates="readings")


# ---------------------------------------------------------------------------
# TOU Tariff (Phase 2)
# ---------------------------------------------------------------------------

class TouTariffRate(Base):
    """Time-of-Use tariff schedule row.

    day_mask is a bitmask where Mon=1, Tue=2, Wed=4, Thu=8,
    Fri=16, Sat=32, Sun=64.  All weekdays = 31, weekend = 96.
    """

    __tablename__ = "tou_tariff_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False)          # "Peak", "Off-Peak", "Weekend"
    tariff_schedule = Column(String(64), nullable=False, default="TNB_ScheduleD")
    day_mask = Column(Integer, nullable=False)          # bitmask Mon=1 … Sun=64
    hour_start = Column(Integer, nullable=False)        # 0–23
    hour_end = Column(Integer, nullable=False)          # 0–23 inclusive
    rate_per_kwh = Column(Float, nullable=False)        # local currency / kWh
    demand_charge_per_kw = Column(Float, nullable=True) # local currency / kW (monthly peak)
    currency = Column(String(8), nullable=False, default="MYR")
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


# ---------------------------------------------------------------------------
# Alarm Lifecycle (Phase 3)
# ---------------------------------------------------------------------------

class AlarmSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlarmState(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class Alarm(Base):
    """Alarm event with full lifecycle state machine.

    State transitions (enforced in alarm_service.py):
        OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED
        OPEN → CLOSED  (auto-clear for INFO severity after 24 h)
    """

    __tablename__ = "alarms"
    __table_args__ = (
        Index("ix_alarms_state", "state"),
        Index("ix_alarms_severity", "severity"),
        Index("ix_alarms_generated_at", "generated_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    alarm_code = Column(String(64), nullable=False, index=True)   # e.g. "HIGH_DEMAND_L14"
    description = Column(String(512), nullable=False)
    severity = Column(String(16), nullable=False, default=AlarmSeverity.MEDIUM)

    # ── Spatial context ───────────────────────────────────────────────────────
    floor_id = Column(Integer, ForeignKey("floors.id", ondelete="SET NULL"), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)

    # ── Lifecycle timestamps ───────────────────────────────────────────────────
    generated_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    investigated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # ── Assignment & root cause ───────────────────────────────────────────────
    assigned_to = Column(String(128), nullable=True)   # staff email / ID
    root_cause = Column(String(1024), nullable=True)
    notes = Column(String(2048), nullable=True)

    # ── State machine ─────────────────────────────────────────────────────────
    state = Column(String(16), nullable=False, default=AlarmState.OPEN)

    # ── Telemetry snapshot at time of alarm ───────────────────────────────────
    trigger_value = Column(Float, nullable=True)     # measured value that fired alarm
    threshold_value = Column(Float, nullable=True)   # configured threshold
    meter_type = Column(String(32), nullable=True, default="electricity")

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by = Column(String(64), nullable=False, default="system")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    floor = relationship("Floor", back_populates="alarms")


# ---------------------------------------------------------------------------
# IoT Sensor Telemetry (Hackathon Mock Extension)
# ---------------------------------------------------------------------------

class SensorTelemetry(Base):
    """Fine-grained IoT sensor telemetry model.

    Captures sub-building, room-level, or equipment-level telemetry:
    - CO2: Indoor Environmental Quality (ppm)
    - OCCUPANCY: Human presence flag (0.0 or 1.0)
    - WATER_FLOW: Fine-grained water flow rates (L/h)
    - VIBRATION: Chiller/AHU mechanical vibration frequency (Hz)
    """

    __tablename__ = "sensor_telemetry"
    __table_args__ = (
        Index("ix_sensor_telemetry_ts_type", "timestamp", "sensor_type"),
        Index("ix_sensor_telemetry_floor_type", "floor_id", "sensor_type"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), index=True)

    # Associated with existing Zone or Floor (e.g. 'L14', 'L8', 'L2', 'LG', 'B2', 'M&E')
    floor_id = Column(String(32), index=True, nullable=False)

    # Key field: Sensor type ('CO2', 'WATER_FLOW', 'OCCUPANCY', 'VIBRATION')
    sensor_type = Column(String(32), index=True, nullable=False)

    # Key field: Sensor reading value
    value = Column(Float, nullable=False)

    # Status flag: e.g. 'NORMAL', 'WARNING', 'ERROR'
    status = Column(String(32), default="NORMAL", nullable=False)


# ---------------------------------------------------------------------------
# Predictive HVAC Control & Optimization Action
# ---------------------------------------------------------------------------

class PredictiveAction(Base):
    """Proactive HVAC/Chiller setpoint recommendation generated by weather predictive rule engine."""

    __tablename__ = "predictive_actions"
    __table_args__ = (
        Index("ix_predictive_actions_status", "status"),
        Index("ix_predictive_actions_generated", "generated_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    generated_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), index=True)
    trigger_rule = Column(String(64), nullable=False, default="WEATHER_PREDICTIVE_COOLING")

    outdoor_temp_current = Column(Float, nullable=False)
    outdoor_temp_forecast_2h = Column(Float, nullable=False)
    temp_drop_c = Column(Float, nullable=False)
    rain_probability_pct = Column(Float, nullable=False)

    current_chiller_setpoint_c = Column(Float, nullable=False, default=7.0)
    recommended_chiller_setpoint_c = Column(Float, nullable=False, default=9.0)

    recommendation_text = Column(String(512), nullable=False)
    expected_savings_rm = Column(Float, nullable=False, default=342.50)
    expected_kwh_saved = Column(Float, nullable=False, default=778.4)

    status = Column(String(32), default="PENDING", nullable=False)  # PENDING | APPLIED | DISMISSED
    applied_at = Column(DateTime(timezone=True), nullable=True)
    operator = Column(String(64), nullable=True, default="autonomous_rule_engine")



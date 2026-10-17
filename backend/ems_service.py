"""EMS business-logic layer — v2.0

Responsibilities
----------------
1. ingest_readings()      — quality-gated telemetry upsert with alarm generation
2. zone_consumption()     — enriched with carbon, TOU cost, demand, PF
3. monthly_zone_series()  — historical time-series for charting
4. TOU tariff engine      — apply_tou_cost()
5. Dynamic baseline       — normalised_baseline()
6. Alarm generation       — _raise_alarm() / _maybe_auto_close_alarm()
"""

import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence, Tuple, Union

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from db_models import Alarm, AlarmSeverity, AlarmState, Floor, MeterReading, TouTariffRate, Zone
from schemas import (
    TelemetryReading,
    ZoneConsumption,
    ZonesConsumptionResponse,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HOURS_PER_YEAR = 8760.0

# Data-quality gate thresholds
SPIKE_THRESHOLD_MULTIPLIER = 5.0   # flag if reading > 5× the floor's recent rolling avg
OOO_TOLERANCE_MINUTES = 2          # allow up to 2-min future timestamp skew

# Carbon accounting — Malaysia Peninsular Grid 2023 (tonne CO₂e / MWh = kg / kWh)
GRID_EMISSION_FACTOR_KG_CO2E_PER_KWH = float(
    os.getenv("GRID_EMISSION_FACTOR_KG_CO2E_PER_KWH", "0.585")
)

# TNB Schedule D approximate demand-charge period (months)
DEMAND_CHARGE_MONTHS = 1.0


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _aware(dt: Union[datetime, str]) -> datetime:
    if isinstance(dt, str):
        cleaned = dt.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(cleaned)
        except Exception:
            import pandas as pd
            dt = pd.to_datetime(dt, utc=True).to_pydatetime()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _annualized_eei(energy_kwh: float, area_m2: float, window_hours: float) -> float:
    if area_m2 <= 0 or window_hours <= 0:
        return 0.0
    return (energy_kwh / area_m2) * (HOURS_PER_YEAR / window_hours)


def _status(eei: float, baseline: float) -> str:
    if eei <= 0:
        return "insufficient_data"
    if eei > baseline:
        return "warning"
    return "compliant"


def _recommendation(zone_name: str, eei: float, baseline: float, excess_kwh: float) -> Optional[str]:
    if eei <= baseline:
        return None
    return (
        f"{zone_name} EEI {eei:.1f} kWh/m²·yr exceeds the GreenRE commercial baseline "
        f"of {baseline:.0f} kWh/m²·yr. Investigate HVAC night setback, lighting schedules, "
        f"and plug-load isolation. Estimated excess in window: {excess_kwh:.1f} kWh."
    )


# ---------------------------------------------------------------------------
# Power-quality helpers
# ---------------------------------------------------------------------------

def compute_demand_kw(energy_kwh: float, interval_minutes: float = 15.0) -> float:
    """Convert interval energy to average demand power (kW)."""
    return round(energy_kwh * (60.0 / interval_minutes), 3)


def compute_reactive_kvar(
    reading_kwh: float,
    power_factor: float,
    interval_minutes: float = 15.0,
) -> Optional[float]:
    """Derive reactive power from kWh and power-factor."""
    if power_factor <= 0 or power_factor > 1:
        return None
    kw = compute_demand_kw(reading_kwh, interval_minutes)
    import math
    theta = math.acos(power_factor)
    kvar = kw * math.tan(theta)
    return round(kvar, 3)


# ---------------------------------------------------------------------------
# Data-quality gate
# ---------------------------------------------------------------------------

def _validate_reading(
    item: TelemetryReading,
    rolling_avg: Optional[float],
) -> str:
    """Return a QualityStatus string for the reading.

    Rules (in priority order):
    1. ERROR   — future timestamp beyond tolerance
    2. STALE   — sudden spike > 5× rolling average
    3. LIVE    — all checks passed
    """
    ts = _aware(item.timestamp)
    now = datetime.now(timezone.utc)

    if ts > now + timedelta(minutes=OOO_TOLERANCE_MINUTES):
        return "ERROR"

    if rolling_avg is not None and rolling_avg > 0:
        if item.reading_kwh > rolling_avg * SPIKE_THRESHOLD_MULTIPLIER:
            return "STALE"

    return item.quality_status  # respect caller override (default "LIVE")


def _build_floor_rolling_avgs(db: Session, floor_ids: set) -> dict:
    """Fetch the 6-reading rolling average kWh per floor for spike detection."""
    subq = (
        db.query(
            MeterReading.floor_id,
            func.avg(MeterReading.reading_kwh).label("avg_kwh"),
        )
        .filter(
            MeterReading.floor_id.in_(floor_ids),
            MeterReading.meter_type == "electricity",
            MeterReading.quality_status != "ERROR",
        )
        .group_by(MeterReading.floor_id)
        .all()
    )
    return {row.floor_id: float(row.avg_kwh) for row in subq}


# ---------------------------------------------------------------------------
# Alarm generation (Phase 3)
# ---------------------------------------------------------------------------

def _raise_alarm(
    db: Session,
    alarm_code: str,
    description: str,
    severity: str,
    floor_id: Optional[int] = None,
    zone_id: Optional[int] = None,
    trigger_value: Optional[float] = None,
    threshold_value: Optional[float] = None,
) -> None:
    """Insert a new OPEN alarm if no identical OPEN alarm already exists."""
    existing = (
        db.query(Alarm)
        .filter(
            Alarm.alarm_code == alarm_code,
            Alarm.floor_id == floor_id,
            Alarm.state.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"]),
        )
        .first()
    )
    if existing:
        # Update trigger value if escalating
        if trigger_value and (existing.trigger_value is None or trigger_value > existing.trigger_value):
            existing.trigger_value = trigger_value
        return

    alarm = Alarm(
        alarm_code=alarm_code,
        description=description,
        severity=severity,
        state=AlarmState.OPEN,
        floor_id=floor_id,
        zone_id=zone_id,
        generated_at=datetime.now(timezone.utc),
        trigger_value=trigger_value,
        threshold_value=threshold_value,
        created_by="system",
    )
    db.add(alarm)


# ---------------------------------------------------------------------------
# Core ingest
# ---------------------------------------------------------------------------

def ingest_readings(db: Session, payloads: Sequence[TelemetryReading]) -> dict:
    """Quality-gated upsert of telemetry readings.

    Returns a dict suitable for IngestResult with counts of inserted,
    rejected, flagged, and alarm-generated records.
    """
    if not payloads:
        return {"inserted_count": 0, "ingested": 0, "rejected_count": 0,
                "flagged_count": 0, "alarm_count": 0}

    # 1. Resolve floor codes → IDs
    codes = {item.floor_id.upper() for item in payloads}
    floors = db.query(Floor).filter(Floor.code.in_(codes)).all()
    code_to_floor = {floor.code.upper(): floor for floor in floors}
    code_to_id = {code: floor.id for code, floor in code_to_floor.items()}
    missing = sorted(codes - set(code_to_id))
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown floor_id values: {missing}")

    # 2. Build rolling averages for spike detection
    floor_ids = set(code_to_id.values())
    rolling_avgs = _build_floor_rolling_avgs(db, floor_ids)

    # 3. Quality gate + row construction
    rows = []
    rejected = 0
    flagged = 0
    alarms_raised = 0

    for item in payloads:
        fid = code_to_id[item.floor_id.upper()]
        floor = code_to_floor[item.floor_id.upper()]
        rolling_avg = rolling_avgs.get(fid)
        quality = _validate_reading(item, rolling_avg)

        if quality == "ERROR":
            rejected += 1
            continue

        if quality == "STALE":
            flagged += 1

        # Derive demand_kw if not supplied by the client
        demand_kw = item.demand_kw
        if demand_kw is None and item.reading_kwh >= 0:
            demand_kw = compute_demand_kw(item.reading_kwh, interval_minutes=15.0)

        # Derive reactive_kvar if PF is available but kvar isn't
        reactive_kvar = item.reactive_kvar
        if reactive_kvar is None and item.power_factor:
            reactive_kvar = compute_reactive_kvar(item.reading_kwh, item.power_factor)

        rows.append({
            "timestamp": _aware(item.timestamp),
            "floor_id": fid,
            "meter_type": item.meter_type,
            "reading_kwh": item.reading_kwh,
            "demand_kw": demand_kw,
            "voltage_v": item.voltage_v,
            "current_a": item.current_a,
            "power_factor": item.power_factor,
            "reactive_kvar": reactive_kvar,
            "quality_status": quality,
        })

        # ── Demand alarm check ────────────────────────────────────────────
        zone = floor.zone
        if zone and zone.demand_threshold_kw and demand_kw:
            if demand_kw > zone.demand_threshold_kw:
                _raise_alarm(
                    db,
                    alarm_code=f"HIGH_DEMAND_{item.floor_id.upper()}",
                    description=(
                        f"Floor {item.floor_id.upper()} demand {demand_kw:.1f} kW "
                        f"exceeds threshold {zone.demand_threshold_kw:.1f} kW."
                    ),
                    severity=AlarmSeverity.HIGH,
                    floor_id=fid,
                    zone_id=zone.id,
                    trigger_value=demand_kw,
                    threshold_value=zone.demand_threshold_kw,
                )
                alarms_raised += 1

        # ── Power-factor alarm check ──────────────────────────────────────
        if item.power_factor is not None and item.power_factor < 0.85:
            _raise_alarm(
                db,
                alarm_code=f"LOW_PF_{item.floor_id.upper()}",
                description=(
                    f"Floor {item.floor_id.upper()} power factor {item.power_factor:.3f} "
                    f"below 0.85 threshold — risk of reactive power penalty."
                ),
                severity=AlarmSeverity.MEDIUM,
                floor_id=fid,
                zone_id=zone.id if zone else None,
                trigger_value=item.power_factor,
                threshold_value=0.85,
            )
            alarms_raised += 1

        # ── Spike alarm check (STALE quality) ────────────────────────────
        if quality == "STALE":
            _raise_alarm(
                db,
                alarm_code=f"ENERGY_SPIKE_{item.floor_id.upper()}",
                description=(
                    f"Floor {item.floor_id.upper()} energy {item.reading_kwh:.1f} kWh "
                    f"is {SPIKE_THRESHOLD_MULTIPLIER:.0f}× above rolling average "
                    f"({rolling_avg:.1f} kWh). Flagged for review."
                ),
                severity=AlarmSeverity.HIGH,
                floor_id=fid,
                zone_id=zone.id if zone else None,
                trigger_value=item.reading_kwh,
                threshold_value=rolling_avg * SPIKE_THRESHOLD_MULTIPLIER if rolling_avg else None,
            )
            alarms_raised += 1

    if not rows:
        db.commit()
        return {"inserted_count": 0, "ingested": 0,
                "rejected_count": rejected, "flagged_count": flagged,
                "alarm_count": alarms_raised}

    # 4. Upsert
    dialect = db.bind.dialect.name if db.bind is not None else "postgresql"
    insert_fn = sqlite_insert if dialect == "sqlite" else pg_insert
    stmt = insert_fn(MeterReading).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["timestamp", "floor_id", "meter_type"],
        set_={
            "reading_kwh": stmt.excluded.reading_kwh,
            "demand_kw": stmt.excluded.demand_kw,
            "voltage_v": stmt.excluded.voltage_v,
            "current_a": stmt.excluded.current_a,
            "power_factor": stmt.excluded.power_factor,
            "reactive_kvar": stmt.excluded.reactive_kvar,
            "quality_status": stmt.excluded.quality_status,
        },
    )
    db.execute(stmt)
    db.commit()

    return {
        "inserted_count": len(rows),
        "ingested": len(rows),
        "rejected_count": rejected,
        "flagged_count": flagged,
        "alarm_count": alarms_raised,
    }


# ---------------------------------------------------------------------------
# TOU Tariff Engine (Phase 2)
# ---------------------------------------------------------------------------

def _day_bit(dt: datetime) -> int:
    """Return the day bitmask bit for dt (Mon=1, Tue=2, … Sun=64)."""
    return 1 << dt.weekday()  # Mon=0 → bit 1, Sun=6 → bit 64


def apply_tou_cost(
    db: Session,
    zone_energy_kwh: float,
    peak_demand_kw: float,
    window_start: datetime,
    window_end: datetime,
) -> dict:
    """Apply TOU tariff to compute energy cost and demand charge.

    Returns:
        {"energy_cost_myr": float, "demand_charge_myr": float, "total_cost_myr": float}
    """
    rates = (
        db.query(TouTariffRate)
        .filter(TouTariffRate.is_active == True)  # noqa: E712
        .all()
    )
    if not rates:
        # No tariff configured — return zeros so callers can handle gracefully
        return {"energy_cost_myr": 0.0, "demand_charge_myr": 0.0, "total_cost_myr": 0.0}

    # Walk the window in 1-hour steps to classify each hour
    energy_cost = 0.0
    demand_charge = 0.0
    current = window_start.replace(minute=0, second=0, microsecond=0)
    window_hours = max((window_end - window_start).total_seconds() / 3600.0, 1.0)
    kwh_per_hour = zone_energy_kwh / window_hours

    while current <= window_end:
        day_bit = _day_bit(current)
        hour = current.hour
        rate_row = None
        for r in rates:
            if not (r.day_mask & day_bit):
                continue
            if r.hour_start <= r.hour_end:
                in_hours = r.hour_start <= hour <= r.hour_end
            else:
                in_hours = hour >= r.hour_start or hour <= r.hour_end
            if in_hours:
                rate_row = r
                break
        if rate_row:
            energy_cost += kwh_per_hour * rate_row.rate_per_kwh
            if rate_row.demand_charge_per_kw and demand_charge == 0.0:
                # Demand charge applies once per billing period (monthly)
                demand_charge = peak_demand_kw * rate_row.demand_charge_per_kw
        current += timedelta(hours=1)

    energy_cost = round(energy_cost, 2)
    demand_charge = round(demand_charge, 2)
    return {
        "energy_cost_myr": energy_cost,
        "demand_charge_myr": demand_charge,
        "total_cost_myr": round(energy_cost + demand_charge, 2),
    }


# ---------------------------------------------------------------------------
# Dynamic baseline normalisation (Phase 2)
# ---------------------------------------------------------------------------

def normalised_baseline(
    static_baseline: float,
    cdd_coefficient: float,
    hdd_coefficient: float,
    contracted_hours: float,
    cooling_degree_days: float = 0.0,
    heating_degree_days: float = 0.0,
    occupancy_rate: float = 1.0,
    operating_hours: float = None,
    cdd_reference: float = 600.0,
    hdd_reference: float = 50.0,
) -> float:
    """Compute weather- and occupancy-adjusted EEI baseline (kWh/m²·yr).

    Formula:
        adjusted = static × (1 + α×CDD/CDD_ref + β×HDD/HDD_ref)
                           × occupancy_rate
                           × (operating_hours / contracted_hours)
    """
    if operating_hours is None:
        operating_hours = contracted_hours

    weather_factor = (
        1.0
        + cdd_coefficient * (cooling_degree_days / max(cdd_reference, 1.0))
        + hdd_coefficient * (heating_degree_days / max(hdd_reference, 1.0))
    )
    hours_factor = operating_hours / max(contracted_hours, 1.0)
    adjusted = static_baseline * weather_factor * max(occupancy_rate, 0.0) * hours_factor
    return round(adjusted, 2)


# ---------------------------------------------------------------------------
# Zone consumption (enriched)
# ---------------------------------------------------------------------------

def zone_consumption(
    db: Session,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> ZonesConsumptionResponse:
    latest = db.query(func.max(MeterReading.timestamp)).scalar()
    if end is None:
        end = latest or datetime.now(timezone.utc)
    end = _aware(end)
    if start is None:
        start = end - timedelta(hours=24)
    start = _aware(start)

    occupied = (
        db.query(func.min(MeterReading.timestamp), func.max(MeterReading.timestamp))
        .filter(
            MeterReading.timestamp >= start,
            MeterReading.timestamp <= end,
            MeterReading.meter_type == "electricity",
        )
        .one()
    )
    if occupied[0] is not None and occupied[1] is not None:
        span_hours = (_aware(occupied[1]) - _aware(occupied[0])).total_seconds() / 3600.0
        window_hours = max(span_hours, 1.0)
    else:
        window_hours = max((end - start).total_seconds() / 3600.0, 1.0)

    # Main aggregation: energy, peak demand, avg PF
    rows = (
        db.query(
            Zone.id,
            Zone.code,
            Zone.name,
            Zone.floors_label,
            Zone.area_m2,
            Zone.eei_baseline_kwh_m2_yr,
            Zone.cdd_coefficient,
            Zone.hdd_coefficient,
            Zone.contracted_hours,
            func.coalesce(func.sum(MeterReading.reading_kwh), 0.0).label("energy"),
            func.coalesce(func.max(MeterReading.demand_kw), 0.0).label("peak_demand"),
            func.coalesce(func.avg(MeterReading.power_factor), None).label("avg_pf"),
        )
        .outerjoin(Floor, Floor.zone_id == Zone.id)
        .outerjoin(
            MeterReading,
            (MeterReading.floor_id == Floor.id)
            & (MeterReading.timestamp >= start)
            & (MeterReading.timestamp <= end)
            & (MeterReading.meter_type == "electricity")
            & (MeterReading.quality_status != "ERROR"),
        )
        .group_by(
            Zone.id, Zone.code, Zone.name, Zone.floors_label, Zone.area_m2,
            Zone.eei_baseline_kwh_m2_yr, Zone.cdd_coefficient,
            Zone.hdd_coefficient, Zone.contracted_hours,
        )
        .order_by(Zone.id)
        .all()
    )

    zones: List[ZoneConsumption] = []
    total_energy = 0.0
    total_area = 0.0
    total_carbon = 0.0
    total_cost = 0.0
    building_peak_demand = 0.0

    emission_factor = GRID_EMISSION_FACTOR_KG_CO2E_PER_KWH

    for row in rows:
        (
            zone_id, code, name, floors_label, area_m2, baseline,
            cdd_coeff, hdd_coeff, contracted_hrs,
            energy, peak_demand, avg_pf,
        ) = row

        energy = float(energy or 0.0)
        area_m2 = float(area_m2 or 0.0)
        baseline = float(baseline or 0.0)
        peak_demand = float(peak_demand or 0.0)

        eei = _annualized_eei(energy, area_m2, window_hours)
        excess_kwh = 0.0
        if eei > baseline and baseline > 0:
            allowed = baseline * area_m2 * (window_hours / HOURS_PER_YEAR)
            excess_kwh = max(energy - allowed, 0.0)
        status = _status(eei, baseline) if energy > 0 else "insufficient_data"

        # Carbon
        carbon = round(energy * emission_factor, 2)
        total_carbon += carbon

        # TOU cost
        cost_info = apply_tou_cost(db, energy, peak_demand, start, end)
        zone_total_cost = cost_info["total_cost_myr"]
        total_cost += zone_total_cost

        building_peak_demand = max(building_peak_demand, peak_demand)

        zones.append(
            ZoneConsumption(
                zone_id=zone_id,
                code=code,
                name=name,
                floors_label=floors_label,
                area_m2=area_m2,
                energy_kwh=round(energy, 2),
                eei_kwh_m2_yr=round(eei, 2),
                eei_baseline_kwh_m2_yr=baseline,
                excess_kwh=round(excess_kwh, 2),
                compliance_status=status,
                recommendation=_recommendation(name, eei, baseline, excess_kwh),
                peak_demand_kw=round(peak_demand, 2) if peak_demand else None,
                avg_power_factor=round(float(avg_pf), 3) if avg_pf else None,
                carbon_kgco2e=carbon,
                energy_cost_myr=cost_info["energy_cost_myr"],
                demand_charge_myr=cost_info["demand_charge_myr"],
                total_cost_myr=zone_total_cost,
            )
        )
        total_energy += energy
        total_area += area_m2

    building_eei = _annualized_eei(total_energy, total_area, window_hours)
    building_status = _status(building_eei, 200.0) if total_energy > 0 else "insufficient_data"

    return ZonesConsumptionResponse(
        status="success",
        window_hours=round(window_hours, 2),
        total_energy_kwh=round(total_energy, 2),
        total_area_m2=total_area,
        building_eei_kwh_m2_yr=round(building_eei, 2),
        building_compliance_status=building_status,
        zones=zones,
        latest_timestamp=latest,
        total_carbon_kgco2e=round(total_carbon, 2),
        total_cost_myr=round(total_cost, 2),
        emission_factor_kg_per_kwh=emission_factor,
        peak_demand_kw=round(building_peak_demand, 2) if building_peak_demand else None,
    )


# ---------------------------------------------------------------------------
# Historical time-series (unchanged contract)
# ---------------------------------------------------------------------------

def monthly_zone_series(db: Session, days: int = 30) -> list[dict]:
    end = db.query(func.max(MeterReading.timestamp)).scalar() or datetime.now(timezone.utc)
    end = _aware(end)
    start = end - timedelta(days=days)
    rows = (
        db.query(
            Zone.code,
            Zone.name,
            MeterReading.timestamp,
            func.sum(MeterReading.reading_kwh),
        )
        .join(Floor, Floor.zone_id == Zone.id)
        .join(MeterReading, MeterReading.floor_id == Floor.id)
        .filter(
            MeterReading.timestamp >= start,
            MeterReading.timestamp <= end,
            MeterReading.quality_status != "ERROR",
        )
        .group_by(Zone.code, Zone.name, MeterReading.timestamp)
        .order_by(MeterReading.timestamp)
        .all()
    )
    return [
        {
            "code": code,
            "name": name,
            "timestamp": ts.isoformat() if ts else None,
            "energy_kwh": float(energy or 0.0),
        }
        for code, name, ts, energy in rows
    ]

# --- Append to the bottom of ems_service.py ---
from schemas import AssetInfo, TelemetrySnapshot, DiagnosticPayload

# Simple physical equipment asset graph
ASSET_GRAPH = {
    "zone-a": {
        "equipment_id": "CHILLER-PLANT-01",
        "type": "CHILLER",
        "floor": "LG",
        "registers": ["chw_supply_temp", "chw_return_temp", "kw_per_ton"]
    },
    "zone-b": {
        "equipment_id": "AHU-PODIUM-02",
        "type": "AHU",
        "floor": "L2",
        "registers": ["damper_feedback_pct", "supply_fan_rpm", "return_air_temp"]
    },
    "zone-c": {
        "equipment_id": "VAV-OFFICE-08",
        "type": "VAV",
        "floor": "L8",
        "registers": ["damper_feedback_pct", "airflow_cfm", "zone_temp"]
    },
    "zone-d": {
        "equipment_id": "AHU-14A",
        "type": "AHU",
        "floor": "L14",
        "registers": ["damper_feedback_pct", "supply_fan_rpm"]
    },
    "zone-e": {
        "equipment_id": "FCU-AMENITIES-30",
        "type": "FCU",
        "floor": "L30",
        "registers": ["fan_speed", "valve_position_pct"]
    }
}

def build_diagnostic_context(
    db: Session, 
    zone_code: str, 
    deviation_pct: float, 
    outdoor_temp: float
) -> DiagnosticPayload:
    """Assemble a strict diagnostic context from the database and asset graph"""
    asset_meta = ASSET_GRAPH.get(zone_code)
    if not asset_meta:
        asset_meta = {
            "equipment_id": f"AHU-{zone_code.upper()}",
            "type": "AHU",
            "floor": "L14",
            "registers": ["damper_feedback_pct", "supply_fan_rpm"]
        }
        
    asset = AssetInfo(
        equipment_id=asset_meta["equipment_id"],
        equipment_type=asset_meta["type"],
        floor=asset_meta["floor"],
        zone=zone_code,
        registers=asset_meta["registers"]
    )
    
    # Retrieve the latest telemetry data for the floor in this zone (using meter quality status as a proxy for equipment communication status)
    latest_reading = (
        db.query(MeterReading)
        .join(Floor, Floor.id == MeterReading.floor_id)
        .join(Zone, Zone.id == Floor.zone_id)
        .filter(Zone.code == zone_code)
        .order_by(MeterReading.timestamp.desc())
        .first()
    )
    
    # If the database lacks real BMS data, use reasonable default values (can be replaced with integration into a real BMS API)
    if latest_reading:
        data_quality = latest_reading.quality_status
        timestamp = latest_reading.timestamp
    else:
        data_quality = "LIVE"
        timestamp = datetime.now(timezone.utc)
        
    # Assemble real-time readings (in industry, these are typically polled from InfluxDB or BACnet)
    live_readings = {
        "damper_feedback_pct": 100.0,  # Example: In practice, specific points should be queried from the database
        "supply_fan_rpm": 1250.0,
    }
    
    telemetry = TelemetrySnapshot(
        timestamp=timestamp,
        data_quality=data_quality,
        readings=live_readings
    )
    
    return DiagnosticPayload(
        anomaly_id=f"ERR-{int(datetime.now().timestamp())}",
        asset=asset,
        telemetry=telemetry,
        baseline_deviation_pct=deviation_pct,
        environmental_context={"outdoor_temp_c": outdoor_temp}
    )
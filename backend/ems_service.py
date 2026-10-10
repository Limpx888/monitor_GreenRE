"""Ingest + JOIN aggregation + GreenRE EEI compliance."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence, Union

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from db_models import Floor, MeterReading, Zone
from schemas import TelemetryReading, ZoneConsumption, ZonesConsumptionResponse

HOURS_PER_YEAR = 8760.0


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


def ingest_readings(db: Session, payloads: Sequence[TelemetryReading]) -> int:
    if not payloads:
        return 0

    codes = {item.floor_id.upper() for item in payloads}
    floors = db.query(Floor).filter(Floor.code.in_(codes)).all()
    code_to_id = {floor.code.upper(): floor.id for floor in floors}
    missing = sorted(codes - set(code_to_id))
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown floor_id values: {missing}")

    rows = [
        {
            "timestamp": _aware(item.timestamp),
            "floor_id": code_to_id[item.floor_id.upper()],
            "meter_type": item.meter_type,
            "reading_kwh": item.reading_kwh,
        }
        for item in payloads
    ]

    dialect = db.bind.dialect.name if db.bind is not None else "postgresql"
    insert_fn = sqlite_insert if dialect == "sqlite" else pg_insert
    stmt = insert_fn(MeterReading).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["timestamp", "floor_id", "meter_type"],
        set_={"reading_kwh": stmt.excluded.reading_kwh},
    )
    db.execute(stmt)
    db.commit()
    return len(rows)


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

    rows = (
        db.query(
            Zone.id,
            Zone.code,
            Zone.name,
            Zone.floors_label,
            Zone.area_m2,
            Zone.eei_baseline_kwh_m2_yr,
            func.coalesce(func.sum(MeterReading.reading_kwh), 0.0),
        )
        .outerjoin(Floor, Floor.zone_id == Zone.id)
        .outerjoin(
            MeterReading,
            (MeterReading.floor_id == Floor.id)
            & (MeterReading.timestamp >= start)
            & (MeterReading.timestamp <= end)
            & (MeterReading.meter_type == "electricity"),
        )
        .group_by(
            Zone.id,
            Zone.code,
            Zone.name,
            Zone.floors_label,
            Zone.area_m2,
            Zone.eei_baseline_kwh_m2_yr,
        )
        .order_by(Zone.id)
        .all()
    )

    zones: List[ZoneConsumption] = []
    total_energy = 0.0
    total_area = 0.0
    for zone_id, code, name, floors_label, area_m2, baseline, energy in rows:
        energy = float(energy or 0.0)
        area_m2 = float(area_m2 or 0.0)
        baseline = float(baseline or 0.0)
        eei = _annualized_eei(energy, area_m2, window_hours)
        excess_kwh = 0.0
        if eei > baseline and baseline > 0:
            allowed = baseline * area_m2 * (window_hours / HOURS_PER_YEAR)
            excess_kwh = max(energy - allowed, 0.0)
        status = _status(eei, baseline) if energy > 0 else "insufficient_data"
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
    )


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
        .filter(MeterReading.timestamp >= start, MeterReading.timestamp <= end)
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

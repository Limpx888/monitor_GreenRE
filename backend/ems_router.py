from datetime import datetime, timezone
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from pydantic import BaseModel
from database import get_db
from db_models import Floor, MeterReading, Zone
from ems_service import ingest_readings, zone_consumption
from reports import build_greenre_pdf
from schemas import TelemetryBatch, TelemetryReading, TelemetryReadingSchema, ZonesConsumptionResponse

router = APIRouter(prefix="/api/v1", tags=["ems"])

# Global demo state bus for remote-controlling the simulator from the frontend
current_demo_scenario = {"mode": "nominal"}


class ScenarioUpdate(BaseModel):
    mode: str


@router.post("/demo/scenario")
@router.post("/api/v1/demo/scenario")
async def update_scenario(payload: ScenarioUpdate):
    current_demo_scenario["mode"] = payload.mode
    print(f"[Demo Bus] State changed -> mode: {payload.mode}")
    return {"status": "success", "mode": current_demo_scenario["mode"], "current_mode": current_demo_scenario["mode"]}


@router.get("/demo/scenario")
@router.get("/api/v1/demo/scenario")
async def get_scenario():
    return current_demo_scenario


@router.post("/telemetry/ingest")
def ingest_telemetry(
    payload: Union[List[TelemetryReadingSchema], TelemetryBatch, TelemetryReadingSchema],
    db: Session = Depends(get_db),
):
    try:
        if isinstance(payload, TelemetryReading):
            items = [payload]
        elif isinstance(payload, TelemetryBatch):
            items = payload.readings
        elif isinstance(payload, list):
            items = payload
        else:
            items = [payload]
        count = ingest_readings(db, items)
        return {"status": "success", "inserted_count": count, "ingested": count}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}


@router.get("/zones/consumption", response_model=ZonesConsumptionResponse)
def get_zone_consumption(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    return zone_consumption(db, start=start, end=end)


@router.get("/reports/greenre")
def download_greenre_evidence(db: Session = Depends(get_db)):
    pdf_bytes = build_greenre_pdf(db)
    filename = f"greenre-evidence-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard/nilm-live")
@router.get("/api/v1/dashboard/nilm-live")
def get_nilm_live_data(db: Session = Depends(get_db)):
    """Single Source of Truth: latest hourly readings for each zone + airtight total."""
    short_names = {
        "zone-d": "Hyatt Hotel",
        "zone-c": "Offices",
        "zone-b": "Podium",
        "zone-a": "M&E Plant",
        "zone-e": "Amenities",
    }
    color_map = {
        "Hyatt Hotel": "#ef4444",
        "Offices": "#3b82f6",
        "Podium": "#eab308",
        "M&E Plant": "#9ca3af",
        "Amenities": "#10b981",
        "zone-d": "#ef4444",
        "zone-c": "#3b82f6",
        "zone-b": "#eab308",
        "zone-a": "#9ca3af",
        "zone-e": "#10b981",
    }

    latest_time = (
        db.query(func.max(MeterReading.timestamp))
        .filter(MeterReading.meter_type == "electricity")
        .scalar()
    )

    if latest_time is None:
        loads = [
            {"zone_name": "Hyatt Hotel", "reading_kwh": 420.0, "color": "#ef4444"},
            {"zone_name": "Offices", "reading_kwh": 310.0, "color": "#3b82f6"},
            {"zone_name": "Podium", "reading_kwh": 185.0, "color": "#eab308"},
            {"zone_name": "M&E Plant", "reading_kwh": 92.0, "color": "#9ca3af"},
            {"zone_name": "Amenities", "reading_kwh": 40.0, "color": "#10b981"},
        ]
        return {
            "total_main_meter_kwh": round(sum(x["reading_kwh"] for x in loads), 1),
            "timestamp": None,
            "disaggregated_loads": loads,
        }

    latest_readings = (
        db.query(
            Zone.code,
            Zone.name,
            func.coalesce(func.sum(MeterReading.reading_kwh), 0.0).label("kwh"),
        )
        .join(Floor, Floor.zone_id == Zone.id)
        .join(
            MeterReading,
            (MeterReading.floor_id == Floor.id)
            & (MeterReading.timestamp == latest_time)
            & (MeterReading.meter_type == "electricity"),
        )
        .group_by(Zone.code, Zone.name, Zone.id)
        .order_by(Zone.id)
        .all()
    )

    disaggregated = []
    for row in latest_readings:
        disp_name = short_names.get(row.code, row.name)
        color = color_map.get(disp_name) or color_map.get(row.code, "#64748b")
        disaggregated.append({
            "zone_name": disp_name,
            "reading_kwh": round(float(row.kwh), 1),
            "color": color,
        })

    # Exact mathematical sum on backend to ensure 100% alignment between main and sub meters
    total_main = round(sum(item["reading_kwh"] for item in disaggregated), 1)

    return {
        "total_main_meter_kwh": total_main,
        "timestamp": latest_time.isoformat() if latest_time else None,
        "disaggregated_loads": disaggregated,
    }


@router.get("/dashboard/nilm-history")
@router.get("/api/v1/dashboard/nilm-history")
def get_nilm_history(db: Session = Depends(get_db)):
    """Past 24 hours stacked time-series for Recharts AreaChart with stackId='1'."""
    short_names = {
        "zone-d": "Hyatt Hotel",
        "zone-c": "Offices",
        "zone-b": "Podium",
        "zone-a": "M&E Plant",
        "zone-e": "Amenities",
    }

    tss = [
        t[0]
        for t in db.query(MeterReading.timestamp)
        .filter(MeterReading.meter_type == "electricity")
        .distinct()
        .order_by(MeterReading.timestamp.desc())
        .limit(24)
        .all()
    ][::-1]

    if not tss:
        return []

    rows = (
        db.query(
            MeterReading.timestamp,
            Zone.code,
            func.sum(MeterReading.reading_kwh).label("kwh"),
        )
        .join(Floor, Floor.id == MeterReading.floor_id)
        .join(Zone, Zone.id == Floor.zone_id)
        .filter(MeterReading.timestamp.in_(tss))
        .group_by(MeterReading.timestamp, Zone.code)
        .all()
    )

    from collections import defaultdict

    data_by_ts = defaultdict(dict)
    for ts, code, kwh in rows:
        disp_name = short_names.get(code, code)
        data_by_ts[ts][disp_name] = round(float(kwh), 1)

    result = []
    for ts in tss:
        entry = data_by_ts.get(ts, {})
        hour_label = f"{ts.hour:02d}:00"
        hyatt = entry.get("Hyatt Hotel", 0.0)
        offices = entry.get("Offices", 0.0)
        podium = entry.get("Podium", 0.0)
        me = entry.get("M&E Plant", 0.0)
        amenities = entry.get("Amenities", 0.0)
        total = round(hyatt + offices + podium + me + amenities, 1)

        result.append({
            "time": hour_label,
            "timestamp": ts.isoformat(),
            "total": total,
            "total_kwh": total,
            "Hyatt Hotel": hyatt,
            "Offices": offices,
            "Podium": podium,
            "M&E Plant": me,
            "Amenities": amenities,
        })

    return result

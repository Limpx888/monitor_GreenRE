"""EMS API Router v2.0

Routes
------
Telemetry
  POST  /api/v1/telemetry/ingest

Zones
  GET   /api/v1/zones/consumption

Alarms (Phase 3)
  GET   /api/v1/alarms
  GET   /api/v1/alarms/{id}
  POST  /api/v1/alarms/{id}/acknowledge
  POST  /api/v1/alarms/{id}/investigate
  POST  /api/v1/alarms/{id}/resolve
  POST  /api/v1/alarms/{id}/close

Control (Phase 3 stubs)
  POST  /api/v1/control/hvac/setpoint
  POST  /api/v1/control/hvac/mode
  POST  /api/v1/control/lighting/scene
  GET   /api/v1/control/audit

Dashboard
  GET   /api/v1/dashboard/nilm-live
  GET   /api/v1/dashboard/nilm-history

Demo State Bus
  GET   /api/v1/demo/scenario
  POST  /api/v1/demo/scenario

Reports
  GET   /api/v1/reports/greenre

Tariff
  GET   /api/v1/tariff/rates
"""

from datetime import datetime, timezone
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from pydantic import BaseModel
from database import get_db
from db_models import Floor, MeterReading, Zone
from ems_service import compute_demand_kw, ingest_readings, zone_consumption
from alarm_service import (
    acknowledge_alarm,
    auto_close_stale_info_alarms,
    close_alarm,
    get_alarm,
    investigate_alarm,
    list_alarms,
    resolve_alarm,
)
from control_adapters import ControlAuditLog, ControlResult, HVACController, get_dispatcher, log_command
from reports import build_greenre_pdf
from schemas import (
    AlarmAcknowledgeRequest,
    AlarmCloseRequest,
    AlarmInvestigateRequest,
    AlarmListResponse,
    AlarmRead,
    AlarmResolveRequest,
    HvacModeCommand,
    HvacSetpointCommand,
    LightingSceneCommand,
    TelemetryBatch,
    TelemetryReading,
    TelemetryReadingSchema,
    TouRateRead,
    ZonesConsumptionResponse,
)
from db_models import TouTariffRate

router = APIRouter(prefix="/api/v1", tags=["ems"])

# Global demo state bus for remote-controlling the simulator from the frontend
current_demo_scenario = {"mode": "nominal"}


# ---------------------------------------------------------------------------
# Demo State Bus
# ---------------------------------------------------------------------------

class ScenarioUpdate(BaseModel):
    mode: str


@router.post("/demo/scenario")
@router.post("/api/v1/demo/scenario")
async def update_scenario(payload: ScenarioUpdate):
    current_demo_scenario["mode"] = payload.mode
    print(f"[Demo Bus] State changed -> mode: {payload.mode}")
    return {"status": "success", "mode": current_demo_scenario["mode"],
            "current_mode": current_demo_scenario["mode"]}


@router.get("/demo/scenario")
@router.get("/api/v1/demo/scenario")
async def get_scenario():
    return current_demo_scenario


# ---------------------------------------------------------------------------
# Telemetry Ingest
# ---------------------------------------------------------------------------

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
        result = ingest_readings(db, items)
        return {"status": "success", **result}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Zone Consumption
# ---------------------------------------------------------------------------

@router.get("/zones/consumption", response_model=ZonesConsumptionResponse)
def get_zone_consumption(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    return zone_consumption(db, start=start, end=end)


# ---------------------------------------------------------------------------
# Alarm Lifecycle (Phase 3)
# ---------------------------------------------------------------------------

@router.get("/alarms", response_model=AlarmListResponse)
def get_alarms(
    state: Optional[str] = Query(None, description="OPEN|ACKNOWLEDGED|INVESTIGATING|RESOLVED|CLOSED"),
    severity: Optional[str] = Query(None, description="CRITICAL|HIGH|MEDIUM|LOW|INFO"),
    zone_id: Optional[int] = Query(None),
    floor_id: Optional[int] = Query(None),
    since: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List alarms with optional filters. Auto-closes stale INFO alarms first."""
    auto_close_stale_info_alarms(db)
    return list_alarms(
        db,
        state=state,
        severity=severity,
        zone_id=zone_id,
        floor_id=floor_id,
        since=since,
        limit=limit,
        offset=offset,
    )


@router.get("/alarms/{alarm_id}", response_model=AlarmRead)
def get_alarm_detail(alarm_id: int, db: Session = Depends(get_db)):
    return get_alarm(db, alarm_id)


@router.post("/alarms/{alarm_id}/acknowledge", response_model=AlarmRead)
def ack_alarm(
    alarm_id: int,
    req: AlarmAcknowledgeRequest,
    db: Session = Depends(get_db),
):
    """Acknowledge an OPEN alarm and assign it to a staff member."""
    return acknowledge_alarm(db, alarm_id, req)


@router.post("/alarms/{alarm_id}/investigate", response_model=AlarmRead)
def investigate_alarm_ep(
    alarm_id: int,
    req: AlarmInvestigateRequest,
    db: Session = Depends(get_db),
):
    """Mark an ACKNOWLEDGED alarm as under investigation."""
    return investigate_alarm(db, alarm_id, req)


@router.post("/alarms/{alarm_id}/resolve", response_model=AlarmRead)
def resolve_alarm_ep(
    alarm_id: int,
    req: AlarmResolveRequest,
    db: Session = Depends(get_db),
):
    """Resolve an INVESTIGATING alarm. root_cause is required."""
    return resolve_alarm(db, alarm_id, req)


@router.post("/alarms/{alarm_id}/close", response_model=AlarmRead)
def close_alarm_ep(
    alarm_id: int,
    req: AlarmCloseRequest,
    db: Session = Depends(get_db),
):
    """Close a RESOLVED alarm, completing the lifecycle."""
    return close_alarm(db, alarm_id, req)


# ---------------------------------------------------------------------------
# Control Endpoints (Phase 3 stubs — safe StubDispatcher default)
# ---------------------------------------------------------------------------

@router.post("/control/hvac/setpoint")
async def control_hvac_setpoint(
    cmd: HvacSetpointCommand,
    db: Session = Depends(get_db),
):
    """
    Dispatch an HVAC setpoint command to a zone.

    Currently routes to StubDispatcher (safe no-op).
    Set CONTROL_PROTOCOL=bacnet_ip or modbus_tcp in .env to activate real adapters.
    """
    dispatcher = get_dispatcher()
    protocol = type(dispatcher).__name__
    result = await dispatcher.set_hvac_setpoint(
        device_id=str(cmd.zone_id), setpoint=cmd.setpoint_c
    )
    log_command(db, result, target_type="zone", protocol=protocol, operator=cmd.operator)
    return result.to_dict()


@router.post("/control/hvac/mode")
async def control_hvac_mode(
    cmd: HvacModeCommand,
    db: Session = Depends(get_db),
):
    """Dispatch an HVAC mode command (cool|heat|fan|off)."""
    dispatcher = get_dispatcher()
    protocol = type(dispatcher).__name__
    result = await dispatcher.set_hvac_mode(device_id=str(cmd.zone_id), mode=cmd.mode)
    log_command(db, result, target_type="zone", protocol=protocol, operator=cmd.operator)
    return result.to_dict()


@router.post("/control/lighting/scene")
async def control_lighting_scene(
    cmd: LightingSceneCommand,
    db: Session = Depends(get_db),
):
    """Dispatch a lighting scene command (full|50pct|off) to a floor."""
    dispatcher = get_dispatcher()
    protocol = type(dispatcher).__name__
    result = await dispatcher.set_lighting_scene(device_id=str(cmd.floor_id), scene=cmd.scene)
    log_command(db, result, target_type="floor", protocol=protocol, operator=cmd.operator)
    return result.to_dict()


class RemediatePayload(BaseModel):
    action: str = "reset_damper"
    floor_id: str = "L14"
    register_addr: int = 12
    target_val: int = 15
    operator: Optional[str] = None


@router.post("/control/remediate")
async def apply_remediate(
    payload: RemediatePayload,
    db: Session = Depends(get_db),
):
    """Execute-and-verify damper reset (default L14 AHU night position 15%)."""
    controller = HVACController()
    outcome = controller.execute_and_verify(
        register_addr=payload.register_addr,
        target_val=payload.target_val,
    )
    floor_token = "".join(ch for ch in payload.floor_id if ch.isdigit()) or "0"
    result = ControlResult(
        success=outcome["verified"],
        command=payload.action,
        target_id=int(floor_token),
        requested_value=payload.target_val,
        confirmed_value=outcome["confirmed"],
        message=outcome["log"],
    )
    log_command(
        db,
        result,
        target_type="floor",
        protocol=outcome["protocol"],
        operator=payload.operator,
    )
    return {
        "status": "SUCCESS" if outcome["verified"] else "FAILED",
        "log": outcome["log"],
        "action": payload.action,
        "floor_id": payload.floor_id,
        "requested": outcome["requested"],
        "confirmed": outcome["confirmed"],
        "protocol": outcome["protocol"],
    }


@router.get("/control/audit")
def get_control_audit(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Return all control commands dispatched, newest first."""
    total = db.query(ControlAuditLog).count()
    rows = (
        db.query(ControlAuditLog)
        .order_by(ControlAuditLog.dispatched_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "commands": [
            {
                "id": r.id,
                "dispatched_at": r.dispatched_at.isoformat() if r.dispatched_at else None,
                "command": r.command,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "requested_value": r.requested_value,
                "confirmed_value": r.confirmed_value,
                "protocol": r.protocol,
                "success": bool(r.success),
                "latency_ms": r.latency_ms,
                "operator": r.operator,
                "message": r.message,
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# TOU Tariff rates (read-only)
# ---------------------------------------------------------------------------

@router.get("/tariff/rates", response_model=List[TouRateRead])
def get_tariff_rates(db: Session = Depends(get_db)):
    """Return all active TOU tariff rate bands."""
    return db.query(TouTariffRate).filter(TouTariffRate.is_active == True).all()  # noqa: E712


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.get("/reports/greenre")
def download_greenre_evidence(db: Session = Depends(get_db)):
    pdf_bytes = build_greenre_pdf(db)
    filename = f"greenre-evidence-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Dashboard — NILM Live
# ---------------------------------------------------------------------------

@router.get("/dashboard/nilm-live")
@router.get("/api/v1/dashboard/nilm-live")
def get_nilm_live_data(db: Session = Depends(get_db)):
    """Single Source of Truth: latest batch readings for each zone + airtight total.

    Uses a 60-second window anchored on the global latest timestamp so that all 5
    zones in the same streamer batch are captured even when their microsecond
    timestamps differ slightly (fixes the '55.0 kWh Hyatt-only' split-brain bug).
    """
    from datetime import timedelta

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
        return {
            "total_main_meter_kwh": 0.0,
            "total_main_meter_kw": 0.0,
            "timestamp": None,
            "window_start": None,
            "disaggregated_loads": [],
        }

    # 60-second window: captures all floors whose readings arrived in the same batch
    # even when the streamer sends them with slightly different microsecond timestamps.
    window_start = latest_time - timedelta(seconds=60)

    latest_readings = (
        db.query(
            Zone.code,
            Zone.name,
            func.coalesce(func.sum(MeterReading.reading_kwh), 0.0).label("kwh"),
            func.coalesce(func.max(MeterReading.demand_kw), 0.0).label("demand"),
            func.coalesce(func.avg(MeterReading.power_factor), None).label("pf"),
        )
        .join(Floor, Floor.zone_id == Zone.id)
        .join(
            MeterReading,
            (MeterReading.floor_id == Floor.id)
            & (MeterReading.timestamp >= window_start)
            & (MeterReading.timestamp <= latest_time)
            & (MeterReading.meter_type == "electricity")
            & (MeterReading.quality_status != "ERROR"),
        )
        .group_by(Zone.code, Zone.name, Zone.id)
        .order_by(Zone.id)
        .all()
    )

    disaggregated = []
    for row in latest_readings:
        disp_name = short_names.get(row.code, row.name)
        color = color_map.get(disp_name) or color_map.get(row.code, "#64748b")
        kwh = round(float(row.kwh), 1)
        demand = round(float(row.demand), 1) if row.demand else round(compute_demand_kw(kwh), 1)
        disaggregated.append({
            "zone_name": disp_name,
            "zone_code": row.code,
            "reading_kwh": kwh,
            "demand_kw": demand,
            "avg_power_factor": round(float(row.pf), 3) if row.pf else None,
            "color": color,
        })

    total_kwh = round(sum(item["reading_kwh"] for item in disaggregated), 1)
    total_kw = round(sum((item["demand_kw"] or 0.0) for item in disaggregated), 1)

    return {
        "total_main_meter_kwh": total_kwh,
        "total_main_meter_kw": total_kw,
        "timestamp": latest_time.isoformat() if latest_time else None,
        "window_start": window_start.isoformat(),
        "disaggregated_loads": disaggregated,
    }


# ---------------------------------------------------------------------------
# Dashboard — NILM History
# ---------------------------------------------------------------------------

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
            func.coalesce(func.sum(MeterReading.demand_kw), 0.0).label("demand"),
        )
        .join(Floor, Floor.id == MeterReading.floor_id)
        .join(Zone, Zone.id == Floor.zone_id)
        .filter(MeterReading.timestamp.in_(tss))
        .group_by(MeterReading.timestamp, Zone.code)
        .all()
    )

    from collections import defaultdict

    data_by_ts = defaultdict(dict)
    for ts, code, kwh, demand in rows:
        disp_name = short_names.get(code, code)
        kw = float(demand) if demand else compute_demand_kw(float(kwh or 0.0))
        data_by_ts[ts][disp_name] = round(kw, 1)

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
            "total_kw": total,
            "total_kwh": round(total / 4.0, 1),
            "Hyatt Hotel": hyatt,
            "Offices": offices,
            "Podium": podium,
            "M&E Plant": me,
            "Amenities": amenities,
        })

    return result

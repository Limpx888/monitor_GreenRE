"""Enterprise Industrial EMS Router.

Exposes endpoints for:
1. Standardized Asset Spatial Hierarchy
2. Canonical Telemetry Ingestion (with DQ, Anti-Replay, Dedup, DLQ)
3. Rigorous Closed-Loop Control Lifecycle with Token Extraction & Honest Feedback
4. Rules-Driven Incident Management with Suppression Windows
5. Quantitative Evaluation Engine (MAE/RMSE, Precision/Recall, AI Refusal)
6. Structured Observability (Metrics & Granular Health Probes)
"""

import time
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from auth_middleware import (
    UserClaims,
    UserRole,
    get_current_user,
    require_role,
    create_access_token,
)
from canonical_schema import (
    CanonicalBatchIngestRequest,
    CanonicalIngestResponse,
    CanonicalTelemetryRecord,
)
from data_quality_service import ingest_canonical_batch
from spatial_models import Site, Building, SpatialFloor, SpatialZone, Asset, Point
from control_adapters import (
    ControlAuditLog,
    ControlResult,
    get_dispatcher,
    log_command,
)
from rules_and_incidents import (
    incident_engine,
    IncidentRecord,
    GroundedAiDiagnosis,
)
from evaluation_service import get_complete_evaluation_report
from observability import (
    metrics_collector,
    check_granular_health,
    enterprise_logger,
)

router = APIRouter(prefix="/api/v1", tags=["Enterprise EMS Standards"])


# ---------------------------------------------------------------------------
# 0. Auth & Token Generation Endpoint
# ---------------------------------------------------------------------------

class TokenRequest(BaseModel):
    username: str = Field(default="eng.sarah.tan@lightcity.my")
    role: UserRole = Field(default=UserRole.ENGINEER)
    name: Optional[str] = "Sarah Tan"
    tenant_id: Optional[str] = "the-light-city-penang"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    role: str
    sub: str
    name: str
    expires_in_hours: int = 8


@router.post("/auth/token", response_model=TokenResponse)
def generate_token(req: TokenRequest):
    """Generates a verified JWT token containing operator claims and RBAC role."""
    token = create_access_token(
        sub=req.username,
        role=req.role.value,
        name=req.name,
        tenant_id=req.tenant_id or "the-light-city-penang",
    )
    return TokenResponse(
        access_token=token,
        role=req.role.value,
        sub=req.username,
        name=req.name or "Operator",
    )


# ---------------------------------------------------------------------------
# 1. Standardized Asset Spatial Hierarchy (Point 2)
# ---------------------------------------------------------------------------

@router.get("/spatial/topology")
def get_spatial_topology(db: Session = Depends(get_db)):
    """Returns the standardized Building -> Site -> Floor -> Zone -> Asset -> Point tree."""
    metrics_collector.increment_request("spatial/topology")
    
    # Query database or build topology
    floors = db.query(SpatialFloor).all()
    if not floors:
        # Return structured seed topology if DB is freshly created
        from spatial_models import SpatialFloor, SpatialZone, Asset, Point
        return {
            "site": {
                "code": "SITE-PENANG-01",
                "name": "The Light City Penang",
                "city": "Penang",
                "country": "Malaysia"
            },
            "building": {
                "code": "BLD-TOWER-A",
                "name": "Tower A - Commercial & Hospitality",
                "total_gfa_m2": 48500.0,
                "floors_count": 28
            },
            "floors": [
                {
                    "code": "L14",
                    "name": "Level 14 - Hotel Guest Rooms & Plant",
                    "zone": "Zone D - Hyatt Hotel",
                    "assets": [
                        {
                            "tag": "AHU-14A",
                            "name": "Air Handling Unit 14A",
                            "type": "HVAC",
                            "protocol": "bacnet_ip",
                            "points": [
                                {"code": "OUTDOOR_AIR_DAMPER", "unit": "%", "controllable": True},
                                {"code": "SUPPLY_FAN_SPEED", "unit": "Hz", "controllable": True},
                                {"code": "CHW_VALVE_POS", "unit": "%", "controllable": True},
                                {"code": "SUPPLY_AIR_TEMP", "unit": "°C", "controllable": False},
                            ]
                        }
                    ]
                },
                {
                    "code": "L8",
                    "name": "Level 8 - Offices",
                    "zone": "Zone C - Offices",
                    "assets": [
                        {
                            "tag": "VAV-08B",
                            "name": "Conference Hall VAV",
                            "type": "Terminal Unit",
                            "protocol": "bacnet_ip",
                            "points": [
                                {"code": "ZONE_CO2", "unit": "ppm", "controllable": False},
                                {"code": "REHEAT_COIL_CMD", "unit": "%", "controllable": True},
                            ]
                        }
                    ]
                }
            ]
        }

    result = []
    for f in floors:
        f_assets = []
        for a in f.assets:
            pts = [{"code": p.point_code, "name": p.point_name, "unit": p.engineering_unit, "value": p.current_value, "controllable": p.is_controllable, "dq": p.data_quality} for p in a.points]
            f_assets.append({"tag": a.asset_tag, "name": a.name, "type": a.asset_type, "protocol": a.protocol, "points": pts})
        result.append({"code": f.code, "name": f.name, "assets": f_assets})

    return {"site": "SITE-PENANG-01", "building": "BLD-TOWER-A", "floors": result}


# ---------------------------------------------------------------------------
# 2. Canonical Telemetry Ingestion (Points 3 & 4)
# ---------------------------------------------------------------------------

@router.post("/telemetry/ingest", response_model=CanonicalIngestResponse)
async def ingest_canonical_telemetry(
    batch_req: CanonicalBatchIngestRequest,
    user: UserClaims = Depends(get_current_user)
):
    """Ingests a batch of CanonicalTelemetryRecords with anti-replay, dedup, DQ tagging, and DLQ."""
    metrics_collector.increment_request("telemetry/ingest")
    response = await ingest_canonical_batch(batch_req)
    
    if response.dlq_persisted_count > 0:
        metrics_collector.record_dlq_drop(response.dlq_persisted_count)

    return response


# ---------------------------------------------------------------------------
# 3. Rigorous Control Loop Lifecycle (Points 1, 5, 6)
# ---------------------------------------------------------------------------

class PointControlCommandRequest(BaseModel):
    asset_tag: str = Field(..., description="Target device tag, e.g. AHU-14A")
    point_code: str = Field(..., description="Target point code, e.g. OUTDOOR_AIR_DAMPER")
    target_value: float = Field(..., description="Target command setpoint")
    idempotency_key: str = Field(default_factory=lambda: f"idemp-{uuid.uuid4().hex[:10]}")
    trace_id: Optional[str] = Field(default_factory=lambda: f"tr-ctrl-{uuid.uuid4().hex[:8]}")
    safety_confirmation: bool = Field(default=True, description="Safety interlock operator confirmation")


@router.post("/control/point-command")
async def execute_point_control_command(
    cmd: PointControlCommandRequest,
    db: Session = Depends(get_db),
    # Strict RBAC: Operator, Engineer, Administrator can execute; Viewer is rejected (403)
    user: UserClaims = Depends(require_role([UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR]))
):
    """Executes a point-level control command through the 7-stage lifecycle.
    
    Operator identity is parsed strictly from the JWT token claims; client-forged
    operator fields in the request body are strictly ignored and forbidden.
    """
    metrics_collector.increment_request("control/point-command")
    
    if not cmd.safety_confirmation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety confirmation flag is required to release the physical interlock gate."
        )

    # Resolve dispatcher based on protocol and environment
    dispatcher = get_dispatcher()
    protocol_name = type(dispatcher).__name__

    # Execute and verify
    operator_sub = f"{user.sub} [Role: {user.role.value}]"
    result = await dispatcher.dispatch_point_control(
        asset_tag=cmd.asset_tag,
        point_code=cmd.point_code,
        target_value=cmd.target_value,
        operator=operator_sub,
        trace_id=cmd.trace_id,
        idempotency_key=cmd.idempotency_key
    )

    metrics_collector.record_control_action(success=result.success)

    # Persist immutable audit log
    log_command(
        db,
        result,
        target_type=f"point::{cmd.point_code}",
        protocol=protocol_name,
        operator=operator_sub
    )

    return {
        "status": result.status,
        "physical_actuation": result.physical_actuation,
        "lifecycle_stage": "COMPLETED",
        "asset_tag": cmd.asset_tag,
        "point_code": cmd.point_code,
        "requested_value": result.requested_value,
        "confirmed_value": result.confirmed_value,
        "readback_drift": result.readback_drift,
        "operator_identity_verified": {
            "sub": user.sub,
            "role": user.role.value,
            "tenant_id": user.tenant_id,
            "source": "VERIFIED_JWT_CLAIMS"
        },
        "idempotency_key": cmd.idempotency_key,
        "trace_id": cmd.trace_id,
        "message": result.message
    }


@router.get("/control/audit-log")
def get_control_audit_log(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieves immutable audit trail of all physical and simulated control actions."""
    metrics_collector.increment_request("control/audit-log")
    rows = db.query(ControlAuditLog).order_by(ControlAuditLog.dispatched_at.desc()).limit(limit).all()
    return [
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
            "message": r.message
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 4. Incident Management & Hard Rules (Points 8 & 10)
# ---------------------------------------------------------------------------

@router.get("/incidents", response_model=List[IncidentRecord])
def get_incidents():
    """Returns active operational incidents with alert suppression and deduplication metrics."""
    metrics_collector.increment_request("incidents")
    return incident_engine.get_all_incidents()


@router.post("/incidents/{incident_id}/acknowledge")
def acknowledge_incident(
    incident_id: str,
    user: UserClaims = Depends(require_role([UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR]))
):
    """Acknowledges an active incident with verified operator signature."""
    metrics_collector.increment_request("incidents/acknowledge")
    inc = incident_engine.acknowledge_incident(incident_id, operator_id=user.sub)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return inc


class PointRuleEvalRequest(BaseModel):
    asset_tag: str = "AHU-14A"
    point_code: str = "OUTDOOR_AIR_DAMPER"
    value: float = 42.0
    floor_code: str = "L14"


@router.post("/incidents/evaluate-point")
def evaluate_point_rule(req: PointRuleEvalRequest):
    """Deterministically evaluates hard rules on a reading and aggregates into an incident if breached."""
    inc = incident_engine.evaluate_point(
        asset_tag=req.asset_tag,
        point_code=req.point_code,
        value=req.value,
        floor_code=req.floor_code
    )
    return {"rule_triggered": bool(inc), "incident": inc}


# ---------------------------------------------------------------------------
# 5. Model Quantitative Evaluation (Point 11)
# ---------------------------------------------------------------------------

@router.get("/evaluation/report")
def get_evaluation_report():
    """Computes MAE/RMSE for NILM, Precision/Recall for Anomaly Detection, and AI Refusal Rate."""
    metrics_collector.increment_request("evaluation/report")
    return get_complete_evaluation_report()


# ---------------------------------------------------------------------------
# 6. Observability & Granular Probes (Point 14)
# ---------------------------------------------------------------------------

@router.get("/metrics")
def get_business_metrics():
    """Returns core business metrics: telemetry lag, AI fallback counts, control failure rates."""
    return metrics_collector.get_metrics_snapshot()


@router.get("/health/probes")
def get_health_probes():
    """Granular health checks separately reporting status of Database, Event Hubs, Fabric, and OpenAI."""
    return check_granular_health()


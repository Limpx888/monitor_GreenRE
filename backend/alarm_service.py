"""Alarm lifecycle service — enforces the state machine.

Valid transitions
----------------
OPEN          → ACKNOWLEDGED   POST /api/v1/alarms/{id}/acknowledge
ACKNOWLEDGED  → INVESTIGATING  POST /api/v1/alarms/{id}/investigate
INVESTIGATING → RESOLVED       POST /api/v1/alarms/{id}/resolve  (root_cause required)
RESOLVED      → CLOSED         POST /api/v1/alarms/{id}/close
OPEN          → CLOSED         auto (INFO severity, > 24 h)
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db_models import Alarm, AlarmSeverity, AlarmState
from schemas import (
    AlarmAcknowledgeRequest,
    AlarmCloseRequest,
    AlarmInvestigateRequest,
    AlarmListResponse,
    AlarmRead,
    AlarmResolveRequest,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_read(alarm: Alarm) -> AlarmRead:
    return AlarmRead.model_validate(alarm)


def _get_alarm_or_404(db: Session, alarm_id: int) -> Alarm:
    alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    if alarm is None:
        raise HTTPException(status_code=404, detail=f"Alarm {alarm_id} not found")
    return alarm


VALID_TRANSITIONS = {
    AlarmState.OPEN: {AlarmState.ACKNOWLEDGED, AlarmState.CLOSED},
    AlarmState.ACKNOWLEDGED: {AlarmState.INVESTIGATING},
    AlarmState.INVESTIGATING: {AlarmState.RESOLVED},
    AlarmState.RESOLVED: {AlarmState.CLOSED},
    AlarmState.CLOSED: set(),  # terminal
}


def _assert_transition(alarm: Alarm, target: str) -> None:
    current = alarm.state
    allowed = {s.value for s in VALID_TRANSITIONS.get(AlarmState(current), set())}
    if target not in allowed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot transition alarm from '{current}' to '{target}'. "
                f"Allowed next states: {sorted(allowed) or ['none (terminal)']}"
            ),
        )


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def list_alarms(
    db: Session,
    state: Optional[str] = None,
    severity: Optional[str] = None,
    zone_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    since: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> AlarmListResponse:
    """Return filtered, paginated list of alarms."""
    q = db.query(Alarm)
    if state:
        q = q.filter(Alarm.state == state)
    if severity:
        q = q.filter(Alarm.severity == severity)
    if zone_id:
        q = q.filter(Alarm.zone_id == zone_id)
    if floor_id:
        q = q.filter(Alarm.floor_id == floor_id)
    if since:
        q = q.filter(Alarm.generated_at >= since)
    total = q.count()
    alarms = q.order_by(Alarm.generated_at.desc()).offset(offset).limit(limit).all()
    return AlarmListResponse(total=total, alarms=[_to_read(a) for a in alarms])


def get_alarm(db: Session, alarm_id: int) -> AlarmRead:
    return _to_read(_get_alarm_or_404(db, alarm_id))


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------

def acknowledge_alarm(db: Session, alarm_id: int, req: AlarmAcknowledgeRequest) -> AlarmRead:
    alarm = _get_alarm_or_404(db, alarm_id)
    _assert_transition(alarm, AlarmState.ACKNOWLEDGED)
    alarm.state = AlarmState.ACKNOWLEDGED
    alarm.acknowledged_at = _now()
    alarm.assigned_to = req.assigned_to
    if req.notes:
        alarm.notes = req.notes
    db.commit()
    db.refresh(alarm)
    return _to_read(alarm)


def investigate_alarm(db: Session, alarm_id: int, req: AlarmInvestigateRequest) -> AlarmRead:
    alarm = _get_alarm_or_404(db, alarm_id)
    _assert_transition(alarm, AlarmState.INVESTIGATING)
    alarm.state = AlarmState.INVESTIGATING
    alarm.investigated_at = _now()
    if req.notes:
        alarm.notes = (alarm.notes or "") + f"\n[INVESTIGATING] {req.notes}"
    db.commit()
    db.refresh(alarm)
    return _to_read(alarm)


def resolve_alarm(db: Session, alarm_id: int, req: AlarmResolveRequest) -> AlarmRead:
    alarm = _get_alarm_or_404(db, alarm_id)
    _assert_transition(alarm, AlarmState.RESOLVED)
    alarm.state = AlarmState.RESOLVED
    alarm.resolved_at = _now()
    alarm.root_cause = req.root_cause
    if req.notes:
        alarm.notes = (alarm.notes or "") + f"\n[RESOLVED] {req.notes}"
    db.commit()
    db.refresh(alarm)
    return _to_read(alarm)


def close_alarm(db: Session, alarm_id: int, req: AlarmCloseRequest) -> AlarmRead:
    alarm = _get_alarm_or_404(db, alarm_id)
    _assert_transition(alarm, AlarmState.CLOSED)
    alarm.state = AlarmState.CLOSED
    alarm.closed_at = _now()
    if req.notes:
        alarm.notes = (alarm.notes or "") + f"\n[CLOSED] {req.notes}"
    db.commit()
    db.refresh(alarm)
    return _to_read(alarm)


# ---------------------------------------------------------------------------
# Auto-close INFO alarms older than 24 h
# ---------------------------------------------------------------------------

def auto_close_stale_info_alarms(db: Session) -> int:
    """Auto-close INFO-severity OPEN alarms older than 24 h.

    Returns the number of alarms closed.
    """
    cutoff = _now() - timedelta(hours=24)
    stale = (
        db.query(Alarm)
        .filter(
            Alarm.state == AlarmState.OPEN,
            Alarm.severity == AlarmSeverity.INFO,
            Alarm.generated_at <= cutoff,
        )
        .all()
    )
    for alarm in stale:
        alarm.state = AlarmState.CLOSED
        alarm.closed_at = _now()
        alarm.notes = (alarm.notes or "") + "\n[AUTO-CLOSED] INFO alarm auto-cleared after 24 h."
    db.commit()
    return len(stale)

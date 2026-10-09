"""
3R Actions board endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models import User, Action, Site, AuditLog
from app.schemas import ActionCreate, ActionUpdate, ActionOut
from app.services.recommendations import generate_recommendations

router = APIRouter(prefix="/api/v1/actions", tags=["actions"])


@router.get("", response_model=list[ActionOut])
def list_actions(
    site_id: str = Query(...),
    status: Optional[str] = Query(None),
    hierarchy: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List 3R actions for a site."""
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    q = db.query(Action).filter(Action.site_id == site_id)
    if status:
        q = q.filter(Action.status == status)
    if hierarchy:
        q = q.filter(Action.hierarchy_level == hierarchy)

    return q.order_by(Action.created_at.desc()).all()


@router.post("/generate")
def generate_actions(
    site_id: str = Query(...),
    days: int = Query(30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate 3R recommendations from recent waste data."""
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    recs = generate_recommendations(db, site_id, days)

    # Save as actions
    created = []
    for r in recs:
        action = Action(
            site_id=site_id,
            title=r["title"],
            description=r["description"],
            hierarchy_level=r["hierarchy_level"],
            evidence_summary=r["evidence_summary"],
            estimated_saving_kg=r["estimated_saving_kg"],
            estimated_saving_co2e=r["estimated_saving_co2e"],
            effort_level=r["effort_level"],
            before_metric=r.get("before_metric"),
            status="suggested",
        )
        db.add(action)
        created.append(action)

    db.commit()

    return {
        "generated": len(created),
        "actions": [ActionOut.model_validate(a) for a in created],
    }


@router.post("", response_model=ActionOut)
def create_action(
    data: ActionCreate,
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Manually create a 3R action."""
    action = Action(
        site_id=site_id,
        title=data.title,
        description=data.description,
        hierarchy_level=data.hierarchy_level,
        evidence_summary=data.evidence_summary,
        estimated_saving_kg=data.estimated_saving_kg,
        estimated_saving_co2e=data.estimated_saving_co2e,
        effort_level=data.effort_level,
        owner_id=data.owner_id,
        status="suggested",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.put("/{action_id}", response_model=ActionOut)
def update_action(
    action_id: str,
    update: ActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an action (change status, add results)."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found.")

    site = db.query(Site).filter(Site.id == action.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    old_status = action.status

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(action, field, value)

    if update.status == "done" and old_status != "done":
        action.completed_at = datetime.now(timezone.utc)

    # Audit
    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="update_action",
        entity_type="action",
        entity_id=action_id,
        old_value={"status": old_status},
        new_value=update.model_dump(exclude_unset=True),
    )
    db.add(audit)
    db.commit()
    db.refresh(action)
    return action

"""
GreenRE compliance reporting endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models import User, Site, GreenRERequirement, AuditLog
from app.schemas import GreenRECreate, GreenREUpdate, GreenREOut

router = APIRouter(prefix="/api/v1/greenre", tags=["greenre"])


@router.get("", response_model=list[GreenREOut])
def list_requirements(
    site_id: str = Query(...),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List GreenRE requirements for a site."""
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    q = db.query(GreenRERequirement).filter(GreenRERequirement.site_id == site_id)
    if status:
        q = q.filter(GreenRERequirement.status == status)

    return q.order_by(GreenRERequirement.requirement_code).all()


@router.post("", response_model=GreenREOut)
def create_requirement(
    data: GreenRECreate,
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Add a GreenRE requirement to track."""
    req = GreenRERequirement(
        site_id=site_id,
        requirement_code=data.requirement_code,
        requirement_description=data.requirement_description,
        status="not_started",
        updated_by=current_user.id,
    )
    db.add(req)

    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="create_greenre_requirement",
        entity_type="greenre_requirement",
        entity_id=req.id,
        new_value={"code": data.requirement_code},
    )
    db.add(audit)
    db.commit()
    db.refresh(req)
    return req


@router.put("/{req_id}", response_model=GreenREOut)
def update_requirement(
    req_id: str,
    update: GreenREUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a GreenRE requirement status or evidence."""
    req = db.query(GreenRERequirement).filter(GreenRERequirement.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found.")

    site = db.query(Site).filter(Site.id == req.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    old_status = req.status

    if update.status is not None:
        req.status = update.status
    if update.evidence_notes is not None:
        req.evidence_notes = update.evidence_notes

    req.updated_at = datetime.now(timezone.utc)
    req.updated_by = current_user.id

    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="update_greenre_requirement",
        entity_type="greenre_requirement",
        entity_id=req_id,
        old_value={"status": old_status},
        new_value={"status": req.status, "evidence_notes": req.evidence_notes},
    )
    db.add(audit)
    db.commit()
    db.refresh(req)
    return req


@router.get("/report")
def generate_report(
    site_id: str = Query(...),
    period: str = Query("monthly", description="monthly/quarterly/annual"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a compliance report summary for a period."""
    from app.services.analytics_service import compute_analytics

    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    analytics = compute_analytics(db, site_id, start_date=start_dt, end_date=end_dt)

    requirements = db.query(GreenRERequirement).filter(
        GreenRERequirement.site_id == site_id
    ).all()

    req_summary = {
        "total": len(requirements),
        "not_started": sum(1 for r in requirements if r.status == "not_started"),
        "in_progress": sum(1 for r in requirements if r.status == "in_progress"),
        "evidence_attached": sum(1 for r in requirements if r.status == "evidence_attached"),
    }

    return {
        "site_name": site.name,
        "site_type": site.site_type,
        "period": period,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analytics": analytics,
        "requirements_summary": req_summary,
        "requirements": [GreenREOut.model_validate(r) for r in requirements],
        "methodology": (
            "Waste quantities are estimated from AI-detected item counts multiplied by "
            "average weights per class. Measured weights from weighbridge tickets and collection "
            "records are used where available and always take precedence. Recycling rates are "
            "calculated as recycled weight divided by total waste weight. CO₂e savings are estimated "
            "using emission factors per material type, comparing recycling vs landfill disposal. "
            "All estimates are clearly labelled and should be verified by auditors."
        ),
    }

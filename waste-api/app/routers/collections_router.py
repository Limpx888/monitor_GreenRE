"""
Collections (pickup events) endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Site, Collection, ReductionTarget
from app.schemas import (
    CollectionCreate, CollectionOut,
    ReductionTargetCreate, ReductionTargetOut,
)

router = APIRouter(prefix="/api/v1", tags=["collections"])


@router.get("/collections", response_model=list[CollectionOut])
def list_collections(
    site_id: str = Query(...),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List waste collection events for a site."""
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    return (
        db.query(Collection)
        .filter(Collection.site_id == site_id)
        .order_by(Collection.collected_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/collections", response_model=CollectionOut)
def create_collection(
    data: CollectionCreate,
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a waste collection event with measured weight."""
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    collection = Collection(
        site_id=site_id,
        location_id=data.location_id,
        measured_weight_kg=data.measured_weight_kg,
        waste_category=data.waste_category,
        contractor=data.contractor,
        receipt_ref=data.receipt_ref,
        notes=data.notes,
        collected_at=data.collected_at or datetime.now(timezone.utc),
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


# ── Reduction Targets ──

@router.get("/targets", response_model=list[ReductionTargetOut])
def list_targets(
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List reduction targets for a site."""
    return (
        db.query(ReductionTarget)
        .filter(ReductionTarget.site_id == site_id)
        .all()
    )


@router.post("/targets", response_model=ReductionTargetOut)
def create_target(
    data: ReductionTargetCreate,
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a reduction target."""
    target = ReductionTarget(
        site_id=site_id,
        metric=data.metric,
        target_value=data.target_value,
        baseline_value=data.baseline_value,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return target

"""
Analytics endpoints for the dashboard.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.schemas import AnalyticsSummary
from app.services.analytics_service import compute_analytics

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsSummary)
def get_analytics(
    site_id: str = Query(...),
    location_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, description="ISO date: 2024-01-01"),
    end_date: Optional[str] = Query(None, description="ISO date: 2024-12-31"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get analytics summary for a site within a date range."""
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    return compute_analytics(
        db=db,
        site_id=site_id,
        location_id=location_id,
        start_date=start_dt,
        end_date=end_dt,
        category=category,
    )

"""
Authentication endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.models import User, Organization
from app.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    token = create_access_token({"sub": user.id, "role": user.role, "org_id": user.org_id})

    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            org_id=user.org_id,
            org_name=org.name if org else None,
            default_site_id=user.default_site_id,
        ),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current authenticated user."""
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        org_id=current_user.org_id,
        org_name=org.name if org else None,
        default_site_id=current_user.default_site_id,
    )


@router.get("/sites", response_model=list)
def get_user_sites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all sites accessible to the current user."""
    from app.models import Site
    sites = db.query(Site).filter(Site.org_id == current_user.org_id).all()
    return [{"id": s.id, "name": s.name, "site_type": s.site_type, "address": s.address} for s in sites]


@router.get("/locations/{site_id}", response_model=list)
def get_site_locations(site_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all locations for a site."""
    from app.models import Location, Site
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    locations = db.query(Location).filter(Location.site_id == site_id).all()
    return [{"id": l.id, "name": l.name, "bin_type": l.bin_type, "floor": l.floor, "zone": l.zone} for l in locations]

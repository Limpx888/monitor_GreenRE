"""
Waste class configuration CRUD.
Admins can edit class → category mappings per site.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models import User, WasteClassConfig, AuditLog
from app.schemas import WasteClassConfigOut, WasteClassConfigUpdate, WasteClassConfigCreate

router = APIRouter(prefix="/api/v1/waste-config", tags=["waste-config"])


@router.get("", response_model=list[WasteClassConfigOut])
def list_configs(
    site_id: str = Query(None, description="Filter by site. Omit for global defaults."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List waste class configurations (global defaults + site overrides)."""
    q = db.query(WasteClassConfig)
    if site_id:
        q = q.filter(
            (WasteClassConfig.site_id == site_id) | (WasteClassConfig.site_id == None)
        )
    else:
        q = q.filter(WasteClassConfig.site_id == None)

    return q.order_by(WasteClassConfig.class_name).all()


@router.post("", response_model=WasteClassConfigOut)
def create_config(
    data: WasteClassConfigCreate,
    site_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Create a new waste class configuration."""
    config = WasteClassConfig(
        site_id=site_id,
        class_name=data.class_name,
        category=data.category,
        material=data.material,
        avg_weight_kg=data.avg_weight_kg,
        emission_factor_kgco2e=data.emission_factor_kgco2e,
        recyclable_locally=data.recyclable_locally,
        tip_reduce=data.tip_reduce,
        tip_reuse=data.tip_reuse,
        tip_recycle=data.tip_recycle,
    )
    db.add(config)

    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="create_waste_config",
        entity_type="waste_class_config",
        entity_id=config.id,
        new_value={"class_name": data.class_name, "category": data.category},
    )
    db.add(audit)
    db.commit()
    db.refresh(config)
    return config


@router.put("/{config_id}", response_model=WasteClassConfigOut)
def update_config(
    config_id: str,
    update: WasteClassConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Update a waste class configuration."""
    config = db.query(WasteClassConfig).filter(WasteClassConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found.")

    old_values = {
        "category": config.category,
        "avg_weight_kg": config.avg_weight_kg,
        "emission_factor_kgco2e": config.emission_factor_kgco2e,
    }

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="update_waste_config",
        entity_type="waste_class_config",
        entity_id=config_id,
        old_value=old_values,
        new_value=update.model_dump(exclude_unset=True),
    )
    db.add(audit)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{config_id}")
def delete_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Delete a waste class configuration."""
    config = db.query(WasteClassConfig).filter(WasteClassConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found.")

    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="delete_waste_config",
        entity_type="waste_class_config",
        entity_id=config_id,
        old_value={"class_name": config.class_name, "category": config.category},
    )
    db.add(audit)
    db.delete(config)
    db.commit()
    return {"status": "deleted"}

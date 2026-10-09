"""
Scan history and review/correction endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Scan, Detection, Site, AuditLog
from app.schemas import ScanOut, DetectionOut, DetectionUpdate
from app.services.categorizer import get_class_config, get_tip_for_detection

router = APIRouter(prefix="/api/v1/scans", tags=["scans"])


@router.get("", response_model=list[ScanOut])
def list_scans(
    site_id: str = Query(...),
    status: str = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List scans for a site, most recent first."""
    # Tenant isolation
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Site not found or access denied.")

    q = db.query(Scan).filter(Scan.site_id == site_id)
    if status:
        q = q.filter(Scan.status == status)

    scans = q.order_by(Scan.created_at.desc()).offset(offset).limit(limit).all()
    return scans


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single scan with its detections."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    # Tenant isolation
    site = db.query(Site).filter(Site.id == scan.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    return scan


@router.put("/{scan_id}/detections/{detection_id}")
def update_detection(
    scan_id: str,
    detection_id: str,
    update: DetectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a detection (correct class, delete, set weight, etc.)."""
    detection = db.query(Detection).filter(
        Detection.id == detection_id,
        Detection.scan_id == scan_id,
    ).first()

    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found.")

    # Tenant isolation
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    site = db.query(Site).filter(Site.id == scan.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    old_values = {
        "class_name": detection.corrected_class_name or detection.class_name,
        "category": detection.category,
        "is_deleted": detection.is_deleted,
        "needs_review": detection.needs_review,
    }

    if update.corrected_class_name is not None:
        detection.corrected_class_name = update.corrected_class_name
        # Update category based on corrected class
        config = get_class_config(update.corrected_class_name)
        detection.category = config["category"]
        detection.material = config["material"]
        detection.estimated_weight_kg = config["avg_weight_kg"]
        detection.tip = get_tip_for_detection(update.corrected_class_name, config["category"])
        detection.needs_review = False

    if update.category is not None:
        detection.category = update.category

    if update.measured_weight_kg is not None:
        detection.measured_weight_kg = update.measured_weight_kg
        detection.weight_source = "MEASURED"

    if update.is_deleted is not None:
        detection.is_deleted = update.is_deleted

    if update.needs_review is not None:
        detection.needs_review = update.needs_review

    # Save corrected output on the scan
    if scan.corrected_output is None:
        scan.corrected_output = []
    scan.corrected_output = [
        {
            "detection_id": d.id,
            "class_name": d.corrected_class_name or d.class_name,
            "category": d.category,
            "is_deleted": d.is_deleted,
        }
        for d in scan.detections
    ]

    # Audit log
    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="update_detection",
        entity_type="detection",
        entity_id=detection_id,
        old_value=old_values,
        new_value={
            "corrected_class_name": detection.corrected_class_name,
            "category": detection.category,
            "is_deleted": detection.is_deleted,
            "needs_review": detection.needs_review,
        },
    )
    db.add(audit)
    db.commit()

    return {"status": "updated", "detection": DetectionOut.model_validate(detection)}


@router.post("/{scan_id}/detections")
def add_manual_detection(
    scan_id: str,
    class_name: str = Query(...),
    category: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually add a missed detection to a scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    site = db.query(Site).filter(Site.id == scan.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    config = get_class_config(class_name)

    detection = Detection(
        scan_id=scan_id,
        class_name=class_name,
        confidence=1.0,  # Manual = high confidence
        category=category or config["category"],
        material=config["material"],
        estimated_weight_kg=config["avg_weight_kg"],
        weight_source="ESTIMATED",
        needs_review=False,
        tip=get_tip_for_detection(class_name, category or config["category"]),
    )
    db.add(detection)

    # Audit log
    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="add_manual_detection",
        entity_type="detection",
        entity_id=detection.id,
        new_value={"class_name": class_name, "category": category or config["category"]},
    )
    db.add(audit)
    db.commit()

    return {"status": "created", "detection": DetectionOut.model_validate(detection)}


@router.put("/{scan_id}/confirm")
def confirm_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm a scan after review."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    site = db.query(Site).filter(Site.id == scan.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    scan.status = "confirmed"
    for d in scan.detections:
        if d.needs_review and not d.is_deleted:
            d.needs_review = False

    db.commit()
    return {"status": "confirmed", "scan_id": scan_id}


@router.get("/{scan_id}/export-yolo")
def export_yolo_labels(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export corrected detections in YOLO format for retraining.
    Returns class_id, x_center, y_center, width, height (normalized).
    """
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    site = db.query(Site).filter(Site.id == scan.site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Access denied.")

    # Get image dimensions from raw_model_output or estimate
    lines = []
    for d in scan.detections:
        if d.is_deleted:
            continue
        bbox = d.bbox
        if not bbox:
            continue

        class_name = d.corrected_class_name or d.class_name
        # We'd need the class index — for now use class_name
        # In production, map back to model's class indices
        x_center = (bbox["x1"] + bbox["x2"]) / 2
        y_center = (bbox["y1"] + bbox["y2"]) / 2
        width = bbox["x2"] - bbox["x1"]
        height = bbox["y2"] - bbox["y1"]

        lines.append(f"{class_name} {x_center:.1f} {y_center:.1f} {width:.1f} {height:.1f}")

    scan.status = "exported"
    db.commit()

    return {
        "scan_id": scan_id,
        "image_path": scan.image_path,
        "labels": lines,
        "label_text": "\n".join(lines),
    }

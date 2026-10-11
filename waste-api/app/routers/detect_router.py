"""
Detection endpoint — core AI inference route.
POST /api/v1/detect: Upload image → YOLO inference → categorized results.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Scan, Detection, WasteClassConfig, Site
from app.schemas import DetectResponse, DetectionOut
from app.services.detector import run_inference
from app.services.categorizer import get_class_config, get_tip_for_detection
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["detect"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}


@router.post("/detect", response_model=DetectResponse)
async def detect_waste(
    file: UploadFile = File(...),
    site_id: str = Form(...),
    location_id: str = Form(None),
    note: str = Form(None),
    scan_mode: str = Form("upload"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image for waste detection.
    Returns annotated image and detection results with categories and tips.
    """

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: jpg, png, webp.",
        )

    # Read and validate file size
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum: {MAX_FILE_SIZE // (1024*1024)} MB.")

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Validate site access (tenant isolation)
    site = db.query(Site).filter(Site.id == site_id, Site.org_id == current_user.org_id).first()
    if not site:
        raise HTTPException(status_code=403, detail="Site not found or access denied.")

    # Save original image
    scan_id = str(uuid.uuid4())
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    img_filename = f"{scan_id}.{ext}"
    ann_filename = f"{scan_id}_annotated.jpg"

    img_path = os.path.join(settings.upload_dir, img_filename)
    ann_path = os.path.join(settings.upload_dir, ann_filename)

    with open(img_path, "wb") as f:
        f.write(image_bytes)

    # Run YOLO inference
    try:
        result = run_inference(
            image_bytes,
            confidence_threshold=settings.confidence_threshold,
            review_threshold=settings.review_threshold,
        )
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

    # Save annotated image
    if result["annotated_image_bytes"]:
        with open(ann_path, "wb") as f:
            f.write(result["annotated_image_bytes"])

    # Get site-specific configs (fall back to global defaults)
    site_configs = {}
    configs = db.query(WasteClassConfig).filter(
        (WasteClassConfig.site_id == site_id) | (WasteClassConfig.site_id == None)
    ).all()
    for c in configs:
        # Site-specific overrides global
        if c.class_name not in site_configs or c.site_id == site_id:
            site_configs[c.class_name] = c

    # Create scan record
    scan = Scan(
        id=scan_id,
        user_id=current_user.id,
        site_id=site_id,
        location_id=location_id,
        image_path=img_filename,
        annotated_image_path=ann_filename,
        raw_model_output=result["detections"],
        status="pending_review" if any(d["needs_review"] for d in result["detections"]) else "confirmed",
        note=note,
        scan_mode=scan_mode,
    )
    db.add(scan)

    # Create detection records
    detection_records = []
    category_counts = {}
    for det in result["detections"]:
        class_name = det["class_name"]

        # Look up config (site-specific → global default → code default)
        if class_name in site_configs:
            cfg = site_configs[class_name]
            category = cfg.category
            material = cfg.material
            weight = cfg.avg_weight_kg
            tip = get_tip_for_detection(class_name, category)
        else:
            default = get_class_config(class_name)
            category = default["category"]
            material = default["material"]
            weight = default["avg_weight_kg"]
            tip = get_tip_for_detection(class_name, category)

        detection = Detection(
            scan_id=scan_id,
            class_name=class_name,
            confidence=det["confidence"],
            bbox=det["bbox"],
            category=category,
            material=material,
            estimated_weight_kg=weight,
            weight_source="ESTIMATED",
            needs_review=det["needs_review"],
            tip=tip,
        )
        db.add(detection)
        detection_records.append(detection)

        # Count categories for summary
        category_counts[category] = category_counts.get(category, 0) + 1

    db.commit()
    db.refresh(scan)

    # Build response
    detections_out = []
    for d in detection_records:
        detections_out.append(DetectionOut(
            id=d.id,
            class_name=d.class_name,
            confidence=d.confidence,
            bbox=d.bbox,
            category=d.category,
            material=d.material,
            estimated_weight_kg=d.estimated_weight_kg,
            weight_source=d.weight_source,
            needs_review=d.needs_review,
            is_deleted=False,
            tip=d.tip,
        ))

    return DetectResponse(
        scan_id=scan_id,
        image_url=f"/api/v1/uploads/{img_filename}",
        annotated_image_url=f"/api/v1/uploads/{ann_filename}",
        detections=detections_out,
        summary={
            "total_items": len(detection_records),
            "needs_review": sum(1 for d in detection_records if d.needs_review),
            "category_counts": category_counts,
            "total_estimated_weight_kg": round(sum(d.estimated_weight_kg for d in detection_records), 3),
        },
    )

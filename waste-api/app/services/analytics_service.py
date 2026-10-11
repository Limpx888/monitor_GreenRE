"""
Analytics computation service.
Computes metrics from scan and detection data for the dashboard.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from typing import Optional

from app.models import Detection, Scan, Collection, ReductionTarget, WasteClassConfig
from app.services.categorizer import get_class_config


def compute_analytics(
    db: Session,
    site_id: str,
    location_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
) -> dict:
    """Compute all dashboard analytics for a site and date range."""

    # Default to last 30 days
    if not end_date:
        end_date = datetime.now(timezone.utc)
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Base query: confirmed detections within date range
    base_q = (
        db.query(Detection)
        .join(Scan, Detection.scan_id == Scan.id)
        .filter(
            Scan.site_id == site_id,
            Scan.created_at >= start_date,
            Scan.created_at <= end_date,
            Detection.is_deleted == False,
        )
    )

    if location_id:
        base_q = base_q.filter(Scan.location_id == location_id)
    if category:
        base_q = base_q.filter(Detection.category == category)

    detections = base_q.all()

    # Compute totals
    total_items = len(detections)
    estimated_weight = sum(d.estimated_weight_kg or 0 for d in detections)
    measured_weight = sum(d.measured_weight_kg or 0 for d in detections if d.measured_weight_kg)

    # Prefer measured weight where available
    total_weight = 0
    for d in detections:
        if d.weight_source == "MEASURED" and d.measured_weight_kg:
            total_weight += d.measured_weight_kg
        else:
            total_weight += d.estimated_weight_kg or 0

    # Add collection measured weights
    collection_q = db.query(Collection).filter(
        Collection.site_id == site_id,
        Collection.collected_at >= start_date,
        Collection.collected_at <= end_date,
    )
    if location_id:
        collection_q = collection_q.filter(Collection.location_id == location_id)

    collections = collection_q.all()
    measured_collection_weight = sum(c.measured_weight_kg for c in collections)

    # Category breakdown
    category_breakdown = {}
    for d in detections:
        cat = d.category or "UNKNOWN"
        if cat not in category_breakdown:
            category_breakdown[cat] = {"count": 0, "weight_kg": 0}
        category_breakdown[cat]["count"] += 1
        w = d.measured_weight_kg if d.weight_source == "MEASURED" and d.measured_weight_kg else (d.estimated_weight_kg or 0)
        category_breakdown[cat]["weight_kg"] += w

    # Material breakdown
    material_breakdown = {}
    for d in detections:
        mat = d.material or "unknown"
        if mat not in material_breakdown:
            material_breakdown[mat] = {"count": 0, "weight_kg": 0}
        material_breakdown[mat]["count"] += 1
        w = d.measured_weight_kg if d.weight_source == "MEASURED" and d.measured_weight_kg else (d.estimated_weight_kg or 0)
        material_breakdown[mat]["weight_kg"] += w

    # Recycling rate
    recycle_weight = category_breakdown.get("RECYCLE", {}).get("weight_kg", 0)
    organic_weight = category_breakdown.get("ORGANIC", {}).get("weight_kg", 0)

    recycling_rate = (recycle_weight / total_weight * 100) if total_weight > 0 else 0
    diversion_rate = ((recycle_weight + organic_weight) / total_weight * 100) if total_weight > 0 else 0

    # Contamination rate (recyclables found in general waste — approximation)
    # TODO: refine with actual bin-type data from locations
    contamination_count = sum(1 for d in detections if d.category == "RECYCLE" and d.needs_review)
    contamination_rate = (contamination_count / total_items * 100) if total_items > 0 else 0

    # CO2e avoided (estimated) — only for recycled items
    co2e_avoided = 0
    for d in detections:
        if d.category == "RECYCLE":
            config = get_class_config(d.corrected_class_name or d.class_name)
            w = d.measured_weight_kg if d.weight_source == "MEASURED" and d.measured_weight_kg else (d.estimated_weight_kg or 0)
            co2e_avoided += w * config.get("emission_factor_kgco2e", 1.0)

    # Daily trend
    daily_map = {}
    for d in detections:
        scan = d.scan
        day = scan.created_at.strftime("%Y-%m-%d") if scan and scan.created_at else "unknown"
        if day not in daily_map:
            daily_map[day] = {"date": day, "items": 0, "weight_kg": 0, "recycle": 0, "general": 0, "organic": 0, "hazardous": 0}
        daily_map[day]["items"] += 1
        w = d.measured_weight_kg if d.weight_source == "MEASURED" and d.measured_weight_kg else (d.estimated_weight_kg or 0)
        daily_map[day]["weight_kg"] += w
        cat_key = (d.category or "general").lower()
        if cat_key in daily_map[day]:
            daily_map[day][cat_key] += 1

    daily_trend = sorted(daily_map.values(), key=lambda x: x["date"])

    # Top 10 items
    item_counts = {}
    for d in detections:
        name = d.corrected_class_name or d.class_name
        if name not in item_counts:
            item_counts[name] = {"class_name": name, "count": 0, "weight_kg": 0}
        item_counts[name]["count"] += 1
        w = d.measured_weight_kg if d.weight_source == "MEASURED" and d.measured_weight_kg else (d.estimated_weight_kg or 0)
        item_counts[name]["weight_kg"] += w

    top_items = sorted(item_counts.values(), key=lambda x: -x["count"])[:10]

    # Target progress
    targets = db.query(ReductionTarget).filter(ReductionTarget.site_id == site_id).all()
    target_progress = []
    for t in targets:
        current = 0
        if t.metric == "recycling_rate":
            current = recycling_rate
        elif t.metric == "diversion_rate":
            current = diversion_rate
        elif t.metric == "total_waste":
            current = total_weight

        target_progress.append({
            "id": t.id,
            "metric": t.metric,
            "target_value": t.target_value,
            "baseline_value": t.baseline_value,
            "current_value": round(current, 2),
            "progress_pct": round(
                (current / t.target_value * 100) if t.target_value > 0 else 0, 1
            ),
            "start_date": str(t.start_date) if t.start_date else None,
            "end_date": str(t.end_date) if t.end_date else None,
        })

    return {
        "total_waste_kg": round(total_weight, 2),
        "estimated_waste_kg": round(estimated_weight, 2),
        "measured_waste_kg": round(measured_weight + measured_collection_weight, 2),
        "total_items": total_items,
        "recycling_rate": round(recycling_rate, 1),
        "diversion_rate": round(diversion_rate, 1),
        "contamination_rate": round(contamination_rate, 1),
        "co2e_avoided_kg": round(co2e_avoided, 2),
        "category_breakdown": category_breakdown,
        "material_breakdown": material_breakdown,
        "daily_trend": daily_trend,
        "top_items": top_items,
        "target_progress": target_progress,
    }

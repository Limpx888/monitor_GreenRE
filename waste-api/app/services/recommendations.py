"""
3R (Reduce, Reuse, Recycle) recommendation engine.
Analyzes waste patterns and generates actionable recommendations
following the waste hierarchy: Reduce > Reuse > Recycle > Dispose.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Detection, Scan, Action
from app.services.categorizer import get_class_config, DEFAULT_CLASS_MAP


# ──────────────────────────────────────────────
# Rule Definitions
# ──────────────────────────────────────────────
RULES = [
    {
        "id": "high_plastic_bottles",
        "trigger_class": "Plastic bottle",
        "min_count": 10,
        "hierarchy": "REDUCE",
        "title": "Install Water Refill Stations",
        "description": (
            "High volume of plastic bottles detected ({count} in the last {days} days). "
            "Install water refill stations or bulk dispensers to reduce single-use bottle consumption. "
            "Estimated reduction: 60-80% of plastic bottle waste."
        ),
        "effort": "medium",
        "saving_factor_kg": 0.6,  # 60% of current weight
        "co2e_factor": 0.6,
    },
    {
        "id": "high_cardboard",
        "trigger_class": "Cardboard",
        "min_count": 8,
        "hierarchy": "REUSE",
        "title": "Return Boxes to Suppliers",
        "description": (
            "{count} cardboard items detected in {days} days. "
            "Negotiate with suppliers to take back packaging or use returnable crates. "
            "Reuse sturdy boxes for internal storage and packing."
        ),
        "effort": "low",
        "saving_factor_kg": 0.4,
        "co2e_factor": 0.4,
    },
    {
        "id": "high_food_waste",
        "trigger_class": "Organic",
        "min_count": 15,
        "hierarchy": "REDUCE",
        "title": "Review Portion Control & Menu Planning",
        "description": (
            "Rising food waste detected ({count} organic items in {days} days). "
            "Implement portion control, review menu planning, and train kitchen staff on waste reduction. "
            "Consider composting for unavoidable food waste."
        ),
        "effort": "medium",
        "saving_factor_kg": 0.3,
        "co2e_factor": 0.3,
    },
    {
        "id": "paper_cup_overuse",
        "trigger_class": "Paper cups",
        "min_count": 20,
        "hierarchy": "REDUCE",
        "title": "Switch to Reusable Cups",
        "description": (
            "{count} disposable paper cups detected in {days} days. "
            "Provide reusable mugs for staff and offer discounts for bring-your-own cups. "
            "Paper cups with plastic lining are rarely recyclable."
        ),
        "effort": "low",
        "saving_factor_kg": 0.7,
        "co2e_factor": 0.7,
    },
    {
        "id": "plastic_bag_volume",
        "trigger_class": "Plastic bag",
        "min_count": 15,
        "hierarchy": "REDUCE",
        "title": "Implement Reusable Bag Policy",
        "description": (
            "{count} plastic bags found in {days} days. "
            "Implement a reusable bag policy for staff and guests. "
            "Plastic bags are rarely accepted in kerbside recycling."
        ),
        "effort": "low",
        "saving_factor_kg": 0.8,
        "co2e_factor": 0.8,
    },
    {
        "id": "disposable_tableware",
        "trigger_class": "Disposable tableware",
        "min_count": 15,
        "hierarchy": "REDUCE",
        "title": "Switch to Reusable Tableware",
        "description": (
            "{count} disposable tableware items in {days} days. "
            "Invest in durable reusable plates, cups, and cutlery. "
            "The upfront cost pays off within months."
        ),
        "effort": "medium",
        "saving_factor_kg": 0.8,
        "co2e_factor": 0.8,
    },
    {
        "id": "glass_bottle_reuse",
        "trigger_class": "Glass bottle",
        "min_count": 10,
        "hierarchy": "REUSE",
        "title": "Set Up Glass Bottle Return Program",
        "description": (
            "{count} glass bottles in {days} days. "
            "Partner with suppliers for a bottle return program. "
            "Glass is heavy and expensive to transport for recycling."
        ),
        "effort": "medium",
        "saving_factor_kg": 0.5,
        "co2e_factor": 0.5,
    },
    {
        "id": "textile_waste",
        "trigger_class": "Textile",
        "min_count": 5,
        "hierarchy": "REUSE",
        "title": "Donate or Repurpose Textiles",
        "description": (
            "{count} textile items in {days} days. "
            "Set up a textile donation bin for wearable items. "
            "Repurpose damaged textiles as cleaning rags. Textiles have very high CO₂e impact."
        ),
        "effort": "low",
        "saving_factor_kg": 0.6,
        "co2e_factor": 0.6,
    },
    {
        "id": "hazardous_awareness",
        "trigger_category": "HAZARDOUS",
        "min_count": 3,
        "hierarchy": "RECYCLE",
        "title": "Set Up Hazardous Waste Collection Point",
        "description": (
            "{count} hazardous items detected in {days} days. "
            "Ensure a clearly marked hazardous waste collection point is available. "
            "Train staff on proper handling and never mix with general waste."
        ),
        "effort": "medium",
        "saving_factor_kg": 0.0,
        "co2e_factor": 0.0,
    },
    {
        "id": "contamination_high",
        "trigger_type": "contamination",
        "min_count": 5,
        "hierarchy": "RECYCLE",
        "title": "Improve Bin Signage & Staff Training",
        "description": (
            "High contamination detected — {count} items flagged for review or misplaced in {days} days. "
            "Install clear, visual signage on bins showing what goes where. "
            "Conduct a 15-minute waste sorting refresher for staff."
        ),
        "effort": "low",
        "saving_factor_kg": 0.2,
        "co2e_factor": 0.2,
    },
]


def generate_recommendations(
    db: Session,
    site_id: str,
    days: int = 30,
) -> list[dict]:
    """
    Analyze recent waste data and generate 3R recommendations.
    Returns a list of recommendation dicts ready to be saved as Actions.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Get recent detections for this site
    detections = (
        db.query(Detection)
        .join(Scan, Detection.scan_id == Scan.id)
        .filter(
            Scan.site_id == site_id,
            Scan.created_at >= cutoff,
            Detection.is_deleted == False,
        )
        .all()
    )

    if not detections:
        return []

    # Count by class name
    class_counts = {}
    for d in detections:
        name = d.corrected_class_name or d.class_name
        class_counts[name] = class_counts.get(name, 0) + 1

    # Count by category
    category_counts = {}
    for d in detections:
        cat = d.category or "UNKNOWN"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # Count items needing review (proxy for contamination)
    review_count = sum(1 for d in detections if d.needs_review)

    # Get existing active action IDs to avoid duplicates
    existing_actions = (
        db.query(Action.title)
        .filter(
            Action.site_id == site_id,
            Action.status.in_(["suggested", "in_progress"]),
        )
        .all()
    )
    existing_titles = {a.title for a in existing_actions}

    recommendations = []

    for rule in RULES:
        # Check trigger
        count = 0

        if "trigger_class" in rule:
            count = class_counts.get(rule["trigger_class"], 0)
        elif "trigger_category" in rule:
            count = category_counts.get(rule["trigger_category"], 0)
        elif rule.get("trigger_type") == "contamination":
            count = review_count

        if count < rule["min_count"]:
            continue

        # Skip if already active
        if rule["title"] in existing_titles:
            continue

        # Calculate estimated savings
        config = get_class_config(rule.get("trigger_class", "Organic"))
        avg_weight = config.get("avg_weight_kg", 0.05)
        current_weight = count * avg_weight
        saving_kg = round(current_weight * rule["saving_factor_kg"], 2)
        emission_factor = config.get("emission_factor_kgco2e", 1.0)
        saving_co2e = round(saving_kg * emission_factor * rule["co2e_factor"], 2)

        recommendations.append({
            "title": rule["title"],
            "description": rule["description"].format(count=count, days=days),
            "hierarchy_level": rule["hierarchy"],
            "evidence_summary": f"Based on {count} detections of {rule.get('trigger_class', rule.get('trigger_category', 'items'))} in the last {days} days.",
            "estimated_saving_kg": saving_kg,
            "estimated_saving_co2e": saving_co2e,
            "effort_level": rule["effort"],
            "before_metric": current_weight,
        })

    # Sort: REDUCE first, then REUSE, then RECYCLE
    hierarchy_order = {"REDUCE": 0, "REUSE": 1, "RECYCLE": 2}
    recommendations.sort(key=lambda r: hierarchy_order.get(r["hierarchy_level"], 3))

    return recommendations

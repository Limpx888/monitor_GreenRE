"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ──────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    org_id: str
    org_name: Optional[str] = None
    default_site_id: Optional[str] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Organization / Site / Location
# ──────────────────────────────────────────────
class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    model_config = {"from_attributes": True}

class SiteOut(BaseModel):
    id: str
    org_id: str
    name: str
    site_type: str
    address: Optional[str] = None
    model_config = {"from_attributes": True}

class LocationOut(BaseModel):
    id: str
    site_id: str
    name: str
    bin_type: str
    floor: Optional[str] = None
    zone: Optional[str] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Detection
# ──────────────────────────────────────────────
class BBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class DetectionOut(BaseModel):
    id: str
    class_name: str
    corrected_class_name: Optional[str] = None
    confidence: float
    bbox: Optional[dict] = None
    category: Optional[str] = None
    material: Optional[str] = None
    estimated_weight_kg: float = 0.0
    measured_weight_kg: Optional[float] = None
    weight_source: str = "ESTIMATED"
    needs_review: bool = False
    is_deleted: bool = False
    tip: Optional[str] = None

    model_config = {"from_attributes": True}

class DetectionUpdate(BaseModel):
    corrected_class_name: Optional[str] = None
    category: Optional[str] = None
    measured_weight_kg: Optional[float] = None
    is_deleted: Optional[bool] = None
    needs_review: Optional[bool] = None


# ──────────────────────────────────────────────
# Scan
# ──────────────────────────────────────────────
class ScanOut(BaseModel):
    id: str
    user_id: str
    site_id: str
    location_id: Optional[str] = None
    image_path: Optional[str] = None
    annotated_image_path: Optional[str] = None
    status: str = "pending_review"
    note: Optional[str] = None
    scan_mode: str = "upload"
    created_at: datetime
    detections: list[DetectionOut] = []

    model_config = {"from_attributes": True}

class DetectResponse(BaseModel):
    scan_id: str
    image_url: str
    annotated_image_url: str
    detections: list[DetectionOut]
    summary: dict  # category counts, total items, etc.


# ──────────────────────────────────────────────
# Waste Class Config
# ──────────────────────────────────────────────
class WasteClassConfigOut(BaseModel):
    id: str
    site_id: Optional[str] = None
    class_name: str
    category: str
    material: Optional[str] = None
    avg_weight_kg: float = 0.05
    emission_factor_kgco2e: float = 1.0
    recyclable_locally: bool = False
    tip_reduce: Optional[str] = None
    tip_reuse: Optional[str] = None
    tip_recycle: Optional[str] = None

    model_config = {"from_attributes": True}

class WasteClassConfigUpdate(BaseModel):
    category: Optional[str] = None
    material: Optional[str] = None
    avg_weight_kg: Optional[float] = None
    emission_factor_kgco2e: Optional[float] = None
    recyclable_locally: Optional[bool] = None
    tip_reduce: Optional[str] = None
    tip_reuse: Optional[str] = None
    tip_recycle: Optional[str] = None

class WasteClassConfigCreate(BaseModel):
    class_name: str
    category: str = "REVIEW"
    material: Optional[str] = None
    avg_weight_kg: float = 0.05
    emission_factor_kgco2e: float = 1.0
    recyclable_locally: bool = False
    tip_reduce: Optional[str] = None
    tip_reuse: Optional[str] = None
    tip_recycle: Optional[str] = None


# ──────────────────────────────────────────────
# Collection
# ──────────────────────────────────────────────
class CollectionCreate(BaseModel):
    location_id: Optional[str] = None
    measured_weight_kg: float
    waste_category: str
    contractor: Optional[str] = None
    receipt_ref: Optional[str] = None
    notes: Optional[str] = None
    collected_at: Optional[datetime] = None

class CollectionOut(BaseModel):
    id: str
    site_id: str
    location_id: Optional[str] = None
    measured_weight_kg: float
    waste_category: Optional[str] = None
    contractor: Optional[str] = None
    receipt_ref: Optional[str] = None
    notes: Optional[str] = None
    collected_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Reduction Target
# ──────────────────────────────────────────────
class ReductionTargetCreate(BaseModel):
    metric: str
    target_value: float
    baseline_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ReductionTargetOut(BaseModel):
    id: str
    site_id: str
    metric: str
    target_value: float
    baseline_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Action (3R)
# ──────────────────────────────────────────────
class ActionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    hierarchy_level: str = "RECYCLE"
    evidence_summary: Optional[str] = None
    estimated_saving_kg: float = 0.0
    estimated_saving_co2e: float = 0.0
    effort_level: str = "medium"
    owner_id: Optional[str] = None

class ActionUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    after_metric: Optional[float] = None

class ActionOut(BaseModel):
    id: str
    site_id: str
    title: str
    description: Optional[str] = None
    hierarchy_level: str
    status: str
    evidence_summary: Optional[str] = None
    estimated_saving_kg: float = 0.0
    estimated_saving_co2e: float = 0.0
    effort_level: str
    owner_id: Optional[str] = None
    before_metric: Optional[float] = None
    after_metric: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# GreenRE
# ──────────────────────────────────────────────
class GreenRECreate(BaseModel):
    requirement_code: str
    requirement_description: Optional[str] = None

class GreenREUpdate(BaseModel):
    status: Optional[str] = None
    evidence_notes: Optional[str] = None

class GreenREOut(BaseModel):
    id: str
    site_id: str
    requirement_code: Optional[str] = None
    requirement_description: Optional[str] = None
    status: str
    evidence_notes: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Analytics
# ──────────────────────────────────────────────
class AnalyticsSummary(BaseModel):
    total_waste_kg: float
    estimated_waste_kg: float
    measured_waste_kg: float
    total_items: int
    recycling_rate: float
    diversion_rate: float
    contamination_rate: float
    co2e_avoided_kg: float
    category_breakdown: dict
    material_breakdown: dict
    daily_trend: list[dict]
    top_items: list[dict]
    target_progress: list[dict]


# ──────────────────────────────────────────────
# Audit Log
# ──────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}

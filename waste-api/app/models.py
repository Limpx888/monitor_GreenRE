"""
SQLAlchemy ORM models for the Waste Management Platform.
All tables are tenant-scoped via org_id / site_id foreign keys.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime, ForeignKey,
    Text, JSON, Integer, Index, Date,
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# Organization (tenant root)
# ──────────────────────────────────────────────
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    sites = relationship("Site", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# Site (hotel / restaurant / office)
# ──────────────────────────────────────────────
class Site(Base):
    __tablename__ = "sites"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(200), nullable=False)
    site_type = Column(String(50), default="office")  # hotel/restaurant/office
    address = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Organization", back_populates="sites")
    locations = relationship("Location", back_populates="site", cascade="all, delete-orphan")
    scans = relationship("Scan", back_populates="site", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="site", cascade="all, delete-orphan")
    reduction_targets = relationship("ReductionTarget", back_populates="site", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="site", cascade="all, delete-orphan")
    greenre_requirements = relationship("GreenRERequirement", back_populates="site", cascade="all, delete-orphan")
    waste_class_configs = relationship("WasteClassConfig", back_populates="site", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sites_org_id", "org_id"),
    )


# ──────────────────────────────────────────────
# Location / Bin
# ──────────────────────────────────────────────
class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    name = Column(String(200), nullable=False)
    bin_type = Column(String(50), default="general")  # recycle/general/organic/hazardous
    floor = Column(String(50))
    zone = Column(String(100))
    created_at = Column(DateTime, default=utcnow)

    site = relationship("Site", back_populates="locations")
    scans = relationship("Scan", back_populates="location")
    collections = relationship("Collection", back_populates="location")

    __table_args__ = (
        Index("ix_locations_site_id", "site_id"),
    )


# ──────────────────────────────────────────────
# User
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200))
    role = Column(String(50), default="staff")  # admin/manager/staff/auditor
    default_site_id = Column(String, ForeignKey("sites.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Organization", back_populates="users")
    scans = relationship("Scan", back_populates="user")

    __table_args__ = (
        Index("ix_users_org_id", "org_id"),
        Index("ix_users_email", "email"),
    )


# ──────────────────────────────────────────────
# Scan (one image upload or camera capture event)
# ──────────────────────────────────────────────
class Scan(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    image_path = Column(Text)
    annotated_image_path = Column(Text)
    raw_model_output = Column(JSON)
    corrected_output = Column(JSON)
    status = Column(String(30), default="pending_review")  # pending_review/confirmed/exported
    note = Column(Text)
    scan_mode = Column(String(20), default="upload")  # upload/snapshot/live
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="scans")
    site = relationship("Site", back_populates="scans")
    location = relationship("Location", back_populates="scans")
    detections = relationship("Detection", back_populates="scan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_scans_site_id_created", "site_id", "created_at"),
        Index("ix_scans_user_id", "user_id"),
        Index("ix_scans_status", "status"),
    )


# ──────────────────────────────────────────────
# Detection (one detected item within a scan)
# ──────────────────────────────────────────────
class Detection(Base):
    __tablename__ = "detections"

    id = Column(String, primary_key=True, default=generate_uuid)
    scan_id = Column(String, ForeignKey("scans.id"), nullable=False)
    class_name = Column(String(100), nullable=False)
    corrected_class_name = Column(String(100), nullable=True)
    confidence = Column(Float, default=0.0)
    bbox = Column(JSON)  # {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    category = Column(String(30))  # RECYCLE/GENERAL/ORGANIC/HAZARDOUS
    material = Column(String(50))
    estimated_weight_kg = Column(Float, default=0.0)
    measured_weight_kg = Column(Float, nullable=True)
    weight_source = Column(String(20), default="ESTIMATED")  # ESTIMATED/MEASURED
    needs_review = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    tip = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    scan = relationship("Scan", back_populates="detections")

    __table_args__ = (
        Index("ix_detections_scan_id", "scan_id"),
        Index("ix_detections_category", "category"),
        Index("ix_detections_class_name", "class_name"),
    )


# ──────────────────────────────────────────────
# Waste Class Configuration (category mapping)
# ──────────────────────────────────────────────
class WasteClassConfig(Base):
    __tablename__ = "waste_class_config"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True)  # NULL = global default
    class_name = Column(String(100), nullable=False)
    category = Column(String(30), default="REVIEW")
    material = Column(String(50))
    avg_weight_kg = Column(Float, default=0.05)
    emission_factor_kgco2e = Column(Float, default=1.0)
    recyclable_locally = Column(Boolean, default=False)
    tip_reduce = Column(Text)
    tip_reuse = Column(Text)
    tip_recycle = Column(Text)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    site = relationship("Site", back_populates="waste_class_configs")

    __table_args__ = (
        Index("ix_wcc_class_site", "class_name", "site_id"),
    )


# ──────────────────────────────────────────────
# Collection (pickup event with measured weight)
# ──────────────────────────────────────────────
class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    measured_weight_kg = Column(Float, nullable=False)
    waste_category = Column(String(30))
    contractor = Column(String(200))
    receipt_ref = Column(String(200))
    notes = Column(Text)
    collected_at = Column(DateTime, default=utcnow)
    created_at = Column(DateTime, default=utcnow)

    site = relationship("Site", back_populates="collections")
    location = relationship("Location", back_populates="collections")
    receipts = relationship("RecyclingReceipt", back_populates="collection", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_collections_site_date", "site_id", "collected_at"),
    )


# ──────────────────────────────────────────────
# Recycling Receipt (evidence document)
# ──────────────────────────────────────────────
class RecyclingReceipt(Base):
    __tablename__ = "recycling_receipts"

    id = Column(String, primary_key=True, default=generate_uuid)
    collection_id = Column(String, ForeignKey("collections.id"), nullable=False)
    file_path = Column(Text, nullable=False)
    description = Column(Text)
    uploaded_at = Column(DateTime, default=utcnow)

    collection = relationship("Collection", back_populates="receipts")


# ──────────────────────────────────────────────
# Reduction Targets
# ──────────────────────────────────────────────
class ReductionTarget(Base):
    __tablename__ = "reduction_targets"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    metric = Column(String(50), nullable=False)  # recycling_rate/total_waste/diversion_rate
    target_value = Column(Float, nullable=False)
    baseline_value = Column(Float)
    start_date = Column(Date)
    end_date = Column(Date)
    created_at = Column(DateTime, default=utcnow)

    site = relationship("Site", back_populates="reduction_targets")


# ──────────────────────────────────────────────
# Actions (3R tasks)
# ──────────────────────────────────────────────
class Action(Base):
    __tablename__ = "actions"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    hierarchy_level = Column(String(20))  # REDUCE/REUSE/RECYCLE
    status = Column(String(30), default="suggested")  # suggested/in_progress/done
    evidence_summary = Column(Text)
    estimated_saving_kg = Column(Float, default=0.0)
    estimated_saving_co2e = Column(Float, default=0.0)
    effort_level = Column(String(20), default="medium")  # low/medium/high
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    before_metric = Column(Float)
    after_metric = Column(Float)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    site = relationship("Site", back_populates="actions")

    __table_args__ = (
        Index("ix_actions_site_status", "site_id", "status"),
    )


# ──────────────────────────────────────────────
# GreenRE Requirements
# ──────────────────────────────────────────────
class GreenRERequirement(Base):
    __tablename__ = "greenre_requirements"

    id = Column(String, primary_key=True, default=generate_uuid)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    requirement_code = Column(String(50))
    requirement_description = Column(Text)
    status = Column(String(30), default="not_started")
    evidence_notes = Column(Text)
    updated_at = Column(DateTime, default=utcnow)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)

    site = relationship("Site", back_populates="greenre_requirements")

    __table_args__ = (
        Index("ix_greenre_site", "site_id"),
    )


# ──────────────────────────────────────────────
# Audit Log (immutable)
# ──────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(String)
    old_value = Column(JSON)
    new_value = Column(JSON)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Organization", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_org_date", "org_id", "created_at"),
    )

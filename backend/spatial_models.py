"""Standardized Asset Spatial Hierarchy Data Model.

Establishes the industrial-grade topology:
Building -> Site -> Floor -> Zone -> Asset -> Point -> Telemetry

Control commands strictly target specific points of specific assets
(e.g. OUTDOOR_AIR_DAMPER of AHU-14A) rather than a vague floor or zone.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    city = Column(String(64), nullable=False, default="Penang")
    country = Column(String(64), nullable=False, default="Malaysia")
    created_at = Column(DateTime(timezone=True), default=func.now())

    buildings = relationship("Building", back_populates="site", cascade="all, delete-orphan")


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    total_gfa_m2 = Column(Float, nullable=False, default=48500.0)
    floors_count = Column(Integer, nullable=False, default=28)
    created_at = Column(DateTime(timezone=True), default=func.now())

    site = relationship("Site", back_populates="buildings")
    spatial_floors = relationship("SpatialFloor", back_populates="building", cascade="all, delete-orphan")


class SpatialFloor(Base):
    __tablename__ = "spatial_floors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(16), unique=True, nullable=False, index=True)  # e.g., "L14", "L8", "B2", "GF"
    name = Column(String(128), nullable=False)
    level_number = Column(Integer, nullable=False, default=1)

    building = relationship("Building", back_populates="spatial_floors")
    spatial_zones = relationship("SpatialZone", back_populates="spatial_floor", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="spatial_floor")


class SpatialZone(Base):
    __tablename__ = "spatial_zones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor_id = Column(Integer, ForeignKey("spatial_floors.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(32), nullable=False, index=True)  # e.g. "zone-d"
    name = Column(String(128), nullable=False)
    zone_type = Column(String(64), nullable=False, default="COMMERCIAL")  # HOSPITALITY, COMMERCIAL, ME_PLANT, PODIUM

    spatial_floor = relationship("SpatialFloor", back_populates="spatial_zones")
    assets = relationship("Asset", back_populates="spatial_zone")


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_tag_type", "asset_tag", "asset_type"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor_id = Column(Integer, ForeignKey("spatial_floors.id", ondelete="RESTRICT"), nullable=False)
    zone_id = Column(Integer, ForeignKey("spatial_zones.id", ondelete="SET NULL"), nullable=True)
    
    asset_tag = Column(String(64), unique=True, nullable=False, index=True)  # e.g., "AHU-14A", "CHILLER-01"
    name = Column(String(128), nullable=False)
    asset_type = Column(String(64), nullable=False)  # "AHU", "VAV", "CHILLER", "POWER_METER", "WATER_METER", "SMART_BIN"
    protocol = Column(String(32), nullable=False, default="bacnet_ip")  # "bacnet_ip", "modbus_tcp", "rest"
    bacnet_instance = Column(Integer, nullable=True)
    status = Column(String(32), nullable=False, default="NORMAL")  # "NORMAL", "WARNING", "ANOMALY", "MAINTENANCE"
    is_maintenance_mode = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())

    spatial_floor = relationship("SpatialFloor", back_populates="assets")
    spatial_zone = relationship("SpatialZone", back_populates="assets")
    points = relationship("Point", back_populates="asset", cascade="all, delete-orphan")


class Point(Base):
    __tablename__ = "points"
    __table_args__ = (
        Index("ix_points_asset_code", "asset_id", "point_code"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    
    point_code = Column(String(64), nullable=False, index=True)  # e.g. "OUTDOOR_AIR_DAMPER", "SUPPLY_FAN_SPEED"
    point_name = Column(String(128), nullable=False)
    point_type = Column(String(32), nullable=False, default="ANALOG_INPUT")  # ANALOG_OUTPUT, ANALOG_INPUT, BINARY_OUTPUT
    engineering_unit = Column(String(16), nullable=False, default="")  # "%", "°C", "kW", "ppm", "Hz", "m³/h"
    
    current_value = Column(Float, nullable=False, default=0.0)
    target_value = Column(Float, nullable=True)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    
    is_controllable = Column(Boolean, nullable=False, default=False)
    data_quality = Column(String(16), nullable=False, default="VALID")  # VALID, FLATLINE, JUMP, DRIFT, DEGRADED, INVALID
    
    last_updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    asset = relationship("Asset", back_populates="points")


class DeadLetterQueue(Base):
    """Dead-Letter Queue (DLQ) for persisting unparseable, corrupt, or rejected telemetry."""
    __tablename__ = "telemetry_dead_letter_queue"
    __table_args__ = (
        Index("ix_dlq_failed_at", "failed_at"),
        Index("ix_dlq_reason", "rejection_reason"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(64), nullable=True)
    trace_id = Column(String(64), nullable=True)
    failed_at = Column(DateTime(timezone=True), default=func.now())
    rejection_reason = Column(String(256), nullable=False)
    error_code = Column(String(64), nullable=False, default="VALIDATION_FAILED")
    raw_payload = Column(Text, nullable=False)


"""Physical mapping: Zone 1-N → Floor (L4–L12, L14–L28, …) → MeterReading."""

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False)  # zone-a … zone-e
    name = Column(String(128), nullable=False)
    floors_label = Column(String(64), nullable=False)
    area_m2 = Column(Float, nullable=False)
    eei_baseline_kwh_m2_yr = Column(Float, nullable=False)

    floors = relationship("Floor", back_populates="zone")


class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(16), unique=True, nullable=False)  # L14, GF, B2
    name = Column(String(128), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)

    zone = relationship("Zone", back_populates="floors")
    readings = relationship("MeterReading", back_populates="floor")


class MeterReading(Base):
    __tablename__ = "meter_readings"
    __table_args__ = (
        UniqueConstraint(
            "timestamp", "floor_id", "meter_type", name="uq_reading_ts_floor_meter"
        ),
        Index("ix_meter_readings_timestamp", "timestamp"),
        Index("ix_meter_readings_floor_id", "floor_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    floor_id = Column(Integer, ForeignKey("floors.id", ondelete="CASCADE"), nullable=False)
    meter_type = Column(String(32), nullable=False, default="electricity")
    reading_kwh = Column(Float, nullable=False)

    floor = relationship("Floor", back_populates="readings")

"""Canonical Telemetry Schema & Ingestion Validation.

Standardizes all telemetry streams across modules (Meters, Water, Waste, NILM, Azure Event Hubs)
into a single, globally traceable schema.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID, uuid4
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator


class DataQualityTag(str, Enum):
    VALID = "VALID"
    DEGRADED = "DEGRADED"
    INVALID = "INVALID"
    FLATLINE = "FLATLINE"
    JUMP = "JUMP"
    DRIFT = "DRIFT"
    STALE = "STALE"


class CanonicalTelemetryRecord(BaseModel):
    """Universal canonical telemetry envelope with global traceability and DQ metadata."""
    
    event_id: str = Field(default_factory=lambda: str(uuid4()), description="Globally unique UUID4 for this event")
    trace_id: str = Field(default_factory=lambda: f"tr-{uuid4().hex[:12]}", description="Distributed correlation trace ID")
    timestamp: datetime = Field(..., description="Measurement timestamp in UTC")
    
    # Standardized Asset Spatial Topology Associations
    site_code: str = Field(default="SITE-PENANG-01", description="Site identifier")
    building_code: str = Field(default="BLD-TOWER-A", description="Building identifier")
    floor_code: str = Field(..., description="Floor code, e.g. L14, L8, B2, GF")
    zone_code: Optional[str] = Field(None, description="Spatial zone identifier, e.g. zone-d")
    asset_tag: str = Field(..., description="Asset identifier, e.g. AHU-14A, CHILLER-01")
    point_code: str = Field(..., description="Specific physical/logical point code, e.g. OUTDOOR_AIR_DAMPER")
    
    # Measured Value & Engineering Unit
    value: float = Field(..., description="Engineering reading value")
    unit: str = Field(..., description="Engineering unit, e.g. %, °C, kW, ppm, Hz, m³/h")
    
    # Data Quality (DQ) Dimensions
    quality_status: DataQualityTag = Field(default=DataQualityTag.VALID, description="Evaluated DQ tag")
    quality_flags: List[str] = Field(default_factory=list, description="Specific DQ defect codes if degraded")
    
    # Extensible metadata (BMS controller ID, firmware, raw packet info)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("event_id")
    def validate_event_id(cls, v: str) -> str:
        if not v or len(v.strip()) == 0:
            raise ValueError("event_id must not be empty")
        return v.strip()

    @field_validator("timestamp")
    def ensure_timezone_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            # Assume UTC if naive
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class CanonicalBatchIngestRequest(BaseModel):
    """Batch ingestion request with strict payload limits."""
    records: List[CanonicalTelemetryRecord] = Field(..., max_length=500, description="Max 500 items per batch")
    is_historical_backfill: bool = Field(default=False, description="Flag allowing historical backfill timestamps")


class PartialIngestFailure(BaseModel):
    """Detailed failure item reporting index, error code, and reason."""
    index: int
    event_id: Optional[str] = None
    asset_tag: Optional[str] = None
    point_code: Optional[str] = None
    code: str
    error: str


class CanonicalIngestResponse(BaseModel):
    """Production-grade ingestion response with granular partial-failure breakdown."""
    status: Literal["SUCCESS", "PARTIAL_SUCCESS", "FAILED"]
    total_received: int
    success_count: int
    failure_count: int
    failures: List[PartialIngestFailure] = Field(default_factory=list)
    dlq_persisted_count: int = 0
    trace_id: str
    processing_time_ms: float


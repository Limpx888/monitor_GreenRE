from datetime import datetime
from typing import List, Optional, Union

from pydantic import BaseModel, Field


class TelemetryReading(BaseModel):
    timestamp: Union[datetime, str]
    floor_id: str = Field(..., description="Physical floor code, e.g. L14")
    meter_type: str = Field(default="electricity")
    reading_kwh: float = Field(..., ge=0)


TelemetryReadingSchema = TelemetryReading


class TelemetryBatch(BaseModel):
    readings: List[TelemetryReading]


class ZoneConsumption(BaseModel):
    zone_id: int
    code: str
    name: str
    floors_label: str
    area_m2: float
    energy_kwh: float
    eei_kwh_m2_yr: float
    eei_baseline_kwh_m2_yr: float
    excess_kwh: float
    compliance_status: str
    recommendation: Optional[str] = None


class ZonesConsumptionResponse(BaseModel):
    status: str
    window_hours: float
    total_energy_kwh: float
    total_area_m2: float
    building_eei_kwh_m2_yr: float
    building_compliance_status: str
    zones: List[ZoneConsumption]
    latest_timestamp: Optional[datetime] = None

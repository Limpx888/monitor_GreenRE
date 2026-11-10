"""Data Quality (DQ) Monitoring & Production Ingestion Service.

Implements rigorous checks:
1. Anti-replay timestamp validation (future/stale rejection).
2. Event deduplication via event_id and (asset_tag, point_code, timestamp).
3. Statistical sensor anomaly detection:
   - Flatline detection (sensor frozen on identical value)
   - Abnormal gradient jumps (unrealistic rate of change)
   - Clock drift detection (|device_ts - server_ts| > drift_threshold)
   - Out-of-bounds physical range enforcement
4. Dead-Letter Queue (DLQ) persistence for rejected frames.
"""

import os
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from pydantic import ValidationError

from canonical_schema import (
    CanonicalTelemetryRecord,
    CanonicalBatchIngestRequest,
    CanonicalIngestResponse,
    PartialIngestFailure,
    DataQualityTag,
)
from spatial_models import DeadLetterQueue
from storage_interface import get_telemetry_store
from database import SessionLocal

# Physical operational bounds and gradient limits per point code
PHYSICAL_POINT_SPECS = {
    "OUTDOOR_AIR_DAMPER": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 60.0},
    "DAMPER_POS": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 60.0},
    "SUPPLY_FAN_SPEED": {"min": 0.0, "max": 100.0, "unit": "Hz", "max_jump": 30.0},
    "CHW_VALVE_POS": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 50.0},
    "SUPPLY_AIR_TEMP": {"min": 8.0, "max": 35.0, "unit": "°C", "max_jump": 8.0},
    "ROOM_TEMP": {"min": 15.0, "max": 38.0, "unit": "°C", "max_jump": 5.0},
    "ZONE_CO2": {"min": 300.0, "max": 5000.0, "unit": "ppm", "max_jump": 800.0},
    "RETURN_AIR_CO2": {"min": 300.0, "max": 5000.0, "unit": "ppm", "max_jump": 800.0},
    "CHW_SUPPLY_TEMP": {"min": 3.0, "max": 20.0, "unit": "°C", "max_jump": 4.0},
    "CHILLER_POWER": {"min": 0.0, "max": 2000.0, "unit": "kW", "max_jump": 500.0},
    "TOTAL_DEMAND": {"min": 0.0, "max": 5000.0, "unit": "kW", "max_jump": 1000.0},
    "FLOW_RATE": {"min": 0.0, "max": 500.0, "unit": "m³/h", "max_jump": 50.0},
    "BIN_FILL_LEVEL": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 70.0},
}


class DataQualityMonitor:
    def __init__(self):
        self._seen_events: Set[str] = set()
        self._point_history: Dict[str, List[Tuple[datetime, float]]] = {}
        self._max_cache_size = 50000

    def evaluate_dq(
        self,
        record: CanonicalTelemetryRecord,
        is_historical: bool = False
    ) -> Tuple[DataQualityTag, List[str], Optional[str]]:
        """Evaluates data quality, returns (tag, flags, fatal_rejection_error)."""
        now = datetime.now(timezone.utc)
        flags: List[str] = []

        # 1. Anti-Replay Timestamp Validation (Reject future timestamps)
        ts = record.timestamp
        if ts > now + timedelta(seconds=30):
            return DataQualityTag.INVALID, ["TIMESTAMP_IN_FUTURE"], f"Anti-replay check failed: timestamp ({ts.isoformat()}) is in the future (>30s)"

        if not is_historical and ts < now - timedelta(days=7):
            return DataQualityTag.INVALID, ["TIMESTAMP_TOO_OLD"], "Anti-replay check failed: timestamp exceeds 7-day ingestion horizon"

        # 2. Clock Drift Detection (|ts - server_now| > 3m)
        drift_seconds = abs((now - ts).total_seconds())
        if drift_seconds > 180 and not is_historical:
            flags.append(f"CLOCK_DRIFT_{int(drift_seconds)}S")

        # 3. Deduplication Check
        dedup_tuple = f"{record.asset_tag}::{record.point_code}::{record.timestamp.isoformat()}"
        if record.event_id in self._seen_events or dedup_tuple in self._seen_events:
            return DataQualityTag.INVALID, ["DUPLICATE_EVENT"], f"Duplicate telemetry event detected for {record.event_id}"

        # 4. Physical Operational Bounds Enforcement
        spec = PHYSICAL_POINT_SPECS.get(record.point_code)
        if spec:
            if record.value < spec["min"] or record.value > spec["max"]:
                flags.append(f"OUT_OF_BOUNDS_{record.value}_{spec['unit']}")

        # 5. Flatline & Jump Detection against Point History
        hist_key = f"{record.asset_tag}::{record.point_code}"
        history = self._point_history.setdefault(hist_key, [])

        if spec and history:
            last_ts, last_val = history[-1]
            delta_val = abs(record.value - last_val)
            max_jump = spec.get("max_jump", 100.0)

            # Abnormal rate of change
            if delta_val > max_jump:
                flags.append(f"ABNORMAL_JUMP_DELTA_{delta_val:.1f}")

            # Flatline detection (consecutive identical values >= 5)
            if len(history) >= 4 and all(v == record.value for _, v in history[-4:]):
                flags.append("SENSOR_FLATLINE")

        # Update cache
        self._seen_events.add(record.event_id)
        self._seen_events.add(dedup_tuple)
        if len(self._seen_events) > self._max_cache_size:
            # Drop older entries
            self._seen_events.clear()

        history.append((ts, record.value))
        if len(history) > 20:
            history.pop(0)

        # Determine Final Quality Status Tag
        if any("OUT_OF_BOUNDS" in f for f in flags):
            return DataQualityTag.DEGRADED, flags, None
        if "SENSOR_FLATLINE" in flags:
            return DataQualityTag.FLATLINE, flags, None
        if any("ABNORMAL_JUMP" in f for f in flags):
            return DataQualityTag.JUMP, flags, None
        if any("CLOCK_DRIFT" in f for f in flags):
            return DataQualityTag.DRIFT, flags, None

        return DataQualityTag.VALID, flags, None


# Global singleton instance
dq_monitor = DataQualityMonitor()


async def ingest_canonical_batch(batch_input: Any) -> CanonicalIngestResponse:
    """Production-grade defensive ingestion pipeline with partial failures and DLQ persistence.
    
    Accepts CanonicalBatchIngestRequest, a list of records/dicts, or a single record/dict.
    Guarantees partial success JSON rather than crashing with an unhandled exception when
    payloads are malformed or timestamps are in the future.
    """
    start_time = time.time()
    db: Session = SessionLocal()
    trace_id = f"tr-ingest-{int(time.time())}"
    
    valid_records: List[CanonicalTelemetryRecord] = []
    failures: List[PartialIngestFailure] = []
    dlq_records_to_insert: List[DeadLetterQueue] = []

    # Unpack raw records from different input structures
    raw_records: List[Any] = []
    is_historical = False
    if isinstance(batch_input, CanonicalBatchIngestRequest):
        raw_records = batch_input.records
        is_historical = batch_input.is_historical_backfill
    elif isinstance(batch_input, dict):
        if "records" in batch_input and isinstance(batch_input["records"], list):
            raw_records = batch_input["records"]
            is_historical = bool(batch_input.get("is_historical_backfill", False))
        else:
            raw_records = [batch_input]
    elif isinstance(batch_input, list):
        raw_records = batch_input
    else:
        raw_records = [batch_input]

    try:
        for idx, item in enumerate(raw_records):
            rec: Optional[CanonicalTelemetryRecord] = None
            raw_json_str = ""

            # Step 1: Pydantic Validation Gate for malformed payload defense
            if isinstance(item, CanonicalTelemetryRecord):
                rec = item
                raw_json_str = json.dumps(rec.model_dump(mode="json"))
            elif isinstance(item, dict):
                try:
                    raw_json_str = json.dumps(item)
                    # Support legacy floor_id / reading_kwh mapping if needed
                    adapted_item = dict(item)
                    if "floor_id" in adapted_item and "floor_code" not in adapted_item:
                        adapted_item["floor_code"] = adapted_item["floor_id"]
                    if "reading_kwh" in adapted_item and "value" not in adapted_item:
                        adapted_item["value"] = float(adapted_item["reading_kwh"])
                    if "asset_id" not in adapted_item and "asset_tag" not in adapted_item:
                        # Missing required asset_id -> will fail validation
                        pass
                    rec = CanonicalTelemetryRecord.model_validate(adapted_item)
                except ValidationError as ve:
                    err_msg = f"Malformed payload schema: {ve.errors()[0]['msg']} at {'.'.join(str(l) for l in ve.errors()[0]['loc'])}"
                    failures.append(
                        PartialIngestFailure(
                            index=idx,
                            event_id=item.get("event_id"),
                            trace_id=item.get("trace_id"),
                            asset_id=item.get("asset_id") or item.get("asset_tag"),
                            asset_tag=item.get("asset_tag") or item.get("asset_id"),
                            point_code=item.get("point_code"),
                            code="MALFORMED_PAYLOAD",
                            error=err_msg,
                        )
                    )
                    dlq_records_to_insert.append(
                        DeadLetterQueue(
                            event_id=str(item.get("event_id") or f"invalid-evt-{idx}"),
                            trace_id=str(item.get("trace_id") or trace_id),
                            rejection_reason=err_msg,
                            error_code="MALFORMED_PAYLOAD",
                            raw_payload=raw_json_str or str(item),
                        )
                    )
                    continue
                except Exception as ex:
                    failures.append(
                        PartialIngestFailure(
                            index=idx,
                            code="PAYLOAD_PARSE_ERROR",
                            error=f"Unparseable payload: {str(ex)}",
                        )
                    )
                    continue
            else:
                failures.append(
                    PartialIngestFailure(
                        index=idx,
                        code="INVALID_RECORD_TYPE",
                        error=f"Expected object or dict, got {type(item).__name__}",
                    )
                )
                continue

            # Step 2: Telemetry Data Quality & Anti-Replay Validation Gate
            status_tag, flags, fatal_error = dq_monitor.evaluate_dq(
                rec, is_historical=is_historical
            )

            if fatal_error:
                # Fatal rejection (future timestamp, duplicate, out-of-horizon) -> route to DLQ
                code = "TIMESTAMP_IN_FUTURE" if "TIMESTAMP_IN_FUTURE" in flags else ("DUPLICATE_EVENT" if "DUPLICATE_EVENT" in flags else "VALIDATION_FATAL")
                failures.append(
                    PartialIngestFailure(
                        index=idx,
                        event_id=rec.event_id,
                        trace_id=rec.trace_id,
                        asset_id=rec.asset_id,
                        asset_tag=rec.asset_tag,
                        point_code=rec.point_code,
                        code=code,
                        error=fatal_error,
                    )
                )
                dlq_records_to_insert.append(
                    DeadLetterQueue(
                        event_id=rec.event_id,
                        trace_id=rec.trace_id,
                        rejection_reason=fatal_error,
                        error_code=code,
                        raw_payload=json.dumps(rec.model_dump(mode="json")),
                    )
                )
            else:
                # Enriched record with evaluated DQ status and flags
                rec.quality_status = status_tag
                rec.quality_flags = flags
                valid_records.append(rec)

        # Persist DLQ entries
        if dlq_records_to_insert:
            try:
                db.bulk_save_objects(dlq_records_to_insert)
                db.commit()
            except Exception as dlq_err:
                db.rollback()
                print(f"[DLQ Persistence Warning]: {dlq_err}")

        # Persist valid records to Storage Interface
        store = get_telemetry_store()
        if valid_records:
            try:
                await store.store_batch(valid_records)
            except Exception as store_err:
                print(f"[Store Batch Warning]: {store_err}")

            try:
                from ems_service import ingest_readings
                from schemas import TelemetryReading
                legacy_items = [
                    TelemetryReading(
                        timestamp=r.timestamp,
                        floor_id=r.floor_code or "L14",
                        meter_type="electricity",
                        reading_kwh=float(r.value),
                    )
                    for r in valid_records
                ]
                ingest_readings(db, legacy_items)
            except Exception as leg_err:
                pass

        duration_ms = round((time.time() - start_time) * 1000, 2)
        total_rec = len(raw_records)
        succ_rec = len(valid_records)
        fail_rec = len(failures)

        status_str = "SUCCESS" if fail_rec == 0 else ("PARTIAL_SUCCESS" if succ_rec > 0 else "FAILED")

        return CanonicalIngestResponse(
            status=status_str,
            total_received=total_rec,
            success_count=succ_rec,
            failure_count=fail_rec,
            failures=failures,
            dlq_persisted_count=len(dlq_records_to_insert),
            trace_id=trace_id,
            processing_time_ms=duration_ms,
        )

    finally:
        db.close()


"""Azure Event Hubs Real-Time Background Telemetry Consumer Daemon.

Resolves consumer integration limitations by:
1. Connecting to Azure Event Hubs using EventHubConsumerClient on consumer group $Default.
2. Listening to telemetry events in real time.
3. Durably persisting consumed events to disk (consumer_durable_eventstore.jsonl).
4. Bridging ingested frames into Microsoft Fabric Eventhouse (KQL) stream buffer.
5. Triggering AI Search retrieval and Azure OpenAI cognitive diagnosis upon anomaly detection.
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("azure_consumer")

CONN_STR = os.getenv("AZURE_EVENTHUB_CONNECTION_STRING", "")
EH_NAME = os.getenv("AZURE_EVENTHUB_NAME", "greenre-telemetry")
CONSUMER_GROUP = os.getenv("AZURE_EVENTHUB_CONSUMER_GROUP", "$Default")
DURABLE_STORE_PATH = os.path.join(BASE_DIR, "data", "consumer_durable_eventstore.jsonl")


class TelemetryConsumerDaemon:
    """Daemon process consuming telemetry frames from Event Hubs with durable persistence & Fabric bridge."""

    def __init__(self, conn_str: Optional[str] = None, eh_name: Optional[str] = None):
        self.conn_str = conn_str or CONN_STR
        self.eh_name = eh_name or EH_NAME
        self.consumer_group = CONSUMER_GROUP
        self.buffer: List[Dict[str, Any]] = []
        self.durable_store_path = DURABLE_STORE_PATH
        self.processed_count = 0
        self.anomalies_detected = 0
        self.fabric_bridged_count = 0

        # Ensure storage directory exists
        os.makedirs(os.path.dirname(self.durable_store_path), exist_ok=True)

    def is_configured(self) -> bool:
        return bool(self.conn_str and self.eh_name)

    def persist_durable_record(self, record: Dict[str, Any]):
        """Appends consumed record to durable JSONL log file to survive process crashes and restarts."""
        try:
            with open(self.durable_store_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            logger.error(f"[Consumer] Failed writing to durable store: {e}")

    def bridge_to_fabric(self, payload: Dict[str, Any]):
        """Bridges consumed telemetry frame into Microsoft Fabric Eventhouse streaming store."""
        try:
            from azure_services import azure_slice
            azure_slice.fabric_kql.register_stream_frame(payload)
            self.fabric_bridged_count += 1
        except Exception as e:
            logger.warning(f"[Consumer] Fabric bridge notice: {e}")

    def evaluate_anomaly_and_diagnose(self, payload: Dict[str, Any], trace_id: str) -> Optional[Dict[str, Any]]:
        """Invokes AI Search and Azure OpenAI when an operational anomaly is detected."""
        is_anomaly = payload.get("anomaly_flag", False)
        readings = payload.get("readings", {})
        
        # Heuristic check for high night leak flow or damper stuck
        if readings.get("water_flow_lpm", 0) > 40.0 or readings.get("ahu_damper_position_pct", 0) >= 90.0:
            is_anomaly = True

        if not is_anomaly:
            return None

        self.anomalies_detected += 1
        logger.info(f"[Consumer] Anomaly flagged in consumed frame trace_id={trace_id}. Triggering Cognitive Audit...")
        try:
            from azure_services import azure_slice
            citations = azure_slice.ai_search.search_regulations("Overnight water leak baseline WE 1-1", top_k=2, correlation_id=trace_id)
            diagnosis = azure_slice.openai.diagnose_and_recommend(payload, citations, correlation_id=trace_id)
            return diagnosis
        except Exception as e:
            logger.error(f"[Consumer] Cognitive diagnosis pipeline error: {e}")
            return None

    def process_event(self, event, partition_id: str) -> Dict[str, Any]:
        """Processes a single event: parses, persists durably, bridges to Fabric, and evaluates anomalies."""
        body_str = event.body_as_str(encoding="UTF-8")
        payload = json.loads(body_str) if body_str.startswith("{") else {"raw": body_str}
        trace_id = event.properties.get(b"trace_id", b"").decode("utf-8") if event.properties and b"trace_id" in event.properties else payload.get("trace_id", f"gre-cons-{int(time.time()*1000)}")

        record = {
            "partition_id": partition_id,
            "offset": event.offset,
            "sequence_number": event.sequence_number,
            "enqueued_time": str(event.enqueued_time),
            "trace_id": trace_id,
            "telemetry": payload,
            "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # 1. In-memory buffer
        self.buffer.append(record)
        if len(self.buffer) > 200:
            self.buffer.pop(0)

        # 2. Durable on-disk persistence
        self.persist_durable_record(record)

        # 3. Bridge to Microsoft Fabric Eventhouse
        self.bridge_to_fabric(payload)

        # 4. Cognitive diagnosis trigger on anomaly
        diagnosis = self.evaluate_anomaly_and_diagnose(payload, trace_id)
        if diagnosis:
            record["cognitive_diagnosis"] = diagnosis

        self.processed_count += 1
        return record

    def on_event_batch(self, partition_context, events):
        """Callback invoked when a batch of events is received from Event Hubs."""
        for event in events:
            try:
                rec = self.process_event(event, partition_context.partition_id)
                logger.info(f"[Consumer] Processed partition={partition_context.partition_id} trace_id={rec['trace_id']} seq={rec['sequence_number']}")
            except Exception as e:
                logger.error(f"[Consumer] Parse error: {e}")

        # Update checkpoint to persist read position
        partition_context.update_checkpoint()

    def run_consumer(self, max_wait_time: float = 5.0):
        """Starts continuous consumer loop."""
        if not self.is_configured():
            logger.warning("[Consumer] Azure Event Hub credentials not set. Daemon running in standby.")
            return

        from azure.eventhub import EventHubConsumerClient

        logger.info(f"[Consumer] Starting EventHubConsumerClient on {self.eh_name} (group: {self.consumer_group})...")
        client = EventHubConsumerClient.from_connection_string(
            conn_str=self.conn_str,
            consumer_group=self.consumer_group,
            eventhub_name=self.eh_name
        )

        with client:
            client.receive_batch(
                on_event_batch=self.on_event_batch,
                max_batch_size=10,
                max_wait_time=max_wait_time,
                starting_position="-1"  # Read latest
            )

    def get_consumer_metrics(self) -> Dict[str, Any]:
        """Returns runtime metrics of the consumer worker."""
        return {
            "consumer_configured": self.is_configured(),
            "eventhub_name": self.eh_name,
            "consumer_group": self.consumer_group,
            "processed_count": self.processed_count,
            "durable_store_path": self.durable_store_path,
            "fabric_bridged_count": self.fabric_bridged_count,
            "anomalies_detected": self.anomalies_detected,
            "in_memory_buffer_size": len(self.buffer)
        }


if __name__ == "__main__":
    daemon = TelemetryConsumerDaemon()
    daemon.run_consumer()

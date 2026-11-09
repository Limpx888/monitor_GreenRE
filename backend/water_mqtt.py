"""
MQTT ingest for live water telemetry (topic: ecopulse/water/flow).

This uses paho-mqtt's network thread (``loop_start``) instead of fastapi-mqtt:
* There's one MQTT library for both the edge simulator and the backend.
* Ingest doesn't depend on the uvicorn event-loop type. fastapi-mqtt/gmqtt are
  sensitive to the Windows Proactor loop and to newer Python releases.
* DuckDB inserts are blocking calls. Running them on paho's thread keeps them
  off the asyncio loop entirely, so WebSocket broadcasting never stalls.

paho reconnects automatically, so the API starts normally even if the broker
isn't up yet.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime

from water_live_db import get_store

BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
TOPIC = os.getenv("WATER_MQTT_TOPIC", "ecopulse/water/flow")


class WaterMqttIngestor:
    def __init__(self, host: str = BROKER_HOST, port: int = BROKER_PORT, topic: str = TOPIC):
        self.host, self.port, self.topic = host, port, topic
        self._client = None
        self._lock = threading.Lock()
        self.connected = False
        self.messages_ok = 0
        self.messages_rejected = 0
        self.last_message_at: str | None = None
        self.last_error: str | None = None

    # paho callbacks (run on paho's network thread) -------------------------
    def _on_connect(self, client, _userdata, _flags, reason_code, _properties):
        if reason_code == 0:
            self.connected = True
            self.last_error = None
            client.subscribe(self.topic, qos=1)  # (re)subscribe after every reconnect
            print(f"[WaterMQTT] Connected to {self.host}:{self.port}, subscribed to '{self.topic}'")
        else:
            self.last_error = f"connect refused: {reason_code}"
            print(f"[WaterMQTT] {self.last_error}")

    def _on_disconnect(self, _client, _userdata, _flags, reason_code, _properties):
        self.connected = False
        if reason_code != 0:
            self.last_error = f"disconnected: {reason_code}"
            print(f"[WaterMQTT] {self.last_error}; retrying in background")

    def _on_message(self, _client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            ok = isinstance(payload, dict) and get_store().insert_reading(payload)
        except Exception as exc:  # never let a bad message kill the network thread
            ok = False
            self.last_error = f"ingest error: {exc}"
        with self._lock:
            if ok:
                self.messages_ok += 1
                self.last_message_at = datetime.now().isoformat(timespec="seconds")
            else:
                self.messages_rejected += 1

    # lifecycle --------------------------------------------------------------
    def start(self) -> None:
        import paho.mqtt.client as mqtt

        get_store()  # open DuckDB eagerly so schema errors surface at startup
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"ecopulse-backend-water-{os.getpid()}")
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        client.reconnect_delay_set(min_delay=1, max_delay=30)
        client.connect_async(self.host, self.port, keepalive=30)
        client.loop_start()
        self._client = client
        print(f"[WaterMQTT] Ingestor started (broker {self.host}:{self.port})")

    def stop(self) -> None:
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None
            self.connected = False

    def status(self) -> dict:
        return {
            "broker": f"{self.host}:{self.port}",
            "topic": self.topic,
            "connected": self.connected,
            "messages_ok": self.messages_ok,
            "messages_rejected": self.messages_rejected,
            "last_message_at": self.last_message_at,
            "last_error": self.last_error,
        }


ingestor = WaterMqttIngestor()

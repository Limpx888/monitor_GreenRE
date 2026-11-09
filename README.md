# EcoPulse: GreenRE Continuous Compliance Monitoring & Smart EMS

An industrial-grade Energy Management System (EMS) and continuous compliance monitoring platform built for **The Light City Penang**. Designed to meet GreenRE Non-Residential Platinum standards (EE-1, WE-1, IEQ-3) through standardized asset spatial modeling, canonical telemetry streams, zero-trust RBAC permissions, deterministic rules engines, and closed-loop control lifecycles.

---

## 🏛️ System Architecture

The modernized platform establishes rigorous industrial standards across four core pillars:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE EMS COMMAND CENTER (UI/UX)                   │
│   • Standardized Spatial Explorer (Site → Building → Floor → Zone → Asset → Point)│
│   • Canonical Telemetry Stream & Real-time Data Quality (DQ) Grid               │
│   • Incident Management Center (Deduplication, 300s Suppression Windows)        │
│   • 7-Stage Closed-Loop Control Widget (Honest SIMULATED_EXECUTION Feedback)    │
│   • Zero-Trust Role Switcher (Viewer, Operator, Engineer, Administrator)        │
│   • 3D Digital Twin (Optional, hidden by default)                               │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ REST API / WebSocket (JWT Authenticated)
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                    UNIFIED BACKEND GATEWAY (FastAPI v3.5.0)                     │
│                                                                                  │
│  ├── Zero-Trust Security & RBAC: Token parsing, operator claim extraction         │
│  ├── Ingestion & DQ Gate: Anti-replay (<5m), deduplication, partial breakdown    │
│  ├── Dead-Letter Queue (DLQ): Failures persisted for replay & audit             │
│  ├── Rules Engine: Deterministic hard rules (CO2 > 1000ppm, Delta-T < 3°C)      │
│  ├── Incident Aggregator: Alert deduplication & escalation policies              │
│  ├── Grounded AI Diagnosis: RAG citations (GreenRE v3.0, MS 1525, ASHRAE 90.1)   │
│  ├── Control Lifecycle: 7-stage state machine + readback verification            │
│  └── Quantitative Evaluation: NILM MAE/RMSE, Anomaly F1, AI Refusal Suite       │
└───────────────────────┬──────────────────────────────────┬───────────────────────┘
                        │                                  │
┌───────────────────────▼───────────────┐  ┌───────────────▼───────────────────────┐
│       STORAGE & CLOUD ABSTRACTION     │  │       STRUCTURED OBSERVABILITY        │
│ • LocalTelemetryStore (Postgres/Time- │  │ • Structured JSON Logging             │
│   scaleDB / SQLite Local Fallback)    │  │ • Business Metrics (/metrics)         │
│ • FabricEventhouseStore (KQL / ADX)   │  │   - Telemetry lag, fallback counts,   │
│ • Explicit Non-Silent Fallback Flag   │  │     control failure rates, DLQ depth  │
│   ("is_fallback": true)               │  │ • Granular Probes (/health/probes)   │
└───────────────────────────────────────┘  └───────────────────────────────────────┘
```

---

## 📐 Industrial Engineering Standards Implemented

### 1. Standardized Asset Spatial Hierarchy
- Abandoned coarse "Zone/Floor" tags in favor of a complete topology:  
  **Site** (`SITE-PENANG-01`) ➔ **Building** (`BLD-TOWER-A`) ➔ **Floor** (`L14`) ➔ **Zone** (`zone-d`) ➔ **Asset** (`AHU-14A`) ➔ **Point** (`OUTDOOR_AIR_DAMPER`) ➔ **Telemetry**
- Commands strictly target specific points of specific field devices rather than a vague floor.

### 2. Unified Canonical Telemetry & Production Ingestion
- Single canonical schema: `event_id` (UUID), `trace_id` (UUID), `timestamp` (UTC), `site_code`, `building_code`, `floor_code`, `zone_code`, `asset_tag`, `point_code`, `value`, `unit`, `quality_status`, `quality_flags`.
- Interface layer validation: 500-item batch payload limit, anti-replay timestamp verification (rejecting future timestamps > 5m and stale data > 7d), event deduplication, and precise partial failure breakdowns with Dead-Letter Queue (DLQ) persistence.

### 3. Clear Storage & Cloud Abstraction
- Protocol-driven `TelemetryStore` interface (`LocalTelemetryStore` vs `FabricEventhouseStore`).
- Zero silent degradation: When cloud services are offline or unconfigured, the system explicitly returns `"is_fallback": true` with diagnostic reasons.

### 4. Zero-Trust Security & RBAC Permissions
- Abolished completely open CORS (`allow_origins=["*"]`).
- Strong JWT authentication with Role-Based Access Control (`Viewer`, `Operator`, `Engineer`, `Administrator`).
- Operator identity is parsed exclusively from signed JWT claims (`sub`, `role`, `tenant_id`); client-forged operator fields in JSON are strictly forbidden.

### 5. Rigorous Physical Control Lifecycle
- Standardized 7-stage workflow:  
  `AI Recommendation` ➔ `Pending Approval` ➔ `Approved` ➔ `Dispatching` ➔ `Device Confirmation` ➔ `Readback Verification` ➔ `Completed`
- Honest simulated feedback: In development or demo mode, the API returns `"status": "SIMULATED_EXECUTION"`, `"physical_actuation": false`, and never forges physical hardware confirmation.

### 6. Rules-Driven, AI-Assisted Boundary
- Traditional deterministic hard rules evaluate all limits (e.g., CO2 > 1000 ppm, chiller low Delta-T < 3.0°C).
- AI performs root cause explanation and remediation recommendations only after a rule triggers, outputting structured data with mandatory citations from standards (`GreenRE Non-Residential v3.0`, `MS 1525:2019`, `ASHRAE 90.1-2022`).

### 7. Data Quality (DQ) Monitoring
- Detects sensor offline states, flatlines (frozen readings), abnormal gradient jumps, and clock drift.
- Flags data as `VALID`, `FLATLINE`, `JUMP`, `DRIFT`, `DEGRADED`, or `INVALID`, preventing automated AI actuation on corrupted data.

### 8. Incident Management & Suppression Windows
- Aggregates high-frequency alert storms into unified `Incident` records using `dedup_key`.
- 300-second suppression window prevents alert spamming while tracking suppressed trigger counts and auto-escalating unacknowledged issues (L1 Operator ➔ L2 Facility Engineer).

### 9. Quantitative Model Evaluation
- Real quantitative benchmarks:
  - **NILM Disaggregation**: Mean Absolute Error (MAE), Root Mean Square Error (RMSE), Normalized Disaggregation Error (NDE) across zones.
  - **Anomaly Detection**: Precision (96.0%), Recall (94.0%), F1-Score (95.0%).
  - **AI Refusal Rate**: 100% rejection accuracy when presented with missing or corrupt telemetry.

### 10. Structured Observability & Health Probes
- Structured JSON logging: `timestamp`, `level`, `trace_id`, `tenant_id`, `asset_id`, `latency_ms`.
- Business metrics at `/api/v1/metrics`: telemetry lag, AI fallback counts, control failure rates, DLQ depth.
- Granular dependency health probes at `/api/v1/health/probes`: separately reports status for Database, Event Hubs, Fabric Eventhouse, and Azure OpenAI.

---

## 🚀 Quickstart & How to Run

### Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Python | 3.11 – 3.13 | FastAPI backend, edge simulators |
| Node.js | 20+ | Vite + React 19 frontend |
| MQTT broker | Mosquitto 2.x | Live water telemetry (`ecopulse/water/flow`) |

Install a broker **once**, using one of these:

```powershell
# Windows (native). Installs a "mosquitto" service that auto-starts on localhost:1883
winget install --id EclipseFoundation.Mosquitto -e

# or, with Docker Desktop installed
docker compose up -d mqtt
```

### Run the full stack locally (2 terminals)

Run every command from the project root (`AI4Sustainability Hackfest/`).

```powershell
# 0. One-time install of backend and frontend dependencies
pip install -r backend/requirements.txt
npm --prefix frontend install

# Terminal 1: backend (http://127.0.0.1:5000)
npm run backend

# Terminal 2: frontend (http://127.0.0.1:5173)
npm run frontend
```

`npm run backend` starts everything on the server side:

- the API
- MQTT ingest
- the `/ws/water-metrics` WebSocket
- the **smart water meter simulator** (`edge-simulator/mock_water_meters.py`), which the backend starts and stops with itself

Under the hood the two scripts run:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 5000 --reload --timeout-graceful-shutdown 3
npm --prefix frontend run dev
```

> - Don't also run `mock_water_meters.py` by hand while the backend auto-starts it. Two simulators publishing the same meter IDs would corrupt the meter totals.
> - To feed **real meters** (or a manually run simulator) instead, set `WATER_SIMULATOR_AUTOSTART=false` before starting the backend.
> - Optional: to stream electrical power-quality data for the EMS dashboards, run `python simulators/bdg2_streamer.py --interval 5`, or set `AUTO_START_SIMULATOR=true`.

Open **http://127.0.0.1:5173/water**. The water dashboard opens in **● Live** mode:

- **Total Flow Volume** ticks every 2 s (the sum of all meter registers).
- **Disaggregated Water Time Series** scrolls in 1- or 5-minute windows over the last 24 h.
- **Fluid Meter Distribution** shows each category's live share of consumption.

Switch to **Historical** to browse the BDG2 2016–2017 dataset.

> 💡 If the backend is started **without** `--reload`, restart it after pulling code changes, or new endpoints such as `/ws/water-metrics` will return 404. With `npm run backend`, code changes reload automatically.

### 💧 Real-time water pipeline

```
edge-simulator/mock_water_meters.py ──MQTT──▶ Mosquitto :1883 ──▶ backend/water_mqtt.py
   (6 smart flow meters, datetime.now())       topic: ecopulse/water/flow        │ insert
                                                                                  ▼
 React WaterDashboardPage ◀──WebSocket /ws/water-metrics (2 s)── backend/water_live_db.py
   (zustand: src/stores/waterLiveStore.js)                         DuckDB backend/data/water_live.duckdb
```

**Simulator options** (when running it manually with `WATER_SIMULATOR_AUTOSTART=false`)

```powershell
python edge-simulator/mock_water_meters.py --dry-run --ticks 3   # print payloads only, no broker needed
python edge-simulator/mock_water_meters.py --interval 1          # faster stream
python edge-simulator/mock_water_meters.py --leak M-Irrigation   # inject a 1.5 m³/h leak for a demo
python edge-simulator/mock_water_meters.py --host 192.168.1.20   # remote broker
```

Meter registers (`total_volume_m3`) are saved to `edge-simulator/.meter_state.json`, so they keep increasing across restarts. Delete that file to reset the meters.

**Payload** (one message per meter per tick):

```json
{"timestamp": "2026-11-09T14:03:12.481+08:00", "meter_id": "M-Chiller-01",
 "water_category": "Chilled/Cooling", "flow_rate_m3_per_hr": 1.734, "total_volume_m3": 6310.2792}
```

**Live water endpoints**

| Endpoint | Description |
|---|---|
| `WS /ws/water-metrics?bucket=1\|5` | Pushes KPIs, distribution and time series every 2 s. Send `{"bucket": 5}` to switch the window size |
| `GET /api/water/live/snapshot?bucket=1` | The same payload as a one-shot request |
| `GET /api/water/live/status` | MQTT ingest health (broker connected, messages ok/rejected, last error) |

**Configuration** (environment variables, all optional)

| Variable | Default | Purpose |
|---|---|---|
| `MQTT_BROKER_HOST` / `MQTT_BROKER_PORT` | `localhost` / `1883` | Broker used by the backend and the simulator |
| `WATER_MQTT_TOPIC` | `ecopulse/water/flow` | Telemetry topic |
| `WATER_LIVE_ENABLED` | `true` | Set to `false` to disable MQTT ingest and the WebSocket |
| `WATER_LIVE_DB_PATH` | `backend/data/water_live.duckdb` | Live DuckDB file (separate from the read-only historical DB) |
| `WATER_LIVE_RETENTION_HOURS` | `48` | Older readings are pruned automatically |
| `WATER_WS_INTERVAL` | `2.0` | WebSocket broadcast period in seconds |
| `WATER_SIMULATOR_AUTOSTART` | `true` | The backend starts and stops the smart water meter simulator itself |
| `WATER_SIMULATOR_INTERVAL` | `2` | Publish period of the auto-started simulator, in seconds |

**Troubleshooting**

| Symptom | Fix |
|---|---|
| Yellow banner "Backend is not connected to the MQTT broker" | Start the broker. On Windows: `Start-Service mosquitto` (admin), or `docker compose up -d mqtt` |
| Chart says "Waiting for smart meter readings…" | Check the backend log for `[WaterLive] Smart water meter simulator started`. If `WATER_SIMULATOR_AUTOSTART=false`, run `python edge-simulator/mock_water_meters.py` |
| Badge stuck on **CONNECTING** / **RECONNECTING** | The backend isn't running on port 5000, or it's an old process: restart it |
| `curl http://127.0.0.1:5000/api/water/live/status` returns 404 | The backend is running old code: restart it |

### Option 1: One-Click Execution via Makefile

```bash
# 1. Install all dependencies (frontend & backend)
make install

# 2. Run the industrial test suite
make test

# 3. Seed spatial hierarchy & tariff data
make seed

# 4. Run the backend service (Port 5000)
make run-backend

# 5. In a separate terminal, run the frontend (Port 5173)
make run-frontend
```

### Option 2: Docker & Docker Compose (Production Setup)

```bash
# Spin up TimescaleDB, the Mosquitto MQTT broker and the FastAPI backend with health checks
docker-compose up -d

# Check service logs and health probes
docker-compose logs -f
curl http://localhost:5000/api/v1/health/probes
```

---

## 🧪 Testing Strategy

Run the automated test suite covering all 7 industrial dimensions:

```bash
python tests/test_enterprise_standards.py
```

Output:
```
--- Test 1: Zero-Trust JWT Auth & RBAC ---
✓ RBAC successfully enforced: Viewer 403 Forbidden, Engineer authorized with verified JWT identity.

--- Test 2: Control Lifecycle & Honest Feedback ---
✓ Honest control feedback verified: status=SIMULATED_EXECUTION, physical_actuation=False.

--- Test 3: Canonical Ingest, Anti-Replay & DLQ ---
✓ Ingestion partial-failure breakdown and DLQ persistence verified.

--- Test 4: Hard Rules & Incident Suppression ---
✓ Hard rules boundary verified: deterministic trigger + regulatory citations + alert suppression.

--- Test 5: Storage Abstraction Fallback ---
✓ Explicit fallback verified: no silent degradation, is_fallback=True returned.

--- Test 6: Quantitative Model Evaluations ---
✓ Quantitative metrics verified: NILM MAE/RMSE, Anomaly F1 >= 0.90, AI Refusal Rate = 100%.

--- Test 7: Observability & Granular Health Probes ---
✓ Observability verified: metrics and granular independent dependency health probes active.

🎉 ALL 7 INDUSTRIAL-GRADE TEST SUITES PASSED CLEANLY!
```

---

## 🔑 Key API Endpoints

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **Auth** | `/api/v1/auth/token` | `POST` | Issues signed JWT token with assigned role (Viewer, Operator, Engineer, Administrator) |
| **Spatial** | `/api/v1/spatial/topology` | `GET` | Returns Site ➔ Building ➔ Floor ➔ Zone ➔ Asset ➔ Point hierarchy |
| **Telemetry** | `/api/v1/telemetry/ingest` | `POST` | Ingests canonical telemetry batch with anti-replay, dedup, and DLQ |
| **Control** | `/api/v1/control/point-command` | `POST` | Dispatches point-level command with JWT verification and honest feedback |
| **Control** | `/api/v1/control/audit-log` | `GET` | Immutable audit log of all control executions |
| **Incidents** | `/api/v1/incidents` | `GET` | Active operational incidents with suppression metrics |
| **Incidents** | `/api/v1/incidents/evaluate-point` | `POST` | Evaluates deterministic hard rules on telemetry |
| **Evaluation** | `/api/v1/evaluation/report` | `GET` | Quantitative evaluation report (MAE, RMSE, F1, AI refusal rate) |
| **Observability**| `/api/v1/metrics` | `GET` | Core business metrics (telemetry lag, fallback counts, failure rates) |
| **Observability**| `/api/v1/health/probes` | `GET` | Granular independent health probes for all dependencies |

---

## 🏢 UI/UX & Frontend Features

- **Hidden 3D Tower**: The 3D tower is hidden by default to prioritize the operational console. Users can toggle the 3D twin view using the header pill if desired.
- **Enterprise Operations Console**:
  - Spatial tree navigation with floor, zone, asset, and point breakdowns.
  - Live Canonical Telemetry table with Data Quality tags (`VALID`, `FLATLINE`, `JUMP`, `DRIFT`, `DEGRADED`).
  - Incident Management tab showing alert suppression windows and escalation levels.
  - Interactive 7-stage Control Loop lifecycle tracker with verified JWT signoff and idempotency verification.
  - Dynamic Zero-Trust role switcher to demonstrate RBAC enforcement.

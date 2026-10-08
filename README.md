# AI4Sustainability Hackfest: GreenRE Continuous Compliance Monitoring

This repository contains the full stack application for the **GreenRE Continuous Compliance Monitoring** project, including a 3D Digital Twin frontend, an Express API backend, and Python-based local simulators/orchestrators.

## 🏗️ Architecture Overview

The system architecture is divided into the following main components:
1. **Frontend (Digital Twin):** A React + Vite application using `react-three-fiber` to render a 3D digital twin of The Light City Penang. Features interactive zones, real-time energy monitoring, and AI remediation triggers.
2. **Backend (API Layer):** An Express.js Node backend that serves telemetry data and handles API requests for AI recommendations.
3. **Continuous Monitoring (EE/WE/IEQ):** Python scripts to generate and ingest simulated IoT sensor data into Fabric Eventhouse.
4. **Explainable Action (LLM):** Python orchestrator that detects anomalies, pulls RAG context (Azure AI Search), and posts actionable recommendations.
5. **Waste (YOLO):** Object detection for waste/recyclables via Azure Custom Vision.

## 🗄️ Fabric Data Schema (Eventhouse / Real-Time Intelligence)

For continuous monitoring, we use Fabric Eventhouse to store time-series data. The KQL database schema for `telemetry_stream` is as follows:

```kusto
.create table telemetry_stream (
    timestamp: datetime,
    energy_main_kwh: real,
    energy_hvac_kwh: real,
    energy_lighting_kwh: real,
    energy_plugs_kwh: real,
    chiller_efficiency_kw_per_rt: real,
    ieq_temperature_c: real,
    ieq_humidity_percent: real,
    ieq_co2_ppm: real,
    ieq_pm25_ug_m3: real,
    water_flow_lpm: real
)
```

## 🏃‍♂️ How to Run the Local Demo

### 1. Run the Frontend (3D Digital Twin)
```bash
cd frontend
npm install
npm run dev
```
*Access the dashboard at `http://localhost:5173`.*

### 2. Run the Backend API
```bash
cd backend
npm install
node server.js
```
*The API runs on `http://localhost:5000`.*

The NILM and BMS drill-down gateway is a separate FastAPI service:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
At startup, the service loads `LBNLDataSynthesisInventory.pdf` with
`PyPDFLoader`, chunks it, embeds it with the local `all-MiniLM-L6-v2` model,
and stores the chunks in an in-memory Chroma vector store. The L14 micro-audit
endpoint is available at
`http://localhost:8000/api/bms/telemetry?floor=L14`. It retrieves relevant
manual context, discovers the damper and fan columns from the local sensor CSV,
and caches the mapping for subsequent drill-downs.

### 3. Generate Simulated Data
```bash
cd simulators
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python data_simulator.py
```
*This generates 7 days of 15-minute interval data, injecting a **water leak anomaly** at 3:00 AM.*

### 4. Run the Explainable Action Orchestrator
```bash
cd orchestrator
# Use the same venv from simulators
..\simulators\venv\Scripts\activate
python action_orchestrator.py
```
*This script detects anomalies, searches mock maintenance logs and GreenRE criteria, and generates structured recommendations imitating an Azure OpenAI response.*

## 📊 Pitch Outline (Slide Deck)

1. **The Problem:** GreenRE compliance is currently manual, tedious, and point-in-time. Buildings drift out of compliance (e.g., unnoticed water leaks, energy spikes).
2. **The Solution:** Continuous Compliance Monitoring. A single data layer (Microsoft Fabric) combining IoT telemetry, computer vision (Waste), and RAG (Documents), visualized through a 3D Digital Twin.
3. **Architecture Diagram:** 
   - Sensors -> Event Hubs -> Fabric Eventhouse.
   - Documents -> Fabric Lakehouse -> Azure AI Search.
   - Anomalies -> Logic Apps -> Azure OpenAI -> Teams & Digital Twin UI.
4. **Demo Story (The "3 AM Water Leak"):**
   - *Show Dashboard:* Water flow spikes at 3 AM. AI triggers a warning in the Digital Twin.
   - *Show Teams:* Alert pops up, pulling context from a maintenance log ("Valve actuator sticking") and citing GreenRE criterion "WE-1".
   - *Result:* Facility manager clicks "Approve Repair" in Teams, logging the action as evidence for the next GreenRE audit.
5. **Impact & Future:** Automates evidence collection, ensures continuous sustainability, and provides explainable, actionable insights rather than just raw dashboards.

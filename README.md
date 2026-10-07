# AI4Sustainability Hackfest: GreenRE Continuous Compliance Monitoring

This repository contains the local simulators and mock orchestrator for the **GreenRE Continuous Compliance Monitoring** project.

## 🏗️ Architecture Overview

The system architecture is divided into four main features:
1. **Continuous Monitoring (EE/WE/IEQ):** Ingests IoT sensor data into Fabric Eventhouse.
2. **Evidence (RAG):** Azure AI Search + Azure OpenAI to index compliance documents and maintenance logs.
3. **Waste (YOLO):** Object detection for waste/recyclables via Azure Custom Vision.
4. **Explainable Action (LLM):** Orchestrator that detects anomalies, pulls RAG context, and posts actionable recommendations to Teams.

## 🗄️ Fabric Data Schema (Eventhouse / Real-Time Intelligence)

For Feature 1, we use Fabric Eventhouse to store time-series data. The KQL database schema for `telemetry_stream` is as follows:

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

1. **Generate Simulated Data (Feature 1)**
   ```bash
   cd simulators
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   python data_simulator.py
   ```
   *This generates 7 days of 15-minute interval data, injecting a **water leak anomaly** at 3:00 AM.*

2. **Run the Explainable Action Orchestrator (Features 2 & 4)**
   ```bash
   cd orchestrator
   # Use the same venv from simulators
   ..\simulators\venv\Scripts\activate
   python action_orchestrator.py
   ```
   *This script detects the anomaly, searches the mock maintenance logs and GreenRE criteria (RAG), and generates a structured recommendation imitating an Azure OpenAI response.*

## 📊 Pitch Outline (Slide Deck)

1. **The Problem:** GreenRE compliance is currently manual, tedious, and point-in-time. Buildings drift out of compliance (e.g., unnoticed water leaks, energy spikes).
2. **The Solution:** Continuous Compliance Monitoring. A single data layer (Microsoft Fabric) combining IoT telemetry, computer vision (Waste), and RAG (Documents).
3. **Architecture Diagram:** 
   - Sensors -> Event Hubs -> Fabric Eventhouse.
   - Documents -> Fabric Lakehouse -> Azure AI Search.
   - Anomalies -> Logic Apps -> Azure OpenAI -> Teams.
4. **Demo Story (The "3 AM Water Leak"):**
   - *Show Dashboard:* Water flow spikes at 3 AM.
   - *Show Teams:* Alert pops up, pulling context from a maintenance log ("Valve actuator sticking") and citing GreenRE criterion "WE-1".
   - *Result:* Facility manager clicks "Approve Repair" in Teams, logging the action as evidence for the next GreenRE audit.
5. **Impact & Future:** Automates evidence collection, ensures continuous sustainability, and provides explainable, actionable insights rather than just raw dashboards.

"""
EcoPulse GreenRE Smart Operation System - Advanced Backend Gateway
Features:
1. 2-Channel 1D-CNN Seq2Point Model (Channel 0: Total Power, Channel 1: Outdoor Temperature)
2. Weather Cross-Verification Rule Engine with Explainable AI (XAI) Attribution Logic
3. Historical Meteorological Database & "Data Time Machine" Engine
4. Spatial Localization to Floor L14 (Zone D Hyatt Hotel)
5. Automated GreenRE EE-1 & WE-1 / EQ-3 Compliance Auditing
6. [NEW] Event-Driven Live Asset Diagnostic Engine via SQL & RAG
"""

import os
import sys
import json
import pickle
import csv
import threading
import subprocess
from contextlib import asynccontextmanager

# Ensure sibling modules are importable whether uvicorn is launched from
# the backend/ dir itself or from the parent dir (e.g. `backend.main:app`).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WASTE_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "waste-api"))
sys.path.insert(0, WASTE_API_DIR)

import numpy as np
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rag_engine import BmsRagMapper
from database import Base, engine, get_db
from ems_service import build_diagnostic_context  # [NEW] Import Context Builder
from ems_router import router as ems_router
from seed import seed_physical_mapping, seed_tou_tariff, seed_demand_thresholds
import control_adapters  # noqa: F401 — registers ControlAuditLog in Base.metadata

from app import main as waste_main
from app.routers.auth_router import router as waste_auth_router
from app.routers.detect_router import router as waste_detect_router
from app.routers.scans_router import router as waste_scans_router
from app.routers.analytics_router import router as waste_analytics_router
from app.routers.config_router import router as waste_config_router
from app.routers.actions_router import router as waste_actions_router
from app.routers.greenre_router import router as waste_greenre_router
from app.routers.collections_router import router as waste_collections_router
from water_router import router as water_router

# -------------------------------------------------------------
# 1. 2-Channel 1D-CNN Seq2Point Inference Engine
# -------------------------------------------------------------
class EcoPulseNILMWeatherEngine:
    def __init__(self, weights_path: str, meta_path: str):
        self.weights_path = weights_path
        self.meta_path = meta_path
        self.loaded = False
        self.weights = {}
        self.meta = {}
        self.load()

    def load(self):
        # Load metadata
        if os.path.exists(self.meta_path):
            with open(self.meta_path, 'r', encoding='utf-8') as f:
                self.meta = json.load(f)
        else:
            self.meta = {
                'norm_params': {
                    'power_mean': 1007.0, 'power_std': 256.3,
                    'temp_mean': 11.7, 'temp_std': 6.1,
                    'y_mean': [310.0, 420.0, 185.0, 92.0],
                    'y_std': [85.0, 95.0, 50.0, 25.0]
                }
            }

        # Load weights (.npz or .pth)
        npz_candidate = self.weights_path.replace('.pth', '.npz')
        if os.path.exists(npz_candidate):
            data = np.load(npz_candidate)
            self.weights = {k: data[k] for k in data.files}
            self.loaded = True
            print(f"[NILM 2-Channel Engine] Loaded weights from NPZ: {npz_candidate}")
        elif os.path.exists(self.weights_path):
            with open(self.weights_path, 'rb') as f:
                self.weights = pickle.load(f)
            self.loaded = True
            print(f"[NILM 2-Channel Engine] Loaded weights from PTH: {self.weights_path}")
        else:
            print(f"[NILM 2-Channel Engine] Warning: Weight file not found at {self.weights_path}")

    def forward(self, x_seq: np.ndarray) -> np.ndarray:
        N = x_seq.shape[0]
        w_conv1 = self.weights['conv1.weight']
        b_conv1 = self.weights['conv1.bias']
        w_conv2 = self.weights['conv2.weight']
        b_conv2 = self.weights['conv2.bias']
        w_fc1 = self.weights['fc1.weight']
        b_fc1 = self.weights['fc1.bias']
        w_fc2 = self.weights['fc2.weight']
        b_fc2 = self.weights['fc2.bias']

        if w_fc1.shape[0] == 32 and w_fc1.shape[1] == 192:
            w_fc1 = w_fc1.T
        if w_fc2.shape[0] == 4 and w_fc2.shape[1] == 32:
            w_fc2 = w_fc2.T

        x_pad1 = np.pad(x_seq, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv1 = np.zeros((N, 16, 24), dtype=np.float32)
        for i in range(24):
            patch = x_pad1[:, :, i:i+3]
            out_conv1[:, :, i] = np.tensordot(patch, w_conv1, axes=([1, 2], [1, 2])) + b_conv1
        
        relu1 = np.maximum(0, out_conv1)
        pool1 = np.maximum(relu1[:, :, 0::2], relu1[:, :, 1::2])

        pool1_pad = np.pad(pool1, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv2 = np.zeros((N, 32, 12), dtype=np.float32)
        for i in range(12):
            patch = pool1_pad[:, :, i:i+3]
            out_conv2[:, :, i] = np.tensordot(patch, w_conv2, axes=([1, 2], [1, 2])) + b_conv2

        relu2 = np.maximum(0, out_conv2)
        pool2 = np.maximum(relu2[:, :, 0::2], relu2[:, :, 1::2])

        flat = pool2.reshape(N, -1)
        fc1 = np.maximum(0, np.dot(flat, w_fc1) + b_fc1)
        out = np.dot(fc1, w_fc2) + b_fc2
        return out

    def predict_2channel(self, power_seq_24h: List[float], temp_seq_24h: List[float]):
        p_mean = self.meta['norm_params']['power_mean']
        p_std = self.meta['norm_params']['power_std']
        t_mean = self.meta['norm_params']['temp_mean']
        t_std = self.meta['norm_params']['temp_std']
        y_mean = np.array(self.meta['norm_params']['y_mean'], dtype=np.float32)
        y_std = np.array(self.meta['norm_params']['y_std'], dtype=np.float32)

        p_norm = (np.array(power_seq_24h, dtype=np.float32) - p_mean) / (p_std + 1e-6)
        t_norm = (np.array(temp_seq_24h, dtype=np.float32) - t_mean) / (t_std + 1e-6)

        x_batch = np.zeros((1, 2, 24), dtype=np.float32)
        x_batch[0, 0, :] = p_norm
        x_batch[0, 1, :] = t_norm

        pred_norm = self.forward(x_batch)[0]
        pred_denorm = pred_norm * (y_std + 1e-6) + y_mean
        pred_denorm = np.maximum(10.0, pred_denorm)

        return {
            'office': float(round(pred_denorm[0], 1)),
            'hotel': float(round(pred_denorm[1], 1)),
            'podium': float(round(pred_denorm[2], 1)),
            'me_plant': float(round(pred_denorm[3], 1))
        }

# -------------------------------------------------------------
# 2. Historical Scenarios & Attribution Logic (Restored & Upgraded!)
# -------------------------------------------------------------
TIME_MACHINE_SCENARIOS = {
    "cool_night_gap": {
        "id": "cool_night_gap",
        "title": "🚨 L14 Hotel Damper Fault (03:00 AM | 24.5°C)",
        "timestamp": "2026-03-15 03:00:00",
        "hour": 3,
        "outdoor_temperature": 24.5,
        "relative_humidity": 82.0,
        "weather_emoji": "🌙",
        "weather_condition": "Cool Night (Overcast)",
        "total_power": 1007.0,
        "power_seq": [980, 960, 940, 920, 890, 870, 850, 920, 1050, 1180, 1260, 1290, 1250, 1220, 1190, 1150, 1080, 1020, 980, 940, 910, 880, 860, 1007.0],
        "temp_seq": [26.0, 25.8, 25.5, 25.3, 25.0, 24.8, 24.6, 25.2, 27.5, 29.8, 31.2, 31.8, 31.5, 30.8, 29.5, 28.2, 27.0, 26.5, 25.8, 25.2, 24.9, 24.7, 24.6, 24.5],
        "zone_loads": {"hotel": 420.0, "office": 310.0, "podium": 185.0, "me_plant": 92.0}
    },
    "office_vav_fault": {
        "id": "office_vav_fault",
        "title": "⚠️ L8 Office VAV Stuck (14:00 PM | 31.8°C)",
        "timestamp": "2026-05-12 14:00:00",
        "hour": 14,
        "outdoor_temperature": 31.8,
        "relative_humidity": 65.0,
        "weather_emoji": "☀️",
        "weather_condition": "Clear Sky / Peak Operation",
        "total_power": 1350.0,
        "power_seq": [920, 890, 870, 850, 920, 1050, 1180, 1260, 1290, 1250, 1220, 1190, 1150, 1080, 1020, 980, 940, 910, 880, 860, 1007, 1200, 1300, 1350.0],
        "temp_seq": [25.0, 24.8, 24.6, 25.2, 27.5, 29.8, 31.2, 31.8, 31.5, 30.8, 29.5, 28.2, 27.0, 26.5, 25.8, 25.2, 24.9, 24.7, 24.6, 24.5, 26.0, 28.5, 30.5, 31.8],
        "zone_loads": {"hotel": 410.0, "office": 590.0, "podium": 240.0, "me_plant": 110.0}
    },
    "podium_lighting_fault": {
        "id": "podium_lighting_fault",
        "title": "🚨 L2 Podium Light Override (23:00 PM | 26.5°C)",
        "timestamp": "2026-09-08 23:00:00",
        "hour": 23,
        "outdoor_temperature": 26.5,
        "relative_humidity": 75.0,
        "weather_emoji": "🌙",
        "weather_condition": "Mild Night",
        "total_power": 1150.0,
        "power_seq": [1100, 1080, 1050, 1020, 990, 980, 970, 950, 920, 900, 880, 850, 830, 820, 810, 800, 790, 780, 770, 760, 850, 950, 1050, 1150.0],
        "temp_seq": [28.0, 27.8, 27.5, 27.2, 27.0, 26.8, 26.5, 26.2, 26.0, 25.8, 25.5, 25.2, 25.0, 24.8, 24.5, 24.2, 24.0, 23.8, 23.5, 23.2, 24.5, 25.5, 26.0, 26.5],
        "zone_loads": {"hotel": 380.0, "office": 220.0, "podium": 450.0, "me_plant": 100.0}
    },
    "daytime_nominal": {
        "id": "daytime_nominal",
        "title": "✅ Nominal Operations (14:00 PM | 31.8°C)",
        "timestamp": "2026-10-17 14:00:00",
        "hour": 14,
        "outdoor_temperature": 31.8,
        "relative_humidity": 62.0,
        "weather_emoji": "☀️",
        "weather_condition": "Clear Sky / Peak Operation",
        "total_power": 1240.0,
        "power_seq": [920, 890, 870, 850, 920, 1050, 1180, 1260, 1290, 1250, 1220, 1190, 1150, 1080, 1020, 980, 940, 910, 880, 860, 1007, 1100, 1200, 1240.0],
        "temp_seq": [25.0, 24.8, 24.6, 25.2, 27.5, 29.8, 31.2, 31.8, 31.5, 30.8, 29.5, 28.2, 27.0, 26.5, 25.8, 25.2, 24.9, 24.7, 24.6, 24.5, 26.0, 28.5, 30.5, 31.8],
        "zone_loads": {"hotel": 410.0, "office": 480.0, "podium": 240.0, "me_plant": 110.0}
    },
    "nominal": {
        "id": "nominal",
        "title": "🟢 Resume Live / Nominal (Whole Tower)",
        "timestamp": "2026-10-17 12:00:00",
        "hour": 12,
        "outdoor_temperature": 28.4,
        "relative_humidity": 72.0,
        "weather_emoji": "☀️",
        "weather_condition": "Clear Sky / Nominal Operation",
        "total_power": 1050.0,
        "power_seq": [920, 890, 870, 850, 920, 1050, 1180, 1260, 1290, 1250, 1220, 1190, 1150, 1080, 1020, 980, 940, 910, 880, 860, 950, 1000, 1020, 1050.0],
        "temp_seq": [26.0, 25.8, 25.5, 25.3, 25.0, 24.8, 24.6, 25.2, 26.5, 27.5, 28.2, 28.5, 28.4, 28.2, 28.0, 27.8, 27.5, 27.0, 26.8, 26.5, 26.2, 26.0, 25.8, 28.4],
        "zone_loads": {"hotel": 350.0, "office": 420.0, "podium": 200.0, "me_plant": 80.0}
    }
}

def get_appliance_breakdown(zone_power: float, hour: int, zone_type: str) -> dict:
    """
    Stage 2: Appliance-Level Disaggregation (Rule-Based Heuristic for Hackathon)
    According to physical building operating principles, secondarily disaggregates zone power into specific electrical equipment energy consumption.
    """
    if zone_type == "hotel":
        if 8 <= hour <= 18:
            hvac, light, plug = 0.55, 0.15, 0.30  # Daytime guest room occupancy is lower, plug loads (cleaning/services) increase
        else:
            hvac, light, plug = 0.70, 0.10, 0.20  # Nighttime rooms are fully loaded, HVAC share is extremely high
    elif zone_type == "office":
        if 8 <= hour <= 18:
            hvac, light, plug = 0.50, 0.20, 0.30  # Office hours: HVAC, lighting, and office computers fully running
        else:
            hvac, light, plug = 0.30, 0.10, 0.60  # After hours: mainly server/mains plug base loads
    elif zone_type == "podium":
        if 10 <= hour <= 22:
            hvac, light, plug = 0.60, 0.25, 0.15  # Mall business hours: high cooling and lighting demand
        else:
            hvac, light, plug = 0.40, 0.30, 0.30  # Post-closure: only security lighting and baseline circulation retained
    else:  # M&E Plant or Amenities
        hvac, light, plug = 0.85, 0.05, 0.10      # Mechanical & Electrical floors are predominantly power pumps and chillers

    return {
        "HVAC": round(zone_power * hvac, 1),
        "Lighting": round(zone_power * light, 1),
        "Plug_Loads": round(zone_power * plug, 1)
    }

def evaluate_weather_cross_verification(scenario_id: str, predictions: dict, outdoor_temp: float, hour: int):
    # Scenario 1: Hotel Damper Fault (Zone D)
    if scenario_id == "cool_night_gap":
        hotel_power = predictions['hotel']
        hotel_baseline = 330.0  
        deviation_pct = round(((hotel_power - hotel_baseline) / hotel_baseline) * 100.0, 1)
        return {
            "detected": True,
            "status_code": "EQUIPMENT_MALFUNCTION_GAP",
            "clause": "EE-1 / WE-1 / EQ-3",
            "clause_title": "Energy Efficiency & Night Damper Bypass",
            "attribution": "EQUIPMENT_FAULT",
            "anomaly_zone": "zone-d",
            "anomaly_floor": "L14",
            "zone_name": "Hyatt Hotel (L14–L28)",
            "measured_load": hotel_power,
            "baseline_load": hotel_baseline,
            "outdoor_temp": outdoor_temp,
            "deviation_pct": deviation_pct,
            "threshold_pct": 20.0,
            "severity": "CRITICAL",
            "explanation": f"Outdoor air is cool ({outdoor_temp}°C), yet Hotel Zone power remains extremely high at {hotel_power} kW (+{deviation_pct}% vs baseline). Disaggregation confirms anomalous cooling energy loss on Floor L14.",
            "action_recommendation": "Diagnosed mechanical fault: AHU fresh air damper actuator stuck open on Floor L14. Action: Dispatch MEP technician."
        }

    # Scenario 2: Office VAV Fault (Zone C)
    elif scenario_id == "office_vav_fault":
        office_power = predictions['office']
        office_baseline = 420.0
        deviation_pct = round(((office_power - office_baseline) / office_baseline) * 100.0, 1)
        return {
            "detected": True,
            "status_code": "EQUIPMENT_MALFUNCTION_GAP",
            "clause": "EE-2 / EQ-1",
            "clause_title": "Zonal Temperature Control & VAV Efficiency",
            "attribution": "EQUIPMENT_FAULT",
            "anomaly_zone": "zone-c",
            "anomaly_floor": "L8",
            "zone_name": "Offices (L4–L12)",
            "measured_load": office_power,
            "baseline_load": office_baseline,
            "outdoor_temp": outdoor_temp,
            "deviation_pct": deviation_pct,
            "threshold_pct": 15.0,
            "severity": "HIGH",
            "explanation": f"Office Zone power spiked to {office_power} kW (+{deviation_pct}% vs baseline) during peak hours. AI attributes the surge to excessive reheat logic triggered by a malfunctioning VAV terminal.",
            "action_recommendation": "Diagnosed mechanical fault: VAV Box damper stuck closed on Floor L8, forcing chiller compensation. Inspect VAV-8-04."
        }

    # Scenario 3: Podium Lighting Override (Zone B)
    elif scenario_id == "podium_lighting_fault":
        podium_power = predictions['podium']
        podium_baseline = 250.0
        deviation_pct = round(((podium_power - podium_baseline) / podium_baseline) * 100.0, 1)
        return {
            "detected": True,
            "status_code": "OPERATIONAL_WASTE",
            "clause": "EE-4",
            "clause_title": "Lighting Control System Bypass",
            "attribution": "HUMAN_OVERRIDE",
            "anomaly_zone": "zone-b",
            "anomaly_floor": "L2",
            "zone_name": "Podium (GF–L3)",
            "measured_load": podium_power,
            "baseline_load": podium_baseline,
            "outdoor_temp": outdoor_temp,
            "deviation_pct": deviation_pct,
            "threshold_pct": 10.0,
            "severity": "MEDIUM",
            "explanation": f"At {hour}:00, Podium power remains unusually high ({podium_power} kW, +{deviation_pct}% vs night baseline). Disaggregation identifies high static lighting base load after mall operating hours.",
            "action_recommendation": "Diagnosed operational error: Lighting contactor manually bypassed on Floor L2 Retail concourse. Reset BMS schedule."
        }

    # Scenario 4: Nominal Operation
    else:
        return {
            "detected": False,
            "status_code": "COMPLIANT",
            "clause": "EE-1",
            "clause_title": "Energy Efficiency Standard Met",
            "attribution": "NORMAL",
            "anomaly_zone": None,
            "anomaly_floor": None,
            "measured_load": 0,
            "baseline_load": 0,
            "outdoor_temp": outdoor_temp,
            "deviation_pct": 0,
            "severity": "NOMINAL",
            "explanation": f"Disaggregated loads conform to GreenRE EE-1 baseline bounds under {outdoor_temp}°C ambient conditions.",
            "action_recommendation": "All building zones operating in optimal energy envelope. Continuous NILM surveillance active."
        }


# -------------------------------------------------------------
# 3. FastAPI Application Setup & Lifecycle (Unified)
# -------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')
WEIGHTS_PATH = os.path.join(MODELS_DIR, 'ecopulse_nilm_weather_weights.pth')
META_PATH = os.path.join(MODELS_DIR, 'ecopulse_nilm_weather_meta.json')
nilm_engine = EcoPulseNILMWeatherEngine(WEIGHTS_PATH, META_PATH)

DATA_DIR = os.path.join(BASE_DIR, "data")
SENSOR_CSV_PATH = os.path.join(DATA_DIR, "ahu_fault_damper_stuck.csv")
MANUAL_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "manuals"))
CHROMA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "chroma_db"))

rag_mapper = None
cached_schema = None
streamer_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_mapper
    global streamer_process
    
    # 1. Database & Waste API Init
    try:
        Base.metadata.create_all(bind=engine)
        seed_physical_mapping()
        seed_tou_tariff()
        seed_demand_thresholds()
        print("[EMS] Schema v2.0 ready: zones, floors, meter_readings, tou_tariff_rates, alarms, control_audit_log")
    except Exception as error:
        print(f"[EMS] Database init skipped: {error}")

    def _load_rag():
        global rag_mapper
        try:
            rag_mapper = BmsRagMapper(MANUAL_PATH, persist_dir=CHROMA_DIR)
            print("[RAG] BMS mapper ready")
        except Exception as error:
            print(f"[RAG] skipped: {error}")

    threading.Thread(target=_load_rag, daemon=True).start()
    await waste_main.initialize_waste_api()

    # 2. Simulator Auto-Start
    project_root = os.path.dirname(BASE_DIR)
    streamer_path = os.path.join(project_root, "simulators", "bdg2_streamer.py")
    
    if os.path.exists(streamer_path):
        print(f"🚀 [Auto-Start] Launching BDG2 simulator alongside the backend...")
        streamer_process = subprocess.Popen([sys.executable, streamer_path, "--interval", "5.0"])
        print(f"✅ BDG2 Streamer running (PID: {streamer_process.pid})")
    else:
        print(f"⚠️ Simulator script not found: {streamer_path}")

    yield

    # 3. Simulator Auto-Stop
    if streamer_process:
        print("🛑 [Auto-Stop] Backend shutdown detected, terminating BDG2 simulator...")
        streamer_process.terminate()
        streamer_process.wait()
        print("✅ BDG2 Streamer shut down safely.")


# >>> THIS IS THE ONLY FastAPI INSTANCE IN THE FILE <<<
app = FastAPI(
    title="GreenRE EcoPulse NILM Gateway",
    description="2-Channel 1D-CNN Energy Disaggregation & Weather Cross-Verification Rule Engine",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/v1/uploads", StaticFiles(directory=waste_main.settings.upload_dir), name="uploads")

# Attach all routes to the single app instance
app.include_router(ems_router)
app.include_router(waste_auth_router)
app.include_router(waste_detect_router)
app.include_router(waste_scans_router)
app.include_router(waste_analytics_router)
app.include_router(waste_config_router)
app.include_router(waste_actions_router)
app.include_router(waste_greenre_router)
app.include_router(waste_collections_router)
app.include_router(water_router)


# -------------------------------------------------------------
# 4. REST Endpoints & Request Models
# -------------------------------------------------------------
class DisaggregationRequest(BaseModel):
    power_sequence: Optional[List[float]] = Field(None, description="24h main utility meter sequence")
    temp_sequence: Optional[List[float]] = Field(None, description="24h outdoor air temperature sequence")
    scenario: Optional[str] = Field("cool_night_gap", description="Scenario key")
    hour: Optional[int] = Field(3, description="Hour (0-23)")

# Store currently selected time machine state
CURRENT_STATE = {
    "scenario_id": "cool_night_gap",
    "temperature": 24.5,
    "humidity": 82.0,
    "emoji": "🌙",
    "hour": 3,
    "timestamp": "2016-03-15 03:00:00"
}

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "EcoPulse GreenRE 2-Channel NILM Gateway",
        "model_architecture": "EcoPulseNILM_Weather (2-Channel 1D-CNN)",
        "input_channels": ["Channel 0: Total_Building_Power", "Channel 1: airTemperature"],
        "model_loaded": nilm_engine.loaded,
        "weights_path": WEIGHTS_PATH,
        "time_machine_scenarios": list(TIME_MACHINE_SCENARIOS.keys())
    }

@app.get("/health")
def combined_health_check():
    from app.services.detector import get_model_names
    return {
        "status": "healthy",
        "ems_status": "online",
        "waste_model_loaded": len(get_model_names()) > 0,
        "waste_model_classes": len(get_model_names()),
        "waste_demo_mode": waste_main.settings.demo_mode,
    }

@app.get("/api/v1/category-info")
def get_category_info():
    from app.services.categorizer import CATEGORY_INFO
    return CATEGORY_INFO

# -------------------------------------------------------------
# [UPDATED] Live Event-Driven Diagnostic Endpoint
# -------------------------------------------------------------
class RagQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Technical question regarding equipment or fault manuals")
    floor: Optional[str] = Field("L14", description="Building floor ID, e.g. L14")

@app.get("/api/bms/telemetry")
def get_bms_telemetry(
    floor: str = Query(..., min_length=1, description="Building floor, for example L14"),
    timestamp: str = Query("2016-03-15T03:00:00"),
    db: Session = Depends(get_db)
):
    if rag_mapper is None:
        import time
        for _ in range(30):
            if rag_mapper is not None:
                break
            time.sleep(0.1)

    if rag_mapper is None:
        raise HTTPException(
            status_code=503, 
            detail="BMS RAG engine is initializing. Please retry in a few seconds."
        )
        
    f_upper = floor.upper()
    if f_upper in ["L14", "L15", "L16", "L17", "L18", "L19", "L20", "L21", "L22", "L23", "L24", "L25", "L26", "L27", "L28"]:
        zone_code = "zone-d"
    elif f_upper in ["L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12", "L13"]:
        zone_code = "zone-c"
    elif f_upper in ["GF", "L1", "L2", "L3"]:
        zone_code = "zone-b"
    elif f_upper in ["B2", "B1", "LG"]:
        zone_code = "zone-a"
    elif f_upper in ["L29", "L30", "L31"]:
        zone_code = "zone-e"
    else:
        zone_code = "zone-d" if f_upper == "L14" else "zone-c"

    try:
        # 1. Assemble real-time diagnostic context with asset topology
        outdoor_temp = CURRENT_STATE["temperature"]
        deviation_pct = 61.5 # (后续可以替换为从当前 zone 提取的真实负荷偏差)
        
        diagnostic_payload = build_diagnostic_context(
            db=db, 
            zone_code=zone_code, 
            deviation_pct=deviation_pct, 
            outdoor_temp=outdoor_temp
        )

        # 2. Trigger next-generation object-based dynamic RAG diagnostics
        diagnostic_result = rag_mapper.diagnose_live_telemetry(diagnostic_payload)

        hours = [f"{h:02d}:00" for h in range(24)]
        if f_upper.startswith("L1") or f_upper.startswith("L2"):
            # Hotel zone: Damper stuck open at ~90% even at night, fan running high
            telemetry_series = [
                {"time": h, "damper_pct": 89 + (int(h[:2]) % 3), "fan_rpm": 1420 + (int(h[:2]) % 5) * 12}
                for h in hours
            ]
        elif f_upper in ["L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12", "L13"]:
            # Office zone: VAV damper hunting / oscillating
            telemetry_series = [
                {"time": h, "damper_pct": 35 + (int(h[:2]) % 6) * 10, "fan_rpm": 1050 + (int(h[:2]) % 7) * 45}
                for h in hours
            ]
        else:
            # Podium / other zone
            telemetry_series = [
                {"time": h, "damper_pct": 20 if int(h[:2]) < 7 or int(h[:2]) > 21 else 65, "fan_rpm": 850 if int(h[:2]) < 7 or int(h[:2]) > 21 else 1250}
                for h in hours
            ]

        if f_upper.startswith("L1") or f_upper.startswith("L2"):
            equipment_breakdown = [
                {"name": f"AHU-{f_upper.replace('L', '')}A Supply Fan & Cooling", "value": 64},
                {"name": "Guest Room FCU Terminal Units", "value": 21},
                {"name": "Corridor & Public Lighting", "value": 10},
                {"name": "Emergency & Misc Receptacles", "value": 5}
            ]
        elif f_upper in ["L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12", "L13"]:
            equipment_breakdown = [
                {"name": f"VAV-AHU-{f_upper.replace('L', '')} Distribution", "value": 48},
                {"name": "Tenant Workstation Plug Loads", "value": 28},
                {"name": "Core Office LED Lighting", "value": 16},
                {"name": "IDF Telecom Closet", "value": 8}
            ]
        else:
            equipment_breakdown = [
                {"name": "Podium Retail & Concourse Lighting", "value": 52},
                {"name": "Escalator & Conveyance Motors", "value": 24},
                {"name": "Central Ventilation Fans", "value": 18},
                {"name": "Facilities Misc", "value": 6}
            ]

        return {
            "floor": floor.upper(),
            "target_asset": diagnostic_result["target_asset"],
            "status": "Fault Detected" if diagnostic_result["severity"] in ["CRITICAL", "HIGH"] else "Nominal",
            "audit_timestamp": timestamp,
            "ai_diagnosis": diagnostic_result["diagnosis"],
            "severity": diagnostic_result["severity"],
            "confidence": diagnostic_result["confidence"],
            "recommended_checks": diagnostic_result["recommended_checks"],
            "citations": diagnostic_result["citations"],
            "llm_provider": diagnostic_result["llm_provider"],
            "data_quality_context": diagnostic_payload.telemetry.data_quality,
            "telemetry_series": telemetry_series,
            "equipment_breakdown": equipment_breakdown
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Live Diagnostic Integration Error: {error}") from error


@app.post("/api/rag/query")
@app.post("/api/v1/rag/query")
def query_rag_manual(req: RagQueryRequest):
    if rag_mapper is None:
        raise HTTPException(status_code=503, detail="RAG engine is initializing. Please retry in a few seconds.")
    return rag_mapper.answer_manual_query(req.question, floor=req.floor)

@app.get("/api/rag/status")
@app.get("/api/v1/rag/status")
def get_rag_status():
    from llm_client import llm_client
    info = llm_client.get_active_provider_info()
    return {
        "rag_ready": rag_mapper is not None,
        "llm_provider": info["active_provider"],
        "provider_details": info,
    }

@app.get("/api/time-machine/scenarios")
def get_time_machine_scenarios():
    return {
        "status": "success",
        "scenarios": [
            {
                "id": s["id"],
                "title": s["title"],
                "timestamp": s["timestamp"],
                "outdoor_temp": s["outdoor_temperature"],
                "humidity": s["relative_humidity"],
                "emoji": s["weather_emoji"],
                "description": s["weather_condition"]
            }
            for s in TIME_MACHINE_SCENARIOS.values()
        ]
    }

@app.get("/api/nilm/latest")
def get_latest_inference(
    scenario: str = Query("cool_night_gap", description="Time Machine Scenario"),
    hour: Optional[int] = Query(None, description="Evaluation Hour (0-23)"),
    temp_override: Optional[float] = Query(None, description="Manual outdoor temperature override for XAI testing")
):
    sc = TIME_MACHINE_SCENARIOS.get(scenario, TIME_MACHINE_SCENARIOS["cool_night_gap"])
    eval_hour = hour if hour is not None else sc["hour"]
    outdoor_temp = temp_override if temp_override is not None else sc["outdoor_temperature"]
    rh = sc["relative_humidity"]

    CURRENT_STATE["scenario_id"] = sc["id"]
    CURRENT_STATE["temperature"] = outdoor_temp
    CURRENT_STATE["humidity"] = rh
    CURRENT_STATE["emoji"] = sc["weather_emoji"]
    CURRENT_STATE["hour"] = eval_hour
    CURRENT_STATE["timestamp"] = sc["timestamp"]

    power_seq = sc["power_seq"]
    temp_seq = sc["temp_seq"]
    predictions = nilm_engine.predict_2channel(power_seq, temp_seq)

    main_meter_kw = float(power_seq[-1])
    disagg_sum = sum(predictions.values())
    amenities_kw = round(max(main_meter_kw - disagg_sum, 0.0), 1)

    compliance = evaluate_weather_cross_verification(
        scenario_id=sc["id"],
        predictions=predictions,
        outdoor_temp=outdoor_temp,
        hour=eval_hour
    )

    total_meter = round(disagg_sum + amenities_kw, 1)
    disaggregated_loads = {
        "office": predictions["office"],
        "hotel": predictions["hotel"],
        "podium": predictions["podium"],
        "me_plant": predictions["me_plant"],
        "amenities": amenities_kw,
    }

    return {
        "status": "success",
        "scenario": sc["id"],
        "scenario_title": sc["title"],
        "timestamp": sc["timestamp"],
        "evaluated_hour": eval_hour,
        "meteorological_data": {
            "outdoor_temperature": outdoor_temp,
            "relative_humidity": rh,
            "weather_emoji": sc["weather_emoji"],
            "condition": sc["weather_condition"]
        },
        "total_building_power": total_meter,
        "total_main_meter_kw": total_meter,
        "disaggregated_loads": disaggregated_loads,
        "zones": {
            "zone-a": {
                "id": "zone-a",
                "name": "M&E Plant",
                "floors": "B2–LG",
                "energy": f"{predictions['me_plant']:.1f} kW",
                "value": predictions['me_plant'],
                "status": "ok",
                "appliances": get_appliance_breakdown(predictions['me_plant'], eval_hour, "me_plant")
            },
            "zone-b": {
                "id": "zone-b",
                "name": "Podium",
                "floors": "GF–L3",
                "energy": f"{predictions['podium']:.1f} kW",
                "value": predictions['podium'],
                "status": "warn" if compliance.get("detected") and compliance.get("anomaly_zone") == "zone-b" else "ok",
                "appliances": get_appliance_breakdown(predictions['podium'], eval_hour, "podium")
            },
            "zone-c": {
                "id": "zone-c",
                "name": "Offices",
                "floors": "L4–L12",
                "energy": f"{predictions['office']:.1f} kW",
                "value": predictions['office'],
                "status": "warn" if compliance.get("detected") and compliance.get("anomaly_zone") == "zone-c" else "ok",
                "appliances": get_appliance_breakdown(predictions['office'], eval_hour, "office")
            },
            "zone-d": {
                "id": "zone-d",
                "name": "Hyatt Hotel",
                "floors": "L14–L28",
                "energy": f"{predictions['hotel']:.1f} kW",
                "value": predictions['hotel'],
                "status": "warn" if compliance.get("detected") and compliance.get("anomaly_zone") == "zone-d" else "ok",
                "appliances": get_appliance_breakdown(predictions['hotel'], eval_hour, "hotel")
            },
            "zone-e": {
                "id": "zone-e",
                "name": "Amenities",
                "floors": "L29–L31",
                "energy": f"{amenities_kw:.1f} kW",
                "value": amenities_kw,
                "status": "ok",
                "appliances": get_appliance_breakdown(amenities_kw, eval_hour, "amenities")
            }
        },
        "compliance_gap": compliance
    }

@app.post("/api/nilm/disaggregate")
def disaggregate_power(req: DisaggregationRequest):
    scenario = req.scenario or "cool_night_gap"
    return get_latest_inference(scenario=scenario, hour=req.hour)

@app.get("/api/weather")
def get_live_weather():
    temp = CURRENT_STATE["temperature"]
    rh = CURRENT_STATE["humidity"]
    emoji = CURRENT_STATE["emoji"]
    
    forecast = []
    base_hour = CURRENT_STATE["hour"]
    for offset in range(1, 13):
        h = (base_hour + offset) % 24
        ampm = "AM" if h < 12 else "PM"
        hour_label = f"{(h % 12) or 12} {ampm}"
        t_fluct = temp + (3.5 if 10 <= h <= 16 else -1.5)
        em = "☀️" if 8 <= h <= 17 else ("⛅" if 18 <= h <= 20 else "🌙")
        forecast.append({
            "time": hour_label,
            "temp": int(round(t_fluct)),
            "emoji": em,
            "rainProb": 15 if h > 14 else 5
        })

    return {
        "status": "success",
        "temperature": temp,
        "humidity": int(round(rh)),
        "emoji": emoji,
        "scenario": CURRENT_STATE["scenario_id"],
        "timestamp": CURRENT_STATE["timestamp"],
        "location": "The Light City, Penang (BDG2 Historical Station)",
        "forecast": forecast
    }

@app.post("/api/ai/recommend")
def get_recommendation(payload: dict):
    zone_id = payload.get("zoneId", "zone-d")
    return {
        "status": "success",
        "zoneId": zone_id,
        "recommendation": (
            "Directive Dispatched: Technician deployed to Floor L14 Hyatt Hotel. "
            "AHU motorized damper actuator reset sequence initiated via BMS BACnet protocol. "
            "Chilled water valve travel limit set to 25% night cap."
        ),
        "target_floor": "L14",
        "action_taken": "Teams Notification Sent to Facility Operations"
    }
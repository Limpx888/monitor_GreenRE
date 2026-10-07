import time
import json
import random
import requests
from datetime import datetime, timedelta

# Backend API endpoint
API_URL = "http://localhost:5000/api/telemetry"

def generate_simulated_data(anomaly=False):
    """
    Generates realistic simulated data for a commercial building.
    Includes EE (Energy), WE (Water), and IEQ metrics.
    """
    now = datetime.now()
    hour = now.hour
    
    # 1. EE (Energy & NILM)
    # Simulate a main meter, then disaggregate (NILM concept)
    base_load = 50.0  # Base load in kW
    
    # Higher load during office hours (8 AM - 6 PM)
    is_office_hours = 8 <= hour <= 18
    occupancy_multiplier = 3.5 if is_office_hours else 1.0
    
    hvac_kw = (base_load * 0.5) * occupancy_multiplier + random.uniform(-5, 5)
    lighting_kw = (base_load * 0.3) * occupancy_multiplier + random.uniform(-2, 2)
    plugs_kw = (base_load * 0.2) * occupancy_multiplier + random.uniform(-1, 1)
    
    # Total energy is the sum
    total_energy_kw = hvac_kw + lighting_kw + plugs_kw
    
    # Chiller efficiency (kW/RT) - standard is ~0.6-0.8. Lower is better.
    chiller_efficiency = random.uniform(0.65, 0.85)

    # 2. WE (Water Efficiency)
    # Normal baseline drops to near 0 overnight.
    # Anomaly: Flow doesn't drop to zero (e.g. 50 LPM overnight) indicating a leak.
    if anomaly:
        water_flow_lpm = 50.0 + random.uniform(-5, 5) # Constant leak
    else:
        water_flow_lpm = (100.0 * occupancy_multiplier) + random.uniform(-10, 10)
        if not is_office_hours:
            water_flow_lpm = max(0, random.uniform(0, 5)) # Close to zero at night

    # 3. IEQ (Indoor Environmental Quality)
    temp_c = 24.0 + random.uniform(-1.0, 1.0)
    humidity_percent = 55.0 + random.uniform(-5.0, 5.0)
    
    # CO2 rises during office hours
    co2_ppm = 400 + (random.uniform(200, 400) if is_office_hours else random.uniform(0, 50))
    
    # PM2.5 generally stable, minor fluctuations
    pm25_ug = random.uniform(5, 15)

    payload = {
        "timestamp": now.isoformat(),
        "building": "The Light City - Tower A",
        "readings": {
            "energy_main_kw": round(total_energy_kw, 2),
            "energy_hvac_kw": round(hvac_kw, 2),
            "energy_lighting_kw": round(lighting_kw, 2),
            "energy_plugs_kw": round(plugs_kw, 2),
            "chiller_efficiency_kw_rt": round(chiller_efficiency, 2),
            "water_flow_lpm": round(water_flow_lpm, 2),
            "ieq_temp_c": round(temp_c, 2),
            "ieq_humidity": round(humidity_percent, 2),
            "ieq_co2_ppm": round(co2_ppm, 2),
            "ieq_pm25": round(pm25_ug, 2)
        },
        "flags": {
            "is_anomaly": anomaly
        }
    }
    
    return payload

def run_simulation(duration_minutes=5, interval_seconds=5):
    print("🚀 Starting Continuous Compliance Telemetry Simulator...")
    print(f"Sending data to {API_URL} every {interval_seconds} seconds.")
    
    end_time = datetime.now() + timedelta(minutes=duration_minutes)
    
    # Simulate a water leak anomaly midway through
    anomaly_trigger_time = datetime.now() + timedelta(minutes=(duration_minutes/2))
    
    while datetime.now() < end_time:
        is_anomaly = datetime.now() > anomaly_trigger_time
        
        data = generate_simulated_data(anomaly=is_anomaly)
        
        try:
            # Post to our Express backend (mocking IoT Hub/Fabric Eventhouse ingestion)
            response = requests.post(API_URL, json=data, timeout=5)
            
            status = "⚠️ ANOMALY (LEAK)" if is_anomaly else "✅ NORMAL"
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {status} - Total kW: {data['readings']['energy_main_kw']} | Water: {data['readings']['water_flow_lpm']} LPM -> Server: {response.status_code}")
            
        except Exception as e:
            print(f"Failed to send telemetry: {e}")
            
        time.sleep(interval_seconds)
        
    print("🛑 Simulation complete.")

if __name__ == "__main__":
    # Run the continuous simulator for 5 minutes (sends a burst every 5 seconds)
    run_simulation(duration_minutes=5, interval_seconds=5)

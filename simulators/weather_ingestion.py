import requests
import json
import time
from datetime import datetime

# Penang coordinates
LAT = 5.37
LON = 100.32

# Timezone matching your meter data
TIMEZONE = "Asia/Kuala_Lumpur"

def get_current_weather():
    """Fetches the current weather."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code",
        "timezone": TIMEZONE,
    }
    
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        c = r.json().get("current", {})
        
        weather_data = {
            "time": c.get("time"),
            "outdoor_temp": c.get("temperature_2m"),
            "humidity": c.get("relative_humidity_2m"),
            "rain_mm": c.get("rain"),
            "raining": c.get("rain", 0) > 0,
            "weather_code": c.get("weather_code")
        }
        return weather_data
    except Exception as e:
        print(f"Failed to fetch current weather: {e}")
        return None

def get_hourly_forecast():
    """Fetches the hourly forecast for the next 48 hours."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation",
        "forecast_days": 2,
        "timezone": TIMEZONE,
    }
    
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return r.json().get("hourly", {})
    except Exception as e:
        print(f"Failed to fetch forecast: {e}")
        return None

def get_historical_weather(start_date, end_date):
    """Fetches historical weather for baseline model training."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": TIMEZONE,
    }
    
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return r.json().get("hourly", {})
    except Exception as e:
        print(f"Failed to fetch historical weather: {e}")
        return None

if __name__ == "__main__":
    print("🌤️  Fetching Current Weather...")
    current = get_current_weather()
    print(json.dumps(current, indent=2))
    
    print("\n📅  Fetching Hourly Forecast (next 48h)...")
    forecast = get_hourly_forecast()
    if forecast:
        # Just print the first 5 hours
        print(f"First 5 hours of forecast starting at {forecast['time'][0]}:")
        for i in range(5):
            print(f"{forecast['time'][i]}: {forecast['temperature_2m'][i]}°C, {forecast['precipitation_probability'][i]}% rain")
    
    # In a Fabric notebook, you would typically write these results into a Lakehouse table:
    # df = spark.createDataFrame([current])
    # df.write.mode("append").saveAsTable("lakehouse.weather_telemetry")
    print("\n✅ Weather pipeline test completed. Ready to deploy to Fabric!")

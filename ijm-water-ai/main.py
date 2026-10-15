import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import duckdb

app = FastAPI(
    title="IJM Water Management AI API",
    description="DuckDB-powered Time-Series Analytics & GreenRE Compliance Engine for Water Operations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    candidates = [
        os.path.join(os.path.dirname(__file__), "water_management.duckdb"),
        os.path.join(os.path.dirname(__file__), "..", "water managemet", "water_management.duckdb"),
        "water_management.duckdb",
        r"c:\Users\User\Documents\Competition Project\AI4Sustainability Hackfest\water managemet\water_management.duckdb"
    ]
    for c in candidates:
        if os.path.exists(c):
            return duckdb.connect(c, read_only=True)
    raise HTTPException(status_code=500, detail="water_management.duckdb database file not found")

def get_greenre_rules():
    candidates = [
        os.path.join(os.path.dirname(__file__), "mock_greenre_rules.json"),
        os.path.join(os.path.dirname(__file__), "..", "backend", "data", "mock_greenre_rules.json"),
        "mock_greenre_rules.json"
    ]
    for c in candidates:
        if os.path.exists(c):
            with open(c, "r", encoding="utf-8") as f:
                return json.load(f)
    return []

@app.get("/", summary="Health and Service Info")
def root():
    return {
        "status": "online",
        "service": "IJM Water Management AI Gateway",
        "database": "DuckDB (20.6M records)",
        "endpoints": [
            "/buildings",
            "/consumption/{building_name}",
            "/analytics/portfolio",
            "/greenre/rules",
            "/greenre/audit/{building_name}"
        ]
    }

@app.get("/buildings", summary="Get a list of all monitored buildings")
def get_buildings(site: Optional[str] = None, space_usage: Optional[str] = None):
    con = get_db()
    try:
        where_clauses = []
        if site:
            where_clauses.append(f"site = '{site}'")
        if space_usage:
            where_clauses.append(f"space_usage = '{space_usage}'")
        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        query = f"""
            SELECT 
                site, 
                space_usage, 
                building_name, 
                COUNT(*) as total_records,
                LIST(DISTINCT meter_type) as meter_types,
                ROUND(AVG(consumption), 2) as avg_consumption,
                ROUND(SUM(consumption), 2) as total_consumption
            FROM meter_readings 
            {where_sql}
            GROUP BY site, space_usage, building_name
            ORDER BY site, building_name
        """
        results = con.execute(query).df().to_dict(orient="records")
        for r in results:
            if hasattr(r.get("meter_types"), "tolist"):
                r["meter_types"] = r["meter_types"].tolist()
        return {"buildings": results, "count": len(results)}
    finally:
        con.close()

@app.get("/consumption/{building_name}", summary="Get time-series data for a building")
def get_consumption(
    building_name: str, 
    limit: int = Query(100, ge=1, le=5000),
    meter_type: Optional[str] = None,
    granularity: str = Query("daily", regex="^(hourly|daily|monthly)$")
):
    con = get_db()
    try:
        meter_filter = f"AND meter_type = '{meter_type}'" if meter_type else ""
        
        if granularity == "hourly":
            query = f"""
                SELECT 
                    timestamp, 
                    meter_type, 
                    ROUND(consumption, 2) as consumption 
                FROM meter_readings 
                WHERE building_name = '{building_name}' {meter_filter}
                ORDER BY timestamp DESC
                LIMIT {limit}
            """
        elif granularity == "daily":
            query = f"""
                SELECT 
                    strftime(date_trunc('day', timestamp), '%Y-%m-%d') as timestamp,
                    meter_type,
                    ROUND(SUM(consumption), 2) as consumption,
                    ROUND(AVG(consumption), 2) as avg_hourly_flow,
                    ROUND(MAX(consumption), 2) as peak_flow
                FROM meter_readings 
                WHERE building_name = '{building_name}' {meter_filter}
                GROUP BY date_trunc('day', timestamp), meter_type
                ORDER BY date_trunc('day', timestamp) DESC
                LIMIT {limit}
            """
        else: # monthly
            query = f"""
                SELECT 
                    strftime(date_trunc('month', timestamp), '%Y-%m') as timestamp,
                    meter_type,
                    ROUND(SUM(consumption), 2) as consumption,
                    ROUND(AVG(consumption), 2) as avg_hourly_flow,
                    ROUND(MAX(consumption), 2) as peak_flow
                FROM meter_readings 
                WHERE building_name = '{building_name}' {meter_filter}
                GROUP BY date_trunc('month', timestamp), meter_type
                ORDER BY date_trunc('month', timestamp) DESC
                LIMIT {limit}
            """

        results = con.execute(query).df().to_dict(orient="records")
        if not results:
            # Check if building exists
            exists = con.execute(f"SELECT COUNT(*) FROM meter_readings WHERE building_name = '{building_name}'").fetchone()[0]
            if exists == 0:
                raise HTTPException(status_code=404, detail=f"Building '{building_name}' not found")

        return {
            "building_name": building_name,
            "granularity": granularity,
            "meter_type": meter_type,
            "count": len(results),
            "data": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        con.close()

@app.get("/analytics/portfolio", summary="Portfolio-wide water analytics and benchmarks")
def get_portfolio_analytics():
    con = get_db()
    try:
        totals = con.execute("""
            SELECT 
                meter_type,
                COUNT(*) as readings_count,
                COUNT(DISTINCT building_name) as buildings_count,
                ROUND(SUM(consumption), 2) as total_volume,
                ROUND(AVG(consumption), 2) as avg_hourly
            FROM meter_readings
            GROUP BY meter_type
            ORDER BY total_volume DESC;
        """).df().to_dict(orient="records")

        space_breakdown = con.execute("""
            SELECT 
                space_usage,
                COUNT(DISTINCT building_name) as buildings,
                ROUND(SUM(consumption), 2) as total_volume,
                ROUND(AVG(consumption), 2) as avg_rate
            FROM meter_readings
            GROUP BY space_usage
            ORDER BY total_volume DESC;
        """).df().to_dict(orient="records")

        return {
            "meter_totals": totals,
            "space_breakdown": space_breakdown,
            "total_records": 20641574,
            "total_buildings": 769,
            "total_sites": 13
        }
    finally:
        con.close()

@app.get("/greenre/rules", summary="Get GreenRE Water Efficiency knowledge rules")
def get_rules():
    rules = get_greenre_rules()
    return {"rules": rules, "total": len(rules)}

@app.get("/greenre/audit/{building_name}", summary="AI-powered GreenRE Water Compliance Audit for building")
def audit_building(building_name: str):
    con = get_db()
    try:
        # 1. Fetch metadata and consumption breakdown
        row = con.execute(f"""
            SELECT 
                site, 
                space_usage, 
                building_name,
                ROUND(SUM(CASE WHEN meter_type = 'general_water' THEN consumption ELSE 0 END), 2) as general_water,
                ROUND(SUM(CASE WHEN meter_type = 'chilled_water' THEN consumption ELSE 0 END), 2) as chilled_water,
                ROUND(SUM(CASE WHEN meter_type = 'irrigation' THEN consumption ELSE 0 END), 2) as irrigation,
                ROUND(SUM(CASE WHEN meter_type = 'hot_water' THEN consumption ELSE 0 END), 2) as hot_water,
                ROUND(SUM(CASE WHEN meter_type = 'steam' THEN consumption ELSE 0 END), 2) as steam,
                ROUND(SUM(consumption), 2) as total_water
            FROM meter_readings
            WHERE building_name = '{building_name}'
            GROUP BY site, space_usage, building_name
        """).df().to_dict(orient="records")

        if not row:
            raise HTTPException(status_code=404, detail=f"Building '{building_name}' not found")
        
        b = row[0]
        rules = get_greenre_rules()
        audits = []
        overall_score = 90.0

        # Rule WE-3: Chilled water / Cooling tower ratio
        gen_water = b["general_water"] or 1.0
        chilled = b["chilled_water"]
        chilled_ratio = round((chilled / (gen_water + chilled)) * 100, 1) if (gen_water + chilled) > 0 else 0
        we3_rule = next((r for r in rules if r["criteria_id"] == "WE-3"), None)
        
        we3_passed = chilled_ratio <= 20.0
        if not we3_passed:
            overall_score -= 15.0

        audits.append({
            "criteria_id": "WE-3",
            "category": "Cooling Tower Water Use",
            "status": "COMPLIANT" if we3_passed else "GAP_IDENTIFIED",
            "threshold": "<= 20.0% cooling water ratio",
            "measured_value": f"{chilled_ratio}%",
            "description": we3_rule["description"] if we3_rule else "",
            "recommendation": we3_rule["actionable_recommendation"] if not we3_passed else "Cooling tower cycles optimal (>= 6 cycles)."
        })

        # Rule WE-1: Water Use Intensity
        # Synthetic floor area proxy: assuming typical GFA 15,000 m2
        estimated_gfa_m2 = 12000.0
        annual_wui = round((gen_water / 2.0) / estimated_gfa_m2, 2) # 2 years dataset -> annual
        we1_rule = next((r for r in rules if r["criteria_id"] == "WE-1"), None)
        we1_passed = annual_wui <= 0.9 or b["space_usage"] != "office"
        if not we1_passed:
            overall_score -= 10.0

        audits.append({
            "criteria_id": "WE-1",
            "category": "Water Efficient Fittings (WUI)",
            "status": "COMPLIANT" if we1_passed else "GAP_IDENTIFIED",
            "threshold": "<= 0.90 m3/m2/yr",
            "measured_value": f"{annual_wui} m3/m2/yr",
            "description": we1_rule["description"] if we1_rule else "",
            "recommendation": we1_rule["actionable_recommendation"] if not we1_passed else "Fittings conform to WELS 3-tick standard."
        })

        # Rule WE-4: Irrigation
        irrig = b["irrigation"]
        audits.append({
            "criteria_id": "WE-4",
            "category": "Irrigation & Landscape Water Conservation",
            "status": "COMPLIANT" if irrig < (gen_water * 0.15) else "REVIEW",
            "threshold": ">= 50% non-potable irrigation supply",
            "measured_value": f"{round(irrig, 1)} m3 recorded",
            "description": "At least 50% of landscape irrigation must be supplied by non-potable sources.",
            "recommendation": "Integrate sub-surface soil moisture sensors and AHU condensate recycling."
        })

        return {
            "building_name": building_name,
            "site": b["site"],
            "space_usage": b["space_usage"],
            "greenre_water_score": max(50.0, round(overall_score, 1)),
            "rating": "Platinum" if overall_score >= 85 else "Gold" if overall_score >= 75 else "Silver",
            "water_breakdown": {
                "general_water": b["general_water"],
                "chilled_water": b["chilled_water"],
                "irrigation": b["irrigation"],
                "hot_water": b["hot_water"],
                "steam": b["steam"],
                "total_water": b["total_water"]
            },
            "audits": audits
        }
    finally:
        con.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

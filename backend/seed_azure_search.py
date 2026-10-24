import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv(".env")
search_ep = os.getenv("AZURE_SEARCH_ENDPOINT", "").strip().strip('"').rstrip("/")
search_key = os.getenv("AZURE_SEARCH_API_KEY", "").strip().strip('"')
search_index = os.getenv("AZURE_SEARCH_INDEX", "").strip().strip('"')

url = f"{search_ep}/indexes/{search_index}/docs/index?api-version=2024-07-01"
headers = {"api-key": search_key, "Content-Type": "application/json"}

# Key GreenRE compliance standards & LBNL fault reference clauses
documents = [
    {
        "@search.action": "mergeOrUpload",
        "id": "greenre-we-1-1",
        "chunk_id": "chunk-we1-1",
        "filepath": "manuals/NRB_v4.0.pdf#page=28",
        "content": (
            "GreenRE Non-Residential v4.0 Standard - Part 2 Water Efficiency (WE 1-1: Water Consumption & Leakage Detection Monitoring): "
            "Mandatory requirement to provide sub-metering linked to Building Management System (BMS) for major water uses. "
            "Continuous automated monitoring must trigger leak alerts during non-occupancy hours (overnight baseline threshold 5 LPM). "
            "Failure to isolate leaks within 2 hours results in 4 credit point penalties under Section 2."
        )
    },
    {
        "@search.action": "mergeOrUpload",
        "id": "greenre-ee-1-1",
        "chunk_id": "chunk-ee1-1",
        "filepath": "manuals/NRB_v4.0.pdf#page=14",
        "content": (
            "GreenRE Non-Residential v4.0 Standard - Part 1 Energy Efficiency (EE 1-1: Minimum Energy Efficiency & Building Energy Intensity): "
            "All commercial non-residential developments must attain baseline BEI <= 150 kWh/m2/yr. "
            "AHU and VAV fan systems must be equipped with automated night setback schedules. Chilled water valves must maintain tight shutoff "
            "during unoccupied hours to prevent unnecessary chiller plant lift."
        )
    },
    {
        "@search.action": "mergeOrUpload",
        "id": "lbnl-fdd-ahu-04",
        "chunk_id": "chunk-fdd4",
        "filepath": "manuals/LBNLDataSynthesisInventory.pdf#page=114",
        "content": (
            "LBNL BMS Fault Detection & Diagnostics Handbook - Rule FDD-AHU-04 (Damper Hunting and Actuator Binding): "
            "When the fresh air damper position feedback indicates 100% open while outdoor enthalpy is unfavourable or building is in "
            "unoccupied mode, verify 0-10V analog command signal. Execute BACnet command to reset actuator stroke and enforce 25% safety cap."
        )
    }
]

payload = {"value": documents}
r = httpx.post(url, headers=headers, json=payload)
print("Index upload status:", r.status_code)
print("Response:", r.text)

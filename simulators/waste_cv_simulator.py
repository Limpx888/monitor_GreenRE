import time
import json
import random
import math
from datetime import datetime

# Backend API endpoint (if you want to push to your Node backend)
API_URL = "http://localhost:5000/api/telemetry"

# Known approximate base volumes per item type (in Liters)
# This simulates the "image-based size estimation and geometric calculations"
ITEM_PROPERTIES = {
    "plastic_bottle": {"type": "recyclable", "base_volume": 0.5},   # e.g., 500ml bottle
    "can": {"type": "recyclable", "base_volume": 0.33},            # e.g., 330ml can
    "cardboard_box": {"type": "recyclable", "base_volume": 5.0},    # e.g., small parcel
    "food_waste": {"type": "general", "base_volume": 1.0},         # generic mass
    "other_waste": {"type": "general", "base_volume": 2.0}         # generic mass
}

def simulate_yolo_detections():
    """
    Simulates a YOLOv8 object detection pass over a smart bin camera feed.
    Returns a list of detected objects with simulated bounding box areas 
    to estimate real-world volume.
    """
    detected_items = []
    
    # Randomly detect between 5 to 20 items in a given frame
    num_items = random.randint(5, 20)
    item_classes = list(ITEM_PROPERTIES.keys())
    
    for _ in range(num_items):
        item_class = random.choice(item_classes)
        
        # Simulate depth/geometric scaling variation (e.g. crushed box vs intact)
        # 1.0 means intact, smaller means crushed/compacted
        compaction_factor = random.uniform(0.3, 1.2) 
        
        calculated_volume = ITEM_PROPERTIES[item_class]["base_volume"] * compaction_factor
        
        detected_items.append({
            "class": item_class,
            "category": ITEM_PROPERTIES[item_class]["type"],
            "estimated_volume_L": round(calculated_volume, 2)
        })
        
    return detected_items

def calculate_waste_ratio(detections):
    """
    Processes the YOLO detections and applies mathematical calculations
    to find the volume ratio of Recyclable vs General waste.
    """
    summary = {
        "total_volume_L": 0.0,
        "recyclable_volume_L": 0.0,
        "general_volume_L": 0.0,
        "breakdown": {}
    }
    
    # 1. Aggregate volumes
    for item in detections:
        vol = item["estimated_volume_L"]
        summary["total_volume_L"] += vol
        
        if item["category"] == "recyclable":
            summary["recyclable_volume_L"] += vol
        else:
            summary["general_volume_L"] += vol
            
        # Add to specific breakdown
        if item["class"] not in summary["breakdown"]:
            summary["breakdown"][item["class"]] = 0.0
        summary["breakdown"][item["class"]] += vol
        
    # 2. Calculate percentages (The Recyclable Ratio)
    total = summary["total_volume_L"]
    if total > 0:
        summary["recyclable_ratio_percent"] = round((summary["recyclable_volume_L"] / total) * 100, 2)
        summary["general_ratio_percent"] = round((summary["general_volume_L"] / total) * 100, 2)
    else:
        summary["recyclable_ratio_percent"] = 0.0
        summary["general_ratio_percent"] = 0.0
        
    # Format breakdown for readability
    for k in summary["breakdown"]:
        summary["breakdown"][k] = round(summary["breakdown"][k], 2)
        
    summary["total_volume_L"] = round(total, 2)
    summary["recyclable_volume_L"] = round(summary["recyclable_volume_L"], 2)
    summary["general_volume_L"] = round(summary["general_volume_L"], 2)
    
    return summary

if __name__ == "__main__":
    print("📸 Initializing Smart Bin YOLO Vision Simulator...\n")
    
    # Simulate a single pass
    detections = simulate_yolo_detections()
    print(f"✅ Detected {len(detections)} objects in current frame.")
    
    # Run the mathematical volume estimation
    results = calculate_waste_ratio(detections)
    
    print("\n📊 --- YOLO Volume Estimation Report ---")
    print("Breakdown by Class (Liters):")
    for item, vol in results["breakdown"].items():
        print(f"  - {item.replace('_', ' ').title()}: {vol} L")
        
    print("\n🧮 Mathematical Calculation:")
    print(f"  Recyclable Volume: {results['recyclable_volume_L']} L")
    print(f"  General Volume:    {results['general_volume_L']} L")
    print(f"  Total Volume:      {results['total_volume_L']} L")
    
    print("\n🎯 Final Compliance Ratios:")
    print(f"  Estimated Recyclable Waste:      {results['recyclable_ratio_percent']}%")
    print(f"  Estimated General/Organic Waste: {results['general_ratio_percent']}%")
    
    # For a Fabric integration, this JSON is what you save to the Lakehouse
    payload = {
        "timestamp": datetime.now().isoformat(),
        "camera_id": "Zone-C-Bin-01",
        "metrics": results
    }
    
    # print("\n📤 Payload ready for Fabric Eventhouse:")
    # print(json.dumps(payload, indent=2))

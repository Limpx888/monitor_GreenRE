import csv
import os
import numpy as np

def run_data_fusion():
    print("=== Step 1: Data Fusion & Training Set Construction ===")
    
    # 1. Read metadata.csv and filter 4 representative buildings
    meta_path = 'metadata.csv'
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta_reader = csv.DictReader(f)
        meta_lookup = {row['building_id']: row for row in meta_reader}
        
    selected_buildings = {
        'Office': 'Robin_office_Gayle',           # primaryspaceusage: Office
        'Hotel': 'Robin_lodging_Elmer',            # primaryspaceusage: Lodging/residential
        'Podium': 'Robin_assembly_Colleen',        # primaryspaceusage: Entertainment/public assembly
        'ME_Plant': 'Hog_services_Kerrie'          # primaryspaceusage: Services
    }
    
    print("\n[1] Selected Representative Buildings from metadata.csv:")
    for role, bid in selected_buildings.items():
        info = meta_lookup.get(bid, {})
        print(f"  - {role:<10}: ID='{bid}' | Primary Use='{info.get('primaryspaceusage')}' | Sub Use='{info.get('sub_primaryspaceusage', 'N/A')}' | SqM={info.get('sqm')}")

    # 2. Extract 8,760 hours from electricity_cleaned.csv
    elec_path = 'electricity_cleaned.csv'
    with open(elec_path, 'r', encoding='utf-8') as f:
        header = f.readline().strip().split(',')
        indices = {role: header.index(bid) for role, bid in selected_buildings.items()}
        
        timestamps = []
        raw_office = []
        raw_hotel = []
        raw_podium = []
        raw_me = []
        
        for row_idx, line in enumerate(f):
            if row_idx >= 8760:
                break
            parts = line.strip().split(',')
            timestamps.append(parts[0])
            raw_office.append(float(parts[indices['Office']]))
            raw_hotel.append(float(parts[indices['Hotel']]))
            raw_podium.append(float(parts[indices['Podium']]))
            raw_me.append(float(parts[indices['ME_Plant']]))

    raw_office = np.array(raw_office)
    raw_hotel = np.array(raw_hotel)
    raw_podium = np.array(raw_podium)
    raw_me = np.array(raw_me)

    print(f"\n[2] Extracted 8,760 hours ({timestamps[0]} to {timestamps[-1]})")
    print(f"  Raw Means (kWh): Office={raw_office.mean():.2f}, Hotel={raw_hotel.mean():.2f}, Podium={raw_podium.mean():.2f}, M&E={raw_me.mean():.2f}")

    # 3. Scale to calibrate to The Light Exchange mixed-use tower target capacities:
    # Target benchmark means: Office ~ 310 kWh, Hotel ~ 420 kWh, Podium ~ 185 kWh, M&E ~ 92 kWh
    target_means = {
        'Office': 310.0,
        'Hotel': 420.0,
        'Podium': 185.0,
        'ME_Plant': 92.0
    }
    
    scale_office = target_means['Office'] / raw_office.mean()
    scale_hotel = target_means['Hotel'] / raw_hotel.mean()
    scale_podium = target_means['Podium'] / raw_podium.mean()
    scale_me = target_means['ME_Plant'] / raw_me.mean()

    calibrated_office = np.round(raw_office * scale_office, 2)
    calibrated_hotel = np.round(raw_hotel * scale_hotel, 2)
    calibrated_podium = np.round(raw_podium * scale_podium, 2)
    calibrated_me = np.round(raw_me * scale_me, 2)

    # 4. Total Building Power = Main utility meter sum
    total_power = np.round(calibrated_office + calibrated_hotel + calibrated_podium + calibrated_me, 2)

    print("\n[3] Synthesized Benchmark 'The Light Exchange' Profiles:")
    print(f"  - Office_Power   (L4-L12):  Mean={calibrated_office.mean():.2f} kWh, Min={calibrated_office.min():.2f}, Max={calibrated_office.max():.2f}")
    print(f"  - Hotel_Power    (L14-L28): Mean={calibrated_hotel.mean():.2f} kWh, Min={calibrated_hotel.min():.2f}, Max={calibrated_hotel.max():.2f}")
    print(f"  - Podium_Power   (Podium):  Mean={calibrated_podium.mean():.2f} kWh, Min={calibrated_podium.min():.2f}, Max={calibrated_podium.max():.2f}")
    print(f"  - ME_Power       (M&E):     Mean={calibrated_me.mean():.2f} kWh, Min={calibrated_me.min():.2f}, Max={calibrated_me.max():.2f}")
    print(f"  - Total_Building_Power (Main Meter): Mean={total_power.mean():.2f} kWh, Min={total_power.min():.2f}, Max={total_power.max():.2f}")

    # 5. Save synthesized dataset
    output_files = [
        'light_exchange_nilm_dataset.csv',
        os.path.join('monitor_GreenRE', 'backend', 'data', 'light_exchange_nilm_dataset.csv')
    ]
    
    for out_path in output_files:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'Total_Building_Power', 'Office_Power', 'Hotel_Power', 'Podium_Power', 'ME_Power'])
            for i in range(len(timestamps)):
                writer.writerow([
                    timestamps[i],
                    total_power[i],
                    calibrated_office[i],
                    calibrated_hotel[i],
                    calibrated_podium[i],
                    calibrated_me[i]
                ])
        print(f"  Saved synthesized training set: {out_path} ({len(timestamps)} rows)")

    print("\nData Fusion Completed Successfully!\n")

if __name__ == '__main__':
    run_data_fusion()

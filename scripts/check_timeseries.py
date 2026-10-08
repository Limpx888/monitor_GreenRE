import csv
import numpy as np

# Read header of electricity_cleaned.csv to map building to index
with open('electricity_cleaned.csv', 'r') as f:
    header = f.readline().strip().split(',')
col_idx = {name: i for i, name in enumerate(header)}

test_candidates = {
    'Office': ['Panther_office_Karla', 'Panther_office_Graham', 'Panther_office_Valarie', 'Panther_office_Larry', 'Panther_office_Hannah'],
    'Hotel': ['Panther_lodging_Russell', 'Panther_lodging_Willa', 'Panther_lodging_Awilda', 'Panther_lodging_Hattie', 'Panther_lodging_Cora'],
    'Podium': ['Panther_assembly_David', 'Panther_assembly_Pamella', 'Panther_assembly_Carrol', 'Panther_assembly_Denice'],
    'Services': ['Bull_services_Juanita', 'Bull_services_Nadine', 'Hog_services_Joe', 'Hog_services_Kerrie', 'Hog_services_Marshall']
}

all_test_ids = [bid for group in test_candidates.values() for bid in group if bid in col_idx]

# Collect counts and values
data = {bid: [] for bid in all_test_ids}
timestamps = []

with open('electricity_cleaned.csv', 'r') as f:
    f.readline() # skip header
    for line in f:
        parts = line.strip().split(',')
        timestamps.append(parts[0])
        for bid in all_test_ids:
            idx = col_idx[bid]
            val = parts[idx] if idx < len(parts) else ''
            if val != '':
                try:
                    data[bid].append(float(val))
                except ValueError:
                    data[bid].append(None)
            else:
                data[bid].append(None)

print(f"Total timestamps: {len(timestamps)} (e.g. {timestamps[0]} to {timestamps[-1]})")
for cat, ids in test_candidates.items():
    print(f"\n--- {cat} Candidates ---")
    for bid in ids:
        if bid not in data:
            continue
        vals = [v for v in data[bid] if v is not None]
        null_count = len(data[bid]) - len(vals)
        if len(vals) > 0:
            mean = np.mean(vals)
            std = np.std(vals)
            min_v = np.min(vals)
            max_v = np.max(vals)
            print(f"{bid}: valid={len(vals)}/{len(timestamps)} (nulls={null_count}), mean={mean:.2f}, std={std:.2f}, min={min_v:.2f}, max={max_v:.2f}")
        else:
            print(f"{bid}: NO DATA")

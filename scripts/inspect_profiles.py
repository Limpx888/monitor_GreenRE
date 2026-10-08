import csv
import numpy as np

# Candidates to inspect
candidates = {
    'Office': ['Robin_office_Shirlene', 'Robin_office_Gayle', 'Robin_office_Dina', 'Robin_office_Lindsay', 'Panther_office_Graham'],
    'Hotel': ['Robin_lodging_Donna', 'Robin_lodging_Renea', 'Robin_lodging_Elmer', 'Robin_lodging_Dorthy', 'Robin_lodging_Janie'],
    'Podium': ['Robin_assembly_Colleen', 'Fox_assembly_Cindy', 'Fox_assembly_Emma', 'Lamb_assembly_Corliss'],
    'Services': ['Hog_services_Kerrie', 'Hog_services_Marshall', 'Robin_public_Carolina', 'Fox_public_Denny']
}

all_bids = [b for c in candidates.values() for b in c]

with open('electricity_cleaned.csv', 'r') as f:
    header = f.readline().strip().split(',')
col_idx = {b: header.index(b) for b in all_bids if b in header}

# Extract first 8760 hours of 2016
data = {b: [] for b in col_idx}
with open('electricity_cleaned.csv', 'r') as f:
    f.readline()
    for row_idx, line in enumerate(f):
        if row_idx >= 8760:
            break
        parts = line.strip().split(',')
        for b, c_idx in col_idx.items():
            val = parts[c_idx] if c_idx < len(parts) else ''
            try:
                data[b].append(float(val))
            except ValueError:
                data[b].append(np.nan)

print("8760 Hours 2016 Stats:")
for cat, bids in candidates.items():
    print(f"\n--- {cat} ---")
    for b in bids:
        if b not in data: continue
        arr = np.array(data[b])
        nans = np.isnan(arr).sum()
        mean = np.nanmean(arr)
        p95 = np.nanpercentile(arr, 95)
        min_v = np.nanmin(arr)
        print(f"  {b}: NaNs={nans}, Mean={mean:.1f} kWh, Min={min_v:.1f}, 95th={p95:.1f}")

import csv

with open('metadata.csv', mode='r', encoding='utf-8') as f:
    meta_rows = list(csv.DictReader(f))

with open('electricity_cleaned.csv', 'r') as f:
    header = f.readline().strip().split(',')
col_idx = {name: i for i, name in enumerate(header)}

# Let's inspect which 8,760 consecutive hours (e.g. 2016 or 2017) have complete data
# Let's test year 2016 (first 8784 rows or 8760) and 2017 (rows 8784 to 17544)
targets = {
    'Office': ['Office'],
    'Hotel': ['Lodging/residential'],
    'Podium': ['Entertainment/public assembly'],
    'Services': ['Services', 'Public services']
}

# Group candidate IDs by category
candidates_by_cat = {}
for cat, usages in targets.items():
    candidates_by_cat[cat] = [
        r['building_id'] for r in meta_rows 
        if r['primaryspaceusage'] in usages and r['building_id'] in col_idx
    ]

# Check completeness for year 2017 (8760 hours)
# 2017-01-01 00:00:00 starts at index 8784
valid_counts_2017 = {cat: {} for cat in targets}
valid_counts_2016 = {cat: {} for cat in targets}

all_bids = set()
for b_list in candidates_by_cat.values():
    all_bids.update(b_list)

bid_indices = {b: col_idx[b] for b in all_bids}

with open('electricity_cleaned.csv', 'r') as f:
    f.readline()
    for row_num, line in enumerate(f):
        parts = line.strip().split(',')
        is_2016 = (row_num < 8784)
        is_2017 = (8784 <= row_num < 8784 + 8760)
        
        if not is_2016 and not is_2017:
            continue
            
        for cat, bids in candidates_by_cat.items():
            for b in bids:
                idx = bid_indices[b]
                val = parts[idx] if idx < len(parts) else ''
                if val != '':
                    if is_2016:
                        valid_counts_2016[cat][b] = valid_counts_2016[cat].get(b, 0) + 1
                    if is_2017:
                        valid_counts_2017[cat][b] = valid_counts_2017[cat].get(b, 0) + 1

print("--- 2016 Perfect 8,784/8,760 Hour Candidates ---")
for cat in targets:
    perfect = [b for b, cnt in valid_counts_2016[cat].items() if cnt >= 8760]
    print(f"{cat}: {len(perfect)} perfect candidates: {perfect[:5]}")

print("\n--- 2017 Perfect 8,760 Hour Candidates ---")
for cat in targets:
    perfect = [b for b, cnt in valid_counts_2017[cat].items() if cnt >= 8760]
    print(f"{cat}: {len(perfect)} perfect candidates: {perfect[:5]}")

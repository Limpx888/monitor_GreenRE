import csv

with open('metadata.csv', mode='r', encoding='utf-8') as f:
    meta_rows = list(csv.DictReader(f))

with open('electricity_cleaned.csv', mode='r', encoding='utf-8') as f:
    header = f.readline().strip().split(',')
    elec_cols = set(header)

print(f"Total meta buildings: {len(meta_rows)}, Total elec columns: {len(elec_cols)}")

targets = {
    'Office': ['Office'],
    'Hotel': ['Lodging/residential'],
    'Podium': ['Entertainment/public assembly'],
    'Services': ['Services', 'Public services', 'Utility']
}

for category, usages in targets.items():
    candidates = [
        r for r in meta_rows 
        if r['primaryspaceusage'] in usages and r['building_id'] in elec_cols
    ]
    print(f"Category {category} ({usages}): {len(candidates)} candidates")
    for c in candidates[:4]:
        bid = c['building_id']
        u = c['primaryspaceusage']
        sqm = c.get('sqm', '')
        print(f"   ID: {bid}, usage: {u}, sqm: {sqm}")

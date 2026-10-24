import os
import httpx
from dotenv import load_dotenv

load_dotenv(".env")
search_ep = os.getenv("AZURE_SEARCH_ENDPOINT", "").strip().strip('"').rstrip("/")
search_key = os.getenv("AZURE_SEARCH_API_KEY", "").strip().strip('"')
search_index = os.getenv("AZURE_SEARCH_INDEX", "").strip().strip('"')

url = f"{search_ep}/indexes/{search_index}?api-version=2024-07-01"
headers = {"api-key": search_key}
r = httpx.get(url, headers=headers)
print("Index Schema Status:", r.status_code)
if r.status_code == 200:
    fields = r.json().get("fields", [])
    print("Fields in index:")
    for f in fields:
        print(f"  - {f['name']} ({f['type']}) key={f.get('key', False)}")

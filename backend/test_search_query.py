import os
import httpx
from dotenv import load_dotenv

load_dotenv(".env")

search_ep = os.getenv("AZURE_SEARCH_ENDPOINT", "").strip().strip('"').rstrip("/")
search_key = os.getenv("AZURE_SEARCH_API_KEY", "").strip().strip('"')
search_index = os.getenv("AZURE_SEARCH_INDEX", "").strip().strip('"')

url = f"{search_ep}/indexes/{search_index}/docs/search?api-version=2024-07-01"
headers = {"api-key": search_key, "Content-Type": "application/json"}
payload = {"search": "*", "top": 5}

r = httpx.post(url, headers=headers, json=payload)
print("Search status:", r.status_code)
print("Search results:", r.text[:300])

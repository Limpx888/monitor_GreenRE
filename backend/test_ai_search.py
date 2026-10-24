"""Test Azure AI Search live query."""
from azure_services import azure_slice

results = azure_slice.ai_search.search_regulations("water efficiency leakage detection WE 1-1", top_k=2)
for r in results:
    svc = r.get("service")
    score = r.get("search_score")
    clause = r.get("clause", "N/A")
    content = str(r.get("content", ""))[:60]
    print(f"Service: {svc}")
    print(f"Score: {score}")
    print(f"Clause: {clause}")
    print(f"Content: {content}...")
    print()

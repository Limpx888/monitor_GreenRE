"""Full end-to-end Azure vertical slice smoke test."""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(".env")

from azure_services import azure_slice

print("=" * 60)
print("GreenRE Azure Vertical Slice - Full Evidence Test")
print("=" * 60)

# 1. Services status
print("\n[1] Azure Services Status:")
status = azure_slice.get_services_status()
for svc_key, svc in status["azure_services"].items():
    icon = "✅" if svc.get("configured") else "⚠️"
    print(f"  {icon} {svc['service']} - configured={svc.get('configured')}")

# 2. Execute full slice
print("\n[2] Executing Full 5-Stage Azure Slice...")
result = azure_slice.execute_slice()
print(f"  Execution ID: {result['execution_id']}")
print(f"  Total Latency: {result['total_latency_ms']}ms")

ev = result["evidence_verification"]

# Stage 1: Event Hubs
s1 = ev["1_ingestion_receipt"]
print(f"\n  Stage 1 - Event Hubs: {s1.get('status')} | connected={s1.get('connected')}")

# Stage 2: Fabric KQL
s2 = ev["2_timeseries_kql_receipt"]
print(f"  Stage 2 - Fabric KQL: {s2.get('status')} | exec_time={s2.get('execution_time_ms')}ms")

# Stage 3: AI Search
s3 = ev["3_search_citations_receipt"]
if isinstance(s3, list):
    for citation in s3:
        print(f"  Stage 3 - AI Search: score={citation.get('search_score')} clause={citation.get('clause', '')[:40]}")

# Stage 4: Azure OpenAI
s4 = ev["4_openai_diagnosis_receipt"]
print(f"  Stage 4 - Azure OpenAI: {s4.get('status')} | deployment={s4.get('deployment')} | tokens={s4.get('tokens_used')}")
if s4.get('diagnosis'):
    print(f"    Diagnosis: {str(s4['diagnosis'])[:80]}...")

print("\n" + "=" * 60)
print("✅ Vertical Slice complete!")
print("=" * 60)

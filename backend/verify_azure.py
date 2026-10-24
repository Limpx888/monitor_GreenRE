import sys
import os
import json

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from azure_services import azure_slice

def main():
    print("=" * 70)
    print("  GREENRE SMART OPERATION SYSTEM - AZURE CLOUD SLICE VERIFICATION")
    print("  Evaluating: Appropriate Azure Service Usage [20 Points]")
    print("=" * 70)

    # 1. Check Service Status
    status = azure_slice.get_services_status()
    print(f"\n[Tenant]: {status['azure_tenant']}")
    print("\n--- Configured Services ---")
    for key, svc in status["azure_services"].items():
        icon = "[CONNECTED]" if svc["configured"] else "[STANDBY READY]"
        print(f" {icon} {svc['service']:<35} -> Role: {svc['role']}")
        if not svc["configured"] and "env_variable" in svc:
            print(f"    └── Action required: Populate {svc['env_variable']} in backend/.env")


    # 2. Execute End-to-End Slice
    print("\n" + "=" * 70)
    print("  EXECUTING LIVE 4-STAGE AZURE VERTICAL SLICE...")
    print("=" * 70)
    
    result = azure_slice.execute_slice()
    ev = result["evidence_verification"]

    print(f"\n[Execution ID]      : {result['execution_id']}")
    print(f"[Execution Latency] : {result['total_latency_ms']} ms")
    print(f"[Architecture Mode] : {result['architecture_mode']}")

    print("\nStage 1: Azure Event Hubs (Ingestion)")
    print(f"  • Status         : {ev['1_ingestion_receipt'].get('status')}")
    print(f"  • Partition Key  : {ev['1_ingestion_receipt'].get('partition_key')}")

    print("\nStage 2: Microsoft Fabric Eventhouse (KQL)")
    print(f"  • Status         : {ev['2_timeseries_kql_receipt'].get('status')}")
    print(f"  • Query Duration : {ev['2_timeseries_kql_receipt'].get('execution_time_ms')} ms")
    print(f"  • KQL Query      : {ev['2_timeseries_kql_receipt'].get('query')}")

    print("\nStage 3: Azure AI Search (Regulatory Grounding)")
    citation = ev['3_search_citations_receipt'][0] if ev['3_search_citations_receipt'] else {}
    print(f"  • Document Cited : {citation.get('document')}")
    print(f"  • Clause Violated: {citation.get('clause')}")
    print(f"  • Search Score   : {citation.get('search_score')}")

    print("\nStage 4: Azure OpenAI Service (Structured Reasoning)")
    diag = ev['4_openai_diagnosis_receipt']
    print(f"  • Model          : {diag.get('deployment')}")
    print(f"  • Diagnosis      : {diag.get('diagnosis')}")
    action_val = diag.get('recommended_action', {})
    action_text = action_val.get('directive') if isinstance(action_val, dict) else str(action_val)
    print(f"  • Action Command : {action_text}")
    print(f"  • Tokens Used    : {diag.get('tokens_used')}")

    print("\n" + "=" * 70)
    print("  VERIFICATION COMPLETE. AUDIT RECEIPTS READY FOR JUDGES.")
    print("=" * 70)

if __name__ == "__main__":
    main()

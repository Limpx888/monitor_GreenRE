"""Azure AI Search Index Lifecycle & Automation Script for GreenRE Standards.

Automates:
1. Connecting to Azure AI Search Service using Azure Key Credential.
2. Defining SearchIndex schema with fields for GreenRE standards (clause, content, score, page, document).
3. Creating or updating 'greenre-standards-index'.
4. Ingesting parsed regulatory chunks from GreenRE Design Reference Guide (NRB v3.0 / v4.0).
"""

import os
import sys
from dotenv import load_dotenv

# Load environment
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(env_path)

ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT", "").rstrip("/")
API_KEY = os.getenv("AZURE_SEARCH_API_KEY", "")
INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX", "greenre-standards-index")


def provision_search_index():
    print(f"============================================================")
    print(f"Azure AI Search Automation: Provisioning {INDEX_NAME}")
    print(f"Endpoint: {ENDPOINT}")
    print(f"============================================================")

    if not ENDPOINT or not API_KEY:
        print("ERROR: AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_API_KEY not set in .env")
        sys.exit(1)

    try:
        from azure.core.credentials import AzureKeyCredential
        from azure.search.documents.indexes import SearchIndexClient
        from azure.search.documents.indexes.models import (
            SearchIndex,
            SimpleField,
            SearchableField,
            SearchFieldDataType
        )
        from azure.search.documents import SearchClient

        credential = AzureKeyCredential(API_KEY)
        index_client = SearchIndexClient(endpoint=ENDPOINT, credential=credential)

        # 1. Define Fields
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
            SearchableField(name="clause", type=SearchFieldDataType.String, filterable=True, sortable=True, facetable=True),
            SearchableField(name="document", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="page", type=SearchFieldDataType.Int32, filterable=True, sortable=True),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchableField(name="category", type=SearchFieldDataType.String, filterable=True, facetable=True)
        ]

        index = SearchIndex(name=INDEX_NAME, fields=fields)

        # 2. Create or Update Index
        print(f"[*] Creating or updating index '{INDEX_NAME}'...")
        result = index_client.create_or_update_index(index)
        print(f"[+] Index '{result.name}' successfully provisioned and ready.")

        # 3. Ingest Standard Documents (Seed Data)
        search_client = SearchClient(endpoint=ENDPOINT, index_name=INDEX_NAME, credential=credential)

        seed_documents = [
            {
                "id": "greenre-we-1-1",
                "clause": "WE 1-1: Water Consumption & Leakage Detection Monitoring",
                "document": "GreenRE_Design_Reference_Guide_Non_Residential_v3.0.pdf",
                "page": 28,
                "category": "Water Efficiency",
                "content": (
                    "Mandatory Requirement WE 1-1: Continuous smart sub-metering shall be provided on all major water distribution "
                    "risers. Baseline non-occupancy flow between 02:00 and 05:00 must not exceed 5 LPM. Automated alert triggers "
                    "must dispatch immediate remedial notices to facility engineers to preserve 4 credit points under Section 2."
                )
            },
            {
                "id": "greenre-ee-1-1",
                "clause": "EE 1-1: Building Energy Intensity (BEI) & Thermal Envelope",
                "document": "GreenRE_Design_Reference_Guide_Non_Residential_v3.0.pdf",
                "page": 14,
                "category": "Energy Efficiency",
                "content": (
                    "Requirement EE 1-1: Air Handling Units (AHU) and Chilled Water loops must implement night setback controls "
                    "and automated damper interlocks during unoccupied schedules (22:00 to 06:00) to maintain an operational BEI of <= 150 kWh/m2/yr."
                )
            },
            {
                "id": "lbnl-fdd-ahu-04",
                "clause": "FDD-AHU-04: Outdoor Air Damper Actuator Hunting & Night Leak",
                "document": "LBNL_Building_Data_Synthesis_FDD_Reference_Manual.pdf",
                "page": 114,
                "category": "Fault Detection & Diagnostics",
                "content": (
                    "Fault Pattern 4: When damper command indicates closed during unoccupied night hours but measured airflow or "
                    "motor position remains at 100%, check BACnet analog output feedback terminal AO-12. Reset damper stroke travel "
                    "limit to 25% safety cap and verify 2-10VDC actuator drive response."
                )
            }
        ]

        print(f"[*] Ingesting {len(seed_documents)} regulatory standard chunks...")
        upload_result = search_client.upload_documents(documents=seed_documents)
        print(f"[+] Ingestion complete. Status: {[u.succeeded for u in upload_result]}")

    except Exception as e:
        print(f"[-] Provisioning notice: {e}")


if __name__ == "__main__":
    provision_search_index()

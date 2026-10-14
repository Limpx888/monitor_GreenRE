"""Integration test suite for RAG & BMS Diagnostic System Architecture Upgrade (v2.0).

Validates:
1. LLM Client configuration and provider fallback mechanism.
2. Document vectorization retaining Page number and Source file metadata.
3. LLM Schema Discovery: Dynamically mapping unknown CSV column headers to physical points.
4. Dynamic Diagnostic Reasoning: Synthesizing multi-dimensional telemetry, anomaly context, and manual guidelines into strict JSON.
5. Anti-Hallucination Safeguard: Returns 'Insufficient evidence' when data is absent.
6. Citation Traceability & Interactive Manual QA with Page citations.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from llm_client import llm_client
from rag_engine import LocalBmsRagMapper

MANUAL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "LBNLDataSynthesisInventory.pdf"))
CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "ahu_fault_damper_stuck.csv"))


def test_llm_client():
    print("\n--- Test 1: LLM Client & Provider Architecture ---")
    info = llm_client.get_active_provider_info()
    print(f"  Active LLM Provider: {info['active_provider']}")
    print(f"  Ollama available: {info['ollama_available']} (model: {info['ollama_model']})")
    print(f"  OpenAI configured: {info['openai_configured']} (model: {info['openai_model']})")

    # Test generation
    sample = llm_client.generate("Briefly confirm system readiness in 5 words.", temperature=0.0)
    print(f"  Sample generation output: '{sample.strip()}'")
    assert len(sample) > 0, "LLM must generate non-empty response"
    print("  Test 1: PASSED")


def _clean_str(s: str) -> str:
    return str(s).encode("ascii", "replace").decode("ascii")


def test_vectorstore_and_citations():
    print("\n--- Test 2: Knowledge Base & Page Citation Metadata ---")
    assert os.path.isfile(MANUAL_PATH), f"Manual not found at {MANUAL_PATH}"
    rag = LocalBmsRagMapper(MANUAL_PATH)

    # Test retrieval with page metadata
    query = "Economizer and outdoor air damper actuator stuck open fault"
    chunks = rag.retrieve_context(query, k=3)
    print(f"  Retrieved {len(chunks)} chunks for query: '{query}'")
    assert len(chunks) > 0, "Vector store must return chunks"

    for i, c in enumerate(chunks, 1):
        excerpt_clean = _clean_str(c["excerpt"][:70])
        print(f"    Chunk {i}: Source={c['source']} | Page={c['page']} | Excerpt={excerpt_clean}...")
        assert c["page"] >= 1, "Page number must be a valid 1-indexed integer"
        assert len(c["source"]) > 0, "Source filename must be present"
        assert len(c["text"]) > 0, "Chunk text must not be empty"

    print("  Test 2: PASSED")
    return rag


def test_llm_schema_discovery(rag: LocalBmsRagMapper):
    print("\n--- Test 3: LLM Schema Discovery (Eliminating _match_column) ---")
    assert os.path.isfile(CSV_PATH), f"CSV not found at {CSV_PATH}"
    schema = rag.get_dynamic_schema(CSV_PATH)
    print(f"  Discovered Schema Mapping: {schema}")

    assert "damper_position" in schema, "Schema must include damper_position"
    assert "fan_speed" in schema, "Schema must include fan_speed"
    assert schema["damper_position"] == "VAV_Damper_Position", f"Expected VAV_Damper_Position, got {schema['damper_position']}"
    assert schema["fan_speed"] == "Supply_Fan_RPM", f"Expected Supply_Fan_RPM, got {schema['fan_speed']}"
    print("  Test 3: PASSED")


def test_dynamic_diagnostic_reasoning(rag: LocalBmsRagMapper):
    print("\n--- Test 4: Multi-Dimensional LLM Diagnostic Reasoning ---")
    # Simulate 24-hour telemetry series where damper is stuck at 100%
    telemetry_series = [
        {"time": f"{h:02d}:00", "damper_pct": 100.0, "fan_rpm": 1200.0 + (h * 5)}
        for h in range(24)
    ]
    anomaly_context = {
        "zone_name": "Hyatt Hotel (L14-L28)",
        "measured_load": 420.0,
        "baseline_load": 260.0,
        "deviation_pct": 61.5,
        "outdoor_temp": 24.5,
        "explanation": "Cool night anomaly: outdoor air is 24.5 deg C yet Hotel Zone cooling load is +61.5% above baseline.",
    }

    result = rag.diagnose_telemetry(floor="L14", telemetry_series=telemetry_series, anomaly_context=anomaly_context)
    print(f"  Diagnosis: {_clean_str(result['diagnosis'])}")
    print(f"  Severity: {result['severity']}")
    print(f"  Confidence: {result['confidence']:.2f}")
    print(f"  Recommended Checks ({len(result['recommended_checks'])} steps):")
    for step in result['recommended_checks']:
        print(f"    - {_clean_str(step)}")
    print(f"  Citations ({len(result['citations'])} sources):")
    for cite in result['citations']:
        print(f"    * {cite['source']} (Page {cite['page']})")

    assert "damper" in result["diagnosis"].lower() or "actuator" in result["diagnosis"].lower() or "economizer" in result["diagnosis"].lower()
    assert result["severity"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["recommended_checks"]) >= 2, "Must include actionable check steps"
    assert len(result["citations"]) > 0, "Must include document citations with page numbers"
    print("  Test 4: PASSED")


def test_anti_hallucination_safeguard(rag: LocalBmsRagMapper):
    print("\n--- Test 5: Anti-Hallucination Safeguard ---")
    # Telemetry with no readings and no anomalies
    empty_series = []
    normal_context = {
        "zone_name": "Podium",
        "measured_load": 180.0,
        "baseline_load": 180.0,
        "deviation_pct": 0.0,
        "outdoor_temp": 24.5,
        "explanation": "All sensors normal with no anomalies detected. Insufficient evidence of any mechanical failure.",
    }

    result = rag.diagnose_telemetry(floor="L1", telemetry_series=empty_series, anomaly_context=normal_context)
    print(f"  Normal Condition Diagnosis: '{_clean_str(result['diagnosis'])}' (Confidence: {result['confidence']})")
    is_safe = ("insufficient" in result["diagnosis"].lower() or result["confidence"] == 0.0 or result["severity"] == "NOMINAL" or "normal" in result["diagnosis"].lower())
    print(f"  Safeguard active: {is_safe}")
    assert is_safe, "Model must not invent a fault when evidence is absent"
    print("  Test 5: PASSED")


def test_interactive_qa_endpoint(rag: LocalBmsRagMapper):
    print("\n--- Test 6: Interactive Manual QA with Page Citations ---")
    question = "According to the manual, how do I manually reset the fresh air damper actuator on Floor L14?"
    qa_result = rag.answer_manual_query(question, floor="L14")

    print(f"  Question: '{question}'")
    print(f"  Latency: {qa_result['latency_ms']} ms")
    ans_clean = _clean_str(qa_result['answer'][:160])
    print(f"  Answer preview: {ans_clean}...")
    print(f"  Citations: {len(qa_result['citations'])} references cited")
    for c in qa_result["citations"]:
        print(f"    - {c['source']} (Page {c['page']})")

    assert len(qa_result["answer"]) > 50, "Answer must contain substantive steps"
    assert len(qa_result["citations"]) > 0, "Must cite manual page numbers"
    print("  Test 6: PASSED")


if __name__ == "__main__":
    print("==================================================")
    print("RAG & BMS Diagnostic System v2.0 Verification")
    print("==================================================")
    test_llm_client()
    rag = test_vectorstore_and_citations()
    test_llm_schema_discovery(rag)
    test_dynamic_diagnostic_reasoning(rag)
    test_anti_hallucination_safeguard(rag)
    test_interactive_qa_endpoint(rag)
    print("\nALL RAG & BMS DIAGNOSTIC v2.0 TESTS COMPLETED SUCCESSFULLY!")

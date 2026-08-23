"""Live runtime validation matrix for every supported RAG architecture.

Run while the backend is running on port 8010. This test intentionally avoids
external websites: each pipeline is built from the same local fixture text and
then queried through the real /api/test-chat endpoint.
"""
import json
import time
from pathlib import Path

import requests

from services.rag_catalog import SUPPORTED_RAG_TYPES, recommended_profile

BASE_URL = "http://localhost:8010"
OUTPUT = Path(__file__).with_name("test_all_rags_output.json")
FIXTURE_TEXTS = [
    "Acme Support Policy: Standard support is available Monday to Friday. Critical incidents are handled 24/7.",
    "Acme Product Guide: Model AX-10 includes a two-year warranty. Warranty claims require the product serial number.",
    "Acme SOP: For invoice exceptions, verify the purchase order, goods receipt, and supplier invoice before escalation.",
]


def deploy_payload(rag_type: str) -> dict:
    profile = recommended_profile(rag_type)
    return {
        "ragName": f"RuntimeMatrix-{rag_type}",
        "extracted_texts": FIXTURE_TEXTS,
        "ragType": rag_type,
        "dbType": "local",
        "cloudDb": "",
        "localDb": "chroma",
        "dynamicConfig": profile["dynamicConfig"],
        "llmModel": "qwen-local",
        "embeddingModel": "bge-local",
        "chunkSize": profile["chunkSize"],
        "topK": profile["topK"],
        "useReranker": profile["useReranker"],
        "theme": "cyan",
        "features": profile["features"],
        "deploymentType": "api",
        "apiKeys": {},
        "privacyMode": True,
        "explainability": profile["explainability"],
        "scrapeMode": "static",
        "tuningPreset": profile["tuningPreset"],
        "hallucinationGuard": profile["hallucinationGuard"],
        "toxicityFilter": False,
        "structuredOutput": False,
        "streamingResponse": profile["streamingResponse"],
    }


def validate_one(rag_type: str) -> dict:
    started = time.time()
    result = {"rag_type": rag_type, "deploy": "failed", "query": "not-run", "passed": False}
    try:
        deploy = requests.post(f"{BASE_URL}/api/deploy", json=deploy_payload(rag_type), timeout=180)
        deploy.raise_for_status()
        deploy_data = deploy.json()
        pipeline_id = deploy_data.get("pipeline_id") or deploy_data.get("deployment_info", {}).get("pipeline_id")
        if not pipeline_id:
            raise RuntimeError("deployment did not return pipeline_id")
        result.update({
            "deploy": "passed",
            "pipeline_id": pipeline_id,
            "resolved_type": deploy_data.get("deployment_info", {}).get("type"),
            "backend_validation": deploy_data.get("deployment_info", {}).get("validation"),
        })

        query = requests.post(
            f"{BASE_URL}/api/test-chat",
            json={
                "pipeline_id": pipeline_id,
                "query": "What warranty does model AX-10 have? Answer only from the supplied knowledge and cite the evidence when supported.",
                **({"audio_base64": ""} if rag_type == "voice" else {}),
            },
            timeout=180,
        )
        query.raise_for_status()
        query_data = query.json()
        answer = str(query_data.get("answer") or "").strip()
        query_passed = bool(answer) and not answer.startswith("⚠️") and "please create a rag" not in answer.lower()
        result.update({
            "query": "passed" if query_passed else "failed",
            "answer_preview": answer[:500],
            "passed": query_passed,
        })
    except Exception as exc:
        result["error"] = str(exc)
    result["seconds"] = round(time.time() - started, 2)
    return result


def main() -> int:
    try:
        health = requests.get(f"{BASE_URL}/health", timeout=10)
        health.raise_for_status()
    except Exception as exc:
        print(f"Backend is not ready at {BASE_URL}: {exc}")
        return 2

    results = []
    print(f"Validating {len(SUPPORTED_RAG_TYPES)} RAG architectures against the live backend…")
    for rag_type in SUPPORTED_RAG_TYPES:
        print(f"\n[{rag_type}] build + query")
        result = validate_one(rag_type)
        results.append(result)
        print("PASS" if result["passed"] else f"FAIL: {result.get('error') or result.get('answer_preview', '')[:160]}")

    summary = {
        "total": len(results),
        "passed": sum(1 for item in results if item["passed"]),
        "failed": sum(1 for item in results if not item["passed"]),
        "results": results,
    }
    OUTPUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nRuntime matrix: {summary['passed']}/{summary['total']} passed")
    print(f"Report: {OUTPUT}")
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

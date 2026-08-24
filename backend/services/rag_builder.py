"""RAG Builder — validated deployment, safe persistence and self-developing Autopilot."""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Dict

from .haystack_service import build_and_deploy_pipeline
from .rag_catalog import normalize_rag_type, recommended_profile, validate_deploy_config
from .rag_autopilot_runtime import register_autopilot, start_runtime_supervisor

logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
DEPLOY_DIR = DATA_DIR / "deployments"
DEPLOY_DIR.mkdir(parents=True, exist_ok=True)


def _safe_rag_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "RAG").strip())[:100]
    return cleaned or "RAG"


def _prepare_customer_config(config: dict) -> tuple[dict, dict]:
    prepared = deepcopy(config)
    raw_type = prepared.get("ragType", "basic")
    resolved_type, selection = normalize_rag_type(raw_type)

    if str(raw_type).lower().startswith("auto::"):
        profile = recommended_profile(resolved_type)
        prepared["dynamicConfig"] = {
            **profile.get("dynamicConfig", {}),
            **(prepared.get("dynamicConfig") or {}),
        }
        if not prepared.get("features"):
            prepared["features"] = profile["features"]
        prepared["chunkSize"] = prepared.get("chunkSize") or profile["chunkSize"]
        prepared["topK"] = prepared.get("topK") or profile["topK"]
        if "useReranker" not in prepared:
            prepared["useReranker"] = profile["useReranker"]
        prepared["hallucinationGuard"] = prepared.get("hallucinationGuard", profile["hallucinationGuard"])
        prepared["explainability"] = prepared.get("explainability", profile["explainability"])
        prepared["streamingResponse"] = prepared.get("streamingResponse", profile["streamingResponse"])

    prepared["ragType"] = resolved_type
    prepared["ragName"] = _safe_rag_name(prepared.get("ragName", "RAG"))
    validation = validate_deploy_config(prepared)
    validation["selection"] = selection
    if not validation["valid"]:
        raise ValueError("Invalid RAG configuration: " + "; ".join(validation["errors"]))
    return prepared, validation


def _safe_persisted_config(config: dict) -> dict:
    safe = deepcopy(config)
    safe.pop("extracted_texts", None)
    safe["apiKeys"] = {}
    return safe


def _write_deployment_metadata(pipeline_id: str, config: dict, response: dict):
    path = DEPLOY_DIR / f"{pipeline_id}.json"
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps({
        "pipeline_id": pipeline_id,
        "config": _safe_persisted_config(config),
        "deployment": response,
    }, indent=2, default=str), encoding="utf-8")
    temp.replace(path)


def deploy_rag_system(config: dict) -> Dict:
    """Build a supported RAG and optionally register it for continuous self-updating."""
    config, validation = _prepare_customer_config(config)
    deployment_type = config.get("deploymentType", "api")
    pipeline_id, _ = build_and_deploy_pipeline(config)

    response = {
        "pipeline_id": pipeline_id,
        "type": config.get("ragType"),
        "db_type": config.get("dbType"),
        "documents_processed": len(config.get("extracted_texts", [])),
        "total_characters": sum(len(t) for t in config.get("extracted_texts", [])),
        "deployment_type": deployment_type,
        "selection": validation.get("selection", {}),
        "validation": {
            "valid": validation["valid"],
            "warnings": validation["warnings"],
            "rag_type": validation["rag_type"],
        },
    }

    if deployment_type in ("api", "hybrid"):
        response["query_endpoint"] = "http://localhost:8010/api/test-chat"
        response["api_deployed"] = True

    if deployment_type in ("offline", "hybrid"):
        response["offline_package"] = _create_offline_package(pipeline_id, config)
        response["offline_deployed"] = True

    _write_deployment_metadata(pipeline_id, config, response)
    autopilot = register_autopilot(pipeline_id, config)
    response["autopilot"] = autopilot
    _write_deployment_metadata(pipeline_id, config, response)
    logger.info("RAG deployed: %s (%s), autopilot=%s", pipeline_id, config.get("ragType"), autopilot.get("enabled"))
    return response


def _copy_runtime(package_dir: Path, config: dict):
    app_dir = package_dir / "app"
    app_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(BACKEND_DIR / "main.py", app_dir / "main.py")
    if (BACKEND_DIR / "requirements.txt").exists():
        shutil.copy2(BACKEND_DIR / "requirements.txt", app_dir / "requirements.txt")
    shutil.copytree(BACKEND_DIR / "services", app_dir / "services", dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    rag_name = _safe_rag_name(config.get("ragName", "RAG"))
    src_data = DATA_DIR / rag_name
    if src_data.exists():
        shutil.copytree(src_data, app_dir / "data" / rag_name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("*.tmp"))


def _create_offline_package(pipeline_id: str, config: dict) -> dict:
    package_dir = DEPLOY_DIR / f"{pipeline_id}_offline"
    package_dir.mkdir(parents=True, exist_ok=True)
    _copy_runtime(package_dir, config)

    pipeline_config = {
        "pipeline_id": pipeline_id,
        "ragName": config.get("ragName"),
        "rag_type": config.get("ragType"),
        "llm_model": config.get("llmModel"),
        "embedding_model": config.get("embeddingModel"),
        "chunk_size": config.get("chunkSize", 500),
        "top_k": config.get("topK", 5),
        "use_reranker": config.get("useReranker", False),
        "features": config.get("features", []),
        "db_type": config.get("dbType"),
        "local_db": config.get("localDb"),
        "autopilot": (config.get("dynamicConfig", {}) or {}).get("autopilot", {}),
    }
    (package_dir / "pipeline_config.json").write_text(json.dumps(pipeline_config, indent=2), encoding="utf-8")
    deps = _get_dependencies(config)
    (package_dir / "requirements.txt").write_text("\n".join(deps) + "\n", encoding="utf-8")

    start_py = '''from pathlib import Path\nimport sys\nimport uvicorn\nAPP = Path(__file__).resolve().parent / "app"\nsys.path.insert(0, str(APP))\nfrom main import app\nuvicorn.run(app, host="0.0.0.0", port=8010)\n'''
    (package_dir / "start.py").write_text(start_py, encoding="utf-8")
    (package_dir / "start.sh").write_text("#!/usr/bin/env bash\nset -e\npython -m pip install -r requirements.txt\npython start.py\n", encoding="utf-8")
    (package_dir / "start.bat").write_text("@echo off\r\npython -m pip install -r requirements.txt\r\npython start.py\r\n", encoding="utf-8")
    (package_dir / "README.txt").write_text(
        "Customer RAG package\n\n1. Install Python 3.11/3.12.\n2. Run start.bat (Windows) or start.sh (Linux/macOS).\n"
        "3. Keep local model/vector dependencies available on this machine.\n"
        "4. Open the product UI and use the stable pipeline ID shown in pipeline_config.json.\n"
        "API/provider secrets are intentionally not exported. Configure them on the customer machine.\n",
        encoding="utf-8",
    )
    return {
        "package_dir": str(package_dir),
        "config_file": str(package_dir / "pipeline_config.json"),
        "deps_file": str(package_dir / "requirements.txt"),
        "run_script": str(package_dir / "start.py"),
        "windows_start": str(package_dir / "start.bat"),
        "unix_start": str(package_dir / "start.sh"),
    }


def _get_dependencies(config: dict) -> list:
    deps = [
        "fastapi",
        "uvicorn",
        "pydantic",
        "python-multipart",
        "requests",
        "beautifulsoup4",
        "haystack-ai==2.31.0",
        "sentence-transformers",
    ]
    llm = config.get("llmModel", "qwen-local")
    if llm in ("qwen-local", "mistral-local"):
        deps.append("llama-cpp-python")
    if llm == "gpt4o":
        deps.append("openai")
    if llm == "claude35":
        deps.append("anthropic")

    local_db = config.get("localDb", "chroma")
    cloud_db = config.get("cloudDb", "")
    if local_db == "chroma":
        deps += ["chromadb", "chroma-haystack"]
    if local_db == "faiss":
        deps += ["faiss-cpu", "faiss-haystack"]
    if cloud_db == "qdrant":
        deps += ["qdrant-client", "qdrant-haystack==10.4.0"]
    if cloud_db == "elasticsearch":
        deps.append("elasticsearch")
    if cloud_db == "pinecone":
        deps.append("pinecone-client")

    rag_type = config.get("ragType")
    if rag_type == "voice":
        deps += ["faster-whisper", "edge-tts", "pydub"]
    if rag_type == "crosslingual":
        deps += ["langdetect", "deep-translator"]
    if rag_type == "structured":
        deps.append("networkx")
    if rag_type == "multimodal" or (config.get("dynamicConfig", {}) or {}).get("autopilot", {}).get("vision"):
        deps += ["Pillow", "pytesseract", "playwright"]
    return sorted(set(deps))


start_runtime_supervisor()

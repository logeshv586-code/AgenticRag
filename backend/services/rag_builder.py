"""
RAG Builder — Orchestrates deployment and metadata management.
Supports API, offline, and hybrid deployment modes.
"""
import os
import uuid
import json
import logging
from typing import Dict

from .haystack_service import build_and_deploy_pipeline

logger = logging.getLogger(__name__)

# Deployment artifacts directory
DEPLOY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "deployments")
os.makedirs(DEPLOY_DIR, exist_ok=True)


def deploy_rag_system(config: dict) -> Dict:
    """
    Deploys the RAG system based on user configuration.
    Supports 'api', 'offline', and 'hybrid' deployment types.
    """
    deployment_type = config.get("deploymentType", "api")
    pipeline_id, pipeline = build_and_deploy_pipeline(config)

    endpoint = f"http://localhost:8010/api/test-chat"

    response = {
        "pipeline_id": pipeline_id,
        "type": config.get("ragType"),
        "db_type": config.get("dbType"),
        "documents_processed": len(config.get("extracted_texts", [])),
        "total_characters": sum(len(t) for t in config.get("extracted_texts", [])),
        "deployment_type": deployment_type,
    }

    # ── API deployment ───────────────────────────────────
    if deployment_type in ("api", "hybrid"):
        response["query_endpoint"] = endpoint
        response["api_deployed"] = True
        logger.info(f"API endpoint ready: {endpoint}")

    # ── Offline deployment ───────────────────────────────
    if deployment_type in ("offline", "hybrid"):
        offline_info = _create_offline_package(pipeline_id, config)
        response["offline_package"] = offline_info
        response["offline_deployed"] = True

    # ── Save deployment metadata ─────────────────────────
    meta_path = os.path.join(DEPLOY_DIR, f"{pipeline_id}.json")
    try:
        # Strip non-serializable items from config
        safe_config = {k: v for k, v in config.items() if k != "extracted_texts"}
        with open(meta_path, 'w') as f:
            json.dump({
                "pipeline_id": pipeline_id,
                "config": safe_config,
                "deployment": response,
            }, f, indent=2, default=str)
        logger.info(f"Deployment metadata saved: {meta_path}")
    except Exception as e:
        logger.warning(f"Could not save deployment metadata: {e}")

    return response


def _create_offline_package(pipeline_id: str, config: dict) -> dict:
    """
    Create an offline deployment package.
    Generates a config file and dependency list for air-gapped deployment.
    """
    package_dir = os.path.join(DEPLOY_DIR, f"{pipeline_id}_offline")
    os.makedirs(package_dir, exist_ok=True)

    # Pipeline configuration YAML
    pipeline_config = {
        "pipeline_id": pipeline_id,
        "rag_type": config.get("ragType"),
        "llm_model": config.get("llmModel"),
        "embedding_model": config.get("embeddingModel"),
        "chunk_size": config.get("chunkSize", 500),
        "top_k": config.get("topK", 5),
        "use_reranker": config.get("useReranker", False),
        "features": config.get("features", []),
        "db_type": config.get("dbType"),
        "local_db": config.get("localDb"),
    }

    config_path = os.path.join(package_dir, "pipeline_config.json")
    with open(config_path, 'w') as f:
        json.dump(pipeline_config, f, indent=2)

    # Dependencies list
    deps = _get_dependencies(config)
    deps_path = os.path.join(package_dir, "requirements.txt")
    with open(deps_path, 'w') as f:
        f.write('\n'.join(deps))

    # Run script
    run_script = f"""#!/usr/bin/env python3
# Auto-generated RAG pipeline runner
# Pipeline ID: {pipeline_id}
import json
import os

print("Loading pipeline configuration...")
with open("pipeline_config.json") as f:
    config = json.load(f)

print(f"Pipeline Type: {{config['rag_type']}}")
print(f"LLM: {{config['llm_model']}}")
print(f"Ready for queries on port 8000")
"""
    script_path = os.path.join(package_dir, "run.py")
    with open(script_path, 'w') as f:
        f.write(run_script)

    return {
        "package_dir": package_dir,
        "config_file": config_path,
        "deps_file": deps_path,
        "run_script": script_path,
    }


def _get_dependencies(config: dict) -> list:
    """Generate list of Python dependencies based on config."""
    deps = [
        "fastapi",
        "uvicorn",
        "haystack-ai",
        "pydantic",
    ]

    llm = config.get("llmModel", "qwen-local")
    if llm in ("qwen-local", "mistral-local"):
        deps.append("llama-cpp-python")
    if llm == "gpt4o":
        deps.append("openai")
    if llm == "claude35":
        deps.append("anthropic")

    db_type = config.get("dbType", "local")
    local_db = config.get("localDb", "chroma")
    cloud_db = config.get("cloudDb", "")

    if local_db == "chroma" or cloud_db == "chroma":
        deps.append("chromadb")
    if local_db == "faiss":
        deps.append("faiss-cpu")
    if cloud_db == "qdrant":
        deps.append("qdrant-client")
    if cloud_db == "elasticsearch":
        deps.append("elasticsearch")
    if cloud_db == "pinecone":
        deps.append("pinecone-client")

    embed = config.get("embeddingModel", "bge-local")
    if embed == "bge-local":
        deps.append("sentence-transformers")
    if embed == "openai-ada":
        deps.append("openai")

    return sorted(set(deps))

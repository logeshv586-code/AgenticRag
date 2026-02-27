import uuid
from .haystack_service import build_and_deploy_pipeline

def deploy_rag_system(config: dict):
    """
    Deploys the RAG system using Haystack 2.0 orchestration.
    """
    pipeline_id, pipeline = build_and_deploy_pipeline(config)
    
    endpoint = f"http://localhost:8000/api/rag/{pipeline_id}/query"
    
    response = {
        "pipeline_id": pipeline_id,
        "type": config.get("ragType"),
        "db_type": config.get("dbType"),
        "documents_processed": len(config.get("extracted_texts", [])),
        "total_characters": sum(len(t) for t in config.get("extracted_texts", [])),
        "query_endpoint": endpoint
    }
    
    return response

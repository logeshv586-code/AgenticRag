import uuid
from .haystack_service import build_and_deploy_pipeline

def deploy_rag_system(texts, rag_type, use_case, vector_db, features=None):
    """
    Deploys the RAG system using Haystack 2.0 orchestration.
    """
    features = features or []
    
    pipeline_id, pipeline = build_and_deploy_pipeline(
        texts=texts,
        rag_type=rag_type,
        use_case=use_case,
        vector_db=vector_db,
        features=features
    )
    
    endpoint = f"http://localhost:8000/api/rag/{pipeline_id}/query"
    
    response = {
        "pipeline_id": pipeline_id,
        "type": rag_type,
        "use_case": use_case,
        "vector_database": vector_db,
        "documents_processed": len(texts),
        "total_characters": sum(len(t) for t in texts),
        "query_endpoint": endpoint
    }
    
    return response

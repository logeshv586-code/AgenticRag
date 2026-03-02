"""
Observability Service — Metrics, logging, and usage tracking for RAG pipelines.
Tracks latency, token usage, error rates, and stores full query logs.
"""
import time
import json
import uuid
import logging
from typing import Dict, List, Any
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)

# In-memory storage for demonstration (would use SQLite/Postgres in prod)
_query_logs = deque(maxlen=1000)
_system_metrics = {
    "total_queries": 0,
    "total_errors": 0,
    "total_tokens": 0,
    "average_latency_ms": 0.0,
    "rag_type_counts": {},
    "model_usage": {}
}


class QueryContext:
    """Context manager for tracking a single RAG query's performance."""
    
    def __init__(self, pipeline_id: str, query: str, rag_type: str = "basic", model: str = "unknown"):
        self.pipeline_id = pipeline_id
        self.query = query
        self.rag_type = rag_type
        self.model = model
        self.start_time = 0
        self.end_time = 0
        self.error = None
        self.response = None
        self.tokens = 0
        
    def __enter__(self):
        self.start_time = time.time()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        latency_ms = (self.end_time - self.start_time) * 1000
        
        if exc_type is not None:
            self.error = str(exc_val)
            
        # Optional: very loose token estimation if not provided by LLM response
        if self.tokens == 0 and self.response:
            self.tokens = len(self.query.split()) + len(str(self.response).split())
            
        _record_query(self.pipeline_id, self.query, self.response, self.error, 
                     latency_ms, self.tokens, self.rag_type, self.model)
        
        return False  # Do not swallow exceptions


def _record_query(pipeline_id: str, query: str, response: Any, error: str, 
                  latency_ms: float, tokens: int, rag_type: str, model: str):
    """Record a completed query into the observability stores."""
    
    # 1. Update Metrics
    _system_metrics["total_queries"] += 1
    _system_metrics["total_tokens"] += tokens
    
    if error:
        _system_metrics["total_errors"] += 1
        
    # Moving average latency
    prev_avg = _system_metrics["average_latency_ms"]
    count = _system_metrics["total_queries"]
    _system_metrics["average_latency_ms"] = prev_avg + (latency_ms - prev_avg) / count
    
    # RAG type distribution
    _system_metrics["rag_type_counts"][rag_type] = _system_metrics["rag_type_counts"].get(rag_type, 0) + 1
    
    # Model usage distribution
    _system_metrics["model_usage"][model] = _system_metrics["model_usage"].get(model, 0) + 1
    
    # 2. Add to logs
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "pipeline_id": pipeline_id,
        "rag_type": rag_type,
        "model": model,
        "query": query,
        "response": str(response) if response else None,
        "error": error,
        "latency_ms": round(latency_ms, 2),
        "tokens": tokens
    }
    _query_logs.appendleft(log_entry)
    
    status = "ERROR" if error else "SUCCESS"
    logger.info(f"OBSERVABILITY | {status} | Latency: {latency_ms:.1f}ms | Tokens: {tokens} | Model: {model} | Pipeline: {pipeline_id}")


# ═══════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════

def get_metrics() -> dict:
    """Get aggregated system metrics."""
    return dict(_system_metrics)


def get_logs(limit: int = 50, pipeline_id: str = None) -> List[dict]:
    """Get recent query logs, optionally filtered by pipeline."""
    logs = list(_query_logs)
    if pipeline_id:
        logs = [log for log in logs if log["pipeline_id"] == pipeline_id]
    return logs[:limit]


def track_query(pipeline_id: str, query: str, rag_type: str = "basic", model: str = "unknown") -> QueryContext:
    """Get a context manager to track a query's execution."""
    return QueryContext(pipeline_id, query, rag_type, model)

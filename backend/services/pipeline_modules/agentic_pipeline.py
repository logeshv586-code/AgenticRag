"""Compatibility wrapper for the production Agentic RAG implementation."""
from .agentic_pipeline_v2 import (
    build_agentic_pipeline,
    execute_agentic_query,
    get_agentic_graph_nodes,
)

__all__ = [
    "build_agentic_pipeline",
    "execute_agentic_query",
    "get_agentic_graph_nodes",
]

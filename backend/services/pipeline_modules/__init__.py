"""
Pipeline Modules — Registry mapping RAG types to specialized pipeline builders.
Each RAG type gets its own modular backend with unique components.
"""

from .cross_lingual_pipeline import build_cross_lingual_pipeline
from .voice_pipeline import build_voice_pipeline
from .agentic_pipeline import build_agentic_pipeline
from .graph_pipeline import build_graph_pipeline
from .conversational_pipeline import build_conversational_pipeline

# ═══════════════════════════════════════════════════════════
#  Pipeline Module Registry
# ═══════════════════════════════════════════════════════════

PIPELINE_REGISTRY = {
    "crosslingual": build_cross_lingual_pipeline,
    "voice": build_voice_pipeline,
    "agentic": build_agentic_pipeline,
    "structured": build_graph_pipeline,       # "structured" = Graph RAG in frontend
    "conversational": build_conversational_pipeline,
}

# RAG types that use the standard shared pipeline (prompt-only variation)
STANDARD_RAG_TYPES = {"basic", "hybrid", "citation", "realtime", "personalized", "multimodal"}


def get_pipeline_builder(rag_type: str):
    """
    Returns the specialized pipeline builder for a RAG type,
    or None if it should use the standard shared pipeline.
    """
    return PIPELINE_REGISTRY.get(rag_type)

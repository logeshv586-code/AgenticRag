"""Pipeline registry for all production RAG architectures."""

from .advanced_pipeline import build_advanced_pipeline
from .cross_lingual_pipeline import build_cross_lingual_pipeline
from .voice_pipeline import build_voice_pipeline
from .agentic_pipeline import build_agentic_pipeline
from .graph_pipeline import build_graph_pipeline
from .conversational_pipeline import build_conversational_pipeline

PIPELINE_REGISTRY = {
    "basic": build_advanced_pipeline,
    "hybrid": build_advanced_pipeline,
    "citation": build_advanced_pipeline,
    "realtime": build_advanced_pipeline,
    "personalized": build_advanced_pipeline,
    "multimodal": build_advanced_pipeline,
    "crosslingual": build_cross_lingual_pipeline,
    "voice": build_voice_pipeline,
    "agentic": build_agentic_pipeline,
    "structured": build_graph_pipeline,
    "conversational": build_conversational_pipeline,
}

# Retained for contract compatibility. Every supported type now has a specialized builder.
STANDARD_RAG_TYPES = set()


def get_pipeline_builder(rag_type: str):
    return PIPELINE_REGISTRY.get(rag_type)

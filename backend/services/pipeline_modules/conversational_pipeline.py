"""
Conversational Pipeline — Memory-aware RAG with conversation history.
Pipeline: Query + Memory Context → Retriever → LLM → Memory Update → Response

Features:
  - Buffer memory (last N exchanges) or Summary memory (LLM-compressed)
  - Thread-safe per-pipeline memory storage
  - Configurable memory window and type
"""
import logging
from typing import Optional

from haystack import Pipeline
from haystack.components.builders import PromptBuilder

from ..memory_manager import get_or_create_memory, BufferMemory, SummaryMemory

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Conversational Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_conversational_pipeline(document_store, config: dict, retriever, generator) -> dict:
    """
    Build a conversational RAG pipeline with memory management.

    Pipeline flow:
        Query + Memory Context → Retriever → Prompt (with history) → LLM →
        Memory Update → Response
    """
    dynamic_cfg = config.get("dynamicConfig", {})
    memory_type = dynamic_cfg.get("memoryType", "buffer")  # "buffer" or "summary"
    window_size = dynamic_cfg.get("memoryWindowSize", 10)
    history_length = dynamic_cfg.get("historyLength", 10)

    # Use history_length as fallback for window_size
    effective_window = window_size or history_length

    # Build the inner pipeline
    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)

    template = """You are a conversational AI assistant that maintains context across the conversation.
    Use the conversation history to provide contextually relevant responses.

    Conversation History:
    {{ conversation_history }}

    Context from knowledge base:
    {% for document in documents %}
        {{ document.content }}
    {% endfor %}

    Current Question: {{ query }}
    Answer:"""

    prompt_builder = PromptBuilder(template=template)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)

    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")

    return {
        "pipeline": pipeline,
        "memory_type": memory_type,
        "window_size": effective_window,
        "meta": {
            "memory_type": memory_type,
            "window_size": effective_window,
        },
    }


def execute_conversational_query(pipeline_info: dict, pipeline_id: str, query: str) -> str:
    """
    Execute a query through the conversational pipeline with memory.
    """
    pipeline = pipeline_info["pipeline"]
    memory_type = pipeline_info["memory_type"]
    window_size = pipeline_info["window_size"]

    # Get or create memory for this pipeline
    memory = get_or_create_memory(
        pipeline_id=pipeline_id,
        memory_type=memory_type,
        window_size=window_size,
    )

    # Get conversation history
    history = memory.get_context()

    # Run pipeline with history context
    try:
        result = pipeline.run({
            "retriever": {"query": query},
            "prompt_builder": {
                "query": query,
                "conversation_history": history if history else "No previous conversation.",
            },
        })
        answer = result.get("llm", {}).get("replies", ["No response generated."])[0]
    except Exception as e:
        logger.error(f"Conversational pipeline error: {e}")
        answer = f"Error: {str(e)}"

    # Update memory with this exchange
    memory.add_exchange(query, answer)
    logger.info(f"Conversational: Memory updated for pipeline {pipeline_id} ({memory_type})")

    return answer


def get_conversational_graph_nodes() -> dict:
    """Return visualization nodes specific to conversational pipeline."""
    return {
        "extra_nodes": [
            {"id": "memory_manager", "label": "Memory Manager", "type": "processor"},
        ],
        "extra_edges": [
            {"source": "ingestion", "target": "memory_manager"},
            {"source": "memory_manager", "target": "embedder"},
        ],
        "post_edges": [
            {"source": "llm", "target": "memory_manager"},
        ],
        "remove_edges": [
            {"source": "ingestion", "target": "embedder"},
        ],
    }

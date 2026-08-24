"""Production Haystack service for every supported RAG architecture.

All specialized modules receive the same plain-text-query retriever contract.  The
adapter embeds queries for dense stores (Chroma/FAISS/Qdrant/etc.) and never
silently swaps a requested production store for an empty in-memory database.
"""
from __future__ import annotations

import logging
import math
import re
import uuid
from typing import Dict, List, Optional, Tuple

from haystack import Document, Pipeline, component
from haystack.components.preprocessors import DocumentSplitter
from haystack.document_stores.in_memory import InMemoryDocumentStore

from .embedding_service import get_document_embedder, get_text_embedder
from .llm_service import get_generator, get_model_display_name
from .observability_service import track_query
from .pipeline_modules import get_pipeline_builder
from .vector_store_manager import create_document_store, write_documents

logger = logging.getLogger(__name__)

active_pipelines: Dict[str, Pipeline] = {}
pipeline_metadata: Dict[str, dict] = {}
specialized_pipeline_info: Dict[str, dict] = {}

_SOURCE_RE = re.compile(r"^Source:\s*(.+)$", re.MULTILINE)
_UPDATED_RE = re.compile(r"^Updated:\s*(.+)$", re.MULTILINE)
_TOKEN_RE = re.compile(r"[\w-]+", re.UNICODE)


def _document_from_text(text: str) -> Document:
    content = str(text or "").strip()
    meta = {}
    match = _SOURCE_RE.search(content)
    if match:
        meta["source"] = match.group(1).strip()
    updated = _UPDATED_RE.search(content)
    if updated:
        meta["updated_at"] = updated.group(1).strip()
    if "[Image Analysis" in content or "[OCR Text]" in content or "[Visual Snapshot]" in content:
        meta["modality"] = "image"
    elif "[Audio Transcript" in content:
        meta["modality"] = "audio"
    else:
        meta["modality"] = "text"
    return Document(content=content, meta=meta)


def _warm(component_obj):
    if component_obj and hasattr(component_obj, "warm_up"):
        component_obj.warm_up()
    return component_obj


def _tokens(text: str) -> List[str]:
    return [x.lower() for x in _TOKEN_RE.findall(text or "") if len(x) > 1]


def _lexical_rank(query: str, documents: List[Document], top_k: int) -> List[Document]:
    """Dependency-free BM25 fallback over documents from the actual selected store."""
    if not documents:
        return []
    query_terms = _tokens(query)
    if not query_terms:
        return documents[:top_k]
    corpus = [_tokens(doc.content or "") for doc in documents]
    n = len(corpus)
    avgdl = sum(len(tokens) for tokens in corpus) / max(n, 1)
    df: Dict[str, int] = {}
    for tokens in corpus:
        for term in set(tokens):
            df[term] = df.get(term, 0) + 1
    k1, b = 1.5, 0.75
    ranked = []
    for idx, tokens in enumerate(corpus):
        freqs: Dict[str, int] = {}
        for term in tokens:
            freqs[term] = freqs.get(term, 0) + 1
        dl = max(len(tokens), 1)
        score = 0.0
        for term in query_terms:
            tf = freqs.get(term, 0)
            if not tf:
                continue
            term_df = df.get(term, 0)
            idf = math.log(1.0 + (n - term_df + 0.5) / (term_df + 0.5))
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / max(avgdl, 1)))
        ranked.append((score, idx))
    ranked.sort(reverse=True)
    hits = [documents[idx] for score, idx in ranked if score > 0]
    return (hits or documents)[:top_k]


def _native_dense_retriever(store, top_k: int):
    name = type(store).__name__
    try:
        if "ChromaDocumentStore" in name:
            from haystack_integrations.components.retrievers.chroma import ChromaEmbeddingRetriever
            return ChromaEmbeddingRetriever(document_store=store, top_k=top_k)
        if "FAISSDocumentStore" in name:
            from haystack_integrations.components.retrievers.faiss import FAISSEmbeddingRetriever
            return FAISSEmbeddingRetriever(document_store=store, top_k=top_k)
        if "QdrantDocumentStore" in name:
            from haystack_integrations.components.retrievers.qdrant import QdrantEmbeddingRetriever
            return QdrantEmbeddingRetriever(document_store=store, top_k=top_k)
        if "ElasticsearchDocumentStore" in name:
            from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchEmbeddingRetriever
            return ElasticsearchEmbeddingRetriever(document_store=store, top_k=top_k)
        if "PineconeDocumentStore" in name:
            from haystack_integrations.components.retrievers.pinecone import PineconeEmbeddingRetriever
            return PineconeEmbeddingRetriever(document_store=store, top_k=top_k)
        if "WeaviateDocumentStore" in name:
            from haystack_integrations.components.retrievers.weaviate import WeaviateEmbeddingRetriever
            return WeaviateEmbeddingRetriever(document_store=store, top_k=top_k)
        if "PgvectorDocumentStore" in name:
            from haystack_integrations.components.retrievers.pgvector import PgvectorEmbeddingRetriever
            return PgvectorEmbeddingRetriever(document_store=store, top_k=top_k)
        if "RedisDocumentStore" in name:
            from haystack_integrations.components.retrievers.redis import RedisEmbeddingRetriever
            return RedisEmbeddingRetriever(document_store=store, top_k=top_k)
    except Exception as exc:
        logger.warning("Native dense retriever for %s is unavailable: %s", name, exc)
    return None


@component
class PlainTextRetriever:
    """Uniform retriever component: always accepts `query: str`."""

    def __init__(self, document_store, config: dict):
        self.document_store = document_store
        self.config = config
        self.top_k = int(config.get("topK", 6))
        self.embedding_model = config.get("embeddingModel", "bge-local")
        self.api_keys = config.get("apiKeys", {}) or {}
        self.native = None if isinstance(document_store, InMemoryDocumentStore) else _native_dense_retriever(document_store, self.top_k)
        self.query_embedder = None

    def _all_docs(self) -> List[Document]:
        try:
            return list(self.document_store.filter_documents())
        except Exception as exc:
            logger.warning("Could not enumerate selected store for lexical fallback: %s", exc)
            return []

    def _dense(self, query: str) -> List[Document]:
        if not self.native:
            return []
        try:
            if self.query_embedder is None:
                key = self.api_keys.get("openai") or self.api_keys.get("mistral")
                self.query_embedder = _warm(get_text_embedder(self.embedding_model, key))
            if not self.query_embedder:
                return []
            embedding = self.query_embedder.run(text=query).get("embedding")
            if embedding is None:
                return []
            result = self.native.run(query_embedding=embedding)
            return list(result.get("documents", []))[: self.top_k]
        except Exception as exc:
            logger.warning("Dense retrieval failed on %s: %s", type(self.document_store).__name__, exc)
            return []

    @component.output_types(documents=List[Document])
    def run(self, query: str):
        dense = self._dense(query)
        if dense:
            return {"documents": dense}
        documents = self._all_docs()
        return {"documents": _lexical_rank(query, documents, self.top_k)}


def _index_documents(config: dict, stores: Tuple[object, Optional[object]]) -> Tuple[List[Document], int]:
    primary_store, secondary_store = stores
    texts = config.get("extracted_texts", []) or []
    documents = [_document_from_text(text) for text in texts if str(text or "").strip()]
    if not documents:
        return [], 0

    chunk_size = max(100, int(config.get("chunkSize", 700)))
    splitter = DocumentSplitter(split_by="word", split_length=chunk_size, split_overlap=max(1, int(chunk_size * 0.1)))
    split_docs = splitter.run(documents=documents).get("documents", documents)

    key = (config.get("apiKeys", {}) or {}).get("openai") or (config.get("apiKeys", {}) or {}).get("mistral")
    embedder = _warm(get_document_embedder(config.get("embeddingModel", "bge-local"), key))
    if embedder:
        embedded = embedder.run(documents=split_docs).get("documents", split_docs)
    else:
        # A lexical-only explicit memory store can still function, but an embedding
        # store must not pretend indexing succeeded without embeddings.
        if not isinstance(primary_store, InMemoryDocumentStore):
            raise RuntimeError("Document embedding model is unavailable; vector indexing cannot continue.")
        embedded = split_docs

    write_documents(primary_store, embedded)
    if secondary_store is not None:
        write_documents(secondary_store, embedded)
    return documents, len(embedded)


def build_and_deploy_pipeline(config: dict) -> Tuple[str, Pipeline]:
    rag_type = config.get("ragType", "basic")
    store = create_document_store(config)
    if isinstance(store, tuple):
        primary_store, secondary_store = store
    else:
        primary_store, secondary_store = store, None

    original_documents, indexed_count = _index_documents(config, (primary_store, secondary_store))
    retriever = PlainTextRetriever(primary_store, config)
    llm_key = (
        (config.get("apiKeys", {}) or {}).get("openai")
        or (config.get("apiKeys", {}) or {}).get("anthropic")
        or (config.get("apiKeys", {}) or {}).get("mistral")
        or (config.get("apiKeys", {}) or {}).get("gemini")
    )
    generator = get_generator(config.get("llmModel", "qwen-local"), llm_key)
    if generator is None:
        raise RuntimeError("The selected LLM generator could not be initialized.")

    builder = get_pipeline_builder(rag_type)
    if not builder:
        raise ValueError(f"No pipeline builder is registered for RAG type '{rag_type}'.")

    result = builder(primary_store, config, retriever, generator)
    pipeline = result["pipeline"]
    pipeline_id = f"pipe_{uuid.uuid4().hex[:8]}"
    specialized_pipeline_info[pipeline_id] = {"rag_type": rag_type, **result}

    if rag_type == "structured" and original_documents:
        graph_store = result.get("graph_store")
        extractor = result.get("extractor")
        if graph_store and extractor:
            graph_store.build_from_documents(original_documents, extractor)

    active_pipelines[pipeline_id] = pipeline
    pipeline_metadata[pipeline_id] = {
        "rag_name": config.get("ragName", ""),
        "rag_type": rag_type,
        "db_type": config.get("dbType", "local"),
        "cloud_db": config.get("cloudDb", ""),
        "local_db": config.get("localDb", "chroma"),
        "store_class": type(primary_store).__name__,
        "llm_model": config.get("llmModel", "qwen-local"),
        "llm_display": get_model_display_name(config.get("llmModel", "qwen-local")),
        "embedding_model": config.get("embeddingModel", "bge-local"),
        "chunk_size": int(config.get("chunkSize", 700)),
        "top_k": int(config.get("topK", 6)),
        "use_reranker": bool(config.get("useReranker", False)),
        "features": list(config.get("features", []) or []),
        "explainability": bool(config.get("explainability", False)),
        "privacy_mode": bool(config.get("privacyMode", False)),
        "deployment_type": config.get("deploymentType", "api"),
        "scrape_mode": config.get("scrapeMode", "static"),
        "documents_count": len(original_documents),
        "indexed_chunks": indexed_count,
        "is_specialized": True,
        "dynamic_config": config.get("dynamicConfig", {}) or {},
        "pipeline_capabilities": result.get("meta", {}),
    }
    logger.info("Built %s as %s using %s", pipeline_id, rag_type, type(primary_store).__name__)
    return pipeline_id, pipeline


def _generic_query(pipeline: Pipeline, query: str) -> str:
    try:
        result = pipeline.run({
            "retriever": {"query": query},
            "prompt_builder": {"query": query},
        })
        replies = result.get("llm", {}).get("replies", [])
        return str(replies[0]).strip() if replies else "No response generated."
    except Exception as exc:
        logger.exception("Generic RAG execution failed")
        return f"Error executing pipeline: {exc}"


def query_pipeline(pipeline_id: str, query: str, audio_base64: str = None, llm_override: dict = None) -> dict:
    pipeline = active_pipelines.get(pipeline_id)
    if not pipeline:
        return {"answer": "Error: Pipeline not found or has been stopped."}

    # Custom LLM overrides remain best-effort; failure never discards the RAG.
    if llm_override:
        try:
            replacement = get_generator(
                llm_override.get("model", ""),
                llm_override.get("api_key"),
                base_url=llm_override.get("base_url") or None,
            )
            if replacement and "llm" in list(pipeline.graph.nodes):
                pipeline.inputs()  # force graph validation before replacement attempt
                current = pipeline.get_component("llm")
                if hasattr(current, "update_model"):
                    current.update_model(replacement)
        except Exception as exc:
            logger.warning("LLM override could not be applied: %s", exc)

    meta = pipeline_metadata.get(pipeline_id, {})
    rag_type = meta.get("rag_type", "basic")
    spec = specialized_pipeline_info.get(pipeline_id, {})
    model = meta.get("llm_model", "unknown")

    try:
        with track_query(pipeline_id, query, rag_type, model) as ctx:
            if rag_type == "crosslingual":
                from .pipeline_modules.cross_lingual_pipeline import execute_cross_lingual_query
                answer = execute_cross_lingual_query(spec, query)
                ctx.response = answer
                return {"answer": answer}
            if rag_type == "voice":
                from .pipeline_modules.voice_pipeline import execute_voice_query
                result = execute_voice_query(spec, query, audio_base64)
                ctx.response = result["text_answer"]
                return {"answer": result["text_answer"], "text_query": result["text_query"], "audio_response": result.get("audio_response", "")}
            if rag_type == "agentic":
                from .pipeline_modules.agentic_pipeline import execute_agentic_query
                answer = execute_agentic_query(spec, query)
                ctx.response = answer
                return {"answer": answer}
            if rag_type == "structured":
                from .pipeline_modules.graph_pipeline import execute_graph_query
                answer = execute_graph_query(spec, query)
                ctx.response = answer
                return {"answer": answer}
            if rag_type == "conversational":
                from .pipeline_modules.conversational_pipeline import execute_conversational_query
                answer = execute_conversational_query(spec, pipeline_id, query)
                ctx.response = answer
                return {"answer": answer}

            # basic/hybrid/citation/realtime/personalized/multimodal all expose the
            # normal pipeline contract through AdvancedRetriever.
            answer = _generic_query(pipeline, query)
            ctx.response = answer
            return {"answer": answer}
    except Exception as exc:
        logger.exception("Pipeline execution error")
        return {"answer": f"Error executing pipeline: {exc}"}


def _specialized_graph_nodes(rag_type: str):
    if rag_type == "crosslingual":
        from .pipeline_modules.cross_lingual_pipeline import get_cross_lingual_graph_nodes
        return get_cross_lingual_graph_nodes()
    if rag_type == "voice":
        from .pipeline_modules.voice_pipeline import get_voice_graph_nodes
        return get_voice_graph_nodes()
    if rag_type == "agentic":
        from .pipeline_modules.agentic_pipeline import get_agentic_graph_nodes
        return get_agentic_graph_nodes()
    if rag_type == "structured":
        from .pipeline_modules.graph_pipeline import get_graph_pipeline_nodes
        return get_graph_pipeline_nodes()
    if rag_type == "conversational":
        from .pipeline_modules.conversational_pipeline import get_conversational_graph_nodes
        return get_conversational_graph_nodes()
    return {}


def get_pipeline_graph(pipeline_id: str) -> dict:
    meta = pipeline_metadata.get(pipeline_id, {})
    if not meta:
        return {"nodes": [], "edges": []}
    rag_type = meta.get("rag_type", "basic")
    db = meta.get("local_db") if meta.get("db_type") == "local" else meta.get("cloud_db")
    nodes = [
        {"id": "ingestion", "label": f"Knowledge Sources ({meta.get('documents_count', 0)})", "type": "ingestion"},
        {"id": "preprocessing", "label": f"Chunk + metadata ({meta.get('chunk_size', 700)})", "type": "processor"},
        {"id": "embedder", "label": f"Embedder: {meta.get('embedding_model')}", "type": "embedder"},
        {"id": "doc_store", "label": f"Store: {db} / {meta.get('store_class')}", "type": "database"},
        {"id": "retriever", "label": f"{rag_type.title()} retrieval · top {meta.get('top_k', 6)}", "type": "retriever"},
        {"id": "prompt_builder", "label": f"Grounding: {rag_type.title()} RAG", "type": "processor"},
        {"id": "llm", "label": f"LLM: {meta.get('llm_display', 'Unknown')}", "type": "llm"},
        {"id": "deployment", "label": f"Response ({str(meta.get('deployment_type', 'api')).upper()})", "type": "deployment"},
    ]
    edges = [
        {"source": "ingestion", "target": "preprocessing"},
        {"source": "preprocessing", "target": "embedder"},
        {"source": "embedder", "target": "doc_store"},
        {"source": "doc_store", "target": "retriever"},
        {"source": "retriever", "target": "prompt_builder"},
        {"source": "prompt_builder", "target": "llm"},
        {"source": "llm", "target": "deployment"},
    ]

    special = _specialized_graph_nodes(rag_type)
    existing = {n["id"] for n in nodes}
    for node in special.get("extra_nodes", []):
        if node.get("id") not in existing:
            nodes.append(node)
            existing.add(node.get("id"))
    for remove in special.get("remove_edges", []):
        edges = [e for e in edges if not (e.get("source") == remove.get("source") and e.get("target") == remove.get("target"))]
    edges.extend(special.get("extra_edges", []))
    edges.extend(special.get("post_edges", []))

    auto = meta.get("autopilot") or {}
    if auto.get("enabled"):
        nodes.insert(1, {"id": "autopilot", "label": f"Autopilot · {auto.get('state', 'watching')} · gen {auto.get('generation', 0)}", "type": "processor"})
        edges = [e for e in edges if not (e["source"] == "ingestion" and e["target"] == "preprocessing")]
        edges.extend([
            {"source": "ingestion", "target": "autopilot"},
            {"source": "autopilot", "target": "preprocessing"},
        ])
    return {"nodes": nodes, "edges": edges}

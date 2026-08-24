"""Truthful vector-store factory.

A requested production store must either initialize successfully or fail with a clear
error. The previous silent InMemory fallback could make a cloud deployment appear
successful while losing persistence; that behavior is intentionally removed.
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import List, Tuple, Union

from haystack import Document
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.document_stores.types import DuplicatePolicy

logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent.parent
STORES_DIR = BACKEND_DIR / "data" / "stores"
STORES_DIR.mkdir(parents=True, exist_ok=True)


def _embedding_dim(config: dict) -> int:
    model = config.get("embeddingModel", "bge-local")
    return {
        "bge-local": 384,
        "openai-ada": 1536,
        "mistral-embed": 1024,
    }.get(model, int((config.get("dynamicConfig", {}) or {}).get("embeddingDimension", 384)))


def _collection(config: dict) -> str:
    value = str(config.get("ragName") or f"rag_{uuid.uuid4().hex[:8]}")
    return "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in value)[:120]


def _secret(token: str | None):
    if not token:
        return None
    try:
        from haystack.utils import Secret
        return Secret.from_token(token)
    except Exception:
        return token


def _chroma(config: dict):
    try:
        from haystack_integrations.document_stores.chroma import ChromaDocumentStore
        path = STORES_DIR / "chroma"
        path.mkdir(parents=True, exist_ok=True)
        return ChromaDocumentStore(collection_name=_collection(config), persist_path=str(path))
    except Exception as exc:
        raise RuntimeError(f"ChromaDB could not be initialized. Install chromadb + chroma-haystack. Detail: {exc}") from exc


def _faiss(config: dict):
    try:
        from haystack_integrations.document_stores.faiss import FAISSDocumentStore
        return FAISSDocumentStore(embedding_dim=_embedding_dim(config))
    except Exception as exc:
        raise RuntimeError(f"FAISS could not be initialized. Install faiss-cpu + faiss-haystack. Detail: {exc}") from exc


def _qdrant(config: dict):
    try:
        from haystack_integrations.document_stores.qdrant import QdrantDocumentStore
        dynamic = config.get("dynamicConfig", {}) or {}
        url = dynamic.get("qdrantUrl") or os.environ.get("QDRANT_URL")
        token = (config.get("apiKeys", {}) or {}).get("qdrant") or os.environ.get("QDRANT_API_KEY")
        if not url:
            raise ValueError("Qdrant URL is required (dynamicConfig.qdrantUrl or QDRANT_URL)")
        kwargs = {
            "url": url,
            "index": _collection(config),
            "embedding_dim": _embedding_dim(config),
            "recreate_index": False,
            "return_embedding": True,
        }
        if token:
            kwargs["api_key"] = _secret(token)
        return QdrantDocumentStore(**kwargs)
    except Exception as exc:
        raise RuntimeError(f"Qdrant could not be initialized. Install qdrant-haystack and configure URL/key. Detail: {exc}") from exc


def _elasticsearch(config: dict):
    try:
        from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore
        dynamic = config.get("dynamicConfig", {}) or {}
        host = dynamic.get("elasticsearchUrl") or os.environ.get("ELASTICSEARCH_URL")
        if not host:
            raise ValueError("Elasticsearch URL is required")
        return ElasticsearchDocumentStore(hosts=[host], index=_collection(config))
    except Exception as exc:
        raise RuntimeError(f"Elasticsearch could not be initialized. Install elasticsearch-haystack and configure URL. Detail: {exc}") from exc


def _pinecone(config: dict):
    try:
        from haystack_integrations.document_stores.pinecone import PineconeDocumentStore
        token = (config.get("apiKeys", {}) or {}).get("pinecone") or os.environ.get("PINECONE_API_KEY")
        if not token:
            raise ValueError("Pinecone API key is required")
        return PineconeDocumentStore(api_key=_secret(token), index=_collection(config), dimension=_embedding_dim(config))
    except Exception as exc:
        raise RuntimeError(f"Pinecone could not be initialized. Install pinecone-haystack and configure a key. Detail: {exc}") from exc


def _weaviate(config: dict):
    try:
        from haystack_integrations.document_stores.weaviate import WeaviateDocumentStore
        dynamic = config.get("dynamicConfig", {}) or {}
        url = dynamic.get("weaviateUrl") or os.environ.get("WEAVIATE_URL")
        if not url:
            raise ValueError("Weaviate URL is required")
        token = (config.get("apiKeys", {}) or {}).get("weaviate") or os.environ.get("WEAVIATE_API_KEY")
        kwargs = {"url": url, "collection_settings": {"class": _collection(config)}}
        if token:
            kwargs["auth_client_secret"] = token
        return WeaviateDocumentStore(**kwargs)
    except Exception as exc:
        raise RuntimeError(f"Weaviate could not be initialized. Install weaviate-haystack and configure URL/key. Detail: {exc}") from exc


def _pgvector(config: dict):
    try:
        from haystack_integrations.document_stores.pgvector import PgvectorDocumentStore
        dynamic = config.get("dynamicConfig", {}) or {}
        conn = dynamic.get("pgvectorUrl") or os.environ.get("PGVECTOR_CONNECTION_STRING")
        if not conn:
            raise ValueError("PGVector connection string is required")
        return PgvectorDocumentStore(
            connection_string=conn,
            table_name=_collection(config),
            embedding_dimension=_embedding_dim(config),
            recreate_table=False,
        )
    except Exception as exc:
        raise RuntimeError(f"PGVector could not be initialized. Install pgvector-haystack and configure a connection. Detail: {exc}") from exc


def _redis(config: dict):
    try:
        from haystack_integrations.document_stores.redis import RedisDocumentStore
        dynamic = config.get("dynamicConfig", {}) or {}
        url = dynamic.get("redisUrl") or os.environ.get("REDIS_URL")
        if not url:
            raise ValueError("Redis URL is required")
        return RedisDocumentStore(redis_url=url, index_name=_collection(config), embedding_dim=_embedding_dim(config))
    except Exception as exc:
        raise RuntimeError(f"Redis vector store could not be initialized. Install redis-haystack and configure URL. Detail: {exc}") from exc


def _make(kind: str, config: dict):
    kind = (kind or "").lower()
    if kind == "chroma": return _chroma(config)
    if kind == "faiss": return _faiss(config)
    if kind == "qdrant": return _qdrant(config)
    if kind == "elasticsearch": return _elasticsearch(config)
    if kind == "pinecone": return _pinecone(config)
    if kind == "weaviate": return _weaviate(config)
    if kind == "pgvector": return _pgvector(config)
    if kind == "redis": return _redis(config)
    if kind in ("memory", "inmemory"): return InMemoryDocumentStore()
    raise ValueError(f"Unsupported vector store '{kind}'")


def create_document_store(config: dict) -> Union[object, Tuple[object, object]]:
    db_type = (config.get("dbType") or "local").lower()
    if db_type == "local":
        return _make(config.get("localDb", "chroma"), config)
    if db_type == "cloud":
        return _make(config.get("cloudDb", "qdrant"), config)
    if db_type == "hybrid":
        cloud = _make(config.get("cloudDb", "qdrant"), config)
        local = _make(config.get("localDb", "chroma"), config)
        return cloud, local
    raise ValueError(f"Unsupported dbType '{db_type}'")


def write_documents(store, documents: List[Document]):
    try:
        store.write_documents(documents, policy=DuplicatePolicy.OVERWRITE)
        logger.info("Wrote %s documents to %s", len(documents), type(store).__name__)
    except Exception as exc:
        raise RuntimeError(f"Writing documents to {type(store).__name__} failed: {exc}") from exc

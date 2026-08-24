"""Advanced production pipelines for the six formerly prompt-only RAG families.

This module keeps the public Haystack pipeline contract but gives each architecture
real retrieval behavior instead of only changing a prompt:
- basic: dense-first retrieval with lexical fallback
- hybrid: BM25 + dense retrieval with reciprocal-rank fusion
- citation: source-labelled retrieval with deterministic source identifiers
- realtime: hybrid retrieval with freshness boosting
- personalized: profile-aware query expansion + hybrid retrieval
- multimodal: modality-aware retrieval over vision/OCR/audio-enriched documents
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from haystack import Document, Pipeline, component
from haystack.components.builders import PromptBuilder

from ..embedding_service import get_text_embedder

_TOKEN_RE = re.compile(r"[\w-]+", re.UNICODE)
_SOURCE_RE = re.compile(r"^Source:\s*(.+)$", re.MULTILINE)
_UPDATED_RE = re.compile(r"^Updated:\s*(.+)$", re.MULTILINE)


def _tokens(text: str) -> List[str]:
    return [x.lower() for x in _TOKEN_RE.findall(text or "") if len(x) > 1]


def _source_name(doc: Document) -> str:
    if getattr(doc, "meta", None):
        for key in ("source", "url", "file_name", "path"):
            if doc.meta.get(key):
                return str(doc.meta[key])
    match = _SOURCE_RE.search(doc.content or "")
    return match.group(1).strip() if match else "customer-knowledge"


def _updated_at(doc: Document) -> Optional[datetime]:
    raw = None
    if getattr(doc, "meta", None):
        raw = doc.meta.get("updated_at") or doc.meta.get("last_modified")
    if not raw:
        match = _UPDATED_RE.search(doc.content or "")
        raw = match.group(1).strip() if match else None
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _rrf(ranked_lists: Iterable[Tuple[List[Document], float]], top_k: int) -> List[Document]:
    scores: Dict[str, float] = {}
    docs_by_id: Dict[str, Document] = {}
    for docs, weight in ranked_lists:
        for rank, doc in enumerate(docs, 1):
            key = getattr(doc, "id", None) or f"{_source_name(doc)}::{hash(doc.content)}"
            docs_by_id[key] = doc
            scores[key] = scores.get(key, 0.0) + float(weight) / (60.0 + rank)
    ordered = sorted(scores, key=scores.get, reverse=True)
    return [docs_by_id[key] for key in ordered[:top_k]]


def _bm25_rank(query: str, docs: List[Document], limit: int) -> List[Document]:
    if not docs:
        return []
    corpus = [_tokens(doc.content or "") for doc in docs]
    q = _tokens(query)
    if not q:
        return docs[:limit]
    n = len(corpus)
    avgdl = sum(len(x) for x in corpus) / max(n, 1)
    df: Dict[str, int] = {}
    for toks in corpus:
        for tok in set(toks):
            df[tok] = df.get(tok, 0) + 1
    k1, b = 1.5, 0.75
    ranked = []
    for idx, toks in enumerate(corpus):
        freqs: Dict[str, int] = {}
        for tok in toks:
            freqs[tok] = freqs.get(tok, 0) + 1
        score = 0.0
        dl = max(len(toks), 1)
        for term in q:
            tf = freqs.get(term, 0)
            if not tf:
                continue
            idf = math.log(1.0 + (n - df.get(term, 0) + 0.5) / (df.get(term, 0) + 0.5))
            denom = tf + k1 * (1.0 - b + b * dl / max(avgdl, 1.0))
            score += idf * (tf * (k1 + 1.0)) / denom
        ranked.append((score, idx))
    ranked.sort(reverse=True)
    positives = [docs[i] for score, i in ranked if score > 0]
    return (positives or docs)[:limit]


def _cosine(a, b) -> float:
    if a is None or b is None:
        return 0.0
    try:
        dot = sum(float(x) * float(y) for x, y in zip(a, b))
        na = math.sqrt(sum(float(x) * float(x) for x in a))
        nb = math.sqrt(sum(float(y) * float(y) for y in b))
        return dot / (na * nb) if na and nb else 0.0
    except Exception:
        return 0.0


@component
class AdvancedRetriever:
    """One query input, one documents output — compatible with generic Haystack execution."""

    def __init__(self, document_store, dense_retriever, config: dict):
        self.document_store = document_store
        self.dense_retriever = dense_retriever
        self.config = config
        self.rag_type = config.get("ragType", "basic")
        self.top_k = int(config.get("topK", 6))
        self.dynamic = config.get("dynamicConfig", {}) or {}
        self.embedding_model = config.get("embeddingModel", "bge-local")
        self.api_keys = config.get("apiKeys", {}) or {}
        self._query_embedder = None

    def _all_documents(self) -> List[Document]:
        try:
            docs = self.document_store.filter_documents()
            max_docs = int(self.dynamic.get("lexicalCandidateLimit", 5000))
            return list(docs)[:max_docs]
        except Exception:
            return []

    def _dense_rank(self, query: str, docs: List[Document]) -> List[Document]:
        try:
            result = self.dense_retriever.run(query=query)
            out = list(result.get("documents", []))
            if out:
                return out[: self.top_k * 3]
        except Exception:
            pass

        try:
            if self._query_embedder is None:
                self._query_embedder = get_text_embedder(
                    self.embedding_model,
                    self.api_keys.get("openai") or self.api_keys.get("mistral"),
                )
                if self._query_embedder and hasattr(self._query_embedder, "warm_up"):
                    self._query_embedder.warm_up()
            if self._query_embedder:
                emb = self._query_embedder.run(text=query).get("embedding")
                try:
                    result = self.dense_retriever.run(query_embedding=emb)
                    out = list(result.get("documents", []))
                    if out:
                        return out[: self.top_k * 3]
                except Exception:
                    scored = [(_cosine(emb, getattr(doc, "embedding", None)), doc) for doc in docs]
                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [doc for score, doc in scored if score > 0][: self.top_k * 3]
        except Exception:
            pass
        return []

    def _profile_query(self, query: str) -> str:
        profile = self.dynamic.get("currentProfile") or self.dynamic.get("profile") or {}
        if isinstance(profile, dict):
            values = [str(v) for v in profile.values() if v not in (None, "", [], {})]
        elif isinstance(profile, list):
            values = [str(v) for v in profile]
        else:
            values = [str(profile)] if profile else []
        return f"{query} {' '.join(values[:12])}".strip()

    def _freshness_boost(self, docs: List[Document]) -> List[Document]:
        now = datetime.now(timezone.utc)
        scored = []
        for idx, doc in enumerate(docs):
            dt = _updated_at(doc)
            freshness = 0.0
            if dt:
                age_hours = max((now - dt.astimezone(timezone.utc)).total_seconds() / 3600.0, 0.0)
                freshness = 1.0 / (1.0 + age_hours / 24.0)
            scored.append((freshness - idx * 1e-6, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored]

    def _modality_boost(self, query: str, docs: List[Document]) -> List[Document]:
        q = query.lower()
        wants_visual = any(x in q for x in ("image", "photo", "diagram", "chart", "visual", "screenshot"))
        wants_audio = any(x in q for x in ("audio", "voice", "spoken", "recording"))
        scored = []
        for idx, doc in enumerate(docs):
            c = (doc.content or "").lower()
            boost = 0
            if wants_visual and any(x in c for x in ("[image analysis", "[ocr text", "visual snapshot")):
                boost += 2
            if wants_audio and "[audio transcript" in c:
                boost += 2
            scored.append((boost, -idx, doc))
        scored.sort(reverse=True, key=lambda x: (x[0], x[1]))
        return [doc for _, _, doc in scored]

    def _label_sources(self, docs: List[Document]) -> List[Document]:
        labelled = []
        for idx, doc in enumerate(docs, 1):
            source = _source_name(doc)
            prefix = f"[S{idx}] Source: {source}\n"
            content = doc.content or ""
            if not content.startswith(f"[S{idx}]"):
                content = prefix + content
            meta = dict(getattr(doc, "meta", {}) or {})
            meta.update({"source_id": f"S{idx}", "source": source})
            labelled.append(Document(content=content, meta=meta))
        return labelled

    @component.output_types(documents=List[Document])
    def run(self, query: str):
        docs = self._all_documents()
        effective_query = self._profile_query(query) if self.rag_type == "personalized" else query
        lexical = _bm25_rank(effective_query, docs, self.top_k * 3)
        dense = self._dense_rank(effective_query, docs)

        if self.rag_type == "basic":
            fused = _rrf([(dense or lexical, 1.0), (lexical, 0.25)], self.top_k)
        else:
            fused = _rrf([(dense, 1.0), (lexical, 1.0)], self.top_k)

        if self.rag_type == "realtime":
            fused = self._freshness_boost(fused)
        elif self.rag_type == "multimodal":
            fused = self._modality_boost(query, fused)

        fused = self._label_sources(fused)
        return {"documents": fused[: self.top_k]}


def _profile_text(config: dict) -> str:
    profile = (config.get("dynamicConfig", {}) or {}).get("currentProfile") or {}
    if isinstance(profile, dict) and profile:
        return ", ".join(f"{k}: {v}" for k, v in profile.items())
    return "No explicit user profile supplied."


def _prompt_for(config: dict) -> str:
    rag_type = config.get("ragType", "basic")
    common = """
Retrieved evidence:
{% for document in documents %}
{{ document.content }}
{% endfor %}

Question: {{ query }}
"""
    if rag_type == "hybrid":
        return """You are a grounded hybrid-search assistant. The evidence was selected using both lexical BM25 and dense semantic retrieval. Prefer exact matches for identifiers, codes, numbers and names, and semantic evidence for natural-language concepts. If the answer is not supported, say that the knowledge base does not contain enough evidence.""" + common + "\nGrounded answer with source IDs when useful:"
    if rag_type == "citation":
        return """You are an evidence-verification assistant. Every factual statement must be supported by the retrieved evidence and immediately followed by one or more exact source IDs such as [S1]. Never invent a source ID. If evidence is missing or conflicting, say so explicitly. End with a Sources section listing only source IDs that were actually used.""" + common + "\nVerified answer:"
    if rag_type == "realtime":
        return """You are a freshness-aware RAG assistant. Prefer the newest retrieved evidence when sources conflict, mention the relevant Updated timestamp when available, and never claim a live fact that is not present in the evidence. If a source is stale, state that limitation.""" + common + "\nFreshness-grounded answer:"
    if rag_type == "personalized":
        return f"""You are a profile-aware RAG assistant. Adapt usefulness and level of detail to this profile: {_profile_text(config)}. Personalization must never override source truth. If the requested fact is absent from evidence, say so.""" + common + "\nPersonalized grounded answer:"
    if rag_type == "multimodal":
        return """You are a multimodal evidence assistant. Retrieved evidence can include normal text, OCR, image/vision descriptions and audio transcripts. Distinguish visual/audio observations from ordinary text when relevant, and cite the source IDs. Do not infer visual details that were not extracted into evidence.""" + common + "\nMultimodal grounded answer:"
    return """You are a reliable RAG assistant. Answer only from retrieved customer knowledge, use source IDs when available, and say when the evidence is insufficient instead of guessing.""" + common + "\nGrounded answer:"


def build_advanced_pipeline(document_store, config: dict, retriever, generator) -> dict:
    pipeline = Pipeline()
    pipeline.add_component("retriever", AdvancedRetriever(document_store, retriever, config))
    pipeline.add_component("prompt_builder", PromptBuilder(template=_prompt_for(config)))
    pipeline.add_component("llm", generator)
    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder.prompt", "llm.prompt")
    return {
        "pipeline": pipeline,
        "meta": {
            "retrieval": "bm25+dense-rrf" if config.get("ragType") != "basic" else "dense-first+lexical-fallback",
            "source_labelling": True,
            "freshness_aware": config.get("ragType") == "realtime",
            "profile_aware": config.get("ragType") == "personalized",
            "modality_aware": config.get("ragType") == "multimodal",
        },
    }

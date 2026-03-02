"""
Multi-Retriever Aggregator — Merges results from multiple retrievers.
Implements score normalization and configurable merge strategies for hybrid mode.
"""
import logging
from typing import List, Optional
from dataclasses import dataclass

from haystack import Document

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Score Normalization
# ═══════════════════════════════════════════════════════════

def min_max_normalize(scores: List[float]) -> List[float]:
    """Normalize scores to [0, 1] range using min-max."""
    if not scores:
        return []
    min_s = min(scores)
    max_s = max(scores)
    if max_s == min_s:
        return [1.0] * len(scores)
    return [(s - min_s) / (max_s - min_s) for s in scores]


def z_score_normalize(scores: List[float]) -> List[float]:
    """Normalize scores using z-score normalization."""
    if not scores or len(scores) < 2:
        return [1.0] * len(scores)
    mean = sum(scores) / len(scores)
    std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
    if std == 0:
        return [1.0] * len(scores)
    return [(s - mean) / std for s in scores]


# ═══════════════════════════════════════════════════════════
#  Multi-Retriever Aggregator
# ═══════════════════════════════════════════════════════════

class MultiRetrieverAggregator:
    """
    Aggregates results from multiple retrievers with score normalization.

    Merge strategies:
      - union:        All results from all retrievers (deduplicated)
      - intersection: Only results appearing in all retrievers
      - weighted:     Weighted combination of scores from each retriever

    Score normalization:
      - min_max:  Scale to [0, 1]
      - z_score:  Standard z-score normalization
    """

    def __init__(self, strategy: str = "union", normalization: str = "min_max",
                 weights: Optional[List[float]] = None, top_k: int = 10):
        self.strategy = strategy
        self.normalization = normalization
        self.weights = weights
        self.top_k = top_k

    def aggregate(self, result_sets: List[List[Document]]) -> List[Document]:
        """
        Merge multiple sets of retrieval results.

        Args:
            result_sets: List of document lists from different retrievers

        Returns:
            Merged and re-ranked list of documents
        """
        if not result_sets:
            return []

        if len(result_sets) == 1:
            return result_sets[0][:self.top_k]

        # Set default weights (equal weighting)
        weights = self.weights or [1.0 / len(result_sets)] * len(result_sets)

        if self.strategy == "intersection":
            return self._intersection_merge(result_sets, weights)
        elif self.strategy == "weighted":
            return self._weighted_merge(result_sets, weights)
        else:  # union (default)
            return self._union_merge(result_sets, weights)

    def _get_doc_key(self, doc: Document) -> str:
        """Generate a unique key for a document (for deduplication)."""
        if doc.id:
            return doc.id
        # Fallback to content hash
        content = doc.content or ""
        return str(hash(content[:200]))

    def _get_score(self, doc: Document) -> float:
        """Extract score from document metadata."""
        if hasattr(doc, 'score') and doc.score is not None:
            return doc.score
        if doc.meta and 'score' in doc.meta:
            return doc.meta['score']
        return 0.5  # default score

    def _normalize_scores(self, docs: List[Document]) -> List[float]:
        """Normalize scores for a set of documents."""
        scores = [self._get_score(doc) for doc in docs]
        if self.normalization == "z_score":
            return z_score_normalize(scores)
        return min_max_normalize(scores)

    def _union_merge(self, result_sets: List[List[Document]],
                     weights: List[float]) -> List[Document]:
        """Union: all unique documents, scored by max weighted score."""
        doc_scores = {}  # key -> (Document, max_weighted_score)

        for i, docs in enumerate(result_sets):
            norm_scores = self._normalize_scores(docs)
            for doc, score in zip(docs, norm_scores):
                key = self._get_doc_key(doc)
                weighted_score = score * weights[i]
                if key not in doc_scores or weighted_score > doc_scores[key][1]:
                    doc_scores[key] = (doc, weighted_score)

        # Sort by score descending
        sorted_docs = sorted(doc_scores.values(), key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in sorted_docs[:self.top_k]]

    def _intersection_merge(self, result_sets: List[List[Document]],
                            weights: List[float]) -> List[Document]:
        """Intersection: only documents appearing in all result sets."""
        # Find keys in each set
        key_sets = []
        doc_map = {}
        for docs in result_sets:
            keys = set()
            for doc in docs:
                key = self._get_doc_key(doc)
                keys.add(key)
                doc_map[key] = doc
            key_sets.append(keys)

        # Intersection of all key sets
        common_keys = key_sets[0]
        for ks in key_sets[1:]:
            common_keys = common_keys.intersection(ks)

        # Score the intersection documents
        scored_docs = []
        for key in common_keys:
            total_score = 0.0
            for i, docs in enumerate(result_sets):
                for doc in docs:
                    if self._get_doc_key(doc) == key:
                        total_score += self._get_score(doc) * weights[i]
                        break
            scored_docs.append((doc_map[key], total_score))

        sorted_docs = sorted(scored_docs, key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in sorted_docs[:self.top_k]]

    def _weighted_merge(self, result_sets: List[List[Document]],
                        weights: List[float]) -> List[Document]:
        """Weighted: combine normalized scores from all retrievers."""
        doc_scores = {}  # key -> (Document, total_weighted_score)

        for i, docs in enumerate(result_sets):
            norm_scores = self._normalize_scores(docs)
            for doc, score in zip(docs, norm_scores):
                key = self._get_doc_key(doc)
                weighted_score = score * weights[i]
                if key in doc_scores:
                    doc_scores[key] = (doc, doc_scores[key][1] + weighted_score)
                else:
                    doc_scores[key] = (doc, weighted_score)

        sorted_docs = sorted(doc_scores.values(), key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in sorted_docs[:self.top_k]]

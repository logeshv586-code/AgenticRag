"""
Memory Manager — Shared memory system for Conversational RAG.
Supports buffer memory (last N exchanges) and summary memory (LLM-summarized history).
Thread-safe per-pipeline storage.
"""
import threading
import logging
from typing import List, Dict, Optional
from collections import deque

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════
#  Thread-safe Memory Store
# ═══════════════════════════════════════════════════════════

_memory_store: Dict[str, "BaseMemory"] = {}
_lock = threading.Lock()


class BaseMemory:
    """Abstract base for memory implementations."""

    def add_exchange(self, user_msg: str, assistant_msg: str):
        raise NotImplementedError

    def get_context(self) -> str:
        raise NotImplementedError

    def clear(self):
        raise NotImplementedError


class BufferMemory(BaseMemory):
    """
    Stores the last N exchanges verbatim.
    Fast, no LLM cost, but context window grows linearly.
    """

    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.history: deque = deque(maxlen=window_size)

    def add_exchange(self, user_msg: str, assistant_msg: str):
        self.history.append({"user": user_msg, "assistant": assistant_msg})

    def get_context(self) -> str:
        if not self.history:
            return ""
        lines = []
        for ex in self.history:
            lines.append(f"User: {ex['user']}")
            lines.append(f"Assistant: {ex['assistant']}")
        return "\n".join(lines)

    def clear(self):
        self.history.clear()


class SummaryMemory(BaseMemory):
    """
    Keeps a rolling summary of the conversation.
    Uses the LLM to compress old exchanges into a summary string.
    Lower token cost for long conversations.
    """

    def __init__(self, window_size: int = 5, summarizer_fn=None):
        self.window_size = window_size
        self.recent: deque = deque(maxlen=window_size)
        self.summary: str = ""
        self._summarizer_fn = summarizer_fn  # Callable(text) -> summary

    def add_exchange(self, user_msg: str, assistant_msg: str):
        self.recent.append({"user": user_msg, "assistant": assistant_msg})
        # When buffer is full, summarize the oldest half
        if len(self.recent) >= self.window_size:
            self._compress()

    def _compress(self):
        """Compress old exchanges into the running summary."""
        if len(self.recent) < 2:
            return
        # Take the oldest half
        to_summarize = []
        half = len(self.recent) // 2
        for _ in range(half):
            ex = self.recent.popleft()
            to_summarize.append(f"User: {ex['user']}\nAssistant: {ex['assistant']}")

        text_to_summarize = f"Previous summary:\n{self.summary}\n\nNew exchanges:\n" + "\n".join(to_summarize)

        if self._summarizer_fn:
            try:
                self.summary = self._summarizer_fn(text_to_summarize)
            except Exception as e:
                logger.warning(f"Summary compression failed: {e}")
                # Fallback: just concatenate
                self.summary = text_to_summarize[:2000]
        else:
            # No summarizer available — truncate
            self.summary = text_to_summarize[:2000]

    def get_context(self) -> str:
        parts = []
        if self.summary:
            parts.append(f"Conversation summary:\n{self.summary}")
        if self.recent:
            parts.append("Recent exchanges:")
            for ex in self.recent:
                parts.append(f"User: {ex['user']}")
                parts.append(f"Assistant: {ex['assistant']}")
        return "\n".join(parts)

    def clear(self):
        self.recent.clear()
        self.summary = ""


# ═══════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════

def get_or_create_memory(pipeline_id: str, memory_type: str = "buffer",
                         window_size: int = 10, summarizer_fn=None) -> BaseMemory:
    """Get existing memory for a pipeline, or create a new one."""
    with _lock:
        if pipeline_id not in _memory_store:
            if memory_type == "summary":
                _memory_store[pipeline_id] = SummaryMemory(window_size, summarizer_fn)
            else:
                _memory_store[pipeline_id] = BufferMemory(window_size)
            logger.info(f"Created {memory_type} memory for pipeline {pipeline_id} (window={window_size})")
        return _memory_store[pipeline_id]


def clear_memory(pipeline_id: str):
    """Clear memory for a specific pipeline."""
    with _lock:
        if pipeline_id in _memory_store:
            _memory_store[pipeline_id].clear()
            del _memory_store[pipeline_id]


def get_all_memories() -> Dict[str, BaseMemory]:
    """Return all active memories (for observability)."""
    with _lock:
        return dict(_memory_store)

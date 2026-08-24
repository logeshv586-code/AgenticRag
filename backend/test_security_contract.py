"""Dependency-free security contracts for customer deployments."""
from __future__ import annotations

import pathlib
import re
import unittest

BACKEND = pathlib.Path(__file__).resolve().parent
SERVICES = BACKEND / "services"


class SecurityContracts(unittest.TestCase):
    def test_llm_service_contains_no_embedded_provider_tokens(self):
        source = (SERVICES / "llm_service.py").read_text(encoding="utf-8")
        # Common provider token prefixes must never be committed in executable source.
        forbidden = [r"nvapi-[A-Za-z0-9_-]{12,}", r"sk-ant-[A-Za-z0-9_-]{12,}", r"sk-proj-[A-Za-z0-9_-]{12,}"]
        for pattern in forbidden:
            self.assertIsNone(re.search(pattern, source), pattern)
        for env_name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY", "NVIDIA_API_KEY"):
            self.assertIn(env_name, source)

    def test_deployment_metadata_drops_api_keys(self):
        source = (SERVICES / "rag_builder.py").read_text(encoding="utf-8")
        self.assertIn('safe["apiKeys"] = {}', source)
        self.assertIn('safe.pop("extracted_texts", None)', source)

    def test_vector_store_has_no_silent_memory_success(self):
        source = (SERVICES / "vector_store_manager.py").read_text(encoding="utf-8")
        self.assertNotIn("or InMemoryDocumentStore()", source)
        self.assertIn("Unsupported vector store", source)
        self.assertIn("QDRANT_API_KEY", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""Dependency-free source contracts for the self-developing RAG architecture.

These tests deliberately avoid importing Haystack/Playwright so they can run on every
PR. The live build+query matrix remains backend/test_all_rags.py for an environment
with local model/vector dependencies.
"""
from __future__ import annotations

import ast
import pathlib
import unittest

BACKEND = pathlib.Path(__file__).resolve().parent
SERVICES = BACKEND / "services"
PIPELINES = SERVICES / "pipeline_modules"


def text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class SelfDevelopingRagContracts(unittest.TestCase):
    def test_all_eleven_types_have_real_registered_builders(self):
        source = text(PIPELINES / "__init__.py")
        tree = ast.parse(source)
        registry = set()
        standard = None
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "PIPELINE_REGISTRY" and isinstance(node.value, ast.Dict):
                    registry = {key.value for key in node.value.keys if isinstance(key, ast.Constant)}
                if isinstance(target, ast.Name) and target.id == "STANDARD_RAG_TYPES":
                    standard = ast.unparse(node.value)
        self.assertEqual({
            "basic", "hybrid", "citation", "realtime", "personalized", "multimodal",
            "conversational", "agentic", "structured", "crosslingual", "voice",
        }, registry)
        self.assertIn("set()", standard or "")

    def test_hybrid_is_real_bm25_dense_rrf(self):
        source = text(PIPELINES / "advanced_pipeline.py")
        self.assertIn("def _bm25_rank", source)
        self.assertIn("def _rrf", source)
        self.assertIn("[(dense, 1.0), (lexical, 1.0)]", source)

    def test_citations_are_bound_to_retrieved_source_ids(self):
        source = text(PIPELINES / "advanced_pipeline.py")
        self.assertIn('"source_id": f"S{idx}"', source)
        self.assertIn("Never invent a source ID", source)

    def test_realtime_and_multimodal_have_retrieval_behavior(self):
        source = text(PIPELINES / "advanced_pipeline.py")
        self.assertIn("def _freshness_boost", source)
        self.assertIn("def _modality_boost", source)
        self.assertIn("[Visual Snapshot]", source)
        self.assertIn("[Audio Transcript", source)

    def test_personalized_retrieval_uses_profile_context(self):
        source = text(PIPELINES / "advanced_pipeline.py")
        self.assertIn("def _profile_query", source)
        self.assertIn('dynamic.get("currentProfile")', source)

    def test_agentic_is_retrieval_first_llm_planned_and_verified(self):
        source = text(PIPELINES / "agentic_pipeline_v2.py")
        self.assertIn("class LLMPlanner", source)
        self.assertIn("get_tool_readiness", source)
        self.assertIn("Side-effect tool requires explicit confirmation", source)
        self.assertIn("Act as a strict verifier", source)
        self.assertIn('"retrieve_before_plan": True', source)

    def test_autopilot_uses_blue_green_and_last_known_good(self):
        source = text(SERVICES / "rag_autopilot.py")
        self.assertIn("def _swap_pipeline", source)
        self.assertIn("degraded-last-known-good", source)
        self.assertIn("__autov", source)
        self.assertIn("_rehydrate_saved_pipeline", source)

    def test_autopilot_hash_excludes_poll_timestamp(self):
        source = text(SERVICES / "rag_autopilot_runtime.py")
        self.assertIn('"content_hash": _core._sha(raw_text)', source)
        self.assertNotIn('"content_hash": _core._sha(content)', source)
        self.assertIn("static-no-live-sources", source)

    def test_visual_monitor_uses_rendered_screenshot_and_existing_parser(self):
        source = text(SERVICES / "rag_autopilot.py")
        self.assertIn("page.screenshot(full_page=True)", source)
        self.assertIn("summary = parse_document(temp_path)", source)
        self.assertIn("visual_hash", source)

    def test_requested_vector_store_never_silently_becomes_memory(self):
        source = text(SERVICES / "vector_store_manager.py")
        self.assertIn("raise RuntimeError", source)
        self.assertNotIn("or InMemoryDocumentStore()", source)
        self.assertIn("qdrant-haystack", text(BACKEND / "requirements.txt"))

    def test_customer_secrets_are_not_persisted(self):
        source = text(SERVICES / "rag_builder.py")
        self.assertIn('safe["apiKeys"] = {}', source)
        self.assertIn("API/provider secrets are intentionally not exported", source)

    def test_customer_ui_exposes_autopilot_health(self):
        source = text(BACKEND.parent / "chatbotui" / "src" / "ChatRagStudio.jsx")
        for token in ("Continuous source monitoring", "Visual change intelligence", "Allow safe architecture evolution", "Generation", "Last update"):
            self.assertIn(token, source)
        self.assertIn("/api/visualize/", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)

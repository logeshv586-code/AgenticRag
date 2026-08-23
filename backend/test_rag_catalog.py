import ast
import pathlib
import sys
import unittest

BACKEND_DIR = pathlib.Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.rag_catalog import (  # noqa: E402
    RAG_CATALOG,
    SUPPORTED_RAG_TYPES,
    classify_customer_request,
    normalize_rag_type,
    recommended_profile,
    validate_deploy_config,
)


CUSTOMER_MATRIX = {
    "basic": "Create a simple FAQ knowledge base from our product manuals.",
    "hybrid": "I need exact part number and keyword search mixed with semantic technical docs search.",
    "citation": "Build an SOP compliance assistant that cites evidence and sources for every answer.",
    "realtime": "Create a live operations assistant using fresh alerts and realtime information.",
    "personalized": "Make a role based personalized learning assistant using each user's profile and preferences.",
    "multimodal": "Build a multimodal catalog assistant that understands product images, photos and text.",
    "conversational": "Create a customer support chatbot that remembers follow up questions.",
    "agentic": "Build an agentic research workflow that reasons in multiple steps and uses tools.",
    "structured": "Create a knowledge graph assistant that reasons over entities and relationships.",
    "crosslingual": "Build multilingual support for English Tamil and Hindi customers with translation.",
    "voice": "Create a voice hotline assistant that accepts speech and gives spoken answers.",
}


class RagCatalogMatrixTests(unittest.TestCase):
    def test_catalog_has_every_supported_type(self):
        self.assertEqual(set(SUPPORTED_RAG_TYPES), set(RAG_CATALOG))
        self.assertEqual(11, len(SUPPORTED_RAG_TYPES))

    def test_catalog_matches_pipeline_registry_source(self):
        """Detect catalog drift without importing heavyweight Haystack dependencies."""
        module_path = BACKEND_DIR / "services" / "pipeline_modules" / "__init__.py"
        tree = ast.parse(module_path.read_text(encoding="utf-8"))
        specialized = set()
        standard = set()
        for node in tree.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "PIPELINE_REGISTRY" and isinstance(node.value, ast.Dict):
                        specialized = {key.value for key in node.value.keys if isinstance(key, ast.Constant)}
                    if isinstance(target, ast.Name) and target.id == "STANDARD_RAG_TYPES" and isinstance(node.value, ast.Set):
                        standard = {elt.value for elt in node.value.elts if isinstance(elt, ast.Constant)}
        self.assertEqual(set(SUPPORTED_RAG_TYPES), specialized | standard)

    def test_customer_intent_matrix_routes_to_expected_architecture(self):
        for expected, request in CUSTOMER_MATRIX.items():
            with self.subTest(expected=expected):
                actual, reason, confidence = classify_customer_request(request)
                self.assertEqual(expected, actual, reason)
                self.assertGreaterEqual(confidence, 0.60)

    def test_backend_auto_syntax_is_supported(self):
        for expected, request in CUSTOMER_MATRIX.items():
            with self.subTest(expected=expected):
                actual, selection = normalize_rag_type(f"auto::{request}")
                self.assertEqual(expected, actual)
                self.assertEqual("backend-auto", selection["mode"])

    def test_every_type_generates_a_complete_customer_profile(self):
        for rag_type in SUPPORTED_RAG_TYPES:
            with self.subTest(rag_type=rag_type):
                profile = recommended_profile(rag_type)
                self.assertEqual(rag_type, profile["ragType"])
                self.assertGreaterEqual(profile["topK"], 1)
                self.assertGreaterEqual(profile["chunkSize"], 100)
                self.assertIsInstance(profile["features"], list)
                self.assertIsInstance(profile["dynamicConfig"], dict)

    def test_validation_rejects_unknown_rag(self):
        with self.assertRaises(ValueError):
            normalize_rag_type("marketing-only-rag")

    def test_every_matrix_profile_passes_deploy_contract(self):
        for rag_type in SUPPORTED_RAG_TYPES:
            profile = recommended_profile(rag_type)
            config = {
                "ragName": f"matrix-{rag_type}",
                "ragType": rag_type,
                "chunkSize": profile["chunkSize"],
                "topK": profile["topK"],
                "features": profile["features"],
                "dynamicConfig": profile["dynamicConfig"],
            }
            with self.subTest(rag_type=rag_type):
                result = validate_deploy_config(config)
                self.assertTrue(result["valid"], result)
                self.assertEqual(rag_type, result["rag_type"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""Dependency-free security contracts for customer deployments."""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

BACKEND = pathlib.Path(__file__).resolve().parent
REPO = BACKEND.parent
SERVICES = BACKEND / "services"

TOKEN_PATTERNS = {
    "NVIDIA API token": re.compile(r"nvapi-[A-Za-z0-9_-]{12,}"),
    "OpenAI project token": re.compile(r"sk-(?:proj|svcacct)-[A-Za-z0-9_-]{12,}"),
    "Anthropic token": re.compile(r"sk-ant-[A-Za-z0-9_-]{12,}"),
    "GitHub classic token": re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    "GitHub fine-grained token": re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    "AWS access key": re.compile(r"AKIA[A-Z0-9]{16}"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}

ALLOWED_ENV_FILES = {".env.example"}
FORBIDDEN_SECRET_SUFFIXES = {".pem", ".p12", ".pfx", ".keystore"}


def _tracked_paths() -> list[pathlib.Path]:
    """Return committed files only so local untracked .env files do not break tests."""
    try:
        completed = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=REPO,
            check=True,
            capture_output=True,
            text=True,
        )
        return [REPO / item for item in completed.stdout.split("\0") if item]
    except (OSError, subprocess.CalledProcessError):
        return [path for path in REPO.rglob("*") if path.is_file() and ".git" not in path.parts]


def _read_text_if_safe(path: pathlib.Path) -> str | None:
    try:
        if path.stat().st_size > 2_000_000:
            return None
        raw = path.read_bytes()
        if b"\x00" in raw:
            return None
        return raw.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None


class SecurityContracts(unittest.TestCase):
    def test_llm_service_contains_no_embedded_provider_tokens(self):
        source = (SERVICES / "llm_service.py").read_text(encoding="utf-8")
        for label, pattern in TOKEN_PATTERNS.items():
            self.assertIsNone(pattern.search(source), label)
        for env_name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY", "NVIDIA_API_KEY"):
            self.assertIn(env_name, source)

    def test_repository_contains_no_committed_secret_material(self):
        findings: list[str] = []
        for path in _tracked_paths():
            relative = path.relative_to(REPO).as_posix()
            name = path.name.lower()

            if name.startswith(".env") and path.name not in ALLOWED_ENV_FILES:
                findings.append(f"tracked environment file: {relative}")
                continue
            if path.suffix.lower() in FORBIDDEN_SECRET_SUFFIXES or name.endswith(".key"):
                findings.append(f"tracked credential file: {relative}")
                continue

            source = _read_text_if_safe(path)
            if source is None:
                continue
            for label, pattern in TOKEN_PATTERNS.items():
                if pattern.search(source):
                    findings.append(f"{label} pattern in {relative}")

        self.assertEqual([], findings, "Committed secret material detected:\n" + "\n".join(findings))

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

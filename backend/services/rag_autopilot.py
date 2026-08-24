"""RAG Autopilot — continuous source monitoring, vision change detection and blue/green re-indexing.

The supervisor is intentionally conservative:
- it fingerprints sources and only rebuilds when content actually changes;
- a new version is built before the stable customer pipeline is swapped;
- failed rebuilds keep the last-known-good pipeline active;
- visual monitoring is optional and uses the existing local vision/OCR parser;
- configuration evolution is limited to safe retrieval tuning unless the customer
  explicitly enables architecture evolution.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
import threading
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.parse import urlparse

from .document_parser import parse_document
from .scraper import scrape_urls

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
DEPLOYMENTS_DIR = DATA_DIR / "deployments"
DELIMITER = "=" * 50
_ALLOWED_FILE_EXTS = {
    ".pdf", ".txt", ".docx", ".csv", ".html", ".htm", ".md", ".markdown",
    ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp",
    ".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac",
}
_SOURCE_RE = re.compile(r"^Source:\s*(.+)$", re.MULTILINE)

_registry: Dict[str, dict] = {}
_registry_lock = threading.RLock()
_supervisor_thread = None
_started = False
_rehydrate_last_attempt: Dict[str, float] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "rag").strip())
    return value[:100] or "rag"


def _sha(value: bytes | str) -> str:
    raw = value.encode("utf-8", errors="ignore") if isinstance(value, str) else value
    return hashlib.sha256(raw).hexdigest()


def _status_path(rag_name: str) -> Path:
    d = DATA_DIR / _safe_name(rag_name)
    d.mkdir(parents=True, exist_ok=True)
    return d / "autopilot_status.json"


def _manifest_path(rag_name: str) -> Path:
    d = DATA_DIR / _safe_name(rag_name)
    d.mkdir(parents=True, exist_ok=True)
    return d / "autopilot_manifest.json"


def _source_dir(rag_name: str) -> Path:
    d = DATA_DIR / _safe_name(rag_name) / "autopilot_sources"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return deepcopy(default)


def _write_json(path: Path, payload: dict):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _set_runtime_status(pipeline_id: str, status: dict):
    try:
        from . import haystack_service
        if pipeline_id in haystack_service.pipeline_metadata:
            haystack_service.pipeline_metadata[pipeline_id]["autopilot"] = dict(status)
    except Exception:
        pass


def _save_status(pipeline_id: str, rag_name: str, status: dict):
    status = dict(status)
    status["pipeline_id"] = pipeline_id
    status["rag_name"] = rag_name
    _write_json(_status_path(rag_name), status)
    _set_runtime_status(pipeline_id, status)


def _capture_visual(url: str) -> Tuple[str, str]:
    """Return (visual_hash, semantic_visual_summary). Empty values mean unavailable."""
    temp_path = None
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            png = page.screenshot(full_page=True)
            browser.close()
        visual_hash = _sha(png)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as f:
            f.write(png)
            temp_path = f.name
        summary = parse_document(temp_path)
        if summary.startswith("Error parsing"):
            summary = ""
        return visual_hash, summary
    except Exception as exc:
        logger.info("Autopilot visual capture skipped for %s: %s", url, exc)
        return "", ""
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _snapshot_url(source: dict, config: dict) -> List[dict]:
    url = str(source.get("url") or "").strip()
    if not url:
        return []
    mode = source.get("mode") or config.get("scrapeMode") or "static"
    max_pages = int(source.get("maxPages") or config.get("maxPages") or 30)
    texts = scrape_urls([url], mode=mode, max_pages=max_pages)
    updated = _now_iso()
    snapshots = []
    for idx, text in enumerate(texts):
        match = _SOURCE_RE.search(text or "")
        actual_url = match.group(1).strip() if match else (url if idx == 0 else f"{url}#page-{idx+1}")
        content = f"Source: {actual_url}\nUpdated: {updated}\n{text or ''}".strip()
        snapshots.append({
            "key": f"url::{actual_url}",
            "kind": "url",
            "source": actual_url,
            "content": content,
            "content_hash": _sha(content),
            "updated_at": updated,
        })

    vision_enabled = bool(source.get("vision", config.get("vision", True)))
    if vision_enabled:
        visual_hash, summary = _capture_visual(url)
        if visual_hash:
            snapshots.append({
                "key": f"visual::{url}",
                "kind": "visual",
                "source": f"{url}#visual",
                "content": f"Source: {url}#visual\nUpdated: {updated}\n[Visual Snapshot]\n{summary or 'Visual layout changed; no semantic vision text was available.'}",
                "content_hash": _sha(summary or visual_hash),
                "visual_hash": visual_hash,
                "updated_at": updated,
            })
    return snapshots


def _snapshot_folder(folder: str) -> List[dict]:
    path = Path(folder).expanduser()
    if not path.exists() or not path.is_dir():
        return []
    snapshots = []
    for file_path in sorted(path.rglob("*")):
        if not file_path.is_file() or file_path.suffix.lower() not in _ALLOWED_FILE_EXTS:
            continue
        try:
            stat = file_path.stat()
            key = f"file::{file_path.resolve()}"
            fingerprint = _sha(f"{stat.st_mtime_ns}:{stat.st_size}")
            text = parse_document(str(file_path))
            updated = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(timespec="seconds")
            snapshots.append({
                "key": key,
                "kind": "file",
                "source": str(file_path.resolve()),
                "content": f"Source: {file_path.resolve()}\nUpdated: {updated}\n{text}",
                "content_hash": _sha(text + fingerprint),
                "updated_at": updated,
            })
        except Exception as exc:
            logger.warning("Could not monitor %s: %s", file_path, exc)
    return snapshots


def _source_belongs_to_monitored_url(source: str, urls: Iterable[str]) -> bool:
    try:
        parsed = urlparse(source)
        for root in urls:
            rp = urlparse(root)
            if parsed.netloc and rp.netloc and parsed.netloc == rp.netloc:
                root_path = (rp.path or "/").rstrip("/")
                if (parsed.path or "/").startswith(root_path):
                    return True
    except Exception:
        return False
    return False


def _static_parts(rag_name: str, monitored_urls: List[str], watched_folders: List[str]) -> List[str]:
    path = DATA_DIR / _safe_name(rag_name) / "scraped_data.txt"
    if not path.exists():
        return []
    parts = [x.strip() for x in path.read_text(encoding="utf-8", errors="ignore").split(DELIMITER) if x.strip()]
    out = []
    roots = [str(Path(x).expanduser().resolve()) for x in watched_folders if x]
    for part in parts:
        match = _SOURCE_RE.search(part)
        source = match.group(1).strip() if match else ""
        if source and _source_belongs_to_monitored_url(source, monitored_urls):
            continue
        if source and any(source.startswith(root) for root in roots):
            continue
        if "[Visual Snapshot]" in part and _source_belongs_to_monitored_url(source.split("#visual")[0], monitored_urls):
            continue
        out.append(part)
    return out


def _persist_snapshot(rag_name: str, snap: dict) -> str:
    filename = _sha(snap["key"])[:24] + ".txt"
    path = _source_dir(rag_name) / filename
    path.write_text(snap["content"], encoding="utf-8")
    return str(path.relative_to(DATA_DIR / _safe_name(rag_name)))


def _load_manifest_content(rag_name: str, entry: dict) -> str:
    rel = entry.get("content_file")
    if not rel:
        return ""
    path = DATA_DIR / _safe_name(rag_name) / rel
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def _build_corpus(rag_name: str, manifest: dict, monitored_urls: List[str], watched_folders: List[str]) -> List[str]:
    corpus = _static_parts(rag_name, monitored_urls, watched_folders)
    for key in sorted(manifest.get("sources", {})):
        text = _load_manifest_content(rag_name, manifest["sources"][key])
        if text.strip():
            corpus.append(text.strip())
    return corpus


def _adaptive_tune(config: dict, corpus: List[str], manifest: dict) -> Tuple[dict, List[str]]:
    evolved = deepcopy(config)
    recommendations = []
    chars = sum(len(x) for x in corpus)
    count = len(corpus)
    if chars > 2_000_000:
        evolved["chunkSize"] = max(int(evolved.get("chunkSize", 700)), 900)
        evolved["topK"] = max(int(evolved.get("topK", 6)), 8)
        recommendations.append("Large corpus detected: increased chunk size/top-K for broader retrieval context.")
    elif chars > 500_000 or count > 100:
        evolved["topK"] = max(int(evolved.get("topK", 6)), 7)
        recommendations.append("Growing corpus detected: increased retrieval depth.")

    auto = (evolved.get("dynamicConfig", {}) or {}).get("autopilot", {}) or {}
    if auto.get("allowArchitectureEvolution"):
        visual_sources = sum(1 for item in manifest.get("sources", {}).values() if item.get("kind") == "visual")
        if visual_sources and evolved.get("ragType") in ("basic", "hybrid"):
            evolved["ragType"] = "multimodal"
            recommendations.append("Architecture evolved to multimodal because monitored visual evidence is present.")
        elif auto.get("sources") and evolved.get("ragType") == "basic":
            evolved["ragType"] = "realtime"
            recommendations.append("Architecture evolved to realtime because continuous web monitoring is enabled.")
    return evolved, recommendations


def _swap_pipeline(stable_id: str, new_id: str):
    from . import haystack_service
    new_pipeline = haystack_service.active_pipelines.get(new_id)
    if not new_pipeline:
        raise RuntimeError("New pipeline was not registered")
    haystack_service.active_pipelines[stable_id] = new_pipeline
    new_meta = haystack_service.pipeline_metadata.get(new_id, {})
    haystack_service.pipeline_metadata[stable_id] = dict(new_meta)
    if new_id in haystack_service.specialized_pipeline_info:
        haystack_service.specialized_pipeline_info[stable_id] = haystack_service.specialized_pipeline_info[new_id]
    elif stable_id in haystack_service.specialized_pipeline_info:
        haystack_service.specialized_pipeline_info.pop(stable_id, None)
    haystack_service.active_pipelines.pop(new_id, None)
    haystack_service.pipeline_metadata.pop(new_id, None)
    haystack_service.specialized_pipeline_info.pop(new_id, None)


def _cleanup_chroma_versions(rag_name: str, keep: int = 3):
    try:
        import chromadb
        path = DATA_DIR / "stores" / "chroma"
        if not path.exists():
            return
        client = chromadb.PersistentClient(path=str(path))
        prefix = _safe_name(rag_name) + "__autov"
        names = sorted([c.name for c in client.list_collections() if c.name.startswith(prefix)])
        for name in names[:-keep]:
            try:
                client.delete_collection(name)
            except Exception:
                pass
    except Exception:
        pass


def _deployment_meta_path(pipeline_id: str) -> Path:
    return DEPLOYMENTS_DIR / f"{pipeline_id}.json"


def _update_deployment_meta(pipeline_id: str, status: dict, config: dict | None = None):
    path = _deployment_meta_path(pipeline_id)
    payload = _read_json(path, {})
    if not payload:
        return
    payload.setdefault("deployment", {})["autopilot"] = status
    if config:
        safe = deepcopy(config)
        safe.pop("extracted_texts", None)
        safe["apiKeys"] = {}
        payload["config"] = safe
    _write_json(path, payload)


def register_autopilot(pipeline_id: str, config: dict) -> dict:
    auto = (config.get("dynamicConfig", {}) or {}).get("autopilot", {}) or {}
    if not auto.get("enabled"):
        return {"enabled": False, "state": "disabled"}
    interval = max(60, int(auto.get("intervalSeconds", 900)))
    rag_name = config.get("ragName", "RAG")
    status = _read_json(_status_path(rag_name), {
        "enabled": True,
        "state": "watching",
        "generation": 0,
        "last_check": None,
        "last_update": None,
        "next_check": None,
        "changed_sources": [],
        "source_count": 0,
        "vision_enabled": bool(auto.get("vision", True)),
        "last_error": None,
        "recommendations": [],
        "active_architecture": config.get("ragType"),
    })
    status.update({"enabled": True, "state": "watching", "vision_enabled": bool(auto.get("vision", True))})
    with _registry_lock:
        _registry[pipeline_id] = {
            "pipeline_id": pipeline_id,
            "config": deepcopy(config),
            "interval": interval,
            "next_check": time.time() + min(interval, 15),
            "status": status,
        }
    _save_status(pipeline_id, rag_name, status)
    start_runtime_supervisor()
    return status


def _refresh_one(entry: dict):
    pipeline_id = entry["pipeline_id"]
    config = deepcopy(entry["config"])
    rag_name = config.get("ragName", "RAG")
    auto = (config.get("dynamicConfig", {}) or {}).get("autopilot", {}) or {}
    status = dict(entry.get("status", {}))
    status.update({"state": "checking", "last_check": _now_iso(), "last_error": None})
    _save_status(pipeline_id, rag_name, status)

    manifest = _read_json(_manifest_path(rag_name), {"generation": 0, "sources": {}})
    old_sources = manifest.get("sources", {})
    new_sources = dict(old_sources)
    seen = set()
    snapshots = []

    url_sources = auto.get("sources", []) or []
    monitored_urls = [str(x.get("url")) for x in url_sources if isinstance(x, dict) and x.get("url")]
    for source in url_sources:
        if isinstance(source, dict) and source.get("url"):
            snapshots.extend(_snapshot_url(source, {**auto, "scrapeMode": config.get("scrapeMode", "static")}))
    watched_folders = [str(x) for x in (auto.get("watchedFolders", []) or []) if x]
    for folder in watched_folders:
        snapshots.extend(_snapshot_folder(folder))

    changed = []
    for snap in snapshots:
        key = snap["key"]
        seen.add(key)
        previous = old_sources.get(key, {})
        is_changed = previous.get("content_hash") != snap.get("content_hash") or previous.get("visual_hash") != snap.get("visual_hash")
        if is_changed:
            changed.append(snap["source"])
            content_file = _persist_snapshot(rag_name, snap)
            new_sources[key] = {
                "kind": snap.get("kind"),
                "source": snap.get("source"),
                "content_hash": snap.get("content_hash"),
                "visual_hash": snap.get("visual_hash", ""),
                "updated_at": snap.get("updated_at"),
                "content_file": content_file,
            }

    for key in list(old_sources):
        if (key.startswith("url::") or key.startswith("visual::") or key.startswith("file::")) and key not in seen:
            changed.append(old_sources[key].get("source", key) + " (removed)")
            new_sources.pop(key, None)

    manifest["sources"] = new_sources
    status["source_count"] = len(new_sources)
    status["changed_sources"] = changed[:50]

    if not changed and old_sources:
        status.update({"state": "fresh", "next_check": datetime.fromtimestamp(time.time() + entry["interval"], tz=timezone.utc).isoformat(timespec="seconds")})
        entry["status"] = status
        _save_status(pipeline_id, rag_name, status)
        return

    manifest["generation"] = int(manifest.get("generation", 0)) + 1
    corpus = _build_corpus(rag_name, manifest, monitored_urls, watched_folders)
    evolved, recommendations = _adaptive_tune(config, corpus, manifest)
    build_cfg = deepcopy(evolved)
    build_cfg["extracted_texts"] = corpus
    build_cfg["ragName"] = f"{_safe_name(rag_name)}__autov{manifest['generation']:04d}"

    status.update({"state": "reindexing", "generation": manifest["generation"], "recommendations": recommendations})
    _save_status(pipeline_id, rag_name, status)

    try:
        from .haystack_service import build_and_deploy_pipeline
        new_id, _ = build_and_deploy_pipeline(build_cfg)
        _swap_pipeline(pipeline_id, new_id)
        _write_json(_manifest_path(rag_name), manifest)
        raw_path = DATA_DIR / _safe_name(rag_name) / "scraped_data.txt"
        raw_path.write_text((f"\n\n{DELIMITER}\n\n").join(corpus), encoding="utf-8")
        status.update({
            "state": "fresh",
            "last_update": _now_iso(),
            "next_check": datetime.fromtimestamp(time.time() + entry["interval"], tz=timezone.utc).isoformat(timespec="seconds"),
            "last_error": None,
            "active_architecture": evolved.get("ragType"),
            "documents": len(corpus),
        })
        entry["config"] = evolved
        entry["status"] = status
        _save_status(pipeline_id, rag_name, status)
        _update_deployment_meta(pipeline_id, status, evolved)
        _cleanup_chroma_versions(rag_name)
    except Exception as exc:
        logger.exception("Autopilot rebuild failed for %s", rag_name)
        status.update({
            "state": "degraded-last-known-good",
            "last_error": str(exc),
            "next_check": datetime.fromtimestamp(time.time() + min(entry["interval"], 300), tz=timezone.utc).isoformat(timespec="seconds"),
        })
        entry["status"] = status
        _save_status(pipeline_id, rag_name, status)
        _update_deployment_meta(pipeline_id, status)


def _load_corpus_from_disk(rag_name: str) -> List[str]:
    path = DATA_DIR / _safe_name(rag_name) / "scraped_data.txt"
    if not path.exists():
        return []
    return [x.strip() for x in path.read_text(encoding="utf-8", errors="ignore").split(DELIMITER) if x.strip()]


def _rehydrate_saved_pipeline(path: Path):
    payload = _read_json(path, {})
    pipeline_id = payload.get("pipeline_id")
    config = payload.get("config") or {}
    if not pipeline_id or not config.get("ragName"):
        return
    from . import haystack_service
    if pipeline_id in haystack_service.active_pipelines:
        return
    last = _rehydrate_last_attempt.get(pipeline_id, 0)
    if time.time() - last < 60:
        return
    _rehydrate_last_attempt[pipeline_id] = time.time()
    try:
        build_cfg = deepcopy(config)
        build_cfg["apiKeys"] = {}
        build_cfg["extracted_texts"] = _load_corpus_from_disk(config["ragName"])
        if not build_cfg["extracted_texts"]:
            return
        from .haystack_service import build_and_deploy_pipeline
        new_id, _ = build_and_deploy_pipeline(build_cfg)
        _swap_pipeline(pipeline_id, new_id)
        status = _read_json(_status_path(config["ragName"]), {})
        if status:
            _set_runtime_status(pipeline_id, status)
        register_autopilot(pipeline_id, build_cfg)
        logger.info("Rehydrated persisted RAG pipeline %s", pipeline_id)
    except Exception as exc:
        logger.warning("Could not rehydrate %s yet: %s", pipeline_id, exc)


def _discover_persisted():
    DEPLOYMENTS_DIR.mkdir(parents=True, exist_ok=True)
    for path in DEPLOYMENTS_DIR.glob("pipe_*.json"):
        _rehydrate_saved_pipeline(path)


def _loop():
    while True:
        try:
            _discover_persisted()
            with _registry_lock:
                entries = list(_registry.values())
            now = time.time()
            for entry in entries:
                if now < entry.get("next_check", 0):
                    continue
                entry["next_check"] = now + entry["interval"]
                try:
                    _refresh_one(entry)
                except Exception as exc:
                    logger.exception("Autopilot monitor error")
                    cfg = entry.get("config", {})
                    rag_name = cfg.get("ragName", "RAG")
                    status = dict(entry.get("status", {}))
                    status.update({"state": "monitor-error", "last_error": str(exc), "last_check": _now_iso()})
                    entry["status"] = status
                    _save_status(entry["pipeline_id"], rag_name, status)
        except Exception:
            logger.exception("RAG Autopilot supervisor loop error")
        time.sleep(5)


def start_runtime_supervisor():
    global _started, _supervisor_thread
    with _registry_lock:
        if _started and _supervisor_thread and _supervisor_thread.is_alive():
            return
        _started = True
        _supervisor_thread = threading.Thread(target=_loop, name="rag-autopilot", daemon=True)
        _supervisor_thread.start()
        logger.info("RAG Autopilot supervisor started")

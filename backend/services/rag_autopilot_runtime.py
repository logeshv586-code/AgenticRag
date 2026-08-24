"""Runtime hardening layer for RAG Autopilot.

Keeps source timestamps as metadata while hashing only actual content, and prevents
empty source configurations from causing repeated rebuilds.  This module patches
those runtime hooks before exposing the public Autopilot API.
"""
from __future__ import annotations

from copy import deepcopy

from . import rag_autopilot as _core

_ORIGINAL_REFRESH = _core._refresh_one


def _snapshot_url(source: dict, config: dict):
    url = str(source.get("url") or "").strip()
    if not url:
        return []
    mode = source.get("mode") or config.get("scrapeMode") or "static"
    max_pages = int(source.get("maxPages") or config.get("maxPages") or 30)
    texts = _core.scrape_urls([url], mode=mode, max_pages=max_pages)
    updated = _core._now_iso()
    snapshots = []
    for idx, text in enumerate(texts):
        raw_text = (text or "").strip()
        match = _core._SOURCE_RE.search(raw_text)
        actual_url = match.group(1).strip() if match else (url if idx == 0 else f"{url}#page-{idx+1}")
        # The timestamp is useful for freshness, but must NOT participate in the
        # content fingerprint or every poll would be detected as a change.
        content = f"Source: {actual_url}\nUpdated: {updated}\n{raw_text}".strip()
        snapshots.append({
            "key": f"url::{actual_url}",
            "kind": "url",
            "source": actual_url,
            "content": content,
            "content_hash": _core._sha(raw_text),
            "updated_at": updated,
        })

    vision_enabled = bool(source.get("vision", config.get("vision", True)))
    if vision_enabled:
        visual_hash, summary = _core._capture_visual(url)
        if visual_hash:
            semantic = (summary or "").strip()
            snapshots.append({
                "key": f"visual::{url}",
                "kind": "visual",
                "source": f"{url}#visual",
                "content": (
                    f"Source: {url}#visual\nUpdated: {updated}\n[Visual Snapshot]\n"
                    f"{semantic or 'Visual layout changed; no semantic vision text was available.'}"
                ),
                # Semantic vision output is preferred; raw screenshot hash remains a
                # second independent signal for visual-only changes.
                "content_hash": _core._sha(semantic) if semantic else visual_hash,
                "visual_hash": visual_hash,
                "updated_at": updated,
            })
    return snapshots


def _refresh_one(entry: dict):
    config = deepcopy(entry.get("config", {}))
    auto = (config.get("dynamicConfig", {}) or {}).get("autopilot", {}) or {}
    live_urls = [x for x in (auto.get("sources", []) or []) if isinstance(x, dict) and x.get("url")]
    folders = [x for x in (auto.get("watchedFolders", []) or []) if str(x).strip()]
    if not live_urls and not folders:
        status = dict(entry.get("status", {}))
        status.update({
            "enabled": False,
            "state": "static-no-live-sources",
            "last_check": _core._now_iso(),
            "changed_sources": [],
            "last_error": None,
        })
        entry["status"] = status
        _core._save_status(entry["pipeline_id"], config.get("ragName", "RAG"), status)
        return
    return _ORIGINAL_REFRESH(entry)


# Patch the core module globals used by its already-defined supervisor loop.
_core._snapshot_url = _snapshot_url
_core._refresh_one = _refresh_one

register_autopilot = _core.register_autopilot
start_runtime_supervisor = _core.start_runtime_supervisor

__all__ = ["register_autopilot", "start_runtime_supervisor"]

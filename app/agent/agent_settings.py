"""Runtime-editable AI agent settings.

The admin console's "AI Agent Settings" page writes these; the live agent
reads them at runtime. They're persisted as a small JSON file so they survive
restarts without a DB migration, and so backups can capture them alongside
``routing.yaml`` / ``config.kofon.js``.

Single source of truth: both ``app.routers.admin_spa`` (the admin GET/PUT) and
the agent nodes import :func:`get_agent_settings` from here.

Connected knobs (see callers):
  * ``agent_name``                  → injected into every LLM system prompt
                                      (``app.agent.llm.system_message``).
  * ``enabled_languages``           → which user language picks the agent
                                      honors (``app.i18n._norm``); others fall
                                      back to the default language.
  * ``auto_create_lead``            → gates CRM lead creation on a 'sell'
                                      outcome (``app.sideeffects.handlers``).
  * ``require_confidence_threshold``→ routes low-confidence post-sales fixes to
                                      a human (``app.agent.nodes.postsales_fix_gate``).
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from app.i18n import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES

log = logging.getLogger(__name__)

# Backend root (…/app/agent/agent_settings.py → parents[2] == repo root).
_SETTINGS_PATH = Path(__file__).resolve().parents[2] / "agent_settings.json"

DEFAULTS: dict[str, Any] = {
    "agent_name": "KOFON Product Expert",
    # Language codes (a subset of app.i18n.SUPPORTED_LANGUAGES) the agent will
    # honor. A user pick outside this set falls back to DEFAULT_LANGUAGE. Default
    # to every supported language so enabling the setting doesn't silently
    # disable any language the agent already speaks — admins trim from here.
    "enabled_languages": list(SUPPORTED_LANGUAGES),
    # Auto-create a CRM sales lead (RFQ + division email) on a 'sell' outcome.
    "auto_create_lead": True,
    # Route low-confidence post-sales fixes to a human instead of claiming the
    # issue resolved.
    "require_confidence_threshold": True,
}

_lock = threading.Lock()
_cache: dict[str, Any] | None = None
_cache_mtime: float | None = None


def _coerce(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Merge stored values over the defaults, validating each field so a
    hand-edited or partial file can never hand the agent a bad value."""
    out = dict(DEFAULTS)
    if not isinstance(raw, dict):
        return out

    name = raw.get("agent_name")
    if isinstance(name, str) and name.strip():
        out["agent_name"] = name.strip()[:80]

    langs = raw.get("enabled_languages")
    if isinstance(langs, list):
        clean = [
            code
            for code in (str(x).upper() for x in langs)
            if code in SUPPORTED_LANGUAGES
        ]
        # The default language is the universal fallback — never let it be
        # toggled off, or disabled-everything would strand the agent.
        if DEFAULT_LANGUAGE not in clean:
            clean.append(DEFAULT_LANGUAGE)
        # De-dupe while preserving order.
        out["enabled_languages"] = list(dict.fromkeys(clean))

    for flag in ("auto_create_lead", "require_confidence_threshold"):
        if flag in raw:
            out[flag] = bool(raw[flag])

    return out


def _load_from_disk() -> dict[str, Any]:
    try:
        return _coerce(json.loads(_SETTINGS_PATH.read_text(encoding="utf-8")))
    except FileNotFoundError:
        return dict(DEFAULTS)
    except Exception:  # noqa: BLE001 — bad settings must never break the agent
        log.exception(
            "agent_settings: failed to read %s, falling back to defaults",
            _SETTINGS_PATH,
        )
        return dict(DEFAULTS)


def get_agent_settings() -> dict[str, Any]:
    """Return the current settings, reloading when the file changes on disk.

    Returns a fresh copy so callers can't mutate the cache.
    """
    global _cache, _cache_mtime
    try:
        mtime: float | None = _SETTINGS_PATH.stat().st_mtime
    except OSError:
        mtime = None
    with _lock:
        if _cache is None or mtime != _cache_mtime:
            _cache = _load_from_disk()
            _cache_mtime = mtime
        return dict(_cache)


def update_agent_settings(patch: dict[str, Any]) -> dict[str, Any]:
    """Validate + persist a partial update; return the full new settings."""
    global _cache, _cache_mtime
    with _lock:
        merged = _coerce({**_load_from_disk(), **(patch or {})})
        _SETTINGS_PATH.write_text(
            json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        _cache = merged
        try:
            _cache_mtime = _SETTINGS_PATH.stat().st_mtime
        except OSError:
            _cache_mtime = None
        return dict(merged)

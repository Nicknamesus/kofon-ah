"""Backup the bot's content + config into a downloadable archive.

What's included (portable, no external tools, no secrets):
  - `seed/` — the full catalog/KB exported from the DB (round-trips via
    `app.seed.load --force`).
  - `routing.yaml` — divisions + lead routing.
  - `widget/config.kofon.js` — widget configuration.
  - `MANIFEST.txt` — timestamp + row counts.

`.env` / secrets are intentionally excluded. For full-fidelity production
backups (LangGraph checkpoints, conversation history, exact ids) add a
`pg_dump` step — see ADMIN_INTERFACE_PLAN.md §5.
"""

from __future__ import annotations

import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from app.admin.export_seed import export
from app.config import get_settings
from app.db import SessionLocal

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _backup_dir() -> Path:
    raw = get_settings().admin_backup_dir
    p = Path(raw)
    if not p.is_absolute():
        p = _BACKEND_ROOT / p
    p.mkdir(parents=True, exist_ok=True)
    return p


async def create_backup() -> Path:
    """Build a tar.gz under the backup dir and return its path."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_path = _backup_dir() / f"kofon-backup-{stamp}.tar.gz"

    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp) / "kofon-backup"
        seed_out = staging / "seed"
        async with SessionLocal() as session:
            counts = await export(session, seed_out)

        # routing.yaml + widget config (best-effort copies).
        routing = _BACKEND_ROOT / "app" / "sideeffects" / "routing.yaml"
        if routing.exists():
            (staging / "routing.yaml").write_text(
                routing.read_text(encoding="utf-8"), encoding="utf-8"
            )
        widget_cfg = _BACKEND_ROOT / "widget" / "config.kofon.js"
        if widget_cfg.exists():
            (staging / "config.kofon.js").write_text(
                widget_cfg.read_text(encoding="utf-8"), encoding="utf-8"
            )
        agent_cfg = _BACKEND_ROOT / "agent_settings.json"
        if agent_cfg.exists():
            (staging / "agent_settings.json").write_text(
                agent_cfg.read_text(encoding="utf-8"), encoding="utf-8"
            )

        manifest = [f"Kofon backup — {stamp} UTC", "", "Row counts:"]
        manifest += [f"  {k}: {v}" for k, v in counts.items()]
        manifest.append("")
        manifest.append("Restore: extract, copy seed/ over the backend seed/, "
                        "then `python -m app.seed.load --force`.")
        (staging / "MANIFEST.txt").write_text("\n".join(manifest), encoding="utf-8")

        with tarfile.open(out_path, "w:gz") as tar:
            tar.add(staging, arcname="kofon-backup")

    return out_path


def list_backups() -> list[dict]:
    out = []
    for p in sorted(_backup_dir().glob("kofon-backup-*.tar.gz"), reverse=True):
        st = p.stat()
        out.append({
            "name": p.name,
            "size_kb": round(st.st_size / 1024, 1),
            "created_at": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(),
        })
    return out


def backup_path(name: str) -> Path | None:
    """Resolve a backup file name safely (no path traversal)."""
    if "/" in name or "\\" in name or ".." in name:
        return None
    p = _backup_dir() / name
    if p.exists() and p.is_file():
        return p
    return None

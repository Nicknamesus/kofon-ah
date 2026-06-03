"""Append-only audit logging for admin actions."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminAuditLog, AdminUser


async def record(
    session: AsyncSession,
    *,
    user: AdminUser | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    diff: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    """Add an audit row to `session` (committed by the caller's transaction)."""
    session.add(
        AdminAuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            diff=diff,
            ip=ip,
        )
    )

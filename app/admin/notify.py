"""Publish helper bridging the side-effect handlers to the admin feed.

`stage_*` builds the durable `notifications` row inside the caller's session
(so it commits atomically with the RFQ/Ticket) and returns an event dict. The
caller publishes that dict to the in-process bus *after* its commit, so SSE
subscribers never see an uncommitted notification.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import notify_bus
from app.models import Notification

log = logging.getLogger(__name__)


async def stage_sell(
    session: AsyncSession,
    *,
    conversation_id: int | None,
    rfq_id: int | None,
    division_code: str | None,
    sku: str | None,
    company: str | None,
) -> dict[str, Any]:
    who = company or "a visitor"
    sku_bit = f" for {sku}" if sku else ""
    summary = f"New sales lead from {who}{sku_bit}"
    payload = {
        "rfq_id": rfq_id,
        "sku": sku,
        "company": company,
        "division_code": division_code,
        "conversation_id": conversation_id,
    }
    row = Notification(
        kind="sell",
        conversation_id=conversation_id,
        ref_table="rfqs",
        ref_id=rfq_id,
        division_code=division_code,
        summary=summary,
        payload=payload,
    )
    session.add(row)
    await session.flush()
    return _event(row)


async def stage_human_handoff(
    session: AsyncSession,
    *,
    conversation_id: int | None,
    ticket_id: int | None,
    division_code: str | None,
    reason: str | None,
    priority: str | None,
    company: str | None,
) -> dict[str, Any]:
    who = company or "a visitor"
    summary = f"Human handoff requested by {who} ({reason or 'unspecified'})"
    payload = {
        "ticket_id": ticket_id,
        "reason": reason,
        "priority": priority,
        "company": company,
        "division_code": division_code,
        "conversation_id": conversation_id,
    }
    row = Notification(
        kind="human_handoff",
        conversation_id=conversation_id,
        ref_table="tickets",
        ref_id=ticket_id,
        division_code=division_code,
        summary=summary,
        payload=payload,
    )
    session.add(row)
    await session.flush()
    return _event(row)


def _event(row: Notification) -> dict[str, Any]:
    # created_at is a server_default, so it isn't populated until after commit;
    # fall back to "now" for the live event payload.
    from datetime import datetime, timezone

    created = row.created_at or datetime.now(timezone.utc)
    return {
        "id": row.id,
        "kind": row.kind,
        "summary": row.summary,
        "division_code": row.division_code,
        "conversation_id": row.conversation_id,
        "ref_table": row.ref_table,
        "ref_id": row.ref_id,
        "created_at": created.isoformat(),
    }


def publish(event: dict[str, Any]) -> None:
    """Push to the live bus. Best-effort — never breaks the caller."""
    try:
        notify_bus.publish(event)
    except Exception:  # noqa: BLE001
        log.exception("notify.publish failed")

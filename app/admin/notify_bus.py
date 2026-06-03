"""In-process pub/sub for live admin notifications.

Producers (the side-effect handlers) call `publish(event)`; subscribers (the
SSE endpoint) iterate `subscribe()`. Fan-out is in-memory, so it only reaches
SSE clients connected to *this* process — fine for the current single-worker
`python -m app.serve`. The durable record lives in the `notifications` table,
so nothing is lost if no one is watching; when we go multi-worker, swap this
module for Postgres LISTEN/NOTIFY without touching callers.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

log = logging.getLogger(__name__)

_subscribers: set[asyncio.Queue[dict[str, Any]]] = set()


def publish(event: dict[str, Any]) -> None:
    """Push an event to every live subscriber. Never raises."""
    for q in list(_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:  # slow consumer — drop, it'll resync on reload
            log.warning("notify_bus: subscriber queue full, dropping event")
        except Exception:  # noqa: BLE001
            log.exception("notify_bus: failed to enqueue event")


async def subscribe() -> "asyncio.Queue[dict[str, Any]]":
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
    _subscribers.add(q)
    return q


def unsubscribe(q: "asyncio.Queue[dict[str, Any]]") -> None:
    _subscribers.discard(q)

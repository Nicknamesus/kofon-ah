"""Admin-interface tables — accounts, sessions, audit, notifications.

These back the `/admin` web app (see `ADMIN_INTERFACE_PLAN.md`). None of
them are touched by the agent itself; they exist purely so Kofon staff can
manage the bot without editing code.

- `admin_users`      — one row per staff login. Role drives RBAC.
- `admin_sessions`   — server-side session tokens (revocable). The cookie
                        carries the raw token; we store only its sha256.
- `admin_audit_log`  — append-only record of every mutating admin action.
- `notifications`    — durable feed item; one row per sell / human-handoff
                        so the admin page shows unread state across reloads.

See `alembic/versions/b5d7e9f10234_admin_interface.py`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AdminUser(Base):
    """A staff account that can log into `/admin`.

    `role` is one of the bundle codes in `app.admin.security.PERMISSIONS`
    ('superadmin' | 'editor' | 'sales' | 'viewer'). The first superadmin is
    created by `python -m app.admin.bootstrap`; everyone else is created from
    the UI by a superadmin.
    """

    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_by_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )


class AdminSession(Base):
    """A login session. The cookie holds the raw token; we keep only its
    sha256 so a DB leak doesn't hand out live sessions."""

    __tablename__ = "admin_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("admin_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    csrf_token: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text)


class AdminAuditLog(Base):
    """Append-only audit trail. With DB-authoritative content, this is the
    real 'who changed what' record (git no longer captures edits)."""

    __tablename__ = "admin_audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    user_email: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(Text)
    entity_id: Mapped[str | None] = mapped_column(Text)
    diff: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        Index("ix_admin_audit_log_created_at", "created_at"),
    )


class Notification(Base):
    """A durable admin feed item — one per sell / human-handoff.

    The in-process bus (`app.admin.notify_bus`) pushes live; this table is
    what the page replays on load and what tracks read/unread.
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)  # sell | human_handoff
    conversation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="SET NULL"),
        index=True,
    )
    ref_table: Mapped[str | None] = mapped_column(Text)  # rfqs | tickets
    ref_id: Mapped[int | None] = mapped_column(BigInteger)
    division_code: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_by_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin_users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        Index("ix_notifications_created_at", "created_at"),
        Index(
            "ix_notifications_unread",
            "created_at",
            postgresql_where=text("read_at IS NULL"),
        ),
    )

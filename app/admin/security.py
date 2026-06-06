"""Auth primitives for the admin app: password hashing, session tokens, RBAC.

Design (see ADMIN_INTERFACE_PLAN.md §2):
  - Passwords hashed with argon2 (passlib).
  - Sessions are server-side + revocable: a random token lives in the cookie,
    only its sha256 is stored in `admin_sessions`. A per-session CSRF token
    guards state-changing requests.
  - RBAC is role bundles → permission strings. `superadmin` holds the wildcard.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AdminSession, AdminUser

_pwd = CryptContext(schemes=["argon2"], deprecated="auto")

# ---- RBAC ----------------------------------------------------------------

WILDCARD = "*"

# Every permission the app checks. Grouped by area for readability.
PERMISSIONS_ALL = {
    "users.manage",        # create/disable admin accounts
    "content.read",        # view catalog/KB
    "content.write",       # edit catalog/KB
    "routing.write",       # edit routing.yaml (divisions/inboxes)
    "conversations.read",  # view conversation history
    "notifications.read",  # see + ack the sales/handoff feed
    "settings.write",      # edit AI Agent Settings (name, languages, behavior)
    "export.run",          # export DB content back to seed YAML
    "backup.run",          # create/download backups
    "restart.run",         # restart the bot (deferred — see §6)
}

# Role bundles. The first account is `superadmin`; it creates the rest.
PERMISSIONS: dict[str, set[str]] = {
    "superadmin": {WILDCARD},
    "editor": {
        "content.read",
        "content.write",
        "routing.write",
        "conversations.read",
        "notifications.read",
        "settings.write",
        "export.run",
    },
    "sales": {
        "content.read",
        "conversations.read",
        "notifications.read",
    },
    "viewer": {
        "content.read",
        "conversations.read",
        "notifications.read",
    },
}

ROLES = list(PERMISSIONS.keys())


def role_can(role: str, permission: str) -> bool:
    perms = PERMISSIONS.get(role, set())
    return WILDCARD in perms or permission in perms


def user_can(user: AdminUser, permission: str) -> bool:
    return bool(user.is_active) and role_can(user.role, permission)


# ---- passwords -----------------------------------------------------------


def hash_password(plaintext: str) -> str:
    return _pwd.hash(plaintext)


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plaintext, hashed)
    except Exception:  # noqa: BLE001 — malformed hash, etc.
        return False


# ---- session tokens ------------------------------------------------------


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_session(
    session: AsyncSession,
    user: AdminUser,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, AdminSession]:
    """Create a session row, returning the raw cookie token + the row.

    The raw token is shown to the caller exactly once (to set the cookie);
    only its hash is persisted.
    """
    raw_token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    ttl = get_settings().admin_session_ttl_hours
    row = AdminSession(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        csrf_token=csrf,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl),
        ip=ip,
        user_agent=(user_agent or "")[:500] or None,
    )
    session.add(row)
    await session.flush()
    return raw_token, row


async def resolve_session(
    session: AsyncSession, raw_token: str | None
) -> tuple[AdminUser, AdminSession] | None:
    """Look up a live (non-revoked, non-expired) session + its user."""
    if not raw_token:
        return None
    row = (
        await session.execute(
            select(AdminSession).where(
                AdminSession.token_hash == _hash_token(raw_token)
            )
        )
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        return None
    if row.expires_at <= datetime.now(timezone.utc):
        return None
    user = (
        await session.execute(
            select(AdminUser).where(AdminUser.id == row.user_id)
        )
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user, row


async def revoke_session(session: AsyncSession, row: AdminSession) -> None:
    row.revoked_at = datetime.now(timezone.utc)
    await session.flush()


async def touch_last_login(session: AsyncSession, user_id: int) -> None:
    await session.execute(
        update(AdminUser)
        .where(AdminUser.id == user_id)
        .values(last_login_at=datetime.now(timezone.utc))
    )

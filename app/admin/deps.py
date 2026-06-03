"""FastAPI dependencies for the admin app: auth, RBAC, CSRF.

Pages and API share the same auth. On failure we raise `HTTPException(401)`;
`app.routers.admin` registers a handler that redirects browser page requests
to the login screen and returns JSON 401 for `/admin/api/*` (so htmx can
react). 403 (authenticated but lacking a permission) renders a small notice.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.admin import security
from app.config import get_settings
from app.db import SessionLocal
from app.models import AdminSession, AdminUser


@dataclass
class AdminContext:
    user: AdminUser
    session: AdminSession

    def can(self, permission: str) -> bool:
        return security.user_can(self.user, permission)


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def require_admin(request: Request) -> AdminContext:
    """Resolve the logged-in admin from the session cookie, or 401."""
    cookie_name = get_settings().admin_cookie_name
    raw = request.cookies.get(cookie_name)
    # A fresh detached read so the dependency owns its own session lifecycle.
    async with SessionLocal() as db:
        resolved = await security.resolve_session(db, raw)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated"
            )
        user, sess = resolved
        # Detach so the objects stay usable after the session closes.
        db.expunge(user)
        db.expunge(sess)
    return AdminContext(user=user, session=sess)


def require_perm(permission: str):
    """Dependency factory: require `permission` (403 if missing)."""

    async def _dep(ctx: AdminContext = Depends(require_admin)) -> AdminContext:
        if not ctx.can(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"missing permission: {permission}",
            )
        return ctx

    return _dep


async def require_csrf(
    request: Request, ctx: AdminContext = Depends(require_admin)
) -> AdminContext:
    """Guard state-changing requests. htmx sends the per-session token in the
    `X-CSRF-Token` header (set via hx-headers on <body>). Plain forms may send
    it as the `csrf_token` field instead.
    """
    submitted = request.headers.get("x-csrf-token")
    if not submitted:
        # Fall back to a form field without consuming a JSON body.
        ctype = request.headers.get("content-type", "")
        if "application/x-www-form-urlencoded" in ctype or "multipart/form-data" in ctype:
            form = await request.form()
            submitted = form.get("csrf_token")  # type: ignore[assignment]
    if not submitted or submitted != ctx.session.csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="bad or missing CSRF token"
        )
    return ctx

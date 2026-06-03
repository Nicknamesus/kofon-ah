"""Shared Jinja2 environment + render helper for admin pages."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.admin.deps import AdminContext
from app.admin.registry import REGISTRY
from app.admin.security import PERMISSIONS

_TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))

# Left-nav definition: (label, url, required-permission).
NAV = [
    ("Dashboard", "/admin", None),
    ("Notifications", "/admin/notifications", "notifications.read"),
    ("Products", "/admin/content/products", "content.read"),
    ("Product families", "/admin/content/product_types", "content.read"),
    ("Problem types", "/admin/content/problem_types", "content.read"),
    ("Solutions", "/admin/content/solutions", "content.read"),
    ("Use cases", "/admin/content/use_cases", "content.read"),
    ("Use-case fits", "/admin/content/use_case_product_types", "content.read"),
    ("Conversation branches", "/admin/content/main_conversation_types", "content.read"),
    ("Routing & divisions", "/admin/routing", "routing.write"),
    ("Audit log", "/admin/audit", "users.manage"),
    ("Users", "/admin/users", "users.manage"),
    ("Backups", "/admin/backups", "backup.run"),
]


def render(
    request: Request,
    template: str,
    ctx: AdminContext,
    context: dict[str, Any] | None = None,
    *,
    status_code: int = 200,
) -> HTMLResponse:
    base = {
        "request": request,
        "user": ctx.user,
        "csrf_token": ctx.session.csrf_token,
        "nav": [item for item in NAV if item[2] is None or ctx.can(item[2])],
        "can": ctx.can,
        "registry": REGISTRY,
        "permissions": PERMISSIONS,
    }
    if context:
        base.update(context)
    return templates.TemplateResponse(
        request=request, name=template, context=base, status_code=status_code
    )

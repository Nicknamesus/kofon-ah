"""Admin web app — page routes (HTML) + login/logout + auth redirect handler.

Mutations / SSE / downloads live in `app.routers.admin_api`. Both are wired
into `app.main` *before* the catch-all `/` static mount.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Form, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import func, select
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.admin import security
from app.admin.deps import AdminContext, _client_ip, require_admin, require_perm
from app.admin.registry import (
    REGISTRY,
    coerce_pk,
    fk_labels,
    fk_options,
    get_row,
    list_rows,
    row_to_form,
)
from app.admin.templating import render, templates
from app.config import get_settings
from app.db import SessionLocal
from app.models import (
    AdminAuditLog,
    AdminUser,
    Conversation,
    Notification,
    ProblemType,
    Product,
)

router = APIRouter(prefix="/admin", tags=["admin-pages"])

# ---- tiny in-memory login rate limiter (per IP) --------------------------
_LOGIN_ATTEMPTS: dict[str, list[float]] = {}
_LOGIN_WINDOW_S = 300
_LOGIN_MAX = 10


def _rate_limited(ip: str) -> bool:
    now = time.time()
    hits = [t for t in _LOGIN_ATTEMPTS.get(ip, []) if now - t < _LOGIN_WINDOW_S]
    _LOGIN_ATTEMPTS[ip] = hits
    return len(hits) >= _LOGIN_MAX


def _record_attempt(ip: str) -> None:
    _LOGIN_ATTEMPTS.setdefault(ip, []).append(time.time())


# ---- auth exception handler (registered on the app in main.py) -----------


async def admin_exception_handler(request: Request, exc: StarletteHTTPException):
    """Redirect unauthenticated *page* requests to the login screen; keep the
    default JSON behavior for the API and the rest of the app."""
    path = request.url.path
    if (
        exc.status_code == status.HTTP_401_UNAUTHORIZED
        and path.startswith("/admin")
        and not path.startswith("/admin/api")
        and path != "/admin/login"
    ):
        return RedirectResponse("/admin/login", status_code=status.HTTP_303_SEE_OTHER)
    return JSONResponse(
        {"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers
    )


# ---- login / logout ------------------------------------------------------


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(
        request=request, name="login.html", context={"error": None}
    )


@router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
):
    ip = _client_ip(request) or "unknown"
    if _rate_limited(ip):
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={"error": "Too many attempts. Wait a few minutes."},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    _record_attempt(ip)

    email_norm = email.strip().lower()
    settings = get_settings()
    async with SessionLocal() as session:
        user = (
            await session.execute(
                select(AdminUser).where(AdminUser.email == email_norm)
            )
        ).scalar_one_or_none()
        if (
            user is None
            or not user.is_active
            or not security.verify_password(password, user.password_hash)
        ):
            return templates.TemplateResponse(
                request=request,
                name="login.html",
                context={"error": "Invalid credentials."},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        raw_token, _ = await security.create_session(
            session, user, ip=ip, user_agent=request.headers.get("user-agent")
        )
        await security.touch_last_login(session, user.id)
        await session.commit()

    resp = RedirectResponse("/admin", status_code=status.HTTP_303_SEE_OTHER)
    resp.set_cookie(
        settings.admin_cookie_name,
        raw_token,
        httponly=True,
        secure=settings.admin_cookie_secure,
        samesite="lax",
        max_age=settings.admin_session_ttl_hours * 3600,
        path="/admin",
    )
    return resp


# ---- dashboard -----------------------------------------------------------


@router.get("", response_class=HTMLResponse, name="dashboard")
@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def dashboard_view(request: Request, ctx: AdminContext = Depends(require_admin)):
    async with SessionLocal() as session:
        n_products = (
            await session.execute(select(func.count()).select_from(Product))
        ).scalar_one()
        n_problems = (
            await session.execute(select(func.count()).select_from(ProblemType))
        ).scalar_one()
        n_convos = (
            await session.execute(select(func.count()).select_from(Conversation))
        ).scalar_one()
        n_unread = (
            await session.execute(
                select(func.count()).select_from(Notification).where(
                    Notification.read_at.is_(None)
                )
            )
        ).scalar_one()
        recent = (
            await session.execute(
                select(Notification).order_by(Notification.created_at.desc()).limit(8)
            )
        ).scalars().all()
    return render(request, "dashboard.html", ctx, {
        "stats": {
            "products": n_products, "problems": n_problems,
            "conversations": n_convos, "unread": n_unread,
        },
        "recent": recent,
        "embedding_provider": get_settings().embedding_provider,
    })


# ---- notifications page --------------------------------------------------


@router.get("/notifications", response_class=HTMLResponse)
async def notifications_page(
    request: Request, ctx: AdminContext = Depends(require_perm("notifications.read"))
):
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(Notification).order_by(Notification.created_at.desc()).limit(200)
            )
        ).scalars().all()
    return render(request, "notifications.html", ctx, {"notifications": rows})


# ---- generic content pages ----------------------------------------------


@router.get("/content/{key}", response_class=HTMLResponse)
async def content_list(
    request: Request, key: str, ctx: AdminContext = Depends(require_perm("content.read"))
):
    spec = REGISTRY.get(key)
    if spec is None:
        raise StarletteHTTPException(status_code=404, detail="unknown entity")
    q = request.query_params.get("q") or None
    async with SessionLocal() as session:
        rows, total = await list_rows(session, spec, q=q)
        labels = await fk_labels(session, spec)
    return render(request, "content_list.html", ctx, {
        "spec": spec, "rows": rows, "total": total, "q": q or "", "fk_labels": labels,
        "can_write": ctx.can("content.write"),
    })


@router.get("/content/{key}/new", response_class=HTMLResponse)
async def content_new(
    request: Request, key: str, ctx: AdminContext = Depends(require_perm("content.write"))
):
    spec = REGISTRY.get(key)
    if spec is None:
        raise StarletteHTTPException(status_code=404, detail="unknown entity")
    async with SessionLocal() as session:
        fk_opts = await _all_fk_options(session, spec)
    return render(request, "content_form.html", ctx, {
        "spec": spec, "data": {}, "creating": True, "fk_opts": fk_opts, "error": None,
    })


@router.get("/content/{key}/edit", response_class=HTMLResponse)
async def content_edit(
    request: Request, key: str, ctx: AdminContext = Depends(require_perm("content.write"))
):
    spec = REGISTRY.get(key)
    if spec is None:
        raise StarletteHTTPException(status_code=404, detail="unknown entity")
    pk_values = coerce_pk(spec, {col: request.query_params.get(col) for col in spec.pk})
    async with SessionLocal() as session:
        row = await get_row(session, spec, pk_values)
        if row is None:
            raise StarletteHTTPException(status_code=404, detail="record not found")
        data = row_to_form(spec, row)
        fk_opts = await _all_fk_options(session, spec)
    return render(request, "content_form.html", ctx, {
        "spec": spec, "data": data, "creating": False, "fk_opts": fk_opts, "error": None,
    })


async def _all_fk_options(session, spec):
    out = {}
    for f in spec.fields:
        if f.type == "fk" and f.fk_entity:
            out[f.name] = await fk_options(session, f.fk_entity)
    return out


# ---- users ---------------------------------------------------------------


@router.get("/users", response_class=HTMLResponse)
async def users_page(
    request: Request, ctx: AdminContext = Depends(require_perm("users.manage"))
):
    async with SessionLocal() as session:
        rows = (
            await session.execute(select(AdminUser).order_by(AdminUser.created_at))
        ).scalars().all()
    return render(request, "users.html", ctx, {"users": rows, "roles": security.ROLES})


# ---- routing -------------------------------------------------------------


@router.get("/routing", response_class=HTMLResponse)
async def routing_page(
    request: Request, ctx: AdminContext = Depends(require_perm("routing.write"))
):
    from pathlib import Path

    path = Path(get_settings().routing_matrix_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    return render(request, "routing.html", ctx, {"content": content, "error": None})


# ---- audit ---------------------------------------------------------------


@router.get("/audit", response_class=HTMLResponse)
async def audit_page(
    request: Request, ctx: AdminContext = Depends(require_perm("users.manage"))
):
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(300)
            )
        ).scalars().all()
    return render(request, "audit.html", ctx, {"rows": rows})


# ---- backups -------------------------------------------------------------


@router.get("/backups", response_class=HTMLResponse)
async def backups_page(
    request: Request, ctx: AdminContext = Depends(require_perm("backup.run"))
):
    from app.admin.backup import list_backups

    return render(request, "backups.html", ctx, {"backups": list_backups()})

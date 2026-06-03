"""Admin web app — mutations, SSE, downloads.

State-changing routes require both a permission and a valid CSRF token (the
per-session token, sent as the `csrf_token` form field or `X-CSRF-Token`
header). On success they 303-redirect back to the relevant page; on a
validation error they re-render the form with the message.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import yaml
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    StreamingResponse,
)
from sqlalchemy import func, select, update

from app.admin import audit, notify_bus, security
from app.admin.deps import AdminContext, _client_ip, require_admin, require_csrf
from app.admin.registry import (
    REGISTRY,
    ValidationError,
    coerce_form,
    coerce_pk,
    create_row,
    delete_row,
    diff_dict,
    fk_options,
    get_row,
    refresh_embeddings_for,
    row_to_form,
    update_row,
)
from app.admin.templating import render
from app.config import get_settings
from app.db import SessionLocal
from app.models import AdminUser, Notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/api", tags=["admin-api"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _require(ctx: AdminContext, permission: str) -> None:
    if not ctx.can(permission):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=f"missing permission: {permission}")


# ---- logout --------------------------------------------------------------


@router.post("/logout")
async def logout(request: Request, ctx: AdminContext = Depends(require_csrf)):
    async with SessionLocal() as session:
        row = await get_row_session(session, ctx.session.id)
        if row is not None:
            await security.revoke_session(session, row)
            await session.commit()
    resp = RedirectResponse("/admin/login", status_code=status.HTTP_303_SEE_OTHER)
    resp.delete_cookie(get_settings().admin_cookie_name, path="/admin")
    return resp


async def get_row_session(session, session_id: int):
    from app.models import AdminSession
    return (
        await session.execute(select(AdminSession).where(AdminSession.id == session_id))
    ).scalar_one_or_none()


# ---- content save / delete ----------------------------------------------


@router.post("/content/{key}/save")
async def content_save(request: Request, key: str, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "content.write")
    spec = REGISTRY.get(key)
    if spec is None:
        return JSONResponse({"detail": "unknown entity"}, status_code=404)

    form = dict(await request.form())
    creating = form.get("_mode") == "create"
    pk_values = coerce_pk(spec, form)

    try:
        data = coerce_form(spec, form, creating=creating)
    except ValidationError as exc:
        return await _rerender_form(request, ctx, spec, form, creating, str(exc))

    ip = _client_ip(request)
    try:
        async with SessionLocal() as session:
            if creating:
                before = None
                row = await create_row(session, spec, data)
            else:
                existing = await get_row(session, spec, pk_values)
                if existing is None:
                    return JSONResponse({"detail": "record not found"}, status_code=404)
                before = row_to_form(spec, existing)
                row = await update_row(session, spec, pk_values, data)
            await refresh_embeddings_for(session, spec)
            entity_id = "/".join(str(getattr(row, c)) for c in spec.pk)
            await audit.record(
                session, user=ctx.user,
                action="content.create" if creating else "content.update",
                entity_type=spec.key, entity_id=entity_id,
                diff=diff_dict(before, data), ip=ip,
            )
            await session.commit()
    except ValidationError as exc:
        return await _rerender_form(request, ctx, spec, form, creating, str(exc))
    except Exception as exc:  # noqa: BLE001 — surface DB errors (unique, FK) in the form
        logger.exception("content save failed")
        return await _rerender_form(
            request, ctx, spec, form, creating, f"Save failed: {exc.__class__.__name__}: {exc}"
        )

    return RedirectResponse(f"/admin/content/{key}", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/content/{key}/delete")
async def content_delete(request: Request, key: str, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "content.write")
    spec = REGISTRY.get(key)
    if spec is None:
        return JSONResponse({"detail": "unknown entity"}, status_code=404)
    form = dict(await request.form())
    pk_values = coerce_pk(spec, form)
    ip = _client_ip(request)
    try:
        async with SessionLocal() as session:
            existing = await get_row(session, spec, pk_values)
            before = row_to_form(spec, existing) if existing else None
            await delete_row(session, spec, pk_values)
            await refresh_embeddings_for(session, spec)
            await audit.record(
                session, user=ctx.user, action="content.delete",
                entity_type=spec.key, entity_id="/".join(str(v) for v in pk_values.values()),
                diff={"deleted": before}, ip=ip,
            )
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("content delete failed")
        return HTMLResponse(
            f"<p>Delete failed (likely referenced by other rows): {exc}</p>"
            f"<a href='/admin/content/{key}'>Back</a>",
            status_code=400,
        )
    return RedirectResponse(f"/admin/content/{key}", status_code=status.HTTP_303_SEE_OTHER)


async def _rerender_form(request, ctx, spec, form, creating, error):
    async with SessionLocal() as session:
        fk_opts = {
            f.name: await fk_options(session, f.fk_entity)
            for f in spec.fields if f.type == "fk" and f.fk_entity
        }
    return render(request, "content_form.html", ctx, {
        "spec": spec, "data": form, "creating": creating, "fk_opts": fk_opts, "error": error,
    }, status_code=400)


# ---- users ---------------------------------------------------------------


@router.post("/users/create")
async def users_create(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "users.manage")
    form = dict(await request.form())
    email = (form.get("email") or "").strip().lower()
    password = form.get("password") or ""
    role = form.get("role") or ""
    if not email or not password or role not in security.ROLES:
        return RedirectResponse("/admin/users?err=invalid", status_code=303)
    ip = _client_ip(request)
    try:
        async with SessionLocal() as session:
            session.add(AdminUser(
                email=email, password_hash=security.hash_password(password),
                role=role, is_active=True, created_by_id=ctx.user.id,
            ))
            await audit.record(
                session, user=ctx.user, action="user.create",
                entity_type="admin_users", entity_id=email, diff={"role": role}, ip=ip,
            )
            await session.commit()
    except Exception:  # noqa: BLE001 — duplicate email, etc.
        logger.exception("user create failed")
        return RedirectResponse("/admin/users?err=exists", status_code=303)
    return RedirectResponse("/admin/users", status_code=303)


@router.post("/users/toggle")
async def users_toggle(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "users.manage")
    form = dict(await request.form())
    try:
        user_id = int(form.get("user_id"))
    except (TypeError, ValueError):
        return RedirectResponse("/admin/users?err=invalid", status_code=303)
    if user_id == ctx.user.id:
        return RedirectResponse("/admin/users?err=self", status_code=303)

    ip = _client_ip(request)
    async with SessionLocal() as session:
        target = (
            await session.execute(select(AdminUser).where(AdminUser.id == user_id))
        ).scalar_one_or_none()
        if target is None:
            return RedirectResponse("/admin/users?err=missing", status_code=303)
        # Guard: never disable the last active superadmin.
        if target.is_active and target.role == "superadmin":
            others = (
                await session.execute(
                    select(func.count()).select_from(AdminUser).where(
                        AdminUser.role == "superadmin",
                        AdminUser.is_active.is_(True),
                        AdminUser.id != target.id,
                    )
                )
            ).scalar_one()
            if others == 0:
                return RedirectResponse("/admin/users?err=lastadmin", status_code=303)
        new_state = not target.is_active
        await session.execute(
            update(AdminUser).where(AdminUser.id == user_id).values(is_active=new_state)
        )
        await audit.record(
            session, user=ctx.user, action="user.toggle",
            entity_type="admin_users", entity_id=target.email,
            diff={"is_active": new_state}, ip=ip,
        )
        await session.commit()
    return RedirectResponse("/admin/users", status_code=303)


# ---- routing -------------------------------------------------------------


@router.post("/routing/save")
async def routing_save(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "routing.write")
    form = dict(await request.form())
    content = form.get("content") or ""
    # Validate it parses and has the expected top-level shape before writing.
    try:
        parsed = yaml.safe_load(content)
        if not isinstance(parsed, dict) or "divisions" not in parsed or "routes" not in parsed:
            raise ValueError("must define at least 'divisions' and 'routes'")
    except Exception as exc:  # noqa: BLE001
        return render(request, "routing.html", ctx, {
            "content": content, "error": f"Invalid routing YAML: {exc}",
        }, status_code=400)

    from pathlib import Path
    path = Path(get_settings().routing_matrix_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    path.write_text(content, encoding="utf-8")

    ip = _client_ip(request)
    async with SessionLocal() as session:
        await audit.record(
            session, user=ctx.user, action="routing.update",
            entity_type="routing.yaml", entity_id=str(path), ip=ip,
        )
        await session.commit()
    return render(request, "routing.html", ctx, {
        "content": content, "error": None, "saved": True,
    })


# ---- notifications -------------------------------------------------------


@router.get("/notifications/unread_count")
async def unread_count(ctx: AdminContext = Depends(require_admin)):
    if not ctx.can("notifications.read"):
        return JSONResponse({"count": 0})
    async with SessionLocal() as session:
        n = (
            await session.execute(
                select(func.count()).select_from(Notification).where(
                    Notification.read_at.is_(None)
                )
            )
        ).scalar_one()
    return JSONResponse({"count": int(n)})


@router.get("/notifications/stream")
async def notifications_stream(ctx: AdminContext = Depends(require_admin)):
    if not ctx.can("notifications.read"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="missing permission")

    async def gen() -> AsyncIterator[str]:
        q = await notify_bus.subscribe()
        try:
            # Replay unread on connect so a freshly-opened page is in sync.
            async with SessionLocal() as session:
                unread = (
                    await session.execute(
                        select(Notification)
                        .where(Notification.read_at.is_(None))
                        .order_by(Notification.created_at.asc())
                        .limit(50)
                    )
                ).scalars().all()
            for n in unread:
                yield _sse("notification", {
                    "id": n.id, "kind": n.kind, "summary": n.summary,
                    "division_code": n.division_code, "conversation_id": n.conversation_id,
                    "ref_table": n.ref_table, "ref_id": n.ref_id,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "replay": True,
                })
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20)
                    yield _sse("notification", event)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            notify_bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "X-Accel-Buffering": "no",
    })


@router.post("/notifications/ack")
async def notifications_ack(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "notifications.read")
    form = dict(await request.form())
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
        stmt = update(Notification).where(Notification.read_at.is_(None)).values(
            read_at=now, read_by_id=ctx.user.id
        )
        nid = form.get("notification_id")
        if nid:
            stmt = stmt.where(Notification.id == int(nid))
        await session.execute(stmt)
        await session.commit()
    return RedirectResponse("/admin/notifications", status_code=303)


# ---- backup --------------------------------------------------------------


@router.post("/backup")
async def backup_create(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "backup.run")
    from app.admin.backup import create_backup

    ip = _client_ip(request)
    path = await create_backup()
    async with SessionLocal() as session:
        await audit.record(
            session, user=ctx.user, action="backup.create",
            entity_type="backup", entity_id=path.name, ip=ip,
        )
        await session.commit()
    return RedirectResponse("/admin/backups", status_code=303)


@router.get("/backup/download")
async def backup_download(name: str, ctx: AdminContext = Depends(require_admin)):
    _require(ctx, "backup.run")
    from app.admin.backup import backup_path

    path = backup_path(name)
    if path is None:
        return JSONResponse({"detail": "not found"}, status_code=404)
    return FileResponse(path, filename=path.name, media_type="application/gzip")


# ---- restart (deferred — see ADMIN_INTERFACE_PLAN.md §6) ------------------


@router.post("/restart")
async def restart(request: Request, ctx: AdminContext = Depends(require_csrf)):
    _require(ctx, "restart.run")
    return HTMLResponse(
        "<h3>Restart not configured</h3>"
        "<p>The in-app restart ships once the production supervisor "
        "(systemd / Docker) is chosen. For now, an operator restarts via "
        "<code>deploy.sh</code>.</p><a href='/admin'>Back</a>",
        status_code=501,
    )

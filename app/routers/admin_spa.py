"""JSON API behind the single-page admin console (`app/admin/static/app.js`).

The SPA fetches everything from here. Reads require `require_admin` (plus a
specific permission where relevant); the one write in this module — login —
mirrors the cookie-session logic in `app.routers.admin.login_submit`, returning
JSON instead of an HTML redirect so the SPA's branded login screen can drive it.

Mutations (content save/delete, user create/toggle, notification ack, backups)
are NOT re-implemented here — the SPA calls the existing endpoints in
`app.routers.admin_api`, which already enforce CSRF + RBAC.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from app.admin import security
from app.admin.deps import AdminContext, _client_ip, require_admin
from app.admin.security import PERMISSIONS, PERMISSIONS_ALL, WILDCARD
from app.admin.templating import NAV
from app.config import get_settings
from app.db import SessionLocal
from app.models import (
    AdminAuditLog,
    AdminUser,
    Conversation,
    Message,
    Notification,
    ProblemType,
    Product,
    ProductType,
    Solution,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/api", tags=["admin-spa"])


def _require(ctx: AdminContext, permission: str) -> None:
    if not ctx.can(permission):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail=f"missing permission: {permission}")


def _perms_for(ctx: AdminContext) -> list[str]:
    """Flatten the user's role into the concrete permission strings the SPA
    uses to show/hide nav items and write buttons."""
    role_perms = PERMISSIONS.get(ctx.user.role, set())
    if WILDCARD in role_perms:
        return sorted(PERMISSIONS_ALL)
    return sorted(p for p in role_perms if p != WILDCARD)


# ---- auth / identity -----------------------------------------------------


@router.get("/me")
async def me(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    """Who am I, what can I do, and the CSRF token for writes.

    Lets `app.js` stay a pure static asset (no per-request templating): it
    bootstraps from this on load and 401s back to the login screen otherwise.
    """
    return {
        "user": {"email": ctx.user.email, "role": ctx.user.role},
        "permissions": _perms_for(ctx),
        "csrf_token": ctx.session.csrf_token,
        "nav": [
            {"label": label, "permission": perm}
            for (label, _url, perm) in NAV
        ],
    }


@router.post("/login")
async def login(request: Request) -> JSONResponse:
    # Reuse the per-IP rate limiter that guards the HTML login.
    from app.routers.admin import _rate_limited, _record_attempt

    ip = _client_ip(request) or "unknown"
    if _rate_limited(ip):
        return JSONResponse(
            {"error": "Too many attempts. Wait a few minutes."},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    _record_attempt(ip)

    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    async with SessionLocal() as session:
        user = (
            await session.execute(select(AdminUser).where(AdminUser.email == email))
        ).scalar_one_or_none()
        if (
            user is None
            or not user.is_active
            or not security.verify_password(password, user.password_hash)
        ):
            return JSONResponse(
                {"error": "Invalid credentials."},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        raw_token, _ = await security.create_session(
            session, user, ip=ip, user_agent=request.headers.get("user-agent")
        )
        await security.touch_last_login(session, user.id)
        await session.commit()

    settings = get_settings()
    resp = JSONResponse({"ok": True})
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


def _start_of_today() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/dashboard")
async def dashboard(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    """Real headline counts for the dashboard metric cards.

    Returns the same `{label,value,delta,tone,sub}` shape the demo used, so the
    existing `metricCard()` renderer is unchanged — only the numbers are real.
    """
    start_today = _start_of_today()
    async with SessionLocal() as s:
        convo_today = (
            await s.execute(
                select(func.count())
                .select_from(Conversation)
                .where(Conversation.started_at >= start_today)
            )
        ).scalar_one()
        active_users = (
            await s.execute(
                select(func.count(func.distinct(Conversation.user_email)))
                .where(Conversation.user_email.isnot(None))
            )
        ).scalar_one()
        total_convo = (
            await s.execute(select(func.count()).select_from(Conversation))
        ).scalar_one()
        resolved = (
            await s.execute(
                select(func.count())
                .select_from(Conversation)
                .where(Conversation.outcome.isnot(None))
            )
        ).scalar_one()
        unresolved = (
            await s.execute(
                select(func.count())
                .select_from(Conversation)
                .where(
                    Conversation.outcome.is_(None),
                    Conversation.ended_at.isnot(None),
                )
            )
        ).scalar_one()
        leads_today = (
            await s.execute(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.kind == "sell",
                    Notification.created_at >= start_today,
                )
            )
        ).scalar_one()

    success = round(100 * resolved / total_convo, 1) if total_convo else 0.0
    metrics = [
        {"label": "Today's Conversations", "value": f"{convo_today:,}",
         "delta": "", "tone": "up", "sub": "Sessions started today"},
        {"label": "Active Users", "value": f"{active_users:,}",
         "delta": "", "tone": "up", "sub": "Distinct identified users"},
        {"label": "AI Success Rate", "value": f"{success}%",
         "delta": "", "tone": "up", "sub": "Resolved without escalation"},
        {"label": "Unresolved Issues", "value": f"{unresolved:,}",
         "delta": "", "tone": "down", "sub": "Ended without an outcome"},
        {"label": "New Sales Leads", "value": f"{leads_today:,}",
         "delta": "", "tone": "up", "sub": "Detected from conversations today"},
    ]
    return {"metrics": metrics}


# ---- conversations -------------------------------------------------------

# Map the runtime `outcome` string onto the SPA's status vocabulary
# (["Resolved","Needs takeover","Lead created","Unresolved"]). Unknown / empty
# outcomes fall back to "Unresolved".
_STATUS_MAP = {
    "resolved": "Resolved",
    "handoff": "Needs takeover",
    "human_handoff": "Needs takeover",
    "sell": "Lead created",
    "lead": "Lead created",
}


def _convo_status(row: Conversation) -> str:
    if row.outcome:
        return _STATUS_MAP.get(row.outcome.lower(), "Unresolved")
    return "Unresolved"


def _fmt_time(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else ""


def _msg_text(content: Any) -> str:
    if isinstance(content, dict):
        for key in ("text", "message", "content", "body"):
            v = content.get(key)
            if isinstance(v, str) and v.strip():
                return v
        return json.dumps(content, ensure_ascii=False)
    return str(content) if content is not None else ""


def _convo_summary(first_user_text: str | None, row: Conversation) -> str:
    if first_user_text:
        return (first_user_text[:160] + "…") if len(first_user_text) > 160 else first_user_text
    return row.main_type_code or "—"


def _convo_brief(row: Conversation, first_user_text: str | None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "user": row.user_email or "Anonymous",
        "company": row.user_company or "—",
        "product": row.main_type_code or "—",
        "time": _fmt_time(row.last_message_at),
        "status": _convo_status(row),
        "intent": None,   # not modelled yet; rendered gracefully by the SPA
        "score": None,
        "summary": _convo_summary(first_user_text, row),
    }


@router.get("/conversations")
async def conversations_list(
    ctx: AdminContext = Depends(require_admin),
    q: str = "",
    status_filter: str = "All",
    limit: int = 100,
) -> dict[str, Any]:
    _require(ctx, "conversations.read")
    async with SessionLocal() as s:
        rows = (
            await s.execute(
                select(Conversation)
                .order_by(Conversation.last_message_at.desc())
                .limit(min(limit, 200))
            )
        ).scalars().all()

        # First user message per conversation, for the summary column.
        first_text: dict[int, str] = {}
        if rows:
            ids = [r.id for r in rows]
            msgs = (
                await s.execute(
                    select(Message.conversation_id, Message.content)
                    .where(
                        Message.conversation_id.in_(ids),
                        Message.role == "user",
                    )
                    .order_by(Message.conversation_id, Message.created_at)
                )
            ).all()
            for cid, content in msgs:
                first_text.setdefault(cid, _msg_text(content))

    items = [_convo_brief(r, first_text.get(r.id)) for r in rows]

    ql = q.strip().lower()
    if ql:
        items = [
            it for it in items
            if any(ql in str(it[k]).lower() for k in ("user", "company", "product", "summary"))
        ]
    if status_filter and status_filter != "All":
        items = [it for it in items if it["status"] == status_filter]
    return {"conversations": items}


@router.get("/conversations/{conversation_id}")
async def conversation_detail(
    conversation_id: int, ctx: AdminContext = Depends(require_admin)
) -> dict[str, Any]:
    _require(ctx, "conversations.read")
    async with SessionLocal() as s:
        row = (
            await s.execute(select(Conversation).where(Conversation.id == conversation_id))
        ).scalar_one_or_none()
        if row is None:
            return JSONResponse({"error": "Not found."}, status_code=404)  # type: ignore[return-value]
        msgs = (
            await s.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            )
        ).scalars().all()

    first_user = next((_msg_text(m.content) for m in msgs if m.role == "user"), None)
    brief = _convo_brief(row, first_user)
    out_messages = []
    for m in msgs:
        if m.role == "system":
            continue
        is_ai = m.role in ("assistant", "bot", "ai")
        out_messages.append({
            "from": "ai" if is_ai else "user",
            "text": _msg_text(m.content),
            # Confidence isn't modelled yet; null → SPA omits the line.
            "confidence": (m.content.get("confidence") if isinstance(m.content, dict) else None),
        })
    brief["messages"] = out_messages
    return brief


# ---- products (catalog) --------------------------------------------------


@router.get("/content/products")
async def products_list(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    """Real catalog rows shaped for the SPA's product cards."""
    _require(ctx, "content.read")
    async with SessionLocal() as s:
        fams = {
            r.id: r for r in (await s.execute(select(ProductType))).scalars().all()
        }
        rows = (
            await s.execute(select(Product).order_by(Product.sku))
        ).scalars().all()
    out = []
    for p in rows:
        fam = fams.get(p.product_type_id)
        specs = p.specs if isinstance(p.specs, dict) else {}
        params = ", ".join(f"{k}: {v}" for k, v in list(specs.items())[:4]) or "—"
        out.append({
            "name": p.name,
            "category": (fam.family if fam and fam.family else (fam.name if fam else "—")),
            "model": p.sku,
            "parameters": params,
            "scenarios": (fam.name if fam else "—"),
            "description": (fam.description[:120] if fam and fam.description else p.name),
            "status": "Active" if (p.status or "") == "active" else (p.status or "—").title(),
            "priority": "Standard",
        })
    return {"products": out}


# ---- knowledge base ------------------------------------------------------


@router.get("/content/kb")
async def kb_list(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    """Solutions, shaped for the SPA's document table."""
    _require(ctx, "content.read")
    async with SessionLocal() as s:
        probs = {
            r.id: r for r in (await s.execute(select(ProblemType))).scalars().all()
        }
        sols = (
            await s.execute(select(Solution).order_by(Solution.id))
        ).scalars().all()
    out = []
    for sol in sols:
        prob = probs.get(sol.problem_type_id)
        out.append({
            "name": sol.summary,
            "category": prob.label if prob else "Solution",
            "type": "Solution",
            "status": "Enabled",
            "updated": "—",
            "owner": f"Confidence {sol.confidence}" if sol.confidence is not None else "—",
        })
    return {"documents": out}


# ---- sales leads ---------------------------------------------------------


@router.get("/leads")
async def leads_list(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    """Sell-stage notifications, shaped for the SPA's lead pipeline table."""
    _require(ctx, "notifications.read")
    async with SessionLocal() as s:
        rows = (
            await s.execute(
                select(Notification)
                .where(Notification.kind == "sell")
                .order_by(Notification.created_at.desc())
                .limit(100)
            )
        ).scalars().all()
    out = []
    for n in rows:
        pl = n.payload if isinstance(n.payload, dict) else {}
        out.append({
            "id": n.id,
            "customer": pl.get("customer") or pl.get("user_email") or "—",
            "company": pl.get("company") or n.division_code or "—",
            "product": pl.get("product") or "—",
            "level": pl.get("level") or "—",
            "summary": n.summary,
            "last": _fmt_time(n.created_at),
            "status": "Acknowledged" if n.read_at else "New",
            "owner": pl.get("owner") or "Unassigned",
        })
    return {"leads": out}


# ---- admin users ---------------------------------------------------------


@router.get("/users")
async def users_list(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    _require(ctx, "users.manage")
    async with SessionLocal() as s:
        rows = (
            await s.execute(select(AdminUser).order_by(AdminUser.created_at))
        ).scalars().all()
    users = [{
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "is_active": bool(u.is_active),
        "last_login": _fmt_time(u.last_login_at),
        "is_self": u.id == ctx.user.id,
    } for u in rows]
    return {"users": users, "roles": list(PERMISSIONS.keys())}


# ---- operation logs (audit) ----------------------------------------------


@router.get("/audit")
async def audit_list(ctx: AdminContext = Depends(require_admin)) -> dict[str, Any]:
    _require(ctx, "users.manage")
    async with SessionLocal() as s:
        rows = (
            await s.execute(
                select(AdminAuditLog)
                .order_by(AdminAuditLog.created_at.desc())
                .limit(200)
            )
        ).scalars().all()
    logs = []
    for r in rows:
        target = r.entity_type or ""
        if r.entity_id:
            target = f"{target}:{r.entity_id}" if target else r.entity_id
        logs.append({
            "time": _fmt_time(r.created_at),
            "actor": r.user_email or "System",
            "action": r.action,
            "target": target or "—",
            "result": "Success",
        })
    return {"logs": logs}

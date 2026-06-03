"""FastAPI application entrypoint — hardcoded single-process build.

This build serves the widget assets out of `./widget/` from the same
process and origin as the API. No CORS, no second port, no separate
static server. The decoupled / reusable build still lives in
`../ai-agent-backend` + `../ai-agent-addon`.

Routes:
  /api/health
  /api/sessions          (POST)
  /api/messages          (POST, SSE)
  /api/tools/...
  /                      → widget/index.html
  /widget.js, /api.js, /config.kofon.js, /widget.css, ...
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.db import engine
from app.routers.admin import admin_exception_handler
from app.routers.admin import router as admin_pages_router
from app.routers.admin_api import router as admin_api_router
from app.routers.agent import router as agent_router
from app.routers.tools import router as tools_router
from app.runtime import install_async_event_loop_policy

# Must happen before uvicorn creates its event loop — psycopg async (used by
# the LangGraph checkpointer) is incompatible with Windows' ProactorEventLoop.
install_async_event_loop_policy()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield
    await engine.dispose()


app = FastAPI(
    title="Kofon Chatbot — bundled",
    version="0.4.0-hardcoded",
    lifespan=lifespan,
)

# CORS stays wide-open as a safety net in case the widget gets embedded
# into a third-party page. Same-origin serving means the browser doesn't
# even bother with preflight when loading the widget from this host.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools_router)
app.include_router(agent_router)

# Admin web app (/admin). Routers + static mount MUST be registered before
# the catch-all `/` widget mount below, or they get shadowed by it.
app.include_router(admin_pages_router)
app.include_router(admin_api_router)
app.add_exception_handler(StarletteHTTPException, admin_exception_handler)

_ADMIN_STATIC_DIR = Path(__file__).resolve().parent / "admin" / "static"
app.mount(
    "/admin/static",
    StaticFiles(directory=_ADMIN_STATIC_DIR),
    name="admin-static",
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    settings = get_settings()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc.__class__.__name__}"
    return {"status": "ok", "db": db_status, "env": settings.app_env}


# Widget mount. MUST come after every API router / explicit route above
# — FastAPI matches explicit routes first, then falls through to mounts.
# `html=True` makes `/` serve `index.html`.
_WIDGET_DIR = Path(__file__).resolve().parent.parent / "widget"
app.mount("/", StaticFiles(directory=_WIDGET_DIR, html=True), name="widget")

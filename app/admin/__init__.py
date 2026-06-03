"""Admin web app package.

Everything under `/admin` lives here: auth/RBAC (`security`, `deps`), the
content-CRUD registry (`registry`), the notification bus (`notify_bus`,
`notify`), audit logging (`audit`), and the operator CLIs (`bootstrap`,
`export_seed`). The HTTP surface is wired in `app.routers.admin` (pages) and
`app.routers.admin_api` (mutations / htmx partials).

See `ADMIN_INTERFACE_PLAN.md` at the backend root for the full design.
"""

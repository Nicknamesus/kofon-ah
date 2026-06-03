# Kofon Admin Interface — Implementation Plan

> **STATUS: IMPLEMENTED (2026-06-03).** Live at `/admin`. Decisions locked:
> Jinja2 + htmx-free vanilla JS (no build step / no CDN — China), DB-authoritative
> content, restart deferred. Smoke-tested end to end (auth + RBAC + content CRUD +
> re-embed + notifications/SSE + backup + export). First superadmin via
> `python -m app.admin.bootstrap`. See §11 for the file map.


**Scope:** an authenticated admin web app, served by the same `agent-hardcoded`
backend, that lets Kofon staff manage the agent without touching code:
manage admin accounts, edit the knowledge base (DB content), receive live
sales/handoff notifications, back up the bot, and restart it.

All code changes land in `agent-hardcoded/` only (per current working
constraint). Markdown/docs may live anywhere.

---

## 0. Current state (what we're building on)

- **Single process.** `app/main.py` runs FastAPI: `/api/*` for the agent,
  and a catch-all `StaticFiles` mount at `/` (`html=True`) for the widget.
  Any admin routes/mounts **must be registered before** the `/` mount, or
  they get shadowed.
- **No auth** exists anywhere today.
- **Content** lives in `seed/*.yaml`, loaded into Postgres by
  `app.seed.load` — which `deploy.sh` re-runs on *every* deploy (upsert).
  This is the central conflict to resolve (§3).
- **Sales/handoff** fire in `app/sideeffects/handlers.py`:
  `handle_sell` → inserts an `Rfq`; `handle_human_handoff` → inserts a
  `Ticket`. Both already resolve a `division` and send a notification email.
  These two insert points are exactly where the live notification hooks go.
- **Deploy/restart:** `deploy.sh` provisions + runs; Postgres runs in Docker
  with `restart: unless-stopped`. The app itself runs in the foreground
  (`python -m app.serve`) with no supervisor yet.
- **Embeddings** default to `hash` (non-semantic); production needs
  `bge-m3` or `dashscope` (Chinese provider per the China LLM constraint).

---

## 1. Architecture decisions

Decisions 1–3 below are **locked** (confirmed by the user). The rest are
recommended defaults.

| Area | Decision | Why |
|---|---|---|
| **UI delivery** ✅ | **LOCKED: Jinja2 + htmx + a little vanilla JS**, served at `/admin`. No JS build step. | Matches the no-build, static-serve house style; tables/forms/CRUD are htmx's sweet spot; one process, one origin. The one place that may need extra vanilla JS is the spec-schema-driven product editor. |
| **Content source of truth** ✅ | **LOCKED: DB-authoritative after launch.** Seed loader runs only against an empty DB (guarded); admin edits write to DB; an "Export to YAML" action snapshots back to `seed/` for git/backup. | Edits go live immediately (the point of "manage without code"); otherwise every `deploy.sh` re-seed silently clobbers admin edits. The `admin_audit_log` is the authoritative "who changed what" trail. See §3. |
| **Restart / hosting** ⏸️ | **DEFERRED (decide later).** Not needed for the demo. §6 stays supervisor-agnostic; the restart button ships later as graceful-exit + supervisor-respawn once systemd vs. Docker is chosen. | A foreground process can't cleanly restart itself; the safe pattern needs a supervisor, and the demo doesn't require it yet. |
| **Auth** | **Server-side session tokens** in an `admin_sessions` table, delivered as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. | Revocable (needed for "disable user"); simpler than JWT rotation. Survives restarts because it's in Postgres. |
| **Passwords** | `argon2` via `passlib`. | Modern, no native deps issue on the deploy host. |
| **RBAC** | **Role bundles** (`superadmin`, `editor`, `sales`, `viewer`) mapping to granular permission flags. | Meets "1 admin with all permissions who creates lower-permission accounts" without over-engineering; flags leave room to grow. |
| **Notifications transport** | **SSE** endpoint + an in-process async pub/sub, **backed by a `notifications` table**. | Single-process serve makes in-process fan-out fine now; the table gives durable unread state and a path to Postgres `LISTEN/NOTIFY` when we go multi-worker. |
| **Backup** | `pg_dump` of the DB + a tarball of `seed/`, `routing.yaml`, widget config; downloadable archive; secrets (`.env`) excluded by default / superadmin-only. | Captures everything that defines bot behavior; keeps secrets out of casual downloads. |

---

## 2. Auth, accounts & RBAC

### 2.1 Schema (new Alembic migration)
- `admin_users`: `id, email (unique), password_hash, role, is_active,
  created_at, created_by_id (FK self, nullable), last_login_at`.
- `admin_sessions`: `id, user_id (FK), token_hash, created_at, expires_at,
  revoked_at, ip, user_agent`.
- `admin_audit_log`: `id, user_id, action, entity_type, entity_id,
  diff (JSONB), created_at, ip`. Every mutating admin action writes here.

### 2.2 Roles → permissions
- `superadmin` — everything, **including user management, backup, restart, export**.
- `editor` — content CRUD + re-embed + export; no user mgmt / restart / backup.
- `sales` — view conversations, RFQs/tickets, receive & ack notifications; read-only on content.
- `viewer` — read-only everywhere.

Implement as a `PERMISSIONS: dict[role, set[str]]` table in code; routes
declare a required permission via a FastAPI dependency
(`require("content.write")`, `require("users.manage")`, …).

### 2.3 Bootstrap the single first admin
- CLI: `python -m app.admin.bootstrap` reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  from env (or prompts), creates one `superadmin` if none exists. Idempotent.
- Add a `deploy.sh` step that runs it (no-op once the superadmin exists).

### 2.4 Login flow & hardening
- `GET /admin/login` → form; `POST /admin/login` → verify, create session,
  set cookie. Logout revokes the session row.
- Rate-limit login attempts (per-IP + per-email) — slowapi or a tiny
  in-table counter.
- CSRF token on all state-changing forms (cookie auth needs it).
- All `/admin/*` (except login/static) behind the auth dependency.

---

## 3. Content management (edit the DB without code)

### 3.1 Resolve the seed-vs-DB conflict (do this first)
- Guard `app.seed.load`: **only load into an empty table** (or behind a
  `--force` flag). Change `deploy.sh` to call the guarded form so a redeploy
  never clobbers live edits.
- Add `python -m app.admin.export_seed`: dumps current DB content back to
  `seed/*.yaml` (round-trips the loader's format) for git history + backup.

### 3.2 CRUD surfaces (htmx pages + `/admin/api` endpoints)
Editable entities, each list + create/edit/delete:
- `product_types` (incl. `spec_schema`, `product_page_url`)
- `products` (incl. `specs`, `status` active/inactive, URLs, lead time)
- `problem_types` + `solutions` (the post-sales KB)
- `use_cases` + `use_case_product_types` (fit scores/rationale)
- `main_conversation_types` (greetings/labels)
- **Divisions & routing** (`routing.yaml` → editable; inbox addresses are
  currently placeholder `*.example` and must be set before go-live)

### 3.3 Validation & integrity
- Reuse `app/seed/normalize.py` invariants as save-time validation
  (e.g. `products.specs` must conform to its `product_type.spec_schema`;
  fit_score/severity/confidence ranges).
- FK-aware delete (block or cascade-with-confirm).

### 3.4 Embeddings refresh
- On any content row that feeds search/KB (products, product_types,
  problem_types), saving **enqueues a re-embed** of that row (reuse
  `app/seed/embed.py`). Show per-row embed status.
- Surface the active `embedding_provider`; warn loudly if it's `hash`
  (non-semantic) so prod isn't accidentally launched on it.

### 3.5 Audit
- Every create/update/delete writes an `admin_audit_log` row with a JSON diff.

---

## 4. Live sales/handoff notifications

### 4.1 Producer (the one handler change)
- In `app/sideeffects/handlers.py`, after the `Rfq` insert in `handle_sell`
  and the `Ticket` insert in `handle_human_handoff`, write a `notifications`
  row **and** publish to the in-process bus. Keep it best-effort/soft-fail so
  it never breaks the user's terminal card (consistent with existing
  `sideeffects_soft_fail`).

### 4.2 Schema
- `notifications`: `id, kind ('sell'|'human_handoff'), conversation_id,
  ref_table, ref_id (rfq/ticket id), division_code, summary, payload (JSONB),
  created_at, read_at, read_by_id (nullable)`.

### 4.3 Transport
- In-process `asyncio` pub/sub (`app/admin/notify_bus.py`): producers
  `publish()`, the SSE endpoint subscribes.
- `GET /admin/api/notifications/stream` (SSE, auth-gated): on connect, replay
  unread; then stream new events live.
- `POST /admin/api/notifications/{id}/ack` marks read.

### 4.4 UI
- A bell/badge in the admin shell (htmx + a small SSE listener) that pops a
  toast + increments the unread count when a sell/handoff fires; a
  notifications panel lists them with links to the conversation, RFQ/ticket,
  and division.
- **Multi-worker note:** when we scale past one worker, swap the in-process
  bus for Postgres `LISTEN/NOTIFY` (or Redis). The table-backed design means
  no UI change is needed for that swap.

---

## 5. Backup

### 5.1 What a backup contains
- `pg_dump` of the database (content + runtime + sideeffects + LangGraph
  checkpoints).
- Tarball of `seed/`, `app/sideeffects/routing.yaml`, `widget/config.kofon.js`.
- **Excludes `.env`/secrets by default**; a superadmin-only toggle can include
  a redacted env template.

### 5.2 Mechanics
- `POST /admin/api/backup` (superadmin) → runs `pg_dump` + tar into
  `backups/kofon-backup-<timestamp>.tar.gz`, returns a download link.
- List/download/delete previous backups.
- Restore is **out of scope for v1 UI** (dangerous); document the manual
  `pg_restore` + `app.seed.load --force` procedure instead.

---

## 6. Restart the bot  ⏸️ DEFERRED (post-demo)

Hosting/supervisor choice is **deferred** (decide later). Not needed for the
demo. The design below is the target once we pick systemd vs. Docker.

### 6.1 Production model (when implemented)
- Run the server under **systemd** (`Restart=always`) or Docker with a
  restart policy (Postgres already uses `unless-stopped`; add the app to
  compose or a systemd unit).
- `POST /admin/api/restart` (superadmin): records an audit row, returns
  "restarting…", then triggers a **graceful shutdown**; the supervisor brings
  the process back. UI polls `/api/health` until it's back, then reloads.

### 6.2 deploy.sh
- Already the canonical provision+run path. For "redeploy" (code/dep changes)
  keep using `deploy.sh`; the in-app restart is for config/content reloads and
  recovering a wedged process — not for pulling new code.

### 6.3 Until then
- The Ops phase ships **backup only**; the restart button is stubbed/hidden
  until the supervisor model is chosen. For the demo, restart is a manual
  `deploy.sh` by the operator.

---

## 7. Serving & wiring (main.py)

- New `app/routers/admin.py` (pages) + `app/routers/admin_api.py` (JSON/htmx
  partials), both included **before** the `/` static mount.
- Admin static assets (css/js) under `widget/`-style folder, e.g.
  `admin_static/`, mounted at `/admin/static` (also before `/`).
- Jinja2 templates under `app/admin/templates/`.

---

## 8. Phasing

1. **Foundations:** auth schema + migration, login/session/cookie, RBAC
   dependency, bootstrap CLI, admin shell layout, audit log. Wire routes into
   `main.py` before the `/` mount.
2. **Content management:** seed-guard + export CLI (§3.1), CRUD for
   products/product_types/problem_types/solutions, validation, re-embed,
   audit on writes.
3. **Notifications:** `notifications` table + bus + SSE + handler hooks + bell
   UI.
4. **Ops:** backup endpoint + UI; remaining content surfaces (use_cases,
   routing/divisions, greetings). *(Restart deferred — see §6; ships once the
   hosting/supervisor model is chosen.)*
5. **Hardening:** rate limiting, CSRF, secure-cookie/HTTPS checks, embedding
   provider warning, docs.

---

## 9. Production-necessary vs. demo-necessary

### Production-necessary (must have before real use)
- Argon2 password hashing; `HttpOnly`/`Secure`/`SameSite` cookies; HTTPS.
- Login rate limiting + CSRF protection.
- RBAC enforced on every `/admin` route (no client-only gating).
- Audit log on all mutations.
- **Seed-loader guard** so redeploys don't clobber live content (§3.1).
- Save-time content validation (specs ↔ spec_schema, range checks).
- Real `embedding_provider` (`bge-m3`/`dashscope`), not `hash`; re-embed on edit.
- Real division inbox addresses in `routing.yaml` (replace `*.example`).
- Supervisor-managed process for safe restart (systemd/docker restart policy).
- `pg_dump`-based backups stored off the app's ephemeral disk; documented restore.
- Notifications durable in the `notifications` table; `LISTEN/NOTIFY` path
  identified for multi-worker.
- Secrets never exposed via backup download to non-superadmins.

### Demo-necessary only (acceptable shortcuts for a demo build)
- Single hardcoded/bootstrapped superadmin from env; create extra users by hand.
- In-process notification bus (single worker) — fine for a demo, no Redis.
- Restart button that simply re-execs `deploy.sh` / spawns a child (no real
  supervisor) — acceptable when one operator runs the demo.
- Backup = download a JSON/YAML dump of **content tables only** (skip full
  `pg_dump` and checkpoint history).
- Embeddings left on `hash` (search is approximate but the flow demos end to
  end).
- Routing inboxes left as `*.example`; notification email goes to the `log`
  provider and surfaces in the UI instead of real mail.
- Skip rate limiting / CSRF if the demo is on a private URL.

---

## 10. Decisions

1. **UI stack** — ✅ **Jinja2 + htmx** (no build step).
2. **Content source of truth** — ✅ **DB-authoritative + export-to-YAML.**
3. **Hosting/restart model** — ⏸️ **Deferred.** systemd vs. Docker Compose to
   be chosen post-demo; restart button stubbed until then (§6).
4. **Backup destination** — *open* — local disk + manual offsite (demo default)
   vs. push to object storage (e.g. Aliyun OSS, China-friendly). Can be decided
   alongside the hosting model.

---

## 11. File map (as built)

New, under `agent-hardcoded/`:
- `app/models/admin.py` — AdminUser / AdminSession / AdminAuditLog / Notification
  (exported from `app/models/__init__.py`).
- `alembic/versions/b5d7e9f10234_admin_interface.py` — the four tables.
- `app/admin/` — `security.py` (argon2, sessions, RBAC), `deps.py` (auth/perm/CSRF
  dependencies), `audit.py`, `bootstrap.py` (CLI), `notify_bus.py` + `notify.py`
  (live feed), `registry.py` (generic content-CRUD descriptors + ops),
  `templating.py` (Jinja env + `render`), `export_seed.py` (CLI), `backup.py`,
  `templates/*.html`, `static/admin.css` + `static/admin.js`.
- `app/routers/admin.py` (pages + auth-redirect handler) and
  `app/routers/admin_api.py` (mutations, SSE, downloads).

Modified:
- `app/main.py` — include both admin routers + `/admin/static` mount + exception
  handler, all before the `/` catch-all.
- `app/config.py` — admin cookie/session/bootstrap/backup settings.
- `app/sideeffects/handlers.py` — stage + publish a notification in `handle_sell`
  and `handle_human_handoff` (soft-fail).
- `app/seed/load.py` — guard: skip if DB already populated unless `--force`.
- `deploy.sh` — runs `app.admin.bootstrap` after seed.
- `pyproject.toml` — `jinja2`, `python-multipart`, `passlib[argon2]`.

CLIs:
- `python -m app.admin.bootstrap [--email --password]` — first superadmin.
- `python -m app.admin.export_seed [--out DIR]` — DB → seed YAML snapshot.
- `python -m app.seed.load [--force]` — guarded seed loader.

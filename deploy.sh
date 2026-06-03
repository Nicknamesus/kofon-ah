#!/usr/bin/env bash
# Kofon chatbot — hardcoded bundle deploy script.
#
# Idempotent. Safe to re-run after a code update.
#
# Usage:
#   ./deploy.sh             # provision everything, then run the server in foreground
#   ./deploy.sh --no-run    # just provision; you start the server separately
#   ./deploy.sh --reset-db  # wipe the postgres volume before bringing it back up
#                           # (destructive — use after schema-incompatible code changes)
#
# Pair with cloudflared in another terminal:
#   cloudflared tunnel --url http://localhost:8001
set -euo pipefail

# ---- defaults ----
PORT="${PORT:-8001}"
PY="${PY:-python3}"
RUN_SERVER=true
RESET_DB=false

# ---- args ----
for arg in "$@"; do
  case "$arg" in
    --no-run)    RUN_SERVER=false ;;
    --reset-db)  RESET_DB=true ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

# ---- prerequisites ----
log "Checking prerequisites..."
command -v "$PY" >/dev/null || die "$PY not found — install Python 3.11+."
command -v docker >/dev/null || die "docker not found — install Docker Engine."
docker compose version >/dev/null 2>&1 || die "'docker compose' not available — install the v2 plugin."

# ---- env file ----
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    log ".env missing — copying from .env.example. Edit it before running the agent."
    cp .env.example .env
  else
    die ".env missing and no .env.example to copy from."
  fi
fi

if ! grep -q '^DEEPSEEK_API_KEY=sk-' .env; then
  log "WARNING: DEEPSEEK_API_KEY in .env doesn't look set. The agent will fail on first LLM call."
fi

# ---- postgres ----
if $RESET_DB; then
  log "Stopping and wiping the Postgres volume (--reset-db)..."
  docker compose down -v
fi

# Stop+remove the named container if it exists from a previous deployment
# (decoupled vs. bundled both use container_name: kofon-chatbot-postgres).
if docker ps -a --format '{{.Names}}' | grep -q '^kofon-chatbot-postgres$'; then
  if ! docker compose ps --services --filter "status=running" | grep -q '^postgres$'; then
    log "Removing stale 'kofon-chatbot-postgres' container from a previous deployment..."
    docker rm -f kofon-chatbot-postgres >/dev/null
  fi
fi

log "Starting Postgres..."
docker compose up -d

log "Waiting for Postgres to be healthy..."
for _ in $(seq 1 60); do
  if docker compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"' \
     || docker inspect -f '{{.State.Health.Status}}' kofon-chatbot-postgres 2>/dev/null | grep -q '^healthy$'; then
    log "Postgres is healthy."
    break
  fi
  sleep 2
done

# ---- venv + deps ----
if [[ ! -d .venv ]]; then
  log "Creating Python venv..."
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

log "Installing Python deps (editable)..."
pip install --upgrade pip --quiet
pip install -e . --quiet

# ---- migrations + checkpointer + seed ----
log "Running Alembic migrations..."
alembic upgrade head

log "Setting up LangGraph checkpointer (idempotent)..."
python -m app.agent.setup_checkpointer

log "Loading seed content (idempotent; skips if DB already populated)..."
python -m app.seed.load

log "Ensuring an admin account exists (idempotent)..."
log "  (set ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD in .env for the first superadmin)"
python -m app.admin.bootstrap || log "WARNING: no admin created — set ADMIN_BOOTSTRAP_* in .env, then re-run 'python -m app.admin.bootstrap'."

# ---- run ----
if $RUN_SERVER; then
  log "Starting FastAPI on port $PORT..."
  log "Widget served at http://localhost:$PORT/  ·  API at /api/*"
  log "Run 'cloudflared tunnel --url http://localhost:$PORT' in another terminal for a public URL."
  exec python -m app.serve --port "$PORT"
else
  log "Provisioned. Start the server manually with:"
  log "  source .venv/bin/activate && python -m app.serve --port $PORT"
fi

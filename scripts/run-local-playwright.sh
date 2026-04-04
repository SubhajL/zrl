#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
if [ "$MODE" != "--serve" ]; then
  echo "Usage: bash scripts/run-local-playwright.sh --serve" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${PLAYWRIGHT_OUTPUT_DIR:-playwright-local}"
FRONTEND_PORT="${FRONTEND_PORT:-3400}"
BACKEND_PORT="${BACKEND_PORT:-3401}"
DATABASE_URL_VALUE="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL_VALUE" ] && [ -f "$REPO_ROOT/.env" ]; then
  DATABASE_URL_VALUE="$(
    sed -n \
      -e 's/^DATABASE_URL=\"\([^\"]*\)\"$/\1/p' \
      -e 's/^DATABASE_URL=\(.*\)$/\1/p' \
      "$REPO_ROOT/.env" | head -n 1
  )"
fi

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "DATABASE_URL is required for local Playwright startup." >&2
  exit 1
fi

mkdir -p "$REPO_ROOT/$OUTPUT_DIR"
backend_pid=''
frontend_pid=''

cleanup() {
  if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" >/dev/null 2>&1; then
    kill "$frontend_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" >/dev/null 2>&1; then
    kill "$backend_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local log_file="$2"

  for _ in $(seq 1 60); do
    status=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
    if [ "$status" != "000" ]; then
      return 0
    fi
    sleep 2
  done

  cat "$log_file"
  return 1
}

echo "[playwright-local] Generating Prisma client..."
(cd "$REPO_ROOT" && npm run db:generate)

echo "[playwright-local] Running migrations..."
(cd "$REPO_ROOT" && DATABASE_URL="$DATABASE_URL_VALUE" npx prisma migrate deploy)

echo "[playwright-local] Seeding local data..."
(cd "$REPO_ROOT" && DATABASE_URL="$DATABASE_URL_VALUE" npm run db:seed)

echo "[playwright-local] Building backend..."
(cd "$REPO_ROOT" && npm run build)

echo "[playwright-local] Building frontend..."
(
  cd "$REPO_ROOT/frontend"
  ZRL_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  npm run build
)

echo "[playwright-local] Starting backend on ${BACKEND_PORT}..."
(
  cd "$REPO_ROOT"
  DATABASE_URL="$DATABASE_URL_VALUE" \
  CERTIFICATION_EXPIRY_WORKER_ENABLED=false \
  PORT="$BACKEND_PORT" \
  npm run start:prod
) > "$REPO_ROOT/$OUTPUT_DIR/backend.log" 2>&1 &
backend_pid=$!

echo "[playwright-local] Starting frontend on ${FRONTEND_PORT}..."
(
  cd "$REPO_ROOT/frontend"
  AUTH_COOKIE_SECURE=false \
  PORT="$FRONTEND_PORT" \
  ZRL_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  npm run start
) > "$REPO_ROOT/$OUTPUT_DIR/frontend.log" 2>&1 &
frontend_pid=$!

wait_for_url \
  "http://127.0.0.1:${BACKEND_PORT}/cold-chain/profiles" \
  "$REPO_ROOT/$OUTPUT_DIR/backend.log"
wait_for_url \
  "http://127.0.0.1:${FRONTEND_PORT}/" \
  "$REPO_ROOT/$OUTPUT_DIR/frontend.log"

echo "[playwright-local] Frontend ready at http://127.0.0.1:${FRONTEND_PORT}"
echo "[playwright-local] Backend ready at http://127.0.0.1:${BACKEND_PORT}"

wait "$backend_pid" "$frontend_pid"

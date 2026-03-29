#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${ZAP_OUTPUT_DIR:-zap-local}"
FRONTEND_PORT="${FRONTEND_PORT:-3100}"
BACKEND_PORT="${BACKEND_PORT:-3101}"
DATABASE_URL_VALUE="${DATABASE_URL:-$(sed -n 's/^DATABASE_URL=\"\(.*\)\"/\1/p' .env)}"

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "DATABASE_URL is required for local ZAP smoke." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
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
trap cleanup EXIT

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

npm run build
(cd frontend && npm run build)

DATABASE_URL="$DATABASE_URL_VALUE" \
PROOF_PACK_WORKER_ENABLED=false \
CERTIFICATION_EXPIRY_WORKER_ENABLED=false \
PORT="$BACKEND_PORT" \
npm run start:prod > "$OUTPUT_DIR/backend.log" 2>&1 &
backend_pid=$!

(
  cd frontend
  PORT="$FRONTEND_PORT" \
  ZRL_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  npm run start -- --port "$FRONTEND_PORT"
) > "$OUTPUT_DIR/frontend.log" 2>&1 &
frontend_pid=$!

wait_for_url "http://127.0.0.1:${BACKEND_PORT}/cold-chain/profiles" "$OUTPUT_DIR/backend.log"
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}/" "$OUTPUT_DIR/frontend.log"

ZAP_OUTPUT_DIR="$OUTPUT_DIR" \
FRONTEND_TARGET_URL="http://host.docker.internal:${FRONTEND_PORT}/" \
BACKEND_TARGET_URL="http://host.docker.internal:${BACKEND_PORT}/cold-chain/profiles" \
bash scripts/run-zap-baseline.sh

#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${K6_RESULTS_DIR:-k6-local}"
BACKEND_PORT="${BACKEND_PORT:-3201}"
DATABASE_URL_VALUE="${DATABASE_URL:-$(sed -n 's/^DATABASE_URL=\"\(.*\)\"/\1/p' .env)}"

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "DATABASE_URL is required for local k6 smoke." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
backend_pid=''

cleanup() {
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

npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run build

DATABASE_URL="$DATABASE_URL_VALUE" \
CERTIFICATION_EXPIRY_WORKER_ENABLED=false \
PORT="$BACKEND_PORT" \
npm run start:prod > "$OUTPUT_DIR/backend.log" 2>&1 &
backend_pid=$!

wait_for_url "http://127.0.0.1:${BACKEND_PORT}/cold-chain/profiles" "$OUTPUT_DIR/backend.log"

K6_RESULTS_DIR="$OUTPUT_DIR" \
K6_BASE_URL="http://host.docker.internal:${BACKEND_PORT}" \
bash scripts/run-k6-suite.sh

#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${ZAP_OUTPUT_DIR:-zap}"
FRONTEND_TARGET_URL="${FRONTEND_TARGET_URL:-http://host.docker.internal:3000/}"
BACKEND_TARGET_URL="${BACKEND_TARGET_URL:-http://host.docker.internal:3001/cold-chain/profiles}"
FRONTEND_SPIDER_MINUTES="${FRONTEND_SPIDER_MINUTES:-2}"
BACKEND_SPIDER_MINUTES="${BACKEND_SPIDER_MINUTES:-1}"
FRONTEND_JSON="frontend-report.json"
FRONTEND_HTML="frontend-report.html"
FRONTEND_MD="frontend-report.md"
BACKEND_JSON="backend-report.json"
BACKEND_HTML="backend-report.html"
BACKEND_MD="backend-report.md"

mkdir -p "$OUTPUT_DIR"
HOST_OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
# The ZAP image writes generated config like zap.yaml into /zap/wrk.
# Mount only a dedicated scan directory and make it world-writable so the
# container user can write there on GitHub-hosted runners.
chmod 0777 "$HOST_OUTPUT_DIR"

docker_args=(--rm -v "$HOST_OUTPUT_DIR:/zap/wrk/:rw")
if [ "$(uname -s)" = "Linux" ]; then
  docker_args+=(--add-host "host.docker.internal:host-gateway")
fi

docker run "${docker_args[@]}" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "$FRONTEND_TARGET_URL" \
  -J "$FRONTEND_JSON" \
  -r "$FRONTEND_HTML" \
  -w "$FRONTEND_MD" \
  -m "$FRONTEND_SPIDER_MINUTES" \
  -j \
  -I

docker run "${docker_args[@]}" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "$BACKEND_TARGET_URL" \
  -J "$BACKEND_JSON" \
  -r "$BACKEND_HTML" \
  -w "$BACKEND_MD" \
  -m "$BACKEND_SPIDER_MINUTES" \
  -I

npx tsx scripts/check-zap-report.ts \
  "frontend=$HOST_OUTPUT_DIR/$FRONTEND_JSON" \
  "backend=$HOST_OUTPUT_DIR/$BACKEND_JSON"

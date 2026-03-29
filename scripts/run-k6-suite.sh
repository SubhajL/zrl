#!/usr/bin/env bash
set -euo pipefail

K6_BASE_URL_VALUE="${K6_BASE_URL:-http://host.docker.internal:3201}"
K6_RESULTS_DIR="${K6_RESULTS_DIR:-k6-results}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:0.50.0}"
K6_SCRIPTS_VALUE="${K6_SCRIPTS:-performance/k6/lane-crud.js performance/k6/evidence-upload.js performance/k6/proof-pack.js}"

mkdir -p "$K6_RESULTS_DIR"
HOST_RESULTS_DIR="$(cd "$K6_RESULTS_DIR" && pwd)"
HOST_WORKDIR="$(pwd)"

docker_args=(
  --rm
  -v "$HOST_WORKDIR:/workdir:ro"
  -v "$HOST_RESULTS_DIR:/results:rw"
  -w /workdir
  -e "K6_BASE_URL=$K6_BASE_URL_VALUE"
)

if [ -n "${K6_EXPORTER_EMAIL:-}" ]; then
  docker_args+=(-e "K6_EXPORTER_EMAIL=${K6_EXPORTER_EMAIL}")
fi
if [ -n "${K6_EXPORTER_PASSWORD:-}" ]; then
  docker_args+=(-e "K6_EXPORTER_PASSWORD=${K6_EXPORTER_PASSWORD}")
fi
if [ "$(uname -s)" = "Linux" ]; then
  docker_args+=(--add-host "host.docker.internal:host-gateway")
fi

for script in $K6_SCRIPTS_VALUE; do
  script_name="$(basename "$script" .js)"
  summary_file="/results/${script_name}-summary.json"
  echo "Running k6 script: $script"
  docker run "${docker_args[@]}" "$K6_IMAGE" run \
    --summary-export "$summary_file" \
    "$script"
done

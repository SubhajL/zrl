#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WATCHER="$PROJECT_ROOT/.codex/hooks/codex_hooks.py"

if [[ ! -f "$WATCHER" ]]; then
  echo "CODEX HOOKS ERROR: watcher script not found at $WATCHER" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "CODEX HOOKS ERROR: python3 is required." >&2
  exit 1
fi

WATCH_PID=""

cleanup() {
  if [[ -n "$WATCH_PID" ]] && kill -0 "$WATCH_PID" 2>/dev/null; then
    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

python3 "$WATCHER" watch --project-root "$PROJECT_ROOT" --interval 1.0 &
WATCH_PID=$!

echo "CODEX HOOKS: watching $PROJECT_ROOT (pid $WATCH_PID)" >&2

cd "$PROJECT_ROOT"
codex "$@"

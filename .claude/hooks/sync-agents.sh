#!/bin/bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SYNC_SCRIPT="$PROJECT_DIR/scripts/sync_agents.py"

if [ ! -f "$PROJECT_DIR/AGENTS.md" ] || [ ! -f "$SYNC_SCRIPT" ]; then
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "AGENTS SYNC: python3 not available; skipping." >&2
  exit 0
fi

cd "$PROJECT_DIR"

if OUTPUT=$(python3 "$SYNC_SCRIPT" --project-root "$PROJECT_DIR" 2>&1); then
  if [ -n "$OUTPUT" ]; then
    SUMMARY=$(printf '%s' "$OUTPUT" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')
    echo "AGENTS SYNC: updated $SUMMARY" >&2
  fi
else
  echo "AGENTS SYNC WARNING: $OUTPUT" >&2
fi

exit 0

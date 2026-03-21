#!/bin/bash
# PROJECT: Auto-format files after edit/write.
# Covers: TS/JS/JSON/CSS/MD/YAML via Prettier, Prisma via `prisma format`.
# Never blocks Claude on formatter errors.

set -u

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

find_project_root() {
  local dir="$1"

  while [ "$dir" != "/" ] && [ ! -f "$dir/package.json" ]; do
    dir=$(dirname "$dir")
  done

  if [ -f "$dir/package.json" ]; then
    echo "$dir"
  fi
}

PROJECT_ROOT=$(find_project_root "$(dirname "$FILE_PATH")")

if [ -z "${PROJECT_ROOT:-}" ]; then
  exit 0
fi

if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx|json|css|md|yaml|yml)$ ]]; then
  if [ -x "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
    "$PROJECT_ROOT/node_modules/.bin/prettier" --write --ignore-unknown "$FILE_PATH" 2>/dev/null || true
  fi
fi

if [[ "$FILE_PATH" =~ \.prisma$ ]]; then
  if [ -x "$PROJECT_ROOT/node_modules/.bin/prisma" ]; then
    "$PROJECT_ROOT/node_modules/.bin/prisma" format --schema "$FILE_PATH" 2>/dev/null || true
  fi
fi

exit 0

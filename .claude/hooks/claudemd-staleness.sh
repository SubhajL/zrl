#!/bin/bash
# PROJECT: Detect when CLAUDE.md files may be stale after file changes.
# Fires on PostToolUse for Write/Edit. Outputs advisory, never blocks.
#
# Strategy: hooks detect, Claude authors. This script tells Claude
# exactly which CLAUDE.md section is likely stale and why.

INPUT=$(cat)
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only fire on Write or Edit
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize to relative path
REL_PATH="${FILE_PATH#$PROJECT_DIR/}"

WARNINGS=""

# ── 1. package.json scripts changed ─────────────────────────────────
if [[ "$REL_PATH" == "package.json" ]]; then
  # Extract current scripts from package.json
  SCRIPTS=$(jq -r '.scripts | keys[]' "$PROJECT_DIR/package.json" 2>/dev/null | sort)
  # Check if Core Commands section in CLAUDE.md mentions all scripts
  MISSING=""
  for script in $SCRIPTS; do
    if ! grep -q "npm run $script\|npm $script" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
      MISSING="$MISSING $script"
    fi
  done
  if [ -n "$MISSING" ]; then
    WARNINGS="${WARNINGS}CLAUDEMD STALE: package.json has scripts not in CLAUDE.md Core Commands:${MISSING}\n"
  fi
fi

# ── 2. New module directory or module file created ──────────────────
if [[ "$REL_PATH" == src/modules/*/  || "$REL_PATH" == src/modules/*/*.module.ts ]]; then
  MODULE_DIR=$(echo "$REL_PATH" | sed 's|src/modules/\([^/]*\)/.*|\1|')
  # Check if this module is in root CLAUDE.md Project Structure
  if ! grep -q "$MODULE_DIR" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
    WARNINGS="${WARNINGS}CLAUDEMD STALE: new module 'src/modules/$MODULE_DIR/' not in CLAUDE.md Project Structure or Specialized Context sections.\n"
  fi
  # Check if module has its own CLAUDE.md
  if [ ! -f "$PROJECT_DIR/src/modules/$MODULE_DIR/CLAUDE.md" ]; then
    WARNINGS="${WARNINGS}CLAUDEMD MISSING: src/modules/$MODULE_DIR/ has no CLAUDE.md — create one with module rules, entities, dependencies, and testing.\n"
  fi
fi

# ── 3. New common service ──────────────────────────────────────────
if [[ "$REL_PATH" == src/common/*/  || "$REL_PATH" == src/common/*/*.module.ts ]]; then
  SERVICE_DIR=$(echo "$REL_PATH" | sed 's|src/common/\([^/]*\)/.*|\1|')
  if ! grep -q "src/common/$SERVICE_DIR" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
    WARNINGS="${WARNINGS}CLAUDEMD STALE: new common service 'src/common/$SERVICE_DIR/' not in CLAUDE.md Specialized Context.\n"
  fi
  if [ ! -f "$PROJECT_DIR/src/common/$SERVICE_DIR/CLAUDE.md" ]; then
    WARNINGS="${WARNINGS}CLAUDEMD MISSING: src/common/$SERVICE_DIR/ has no CLAUDE.md.\n"
  fi
fi

# ── 4. Slash command added/changed ─────────────────────────────────
if [[ "$REL_PATH" == .claude/commands/*.md ]]; then
  CMD_NAME=$(basename "$REL_PATH" .md)
  if ! grep -q "/$CMD_NAME" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
    WARNINGS="${WARNINGS}CLAUDEMD STALE: slash command '/$CMD_NAME' not listed in CLAUDE.md Custom Slash Commands section.\n"
  fi
fi

# ── 5. Prisma schema changed ──────────────────────────────────────
if [[ "$REL_PATH" == prisma/schema.prisma ]]; then
  WARNINGS="${WARNINGS}CLAUDEMD CHECK: prisma/schema.prisma changed — verify module CLAUDE.md 'Key Entities' sections still match the schema.\n"
fi

# ── 6. Frontend globals.css changed ───────────────────────────────
if [[ "$REL_PATH" == frontend/src/app/globals.css ]]; then
  WARNINGS="${WARNINGS}CLAUDEMD CHECK: frontend design tokens changed — verify frontend/CLAUDE.md 'ZRL Color Palette' and '@theme' sections are current.\n"
fi

# ── 7. tsconfig changed ──────────────────────────────────────────
if [[ "$REL_PATH" == tsconfig.json || "$REL_PATH" == tsconfig.build.json ]]; then
  WARNINGS="${WARNINGS}CLAUDEMD CHECK: TypeScript config changed — verify CLAUDE.md 'Code Quality' section still reflects the strict mode settings.\n"
fi

# ── 8. Docker Compose changed ────────────────────────────────────
if [[ "$REL_PATH" == docker-compose.yml || "$REL_PATH" == docker-compose.yaml ]]; then
  WARNINGS="${WARNINGS}CLAUDEMD CHECK: docker-compose changed — verify any new services are reflected in CLAUDE.md if relevant.\n"
fi

# ── 9. New integration adapter ───────────────────────────────────
if [[ "$REL_PATH" == src/integrations/*/* ]]; then
  ADAPTER_DIR=$(echo "$REL_PATH" | sed 's|src/integrations/\([^/]*\)/.*|\1|')
  if ! grep -q "$ADAPTER_DIR" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
    WARNINGS="${WARNINGS}CLAUDEMD STALE: new integration 'src/integrations/$ADAPTER_DIR/' not in CLAUDE.md Project Structure.\n"
  fi
fi

# ── Output ───────────────────────────────────────────────────────
if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS" >&2
fi

exit 0

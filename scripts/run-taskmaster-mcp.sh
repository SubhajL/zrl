#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/.taskmaster/logs"
LOG_FILE="${LOG_DIR}/taskmaster-mcp.stderr.log"

mkdir -p "${LOG_DIR}"

export TASK_MASTER_TOOLS="${TASK_MASTER_TOOLS:-core}"
export TASKMASTER_AI_VERSION="${TASKMASTER_AI_VERSION:-0.43.0}"
export NPM_CONFIG_UPDATE_NOTIFIER=false
export npm_config_update_notifier=false
export NPM_CONFIG_FUND=false
export npm_config_fund=false
export NPM_CONFIG_AUDIT=false
export npm_config_audit=false
export NO_UPDATE_NOTIFIER=1
export TASKMASTER_PROJECT_ROOT="${PROJECT_ROOT}"
export TASKMASTER_MCP_STDERR_LOG="${LOG_FILE}"

cd "${PROJECT_ROOT}"

exec node "${SCRIPT_DIR}/taskmaster-mcp-proxy.mjs"

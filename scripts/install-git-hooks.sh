#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

git -C "$PROJECT_ROOT" config core.hooksPath .githooks
echo "Configured core.hooksPath=.githooks"

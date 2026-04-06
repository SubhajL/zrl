#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

npm run db:generate
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build

(
  cd frontend
  npm run typecheck
  npm run lint
  npm run build
)

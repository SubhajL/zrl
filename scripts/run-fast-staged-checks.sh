#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

staged_files=()

if [[ -n "${STAGED_FILES:-}" ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    staged_files+=("$path")
  done <<< "$STAGED_FILES"
else
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    staged_files+=("$path")
  done < <(git diff --cached --name-only --diff-filter=ACMR)
fi

if [[ ${#staged_files[@]} -eq 0 ]]; then
  echo "No staged files to check."
  exit 0
fi

run_backend=false
run_frontend=false

for path in "${staged_files[@]}"; do
  case "$path" in
    frontend/*)
      run_frontend=true
      ;;
    src/*|test/*|package.json|package-lock.json|tsconfig*.json|eslint.config.*|jest*.json|nest-cli.json)
      run_backend=true
      ;;
  esac
done

if [[ "$run_backend" == false && "$run_frontend" == false ]]; then
  echo "No relevant staged files for fast pre-commit checks; relying on CI."
  exit 0
fi

if [[ "$run_backend" == true ]]; then
  echo "Running backend fast checks..."
  npm run typecheck
  npm run lint
  npm run check:prisma-runtime
fi

if [[ "$run_frontend" == true ]]; then
  echo "Running frontend fast checks..."
  (
    cd frontend
    npm run typecheck
    npm run lint
  )
fi

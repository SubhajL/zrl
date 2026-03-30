#!/bin/bash
# CI check: PrismaClient must NOT be imported in runtime code (src/).
# Only prisma/seed.ts is allowed to use PrismaClient.
# See ADR-0001 for rationale.

set -euo pipefail

VIOLATIONS=$(grep -rn "PrismaClient\|from.*@prisma/client\|from.*generated/prisma" src/ --include="*.ts" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ PrismaClient imported in runtime code (violates ADR-0001):"
  echo "$VIOLATIONS"
  echo ""
  echo "Runtime code must use raw SQL via DATABASE_POOL, not PrismaClient."
  echo "See docs/adr/ADR-0001-persistence-strategy.md"
  exit 1
fi

echo "✅ No PrismaClient imports in runtime code."

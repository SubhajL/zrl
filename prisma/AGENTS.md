# Prisma Agent Guide

## Scope

- This file applies to everything under `prisma/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing schema or migrations.

## Current State

<!-- BEGIN AUTO-GENERATED:PRISMA_CURRENT_STATE -->
- The primary schema file is [`prisma/schema.prisma`](/Users/subhajlimanond/dev/zrl/prisma/schema.prisma).
- The datasource provider is `postgresql`.
- Prisma Client currently generates into `../generated/prisma`.
- `prisma/migrations/` exists with 24 committed file(s).
<!-- END AUTO-GENERATED:PRISMA_CURRENT_STATE -->

## Core Commands

<!-- BEGIN AUTO-GENERATED:PRISMA_CORE_COMMANDS -->
- Generate client: `npm run db:generate`
- Create/apply dev migration: `npm run db:migrate`
- Reset dev database: `npm run db:reset`
- Seed database: `npm run db:seed`
<!-- END AUTO-GENERATED:PRISMA_CORE_COMMANDS -->

## Schema Rules

- Treat Lane-centric modeling as the default. New entities should attach cleanly to Lane unless there is a strong reason not to.
- Preserve append-only audit requirements; schema changes must not make audit mutation easier.
- Use explicit enums and relation names where domain state matters.
- Keep naming stable and predictable; avoid cosmetic renames once models are referenced by app code.

## Migration Rules

- Do not invent migration files for speculative design.
- When changing the schema, verify the corresponding NestJS wiring and tests in the same unit of work.
- Prefer additive changes over destructive ones unless the task explicitly calls for a break.
- If a schema change affects domain-critical tables like audit or evidence lineage, call that out in the coding log.

## Anti-Patterns

- Do not hardcode domain rules into the schema that belong in `rules/` or service logic.
- Do not model evidence as orphaned blobs disconnected from Lane and audit context.
- Do not introduce generic status strings where a constrained enum is the safer choice.
- Do not change generated-client output paths casually; that is a repo-wide contract.

## Quick Find

<!-- BEGIN AUTO-GENERATED:PRISMA_QUICK_FIND -->
- Find models: `rg -n "^model |^enum " prisma/schema.prisma`
- Find relation fields: `rg -n "@relation|\[.*Id\]" prisma/schema.prisma`
- Find generated client references: `rg -n "generated/prisma|@prisma/client" src prisma test`
<!-- END AUTO-GENERATED:PRISMA_QUICK_FIND -->

## Done Criteria

- Schema changes are reflected intentionally in app code and tests.
- Relevant Prisma commands were run for the touched change.
- Any migration added is necessary, reviewable, and aligned with the current repo stage.

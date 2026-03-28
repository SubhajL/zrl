# Backend Agent Guide

## Scope
- This file applies to everything under `src/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing backend code.
- If a nearer module-level `CLAUDE.md` exists, read it before editing that module.

## Current Shape
<!-- BEGIN AUTO-GENERATED:SRC_CURRENT_SHAPE -->
- Entry point: [`src/main.ts`](/Users/subhajlimanond/dev/zrl/src/main.ts)
- Root wiring: [`src/app.module.ts`](/Users/subhajlimanond/dev/zrl/src/app.module.ts)
- Shared capabilities currently live under `src/common/`: `audit`, `auth`, `database`, `dto`, `hashing`.
- Domain modules currently live under `src/modules/`: `cold-chain`, `dispute`, `evidence`, `lane`, `mrv-lite`, `notifications`, `rules-engine`.
- Existing module-specific guidance already exists for `audit`, `auth`, `cold-chain`, `dispute`, `evidence`, `hashing`, `lane`, `mrv-lite`, `rules-engine`.
<!-- END AUTO-GENERATED:SRC_CURRENT_SHAPE -->

## Core Commands
<!-- BEGIN AUTO-GENERATED:SRC_CORE_COMMANDS -->
- Dev server: `npm run start:dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`
<!-- END AUTO-GENERATED:SRC_CORE_COMMANDS -->

## Module Boundaries
- Keep cross-cutting concerns in `src/common/` only when they are truly shared.
- Keep domain behavior inside the owning module under `src/modules/`.
- Wire new modules through `AppModule`; do not leave dead code unregistered.
- Prefer DTOs, explicit validation, and narrow module exports over broad shared utilities.

## Domain Constraints
- Lane remains the system anchor; do not create backend records that drift away from a Lane.
- Audit behavior is append-only and hash-chained; never add convenience paths that mutate audit history.
- Hashing is infrastructural and shared; do not duplicate hash logic inside feature modules.
- Market rules and cold-chain thresholds stay explicit and domain-specific.

## Working Rules
- Before editing a module with its own `CLAUDE.md`, read that local file and preserve its invariants.
- Keep NestJS structure obvious: controllers for transport, services for logic, modules for wiring.
- Prefer extending existing modules over creating parallel folders with overlapping responsibility.
- When adding a new provider or controller, verify the runtime registration in `app.module.ts` or the owning module.

## Anti-Patterns
- Do not bypass module wiring by calling undeclared providers directly.
- Do not move domain rules into generic helpers just to reduce file count.
- Do not add fake persistence, fake integrations, or fake DTO layers to satisfy patterns prematurely.
- Do not bury domain-critical behavior in `main.ts`; bootstrap should stay thin.

## Quick Find
<!-- BEGIN AUTO-GENERATED:SRC_QUICK_FIND -->
- Find module declarations: `rg -n "@Module" src`
- Find controllers: `rg -n "@Controller|@(Get|Post|Patch|Delete)" src`
- Find providers/services: `rg -n "export class .*Service|providers:" src`
- Find module-specific guidance: `find src -name 'CLAUDE.md' -o -name 'AGENTS.md' | sort`
<!-- END AUTO-GENERATED:SRC_QUICK_FIND -->

## Done Criteria
- New backend code is wired into a real NestJS module path.
- Relevant checks were run for touched backend files.
- Module-specific invariants from nearer `CLAUDE.md` files were preserved.

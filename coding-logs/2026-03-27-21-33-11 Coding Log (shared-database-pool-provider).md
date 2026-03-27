# Coding Log

## Plan Draft A

### Overview
Introduce a shared `DatabaseModule` that owns the process-wide `pg.Pool` and exposes it via a DI token to all store classes. Refactor the seven pg-backed stores to inject that pool, keep their transaction-bound `PoolClient` clone behavior, and centralize pool lifecycle plus sizing via `DB_POOL_SIZE`.

### Files To Change
- `src/common/database/database.constants.ts`: define the shared pool DI token and config defaults.
- `src/common/database/database.module.ts`: create the singleton Nest provider for `pg.Pool`.
- `src/app.module.ts`: import the new `DatabaseModule` once at the app root.
- `src/common/audit/audit.module.ts`: import `DatabaseModule` for `PrismaAuditStore`.
- `src/common/auth/auth.module.ts`: import `DatabaseModule` for `PrismaAuthStore`.
- `src/modules/lane/lane.module.ts`: import `DatabaseModule` for `PrismaLaneStore`.
- `src/modules/evidence/evidence.module.ts`: import `DatabaseModule` for `PrismaEvidenceStore` and `PrismaProofPackStore`.
- `src/modules/rules-engine/rules-engine.module.ts`: import `DatabaseModule` for `PrismaRulesEngineStore`.
- `src/modules/cold-chain/cold-chain.module.ts`: import `DatabaseModule` for `PrismaColdChainStore`.
- `src/common/audit/audit.prisma-store.ts`: replace self-created pool with injected shared pool; preserve transaction clone behavior.
- `src/common/auth/auth.pg-store.ts`: same refactor for auth store.
- `src/modules/lane/lane.pg-store.ts`: same refactor for lane store.
- `src/modules/evidence/evidence.pg-store.ts`: same refactor for evidence store.
- `src/modules/evidence/proof-pack.pg-store.ts`: same refactor for proof-pack store.
- `src/modules/rules-engine/rules-engine.pg-store.ts`: same refactor for rules store.
- `src/modules/cold-chain/cold-chain.pg-store.ts`: same refactor for cold-chain store.
- `src/common/database/database.module.spec.ts`: new unit coverage for singleton pool config and shutdown.
- `src/common/auth/auth.module.spec.ts` or `src/common/database/database.module.spec.ts`: verify multiple stores share one pool instance.
- `docs/PROGRESS.md`: progress entry.

### Implementation Steps
1. TDD sequence:
   1) Add database-module tests for default/max pool config, singleton provider behavior, and shutdown.
   2) Run those tests and confirm failure because no `DatabaseModule` exists yet.
   3) Implement `DatabaseModule` and provider token.
   4) Add store-construction tests that instantiate multiple stores with one injected pool.
   5) Run and confirm failure because stores still self-create pools.
   6) Refactor stores to DI + transaction-clone constructors.
   7) Refactor importing modules to include `DatabaseModule`.
   8) Run fast gates: focused tests, lint, typecheck, build.
- `createSharedDatabasePool()`:
  Build a `pg.Pool` from `DATABASE_URL` plus `DB_POOL_SIZE` with a default of `20`, failing closed when `DATABASE_URL` is absent.
- `Prisma*Store` constructor changes:
  Accept injected `Pool` and optional `PoolClient` executor; root instances use the shared pool, transactional clones carry only the client executor and never own pool shutdown.
- `withExecutor(...)` helpers:
  Convert current static factory methods so they reuse the existing injected pool reference or a private internal constructor instead of constructing a fresh store.
- module imports:
  Add `DatabaseModule` to every module that provides a pg-backed store so Nest can resolve the pool token without hidden global state.

### Test Coverage
- `src/common/database/database.module.spec.ts`
  - `creates a shared pool with default size`
  - `uses DB_POOL_SIZE when configured`
  - `returns the same pool instance to multiple resolutions`
  - `closes the shared pool on module destroy`
- `src/common/database/database.module.spec.ts` or equivalent focused test
  - `injects the same pool into auth and lane stores`
  - `transaction-bound store clones do not end the shared pool`

### Decision Completeness
- Goal:
  Replace seven independent runtime pg pools with one shared Nest-managed pool.
- Non-goals:
  No query rewrites, no schema changes, no Prisma seed/test helper refactor, no external PgBouncer integration.
- Success criteria:
  One `pg.Pool` provider exists at runtime, all seven stores resolve it through DI, `DB_POOL_SIZE` is configurable, and store behavior/tests remain green.
- Public interfaces:
  New env var: `DB_POOL_SIZE` (optional, default `20`).
  No API or schema changes.
- Edge cases / failure modes:
  Missing `DATABASE_URL`: fail closed at provider creation.
  Invalid `DB_POOL_SIZE`: fail closed with startup error.
  Transactional clones must never close the shared pool.
  Module teardown must end the pool exactly once.
- Rollout & monitoring:
  No migration needed.
  Watch startup logs for invalid pool config and database saturation metrics after deploy.
- Acceptance checks:
  `npm run test -- --runInBand src/common/database/database.module.spec.ts`
  `npm run lint`
  `npm run typecheck`
  `npm run build`

### Dependencies
- `pg`
- NestJS DI / module system

### Validation
- Resolve multiple stores from a Nest testing module and assert their `Pool` reference identity matches.
- Close the testing module and assert `pool.end()` is called once.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `DatabaseModule` | Nest app bootstrap resolving store providers | `src/app.module.ts` imports + feature-module imports | N/A |
| `DATABASE_POOL` provider | Store constructors for audit/auth/lane/evidence/proof-pack/rules/cold-chain | `src/common/database/database.module.ts` providers/exports | N/A |
| Refactored `PrismaAuditStore` | `AuditService` and audit interceptor flows | `src/common/audit/audit.module.ts` | `audit_entries`, `audit_entry_snapshots` |
| Refactored `PrismaAuthStore` | `AuthService` and guards | `src/common/auth/auth.module.ts` via `AUTH_STORE` | `users`, `api_keys`, `password_reset_requests` |
| Refactored `PrismaLaneStore` | `LaneService` routes and evidence transitions | `src/modules/lane/lane.module.ts` | `lanes`, `batches`, `routes`, `checkpoints`, `rule_snapshots` |
| Refactored `PrismaEvidenceStore` | `EvidenceService` upload/list/verify flows | `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `artifact_links` |
| Refactored `PrismaProofPackStore` | `ProofPackService` and worker | `src/modules/evidence/evidence.module.ts` via `PROOF_PACK_STORE` | `proof_packs`, `proof_pack_jobs` |
| Refactored `PrismaRulesEngineStore` | `RulesEngineService` reload/admin mutation flows | `src/modules/rules-engine/rules-engine.module.ts` | `rule_sets`, `rule_versions`, `substances` |
| Refactored `PrismaColdChainStore` | `ColdChainService` profile/reading/excursion flows | `src/modules/cold-chain/cold-chain.module.ts` | `fruit_profiles`, `temperature_readings`, `temperature_excursions` |

### Cross-Language Schema Verification
Not applicable beyond TypeScript/NestJS + SQL table names already in this repo.

## Plan Draft B

### Overview
Create a `DatabaseModule` as a `@Global()` module so feature modules do not need to import it individually, then refactor stores to inject a shared pool token. This reduces module diff noise, but hides wiring more aggressively.

### Files To Change
- Same core store files as Draft A.
- `src/common/database/database.module.ts`: mark global.
- Fewer feature module edits because global import from `AppModule` would suffice.

### Implementation Steps
1. Add global database module tests.
2. Implement `@Global() DatabaseModule`.
3. Refactor stores to inject the shared pool.
4. Import only from `AppModule`.
5. Validate boot and focused tests.

### Test Coverage
- Same store/pool tests as Draft A, with one extra module-resolution test proving feature modules can resolve the token without local imports.

### Decision Completeness
- Goal:
  Same as Draft A.
- Non-goals:
  Same as Draft A.
- Success criteria:
  Same as Draft A, plus no feature module import changes beyond app root.
- Public interfaces:
  `DB_POOL_SIZE`.
- Edge cases / failure modes:
  Global module makes hidden coupling easier; accidental future use outside intended modules is possible.
- Rollout & monitoring:
  Same as Draft A.
- Acceptance checks:
  Same as Draft A.

### Dependencies
- Same as Draft A.

### Validation
- Same as Draft A.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Global `DatabaseModule` | Nest root bootstrap | `src/app.module.ts` only | N/A |
| `DATABASE_POOL` provider | All store constructors through global DI scope | `src/common/database/database.module.ts` | N/A |

### Cross-Language Schema Verification
Not applicable.

## 2026-03-27 21:37 ICT

- Goal: Implement Task `33` by replacing the seven independent runtime `pg.Pool` instances with a shared Nest-managed database pool provider.
- What changed:
  - `src/common/database/database.constants.ts`
    - Added the `DATABASE_POOL` DI token and default pool size constant.
  - `src/common/database/database.module.ts`
    - Added the shared `DatabaseModule`, `createDatabasePool()`, `resolveDbPoolSize()`, and lifecycle shutdown hook so one `pg.Pool` is created per Nest app with optional `DB_POOL_SIZE` control.
  - `src/common/database/database.module.spec.ts`
    - Added focused tests for default/custom pool sizing, singleton pool injection across multiple stores, and shared-pool shutdown on module destroy.
  - `src/common/audit/audit.module.ts`, `src/common/auth/auth.module.ts`, `src/modules/lane/lane.module.ts`, `src/modules/evidence/evidence.module.ts`, `src/modules/rules-engine/rules-engine.module.ts`, `src/modules/cold-chain/cold-chain.module.ts`
    - Imported `DatabaseModule` so each pg-backed store resolves the shared pool through explicit Nest wiring.
  - `src/common/audit/audit.prisma-store.ts`
    - Switched to injected pool ownership and preserved transaction-bound clones via `withExecutor(pool, client)`.
  - `src/common/auth/auth.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage.
  - `src/modules/lane/lane.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage and updated transaction clone construction.
  - `src/modules/evidence/evidence.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage and updated audit-store transaction bridging to carry the shared pool reference.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage.
  - `src/modules/rules-engine/rules-engine.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage and preserved transaction-bound audit writes against the shared pool/client pair.
  - `src/modules/cold-chain/cold-chain.pg-store.ts`
    - Replaced self-created pool setup with injected shared pool usage.
  - `docs/PROGRESS.md`
    - Added the Task `33` progress entry.
  - `.taskmaster/tasks/tasks.json`
    - Marked Task `33` done in Task Master.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/common/database/database.module.spec.ts`
    - Failed because `src/common/database/database.constants.ts` and `src/common/database/database.module.ts` did not exist.
  - GREEN: `npm run test -- --runInBand src/common/database/database.module.spec.ts`
- Tests run and results:
  - `npm run test -- --runInBand src/common/database/database.module.spec.ts` -> passed.
  - `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts` -> passed.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `DatabaseModule` is now imported directly by `AuditModule`, `AuthModule`, `LaneModule`, `EvidenceModule`, `RulesEngineModule`, and `ColdChainModule`, so every pg-backed store resolves the same `DATABASE_POOL` provider at runtime.
  - The focused database-module spec proves `PrismaAuditStore`, `PrismaAuthStore`, and `PrismaLaneStore` receive the same `Pool` instance from the Nest container.
  - The auth e2e slice boots `AppModule` successfully after the refactor, covering the transitive module graph with the new database provider wiring.
- Behavior changes and risk notes:
  - Runtime pool creation is now centralized and defaults to `20` connections per backend instance instead of seven separate per-store pools.
  - `DB_POOL_SIZE` is optional; invalid values fail fast when the pool is created.
  - Missing `DATABASE_URL` still behaves like the prior code path: stores remain unconfigured until used, which preserves existing test/bootstrap behavior.
- Follow-ups / known gaps:
  - The seed script and standalone Postgres integration tests still create their own pools intentionally; this task only refactors runtime store wiring.

## Review (2026-03-27 21:37 +07) - working-tree (task-33 shared database pool slice)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status --short`; `git diff -- src/common/database src/common/audit/audit.module.ts src/common/audit/audit.prisma-store.ts src/common/auth/auth.module.ts src/common/auth/auth.pg-store.ts src/modules/lane/lane.module.ts src/modules/lane/lane.pg-store.ts src/modules/evidence/evidence.module.ts src/modules/evidence/evidence.pg-store.ts src/modules/evidence/proof-pack.pg-store.ts src/modules/rules-engine/rules-engine.module.ts src/modules/rules-engine/rules-engine.pg-store.ts src/modules/cold-chain/cold-chain.module.ts src/modules/cold-chain/cold-chain.pg-store.ts docs/PROGRESS.md .taskmaster/tasks/tasks.json`; `npm run test -- --runInBand src/common/database/database.module.spec.ts`; `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed keeping missing `DATABASE_URL` behavior backward-compatible is preferable for the current repo because many focused tests bootstrap modules without requiring a live database.
- Assumed explicit `DatabaseModule` imports are preferable to a global module in this codebase because the feature-module dependency graph stays reviewable and easier to extract later.

### Recommended Tests / Validation
- Add one broader AppModule-backed e2e slice beyond auth if you want extra confidence that the evidence/proof-pack worker path behaves identically with the shared pool.
- When load testing becomes practical, verify the instance-level connection ceiling by inspecting `pg_stat_activity` under concurrent API traffic with `DB_POOL_SIZE` set below the old aggregate 70-connection footprint.

### Rollout Notes
- No schema or API rollout steps are required.
- If production pool sizing differs from the default, set `DB_POOL_SIZE` explicitly during deploy rather than relying on the new default of `20`.

## Review (2026-03-27 21:40 +07) - working-tree (submission slice: task-8-2 + task-33)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status --short`; `gt ls`; `gt status`; `git diff -- src/common/database src/common/audit/audit.module.ts src/common/audit/audit.prisma-store.ts src/common/auth/auth.module.ts src/common/auth/auth.pg-store.ts src/modules/lane/lane.module.ts src/modules/lane/lane.pg-store.ts src/modules/evidence/evidence.module.ts src/modules/evidence/evidence.pg-store.ts src/modules/evidence/proof-pack.pg-store.ts src/modules/rules-engine/rule-definition.files.ts src/modules/rules-engine/rule-loader.service.ts src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.module.ts src/modules/rules-engine/rules-engine.pg-store.ts src/modules/rules-engine/rules-engine.types.ts src/modules/cold-chain/cold-chain.module.ts src/modules/cold-chain/cold-chain.pg-store.ts prisma/seed.ts rules/AGENTS.md rules/japan/mango.yaml rules/japan/mango-substances.csv docs/PROGRESS.md coding-logs/2026-03-27-05-36-00 Coding Log (proof-pack-critical-fixes).md coding-logs/2026-03-27-21-33-11 Coding Log (shared-database-pool-provider).md`; `npm run test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`; `npm run test -- --runInBand src/common/database/database.module.spec.ts`; `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed it is acceptable to ship Task `8.2` with the CSV-backed import structure plus the initial 12 critical Japan substances, leaving the remaining 388+ as a data-load follow-up rather than an additional code change.
- Assumed the submission should include both pending local backend slices (`8.2` and `33`) rather than splitting them into separate PRs.

### Recommended Tests / Validation
- After merge, run `npm run db:seed` in a local environment when convenient to exercise the new CSV-backed rules seed through a real database.
- When production-like traffic tests are available, verify the shared pool reduces `pg_stat_activity` pressure relative to the prior seven-pool model.

### Rollout Notes
- No migration is required for either slice.
- If the deployment environment needs tighter database concurrency limits, set `DB_POOL_SIZE` explicitly at rollout rather than relying on the default `20`.

## Comparative Analysis & Synthesis

### Strengths
- Draft A keeps DI wiring explicit in each module and matches current repo style of direct imports for shared modules.
- Draft B minimizes repetitive module edits.

### Gaps
- Draft A is noisier because every module import list changes.
- Draft B hides dependencies and makes future module isolation/testing slightly less obvious.

### Trade-offs
- Explicit imports vs convenience.
- Clear local wiring is preferable here because the repo is still an early modular monolith and feature modules already declare their dependencies directly.

### Best Choice
- Use Draft A. It is slightly more verbose, but clearer, safer for future extraction, and easier to review.

## Unified Execution Plan

### Overview
Add a shared `DatabaseModule` that provides one process-wide `pg.Pool` configured by `DATABASE_URL` and optional `DB_POOL_SIZE`, then refactor all seven pg-backed stores to consume it through Nest DI while preserving transaction-bound `PoolClient` clones. Keep imports explicit in each owning module and verify pool identity/shutdown through focused Nest testing.

### Files To Change
- `src/common/database/database.constants.ts`
- `src/common/database/database.module.ts`
- `src/common/database/database.module.spec.ts`
- `src/app.module.ts`
- `src/common/audit/audit.module.ts`
- `src/common/auth/auth.module.ts`
- `src/modules/lane/lane.module.ts`
- `src/modules/evidence/evidence.module.ts`
- `src/modules/rules-engine/rules-engine.module.ts`
- `src/modules/cold-chain/cold-chain.module.ts`
- `src/common/audit/audit.prisma-store.ts`
- `src/common/auth/auth.pg-store.ts`
- `src/modules/lane/lane.pg-store.ts`
- `src/modules/evidence/evidence.pg-store.ts`
- `src/modules/evidence/proof-pack.pg-store.ts`
- `src/modules/rules-engine/rules-engine.pg-store.ts`
- `src/modules/cold-chain/cold-chain.pg-store.ts`
- `docs/PROGRESS.md`

### Implementation Steps
1. TDD sequence:
   1) Add `database.module.spec.ts` covering pool config, singleton identity, and shutdown.
   2) Run the focused test and confirm RED because the module/provider does not exist.
   3) Implement `DATABASE_POOL` token and `DatabaseModule`.
   4) Extend tests to instantiate multiple store classes against one testing module.
   5) Run RED again because stores still self-create pools.
   6) Refactor each store constructor to inject the pool and keep a separate internal constructor/static clone path for `PoolClient` transactions.
   7) Update feature modules to import `DatabaseModule`.
   8) Run focused tests, then lint, typecheck, and build.
2. `DatabaseModule`:
   - Export a single pool provider with `DB_POOL_SIZE` default `20`.
   - Add a tiny lifecycle provider/service that ends the pool once on module destroy.
3. Store refactor:
   - Root instances: `constructor(@Inject(DATABASE_POOL) pool: Pool, ...)`.
   - Transaction clones: private/static helper that sets `executor` to `PoolClient` and leaves shared pool ownership untouched.
   - Remove per-store `OnModuleDestroy` implementations.
4. Module wiring:
   - Import `DatabaseModule` into `AuditModule`, `AuthModule`, `LaneModule`, `EvidenceModule`, `RulesEngineModule`, and `ColdChainModule`.
5. Validation:
   - Focused tests first, then repo fast gates.

### Test Coverage
- `src/common/database/database.module.spec.ts`
  - `creates a shared pool with default size`
  - `uses DB_POOL_SIZE when configured`
  - `injects the same pool into multiple stores`
  - `transaction clones reuse client executor without ending the pool`
  - `closes the shared pool when the testing module closes`

### Decision Completeness
- Goal:
  Prevent connection-pool explosion by centralizing runtime pg connection management.
- Non-goals:
  No schema changes, no API changes, no query semantics changes, no test helper pool consolidation outside this runtime DI slice.
- Success criteria:
  All seven runtime stores resolve the same pool instance; `DB_POOL_SIZE` defaults to `20`; focused tests plus lint/typecheck/build pass; no store owns pool shutdown anymore.
- Public interfaces:
  New optional env var: `DB_POOL_SIZE`.
- Edge cases / failure modes:
  Invalid/missing DB config: fail closed at startup.
  Nested transactions continue to use `PoolClient`, not the root pool.
  Closing the Nest module ends the shared pool once, not once per store.
- Rollout & monitoring:
  Backward compatible deployment, no migration.
  Monitor app startup and DB connection counts after rollout.
- Acceptance checks:
  - `npm run test -- --runInBand src/common/database/database.module.spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Existing `pg` dependency only.

### Validation
- Resolve `PrismaAuthStore`, `PrismaLaneStore`, and `PrismaAuditStore` in one Nest testing module and verify they share one pool.
- Close the testing module and assert the shared pool shuts down.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `DatabaseModule` | Nest bootstrap and feature-module provider resolution | `src/app.module.ts` plus explicit imports in audit/auth/lane/evidence/rules-engine/cold-chain modules | N/A |
| `DATABASE_POOL` token | constructors of all seven pg-backed stores | `src/common/database/database.module.ts` exports | N/A |
| `PrismaAuditStore` | `AuditService` / `AuditInterceptor` | `src/common/audit/audit.module.ts` | `audit_entries`, `audit_entry_snapshots` |
| `PrismaAuthStore` | `AuthService`, guards | `src/common/auth/auth.module.ts` | `users`, `api_keys`, `password_reset_requests` |
| `PrismaLaneStore` | `LaneService` | `src/modules/lane/lane.module.ts` | `lanes`, `batches`, `routes`, `checkpoints`, `rule_snapshots` |
| `PrismaEvidenceStore` | `EvidenceService` | `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `artifact_links` |
| `PrismaProofPackStore` | `ProofPackService`, `ProofPackWorkerService` | `src/modules/evidence/evidence.module.ts` | `proof_packs`, `proof_pack_jobs` |
| `PrismaRulesEngineStore` | `RulesEngineService` | `src/modules/rules-engine/rules-engine.module.ts` | `rule_sets`, `rule_versions`, `substances` |
| `PrismaColdChainStore` | `ColdChainService` | `src/modules/cold-chain/cold-chain.module.ts` | `fruit_profiles`, `temperature_readings`, `temperature_excursions` |

### Cross-Language Schema Verification
Not applicable.

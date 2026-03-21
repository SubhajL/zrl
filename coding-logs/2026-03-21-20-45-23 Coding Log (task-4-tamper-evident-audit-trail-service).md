# Coding Log

## Plan Draft A

### Overview
Implement a real `AuditService` inside `src/common/audit` that creates append-only, lane-scoped hash-chained audit entries, queries audit entries by lane and entity, verifies chain integrity, and exports JSON. Add an `AuditController` for the PRD endpoints and wire a lightweight `@Audited()` interceptor path for automatic logging on annotated routes without depending on Task 5 auth work.

### Files To Change
- `src/common/audit/audit.module.ts`: register providers, controller, and interceptor wiring.
- `src/common/audit/audit.constants.ts`: audit injection tokens and decorator metadata key.
- `src/common/audit/audit.types.ts`: request/filter/result contracts and store interface.
- `src/common/audit/audit.service.ts`: append-only creation, query, verification, and export logic.
- `src/common/audit/audit.controller.ts`: `/lanes/:id/audit`, `/lanes/:id/audit/verify`, `/audit/export/:laneId`.
- `src/common/audit/audit.decorator.ts`: `@Audited(action, entityType)` metadata helper.
- `src/common/audit/audit.interceptor.ts`: global-but-metadata-gated interceptor for automatic audit writes.
- `src/common/audit/audit.prisma-store.ts`: Prisma-backed lane resolution and audit persistence/query logic.
- `src/common/audit/audit.service.spec.ts`: unit tests for lane-scoped chaining and query/export behavior.
- `test/audit.e2e-spec.ts`: route wiring e2e with `AppModule` and overridden service.
- `docs/PROGRESS.md`: human-readable progress update after implementation.

### Implementation Steps
1. TDD sequence:
   1) Add `audit.service.spec.ts` covering lane-scoped `createEntry`, `verifyChainForLane`, query filters, and export shape.
   2) Run the focused spec and confirm failure because the service/store/contracts do not exist.
   3) Implement the smallest audit service + store contracts to satisfy the unit tests.
   4) Add controller and e2e route tests, then wire the controller/module/interceptor.
   5) Run format, lint, typecheck, focused tests, full tests, and build.
2. `AuditService.createEntry(input)`
   Resolve the lane for the entity, fetch that lane’s latest audit entry, compute `prevHash` and `entryHash` with `HashingService`, and persist a new append-only entry.
3. `AuditService.getEntriesForLane(laneId, filters)`
   Query all lane-relevant entries across `LANE`, `CHECKPOINT`, `ARTIFACT`, and `PROOF_PACK` entities, with optional `action`, `actor`, `from`, `to`, and pagination filters.
4. `AuditService.getEntriesForEntity(entityType, entityId)`
   Return the direct audit stream for a single auditable entity.
5. `AuditService.verifyChainForLane(laneId)`
   Recompute and verify the lane-scoped chain in timestamp order, returning `{ valid, entriesChecked, firstInvalidIndex?, firstInvalidEntryId? }`.
6. `AuditService.exportForLane(laneId)`
   Return a stable JSON-ready payload with lane id, export timestamp, entry count, and entries.
7. `AuditInterceptor`
   Use `@Audited` metadata to log annotated controller actions after successful handler execution. Because Task 5 auth is not done, actor defaults to `request.user?.id ?? 'system'`.

### Test Coverage
- `createEntry uses the prior lane hash when a lane already has entries`
  Lane chain advances deterministically.
- `createEntry uses the genesis hash for the first lane entry`
  First entry starts correctly.
- `createEntry fails closed when the lane cannot be resolved`
  No orphan audit records.
- `getEntriesForLane applies actor, action, and date filters`
  Filter logic is enforced.
- `verifyChainForLane reports the first invalid entry id`
  Tampering location is explicit.
- `exportForLane returns JSON-safe audit metadata and entries`
  Export shape is stable.
- `GET /lanes/:id/audit returns lane entries from the audit controller`
  Route wiring is correct.
- `POST /lanes/:id/audit/verify returns verification results`
  Verify endpoint is wired.
- `GET /audit/export/:laneId returns JSON export payload`
  Export endpoint is wired.
- `interceptor writes an audit entry for an annotated route`
  Automatic logging path is exercised.

### Decision Completeness
- Goal:
  Deliver the append-only audit trail service and API surface for querying, verifying, and exporting lane audit streams using the canonical SHA-256 chain.
- Non-goals:
  No schema changes, no real JWT guards, no 10-year retention automation, no generic Prisma shared module for the whole app.
- Success criteria:
  `AuditModule` exports a working service/controller path, lane-scoped audit creation and verification behave deterministically, controller routes are reachable through `AppModule`, and backend gates pass.
- Public interfaces:
  - `GET /lanes/:id/audit`
  - `POST /lanes/:id/audit/verify`
  - `GET /audit/export/:laneId`
  - `@Audited(action, entityType)` decorator
- Edge cases / failure modes:
  Missing lane resolution fails closed; empty lane verification returns valid with zero entries checked; malformed dates are ignored or treated as absent; hash mismatches return invalid with the first bad index/id.
- Rollout & monitoring:
  No feature flag or migration. Main risks are incorrect lane resolution and route wiring; watch tests and runtime logs for unresolved entities or missing `DATABASE_URL`.
- Acceptance checks:
  `npm run test -- --runInBand common/audit/audit.service.spec.ts`
  `npm run test -- --runInBand test/audit.e2e-spec.ts`
  `npm run lint`
  `npm run typecheck`
  `npm run test`
  `npm run build`

### Dependencies
- Existing Prisma schema tables: `audit_entries`, `lanes`, `checkpoints`, `evidence_artifacts`, `proof_packs`.
- Existing `HashingService` canonical chain helpers.
- Generated Prisma client already on disk.

### Validation
- Focused service tests prove append-only lane-scoped chaining.
- E2E test proves route registration through `AppModule`.
- Full backend gates pass.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `AuditService` | controller handlers and future cross-module audit writes | `src/common/audit/audit.module.ts`, already imported by `src/app.module.ts` | `audit_entries` |
| `AuditController` | HTTP `/lanes/:id/audit`, `/lanes/:id/audit/verify`, `/audit/export/:laneId` | `src/common/audit/audit.module.ts` controllers array | `audit_entries`, joined via `lanes`, `checkpoints`, `evidence_artifacts`, `proof_packs` |
| `AuditInterceptor` | annotated controller methods only | `src/common/audit/audit.module.ts` via `APP_INTERCEPTOR` | `audit_entries` |
| Prisma audit store | `AuditService` | local provider token in `src/common/audit/audit.module.ts` | same tables as above |

### Cross-Language Schema Verification
Not applicable. The audit service uses existing Prisma/PostgreSQL tables only:
- `audit_entries`
- `lanes`
- `checkpoints`
- `evidence_artifacts`
- `proof_packs`

### Decision-Complete Checklist
- No open design decisions remain.
- Public endpoints and decorator surface are named.
- Each behavior has at least one test.
- Validation commands are repo-valid.
- Wiring verification covers service, controller, interceptor, and store.
- No rollout/backout beyond revert is required.

## Plan Draft B

### Overview
Implement Task 4 with a smaller surface: `AuditService` plus controller endpoints only, and postpone the automatic interceptor/decorator path until Task 6/Task 10 creates real controllers worth annotating. This reduces moving parts now but leaves part of the task’s automation story undone.

### Files To Change
- `src/common/audit/audit.module.ts`
- `src/common/audit/audit.constants.ts`
- `src/common/audit/audit.types.ts`
- `src/common/audit/audit.service.ts`
- `src/common/audit/audit.controller.ts`
- `src/common/audit/audit.prisma-store.ts`
- `src/common/audit/audit.service.spec.ts`
- `test/audit.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps
1. Write RED tests for service and endpoints.
2. Implement lane-scoped audit store + service.
3. Add controller routes.
4. Skip `@Audited` automation for now and document it as a follow-up.

### Test Coverage
- `createEntry builds a deterministic lane chain`
  Per-lane chaining stays stable.
- `verifyChainForLane catches tampering`
  Invalid chain is detected.
- `lane audit routes are registered`
  Route surface exists.

### Decision Completeness
- Goal:
  Deliver the core audit service and API.
- Non-goals:
  Automatic controller auditing.
- Success criteria:
  Core service + endpoints are working and tested.
- Public interfaces:
  Same three endpoints as Draft A.
- Edge cases / failure modes:
  Same as Draft A, minus interceptor behavior.
- Rollout & monitoring:
  Same as Draft A.
- Acceptance checks:
  Same as Draft A minus interceptor tests.

### Dependencies
- Same as Draft A.

### Validation
- Same as Draft A without interceptor tests.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `AuditService` | controller handlers | `src/common/audit/audit.module.ts` | `audit_entries` |
| `AuditController` | HTTP audit endpoints | `src/common/audit/audit.module.ts` | joined audit tables |
| Prisma audit store | `AuditService` | `src/common/audit/audit.module.ts` | joined audit tables |

### Cross-Language Schema Verification
No schema change.

### Decision-Complete Checklist
- Core API decisions are locked.
- Automatic auditing is intentionally deferred.
- Tests and validation are concrete.

## Comparative Analysis & Synthesis

- Draft A strengths:
  Covers the full task surface, including the automatic logging primitive, while keeping auth concerns out of scope.
- Draft A gaps:
  Adds one more moving part in an otherwise small scaffold.
- Draft B strengths:
  Smaller and faster to land.
- Draft B gaps:
  Leaves Task 4 partially complete and delays the only reusable automation primitive in the task.
- Trade-off:
  The repo already has an imported `AuditModule`, and the interceptor can stay lightweight if it is metadata-gated. The extra complexity is acceptable because it avoids another revisit just to add the decorator/interceptor later.

## Unified Execution Plan

### Overview
Implement the full Task 4 surface using lane-scoped audit chaining derived from existing entity relationships instead of changing the schema. The service will use a Prisma-backed store behind an audit-specific interface, the controller will expose the PRD routes, and a metadata-gated interceptor will provide the automatic logging primitive without blocking on unfinished auth or feature modules.

### Files To Change
- `src/common/audit/audit.module.ts`: wire providers, controller, and global metadata-gated interceptor.
- `src/common/audit/audit.constants.ts`: injection tokens and metadata key.
- `src/common/audit/audit.types.ts`: create/query/verify/export/store contracts.
- `src/common/audit/audit.service.ts`: append-only lane-scoped audit logic.
- `src/common/audit/audit.controller.ts`: query/verify/export HTTP endpoints.
- `src/common/audit/audit.decorator.ts`: `@Audited` metadata decorator.
- `src/common/audit/audit.interceptor.ts`: post-handler automatic audit logging.
- `src/common/audit/audit.prisma-store.ts`: lane resolution, latest-entry lookup, list/filter/export persistence.
- `src/common/audit/audit.service.spec.ts`: core service and interceptor unit coverage.
- `test/audit.e2e-spec.ts`: controller route wiring with `AppModule`.
- `docs/PROGRESS.md`: progress line after implementation.

### Implementation Steps
1. TDD sequence:
   1) Add `src/common/audit/audit.service.spec.ts` with tests for genesis creation, prior-hash reuse, lane-resolution failure, verification, export, and interceptor metadata behavior.
   2) Run `npm run test -- --runInBand common/audit/audit.service.spec.ts` and confirm RED because the audit files do not exist yet.
   3) Implement the audit contracts, service, and Prisma-backed store.
   4) Add `test/audit.e2e-spec.ts`, run it red, then implement controller/module wiring.
   5) Run formatter/lint/typecheck/focused tests/full tests/build.
2. Functions / classes:
   - `AuditService.createEntry(input)`
     Resolve the owning lane, fetch the latest entry for that lane, compute the next hash with `HashingService`, and persist a new append-only entry.
   - `AuditService.getEntriesForLane(laneId, filters)`
     Return lane-related audit entries with filter/pagination support.
   - `AuditService.getEntriesForEntity(entityType, entityId)`
     Return the direct audit stream for one entity.
   - `AuditService.verifyChainForLane(laneId)`
     Verify lane-scoped chain integrity and report the first invalid entry if present.
   - `AuditService.exportForLane(laneId)`
     Produce JSON-safe export payload and metadata.
   - `PrismaAuditStore.resolveLaneId(entityType, entityId)`
     Map entity ids to owning lane ids using existing schema relations without adding columns.
   - `AuditController`
     Expose the three PRD routes with Nest query parsing and JSON responses.
   - `Audited()` / `AuditInterceptor`
     Attach optional automatic audit writes to annotated routes, defaulting actor to `system` when auth is absent.
3. Expected behavior / edge cases:
   - Audit creation fails closed if lane resolution or store configuration is missing.
   - The first lane entry uses the genesis hash.
   - Verification of zero entries returns valid with `entriesChecked = 0`.
   - Filtering by `from`/`to` only applies when dates parse successfully.
   - Export response contains all hash fields and a deterministic entry order.

### Test Coverage
- `createEntry uses the genesis hash for the first lane entry`
  First lane entry starts correctly.
- `createEntry chains from the prior lane entry hash`
  Existing lane streams advance correctly.
- `createEntry throws when the entity cannot resolve to a lane`
  No orphan audit records.
- `getEntriesForLane applies action, actor, and date filters`
  Filter logic is respected.
- `verifyChainForLane returns the first invalid entry id`
  Tampering is localized.
- `exportForLane returns export metadata and entries`
  Export payload is stable.
- `interceptor creates an audit entry for annotated handlers`
  Automatic logging path works.
- `GET /lanes/:id/audit returns entries`
  Query route is registered.
- `POST /lanes/:id/audit/verify returns verification`
  Verify route is registered.
- `GET /audit/export/:laneId returns export JSON`
  Export route is registered.

### Decision Completeness
- Goal:
  Deliver the tamper-evident audit trail service, including append-only creation, querying, verification, export, and the reusable automatic logging primitive.
- Non-goals:
  No schema changes, no full auth/guard integration, no platform-wide shared Prisma module, no retention-job implementation.
- Success criteria:
  Audit service and routes are wired through `AuditModule`/`AppModule`, lane-scoped chain behavior is deterministic under tests, and repo gates pass.
- Public interfaces:
  - `GET /lanes/:id/audit`
  - `POST /lanes/:id/audit/verify`
  - `GET /audit/export/:laneId`
  - `@Audited(action, entityType)`
- Edge cases / failure modes:
  Missing store or unresolved lane throws; invalid chain returns `{ valid: false, ... }`; automatic logging falls back to `system` actor; audit write in interceptor is fail-open for the response path but should log/report the error.
- Rollout & monitoring:
  No flag or migration. Watch for unresolved entity-to-lane mappings and failed audit writes in interceptor logs. Backout is revert-only.
- Acceptance checks:
  - `npm run test -- --runInBand common/audit/audit.service.spec.ts`
  - `npm run test -- --runInBand test/audit.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

### Dependencies
- Existing `HashingModule` / `HashingService`.
- Existing Prisma schema and generated client.
- Existing `AuditModule` import in `src/app.module.ts`.

### Validation
- Focused service spec passes.
- Focused audit e2e spec passes.
- Full unit/e2e/build gates pass.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `AuditService` | `AuditController` handlers and `AuditInterceptor` | `src/common/audit/audit.module.ts` providers, imported by `src/app.module.ts` | `audit_entries` |
| `AuditController` | HTTP `/lanes/:id/audit`, `/lanes/:id/audit/verify`, `/audit/export/:laneId` | `src/common/audit/audit.module.ts` controllers array | `audit_entries`, `lanes`, `checkpoints`, `evidence_artifacts`, `proof_packs` |
| `PrismaAuditStore` | `AuditService` | local provider token in `src/common/audit/audit.module.ts` | same joined tables |
| `AuditInterceptor` | any route annotated with `@Audited()` | `src/common/audit/audit.module.ts` via `APP_INTERCEPTOR` | `audit_entries` |
| `@Audited()` metadata | `AuditController.verifyLaneAudit()` initial runtime call site | decorator on controller method + global interceptor | `audit_entries` |

### Cross-Language Schema Verification
Not applicable. Existing PostgreSQL/Prisma tables only:
- `audit_entries`
- `lanes`
- `checkpoints`
- `evidence_artifacts`
- `proof_packs`

### Decision-Complete Checklist
- No open implementation decisions remain.
- All public interfaces are listed.
- Every behavior change has a failing-test target.
- Validation commands are concrete and repo-valid.
- Wiring verification covers each new runtime component.
- No deployment-visible migration or flag work is required.

## Implementation Record

### What Changed
- Implemented `AuditService` for append-only audit creation, lane/entity queries, chain verification, and JSON export.
- Added `AuditController` routes for `GET /lanes/:id/audit`, `POST /lanes/:id/audit/verify`, and `GET /audit/export/:laneId`.
- Added `@Audited()` metadata plus a global metadata-gated `AuditInterceptor` that hashes the response/request payload and logs asynchronously.
- Replaced the initial Prisma-client-backed store approach with a `pg`-backed store inside `audit.prisma-store.ts` so the module boots cleanly under Jest and the Nest build without importing generated Prisma TypeScript at runtime.
- Added lane-scoped advisory transaction locking before `latest-hash -> insert` so concurrent writers on the same lane cannot fork the audit chain.

### Validation Evidence
- RED captured during implementation:
  - initial focused audit unit spec failed before the service/contracts stabilized
  - initial audit e2e run failed because the default Jest config does not match `.e2e-spec.ts`
  - follow-up audit e2e run failed when the store imported generated Prisma TS directly; this drove the store rewrite
- GREEN validation after implementation:
  - `npm run test -- --runInBand common/audit/audit.service.spec.ts`
  - `npm run test -- --runInBand common/audit/audit.interceptor.spec.ts`
  - `npm run test:e2e -- audit.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

### QCHECK Review
- Finding fixed before closeout:
  - `AuditService.createEntry()` originally used a transaction but did not serialize same-lane writers, so concurrent requests could read the same predecessor hash and create a forked chain. The final implementation now acquires a lane-scoped advisory transaction lock in the store before reading the latest entry.
- Final review result:
  - No remaining blocking findings.
  - Residual risk is operational rather than logical: lane-wide queries use `EXISTS` subqueries over checkpoint/artifact/proof-pack tables, so large-volume audit exports may eventually want dedicated indexes or a denormalized lane reference on `audit_entries`. That is not a blocker for Task 4.

# Task 6.6 Public Lane ID Lookup

## Plan Draft A

### Overview
Implement public lane ID lookup as a shared backend capability so protected lane-scoped endpoints accept either the internal lane row ID or the user-visible `LN-YYYY-NNN` identifier. Reuse one resolution pattern across lane services and lane owner auth resolution, then validate the affected HTTP surfaces with focused unit and e2e coverage.

### Files to Change
- `src/modules/lane/lane.types.ts`
  - Extend the lane store contract with a lane identifier resolution/read path.
- `src/modules/lane/lane.pg-store.ts`
  - Add public-or-internal lane resolution and make lane reads/updates/transition/checkpoint access use the resolved internal lane ID.
- `src/modules/lane/lane.service.ts`
  - Keep service methods identifier-agnostic by delegating to the store.
- `src/common/auth/auth.pg-store.ts`
  - Make lane ownership resolution accept public lane IDs as well as internal IDs.
- `src/common/auth/auth.types.ts`
  - Keep auth store typing aligned with the updated resolution semantics.
- `src/common/auth/auth.guards.spec.ts`
  - Prove the lane owner guard forwards public lane IDs through ownership resolution.
- `src/modules/lane/lane.service.spec.ts`
  - Add unit coverage for public lane ID detail/completeness/checkpoint/timeline lookup through the service/store boundary.
- `test/lane.e2e-spec.ts`
  - Add HTTP wiring coverage for `/lanes/LN-...` endpoints.
- `docs/PROGRESS.md`
  - Append terse progress entry.

### Implementation Steps
1. TDD sequence
   1. Add/adjust unit tests in `lane.service.spec.ts` and `auth.guards.spec.ts` plus HTTP tests in `test/lane.e2e-spec.ts` for public lane IDs.
   2. Run the focused tests and confirm they fail because the current implementation only resolves `lanes.id`.
   3. Implement the smallest store/auth changes to resolve public IDs.
   4. Refactor minimally so all lane service methods flow through the same store path.
   5. Run focused fast gates, then backend gates for the touched modules.
2. `PrismaLaneStore.resolveLaneRecord(identifier)`
   - Query `lanes` by either `id` or `lane_id`, preferring an exact internal-ID match when both are theoretically possible.
3. `PrismaLaneStore.findLaneById(identifier)`
   - Preserve the existing method name but make it accept either identifier and hydrate batch/route/checkpoints/rule snapshot from the resolved internal row ID.
4. `PrismaLaneStore.findCheckpointsForLane(identifier)` / `updateLaneBundle(...)` / `transitionLaneStatus(...)` / `createCheckpoint(...)` / `updateCheckpoint(...)`
   - Resolve the lane first, then use the canonical internal lane ID for downstream queries and writes.
5. `AuthPgStore.resolveLaneOwnerId(identifier)`
   - Resolve exporter ownership from `lanes` using `id = $1 OR lane_id = $1`.
6. E2E wiring
   - Prove `GET /lanes/:id`, `GET /lanes/:id/completeness`, and `GET /lanes/:id/checkpoints` still work when `:id` is `LN-YYYY-NNN`.

### Test Coverage
- `src/modules/lane/lane.service.spec.ts`
  - `findById returns lane detail for public lane id`
    - public ID resolves through store boundary
  - `getCompleteness evaluates lanes addressed by public lane id`
    - completeness path accepts public IDs
  - `getCheckpoints returns lane checkpoints for public lane id`
    - checkpoint list path resolves correctly
- `src/common/auth/auth.guards.spec.ts`
  - `lane owner guard forwards public lane id to auth resolution`
    - guard remains identifier-agnostic
- `test/lane.e2e-spec.ts`
  - `GET /lanes/:id returns lane detail for public lane id`
    - controller + guard wiring works
  - `GET /lanes/:id/completeness returns payload for public lane id`
    - guarded completeness route accepts public IDs
  - `GET /lanes/:id/checkpoints returns checkpoints for public lane id`
    - guarded checkpoint route accepts public IDs

### Decision Completeness
- Goal
  - Finish Task `6.6` so user-visible lane IDs work on protected lane-scoped backend routes.
- Non-goals
  - No route shape changes.
  - No schema migration.
  - No checkpoint ID or proof-pack ID redesign.
- Success criteria
  - Lane detail and related lane-scoped endpoints accept either internal or public lane identifiers.
  - Exporter ownership checks remain enforced.
  - Focused unit/e2e tests cover public lane IDs and pass.
- Public interfaces
  - Existing HTTP routes keep the same paths; behavior broadens to accept public lane IDs.
  - No new env vars, migrations, or message topics.
- Edge cases / failure modes
  - Unknown identifier returns the same not-found/forbidden behavior as today.
  - Resolution fails closed: no fallback to another exporter’s lane.
  - Internal ID collisions still win exact `id` matches first.
- Rollout & monitoring
  - Additive runtime-only change; no migration sequencing.
  - Watch for 403/404 changes on `/lanes/*`, `/lanes/*/checkpoints`, `/lanes/*/temperature`, `/lanes/*/evidence`, and `/lanes/*/audit`.
- Acceptance checks
  - `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts src/common/auth/auth.guards.spec.ts`
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies
- Existing lane and auth modules remain the runtime entry points.
- No external service dependencies.

### Validation
- Focused unit tests first.
- Focused lane e2e wiring second.
- Backend static gates last.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Lane identifier resolution in `lane.pg-store.ts` | `LaneService.findById/getCompleteness/getCheckpoints/updateCheckpoint/transition` and downstream lane-scoped controllers | `src/modules/lane/lane.module.ts` provider wiring | `lanes.id`, `lanes.lane_id`, related lane-owned tables |
| Lane ownership resolution in `auth.pg-store.ts` | `LaneOwnerGuard` on lane/evidence/cold-chain routes | `src/common/auth/auth.module.ts` providers | `lanes.id`, `lanes.lane_id`, `lanes.exporter_id` |

### Cross-Language Schema Verification
- Single-language backend repo for these tables.
- Verified lane table columns in TypeScript SQL reads: `lanes.id`, `lanes.lane_id`, `lanes.exporter_id`.

### Decision-Complete Checklist
- No open interface decisions remain.
- All affected public routes are named.
- Each behavior change has at least one test.
- Validation commands are specific.
- Wiring verification covers store + guard runtime paths.
- No rollout/backout migration required.

## Plan Draft B

### Overview
Introduce an explicit `findLaneByIdentifier(...)` helper alongside the existing `findLaneById(...)`, then migrate the guarded lane-scoped services and auth ownership resolution to use the new helper. This keeps internal-ID-only methods available for lower-level callers while making the public route surface intentional.

### Files to Change
- `src/modules/lane/lane.types.ts`
  - Add `findLaneByIdentifier(...)` and `resolveLaneDbId(...)`.
- `src/modules/lane/lane.pg-store.ts`
  - Implement the new identifier helpers and switch user-facing methods to them.
- `src/modules/lane/lane.service.ts`
  - Call the identifier-aware store methods for public-route entry points only.
- `src/common/auth/auth.pg-store.ts`
  - Resolve lane owners by public or internal ID.
- `src/common/auth/auth.guards.spec.ts`
  - Verify guard behavior with public IDs.
- `src/modules/lane/lane.service.spec.ts`
  - Verify service entry points choose identifier-aware methods.
- `test/lane.e2e-spec.ts`
  - Verify public lane IDs at HTTP level.
- `docs/PROGRESS.md`
  - Append progress note.

### Implementation Steps
1. TDD sequence
   1. Add service/e2e tests that use `LN-...` route params.
   2. Confirm failures from current internal-ID-only behavior.
   3. Add `findLaneByIdentifier(...)` and `resolveLaneDbId(...)` to the store.
   4. Update only the public-route service paths to use identifier-aware helpers.
   5. Run fast gates and backend gates.
2. `PrismaLaneStore.resolveLaneDbId(identifier)`
   - Return the canonical internal lane DB ID from either identifier.
3. `PrismaLaneStore.findLaneByIdentifier(identifier)`
   - Hydrate the full lane detail from the resolved DB ID.
4. Public-route service methods
   - `findById`, `getCompleteness`, `getCheckpoints`, `createCheckpoint`, `updateCheckpoint`, `getTimeline`, `transition`.
5. `AuthPgStore.resolveLaneOwnerId(identifier)`
   - Apply the same identifier semantics for guard enforcement.

### Test Coverage
- `src/modules/lane/lane.service.spec.ts`
  - `findById uses identifier-aware lookup for LN ids`
    - public service path uses new helper
  - `transition resolves internal lane id before status mutation`
    - public route path still updates correct row
- `src/common/auth/auth.guards.spec.ts`
  - `lane owner guard accepts LN public ids`
    - owner guard unchanged semantically
- `test/lane.e2e-spec.ts`
  - `GET /lanes/LN-... returns lane detail`
    - public ID HTTP contract
  - `PATCH /lanes/LN-.../checkpoints/:checkpointId updates checkpoint`
    - mutation path resolves lane first

### Decision Completeness
- Goal
  - Make user-facing lane routes explicitly identifier-aware.
- Non-goals
  - No changes to DB schema or checkpoint/proof-pack identifiers.
- Success criteria
  - All route entry points that expose `:id` for lanes work with `LN-...`.
  - Internal lower-level methods can still use DB IDs without ambiguity.
- Public interfaces
  - Existing route contracts only; broader accepted ID format.
- Edge cases / failure modes
  - Unknown `LN-...` values fail closed as not found.
  - Mutations always convert to internal DB ID before writing.
- Rollout & monitoring
  - Additive runtime change with no feature flag.
- Acceptance checks
  - Same focused unit/e2e/static gates as Draft A.

### Dependencies
- Existing module wiring only.

### Validation
- Same as Draft A.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `findLaneByIdentifier` / `resolveLaneDbId` | lane service methods used by `/lanes/:id*` routes | `src/modules/lane/lane.module.ts` | `lanes.id`, `lanes.lane_id` |
| Updated `resolveLaneOwnerId` | `LaneOwnerGuard` on all lane-scoped routes | `src/common/auth/auth.module.ts` | `lanes.exporter_id` |

### Cross-Language Schema Verification
- Single TypeScript backend; verified `lanes.id` and `lanes.lane_id` usage in current SQL.

### Decision-Complete Checklist
- Decision-complete.

## Comparative Analysis & Synthesis

### Strengths
- Draft A minimizes interface churn by preserving `findLaneById(...)` and making it identifier-aware everywhere.
- Draft B is more explicit about public-route semantics and keeps internal-ID-only helpers conceptually cleaner.

### Gaps
- Draft A risks hiding the distinction between canonical DB ID and public lane ID if the store grows more callers later.
- Draft B introduces more interface churn than the task needs and would force broader test rewiring.

### Trade-offs
- Draft A is lower-friction and fits the existing codebase naming patterns.
- Draft B is more explicit architecturally but costs more edits for little product value right now.

### Compliance Check
- Both drafts preserve current Nest wiring, avoid schema churn, and fail closed on unknown IDs.

## Unified Execution Plan

### Overview
Implement Task `6.6` by making lane lookup and lane ownership resolution accept either internal lane IDs or public `LN-...` IDs, while keeping the existing public route surface unchanged. Use the lower-friction Draft A approach: preserve current method names, make the store resolution canonical internally, and prove the guarded HTTP routes behave correctly with public IDs.

### Files to Change
- `src/modules/lane/lane.types.ts`
  - Add any minimal helper contract needed for identifier-aware lane lookup while preserving existing service/store naming.
- `src/modules/lane/lane.pg-store.ts`
  - Add a canonical lane resolution helper and update lane read/write methods to resolve public IDs before querying child tables or mutating rows.
- `src/modules/lane/lane.service.ts`
  - Keep service methods thin and identifier-agnostic through the store.
- `src/common/auth/auth.pg-store.ts`
  - Update `resolveLaneOwnerId(...)` to accept internal or public lane IDs.
- `src/common/auth/auth.guards.spec.ts`
  - Add guard coverage for public lane IDs.
- `src/modules/lane/lane.service.spec.ts`
  - Add public lane ID unit coverage around service entry points.
- `test/lane.e2e-spec.ts`
  - Add public lane ID route coverage.
- `docs/PROGRESS.md`
  - Add terse progress note.

### Implementation Steps
1. TDD sequence
   1. Add failing tests for `LN-...` lookups in `lane.service.spec.ts`, `auth.guards.spec.ts`, and `test/lane.e2e-spec.ts`.
   2. Run focused tests and confirm failures are due to internal-ID-only resolution.
   3. Implement a canonical lane-row resolver in `lane.pg-store.ts`.
   4. Switch lane store methods used by public routes to resolve to the canonical internal lane ID before reading/mutating dependent tables.
   5. Update `auth.pg-store.ts` so `LaneOwnerGuard` works with the same identifier semantics.
   6. Run focused tests to GREEN, then `typecheck`, `lint`, and `build`.
2. Function names and behavior
   - `PrismaLaneStore.findLaneById(identifier)`
     - Accept either a DB lane ID or public lane ID, resolve the canonical lane row, and hydrate the full lane detail from the canonical internal lane ID.
   - `PrismaLaneStore.resolveLaneIdentity(identifier)`
     - Internal helper returning the minimal lane row needed for downstream queries and writes.
   - `PrismaLaneStore.findCheckpointsForLane(identifier)`
     - Resolve the lane first, then query checkpoints by canonical internal lane ID.
   - `PrismaLaneStore.updateLaneBundle(identifier, input)` / `transitionLaneStatus(identifier, ...)` / `createCheckpoint(identifier, ...)` / `updateCheckpoint(identifier, ...)`
     - Resolve the lane first so public-route mutations update the correct row.
   - `AuthPgStore.resolveLaneOwnerId(identifier)`
     - Resolve exporter ownership from either lane identifier form.
3. Expected behavior and edge cases
   - Internal DB IDs continue to work unchanged.
   - Public `LN-...` IDs work on lane detail, completeness, checkpoints, transition, timeline, temperature, evidence, and audit paths because the guard and lane store semantics align.
   - Unknown IDs fail closed with the same observable errors as today.

### Test Coverage
- `src/modules/lane/lane.service.spec.ts`
  - `findById returns lane detail for public lane id`
    - detail lookup accepts `LN-...`
  - `getCompleteness evaluates lane addressed by public lane id`
    - completeness path stays identifier-agnostic
  - `getCheckpoints returns checkpoints for public lane id`
    - dependent-table reads resolve correctly
- `src/common/auth/auth.guards.spec.ts`
  - `lane owner guard forwards public lane id to owner resolution`
    - guard supports public route params
- `test/lane.e2e-spec.ts`
  - `GET /lanes/:id returns lane detail for public lane id`
    - controller + guard + service wiring
  - `GET /lanes/:id/completeness returns payload for public lane id`
    - guarded completeness route works
  - `GET /lanes/:id/checkpoints returns checkpoints for public lane id`
    - guarded checkpoint list works

### Decision Completeness
- Goal
  - Complete Task `6.6` by making user-visible lane IDs valid across lane-scoped backend endpoints.
- Non-goals
  - No schema migration.
  - No route renames.
  - No change to checkpoint or proof-pack route identifiers.
- Success criteria
  - Public lane IDs work on lane-scoped routes.
  - Ownership enforcement remains correct for exporters.
  - Focused unit/e2e/static gates pass.
- Public interfaces
  - Existing `lanes/:id*` and lane-scoped companion routes accept both internal and public lane IDs.
  - No new env vars, migrations, or message topics.
- Edge cases / failure modes
  - Unknown IDs fail closed.
  - Resolution prefers exact internal row ID match if present.
  - Child-table reads/writes always use canonical internal lane ID after resolution.
- Rollout & monitoring
  - Runtime-only additive change; no migration or backfill.
  - Watch 403/404 rates on lane-scoped endpoints after rollout.
- Acceptance checks
  - `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts src/common/auth/auth.guards.spec.ts`
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies
- Existing lane/auth module wiring only.

### Validation
- Focused unit RED/GREEN first.
- Focused lane e2e second.
- Backend static gates last.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Identifier-aware lane lookup in `lane.pg-store.ts` | `LaneController`, `EvidenceController`, `ColdChainController`, and other services that call lane store methods through lane-scoped route params | `src/modules/lane/lane.module.ts` providers | `lanes.id`, `lanes.lane_id`, related lane-owned tables |
| Identifier-aware lane ownership in `auth.pg-store.ts` | `LaneOwnerGuard` protecting `/lanes/:id*`, `/lanes/:id/evidence*`, `/lanes/:id/temperature`, and similar routes | `src/common/auth/auth.module.ts` providers | `lanes.id`, `lanes.lane_id`, `lanes.exporter_id` |

### Cross-Language Schema Verification
- Single-language verification completed from current SQL usage:
  - lane store currently queries `lanes.id` and hydrates `lane_id`
  - auth store currently resolves `lanes.exporter_id` from `lanes.id`
  - no migration needed; only query semantics widen

### Decision-Complete Checklist
- No open decisions remain.
- Public interface changes are enumerated.
- Every behavior change has a test target.
- Validation commands are specific.
- Wiring verification covers store + guard runtime paths.
- No rollout/backout migration required.

## Implementation Summary (2026-03-28 11:31 ICT)
- Broadened lane ownership resolution in `src/common/auth/auth.pg-store.ts` so guarded lane-scoped routes accept either internal `lanes.id` values or public `lanes.lane_id` values.
- Added canonical lane-row resolution in `src/modules/lane/lane.pg-store.ts` and switched lane hydration, checkpoint CRUD, proof-pack counts, evidence listing, and lane mutations to query child tables by the resolved internal lane ID.
- Broadened audit lane-stream lookup in `src/common/audit/audit.prisma-store.ts` so lane, checkpoint, artifact, and proof-pack audit queries all work when the caller supplies a public `LN-...` identifier.
- Broadened cold-chain lane context lookup in `src/modules/cold-chain/cold-chain.pg-store.ts` and updated `src/modules/cold-chain/cold-chain.service.ts` to use the resolved internal lane ID for readings and excursions after public-ID resolution.
- Normalized lane-scoped evidence and proof-pack controller paths in `src/modules/evidence/evidence.controller.ts` through `LaneService.findById(...)` before calling evidence, proof-pack, or audit services, so downstream services always receive the canonical internal lane ID.

## Test-First Notes
- Added focused RED coverage for public lane ID handling in:
  - `src/common/auth/auth.pg-store.spec.ts`
  - `src/common/audit/audit.prisma-store.spec.ts`
  - `src/modules/lane/lane.pg-store.spec.ts`
  - `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `test/evidence.e2e-spec.ts`
- The first RED run failed exactly on the intended gaps: owner lookup, lane-store dependent-table queries, audit lane-stream filtering, and cold-chain downstream writes still treated the public lane ID as the canonical database key.
- The evidence e2e slice also needed the existing worker-disable test harness pattern, so the test now sets `PROOF_PACK_WORKER_ENABLED=false` and `CERTIFICATION_EXPIRY_WORKER_ENABLED=false` during bootstrap.

## Validation (GREEN)
- `npm run test -- --runInBand src/common/auth/auth.pg-store.spec.ts src/modules/lane/lane.pg-store.spec.ts src/common/audit/audit.prisma-store.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`
- `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Outcome
- Task `6.6` is implementation-complete with no schema changes.
- Parent Task `6` is now ready to be marked `done` because all remaining subtasks are closed in code.

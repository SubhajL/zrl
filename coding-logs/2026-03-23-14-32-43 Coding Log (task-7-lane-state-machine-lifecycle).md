## Plan Draft A

### Overview
Finish Task 7 by extending the existing lane module with an explicit lifecycle transition endpoint and service-enforced transition graph. Keep the work isolated to lane module service/controller/store/schema/tests, persist a lane `status_changed_at` timestamp for archive-retention enforcement, and prove the behavior through RED/GREEN cycles.

### Files to Change
- `src/modules/lane/lane.types.ts`: transition input/types and store contract additions.
- `src/modules/lane/lane.constants.ts`: transition and retention constants.
- `src/modules/lane/lane.service.ts`: transition orchestration, guards, and transition audit hashing.
- `src/modules/lane/lane.controller.ts`: request parser and `POST /lanes/:id/transition`.
- `src/modules/lane/lane.pg-store.ts`: status persistence and proof-pack count queries.
- `src/modules/lane/lane.service.spec.ts`: unit tests for valid/invalid transitions and audit behavior.
- `test/lane.e2e-spec.ts`: endpoint wiring tests for transition success/failure contracts.
- `prisma/schema.prisma`: additive `statusChangedAt` column on `Lane`.
- `prisma/migrations/*_lane_state_machine/migration.sql`: additive migration and backfill.
- `docs/PROGRESS.md`: Task 7 completion note.

### Implementation Steps
TDD sequence:
1. Add service transition tests covering success, graph conflicts, readiness failures, and audit.
2. Run the focused unit test command and confirm failures for missing `transition` logic.
3. Implement the smallest service/type/constants changes to make the service tests pass.
4. Add e2e tests for `POST /lanes/:id/transition`.
5. Run the focused e2e command and confirm failures for missing route wiring.
6. Implement controller/store/schema wiring and rerun focused tests.
7. Run lint, typecheck, broader tests, and build.

Function names and behavior:
- `LaneService.transition(id, input, actor)`
  Validate ownership, validate graph, enforce readiness guards, persist the new status, and create an audit entry with old/new status in the hash payload.
- `LaneService.assertTransitionAllowed(lane, targetStatus)`
  Separate graph validation from readiness validation so `409` and `422` remain deterministic.
- `PrismaLaneStore.transitionLaneStatus(id, targetStatus, at)`
  Persist `status`, `status_changed_at`, and `updated_at`, then return the refreshed lane.
- `PrismaLaneStore.countProofPacksForLane(id)`
  Read `proof_packs` for the `VALIDATED -> PACKED` guard.

### Test Coverage
- `src/modules/lane/lane.service.spec.ts`
  - `transitions validated lanes when completeness threshold is met`
  - `rejects validated transition below completeness threshold`
  - `rejects illegal lifecycle jump with conflict exception`
  - `requires proof packs before packing a lane`
  - `requires retention window before archiving a closed lane`
  - `rejects exporter transitions for lanes they do not own`
- `test/lane.e2e-spec.ts`
  - `POST /lanes/:id/transition transitions a lane`
  - `POST /lanes/:id/transition returns 409 for illegal transition`
  - `POST /lanes/:id/transition returns 422 for unmet guard`
  - `POST /lanes/:id/transition rejects invalid payloads`

### Decision Completeness
- Goal: implement an auditable lane lifecycle transition API for Task 7.
- Non-goals: event-driven automatic transitions from other modules, proof-pack generation itself, frontend changes.
- Success criteria:
  - Transition graph is enforced in unit tests.
  - Transition endpoint is wired and covered by e2e tests.
  - Archive retention uses persisted timing rather than `updated_at`.
  - Each successful transition writes an audit entry.
- Public interfaces:
  - `POST /lanes/:id/transition`
  - Request `{ targetStatus: LaneStatus }`
  - Response `{ lane: LaneDetail }`
  - Errors `400`, `403`, `404`, `409`, `422`
  - Schema addition `lanes.status_changed_at`
- Edge cases / failure modes:
  - Invalid graph jumps fail closed with `409`.
  - Completeness/proof-pack/retention failures fail closed with `422`.
  - Ownership mismatch `403`, lane missing `404`, invalid payload `400`.
- Rollout & monitoring:
  - Additive migration with `COALESCE(updated_at, created_at)` backfill.
  - Monitor transition error counts and audit continuity.
- Acceptance checks:
  - `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
  - `npm run db:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Dependencies
- Existing lane/auth/audit/hashing modules.
- Existing `proof_packs` table in Prisma schema.

### Validation
Focused RED/GREEN first, then repo gates. Verify route registration and schema/table naming with exact-string searches before closing the task.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `LaneController.transition()` | `POST /lanes/:id/transition` | `src/modules/lane/lane.module.ts` | N/A |
| `LaneService.transition()` | `LaneController.transition()` | `LaneModule` service provider factory | `lanes`, `proof_packs` |
| `PrismaLaneStore.transitionLaneStatus()` | `LaneService.transition()` | `PrismaLaneStore` provider | `lanes.status`, `lanes.status_changed_at` |
| Migration `*_lane_state_machine` | Prisma migration path | Prisma migration tooling | `lanes.status_changed_at` |

## Plan Draft B

### Overview
Implement Task 7 with the smallest practical surface by keeping the transition graph directly in `LaneService` and adding only the minimum store helpers needed for status writes and proof-pack counts. Use one focused migration to support retention-safe archive behavior.

### Files to Change
- `src/modules/lane/lane.types.ts`
- `src/modules/lane/lane.service.ts`
- `src/modules/lane/lane.controller.ts`
- `src/modules/lane/lane.pg-store.ts`
- `src/modules/lane/lane.service.spec.ts`
- `test/lane.e2e-spec.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*`

### Implementation Steps
TDD sequence:
1. Use the existing service spec mocks and add failing transition cases.
2. Add a `transition` method plus minimal helper methods in `LaneService`.
3. Add route parsing and endpoint wiring.
4. Add store/schema support only when the tests require it.

Trade-off:
- Lower abstraction overhead.
- Slightly less reusable than a dedicated state-machine object, which is acceptable for the current module size.

### Test Coverage
- Same focused unit/e2e tests as Draft A, with emphasis on service-level failure classes and one happy-path endpoint test.

### Decision Completeness
- Same endpoint and migration surface as Draft A.
- Same fail-closed semantics for graph and readiness failures.

### Validation
- Same validation commands as Draft A.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `LaneService.transition()` | `LaneController.transition()` | `LaneModule.providers` | `lanes`, `proof_packs` |
| `LaneController.transition()` | `POST /lanes/:id/transition` | `LaneModule.controllers` | N/A |

## Comparative Analysis & Synthesis

### Strengths
- Draft A is clearer about rollout, audit payload shape, and archive-retention enforcement.
- Draft B keeps the implementation tight and aligned with the current module scale.

### Gaps
- Draft A can over-abstract if implemented too literally.
- Draft B underspecifies wiring and migration/backfill details.

### Unified Execution Plan

Implement the transition graph directly inside `LaneService`, but keep the rollout, migration, and wiring discipline from Draft A. Add the minimum lane store/schema surface needed to support `POST /lanes/:id/transition`, proof-pack guarding, and archive retention. Use focused RED/GREEN cycles in `lane.service.spec.ts` and `test/lane.e2e-spec.ts`, then run repo gates, append the g-coding summary to this log, and keep all edits inside lane state machine files/tests plus the additive lane schema migration they require.

## 2026-03-23 14:38 ICT

- Goal: finish Task 7 lane lifecycle enforcement in the isolated worktree with an auditable transition endpoint, readiness guards, and lane-only test coverage.
- What changed:
  - `src/modules/lane/lane.constants.ts`
    - Added lifecycle guard constants for validation completeness and archive retention.
  - `src/modules/lane/lane.types.ts`
    - Added `TransitionLaneInput`, `statusChangedAt`, and the new lane-store transition/proof-pack methods.
  - `src/modules/lane/lane.service.ts`
    - Implemented the lane transition graph, fail-closed completeness/proof-pack/archive guards, exporter ownership enforcement, and transition-specific audit hashing.
  - `src/modules/lane/lane.controller.ts`
    - Added `POST /lanes/:id/transition` with payload parsing and existing guard wiring.
  - `src/modules/lane/lane.pg-store.ts`
    - Added `status_changed_at` mapping, `transitionLaneStatus(...)`, and `countProofPacksForLane(...)`.
  - `src/modules/lane/lane.service.spec.ts`
    - Added RED/GREEN coverage for valid transitions, invalid jumps, readiness failures, audit payload hashing, and ownership rejection.
  - `test/lane.e2e-spec.ts`
    - Added endpoint wiring coverage for transition success, 409 conflict, 422 guard failure, and 400 invalid payload.
  - `prisma/schema.prisma`
    - Added `Lane.statusChangedAt`.
  - `prisma/migrations/20260323143243_lane_state_machine/migration.sql`
    - Added the additive lane timestamp column and backfill.
  - `docs/PROGRESS.md`
    - Added the Task 7 progress entry.
- TDD evidence:
  - RED command: `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
    - Failed with `TypeError: service.transition is not a function` across the new transition cases.
  - GREEN command: `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
    - Passed after adding the lane transition service/type/store surface.
  - RED command: `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
    - Failed with `404 Not Found` for `POST /lanes/:id/transition` because the controller route did not exist yet.
  - GREEN command: `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
    - Passed after adding the controller route and transition request parsing.
- Tests run and results:
  - `npm test -- --runInBand src/modules/lane/lane.service.spec.ts` — passed (`18/18`).
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts` — passed (`9/9`).
  - `for i in 1 2 3; do npm test -- --runInBand src/modules/lane/lane.service.spec.ts; done` — passed all three runs.
  - `for i in 1 2 3; do npm run test:e2e -- --runInBand test/lane.e2e-spec.ts; done` — passed all three runs.
  - `npm run db:generate` — passed.
  - `npm run typecheck` — passed.
  - `npm run lint` — passed.
  - `npm test` — passed (`77/77`).
  - `npm run build` — passed.
- Wiring verification evidence:
  - `rg -n "@Post\\(':id/transition'\\)|transition\\(|transitionLaneStatus\\(|countProofPacksForLane\\(|status_changed_at" src test prisma/schema.prisma prisma/migrations/20260323143243_lane_state_machine/migration.sql`
    - Confirmed controller route registration, service call site, store methods, schema field, and migration column wiring.
  - `git diff --staged --name-only`
    - Confirmed the working tree scope stayed inside the lane/state-machine files, additive schema/migration, progress log, and coding log pointer/log.
- Behavior changes and risk notes:
  - Transition graph now fails closed with `409` for illegal jumps.
  - Completeness, proof-pack, and archive-retention guards now fail closed with `422`.
  - Archive eligibility uses a persisted lane `statusChangedAt` timestamp instead of mutable `updatedAt`.
  - Lane creation still persists directly into `EVIDENCE_COLLECTING` to preserve the existing Task 6 behavior.
- Follow-ups / known gaps:
  - If product semantics later require a persisted `CREATED` state plus a separate auto-transition audit entry on creation, that should be implemented as a follow-up instead of changing the current Task 6 creation contract silently.

## Review (2026-03-23 14:38:15 ICT) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-7`
- Branch: `feature/task-7-lane-state-machine`
- Scope: `working-tree`
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; `git diff --staged --name-only`; `git diff --staged -- src/modules/lane/lane.constants.ts src/modules/lane/lane.types.ts src/modules/lane/lane.service.ts src/modules/lane/lane.controller.ts src/modules/lane/lane.pg-store.ts src/modules/lane/lane.service.spec.ts test/lane.e2e-spec.ts prisma/schema.prisma prisma/migrations/20260323143243_lane_state_machine/migration.sql docs/PROGRESS.md`; `rg -n "@Post\\(':id/transition'\\)|transition\\(|transitionLaneStatus\\(|countProofPacksForLane\\(|status_changed_at" src test prisma/schema.prisma prisma/migrations/20260323143243_lane_state_machine/migration.sql`

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
- Assumed the existing Task 6 lane-create contract should remain `EVIDENCE_COLLECTING` on initial persistence, with no separate persisted `CREATED` row.
- Assumed `proof_packs` rows are authoritative for readiness because no separate pack-status lifecycle exists in the current schema.

### Recommended Tests / Validation
- `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
- `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

### Rollout Notes
- Apply the additive `status_changed_at` migration before deploying the transition endpoint.
- Existing lane rows are backfilled from `COALESCE(updated_at, created_at)`; if any historical closed lanes were manually edited after closure before this feature existed, their archive eligibility timestamp may reflect that later update rather than the original closure event.
